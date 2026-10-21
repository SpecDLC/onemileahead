//! `nearby`: the grid replacement for `useNearbyMarkers`' full scan, with identical output.

use crate::geo::{bearing, haversine, DEG_TO_RAD, EARTH_RADIUS_MILES};
use crate::index::{cell_of, Engine, CELL_DEG};

/// Rings beyond this fall back to a full scan (still exact; ~60 mi of grid).
const MAX_RING: i32 = 64;
const EPS_MI: f64 = 1e-9;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Hit {
    pub idx: u32,
    pub distance: f64,
    pub bearing: f64,
}

/// Lower bound (miles) on the distance from a query at latitude `lat` to any marker in a grid cell
/// at Chebyshev ring index ≥ k+1: either ≥ k cells of latitude away (meridional distance) or ≥ k
/// cells of longitude away (exact distance to that meridian great circle).
pub fn ring_bound(lat: f64, k: i32) -> f64 {
    let dlat = EARTH_RADIUS_MILES * (k as f64 * CELL_DEG * DEG_TO_RAD);
    let dl = (k as f64 * CELL_DEG).min(90.0) * DEG_TO_RAD;
    let s = ((lat * DEG_TO_RAD).cos().abs() * dl.sin()).min(1.0);
    let dlng = EARTH_RADIUS_MILES * s.asin();
    dlat.min(dlng)
}

fn cmp_hit(a: &Hit, b: &Hit, e: &Engine) -> std::cmp::Ordering {
    // JS: sort((a, b) => a.distance - b.distance), stable over id order.
    a.distance
        .partial_cmp(&b.distance)
        .unwrap_or(std::cmp::Ordering::Equal)
        .then(
            e.markers[a.idx as usize]
                .id
                .cmp(&e.markers[b.idx as usize].id),
        )
}

fn hit(e: &Engine, idx: u32, lat: f64, lng: f64) -> Hit {
    let m = &e.markers[idx as usize];
    Hit {
        idx,
        distance: haversine(lat, lng, m.lat, m.lng),
        bearing: bearing(lat, lng, m.lat, m.lng),
    }
}

/// Visit the cells on the boundary of the (2k+1)×(2k+1) square, each exactly once.
pub fn for_ring(k: i32, mut f: impl FnMut(i32, i32)) {
    if k == 0 {
        f(0, 0);
        return;
    }
    for d in -k..=k {
        f(-k, d);
        f(k, d);
    }
    for d in (-k + 1)..k {
        f(d, -k);
        f(d, k);
    }
}

/// Reference full scan (what the TS hook does). Used as the fallback and in tests.
pub fn nearby_scan(e: &Engine, lat: f64, lng: f64, limit: i64, radius_mi: Option<f64>) -> Vec<Hit> {
    let mut hits: Vec<Hit> = (0..e.markers.len() as u32)
        .filter(|&i| e.in_grid(&e.markers[i as usize]))
        .map(|i| hit(e, i, lat, lng))
        .collect();
    hits.sort_by(|a, b| cmp_hit(a, b, e));
    finish(hits, limit, radius_mi)
}

/// `Array.prototype.slice(0, limit)` then the optional radius filter.
fn finish(mut hits: Vec<Hit>, limit: i64, radius_mi: Option<f64>) -> Vec<Hit> {
    let n = hits.len() as i64;
    let end = if limit < 0 {
        (n + limit).max(0)
    } else {
        limit.min(n)
    };
    hits.truncate(end as usize);
    if let Some(r) = radius_mi {
        hits.retain(|h| h.distance <= r);
    }
    hits
}

/// Grid ring search. Output equals `nearby_scan` for every input: the grid doesn't wrap at the
/// antimeridian or poles, so queries near them use the scan; out-of-range markers (`Engine::odd`)
/// are always candidates.
pub fn nearby(e: &Engine, lat: f64, lng: f64, limit: i64, radius_mi: Option<f64>) -> Vec<Hit> {
    if limit < 0 || !lat.is_finite() || !lng.is_finite() || lng.abs() > 179.0 || lat.abs() > 85.0 {
        return nearby_scan(e, lat, lng, limit, radius_mi);
    }
    let limit_u = limit as usize;
    if limit_u == 0 {
        return Vec::new();
    }
    let (ci, cj) = cell_of(lat, lng);
    let mut cand: Vec<Hit> = e.odd.iter().map(|&i| hit(e, i, lat, lng)).collect();
    let mut visited = e.odd.len();
    for k in 0..=MAX_RING {
        for_ring(k, |di, dj| {
            if let Some(ids) = e.grid.get(&(ci + di, cj + dj)) {
                visited += ids.len();
                cand.extend(ids.iter().map(|&i| hit(e, i, lat, lng)));
            }
        });
        if visited >= e.spatial_count {
            cand.sort_by(|a, b| cmp_hit(a, b, e));
            return finish(cand, limit, radius_mi);
        }
        let bound = ring_bound(lat, k);
        if let Some(r) = radius_mi {
            if bound > r + EPS_MI {
                // Every unvisited marker is outside the radius.
                cand.sort_by(|a, b| cmp_hit(a, b, e));
                return finish(cand, limit, radius_mi);
            }
        }
        if cand.len() >= limit_u {
            cand.sort_by(|a, b| cmp_hit(a, b, e));
            if cand[limit_u - 1].distance < bound - EPS_MI {
                return finish(cand, limit, radius_mi);
            }
        }
    }
    nearby_scan(e, lat, lng, limit, radius_mi)
}
