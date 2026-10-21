//! JSON command dispatch. Each command is (state, input) → (output, state').

use serde::Deserialize;
use serde_json::{json, Map, Value};

use crate::ahead::{ahead, AheadItem, AheadParams, CueState, Fix};
use crate::geo;
use crate::index::Engine;
use crate::lookup::lookup;
use crate::marker::Marker;
use crate::nearby::nearby;
use crate::research::project_research;

#[derive(Default)]
pub struct State {
    pub engine: Engine,
    pub cues: CueState,
    pub loaded: bool,
}

fn marker_json(m: &Marker) -> Value {
    serde_json::to_value(m).expect("marker serializes")
}

fn ahead_item_json(e: &Engine, it: &AheadItem) -> Value {
    json!({
        "marker": marker_json(&e.markers[it.idx as usize]),
        "along_mi": it.along_mi,
        "cross_ft": it.cross_ft,
        "side": it.side,
        "eta_s": it.eta_s,
    })
}

fn get<T: for<'de> Deserialize<'de>>(
    input: &Map<String, Value>,
    key: &str,
) -> Result<Option<T>, String> {
    match input.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(v) => serde_json::from_value(v.clone())
            .map(Some)
            .map_err(|e| format!("bad `{key}`: {e}")),
    }
}

fn req<T: for<'de> Deserialize<'de>>(input: &Map<String, Value>, key: &str) -> Result<T, String> {
    get(input, key)?.ok_or_else(|| format!("missing `{key}`"))
}

fn need_loaded(state: &State) -> Result<(), String> {
    if state.loaded {
        Ok(())
    } else {
        Err("engine not loaded: call `load` first".into())
    }
}

/// Run one command. `Ok(output)` is wrapped as `{"ok":true,...}` by `handle`.
pub fn run(state: &mut State, input: &mut Map<String, Value>) -> Result<Value, String> {
    let cmd: String = req(input, "cmd")?;
    match cmd.as_str() {
        "load" => {
            // Take ownership: the full dataset is ~17 MB of JSON, don't clone it.
            let raw = input.remove("markers").ok_or("missing `markers`")?;
            let markers: Vec<Marker> =
                serde_json::from_value(raw).map_err(|e| format!("bad `markers`: {e}"))?;
            // `lazy_text: true` defers the text index to the first `search` (it is ~2/3 of load).
            let lazy: bool = get(input, "lazy_text")?.unwrap_or(false);
            let engine = if lazy {
                Engine::new_lazy_text(markers)
            } else {
                Engine::new(markers)
            };
            let out = json!({
                "count": engine.markers.len(),
                "spatial": engine.spatial_count,
                "cells": engine.grid.len(),
                "tokens": if engine.text_built() { engine.text().vocab.len() } else { 0 },
            });
            *state = State {
                engine,
                cues: CueState::default(),
                loaded: true,
            };
            Ok(out)
        }
        "nearby" => {
            need_loaded(state)?;
            let lat: f64 = req(input, "lat")?;
            let lng: f64 = req(input, "lng")?;
            let limit: i64 = get(input, "limit")?.unwrap_or(50);
            let radius: Option<f64> = get(input, "radius_mi")?;
            let e = &state.engine;
            let results: Vec<Value> = nearby(e, lat, lng, limit, radius)
                .into_iter()
                .map(|h| json!({"marker": marker_json(&e.markers[h.idx as usize]), "distance": h.distance, "bearing": h.bearing}))
                .collect();
            Ok(json!({ "results": results }))
        }
        "ahead" => {
            need_loaded(state)?;
            let fixes: Vec<Fix> = req(input, "fixes")?;
            let d = AheadParams::default();
            let p = AheadParams {
                horizon_mi: get(input, "horizon_mi")?.unwrap_or(d.horizon_mi),
                corridor_ft: get(input, "corridor_ft")?.unwrap_or(d.corridor_ft),
                cue_mi: get(input, "cue_mi")?.unwrap_or(d.cue_mi),
            };
            let (out, next) = ahead(&state.engine, &state.cues, &fixes, &p);
            state.cues = next;
            let e = &state.engine;
            Ok(json!({
                "status": out.status,
                "heading": out.heading,
                "speed_mps": out.speed_mps,
                "results": out.items.iter().map(|it| ahead_item_json(e, it)).collect::<Vec<_>>(),
                "cues": out.cues.iter().map(|it| ahead_item_json(e, it)).collect::<Vec<_>>(),
            }))
        }
        "reset_cues" => {
            state.cues = CueState::default();
            Ok(json!({}))
        }
        "lookup" => {
            need_loaded(state)?;
            let number: String = req(input, "number")?;
            let limit: i64 = get(input, "limit")?.unwrap_or(20);
            let e = &state.engine;
            let results: Vec<Value> = lookup(e, &number, limit)
                .into_iter()
                .map(|i| marker_json(&e.markers[i as usize]))
                .collect();
            Ok(json!({ "results": results }))
        }
        "search" => {
            need_loaded(state)?;
            let q: String = req(input, "q")?;
            let limit: i64 = get(input, "limit")?.unwrap_or(20);
            let e = &state.engine;
            let results: Vec<Value> = e
                .text()
                .search(&q, limit.max(0) as usize)
                .into_iter()
                .map(|i| marker_json(&e.markers[i as usize]))
                .collect();
            Ok(json!({ "results": results }))
        }
        "research" => {
            let md: String = req(input, "markdown")?;
            Ok(json!({ "result": project_research(&md) }))
        }
        "geo" => {
            let f: String = req(input, "fn")?;
            let a: Vec<f64> = req(input, "args")?;
            let arg = |i: usize| {
                a.get(i)
                    .copied()
                    .ok_or_else(|| format!("`{f}` needs {} args", i + 1))
            };
            let value = match f.as_str() {
                "haversine" => json!(geo::haversine(arg(0)?, arg(1)?, arg(2)?, arg(3)?)),
                "bearing" => json!(geo::bearing(arg(0)?, arg(1)?, arg(2)?, arg(3)?)),
                "formatDistance" => json!(geo::format_distance(arg(0)?)),
                "formatBearing" => json!(geo::format_bearing(arg(0)?)),
                other => return Err(format!("unknown geo fn `{other}`")),
            };
            Ok(json!({ "value": value }))
        }
        "panic_test" => panic!("panic_test requested"),
        other => Err(format!("unknown cmd `{other}`")),
    }
}

/// Bytes in, bytes out. Never fails: errors become `{"ok":false,"error":...}`.
pub fn handle(state: &mut State, input: &[u8]) -> Vec<u8> {
    let result = match serde_json::from_slice::<Value>(input) {
        Ok(Value::Object(mut map)) => run(state, &mut map),
        Ok(_) => Err("command must be a JSON object".into()),
        Err(e) => Err(format!("invalid JSON: {e}")),
    };
    let v = match result {
        Ok(Value::Object(mut m)) => {
            m.insert("ok".into(), Value::Bool(true));
            Value::Object(m)
        }
        Ok(other) => json!({"ok": true, "value": other}),
        Err(e) => json!({"ok": false, "error": e}),
    };
    serde_json::to_vec(&v)
        .unwrap_or_else(|_| br#"{"ok":false,"error":"unserializable output"}"#.to_vec())
}
