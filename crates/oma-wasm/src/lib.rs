//! Thin C ABI over `oma-core`. No wasm-bindgen: load with plain `WebAssembly.instantiate`.
//!
//! Exports:
//! - `oma_alloc(len) -> ptr`   — allocate `len` bytes for the caller to write a command into.
//! - `oma_free(ptr, len)`      — free a buffer from `oma_alloc` or `oma_call` (same `len`).
//! - `oma_call(ptr, len) -> ptr` — run the UTF-8 JSON command at `ptr..ptr+len`. Returns a buffer
//!   laid out as `[u32 little-endian n][n bytes of UTF-8 JSON]`, exactly `4 + n` bytes long;
//!   free it with `oma_free(ptr, 4 + n)`. The input buffer stays owned by the caller.
//!
//! A panic in a command is caught (the module is built with `panic=unwind`) and returned as
//! `{"ok":false,"error":"panic: …"}`; the module keeps working.

use std::alloc::{alloc, dealloc, Layout};
use std::cell::RefCell;
use std::panic::{self, AssertUnwindSafe};

use oma_core::State;

thread_local! {
    static STATE: RefCell<State> = RefCell::new(State::default());
    static LAST_PANIC: RefCell<String> = const { RefCell::new(String::new()) };
}

fn layout(len: usize) -> Layout {
    Layout::from_size_align(len.max(1), 1).expect("layout")
}

#[no_mangle]
pub extern "C" fn oma_alloc(len: usize) -> *mut u8 {
    unsafe { alloc(layout(len)) }
}

/// # Safety
/// `ptr` must come from `oma_alloc(len)` or be an `oma_call` result whose total length is `len`.
#[no_mangle]
pub unsafe extern "C" fn oma_free(ptr: *mut u8, len: usize) {
    if !ptr.is_null() {
        dealloc(ptr, layout(len));
    }
}

fn install_hook() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        panic::set_hook(Box::new(|info| {
            let msg = if let Some(s) = info.payload().downcast_ref::<&str>() {
                (*s).to_string()
            } else if let Some(s) = info.payload().downcast_ref::<String>() {
                s.clone()
            } else {
                "unknown panic".to_string()
            };
            let at = info
                .location()
                .map(|l| format!(" at {}:{}", l.file(), l.line()))
                .unwrap_or_default();
            LAST_PANIC.with(|p| *p.borrow_mut() = format!("{msg}{at}"));
        }));
    });
}

/// Pure-Rust entry used by `oma_call` and by native tests.
pub fn call_bytes(input: &[u8]) -> Vec<u8> {
    install_hook();
    let r = panic::catch_unwind(AssertUnwindSafe(|| {
        STATE.with(|s| oma_core::handle(&mut s.borrow_mut(), input))
    }));
    match r {
        Ok(out) => out,
        Err(_) => {
            let msg = LAST_PANIC.with(|p| p.borrow().clone());
            serde_json::to_vec(&serde_json::json!({"ok": false, "error": format!("panic: {msg}")}))
                .unwrap_or_else(|_| br#"{"ok":false,"error":"panic"}"#.to_vec())
        }
    }
}

/// # Safety
/// `ptr..ptr+len` must be a readable buffer (normally from `oma_alloc`).
#[no_mangle]
pub unsafe extern "C" fn oma_call(ptr: *const u8, len: usize) -> *mut u8 {
    let input = if len == 0 {
        &[][..]
    } else {
        std::slice::from_raw_parts(ptr, len)
    };
    let out = call_bytes(input);
    let n = out.len();
    let total = 4 + n;
    let buf = alloc(layout(total));
    std::ptr::copy_nonoverlapping((n as u32).to_le_bytes().as_ptr(), buf, 4);
    std::ptr::copy_nonoverlapping(out.as_ptr(), buf.add(4), n);
    buf
}

#[cfg(test)]
mod tests {
    use super::*;

    fn call(s: &str) -> serde_json::Value {
        unsafe {
            let p = oma_alloc(s.len());
            std::ptr::copy_nonoverlapping(s.as_ptr(), p, s.len());
            let r = oma_call(p, s.len());
            oma_free(p, s.len());
            let n =
                u32::from_le_bytes(std::slice::from_raw_parts(r, 4).try_into().unwrap()) as usize;
            let v = serde_json::from_slice(std::slice::from_raw_parts(r.add(4), n)).unwrap();
            oma_free(r, 4 + n);
            v
        }
    }

    #[test]
    fn errors_are_json() {
        assert_eq!(call("not json")["ok"], false);
        assert_eq!(call(r#"{"cmd":"nope"}"#)["ok"], false);
        assert_eq!(call(r#"{"cmd":"nearby","lat":30,"lng":-97}"#)["ok"], false);
        // not loaded
    }

    #[test]
    fn panics_become_json_and_engine_survives() {
        let v = call(r#"{"cmd":"panic_test"}"#);
        assert_eq!(v["ok"], false);
        assert!(v["error"]
            .as_str()
            .unwrap()
            .starts_with("panic: panic_test requested"));
        let v = call(r#"{"cmd":"geo","fn":"haversine","args":[30,-97,31,-97]}"#);
        assert_eq!(v["ok"], true);
    }
}
