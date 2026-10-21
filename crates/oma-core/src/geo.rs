//! Geodesy and formatting, ported operation-for-operation from `src/utils/distance.ts`
//! so results agree with V8 to within libm rounding (differential tests assert 1e-9).

pub const EARTH_RADIUS_MILES: f64 = 3958.8;
pub const DEG_TO_RAD: f64 = std::f64::consts::PI / 180.0;
pub const FEET_PER_MILE: f64 = 5280.0;
pub const METERS_PER_MILE: f64 = 1609.344;

/// `haversineDistance` — miles. Same evaluation order as the TS source.
pub fn haversine(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    let d_lat = (lat2 - lat1) * DEG_TO_RAD;
    let d_lng = (lng2 - lng1) * DEG_TO_RAD;
    let s_lat = (d_lat / 2.0).sin();
    let s_lng = (d_lng / 2.0).sin();
    let a = s_lat * s_lat + (lat1 * DEG_TO_RAD).cos() * (lat2 * DEG_TO_RAD).cos() * (s_lng * s_lng);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
    EARTH_RADIUS_MILES * c
}

/// `bearing` — degrees clockwise from north in [0, 360).
pub fn bearing(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    let d_lng = (lng2 - lng1) * DEG_TO_RAD;
    let lat1_rad = lat1 * DEG_TO_RAD;
    let lat2_rad = lat2 * DEG_TO_RAD;
    let y = d_lng.sin() * lat2_rad.cos();
    let x = lat1_rad.cos() * lat2_rad.sin() - lat1_rad.sin() * lat2_rad.cos() * d_lng.cos();
    let deg = (y.atan2(x) * 180.0) / std::f64::consts::PI;
    (deg + 360.0) % 360.0
}

/// JavaScript `Math.round`: halves round toward +∞, exact for every finite input.
pub fn js_round(x: f64) -> f64 {
    if !x.is_finite() {
        return x;
    }
    let r = x.floor();
    if x - r >= 0.5 {
        r + 1.0
    } else {
        r
    }
}

/// JavaScript `String(n)` for an integer-valued double below 1e21 (`-0` prints as `0`).
fn js_int_string(n: f64) -> String {
    if n == 0.0 {
        return "0".to_string();
    }
    format!("{n:.0}")
}

/// JavaScript `Number.prototype.toFixed(1)` for |x| < 1e21.
/// Rust's `{:.1}` rounds exact decimal ties to even; JS picks the larger n. A tie at one decimal
/// is only possible when x·4 is an odd integer (x = k + .25 or .75), and only then do they differ.
pub fn js_to_fixed_1(x: f64) -> String {
    let q = x * 4.0;
    if q.is_finite() && q == q.trunc() && (q % 2.0) != 0.0 {
        let n = x * 10.0 + 0.5; // exact: x·10 = 2.5·q is representable
        let neg = n < 0.0;
        let a = n.abs() as u64;
        let s = format!("{}.{}", a / 10, a % 10);
        return if neg { format!("-{s}") } else { s };
    }
    let s = format!("{x:.1}");
    if s == "-0.0" {
        "-0.0".to_string() // JS: (-0.04).toFixed(1) === "-0.0"
    } else {
        s
    }
}

/// `formatDistance`.
pub fn format_distance(miles: f64) -> String {
    if miles < 0.1 {
        return format!("{} ft", js_int_string(js_round(miles * FEET_PER_MILE)));
    }
    if miles < 10.0 {
        return format!("{} mi", js_to_fixed_1(miles));
    }
    format!("{} mi", js_int_string(js_round(miles)))
}

/// `formatBearing`. Returns `None` where the TS indexes outside the array (negative or NaN
/// input) and so returns `undefined`.
pub fn format_bearing(degrees: f64) -> Option<&'static str> {
    const DIRS: [&str; 8] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    let idx = js_round(degrees / 45.0) % 8.0;
    if idx.is_nan() || idx < 0.0 || idx != idx.trunc() {
        return None;
    }
    DIRS.get(idx as usize).copied()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn to_fixed_matches_js_on_ties() {
        assert_eq!(js_to_fixed_1(0.25), "0.3");
        assert_eq!(js_to_fixed_1(0.75), "0.8");
        assert_eq!(js_to_fixed_1(1.25), "1.3");
        assert_eq!(js_to_fixed_1(0.15), "0.1"); // 0.1499999… in binary
        assert_eq!(js_to_fixed_1(9.95), "9.9"); // 9.949999…
        assert_eq!(js_to_fixed_1(2.35), "2.4"); // 2.350000…01
    }

    #[test]
    fn js_round_semantics() {
        assert_eq!(js_round(2.5), 3.0);
        assert_eq!(js_round(-2.5), -2.0);
        assert_eq!(js_round(0.49999999999999994), 0.0);
    }

    #[test]
    fn formatters() {
        assert_eq!(format_distance(0.05), "264 ft");
        assert_eq!(format_distance(0.0), "0 ft");
        assert_eq!(format_distance(3.14159), "3.1 mi");
        assert_eq!(format_distance(12.5), "13 mi");
        assert_eq!(format_bearing(0.0), Some("N"));
        assert_eq!(format_bearing(350.0), Some("N"));
        assert_eq!(format_bearing(-10.0), Some("N")); // round(-0.22) = -0 → dirs[0]
        assert_eq!(format_bearing(-30.0), None);
    }
}
