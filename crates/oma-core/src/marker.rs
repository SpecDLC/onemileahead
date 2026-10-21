use serde::{Deserialize, Serialize};

/// Mirror of `src/types/marker.ts`. Field names are camelCase on the wire.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Marker {
    pub id: i64,
    pub marker_number: String,
    pub title: String,
    pub county: String,
    pub city: String,
    pub lat: f64,
    pub lng: f64,
    pub marker_text: String,
    pub marker_date: String,
    pub subject_codes: Vec<String>,
    #[serde(rename = "isRTHL")]
    pub is_rthl: bool,
    pub size: String,
}

impl Marker {
    /// The app's "no coordinates" sentinel: exactly 0,0 (see `useNearbyMarkers`).
    pub fn has_coords(&self) -> bool {
        self.lat != 0.0 || self.lng != 0.0
    }
}
