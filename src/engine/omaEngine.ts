/**
 * Thin TypeScript wrapper over the Rust engine (crates/oma-wasm).
 *
 * ABI: oma_alloc(len) -> ptr, oma_free(ptr, len), oma_call(ptr, len) -> ptr.
 * Commands are JSON objects `{cmd, ...input}`; replies are `{ok:true, ...}` or `{ok:false, error}`.
 * The reply buffer is `[u32 LE n][n bytes JSON]` and is freed with oma_free(ptr, 4 + n).
 */
import type { Marker } from '../types/marker';
import type { MarkerResearch } from '../types/research';

export interface EngineNearby {
  marker: Marker;
  distance: number; // miles
  bearing: number; // degrees
}

export interface Fix {
  lat: number;
  lng: number;
  /** milliseconds */
  t: number;
  /** degrees clockwise from north, if the device reports one */
  heading?: number | null;
  /** metres per second, if the device reports one */
  speed?: number | null;
}

export interface AheadItem {
  marker: Marker;
  along_mi: number;
  cross_ft: number;
  side: 'left' | 'right';
  eta_s: number | null;
}

export interface AheadResult {
  status: 'ok' | 'no_fixes' | 'stationary' | 'no_heading' | 'no_speed' | 'gps_jump';
  heading: number | null;
  speed_mps: number | null;
  results: AheadItem[];
  cues: AheadItem[];
}

export interface AheadOptions {
  horizon_mi?: number;
  corridor_ft?: number;
  cue_mi?: number;
}

export interface LoadStats {
  count: number;
  spatial: number;
  cells: number;
  tokens: number;
}

interface Exports {
  memory: WebAssembly.Memory;
  oma_alloc(len: number): number;
  oma_free(ptr: number, len: number): void;
  oma_call(ptr: number, len: number): number;
}

export class EngineError extends Error {}

export class OmaEngine {
  private readonly x: Exports;
  private readonly enc = new TextEncoder();
  private readonly dec = new TextDecoder();

  private constructor(x: Exports) {
    this.x = x;
  }

  /** Instantiate from the module bytes (no imports needed). */
  static async fromBytes(bytes: BufferSource): Promise<OmaEngine> {
    const { instance } = await WebAssembly.instantiate(bytes, {});
    return new OmaEngine(instance.exports as unknown as Exports);
  }

  /** Raw call: send any command, get the parsed reply (throws EngineError on `ok:false`). */
  call<T = Record<string, unknown>>(command: Record<string, unknown>): T {
    const input = this.enc.encode(JSON.stringify(command));
    const inPtr = this.x.oma_alloc(input.length);
    if (inPtr === 0) throw new EngineError('engine out of memory');
    new Uint8Array(this.x.memory.buffer, inPtr, input.length).set(input);
    let outPtr: number;
    try {
      outPtr = this.x.oma_call(inPtr, input.length);
    } finally {
      this.x.oma_free(inPtr, input.length);
    }
    // Re-read the buffer after the call: memory may have grown.
    const n = new DataView(this.x.memory.buffer).getUint32(outPtr, true);
    const text = this.dec.decode(new Uint8Array(this.x.memory.buffer, outPtr + 4, n));
    this.x.oma_free(outPtr, 4 + n);
    const reply = JSON.parse(text) as { ok: boolean; error?: string } & T;
    if (!reply.ok) throw new EngineError(reply.error ?? 'engine error');
    return reply;
  }

  /** `lazyText` defers the text index to the first `search` (most of load time). */
  load(markers: Marker[], options: { lazyText?: boolean } = {}): LoadStats {
    return this.call<LoadStats>({ cmd: 'load', markers, lazy_text: options.lazyText ?? false });
  }

  nearby(lat: number, lng: number, limit = 50, radiusMi?: number): EngineNearby[] {
    return this.call<{ results: EngineNearby[] }>({ cmd: 'nearby', lat, lng, limit, radius_mi: radiusMi ?? null })
      .results;
  }

  ahead(fixes: Fix[], options: AheadOptions = {}): AheadResult {
    return this.call<AheadResult>({ cmd: 'ahead', fixes, ...options });
  }

  resetCues(): void {
    this.call({ cmd: 'reset_cues' });
  }

  lookup(number: string, limit = 20): Marker[] {
    return this.call<{ results: Marker[] }>({ cmd: 'lookup', number, limit }).results;
  }

  search(q: string, limit = 20): Marker[] {
    return this.call<{ results: Marker[] }>({ cmd: 'search', q, limit }).results;
  }

  research(markdown: string): MarkerResearch | null {
    return this.call<{ result: MarkerResearch | null }>({ cmd: 'research', markdown }).result;
  }

  /** The engine's geo/format functions, exposed for differential tests. */
  geo(fn: 'haversine' | 'bearing', ...args: number[]): number;
  geo(fn: 'formatDistance' | 'formatBearing', ...args: number[]): string;
  geo(fn: string, ...args: number[]): number | string {
    return this.call<{ value: number | string }>({ cmd: 'geo', fn, args }).value;
  }
}
