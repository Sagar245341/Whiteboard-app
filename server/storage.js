import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
const s3 = process.env.S3_ENDPOINT && process.env.S3_BUCKET ? new S3Client({ endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION || 'us-east-1', forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } }) : null;
const root = path.resolve(process.env.DATA_DIR || 'data', 'images');
export async function saveImage(boardId, file) {
  const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[file.mimetype];
  const assetId = `${randomUUID()}.${extension}`, key = `${boardId}/${assetId}`;
  if (s3) await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: file.buffer, ContentType: file.mimetype }));
  else { await fs.mkdir(path.join(root, boardId), { recursive: true }); await fs.writeFile(path.join(root, key), file.buffer); }
  return assetId;
}
export async function loadImage(boardId, assetId) {
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp|gif)$/.test(assetId)) throw Object.assign(new Error('Image not found.'), { status: 404 });
  const key = `${boardId}/${assetId}`, extension = assetId.split('.').pop(), mime = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }[extension];
  if (s3) { const result = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key })); return { mime, buffer: Buffer.from(await result.Body.transformToByteArray()) }; }
  return { mime, buffer: await fs.readFile(path.join(root, key)) };
}
