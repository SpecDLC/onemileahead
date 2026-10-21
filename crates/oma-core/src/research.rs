//! `research`: port of `src/projectors/researchProjector.ts`, matching its regex and string
//! semantics (JS `trim`, `\s`, `.` excluding line terminators, `lastIndexOf('##', from)`).

use std::collections::HashMap;

use serde::Serialize;

use crate::text::{is_js_line_terminator, is_js_space, js_trim};

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ResearchLink {
    pub title: String,
    pub url: String,
    pub source: &'static str,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkerResearch {
    pub marker_number: String,
    pub generated_at: String,
    pub links: Vec<ResearchLink>,
}

fn section_source(heading: &str) -> Option<&'static str> {
    // SECTION_MAP.get(heading.toLowerCase()): only the three real headings [OMA-FUNC-LEARN-4].
    match heading.to_lowercase().as_str() {
        "grokipedia" => Some("grokipedia"),
        "wikipedia" => Some("wikipedia"),
        "related" => Some("curated"),
        _ => None,
    }
}

/// `parseFrontmatter`.
pub fn parse_frontmatter(md: &str) -> (HashMap<String, String>, String) {
    let trimmed = js_trim(md);
    if !trimmed.starts_with("---") {
        return (HashMap::new(), trimmed.to_string());
    }
    let Some(rel) = trimmed[3..].find("---") else {
        return (HashMap::new(), trimmed.to_string());
    };
    let end_idx = 3 + rel;
    let yaml = js_trim(&trimmed[3..end_idx]);
    let body = js_trim(&trimmed[end_idx + 3..]).to_string();
    let mut meta = HashMap::new();
    for line in yaml.split('\n') {
        let Some(colon) = line.find(':') else {
            continue;
        };
        let key = js_trim(&line[..colon]).to_string();
        let mut value = js_trim(&line[colon + 1..]);
        if (value.starts_with('"') && value.ends_with('"'))
            || (value.starts_with('\'') && value.ends_with('\''))
        {
            // value.slice(1, -1); a lone quote yields "".
            value = if value.len() >= 2 {
                &value[1..value.len() - 1]
            } else {
                ""
            };
        }
        meta.insert(key, value.to_string());
    }
    (meta, body)
}

/// `/^- \[(.+?)]\((.+?)\)\s*$/` on a single line (no `m` flag). Returns (title, url).
fn match_link_line(line: &str) -> Option<(String, String)> {
    let rest = line.strip_prefix("- [")?;
    let chars: Vec<(usize, char)> = rest.char_indices().collect();
    // Lazy title: try the shortest title first; for it, the shortest url that completes the match.
    for t_end in 1..=chars.len() {
        if is_js_line_terminator(chars[t_end - 1].1) {
            return None; // `.` can't cross a terminator, and longer titles would include it too
        }
        let after_title = chars.get(t_end).map(|c| c.0).unwrap_or(rest.len());
        let tail = &rest[after_title..];
        let Some(url_part) = tail.strip_prefix("](") else {
            continue;
        };
        let uchars: Vec<(usize, char)> = url_part.char_indices().collect();
        for u_end in 1..=uchars.len() {
            if is_js_line_terminator(uchars[u_end - 1].1) {
                break;
            }
            let after_url = uchars.get(u_end).map(|c| c.0).unwrap_or(url_part.len());
            if let Some(trailer) = url_part[after_url..].strip_prefix(')') {
                if trailer.chars().all(is_js_space) {
                    return Some((
                        rest[..after_title].to_string(),
                        url_part[..after_url].to_string(),
                    ));
                }
            }
        }
    }
    None
}

/// `/^\s+\S/`
fn is_description_line(line: &str) -> bool {
    let mut it = line.chars();
    match it.next() {
        Some(c) if is_js_space(c) => {}
        _ => return false,
    }
    it.any(|c| !is_js_space(c))
}

/// `parseLinksSection`.
pub fn parse_links_section(section: &str, source: &'static str) -> Vec<ResearchLink> {
    if js_trim(section).is_empty() {
        return Vec::new();
    }
    let mut links = Vec::new();
    let (mut title, mut url, mut desc): (String, String, Vec<String>) =
        (String::new(), String::new(), Vec::new());
    let flush = |title: &mut String,
                 url: &mut String,
                 desc: &mut Vec<String>,
                 links: &mut Vec<ResearchLink>| {
        if !title.is_empty() && !url.is_empty() {
            links.push(ResearchLink {
                title: title.clone(),
                url: url.clone(),
                source,
                description: js_trim(&desc.join(" ")).to_string(),
            });
        }
        title.clear();
        url.clear();
        desc.clear();
    };
    for line in section.split('\n') {
        if let Some((t, u)) = match_link_line(line) {
            flush(&mut title, &mut url, &mut desc, &mut links);
            title = t;
            url = u;
        } else if !title.is_empty() && is_description_line(line) {
            desc.push(js_trim(line).to_string());
        }
        // blank or non-indented lines: skipped
    }
    flush(&mut title, &mut url, &mut desc, &mut links);
    links
}

/// Byte offsets where `/^## (.+)$/gm` matches: (heading text, offset just after it).
fn headings(body: &str) -> Vec<(String, usize)> {
    let mut out = Vec::new();
    let mut line_start = 0;
    loop {
        let rest = &body[line_start..];
        if let Some(after) = rest.strip_prefix("## ") {
            let len = after.find(is_js_line_terminator).unwrap_or(after.len());
            if len > 0 {
                let start = line_start + 3;
                out.push((body[start..start + len].to_string(), start + len));
            }
        }
        match rest.char_indices().find(|&(_, c)| is_js_line_terminator(c)) {
            Some((i, c)) => line_start += i + c.len_utf8(),
            None => break,
        }
    }
    out
}

/// `body.lastIndexOf('##', from)` in bytes ('#' is ASCII, so byte and UTF-16 searches agree).
fn last_index_of_hashes(body: &str, from: usize) -> Option<usize> {
    let b = body.as_bytes();
    if b.len() < 2 {
        return None;
    }
    let mut i = from.min(b.len() - 2);
    loop {
        if b[i] == b'#' && b[i + 1] == b'#' {
            return Some(i);
        }
        if i == 0 {
            return None;
        }
        i -= 1;
    }
}

/// `projectResearch`.
pub fn project_research(markdown: &str) -> Option<MarkerResearch> {
    if js_trim(markdown).is_empty() {
        return None;
    }
    let (meta, body) = parse_frontmatter(markdown);
    let marker_number = meta.get("markerNumber").filter(|s| !s.is_empty())?.clone();
    let hs = headings(&body);
    let mut links = Vec::new();
    for (i, (heading, start)) in hs.iter().enumerate() {
        let end = if i + 1 < hs.len() {
            // lastIndexOf returns -1 when absent; slice(start, -1) would then count from the end.
            match last_index_of_hashes(&body, hs[i + 1].1) {
                Some(e) => e,
                None => body.len().saturating_sub(1),
            }
        } else {
            body.len()
        };
        let content = if end > *start {
            js_trim(&body[*start..end])
        } else {
            ""
        };
        if let Some(source) = section_source(heading) {
            links.extend(parse_links_section(content, source));
        }
    }
    Some(MarkerResearch {
        marker_number,
        generated_at: meta.get("generatedAt").cloned().unwrap_or_default(),
        links,
    })
}
