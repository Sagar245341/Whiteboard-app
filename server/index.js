import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import * as store from './store.js';
import { initAuth, auth, passwordHash, checkPassword, tokenFor, userFromToken, roleFor } from './auth.js';
import { generate } from './ai.js';
import { saveImage, loadImage } from './storage.js';

await store.initStore();
await initAuth();
const app = express();
const server = createServer(app);
const io = new Server(server, { maxHttpBufferSize: 12e6 });
app.disable('x-powered-by');
app.use(express.json({ limit: '12mb' }));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });
const fail = (status, message) => Object.assign(new Error(message), { status });
app.get('/api/health', (_, res) => res.json({ ok: true, database: process.env.DATABASE_URL ? 'neon' : 'local', ai: Boolean(process.env.GEMINI_API_KEY) }));
app.post('/api/auth/:action', authLimiter, async (req, res) => {
  const { action } = req.params;
  if (action === 'neon') {
    if (!process.env.VITE_NEON_AUTH_URL && !process.env.NEON_AUTH_JWKS_URL) throw fail(503, 'Neon Auth is not configured.');
    let user;
    try { user = await userFromToken(req.body.token); } catch { throw fail(401, 'Neon session could not be verified. Please sign in again.'); }
    return res.json({ token: await tokenFor(user), user });
  }
  if (process.env.VITE_NEON_AUTH_URL) throw fail(400, 'Use Neon Auth to sign in.');
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!['login', 'register'].includes(action)) throw fail(404, 'Not found');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 256) throw fail(400, 'Use a valid email and a password with 8–256 characters.');
  let user = (await store.all('users')).find(u => u.email === email);
  if (action === 'register') {
    if (user) throw fail(409, 'This email is already registered. Please sign in.');
    const name = String(req.body.name || '').trim().slice(0, 80);
    if (!name) throw fail(400, 'Please enter your name.');
    user = { id: randomUUID(), email, name, password: passwordHash(password) };
    await store.put('users', user);
  } else if (!user?.password || !checkPassword(password, user.password)) throw fail(401, 'Incorrect email or password.');
  res.json({ token: await tokenFor(user), user: { id: user.id, name: user.name, email: user.email } });
});
app.get('/api/me', auth, (req, res) => res.json(req.user));
app.get('/api/boards', auth, async (req, res) => res.json((await store.all('boards')).filter(b => roleFor(b, req.user)).map(b => ({ ...b, role: roleFor(b, req.user) }))));
app.post('/api/boards', auth, async (req, res) => {
  const board = { id: randomUUID(), title: String(req.body.title || 'Untitled whiteboard').slice(0, 120), ownerId: req.user.id, members: [], elements: Array.isArray(req.body.elements) ? req.body.elements.slice(0, 1000) : [], pattern: 'dots', createdAt: Date.now(), updatedAt: Date.now(), revision: 0 };
  await store.put('boards', board); res.status(201).json({ ...board, role: 'owner' });
});
app.use('/api/boards/:id', auth, async (req, res, next) => {
  const board = await store.get('boards', req.params.id);
  if (!board) throw fail(404, 'Whiteboard not found.');
  const role = roleFor(board, req.user);
  if (!role) throw fail(403, 'You do not have access to this whiteboard. Ask its owner to invite your email.');
  req.board = board; req.role = role; next();
});
app.get('/api/boards/:id', (req, res) => res.json({ ...req.board, role: req.role }));
app.patch('/api/boards/:id', async (req, res) => {
  const board = await enqueue(req.board.id, async () => {
    const board = await store.get('boards', req.board.id);
    if (!board || !['owner', 'editor'].includes(roleFor(board, req.user))) throw fail(403, 'Editing access denied.');
    if (req.body.title !== undefined) board.title = String(req.body.title).trim().slice(0, 120) || 'Untitled whiteboard';
    if (['dots', 'grid', 'plain'].includes(req.body.pattern)) board.pattern = req.body.pattern;
    board.updatedAt = Date.now(); await store.put('boards', board); return board;
  });
  io.to(board.id).emit('metadata', { title: board.title, pattern: board.pattern });
  res.json({ ...board, role: req.role });
});
app.delete('/api/boards/:id', async (req, res) => {
  if (req.role !== 'owner') throw fail(403, 'Only the owner can delete this whiteboard.');
  await enqueue(req.board.id, () => store.remove('boards', req.board.id)); io.to(req.board.id).emit('deleted'); res.json({ ok: true });
});
app.post('/api/boards/:id/members', async (req, res) => {
  if (req.role !== 'owner') throw fail(403, 'Only the owner can invite collaborators.');
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400, 'Enter a valid email address.');
  if (!['editor', 'viewer'].includes(req.body.role)) throw fail(400, 'Choose editor or viewer.');
  if (email === req.user.email) throw fail(400, 'You already own this board.');
  const members = await enqueue(req.board.id, async () => {
    const board = await store.get('boards', req.board.id);
    if (!board) throw fail(404, 'Whiteboard not found.');
    board.members = board.members.filter(m => m.email !== email);
    board.members.push({ email, role: req.body.role }); await store.put('boards', board); return board.members;
  });
  io.to(req.board.id).emit('permissions-changed'); res.json(members);
});
app.delete('/api/boards/:id/members/:email', async (req, res) => {
  if (req.role !== 'owner') throw fail(403, 'Only the owner can remove collaborators.');
  const members = await enqueue(req.board.id, async () => {
    const board = await store.get('boards', req.board.id);
    if (!board) throw fail(404, 'Whiteboard not found.');
    board.members = board.members.filter(m => m.email !== req.params.email); await store.put('boards', board); return board.members;
  });
  io.to(req.board.id).emit('permissions-changed'); res.json(members);
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 }, fileFilter: (_, file, cb) => cb(null, ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.mimetype)) });
app.post('/api/boards/:id/upload', upload.single('image'), async (req, res) => {
  if (req.role === 'viewer') throw fail(403, 'Viewers cannot upload images.');
  if (!req.file) throw fail(400, 'Choose a PNG, JPG, WebP, or GIF image up to 4 MB.');
  const assetId = await saveImage(req.board.id, req.file);
  res.json({ assetId, src: `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` });
});
app.get('/api/boards/:id/assets/:assetId', async (req, res) => {
  const image = await loadImage(req.board.id, req.params.assetId);
  res.set('Cache-Control', 'private, max-age=3600').type(image.mime).send(image.buffer);
});
app.post('/api/boards/:id/ai', rateLimit({ windowMs: 60000, limit: 12 }), async (req, res) => {
  if (req.role === 'viewer' && req.body.action !== 'summary') throw fail(403, 'Viewers cannot modify the board.');
  const ids = Array.isArray(req.body.selected) ? req.body.selected : [];
  const elements = req.body.action === 'edit' ? req.board.elements.filter(e => ids.includes(e.id)) : req.board.elements;
  res.json(await generate(req.body.action, String(req.body.prompt || '').slice(0, 4000), elements, req.body.count));
});

