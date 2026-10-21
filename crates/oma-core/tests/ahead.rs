//! `ahead` on synthetic GPS traces.

use oma_core::ahead::{ahead, estimate_motion, AheadOut, AheadParams, CueState, Fix, Side, Status};
use oma_core::geo::{bearing, haversine, METERS_PER_MILE};
use oma_core::{Engine, Marker};
use serde_json::Value;

const FIXTURE: &str = include_str!("../../../fixtures/i35-austin-waco.json");
const ROUTE: &str = include_str!("../../../fixtures/i35-route.json");

fn fixture_markers() -> Vec<Marker> {
    let v: Value = serde_json::from_str(FIXTURE).unwrap();
    serde_json::from_value(v["markers"].clone()).unwrap()
}

fn route() -> Vec<(f64, f64)> {
    let v: Value = serde_json::from_str(ROUTE).unwrap();
    v["points"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| (p[0].as_f64().unwrap(), p[1].as_f64().unwrap()))
        .collect()
}

fn mk(id: i64, num: &str, lat: f64, lng: f64) -> Marker {
    Marker {
        id,
        marker_number: num.into(),
        title: format!("Marker {num}"),
        county: "Test".into(),
        city: "Test".into(),
        lat,
        lng,
        marker_text: String::new(),
        marker_date: String::new(),
        subject_codes: vec![],
        is_rthl: false,
        size: String::new(),
    }
}

/// Destination point `d_mi` from (lat,lng) on bearing `brg` (spherical).
fn dest(lat: f64, lng: f64, brg: f64, d_mi: f64) -> (f64, f64) {
    let r = 3958.8;
    let (p1, l1, b, dr) = (
        lat.to_radians(),
        lng.to_radians(),
        brg.to_radians(),
        d_mi / r,
    );
    let p2 = (p1.sin() * dr.cos() + p1.cos() * dr.sin() * b.cos()).asin();
    let l2 = l1 + (b.sin() * dr.sin() * p1.cos()).atan2(dr.cos() - p1.sin() * p2.sin());
    (p2.to_degrees(), l2.to_degrees())
}

/// 1 Hz fixes along a polyline at `mps`, no device heading/speed.
fn drive(points: &[(f64, f64)], mps: f64, t0: f64) -> Vec<Fix> {
    let step_mi = mps / METERS_PER_MILE;
    let mut out = vec![];
    let mut t = t0;
    let mut s = 0.0; // distance into the current segment of the next fix
    for w in points.windows(2) {
        let (a, b) = (w[0], w[1]);
        let len = haversine(a.0, a.1, b.0, b.1);
        let brg = bearing(a.0, a.1, b.0, b.1);
        while s < len {
            let (lat, lng) = dest(a.0, a.1, brg, s);
            out.push(Fix {
                lat,
                lng,
                t,
                heading: None,
                speed: None,
            });
            t += 1000.0;
            s += step_mi;
        }
        s -= len;
    }
    out
}

/// Feed fixes one at a time (window of the last 30), like the app would.
fn replay(
    e: &Engine,
    fixes: &[Fix],
    p: &AheadParams,
    mut state: CueState,
) -> (Vec<AheadOut>, CueState) {
    let mut outs = vec![];
    for i in 0..fixes.len() {
        let lo = i.saturating_sub(29);
        let (o, s) = ahead(e, &state, &fixes[lo..=i], p);
        state = s;
        outs.push(o);
    }
    (outs, state)
}

fn cued_numbers(e: &Engine, outs: &[AheadOut]) -> Vec<String> {
    outs.iter()
        .flat_map(|o| {
            o.cues
                .iter()
                .map(|c| e.markers[c.idx as usize].marker_number.clone())
        })
        .collect()
}

/// Distance (mi) from a point to the polyline.
fn off_route(pts: &[(f64, f64)], lat: f64, lng: f64) -> f64 {
    let mut best = f64::INFINITY;
    for w in pts.windows(2) {
        let (a, b) = (w[0], w[1]);
        let k = a.0.to_radians().cos();
        let (bx, by) = ((b.1 - a.1) * k, b.0 - a.0);
        let (px, py) = ((lng - a.1) * k, lat - a.0);
        let t = ((px * bx + py * by) / (bx * bx + by * by)).clamp(0.0, 1.0);
        best = best.min(haversine(
            lat,
            lng,
            a.0 + t * (b.0 - a.0),
            a.1 + t * (b.1 - a.1),
        ));
    }
    best
}

