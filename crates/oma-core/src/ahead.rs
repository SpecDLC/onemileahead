//! `ahead`: which markers are coming up on the road, and the "one mile ahead" cue.
//!
//! v1 projects a straight line from the newest fix along the current heading (see the design
//! spec for where that breaks and what a route polyline adds).

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use crate::geo::{
    bearing, haversine, DEG_TO_RAD, EARTH_RADIUS_MILES, FEET_PER_MILE, METERS_PER_MILE,
};
use crate::index::{cell_of, Engine};

/// Below this the vehicle is "stopped": no ahead list, no cues (≈ 5 mph).
pub const MOVING_MPS: f64 = 2.2;
/// A fix this far back is a usable baseline for heading/speed.
pub const BASELINE_MIN_M: f64 = 100.0;
pub const BASELINE_MAX_MS: f64 = 45_000.0;
/// Baselines ending at the newest fix and the ones just before it that must agree.
pub const AGREEING_BASELINES: usize = 3;
/// Baseline headings must agree this closely.
pub const HEADING_AGREE_DEG: f64 = 20.0;
/// The baseline fix must be at least this many fixes back.
pub const MIN_INTERVALS: usize = 3;
/// Net displacement must be at least this fraction of the path walked to count as travel.
pub const STRAIGHTNESS: f64 = 0.7;
/// A device "moving" speed is overruled when the track covered less than this over the last few
/// seconds (STILL_MIN_SPAN_MS to STILL_WINDOW_MS back).
pub const STILL_MPS: f64 = MOVING_MPS / 2.0;
pub const STILL_MIN_SPAN_MS: f64 = 3_000.0;
pub const STILL_WINDOW_MS: f64 = 10_000.0;
/// With neither a device speed nor a device heading on the newest fix, nothing but the track says
/// we are moving, so a cue also needs the estimated speed to be at least this (twice MOVING_MPS,
/// ≈ 10 mph). A slow steady GPS drift of a stopped phone can pass the three-baseline test; the
/// list still shows below this speed, only the once-only spoken cue waits.
pub const UNCONFIRMED_CUE_MPS: f64 = 2.0 * MOVING_MPS;
/// Faster than this between two fixes is a GPS jump (wifi/cell fallback), not travel (≈ 200 mph).
pub const MAX_PLAUSIBLE_MPS: f64 = 90.0;
/// An announced marker re-arms once the vehicle is this far from it...
pub const REARM_MI: f64 = 2.0;
/// ...and every kept fix over at least this long has been that far away. One plausible-looking
/// bad fix (or a short burst of agreeing ones) can't re-arm a marker on its own.
pub const REARM_CLEAR_MS: f64 = 20_000.0;
/// Above this many grid cells, scan the spatial markers directly.
const MAX_CELLS: usize = 6000;

#[derive(Debug, Clone, Copy, PartialEq, Deserialize, Serialize)]
pub struct Fix {
    pub lat: f64,
    pub lng: f64,
    /// Milliseconds (the Geolocation API timestamp).
    pub t: f64,
    /// Degrees clockwise from north, if the device reports one.
    #[serde(default)]
    pub heading: Option<f64>,
    /// Metres per second, if the device reports one.
    #[serde(default)]
    pub speed: Option<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Deserialize)]
pub struct AheadParams {
    #[serde(default = "default_horizon")]
    pub horizon_mi: f64,
    #[serde(default = "default_corridor")]
    pub corridor_ft: f64,
    #[serde(default = "default_cue")]
    pub cue_mi: f64,
}
fn default_horizon() -> f64 {
    10.0
}
fn default_corridor() -> f64 {
    2000.0
}
fn default_cue() -> f64 {
    1.0
}
impl Default for AheadParams {
    fn default() -> Self {
        AheadParams {
            horizon_mi: default_horizon(),
            corridor_ft: default_corridor(),
            cue_mi: default_cue(),
        }
    }
}

/// Cue memory carried between calls: marker indexes already announced and not yet re-armed.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct CueState {
    pub announced: BTreeSet<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Ok,
    NoFixes,
    Stationary,
    NoHeading,
    /// A device heading but no speed (reported or estimable): can't tell we're moving.
    NoSpeed,
    /// The newest fix jumped implausibly far from the previous one; ignored until confirmed.
    GpsJump,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    Left,
    Right,
}

