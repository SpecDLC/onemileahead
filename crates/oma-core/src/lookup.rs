//! `lookup`: exact port of `searchByMarkerNumber` (src/search/markerNumberSearch.ts).
//!
//! The TS walks the whole `markerNumber` prefix range (`startsWith(q)`), sorts it — exact match
//! first, then numeric collation, then primary key — and only then cuts to `limit`, so it returns
//! the lowest-numbered matches [OMA-FUNC-LOOKUP-2]. This port does the same.

use std::cmp::Ordering;

use crate::index::Engine;
use crate::text::js_trim;

/// `a.localeCompare(b, undefined, { numeric: true })` for the strings that occur in marker
/// numbers: digit runs compare by value, other characters case-insensitively. Exact for
/// all-digit strings (every number in the THC export); an approximation of ICU otherwise.
pub fn numeric_collate(a: &str, b: &str) -> Ordering {
    let (a, b): (Vec<char>, Vec<char>) = (a.chars().collect(), b.chars().collect());
    let (mut i, mut j) = (0, 0);
    while i < a.len() && j < b.len() {
        if a[i].is_ascii_digit() && b[j].is_ascii_digit() {
            let si = i;
            while i < a.len() && a[i].is_ascii_digit() {
                i += 1;
            }
            let sj = j;
            while j < b.len() && b[j].is_ascii_digit() {
                j += 1;
            }
            let na: String = a[si..i]
                .iter()
                .collect::<String>()
                .trim_start_matches('0')
                .to_string();
            let nb: String = b[sj..j]
                .iter()
                .collect::<String>()
                .trim_start_matches('0')
                .to_string();
            let o = na.len().cmp(&nb.len()).then_with(|| na.cmp(&nb));
            if o != Ordering::Equal {
                return o;
            }
        } else {
            let (ca, cb) = (a[i].to_lowercase().next(), b[j].to_lowercase().next());
            let o = ca.cmp(&cb);
            if o != Ordering::Equal {
                return o;
            }
            i += 1;
            j += 1;
        }
    }
    (a.len() - i).cmp(&(b.len() - j))
}

/// Dexie's `startsWith(p)` is the key range `[p, p + '￿')`.
fn dexie_starts_with(key: &str, prefix: &str) -> bool {
    let mut k = key.encode_utf16();
    for p in prefix.encode_utf16() {
        if k.next() != Some(p) {
            return false;
        }
    }
    k.next() != Some(0xFFFF)
}

pub fn lookup(e: &Engine, query: &str, limit: i64) -> Vec<u32> {
    let trimmed = js_trim(query);
    if trimmed.is_empty() || limit <= 0 {
        // Dexie's .limit(0) or negative yields nothing either way.
        return Vec::new();
    }
    // Binary search to the start of the prefix range in index order, then walk it.
    let start = e.by_number.partition_point(|&i| {
        crate::index::cmp_utf16(&e.markers[i as usize].marker_number, trimmed) == Ordering::Less
    });
    let mut out: Vec<u32> = Vec::new();
    for &i in &e.by_number[start..] {
        let n = &e.markers[i as usize].marker_number;
        if !n
            .encode_utf16()
            .take(trimmed.encode_utf16().count())
            .eq(trimmed.encode_utf16())
        {
            break;
        }
        if dexie_starts_with(n, trimmed) {
            out.push(i);
        }
    }
    // Exact match first, then numeric collation, then primary key — the TS comparator.
    out.sort_by(|&a, &b| {
        let (ma, mb) = (&e.markers[a as usize], &e.markers[b as usize]);
        let (na, nb) = (&ma.marker_number, &mb.marker_number);
        match (na == trimmed, nb == trimmed) {
            (true, false) => Ordering::Less,
            (false, true) => Ordering::Greater,
            _ => numeric_collate(na, nb).then(ma.id.cmp(&mb.id)),
        }
    });
    out.truncate(usize::try_from(limit).unwrap_or(usize::MAX));
    out
}