#[test]
fn straight_line_geometry_is_exact_enough() {
    // Due north at 30 m/s; marker 1 mi ahead and 0.1 mi to the right (east), one behind, one far left.
    let (lat0, lng0) = (31.0, -97.5);
    let (a_lat, a_lng) = dest(lat0, lng0, 0.0, 1.0);
    let (r_lat, r_lng) = dest(a_lat, a_lng, 90.0, 0.1);
    let (l_lat, l_lng) = dest(dest(lat0, lng0, 0.0, 3.0).0, lng0, 270.0, 0.05);
    let (b_lat, b_lng) = dest(lat0, lng0, 180.0, 0.5);
    let e = Engine::new(vec![
        mk(1, "1", r_lat, r_lng),
        mk(2, "2", l_lat, l_lng),
        mk(3, "3", b_lat, b_lng),
    ]);
    let fix = Fix {
        lat: lat0,
        lng: lng0,
        t: 0.0,
        heading: Some(0.0),
        speed: Some(30.0),
    };
    // 4 s earlier, 120 m back along the road: cues need a few seconds of track (STILL_MIN_SPAN_MS).
    let (p_lat, p_lng) = dest(lat0, lng0, 180.0, 120.0 / METERS_PER_MILE);
    let prev = Fix {
        lat: p_lat,
        lng: p_lng,
        t: -4000.0,
        ..fix
    };
    let (o, _) = ahead(&e, &CueState::default(), &[prev, fix], &AheadParams::default());
    assert_eq!(o.status, Status::Ok);
    assert_eq!(o.items.len(), 2, "the marker behind is excluded");
    let first = &o.items[0];
    assert_eq!(e.markers[first.idx as usize].id, 1);
    assert!(
        (first.along_mi - 1.0).abs() < 0.002,
        "along {}",
        first.along_mi
    );
    assert!(
        (first.cross_ft - 528.0).abs() < 3.0,
        "cross {}",
        first.cross_ft
    );
    assert_eq!(first.side, Side::Right);
    assert!((first.eta_s.unwrap() - METERS_PER_MILE / 30.0).abs() < 5.0);
    assert_eq!(o.items[1].side, Side::Left);
    assert!(o.items[0].along_mi < o.items[1].along_mi);
    assert_eq!(o.cues.len(), 1, "only the marker at <= 1 mi cues");
}

#[test]
fn i35_northbound_cues_each_roadside_marker_once_in_order() {
    let pts = route();
    let e = Engine::new(fixture_markers());
    let fixes = drive(&pts, 31.0, 0.0); // ~70 mph
    let p = AheadParams {
        horizon_mi: 10.0,
        corridor_ft: 1500.0,
        cue_mi: 1.0,
    };
    let (outs, _) = replay(&e, &fixes, &p, CueState::default());
    let cued = cued_numbers(&e, &outs);

    // Never twice.
    let mut seen = std::collections::HashSet::new();
    for n in &cued {
        assert!(seen.insert(n.clone()), "marker {n} announced twice");
    }
    // Every marker within 600 ft of the road (and not at the very start) is announced.
    for m in &e.markers {
        if !m.has_coords() {
            continue;
        }
        let near = off_route(&pts, m.lat, m.lng) <= 600.0 / 5280.0;
        let start = haversine(pts[0].0, pts[0].1, m.lat, m.lng) < 0.05;
        if near && !start {
            assert!(
                cued.contains(&m.marker_number),
                "roadside marker {} ({}) never cued",
                m.marker_number,
                m.title
            );
        }
    }
    // Markers 3+ miles off the road never appear in the corridor at all.
    for o in &outs {
        for it in &o.items {
            let m = &e.markers[it.idx as usize];
            assert!(
                off_route(&pts, m.lat, m.lng) < 3.0,
                "{} is 3+ mi off I-35",
                m.marker_number
            );
        }
    }
    // Announced in driving order (along-route position never jumps back by more than 0.5 mi).
    let pos = |n: &str| {
        let m = e.markers.iter().find(|m| m.marker_number == n).unwrap();
        fixes
            .iter()
            .enumerate()
            .min_by(|a, b| {
                haversine(a.1.lat, a.1.lng, m.lat, m.lng)
                    .partial_cmp(&haversine(b.1.lat, b.1.lng, m.lat, m.lng))
                    .unwrap()
            })
            .unwrap()
            .0 as f64
            * 31.0
            / METERS_PER_MILE
    };
    let mut last = 0.0;
    for n in &cued {
        let p = pos(n);
        assert!(
            p + 0.5 >= last,
            "cue for {n} at route mile {p:.2} came after mile {last:.2}"
        );
        last = last.max(p);
    }
    assert!(
        cued.len() >= 12,
        "expected plenty of cues along I-35, got {}",
        cued.len()
    );
    // Status is Ok for essentially the whole drive (first fix has no motion estimate yet).
    let ok = outs.iter().filter(|o| o.status == Status::Ok).count();
    assert!(ok as f64 >= 0.95 * outs.len() as f64);
}

