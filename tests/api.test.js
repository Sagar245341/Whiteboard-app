import { test } from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { startTestServer } from './helpers.js';

test('accounts, persistence, access control, uploads and realtime collaboration', async t => {
  const server = await startTestServer(); const clients = [];
  t.after(async () => { clients.forEach(c => c.disconnect()); await server.stop(); });
  async function request(url, token, method = 'GET', body) { const r = await fetch(`${server.base}/api${url}`, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, ...(body && { body: JSON.stringify(body) }) }); return { status: r.status, data: await r.json() }; }
  const owner = (await request('/auth/register', null, 'POST', { name: 'Owner', email: 'owner@example.com', password: 'password123' })).data;
  const editor = (await request('/auth/register', null, 'POST', { name: 'Editor', email: 'editor@example.com', password: 'password123' })).data;
  const viewer = (await request('/auth/register', null, 'POST', { name: 'Viewer', email: 'viewer@example.com', password: 'password123' })).data;
  const stranger = (await request('/auth/register', null, 'POST', { name: 'Stranger', email: 'stranger@example.com', password: 'password123' })).data;
  await t.test('register/login validation and private API', async () => {
    assert.equal((await request('/boards')).status, 401);
    assert.equal((await request('/auth/login', null, 'POST', { email: 'owner@example.com', password: 'wrong-password' })).status, 401);
    assert.equal((await request('/auth/login', null, 'POST', { email: 'OWNER@example.com', password: 'password123' })).data.user.id, owner.user.id);
    assert.equal((await request('/auth/register', null, 'POST', { email: 'owner@example.com', password: 'password123', name: 'Duplicate' })).status, 409);
  });
  const board = (await request('/boards', owner.token, 'POST', { title: 'Integration board' })).data;
  await t.test('owner invites users and outsiders cannot access', async () => {
    assert.equal((await request(`/boards/${board.id}`, stranger.token)).status, 403);
    assert.equal((await request(`/boards/${board.id}/members`, owner.token, 'POST', { email: editor.user.email, role: 'editor' })).status, 200);
    assert.equal((await request(`/boards/${board.id}/members`, owner.token, 'POST', { email: viewer.user.email, role: 'viewer' })).status, 200);
    assert.equal((await request('/boards', editor.token)).data.length, 1);
    assert.equal((await request(`/boards/${board.id}`, viewer.token)).data.role, 'viewer');
    assert.equal((await request(`/boards/${board.id}`, viewer.token, 'PATCH', { title: 'Not allowed' })).status, 403);
    assert.equal((await request(`/boards/${board.id}/members`, editor.token, 'POST', { email: stranger.user.email, role: 'editor' })).status, 403);
  });
  async function connect(token) { const socket = io(server.base, { auth: { token }, transports: ['websocket'] }); clients.push(socket); await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); }); const result = await socket.timeout(3000).emitWithAck('join', board.id); assert.ok(result.board); return socket; }
  const a = await connect(owner.token), b = await connect(editor.token), c = await connect(viewer.token);
  const element = { id: 'test-sticky', type: 'sticky', x: 50, y: 80, w: 200, h: 160, text: 'A shared idea', fill: '#fff4bd' };
  await t.test('editor operations broadcast and persist', async () => {
    const broadcast = new Promise(resolve => a.once('operations', resolve));
    assert.equal((await b.timeout(3000).emitWithAck('operations', { upsert: [element], remove: [] })).ok, true);
    assert.equal((await broadcast).upsert[0].text, 'A shared idea');
    assert.equal((await request(`/boards/${board.id}`, owner.token)).data.elements[0].text, 'A shared idea');
  });
  await t.test('viewer socket writes are rejected', async () => {
    assert.match((await c.timeout(3000).emitWithAck('operations', { upsert: [], remove: [element.id] })).error, /denied/);
    assert.equal((await request(`/boards/${board.id}`, owner.token)).data.elements.length, 1);
  });
  await t.test('renaming during a drawing update preserves both changes', async () => {
    await Promise.all([request(`/boards/${board.id}`, owner.token, 'PATCH', { title: 'Renamed together' }), b.timeout(3000).emitWithAck('operations', { upsert: [{ ...element, text: 'Updated together' }], remove: [] })]);
    const current = (await request(`/boards/${board.id}`, owner.token)).data;
    assert.equal(current.title, 'Renamed together'); assert.equal(current.elements[0].text, 'Updated together');
  });
  await t.test('concurrent edits to distinct elements are retained', async () => {
    await Promise.all([a.timeout(3000).emitWithAck('operations', { upsert: [{ ...element, id: 'one' }], remove: [] }), b.timeout(3000).emitWithAck('operations', { upsert: [{ ...element, id: 'two' }], remove: [] })]);
    assert.equal((await request(`/boards/${board.id}`, owner.token)).data.elements.length, 3);
  });
  await t.test('image upload, durable retrieval and permissions', async () => {
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
    const form = new FormData(); form.append('image', new Blob([image], { type: 'image/png' }), 'test.png');
    const r = await fetch(`${server.base}/api/boards/${board.id}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${owner.token}` }, body: form });
    assert.equal(r.status, 200); const asset = await r.json(); assert.match(asset.src, /^data:image\/png;base64,/);
    const img = await fetch(`${server.base}/api/boards/${board.id}/assets/${asset.assetId}`, { headers: { Authorization: `Bearer ${editor.token}` } }); assert.equal(img.status, 200); assert.deepEqual(Buffer.from(await img.arrayBuffer()), image);
    assert.equal((await request(`/boards/${board.id}/assets/${asset.assetId}`, stranger.token)).status, 403);
  });
  await t.test('AI reports missing configuration honestly', async () => {
    const result = await request(`/boards/${board.id}/ai`, owner.token, 'POST', { action: 'brainstorm', prompt: 'Launch ideas' }); assert.equal(result.status, 503); assert.match(result.data.error, /GEMINI_API_KEY/);
  });
  await t.test('revoked editors cannot write through existing sockets', async () => {
    await request(`/boards/${board.id}/members/${editor.user.email}`, owner.token, 'DELETE');
    assert.match((await b.timeout(3000).emitWithAck('operations', { upsert: [], remove: [element.id] })).error, /denied/);
    assert.equal((await request(`/boards/${board.id}`, editor.token)).status, 403);
  });
  await t.test('only owners can delete boards', async () => {
    assert.equal((await request(`/boards/${board.id}`, viewer.token, 'DELETE')).status, 403);
    assert.equal((await request(`/boards/${board.id}`, owner.token, 'DELETE')).status, 200);
    assert.equal((await request(`/boards/${board.id}`, owner.token)).status, 404);
  });
});