#[derive(Debug, Clone, PartialEq)]
pub struct AheadItem {
    pub idx: u32,
    pub along_mi: f64,
    pub cross_ft: f64,
    pub side: Side,
    pub eta_s: Option<f64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct AheadOut {
    pub status: Status,
    pub heading: Option<f64>,
    pub speed_mps: Option<f64>,
    pub items: Vec<AheadItem>,
    /// Markers whose cue fired on this call (subset of `items`).
    pub cues: Vec<AheadItem>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Motion {
    pub heading: Option<f64>,
    pub speed_mps: Option<f64>,
}

fn valid(x: Option<f64>) -> Option<f64> {
    x.filter(|v| v.is_finite())
}

/// Every step between consecutive fixes moves forward along the net displacement. Real travel
/// does; GPS jitter around a stopped car almost never does for three steps running.
fn steady(span: &[Fix]) -> bool {
    let (a, z) = (span[0], span[span.len() - 1]);
    let c = (z.lat * DEG_TO_RAD).cos();
    let (nx, ny) = ((z.lng - a.lng) * c, z.lat - a.lat);
    span.windows(2)
        .all(|w| (w[1].lng - w[0].lng) * c * nx + (w[1].lat - w[0].lat) * ny > 0.0)
}

/// Heading and speed for the newest fix: device values when present, otherwise estimated from
/// the fixes. An estimate needs three agreeing baselines (ending at the newest fix and the two
/// before it), each ≥ 100 m, ≥ 3 fixes and ≤ 45 s back, straight and steady — GPS jitter around a
/// stopped car can fake one such baseline now and then, but almost never three that agree.
pub fn estimate_motion(fixes: &[Fix]) -> Motion {
    let Some(last) = fixes.last() else {
        return Motion {
            heading: None,
            speed_mps: None,
        };
    };
    let (h1, s1) = baseline(fixes);
    let (mut est_heading, mut est_speed) = (h1, s1);
    if let (Some(a), Some(v1)) = (h1, s1) {
        let agree = (1..AGREEING_BASELINES).all(|back| {
            if fixes.len() <= back {
                return false;
            }
            match baseline(&fixes[..fixes.len() - back]) {
                (Some(b), Some(v)) => {
                    let dh = ((a - b + 540.0) % 360.0 - 180.0).abs();
                    dh <= HEADING_AGREE_DEG && v > 0.5 * v1 && v < 2.0 * v1
                }
                _ => false,
            }
        });
        if !agree {
            est_heading = None;
            est_speed = Some(0.0);
        }
    }
    // Device speed is used when the track doesn't contradict it. The track wins when it clearly
    // disagrees: frozen or repeated coordinates under a "moving" device speed (a stale cached fix),
    // or a confident moving estimate under a "stopped" device speed (a device that reports 0).
    let speed = match valid(last.speed) {
        Some(d) if d >= MOVING_MPS => match recent_chord_speed(fixes) {
            Some(v) if v < STILL_MPS => Some(v),
            _ => Some(d),
        },
        Some(d) => match (est_heading, est_speed) {
            (Some(_), Some(v)) if v >= MOVING_MPS => Some(v),
            _ => Some(d),
        },
        None => est_speed,
    };
    let heading = valid(last.heading)
        .map(|h| h.rem_euclid(360.0))
        .or(est_heading);
    Motion {
        heading,
        speed_mps: speed,
    }
}

/// Fastest straight-line speed from any fix at least STILL_MIN_SPAN_MS (and at most
/// STILL_WINDOW_MS) before the newest fix, to the newest fix. None without such a fix. A chord
/// under-reads speed on a curve, but not by anything like the STILL_MPS margin over a few seconds.
fn recent_chord_speed(fixes: &[Fix]) -> Option<f64> {
    let last = fixes.last()?;
    fixes
        .iter()
        .filter(|f| {
            let dt = last.t - f.t;
            dt >= STILL_MIN_SPAN_MS && dt <= STILL_WINDOW_MS
        })
        .map(|f| haversine(f.lat, f.lng, last.lat, last.lng) * METERS_PER_MILE / ((last.t - f.t) / 1000.0))
        .reduce(f64::max)
}

/// One baseline estimate ending at the last fix of `fixes`: (heading, speed).
fn baseline(fixes: &[Fix]) -> (Option<f64>, Option<f64>) {
    let n = fixes.len();
    if n < 2 {
        return (None, None);
    }
    let last = fixes[n - 1];
    let mut est_speed = None;
    // Path length walked back from the newest fix, to reject jitter that wanders 100 m+.
    let mut path_m = 0.0;
    for i in (0..n - 1).rev() {
        let f = &fixes[i];
        let g = &fixes[i + 1];
        path_m += haversine(f.lat, f.lng, g.lat, g.lng) * METERS_PER_MILE;
        let dt = last.t - f.t;
        if dt > BASELINE_MAX_MS {
            break;
        }
        if !(dt > 0.0) {
            continue;
        }
        let d_m = haversine(f.lat, f.lng, last.lat, last.lng) * METERS_PER_MILE;
        // A baseline needs a few intervals so the straightness test can tell travel from a
        // single jitter hop.
        if d_m >= BASELINE_MIN_M && n - 1 - i >= MIN_INTERVALS {
            if d_m >= STRAIGHTNESS * path_m && steady(&fixes[i..]) {
                return (
                    Some(bearing(f.lat, f.lng, last.lat, last.lng)),
                    Some(d_m / (dt / 1000.0)),
                );
            }
            // Zig-zagging between fixes: GPS jitter, not travel.
            return (None, Some(0.0));
        }
        if d_m < BASELINE_MIN_M {
            // Not far enough yet: so far the evidence says we're slow.
            est_speed = Some(d_m / (dt / 1000.0));
        }
    }
    (None, est_speed)
}

/// Indexes of spatial markers within `r_mi` of (lat, lng), by grid cells (superset; caller filters).
fn candidates(e: &Engine, lat: f64, lng: f64, r_mi: f64) -> Vec<u32> {
    let dlat = r_mi / (EARTH_RADIUS_MILES * DEG_TO_RAD);
    let coslat = ((lat.abs() + dlat).min(89.0) * DEG_TO_RAD).cos();
    let dlng = (dlat / coslat).min(180.0);
    let (i0, j0) = cell_of(lat - dlat, lng - dlng);
    let (i1, j1) = cell_of(lat + dlat, lng + dlng);
    let cells = ((i1 - i0 + 1) as usize).saturating_mul((j1 - j0 + 1) as usize);
    let mut out = e.odd.clone();
    if cells > MAX_CELLS || cells > e.grid.len() {
        out.clear();
        for (i, m) in e.markers.iter().enumerate() {
            if e.in_grid(m) {
                out.push(i as u32);
            }
        }
        return out;
    }
    for ci in i0..=i1 {
        for cj in j0..=j1 {
            if let Some(ids) = e.grid.get(&(ci, cj)) {
                out.extend_from_slice(ids);
            }
        }
    }
    out
}

fn implausible(a: &Fix, b: &Fix) -> bool {
    let d_m = haversine(a.lat, a.lng, b.lat, b.lng) * METERS_PER_MILE;
    let dt_s = (b.t - a.t) / 1000.0;
    if dt_s <= 0.0 {
        return d_m > 100.0;
    }
    d_m / dt_s > MAX_PLAUSIBLE_MPS
}

/// Drop GPS jumps. A fix that is implausibly far from the last kept fix is dropped — unless the
/// fix after it agrees with it (the jump persisted, e.g. a real reacquisition after a tunnel), in
/// which case the older fixes are stale and the track restarts there. Returns the kept fixes and
/// whether the newest fix itself was dropped (it can't be confirmed yet).
pub fn plausible_fixes(fixes: &[Fix]) -> (Vec<Fix>, bool) {
    let mut kept: Vec<Fix> = Vec::with_capacity(fixes.len());
    let mut newest_dropped = false;
    for (i, f) in fixes.iter().enumerate() {
        let Some(prev) = kept.last() else {
            kept.push(*f);
            continue;
        };
        if !implausible(prev, f) {
            kept.push(*f);
            newest_dropped = false;
            continue;
        }
        match fixes.get(i + 1) {
            Some(g) if !implausible(f, g) && implausible(prev, g) => {
                // The jump persisted: start the track again from here.
                kept.clear();
                kept.push(*f);
                newest_dropped = false;
            }
            Some(_) => {} // a one-off outlier
            None => newest_dropped = true,
        }
    }
    (kept, newest_dropped)
}

/// Pure: (engine, cue state, fixes, params) → (output, new cue state).
pub fn ahead(e: &Engine, state: &CueState, fixes: &[Fix], p: &AheadParams) -> (AheadOut, CueState) {
    let mut next = state.clone();
    let (clean, newest_dropped) = plausible_fixes(fixes);
    if newest_dropped {
        // Don't re-arm, cue or list anything from a fix we don't trust yet.
        let out = AheadOut {
            status: Status::GpsJump,
            heading: None,
            speed_mps: None,
            items: vec![],
            cues: vec![],
        };
        return (out, next);
    }
    let fixes = &clean[..];
    let Some(last) = fixes.last().copied() else {
        return (
            AheadOut {
                status: Status::NoFixes,
                heading: None,
                speed_mps: None,
                items: vec![],
                cues: vec![],
            },
            next,
        );
    };
    // Re-arm announced markers we have been well clear of for REARM_CLEAR_MS. The kept fixes
    // must reach back that far (the newest one at or before the cutoff counts too), so a single
    // fix after a long gap, or a track that only just restarted, can't re-arm anything.
    let cutoff = last.t - REARM_CLEAR_MS;
    let recent = match fixes.iter().rposition(|f| f.t <= cutoff) {
        Some(start) => &fixes[start..],
        None => &fixes[..0],
    };
    next.announced.retain(|&i| {
        let m = &e.markers[i as usize];
        recent.is_empty()
            || recent
                .iter()
                .any(|f| haversine(f.lat, f.lng, m.lat, m.lng) <= REARM_MI)
    });

    let motion = estimate_motion(fixes);
    let empty = |status| AheadOut {
        status,
        heading: motion.heading,
        speed_mps: motion.speed_mps,
        items: vec![],
        cues: vec![],
    };
    if let Some(s) = motion.speed_mps {
        if s < MOVING_MPS {
            return (empty(Status::Stationary), next);
        }
    }
    let Some(h) = motion.heading else {
        return (empty(Status::NoHeading), next);
    };
    if motion.speed_mps.is_none() {
        // e.g. the first fix after page load with a device heading: not proof we're moving.
        return (empty(Status::NoSpeed), next);
    }

    let corridor_mi = p.corridor_ft / FEET_PER_MILE;
    let reach = (p.horizon_mi * p.horizon_mi + corridor_mi * corridor_mi).sqrt();
    let (sh, ch) = ((h * DEG_TO_RAD).sin(), (h * DEG_TO_RAD).cos());
    let k = EARTH_RADIUS_MILES * DEG_TO_RAD;
    let coslat = (last.lat * DEG_TO_RAD).cos();

    let mut items: Vec<AheadItem> = Vec::new();
    for idx in candidates(e, last.lat, last.lng, reach) {
        let m = &e.markers[idx as usize];
        // Local tangent plane at the fix, miles: x east, y north.
        let x = (m.lng - last.lng) * k * coslat;
        let y = (m.lat - last.lat) * k;
        let along = x * sh + y * ch;
        let cross = x * ch - y * sh; // + = right of travel
        if along > 0.0 && along <= p.horizon_mi && cross.abs() <= corridor_mi {
            items.push(AheadItem {
                idx,
                along_mi: along,
                cross_ft: cross.abs() * FEET_PER_MILE,
                side: if cross >= 0.0 {
                    Side::Right
                } else {
                    Side::Left
                },
                eta_s: motion
                    .speed_mps
                    .filter(|&s| s > 0.0)
                    .map(|s| along * METERS_PER_MILE / s),
            });
        }
    }
    items.sort_by(|a, b| {
        a.along_mi
            .partial_cmp(&b.along_mi)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(
                e.markers[a.idx as usize]
                    .id
                    .cmp(&e.markers[b.idx as usize].id),
            )
    });

    // Announce only once the track itself shows travel over the last few seconds. The list can
    // show from a lone fix with a device heading and speed, but a cue is spoken once and never
    // repeated, so it waits for corroboration (a stale cached fix can't trigger it).
    let corroborated = recent_chord_speed(fixes).is_some_and(|v| v >= STILL_MPS);
    let device_confirms = valid(last.speed).is_some() || valid(last.heading).is_some();
    let corroborated = corroborated
        && (device_confirms || motion.speed_mps.is_some_and(|v| v >= UNCONFIRMED_CUE_MPS));
    let mut cues = Vec::new();
    for it in items.iter().filter(|_| corroborated) {
        if it.along_mi <= p.cue_mi && !next.announced.contains(&it.idx) {
            next.announced.insert(it.idx);
            cues.push(it.clone());
        }
    }
    (
        AheadOut {
            status: Status::Ok,
            heading: Some(h),
            speed_mps: motion.speed_mps,
            items,
            cues,
        },
        next,
    )
}