#[test]
fn u_turn_flips_ahead_to_behind_without_reannouncing() {
    // Straight road due north; markers every half mile.
    let (lat0, lng0) = (31.0, -97.5);
    let markers: Vec<Marker> = (1..=10)
        .map(|i| {
            let (lat, lng) = dest(lat0, lng0, 0.0, 0.5 * i as f64);
            mk(i, &format!("{}", 100 + i), lat, lng)
        })
        .collect();
    let e = Engine::new(markers);
    let p = AheadParams::default();
    let start = dest(lat0, lng0, 180.0, 0.5);
    let turn = dest(lat0, lng0, 0.0, 1.25); // past markers 101, 102; 103 at 1.5 is 0.25 ahead
    let back = dest(lat0, lng0, 180.0, 1.0);
    let north = drive(&[start, turn], 25.0, 0.0);
    let (outs_n, st) = replay(&e, &north, &p, CueState::default());
    let cued_n = cued_numbers(&e, &outs_n);
    assert!(cued_n.contains(&"103".to_string()) && cued_n.contains(&"104".to_string()));
    let last_n = outs_n.last().unwrap();
    let ahead_ids: Vec<i64> = last_n
        .items
        .iter()
        .map(|i| e.markers[i.idx as usize].id)
        .collect();
    assert_eq!(
        ahead_ids.first(),
        Some(&3),
        "103 is next ahead before the U-turn"
    );

    // U-turn and drive back south (continue the same timeline).
    let t0 = north.last().unwrap().t + 1000.0;
    let south = drive(&[turn, back], 25.0, t0);
    let mut fixes = north.clone();
    fixes.extend(south.iter().copied());
    let mut state = st;
    let mut cued_s = vec![];
    let mut last = None;
    for i in north.len()..fixes.len() {
        let lo = i.saturating_sub(29);
        let (o, s) = ahead(&e, &state, &fixes[lo..=i], &p);
        state = s;
        cued_s.extend(
            o.cues
                .iter()
                .map(|c| e.markers[c.idx as usize].marker_number.clone()),
        );
        last = Some(o);
    }
    let last = last.unwrap();
    assert_eq!(last.status, Status::Ok);
    assert!(
        last.heading
            .map(|h| (h - 180.0).abs() < 2.0)
            .unwrap_or(false),
        "heading south after U-turn"
    );
    let now_ahead: Vec<i64> = last
        .items
        .iter()
        .map(|i| e.markers[i.idx as usize].id)
        .collect();
    assert!(
        !now_ahead.contains(&3) && !now_ahead.contains(&4),
        "markers that were ahead are now behind"
    );
    // 101 and 102 were cued going north and are passed again going south: not re-announced.
    assert!(cued_s.is_empty(), "re-announced after U-turn: {cued_s:?}");
}

/// Deterministic pseudo-random in [-1, 1].
fn rnd(seed: &mut u64) -> f64 {
    *seed ^= *seed << 13;
    *seed ^= *seed >> 7;
    *seed ^= *seed << 17;
    (*seed % 20001) as f64 / 10000.0 - 1.0
}

