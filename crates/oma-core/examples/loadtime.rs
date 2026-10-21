//! Native timing of `load` phases on the full dataset (public/data/markers.json or $OMA_MARKERS):
//!   cargo run -p oma-core --release --example loadtime
use std::time::Instant;
fn main() {
    let path = std::env::var("OMA_MARKERS").unwrap_or_else(|_| {
        concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../public/data/markers.json"
        )
        .to_string()
    });
    let s = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{path}: {e}"));
    let cmd = format!("{{\"cmd\":\"load\",\"markers\":{s}}}");
    let t = Instant::now();
    let v: serde_json::Value = serde_json::from_str(&cmd).unwrap();
    println!(
        "parse to Value      {:>7.1} ms",
        t.elapsed().as_secs_f64() * 1e3
    );
    let t = Instant::now();
    let ms: Vec<oma_core::Marker> = serde_json::from_value(v["markers"].clone()).unwrap();
    println!(
        "Value -> Vec<Marker>{:>7.1} ms",
        t.elapsed().as_secs_f64() * 1e3
    );
    let t = Instant::now();
    let ms2: Vec<oma_core::Marker> = serde_json::from_str(&s).unwrap();
    println!(
        "direct Vec<Marker>  {:>7.1} ms",
        t.elapsed().as_secs_f64() * 1e3
    );
    let t = Instant::now();
    let e = oma_core::Engine::new(ms);
    println!(
        "Engine::new         {:>7.1} ms ({} terms)",
        t.elapsed().as_secs_f64() * 1e3,
        e.text().vocab.len()
    );
    let t = Instant::now();
    let _ = oma_core::search::TextIndex::build(&ms2);
    println!(
        "  of which text idx {:>7.1} ms",
        t.elapsed().as_secs_f64() * 1e3
    );
    tokenize_only(&ms2);
    let mut st = oma_core::State::default();
    let t = Instant::now();
    let out = oma_core::handle(&mut st, cmd.as_bytes());
    println!(
        "handle(load) total  {:>7.1} ms {}",
        t.elapsed().as_secs_f64() * 1e3,
        String::from_utf8_lossy(&out)
    );
}

#[allow(dead_code)]
fn tokenize_only(ms: &[oma_core::Marker]) {
    let t = Instant::now();
    let mut n = 0usize;
    let mut buf = String::new();
    for m in ms {
        for s in [&m.title, &m.county, &m.city, &m.marker_text] {
            oma_core::text::for_each_token(s, &mut buf, |_| n += 1);
        }
    }
    println!(
        "tokenize only       {:>7.1} ms ({n} tokens, {} MB text)",
        t.elapsed().as_secs_f64() * 1e3,
        ms.iter().map(|m| m.marker_text.len()).sum::<usize>() / 1_000_000
    );
}
