//! Engine-level behaviour not covered by the TS differential suite.

use oma_core::{handle, State};
use serde_json::{json, Value};

const FIXTURE: &str = include_str!("../../../fixtures/i35-austin-waco.json");

fn call(st: &mut State, v: Value) -> Value {
    serde_json::from_slice(&handle(st, v.to_string().as_bytes())).unwrap()
}

#[test]
fn lazy_text_index_gives_identical_search_results() {
    let markers: Value = serde_json::from_str::<Value>(FIXTURE).unwrap()["markers"].clone();
    let (mut eager, mut lazy) = (State::default(), State::default());
    let a = call(&mut eager, json!({"cmd": "load", "markers": markers}));
    let b = call(
        &mut lazy,
        json!({"cmd": "load", "markers": markers, "lazy_text": true}),
    );
    assert!(a["tokens"].as_u64().unwrap() > 0);
    assert_eq!(b["tokens"], 0, "lazy load skips the text index");
    for q in [
        "salado",
        "baptist church",
        "temple",
        "georgetown cemetery",
        "xyzzy",
    ] {
        let cmd = json!({"cmd": "search", "q": q, "limit": 10});
        assert_eq!(call(&mut eager, cmd.clone()), call(&mut lazy, cmd), "{q}");
    }
}

#[test]
fn search_finds_by_title_city_and_inscription_with_field_weights() {
    let markers: Value = serde_json::from_str::<Value>(FIXTURE).unwrap()["markers"].clone();
    let mut st = State::default();
    call(&mut st, json!({"cmd": "load", "markers": markers}));
    let r = call(&mut st, json!({"cmd": "search", "q": "salado", "limit": 5}));
    let top = &r["results"][0];
    let hay = format!("{} {}", top["title"], top["city"]).to_lowercase();
    assert!(
        hay.contains("salado"),
        "title/city match outranks inscription-only: {top}"
    );
    // Typo tolerance (one edit) on longer words.
    let r = call(
        &mut st,
        json!({"cmd": "search", "q": "georgetwn", "limit": 3}),
    );
    assert!(r["results"]
        .as_array()
        .unwrap()
        .iter()
        .any(|m| m["city"] == "Georgetown"));
}

#[test]
fn commands_before_load_and_bad_input_are_errors_not_panics() {
    let mut st = State::default();
    for v in [
        json!({"cmd": "nearby", "lat": 30, "lng": -97}),
        json!({"cmd": "load"}),
        json!({"cmd": "load", "markers": [{"id": "x"}]}),
        json!({"cmd": "ahead"}),
        json!({"nocmd": 1}),
    ] {
        let r = call(&mut st, v.clone());
        assert_eq!(r["ok"], false, "{v}");
    }
}

#[test]
fn lookup_returns_lowest_numbered_prefix_matches() {
    // OMA-FUNC-LOOKUP-2: string order would give 1, 10, 100, 1000 for "1" with a limit of 4.
    let nums = ["1000", "13", "100", "2", "12", "10", "19", "1", "11"];
    let markers: Vec<Value> = nums
        .iter()
        .enumerate()
        .map(|(i, n)| json!({"id": 100 + i, "markerNumber": n, "title": format!("Marker {n}"), "county": "", "city": "",
            "lat": 0, "lng": 0, "markerText": "", "markerDate": "", "subjectCodes": [], "isRTHL": false, "size": ""}))
        .collect();
    let mut st = State::default();
    call(&mut st, json!({"cmd": "load", "markers": markers}));
    let numbers = |v: Value| -> Vec<String> {
        v["results"]
            .as_array()
            .unwrap()
            .iter()
            .map(|m| m["markerNumber"].as_str().unwrap().to_string())
            .collect()
    };
    assert_eq!(
        numbers(call(
            &mut st,
            json!({"cmd": "lookup", "number": "1", "limit": 4})
        )),
        ["1", "10", "11", "12"]
    );
    assert_eq!(
        numbers(call(&mut st, json!({"cmd": "lookup", "number": "1"}))),
        ["1", "10", "11", "12", "13", "19", "100", "1000"]
    );
}