#[test]
fn jitter_while_stopped_never_cues() {
    let (lat0, lng0) = (31.0, -97.5);
    let (m_lat, m_lng) = dest(lat0, lng0, 0.0, 0.6);
    let e = Engine::new(vec![mk(1, "1", m_lat, m_lng)]);
    let p = AheadParams::default();
    for (amp_m, seed0) in [5.0, 15.0, 30.0, 50.0]
        .iter()
        .flat_map(|&a| (1..=5u64).map(move |k| (a, k.wrapping_mul(0x9E3779B97F4A7C15))))
    {
        let mut seed = seed0;
        let fixes: Vec<Fix> = (0..1000)
            .map(|i| {
                let d = amp_m * rnd(&mut seed).abs() / METERS_PER_MILE;
                let (lat, lng) = dest(lat0, lng0, 180.0 * (rnd(&mut seed) + 1.0), d);
                Fix {
                    lat,
                    lng,
                    t: i as f64 * 1000.0,
                    heading: None,
                    speed: None,
                }
            })
            .collect();
        let (outs, _) = replay(&e, &fixes, &p, CueState::default());
        let cues: usize = outs.iter().map(|o| o.cues.len()).sum();
        assert_eq!(cues, 0, "jitter ±{amp_m} m produced a cue");
        let travel = outs.iter().filter(|o| o.status == Status::Ok).count();
        if amp_m <= 30.0 {
            assert_eq!(travel, 0, "jitter ±{amp_m} m looked like travel");
        } else {
            // Urban-canyon scale wander: a rare flicker of "moving" is tolerated, a cue is not.
            assert!(
                travel <= 10,
                "jitter ±{amp_m} m looked like travel {travel}/1000 times"
            );
        }
    }
    // Device-reported speed 0 with a wandering heading: still stationary.
    let mut seed = 42u64;
    let fixes: Vec<Fix> = (0..60)
        .map(|i| Fix {
            lat: lat0 + rnd(&mut seed) * 1e-4,
            lng: lng0 + rnd(&mut seed) * 1e-4,
            t: i as f64 * 1000.0,
            heading: Some(180.0 + 180.0 * rnd(&mut seed)),
            speed: Some(0.0),
        })
        .collect();
    let (outs, _) = replay(&e, &fixes, &p, CueState::default());
    assert!(outs
        .iter()
        .all(|o| o.status == Status::Stationary && o.cues.is_empty()));
}

#[test]
fn missing_heading_is_estimated_from_fixes() {
    let (lat0, lng0) = (31.0, -97.5);
    let to = dest(lat0, lng0, 37.0, 2.0);
    let fixes = drive(&[(lat0, lng0), to], 27.0, 0.0);
    let m = estimate_motion(&fixes[..10]);
    assert!(
        (m.heading.unwrap() - 37.0).abs() < 0.5,
        "heading {:?}",
        m.heading
    );
    assert!(
        (m.speed_mps.unwrap() - 27.0).abs() < 0.5,
        "speed {:?}",
        m.speed_mps
    );

    // Device gives speed but no heading (common when the OS withholds it): heading estimated.
    let mut f2 = fixes[..10].to_vec();
    for f in &mut f2 {
        f.speed = Some(27.0);
    }
    let m2 = estimate_motion(&f2);
    assert!((m2.heading.unwrap() - 37.0).abs() < 0.5);

    // A single fix with no heading: nothing to go on.
    let e = Engine::new(vec![mk(1, "1", to.0, to.1)]);
    let (o, _) = ahead(
        &e,
        &CueState::default(),
        &fixes[..1],
        &AheadParams::default(),
    );
    assert_eq!(o.status, Status::NoHeading);
    assert!(o.items.is_empty() && o.cues.is_empty());

    // Two fixes 2 m apart over 1 s (creeping): stationary, not a guessed heading.
    let near = Fix {
        lat: lat0 + 2.0 / 111_000.0,
        lng: lng0,
        t: 1000.0,
        heading: None,
        speed: None,
    };
    let (o, _) = ahead(
        &e,
        &CueState::default(),
        &[fixes[0], near],
        &AheadParams::default(),
    );
    assert_eq!(o.status, Status::Stationary);

    // Device heading NaN-equivalent (absent) and a full trace: works end to end.
    let (outs, _) = replay(
        &e,
        &fixes,
        &AheadParams {
            horizon_mi: 5.0,
            ..AheadParams::default()
        },
        CueState::default(),
    );
    assert_eq!(outs.iter().map(|o| o.cues.len()).sum::<usize>(), 1);
}