const queues = new Map();
function enqueue(id, task) { const work = (queues.get(id) || Promise.resolve()).catch(() => {}).then(task); queues.set(id, work); work.finally(() => { if (queues.get(id) === work) queues.delete(id); }).catch(() => {}); return work; }
const presence = new Map();
io.use(async (socket, next) => { try { socket.user = await userFromToken(socket.handshake.auth.token); next(); } catch { next(new Error('Please sign in again.')); } });
function broadcastPresence(id) { io.to(id).emit('presence', [...presence.values()].filter(p => p.boardId === id)); }
io.on('connection', socket => {
  socket.on('join', async (id, ack) => { try {
    const board = await store.get('boards', id); if (!board || !roleFor(board, socket.user)) throw new Error('Access denied');
    if (socket.boardId) { socket.leave(socket.boardId); presence.delete(socket.id); broadcastPresence(socket.boardId); }
    socket.boardId = id; socket.join(id);
    presence.set(socket.id, { id: socket.id, boardId: id, name: socket.user.name, color: ['#2d7156', '#d97706', '#7c3aed', '#0284c7'][Math.floor(Math.random() * 4)] });
    broadcastPresence(id); ack?.({ board: { ...board, role: roleFor(board, socket.user) } });
  } catch (e) { ack?.({ error: e.message }); } });
  socket.on('cursor', point => { if (socket.boardId && Number.isFinite(point?.x) && Number.isFinite(point?.y)) socket.to(socket.boardId).emit('cursor', { ...presence.get(socket.id), x: point.x, y: point.y }); });
  socket.on('operations', (data, ack) => {
    const id = socket.boardId;
    if (!id) return ack?.({ error: 'Board is not connected' });
    enqueue(id, async () => {
      const board = await store.get('boards', id);
      if (!board || !['owner', 'editor'].includes(roleFor(board, socket.user))) throw new Error('Editing access denied');
      if (!Array.isArray(data.upsert) || !Array.isArray(data.remove) || data.upsert.length > 1000) throw new Error('Invalid operation');
      const removed = new Set(data.remove);
      const elements = new Map(board.elements.filter(e => !removed.has(e.id)).map(e => [e.id, e]));
      for (const element of data.upsert) {
        if (!element || typeof element.id !== 'string' || !['sticky', 'text', 'rect', 'ellipse', 'diamond', 'line', 'arrow', 'pen', 'image', 'emoji', 'chart'].includes(element.type) || !Number.isFinite(element.x) || !Number.isFinite(element.y)) throw new Error('Invalid element');
        elements.set(element.id, element);
      }
      if (elements.size > 1500) throw new Error('Board limit is 1,500 elements');
      board.elements = [...elements.values()]; board.revision++; board.updatedAt = Date.now();
      await store.put('boards', board);
      socket.to(id).emit('operations', { ...data, revision: board.revision }); ack?.({ ok: true, revision: board.revision });
    }).catch(e => ack?.({ error: e.message }));
  });
  socket.on('disconnect', () => { presence.delete(socket.id); if (socket.boardId) { io.to(socket.boardId).emit('cursor-left', socket.id); broadcastPresence(socket.boardId); } });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
if (process.argv.includes('--production')) {
  app.use(express.static(path.resolve('dist')));
  app.get('/{*splat}', (_, res) => res.sendFile(path.resolve('dist/index.html')));
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({ server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
  app.use(vite.middlewares);
}
app.use((error, req, res, next) => { console.error(error.message); res.status(error.status || (error.code === 'LIMIT_FILE_SIZE' ? 413 : 500)).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Image must be smaller than 4 MB.' : error.status ? error.message : 'Something went wrong. Please try again.' }); });
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log(`Sketchter is ready at http://localhost:${process.env.PORT || 3000}`));
