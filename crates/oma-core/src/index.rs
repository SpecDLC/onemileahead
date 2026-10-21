//! The loaded engine state: markers in primary-key order plus the three indexes.

use std::collections::HashMap;

use crate::marker::Marker;
use crate::search::TextIndex;

/// Grid cell edge in degrees (≈ 1.04 mi of latitude; ≈ 0.89 mi of longitude at 31°N).
pub const CELL_DEG: f64 = 0.015;

pub type CellKey = (i32, i32);

pub fn cell_of(lat: f64, lng: f64) -> CellKey {
    (
        (lat / CELL_DEG).floor() as i32,
        (lng / CELL_DEG).floor() as i32,
    )
}

#[derive(Debug, Default)]
pub struct Engine {
    /// Sorted by `id` — the order Dexie's `toArray()` returns, which JS's stable sort preserves on ties.
    pub markers: Vec<Marker>,
    /// Grid cell → marker indexes (ascending). Only markers with usable coordinates.
    pub grid: HashMap<CellKey, Vec<u32>>,
    /// Number of markers in the grid.
    pub spatial_count: usize,
    /// Markers with coordinates outside ±90/±180 (one in the 2026 export). The grid doesn't wrap,
    /// so these are kept out of it and checked on every spatial query instead.
    pub odd: Vec<u32>,
    /// Marker indexes sorted by (markerNumber in UTF-16 code-unit order, id) — the IndexedDB
    /// order of the `markerNumber` index.
    pub by_number: Vec<u32>,
    /// Built in `new` (eager) or on first search (`new_lazy_text`).
    text: std::cell::OnceCell<TextIndex>,
}

/// UTF-16 code-unit comparison — how IndexedDB (and JS `<`) order strings.
pub fn cmp_utf16(a: &str, b: &str) -> std::cmp::Ordering {
    a.encode_utf16().cmp(b.encode_utf16())
}

impl Engine {
    pub fn new(markers: Vec<Marker>) -> Engine {
        let e = Engine::new_lazy_text(markers);
        e.text();
        e
    }

    /// Spatial and number indexes now; the text index on the first `text()` call.
    pub fn new_lazy_text(mut markers: Vec<Marker>) -> Engine {
        markers.sort_by_key(|m| m.id);
        let mut grid: HashMap<CellKey, Vec<u32>> = HashMap::new();
        let mut spatial_count = 0;
        let mut odd: Vec<u32> = Vec::new();
        for (i, m) in markers.iter().enumerate() {
            if m.has_coords() && m.lat.is_finite() && m.lng.is_finite() {
                if m.lng.abs() > 180.0 || m.lat.abs() > 90.0 {
                    odd.push(i as u32);
                } else {
                    grid.entry(cell_of(m.lat, m.lng))
                        .or_default()
                        .push(i as u32);
                }
                spatial_count += 1;
            }
        }
        let mut by_number: Vec<u32> = (0..markers.len() as u32).collect();
        by_number.sort_by(|&a, &b| {
            let (ma, mb) = (&markers[a as usize], &markers[b as usize]);
            cmp_utf16(&ma.marker_number, &mb.marker_number).then(ma.id.cmp(&mb.id))
        });
        Engine {
            markers,
            grid,
            spatial_count,
            odd,
            by_number,
            text: std::cell::OnceCell::new(),
        }
    }

    pub fn text(&self) -> &TextIndex {
        self.text.get_or_init(|| TextIndex::build(&self.markers))
    }

    pub fn text_built(&self) -> bool {
        self.text.get().is_some()
    }

    pub fn in_grid(&self, m: &Marker) -> bool {
        m.has_coords() && m.lat.is_finite() && m.lng.is_finite()
    }
}