#[test]
fn texas_boundary_fix() {
    // Red River near Gainesville. A marker in Cooke County 3 mi south of the river crossing;
    // the car is just over the line in Oklahoma.
    let river = (33.83, -97.15);
    let in_ok = dest(river.0, river.1, 0.0, 0.3);
    let (m_lat, m_lng) = dest(river.0, river.1, 180.0, 3.0);
    let e = Engine::new(vec![mk(1, "1", m_lat, m_lng)]);
    let p = AheadParams {
        horizon_mi: 5.0,
        ..AheadParams::default()
    };

    let north = drive(&[dest(river.0, river.1, 180.0, 0.2), in_ok], 30.0, 0.0);
    let (o, _) = ahead(&e, &CueState::default(), &north[north.len() - 10..], &p);
    assert_eq!(o.status, Status::Ok);
    assert!(
        o.items.is_empty(),
        "leaving Texas northbound: nothing ahead"
    );

    let south = drive(&[dest(in_ok.0, in_ok.1, 0.0, 0.2), in_ok], 30.0, 0.0);
    let (o, _) = ahead(&e, &CueState::default(), &south[south.len() - 10..], &p);
    assert_eq!(
        o.items.len(),
        1,
        "entering Texas southbound: the Cooke County marker is ahead"
    );
    assert!((o.items[0].along_mi - 3.3).abs() < 0.05);

    // Grid cells across lat/lng sign changes and cell edges don't drop markers.
    let edge = Engine::new(vec![
        mk(1, "1", 33.0 + 1e-12, -97.005),
        mk(2, "2", 32.999_999, -97.005),
    ]);
    let f = Fix {
        lat: 32.99,
        lng: -97.005,
        t: 0.0,
        heading: Some(0.0),
        speed: Some(20.0),
    };
    let (o, _) = ahead(&edge, &CueState::default(), &[f], &p);
    assert_eq!(o.items.len(), 2);
}

#[test]
fn zero_zero_markers_are_excluded() {
    // Bad coordinates in the data are exactly 0,0. A car (absurdly) driving north through 0,0.
    let e = Engine::new(vec![mk(1, "bad", 0.0, 0.0), mk(2, "ok", 0.01, 0.0)]);
    let f = Fix {
        lat: -0.001,
        lng: 0.0,
        t: 0.0,
        heading: Some(0.0),
        speed: Some(20.0),
    };
    let (o, _) = ahead(&e, &CueState::default(), &[f], &AheadParams::default());
    let ids: Vec<i64> = o
        .items
        .iter()
        .map(|i| e.markers[i.idx as usize].id)
        .collect();
    assert_eq!(ids, vec![2]);

    // The real fixture's 0,0 records never surface on the I-35 drive.
    let fe = Engine::new(fixture_markers());
    let zero: Vec<i64> = fe
        .markers
        .iter()
        .filter(|m| !m.has_coords())
        .map(|m| m.id)
        .collect();
    assert!(!zero.is_empty(), "fixture includes 0,0 records");
    let fixes = drive(&route(), 31.0, 0.0);
    let (outs, _) = replay(&fe, &fixes, &AheadParams::default(), CueState::default());
    for o in &outs {
        for it in &o.items {
            assert!(!zero.contains(&fe.markers[it.idx as usize].id));
        }
    }
}

#[test]
fn a_single_gps_jump_neither_rearms_nor_cues() {
    // Markers every 0.5 mi on a straight road, plus one 3 mi east of the road.
    let (lat0, lng0) = (31.0, -97.5);
    let mut markers: Vec<Marker> = (1..=12)
        .map(|i| {
            let (lat, lng) = dest(lat0, lng0, 0.0, 0.5 * i as f64);
            mk(i, &format!("{i}"), lat, lng)
        })
        .collect();
    let off = dest(dest(lat0, lng0, 0.0, 4.0).0, lng0, 90.0, 3.0);
    markers.push(mk(99, "off-road", off.0, off.1));
    let e = Engine::new(markers);
    let p = AheadParams {
        corridor_ft: 1500.0,
        ..AheadParams::default()
    };
    for device in [true, false] {
        let mut fixes = drive(&[(lat0, lng0), dest(lat0, lng0, 0.0, 7.0)], 25.0, 0.0);
        if device {
            for f in &mut fixes {
                f.heading = Some(0.0);
                f.speed = Some(25.0);
            }
        }
        // One fix jumps 2.2 mi east (re-arm bait), another 3 mi east just south of the off-road
        // marker (cue bait), both at real timestamps.
        for (k, d) in [(200usize, 2.2), (300, 3.0)] {
            let (lat, lng) = dest(fixes[k].lat, fixes[k].lng, 90.0, d);
            fixes[k].lat = lat;
            fixes[k].lng = lng;
        }
        let (outs, _) = replay(&e, &fixes, &p, CueState::default());
        let cued = cued_numbers(&e, &outs);
        let mut seen = std::collections::HashSet::new();
        for n in &cued {
            assert!(
                seen.insert(n.clone()),
                "device={device}: {n} announced twice after a GPS jump"
            );
        }
        assert!(
            !cued.contains(&"off-road".to_string()),
            "device={device}: cued from a GPS jump"
        );
        assert_eq!(outs[200].status, Status::GpsJump);
        assert!(
            cued.len() >= 10,
            "device={device}: still cues the road markers ({})",
            cued.len()
        );
    }
}

