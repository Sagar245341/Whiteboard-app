import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';
import * as store from './store.js';
let secret;
const authUrl = process.env.VITE_NEON_AUTH_URL;
const jwksUrl = process.env.NEON_AUTH_JWKS_URL || (authUrl ? `${authUrl.replace(/\/$/, '')}/.well-known/jwks.json` : null);
const remote = jwksUrl ? createRemoteJWKSet(new URL(jwksUrl)) : null;
export async function initAuth() {
  let key = process.env.JWT_SECRET;
  if (!key) {
    const directory = process.env.DATA_DIR || 'data';
    await fs.mkdir(directory, { recursive: true });
    try { key = await fs.readFile(path.join(directory, '.secret'), 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; key = randomBytes(48).toString('hex'); await fs.writeFile(path.join(directory, '.secret'), key); }
  }
  secret = new TextEncoder().encode(key);
}
export function passwordHash(password) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
export function checkPassword(password, hash) { const [salt, value] = hash.split(':'); return timingSafeEqual(Buffer.from(value, 'hex'), scryptSync(password, salt, 64)); }
export function tokenFor(user) { return new SignJWT({ name: user.name, email: user.email }).setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setIssuedAt().setExpirationTime('7d').sign(secret); }
export async function userFromToken(token) {
  if (!token) throw new Error('Sign in to continue');
  let payload;
  try { ({ payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })); }
  catch (error) {
    if (!remote) throw error;
    ({ payload } = await jwtVerify(token, remote, { issuer: process.env.NEON_AUTH_ISSUER || new URL(jwksUrl).origin, ...(process.env.NEON_AUTH_AUDIENCE && { audience: process.env.NEON_AUTH_AUDIENCE }) }));
  }
  let user = await store.get('users', payload.sub);
  if (!user && payload.email) { user = { id: payload.sub, email: payload.email.toLowerCase(), name: payload.name || payload.email.split('@')[0] }; await store.put('users', user); }
  if (!user) throw new Error('User not found');
  return { id: user.id, name: user.name, email: user.email };
}
export async function auth(req, res, next) { try { req.user = await userFromToken(req.headers.authorization?.replace(/^Bearer /, '')); next(); } catch { res.status(401).json({ error: 'Your session expired. Please sign in again.' }); } }
export function roleFor(board, user) { return board.ownerId === user.id ? 'owner' : board.members.find(m => m.email === user.email)?.role || null; }
