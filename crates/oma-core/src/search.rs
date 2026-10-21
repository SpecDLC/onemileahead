//! `search`: an inverted text index over title, county, city and inscription with the same field
//! weights as `src/search/searchEngine.ts` (3 / 2 / 2 / 1). It is not Fuse: Fuse scores a bitap
//! match near the start of each field; this scores token matches anywhere, with Fuse's
//! 1/√(field length) norm. Overlap with Fuse is measured by the differential suite.

use std::collections::HashMap;

use crate::marker::Marker;
use crate::text::{for_each_token, tokens};

/// FNV-1a: plenty for short ASCII-ish tokens, much cheaper than SipHash.
#[derive(Default, Clone, Copy)]
pub struct BuildFnv;
pub struct Fnv(u64);
impl std::hash::Hasher for Fnv {
    fn finish(&self) -> u64 {
        self.0
    }
    fn write(&mut self, bytes: &[u8]) {
        for &b in bytes {
            self.0 = (self.0 ^ b as u64).wrapping_mul(0x100000001b3);
        }
    }
}
impl std::hash::BuildHasher for BuildFnv {
    type Hasher = Fnv;
    fn build_hasher(&self) -> Fnv {
        Fnv(0xcbf29ce484222325)
    }
}

pub const FIELD_WEIGHTS: [f64; 4] = [3.0, 2.0, 2.0, 1.0]; // title, county, city, markerText

const Q_EXACT: f64 = 1.0;
const Q_PREFIX: f64 = 0.8;
const Q_FUZZY: f64 = 0.6;
const MIN_TOKEN: usize = 2; // Fuse minMatchCharLength
const MIN_FUZZY: usize = 5;

#[derive(Debug, Default)]
pub struct TextIndex {
    /// Sorted vocabulary.
    pub vocab: Vec<String>,
    /// Per term: (marker idx, field) pairs, ascending, deduplicated.
    pub postings: Vec<Vec<(u32, u8)>>,
    /// Per marker: token count per field.
    pub field_len: Vec<[u32; 4]>,
}

fn fields(m: &Marker) -> [&str; 4] {
    [&m.title, &m.county, &m.city, &m.marker_text]
}

/// Damerau-free Levenshtein distance ≤ 1 check.
fn within_one_edit(a: &[u8], b: &[u8]) -> bool {
    let (la, lb) = (a.len(), b.len());
    if la.abs_diff(lb) > 1 {
        return false;
    }
    let (mut i, mut j, mut edits) = (0, 0, 0);
    while i < la && j < lb {
        if a[i] == b[j] {
            i += 1;
            j += 1;
            continue;
        }
        edits += 1;
        if edits > 1 {
            return false;
        }
        match la.cmp(&lb) {
            std::cmp::Ordering::Greater => i += 1,
            std::cmp::Ordering::Less => j += 1,
            std::cmp::Ordering::Equal => {
                i += 1;
                j += 1;
            }
        }
    }
    edits + (la - i) + (lb - j) <= 1
}

impl TextIndex {
    pub fn build(markers: &[Marker]) -> TextIndex {
        // Hot loop over ~2.5M tokens for the full dataset: one reusable buffer, a cheap hasher,
        // and an allocation only for each new term.
        let mut term_ids: HashMap<String, u32, BuildFnv> =
            HashMap::with_capacity_and_hasher(65_536, BuildFnv);
        let mut raw: Vec<Vec<(u32, u8)>> = Vec::new();
        let mut field_len = Vec::with_capacity(markers.len());
        let mut buf = String::new();
        for (mi, m) in markers.iter().enumerate() {
            let mut lens = [0u32; 4];
            for (f, text) in fields(m).iter().enumerate() {
                let key = (mi as u32, f as u8);
                for_each_token(text, &mut buf, |t| {
                    lens[f] += 1;
                    let id = match term_ids.get(t) {
                        Some(&id) => id,
                        None => {
                            let id = term_ids.len() as u32;
                            term_ids.insert(t.to_string(), id);
                            raw.push(Vec::new());
                            id
                        }
                    };
                    let p = &mut raw[id as usize];
                    if p.last() != Some(&key) {
                        p.push(key);
                    }
                });
            }
            field_len.push(lens);
        }
        let mut terms: Vec<(String, u32)> = term_ids.into_iter().collect();
        terms.sort();
        let mut vocab = Vec::with_capacity(terms.len());
        let mut postings = Vec::with_capacity(terms.len());
        for (t, id) in terms {
            vocab.push(t);
            let mut p = std::mem::take(&mut raw[id as usize]);
            p.sort_unstable();
            p.dedup();
            postings.push(p);
        }
        TextIndex {
            vocab,
            postings,
            field_len,
        }
    }