#[test]
fn plausible_or_brief_jumps_do_not_rearm_a_cued_marker() {
    // Review 2026-10-13, blocker 1. The marker is 1 mi up the road, so it cues at the start and
    // is still ahead when the car returns from each jump. Device heading and speed on every fix,
    // so two fixes after a track restart are enough to list and cue.
    let (lat0, lng0) = (31.0, -97.5);
    let e = Engine::new(vec![mk(1, "1", dest(lat0, lng0, 0.0, 1.0).0, lng0)]);
    let with_device = |mut v: Vec<Fix>| {
        for f in &mut v {
            f.heading = Some(0.0);
            f.speed = Some(25.0);
        }
        v
    };
    let at = |(lat, lng): (f64, f64), t: f64| Fix {
        lat,
        lng,
        t,
        heading: Some(0.0),
        speed: Some(25.0),
    };
    // (offset east in mi, ms after the last road fix) for each bad fix.
    let cases: [(&str, Vec<(f64, f64)>); 2] = [
        // One fix 2.2 mi east, 45 s later: 78.6 m/s, under MAX_PLAUSIBLE_MPS.
        ("plausible single jump", vec![(2.2, 45_000.0)]),
        // Two agreeing fixes 3 mi east: the track restarts on them.
        ("two agreeing fixes", vec![(3.0, 1_000.0), (3.0, 2_000.0)]),
    ];
    for (name, jumps) in cases {
        let mut fixes = with_device(drive(&[(lat0, lng0), dest(lat0, lng0, 0.0, 0.4)], 25.0, 0.0));
        let last = *fixes.last().unwrap();
        let mut t = last.t;
        for (east, dt) in &jumps {
            t = last.t + dt;
            fixes.push(at(dest(last.lat, last.lng, 90.0, *east), t));
        }
        // Back on the road, still short of the marker.
        for k in 1..=2 {
            let p = dest(last.lat, last.lng, 0.0, 0.02 * k as f64);
            fixes.push(at(p, t + 1000.0 * k as f64));
        }
        let (outs, _) = replay(&e, &fixes, &AheadParams::default(), CueState::default());
        assert_eq!(cued_numbers(&e, &outs), vec!["1".to_string()], "{name}");
    }
}

#[test]
fn rearm_needs_the_car_clear_for_the_whole_window() {
    // The re-arm rule still works for a real drive away and back (see
    // returning_after_two_miles_reannounces_by_design), but not before REARM_CLEAR_MS of fixes
    // all more than REARM_MI away.
    let (lat0, lng0) = (31.0, -97.5);
    let e = Engine::new(vec![mk(1, "1", dest(lat0, lng0, 0.0, 0.5).0, lng0)]);
    // 25 m/s: more than 2.0 mi past the marker from 2.5 mi on. Stopping at 2.7 mi is ~13 s clear
    // (under the 20 s window); 3.4 mi is ~58 s clear.
    let mut fixes = drive(&[(lat0, lng0), dest(lat0, lng0, 0.0, 2.7)], 25.0, 0.0);
    let (_, st) = replay(&e, &fixes, &AheadParams::default(), CueState::default());
    assert!(
        st.announced.contains(&0),
        "not yet clear for {} s",
        20.0
    );
    fixes = drive(&[(lat0, lng0), dest(lat0, lng0, 0.0, 3.4)], 25.0, 0.0);
    let (_, st) = replay(&e, &fixes, &AheadParams::default(), CueState::default());
    assert!(st.announced.is_empty(), "re-armed after a sustained 2 mi+");
}

#[test]
fn a_persistent_jump_restarts_the_track() {
    // A real reacquisition: the car reappears 5 km away and stays there.
    let (lat0, lng0) = (31.0, -97.5);
    let e = Engine::new(vec![mk(1, "1", dest(lat0, lng0, 0.0, 4.5).0, lng0)]);
    let mut fixes = drive(&[(lat0, lng0), dest(lat0, lng0, 0.0, 0.5)], 25.0, 0.0);
    let t0 = fixes.last().unwrap().t + 1000.0;
    let start = dest(lat0, lng0, 0.0, 3.2);
    fixes.extend(drive(&[start, dest(start.0, start.1, 0.0, 1.0)], 25.0, t0));
    let (outs, _) = replay(&e, &fixes, &AheadParams::default(), CueState::default());
    assert_eq!(
        cued_numbers(&e, &outs),
        vec!["1".to_string()],
        "tracks and cues after the jump"
    );
}

