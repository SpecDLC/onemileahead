import { spawn, type ChildProcess } from 'child_process';
import { readdirSync } from 'fs';
import { join } from 'path';

/**
 * Serve dist/ with public/_headers applied the way Cloudflare does
 * (scripts/serve-dist-with-headers.mjs). `vite preview` ignores _headers. Needs `npm run build`.
 */
export async function serveDist(port: number): Promise<{ base: string; stop: () => void }> {
  const server: ChildProcess = spawn('node', ['scripts/serve-dist-with-headers.mjs', String(port)], {
    stdio: 'pipe',
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('serve-dist-with-headers did not start')), 10_000);
    server.stdout?.on('data', (d: Buffer) => {
      if (d.toString().includes('http://localhost:')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on('exit', (code) => reject(new Error(`serve-dist-with-headers exited with ${code}`)));
  });
  return { base: `http://127.0.0.1:${port}`, stop: () => server.kill() };
}

/** The hashed engine module in dist/assets, as a URL path. */
export function wasmAsset(): string {
  const name = readdirSync(join('dist', 'assets')).find((f) => /^oma_engine-.*\.wasm$/.test(f));
  if (!name) throw new Error('no oma_engine-*.wasm in dist/assets; run npm run build');
  return `/assets/${name}`;
}
