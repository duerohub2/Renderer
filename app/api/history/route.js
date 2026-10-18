import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

const MAX_ENTRIES = 200;
const FORMATS = new Set(['mp4', 'webm']);

// In-memory. Serverless Vercel tidak menjamin persistensi antar instance; ganti ke DB nanti.
const store = globalThis.__renderizerHistory ?? (globalThis.__renderizerHistory = []);

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export async function GET() {
  return NextResponse.json({ items: store, count: store.length });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON tidak valid' }, { status: 400 });
  }

  const numeric = {
    width: toNumber(body?.width),
    height: toNumber(body?.height),
    duration: toNumber(body?.duration),
    fps: toNumber(body?.fps),
    sizeBytes: toNumber(body?.sizeBytes),
  };

  if (Object.values(numeric).some((v) => v === null) || !FORMATS.has(body?.format)) {
    return NextResponse.json({ error: 'Metadata tidak lengkap atau tidak valid' }, { status: 400 });
  }

  const entry = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...numeric,
    format: body.format,
  };

  store.unshift(entry);
  if (store.length > MAX_ENTRIES) store.length = MAX_ENTRIES;

  return NextResponse.json(entry, { status: 201 });
}