#[test]
fn device_heading_without_speed_is_not_moving() {
    let (lat0, lng0) = (31.0, -97.5);
    let (m_lat, m_lng) = dest(lat0, lng0, 0.0, 0.5);
    let e = Engine::new(vec![mk(1, "1", m_lat, m_lng)]);
    let f = Fix {
        lat: lat0,
        lng: lng0,
        t: 0.0,
        heading: Some(0.0),
        speed: None,
    };
    let (o, _) = ahead(&e, &CueState::default(), &[f], &AheadParams::default());
    assert_eq!(o.status, Status::NoSpeed);
    assert!(o.cues.is_empty());
}

#[test]
fn returning_after_two_miles_reannounces_by_design() {
    // Documented rule: a marker re-arms once the car is > REARM_MI (2 mi) from it, so coming
    // back along the same road later announces it again.
    let (lat0, lng0) = (31.0, -97.5);
    let (m_lat, m_lng) = dest(lat0, lng0, 0.0, 1.5);
    let e = Engine::new(vec![mk(1, "1", m_lat, m_lng)]);
    let far = dest(lat0, lng0, 0.0, 5.0);
    let mut fixes = drive(&[(lat0, lng0), far], 25.0, 0.0);
    let t0 = fixes.last().unwrap().t + 1000.0;
    fixes.extend(drive(&[far, dest(lat0, lng0, 0.0, 0.0)], 25.0, t0));
    let (outs, _) = replay(&e, &fixes, &AheadParams::default(), CueState::default());
    assert_eq!(cued_numbers(&e, &outs).len(), 2);
}

/// Stationary GPS error is correlated: the position wanders smoothly (Ornstein-Uhlenbeck-like)
/// rather than jumping independently each second.
fn drift(lat0: f64, lng0: f64, sigma_m: f64, tau_s: f64, n: usize, mut seed: u64) -> Vec<Fix> {
    let (mut x, mut y) = (0.0f64, 0.0f64);
    let a = (-1.0 / tau_s).exp();
    let k = sigma_m * (1.0 - a * a).sqrt();
    (0..n)
        .map(|i| {
            x = a * x + k * rnd(&mut seed) * 1.7;
            y = a * y + k * rnd(&mut seed) * 1.7;
            let (lat, lng) = dest(lat0, lng0, 90.0, x / METERS_PER_MILE);
            let (lat, lng) = dest(lat, lng, 0.0, y / METERS_PER_MILE);
            Fix {
                lat,
                lng,
                t: i as f64 * 1000.0,
                heading: None,
                speed: None,
            }
        })
        .collect()
}

#[test]
fn correlated_drift_while_stopped_never_cues() {
    let (lat0, lng0) = (31.0, -97.5);
    // Rings of markers 0.3, 0.6, 0.9 mi out in 12 directions.
    let mut ms = vec![];
    let mut id = 0;
    for r in [0.3, 0.6, 0.9] {
        for k in 0..12 {
            id += 1;
            let (lat, lng) = dest(lat0, lng0, 30.0 * k as f64, r);
            ms.push(mk(id, &format!("{id}"), lat, lng));
        }
    }
    let e = Engine::new(ms);
    let p = AheadParams::default();
    for (sigma, tau) in [(10.0, 20.0), (20.0, 30.0), (30.0, 40.0), (30.0, 60.0)] {
        for s in 1..=4u64 {
            let fixes = drift(lat0, lng0, sigma, tau, 2500, s * 0x2545F4914F6CDD1D);
            let (outs, _) = replay(&e, &fixes, &p, CueState::default());
            let cues: usize = outs.iter().map(|o| o.cues.len()).sum();
            assert_eq!(
                cues, 0,
                "drift σ={sigma} m τ={tau} s seed {s}: {cues} false cues"
            );
        }
    }
}

#[test]
fn frozen_coordinates_with_a_moving_device_speed_do_not_cue() {
    // Review 2026-10-13, should-fix 3: the same position repeated (e.g. a cached fix, maximumAge
    // 30 s) while the device still reports speed 3 m/s and heading 0.
    let (lat0, lng0) = (31.0, -97.5);
    let e = Engine::new(vec![mk(1, "1", dest(lat0, lng0, 0.0, 0.5).0, lng0)]);
    let fixes: Vec<Fix> = (0..5)
        .map(|i| Fix {
            lat: lat0,
            lng: lng0,
            t: i as f64 * 1000.0,
            heading: Some(0.0),
            speed: Some(3.0),
        })
        .collect();
    let (outs, _) = replay(&e, &fixes, &AheadParams::default(), CueState::default());
    assert!(cued_numbers(&e, &outs).is_empty(), "cued from frozen coordinates");
    assert_eq!(outs.last().unwrap().status, Status::Stationary);
}

