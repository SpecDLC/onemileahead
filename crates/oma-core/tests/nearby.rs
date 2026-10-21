//! The grid `nearby` must equal the full scan for every query (the TS-equivalence itself is
//! proved by the vitest differential suite; this pins the grid's termination bound).

use oma_core::nearby::{nearby, nearby_scan};
use oma_core::{Engine, Marker};
use serde_json::Value;

const FIXTURE: &str = include_str!("../../../fixtures/i35-austin-waco.json");

fn engines() -> Vec<(String, Engine)> {
    let v: Value = serde_json::from_str(FIXTURE).unwrap();
    let mut out = vec![(
        "fixture".to_string(),
        Engine::new(serde_json::from_value(v["markers"].clone()).unwrap()),
    )];
    // Full dataset when present: public/data/markers.json (gitignored) or $OMA_MARKERS — the same
    // rule as src/engine/__tests__/datasetPath.ts.
    let full = std::env::var("OMA_MARKERS").unwrap_or_else(|_| {
        concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../public/data/markers.json"
        )
        .to_string()
    });
    if let Ok(s) = std::fs::read_to_string(&full) {
        let ms: Vec<Marker> = serde_json::from_str(&s).unwrap();
        out.push(("full".to_string(), Engine::new(ms)));
    } else {
        eprintln!("note: full-dataset cases skipped: {full} not found");
    }
    out
}

fn lcg(seed: &mut u64) -> f64 {
    *seed = seed
        .wrapping_mul(6364136223846793005)
        .wrapping_add(1442695040888963407);
    (*seed >> 11) as f64 / (1u64 << 53) as f64
}

#[test]
fn grid_equals_full_scan() {
    for (name, e) in engines() {
        let mut seed = 7u64;
        let queries = if name == "full" { 120 } else { 400 };
        for q in 0..queries {
            // Mostly inside Texas, some outside, some exactly on markers and cell edges.
            let (lat, lng) = match q % 4 {
                0 if !e.markers.is_empty() => {
                    let m = &e.markers[(lcg(&mut seed) * e.markers.len() as f64) as usize];
                    (m.lat, m.lng)
                }
                1 => (
                    (lcg(&mut seed) * 2000.0).floor() * 0.015,
                    -(lcg(&mut seed) * 7000.0).floor() * 0.015,
                ),
                2 => (40.0 + lcg(&mut seed) * 5.0, -80.0 - lcg(&mut seed) * 10.0),
                _ => (25.8 + lcg(&mut seed) * 10.7, -106.6 + lcg(&mut seed) * 13.1),
            };
            for &limit in &[1i64, 5, 50, 200, 0, -3] {
                for radius in [None, Some(1.0), Some(25.0)] {
                    let a = nearby(&e, lat, lng, limit, radius);
                    let b = nearby_scan(&e, lat, lng, limit, radius);
                    assert_eq!(
                        a, b,
                        "{name}: q={q} ({lat},{lng}) limit={limit} radius={radius:?}"
                    );
                }
            }
        }
    }
}

#[test]
fn zero_zero_never_nearby() {
    for (_, e) in engines() {
        for h in nearby(&e, 0.0, 0.0, 10_000, None) {
            assert!(e.markers[h.idx as usize].has_coords());
        }
    }
}

#[test]
fn antimeridian_and_out_of_range_longitudes_match_the_scan() {
    let mk = |id: i64, lat: f64, lng: f64| Marker {
        id,
        marker_number: id.to_string(),
        title: String::new(),
        county: String::new(),
        city: String::new(),
        lat,
        lng,
        marker_text: String::new(),
        marker_date: String::new(),
        subject_codes: vec![],
        is_rthl: false,
        size: String::new(),
    };
    let e = Engine::new(vec![
        mk(1, 10.0, 179.999),
        mk(2, 10.0, -179.999),
        mk(3, 10.0, 179.0),
        mk(4, 30.27, 262.26),
        mk(5, 30.27, -97.74),
    ]);
    for (lat, lng) in [
        (10.0, 179.9995),
        (10.0, -179.9995),
        (30.27, -97.7401),
        (89.9, 0.0),
    ] {
        for limit in [1, 3, 5] {
            assert_eq!(
                nearby(&e, lat, lng, limit, None),
                nearby_scan(&e, lat, lng, limit, None),
                "({lat},{lng}) {limit}"
            );
        }
    }
}
