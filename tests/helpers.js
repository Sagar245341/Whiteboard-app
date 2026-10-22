import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
export async function startTestServer(port = 3489) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'canvas-test-'));
  const child = spawn(process.execPath, ['server/index.js', '--production'], { env: { ...process.env, PORT: String(port), DATA_DIR: directory, DATABASE_URL: '', JWT_SECRET: 'canvas-integration-test-secret-not-for-production', VITE_NEON_AUTH_URL: '', NEON_AUTH_JWKS_URL: '', GEMINI_API_KEY: '', S3_ENDPOINT: '' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; child.stdout.on('data', d => logs += d); child.stderr.on('data', d => logs += d);
  const base = `http://127.0.0.1:${port}`;
  async function stop() { if (child.exitCode === null) { child.kill(); await new Promise(resolve => child.once('exit', resolve)); } await fs.rm(directory, { recursive: true, force: true }); }
  try {
    for (let i = 0; i < 100; i++) { if (child.exitCode !== null) throw new Error(logs); try { if ((await fetch(`${base}/api/health`)).ok) return { base, stop }; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
    throw new Error(`Test server did not start: ${logs}`);
  } catch (e) { await stop(); throw e; }
}
