#!/usr/bin/env bash
# One Mile Ahead — Rust/WASM engine build.
#
#   ./build.sh            cargo test → build WASM → npm test (incl. differential) → assemble demo
#   ./build.sh --wasm     only build the WASM into src/engine/oma_engine.wasm
#
# Toolchain (pinned in rust-toolchain.toml: 1.97.0)
# -------------------------------------------------
# The engine catches panics and returns them as JSON errors instead of trapping. That needs
# `panic=unwind` on wasm32 (WebAssembly exception handling), and the prebuilt wasm32 std is
# built `panic=abort`, so we always rebuild std from source with -Zbuild-std. That is the same
# path you'd need if `rustup target add wasm32-unknown-unknown` is blocked (it was in the
# environment this prototype was built in: static.rust-lang.org was unreachable).
#
# -Zbuild-std needs the `rust-src` component matching the compiler EXACTLY. If
# `rustup component add rust-src` is blocked too, this script fetches the identical sources from
# GitHub instead:
#   1. read the compiler's commit hash:          rustc -vV | grep commit-hash
#   2. sparse-clone rust-lang/rust `library/` at the release tag (1.97.0) and check the commit
#      matches that hash
#   3. fetch the `library/backtrace` submodule (rust-lang/backtrace-rs) at the commit the rust
#      tree pins (git ls-tree HEAD library/backtrace)
#   4. copy `library/` to $(rustc --print sysroot)/lib/rustlib/src/rust/library
# The build itself uses RUSTC_BOOTSTRAP=1 to allow -Z flags on the stable 1.97.0 compiler:
#   RUSTC_BOOTSTRAP=1 RUSTFLAGS="-C panic=unwind -C target-feature=+exception-handling" \
#     cargo build -p oma-wasm --release --target wasm32-unknown-unknown -Zbuild-std=std,panic_unwind
#
# If rustup cannot download "1.97.0" but an installed toolchain *is* 1.97.0 (e.g. "stable"),
# alias it so rust-toolchain.toml resolves offline:
#   ln -s stable-x86_64-unknown-linux-gnu ~/.rustup/toolchains/1.97.0-x86_64-unknown-linux-gnu
set -euo pipefail
cd "$(dirname "$0")"

RUST_TAG="1.97.0"
WASM_OUT="src/engine/oma_engine.wasm"
TARGET="wasm32-unknown-unknown"

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

ensure_rust_src() {
  local sysroot src commit tmp bt_commit
  sysroot="$(rustc --print sysroot)"
  src="$sysroot/lib/rustlib/src/rust/library"
  if [[ -f "$src/std/Cargo.toml" && -f "$src/backtrace/src/lib.rs" ]]; then
    return
  fi
  step "rust-src missing — trying rustup"
  if rustup component add rust-src 2>/dev/null && [[ -f "$src/backtrace/src/lib.rs" ]]; then
    return
  fi
  commit="$(rustc -vV | sed -n 's/^commit-hash: //p')"
  step "rustup blocked — fetching library/ for rustc $commit from GitHub"
  tmp="$(mktemp -d)"
  git clone -q --depth 1 --filter=blob:none --sparse --branch "$RUST_TAG" https://github.com/rust-lang/rust "$tmp/rust"
  git -C "$tmp/rust" sparse-checkout set library
  if [[ "$(git -C "$tmp/rust" rev-parse HEAD)" != "$commit" ]]; then
    echo "error: tag $RUST_TAG is $(git -C "$tmp/rust" rev-parse HEAD), compiler is $commit" >&2
    exit 1
  fi
  bt_commit="$(git -C "$tmp/rust" ls-tree HEAD library/backtrace | awk '{print $3}')"
  git init -q "$tmp/bt"
  git -C "$tmp/bt" fetch -q --depth 1 https://github.com/rust-lang/backtrace-rs.git "$bt_commit"
  git -C "$tmp/bt" checkout -q FETCH_HEAD
  mkdir -p "$sysroot/lib/rustlib/src/rust"
  rm -rf "$src"
  cp -r "$tmp/rust/library" "$src"
  rm -rf "$src/backtrace" && mkdir -p "$src/backtrace"
  cp -r "$tmp/bt/." "$src/backtrace/" && rm -rf "$src/backtrace/.git"
  rm -rf "$tmp"
}

build_wasm() {
  step "Building WASM ($TARGET, build-std, panic=unwind)"
  # Harmless if blocked; std is rebuilt from source either way (see header).
  rustup target add "$TARGET" >/dev/null 2>&1 || echo "(rustup target add $TARGET unavailable — using build-std only)"
  ensure_rust_src
  RUSTC_BOOTSTRAP=1 RUSTFLAGS="-C panic=unwind -C target-feature=+exception-handling" \
    cargo build -p oma-wasm --release --target "$TARGET" -Zbuild-std=std,panic_unwind
  cp "target/$TARGET/release/oma_wasm.wasm" "$WASM_OUT"
  echo "$WASM_OUT: $(wc -c < "$WASM_OUT") bytes"
}

if [[ "${1:-}" == "--wasm" ]]; then
  build_wasm
  exit 0
fi

step "Rust tests (release; includes grid-vs-scan on public/data/markers.json or \$OMA_MARKERS if present)"
cargo test --workspace --release

build_wasm

step "npm test (unit + TS↔WASM differential)"
npm test

step "Assembling prototypes/ahead-demo.html"
node scripts/assemble-demo.mjs

step "Done"