#[test]
fn a_real_drive_cues_even_when_the_device_reports_speed_zero() {
    // Review 2026-10-13, should-fix 4: 25 m/s for ~2 mi, device speed 0 on every fix.
    let (lat0, lng0) = (31.0, -97.5);
    let e = Engine::new(vec![mk(1, "1", dest(lat0, lng0, 0.0, 1.5).0, lng0)]);
    let mut fixes = drive(&[(lat0, lng0), dest(lat0, lng0, 0.0, 2.0)], 25.0, 0.0);
    for f in &mut fixes {
        f.speed = Some(0.0);
    }
    let (outs, _) = replay(&e, &fixes, &AheadParams::default(), CueState::default());
    assert_eq!(cued_numbers(&e, &outs), vec!["1".to_string()]);
}

#[test]
fn device_speed_still_drives_the_first_fixes_and_curves() {
    // The cross-check only overrules the device on clear contradictions: a single fix with device
    // heading and speed still lists (cues wait for 3 s of track), and a steady drive round a curve
    // is not "stopped".
    let (lat0, lng0) = (31.0, -97.5);
    let e = Engine::new(vec![mk(1, "1", dest(lat0, lng0, 0.0, 0.5).0, lng0)]);
    let f = Fix {
        lat: lat0,
        lng: lng0,
        t: 0.0,
        heading: Some(0.0),
        speed: Some(25.0),
    };
    let (o, _) = ahead(&e, &CueState::default(), &[f], &AheadParams::default());
    assert_eq!(o.status, Status::Ok);
    assert_eq!(o.items.len(), 1, "a lone fix with device heading and speed lists");
    assert!(o.cues.is_empty(), "but a cue waits for the track to confirm travel");

    // A 90° bend over ~0.3 mi at 15 m/s with device speed: every fix after the first is Ok.
    // Arc of radius 0.2 mi round a centre 0.2 mi east of the start: heading north, ending east.
    let centre = dest(lat0, lng0, 90.0, 0.2);
    let pts: Vec<(f64, f64)> = (0..=12)
        .map(|k| dest(centre.0, centre.1, 270.0 + 7.5 * k as f64, 0.2))
        .collect();
    let mut fixes = drive(&pts, 15.0, 0.0);
    for w in 0..fixes.len() {
        let next = fixes.get(w + 1).copied().unwrap_or(fixes[w]);
        let prev = if w > 0 { fixes[w - 1] } else { fixes[w] };
        fixes[w].heading = Some(bearing(prev.lat, prev.lng, next.lat, next.lng));
        fixes[w].speed = Some(15.0);
    }
    let (outs, _) = replay(&e, &fixes, &AheadParams::default(), CueState::default());
    assert!(
        outs[1..].iter().all(|o| o.status == Status::Ok),
        "statuses: {:?}",
        outs.iter().map(|o| o.status).collect::<Vec<_>>()
    );
}

#[test]
fn a_slow_steady_drift_with_no_device_speed_or_heading_does_not_cue() {
    // Review #12: a stationary phone whose fix creeps 4 m/s in one direction (a slow, steady GPS
    // drift) with nothing from the device to confirm it is moving. The track alone is not enough
    // to speak a cue at this speed. The list may still show; a real drive at 6 m/s (≈ 13 mph,
    // city traffic) still cues.
    let (lat0, lng0) = (31.0, -97.5);
    let e = Engine::new(vec![mk(1, "1", dest(lat0, lng0, 0.0, 0.3).0, lng0)]);
    let end = dest(lat0, lng0, 0.0, 0.5);

    let drifting = drive(&[(lat0, lng0), end], 4.0, 0.0);
    assert!(drifting.iter().all(|f| f.speed.is_none() && f.heading.is_none()));
    let (outs, _) = replay(&e, &drifting, &AheadParams::default(), CueState::default());
    assert!(
        cued_numbers(&e, &outs).is_empty(),
        "a 4 m/s drift cued {:?}",
        cued_numbers(&e, &outs)
    );

    let driving = drive(&[(lat0, lng0), end], 6.0, 0.0);
    let (outs, _) = replay(&e, &driving, &AheadParams::default(), CueState::default());
    assert_eq!(cued_numbers(&e, &outs), vec!["1".to_string()]);
}