    /// (term id, match quality) for one query token.
    fn expand(&self, q: &str) -> Vec<(usize, f64)> {
        let mut out = Vec::new();
        let start = self.vocab.partition_point(|t| t.as_str() < q);
        for (k, t) in self.vocab[start..].iter().enumerate() {
            if !t.starts_with(q) {
                break;
            }
            out.push((start + k, if t == q { Q_EXACT } else { Q_PREFIX }));
        }
        if q.len() >= MIN_FUZZY {
            let qb = q.as_bytes();
            for (i, t) in self.vocab.iter().enumerate() {
                if !t.starts_with(q) && within_one_edit(qb, t.as_bytes()) {
                    out.push((i, Q_FUZZY));
                }
            }
        }
        out
    }

    /// Marker indexes, best first (ties by index, i.e. by id).
    pub fn search(&self, q: &str, limit: usize) -> Vec<u32> {
        let qtoks: Vec<String> = tokens(q)
            .into_iter()
            .filter(|t| t.chars().count() >= MIN_TOKEN)
            .take(32)
            .collect();
        if qtoks.is_empty() || limit == 0 {
            return Vec::new();
        }
        // marker -> (mask of query tokens matched, score)
        let mut acc: HashMap<u32, (u32, f64)> = HashMap::new();
        for (qi, qt) in qtoks.iter().enumerate() {
            let mut best: HashMap<(u32, u8), f64> = HashMap::new();
            for (term, quality) in self.expand(qt) {
                for &(m, f) in &self.postings[term] {
                    let e = best.entry((m, f)).or_insert(0.0);
                    if quality > *e {
                        *e = quality;
                    }
                }
            }
            for ((m, f), quality) in best {
                let len = self.field_len[m as usize][f as usize].max(1) as f64;
                let s = FIELD_WEIGHTS[f as usize] * quality / len.sqrt();
                let e = acc.entry(m).or_insert((0, 0.0));
                e.0 |= 1 << qi;
                e.1 += s;
            }
        }
        let all = if qtoks.len() == 32 {
            u32::MAX
        } else {
            (1u32 << qtoks.len()) - 1
        };
        let mut hits: Vec<(u32, f64)> = acc
            .iter()
            .filter(|(_, v)| v.0 == all)
            .map(|(&m, v)| (m, v.1))
            .collect();
        if hits.is_empty() {
            // No marker matches every word: rank partial matches by words matched, then score.
            hits = acc
                .iter()
                .map(|(&m, v)| (m, v.0.count_ones() as f64 * 1000.0 + v.1))
                .collect();
        }
        hits.sort_by(|a, b| {
            b.1.partial_cmp(&a.1)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then(a.0.cmp(&b.0))
        });
        hits.truncate(limit);
        hits.into_iter().map(|(m, _)| m).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::within_one_edit;

    #[test]
    fn edit_distance_one() {
        assert!(within_one_edit(b"church", b"chruch") == false); // transposition = 2 edits
        assert!(within_one_edit(b"salado", b"salad"));
        assert!(within_one_edit(b"temple", b"tempe"));
        assert!(within_one_edit(b"waco", b"wacko"));
        assert!(!within_one_edit(b"austin", b"boston"));
    }
}
