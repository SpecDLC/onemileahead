//! String helpers with JavaScript semantics.

/// JS `WhiteSpace` ∪ `LineTerminator` — the set `String.prototype.trim` and regex `\s` use.
/// Differs from Rust's `char::is_whitespace` (which includes U+0085 and excludes U+FEFF).
pub fn is_js_space(c: char) -> bool {
    matches!(
        c,
        '\u{0009}'
            | '\u{000A}'
            | '\u{000B}'
            | '\u{000C}'
            | '\u{000D}'
            | '\u{0020}'
            | '\u{00A0}'
            | '\u{1680}'
            | '\u{2000}'
            ..='\u{200A}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202F}'
                | '\u{205F}'
                | '\u{3000}'
                | '\u{FEFF}'
    )
}

/// JS regex line terminators (what `.` refuses to match and `^`/`$` anchor to under `m`).
pub fn is_js_line_terminator(c: char) -> bool {
    matches!(c, '\n' | '\r' | '\u{2028}' | '\u{2029}')
}

/// `String.prototype.trim`.
pub fn js_trim(s: &str) -> &str {
    s.trim_matches(is_js_space)
}

/// Fold common Latin accents to ASCII and lowercase — for the search index only.
pub fn fold_char(c: char) -> char {
    let c = match c {
        'À'..='Å' | 'à'..='å' | 'Ā' | 'ā' => 'a',
        'Ç' | 'ç' => 'c',
        'È'..='Ë' | 'è'..='ë' => 'e',
        'Ì'..='Ï' | 'ì'..='ï' => 'i',
        'Ñ' | 'ñ' => 'n',
        'Ò'..='Ö' | 'Ø' | 'ò'..='ö' | 'ø' => 'o',
        'Ù'..='Ü' | 'ù'..='ü' => 'u',
        'Ý' | 'ý' | 'ÿ' => 'y',
        _ => c,
    };
    c.to_lowercase().next().unwrap_or(c)
}

/// Call `f` with each lowercase alphanumeric token (apostrophes dropped: "o'connor" → "oconnor"),
/// reusing `buf` so tokenizing allocates nothing.
pub fn for_each_token(s: &str, buf: &mut String, mut f: impl FnMut(&str)) {
    buf.clear();
    for c in s.chars() {
        if c == '\'' || c == '’' {
            continue;
        }
        let c = if c.is_ascii() {
            c.to_ascii_lowercase()
        } else {
            fold_char(c)
        };
        if c.is_alphanumeric() {
            buf.push(c);
        } else if !buf.is_empty() {
            f(buf);
            buf.clear();
        }
    }
    if !buf.is_empty() {
        f(buf);
        buf.clear();
    }
}

/// Tokens as owned strings (queries; small inputs).
pub fn tokens(s: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut buf = String::new();
    for_each_token(s, &mut buf, |t| out.push(t.to_string()));
    out
}
