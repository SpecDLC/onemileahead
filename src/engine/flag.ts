/** `?engine=wasm` turns on the Rust/WASM engine prototype. Kept dependency-free so any module can import it. */
export function isWasmEngineEnabled(search: string = globalThis.location?.search ?? ''): boolean {
  return new URLSearchParams(search).get('engine') === 'wasm';
}
