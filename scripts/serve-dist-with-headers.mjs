// Local static server for checking public/_headers (CSP, caching) against a production build,
// because `vite preview` ignores _headers. Serves ./dist (run from the repo root after
// `npm run build`) and applies ./dist/_headers the way Cloudflare Workers Static Assets does:
//  - a rule is an unindented URL pattern followed by indented "Name: value" lines
//  - "*" is a greedy splat (matches anything, including "/" and the empty string),
//    ":name" matches one path segment; the pattern must match the whole pathname
//  - every matching rule contributes its headers; a header set by several rules
//    is joined with ", "; "! Name" removes a header added by an earlier rule
//  - _headers, _redirects and .assetsignore are never served
// Usage: node scripts/serve-dist-with-headers.mjs [port] [--wasm-unsafe-eval]
//   --wasm-unsafe-eval adds 'wasm-unsafe-eval' to script-src if _headers lacks it (it has had it
//   since the WASM engine landed, so the flag is now only useful against older builds).
// e2e/csp-headers.test.ts starts this server to check the real headers in Chromium.
// Written during the 2026-10-13 wrap-up to verify the CSP in Chromium (see specs/handoff/).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('dist');
const PORT = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) || 4300);
const ADD_WASM = process.argv.includes('--wasm-unsafe-eval');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.gz': 'application/gzip',
};

function parseHeaders(text) {
  const rules = [];
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      cur = { pattern: raw.trim(), set: [], detach: [] };
      cur.re = new RegExp(
        '^' +
          cur.pattern
            .split(/(\*|:[A-Za-z_][A-Za-z0-9_]*)/)
            .map((p) => (p === '*' ? '.*' : p.startsWith(':') && p.length > 1 ? '[^/]+' : p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')))
            .join('') +
          '$',
      );
      rules.push(cur);
      continue;
    }
    if (!cur) throw new Error(`header line before any URL pattern: ${raw}`);
    const line = raw.trim();
    if (line.startsWith('!')) { cur.detach.push(line.slice(1).trim().toLowerCase()); continue; }
    const i = line.indexOf(':');
    if (i < 0) throw new Error(`bad header line: ${raw}`);
    cur.set.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
  }
  return rules;
}

const rules = parseHeaders(fs.readFileSync(path.join(ROOT, '_headers'), 'utf8'));
if (ADD_WASM) {
  for (const r of rules) {
    for (const h of r.set) {
      if (h[0].toLowerCase() === 'content-security-policy') {
        if (h[1].includes("'wasm-unsafe-eval'")) continue;
        const before = h[1];
        h[1] = h[1].replace(/script-src 'self'/, "script-src 'self' 'wasm-unsafe-eval'");
        if (before === h[1]) throw new Error('could not patch script-src');
      }
    }
  }
}
console.log(`[csp-serve] ${rules.length} rules${ADD_WASM ? " (script-src + 'wasm-unsafe-eval')" : ''}`);
for (const r of rules) console.log(`[csp-serve]   ${r.pattern} -> ${r.re} :: ${r.set.map((h) => h[0]).join(', ')}`);

function headersFor(pathname) {
  const out = new Map(); // lowercased name -> [name, value]
  for (const r of rules) {
    if (!r.re.test(pathname)) continue;
    for (const d of r.detach) out.delete(d);
    for (const [k, v] of r.set) {
      const key = k.toLowerCase();
      if (out.has(key)) out.get(key)[1] += `, ${v}`;
      else out.set(key, [k, v]);
    }
  }
  return [...out.values()];
}

const HIDDEN = new Set(['/_headers', '/_redirects', '/.assetsignore']);

function resolve(pathname) {
  let rel = decodeURIComponent(pathname);
  if (HIDDEN.has(rel)) return null;
  let file = path.normalize(path.join(ROOT, rel));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return null;
  try {
    const st = fs.statSync(file);
    if (st.isDirectory()) file = path.join(file, 'index.html');
    return fs.statSync(file).isFile() ? file : null;
  } catch {
    // Cloudflare html_handling "auto-trailing-slash": /foo serves /foo.html
    try { return fs.statSync(file + '.html').isFile() ? file + '.html' : null; } catch { return null; }
  }
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const file = resolve(url.pathname);
    const extra = headersFor(url.pathname);
    if (!file) {
      // Cloudflare applies _headers to a 404 too (checked with `wrangler dev`), so the CSP is
      // present on every response, not only on files that exist (OMA-SEC-EDGE-6).
      const headers404 = { 'Content-Type': 'text/plain; charset=utf-8' };
      for (const [k, v] of extra) headers404[k] = v;
      res.writeHead(404, headers404);
      res.end('Not found');
      console.log(`[csp-serve] 404 ${url.pathname}`);
      return;
    }
    const headers = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' };
    for (const [k, v] of extra) headers[k] = v;
    const body = fs.readFileSync(file);
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
    const csp = extra.some(([k]) => k.toLowerCase() === 'content-security-policy');
    console.log(`[csp-serve] 200 ${url.pathname} ${headers['Content-Type']} csp=${csp} cache=${headers['Cache-Control'] ?? '-'}`);
  })
  .listen(PORT, '127.0.0.1', () => console.log(`[csp-serve] http://localhost:${PORT}/ root=${ROOT}`));
