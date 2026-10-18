import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const API = 'https://api.groq.com/openai/v1';
const MAX_PROMPT = 800;
const MAX_CODE = 12000;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MODEL_TTL_MS = 6 * 60 * 60 * 1000;
const PREFERRED = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'qwen/qwen3-32b'];
const EXCLUDE = /whisper|guard|safeguard|tts|embed|vision|compound|orpheus|playai|distil/i;

// In-memory per instance. Cukup untuk membatasi penyalahgunaan ringan.
const hits = globalThis.__renderizerAiHits ?? (globalThis.__renderizerAiHits = new Map());
let modelCache = { id: null, at: 0 };

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 1000) {
    for (const [key, list] of hits) {
      if (!list.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(key);
    }
  }
  return false;
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

// Model dipilih otomatis dari daftar model akun Groq, kecuali GROQ_MODEL diisi.
async function pickModel(apiKey) {
  if (process.env.GROQ_MODEL) return process.env.GROQ_MODEL;
  if (modelCache.id && Date.now() - modelCache.at < MODEL_TTL_MS) return modelCache.id;

  const res = await fetch(`${API}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`DAFTAR MODEL GROQ GAGAL (STATUS ${res.status}). PERIKSA GROQ_API_KEY.`);

  const data = await res.json();
  const ids = (data.data || [])
    .map((m) => m.id)
    .filter((id) => typeof id === 'string' && !EXCLUDE.test(id));
  const id =
    PREFERRED.find((p) => ids.includes(p)) ||
    ids.find((i) => /llama|gpt-oss|qwen|kimi|mixtral/i.test(i)) ||
    ids[0];
  if (!id) throw new Error('TIDAK ADA MODEL TEKS YANG TERSEDIA DI AKUN GROQ.');

  modelCache = { id, at: Date.now() };
  return id;
}

function buildSystem(width, height, duration) {
  return [
    'Kamu adalah generator motion graphic berbasis HTML dan CSS.',
    'Keluarkan HANYA satu dokumen HTML lengkap, mulai dari <!DOCTYPE html> dan berakhir di </html>. Tanpa penjelasan, tanpa markdown, tanpa code fence.',
    `Kanvas video berukuran ${width}x${height} piksel dan berdurasi ${duration} detik.`,
    'Aturan teknis:',
    '- Animasi HANYA memakai CSS @keyframes. Jangan pakai JavaScript, jangan pakai tag <script>.',
    '- Setiap frame dipotret oleh html2canvas, jadi pakai transform, opacity, warna, border-radius, linear-gradient, radial-gradient, box-shadow, dan text-shadow.',
    '- Hindari: backdrop-filter, mix-blend-mode, filter blur berat, conic-gradient, transform 3D atau perspective, filter SVG, gambar eksternal, font eksternal.',
    '- Font hanya font sistem: "Arial Black", Arial, Georgia, "Courier New".',
    '- html dan body: width 100%, height 100%, margin 0, overflow hidden. Posisikan elemen dengan position absolute dan satuan vw, vh, vmin supaya skalanya mengikuti resolusi.',
    `- Buat animasi berulang mulus: animation-duration harus pembagi dari ${duration} detik, pakai infinite dan animation-fill-mode both. Pakai animation-delay untuk mengatur urutan.`,
    '- Kode ringkas, kurang dari 120 baris, dengan warna kontras tinggi dan komposisi yang bersih.',
  ].join('\n');
}

function extractHtml(text) {
  let html = String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
  const fenced = html.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenced) html = fenced[1].trim();
  const start = html.search(/<!doctype html|<html/i);
  if (start > 0) html = html.slice(start);
  // Preview berjalan same-origin; skrip hasil AI dibuang demi keamanan.
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').trim();
}

export async function GET() {
  return NextResponse.json({
    enabled: Boolean(process.env.GROQ_API_KEY),
    needsCode: Boolean(process.env.APP_ACCESS_CODE),
  });
}

export async function POST(request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI BELUM AKTIF: GROQ_API_KEY BELUM DIISI DI VERCEL.' }, { status: 503 });
  }

  const accessCode = process.env.APP_ACCESS_CODE;
  if (accessCode && request.headers.get('x-access-code') !== accessCode) {
    return NextResponse.json({ error: 'KODE AKSES SALAH ATAU KOSONG.' }, { status: 401 });
  }

  const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'TERLALU BANYAK PERMINTAAN. TUNGGU BEBERAPA MENIT.' }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON tidak valid.' }, { status: 400 });
  }

  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (prompt.length < 3 || prompt.length > MAX_PROMPT) {
    return NextResponse.json({ error: `Deskripsi harus 3 sampai ${MAX_PROMPT} karakter.` }, { status: 400 });
  }

  const currentCode = typeof body?.currentCode === 'string' ? body.currentCode : '';
  if (currentCode.length > MAX_CODE) {
    return NextResponse.json(
      { error: 'KODE TERLALU PANJANG UNTUK DIEDIT AI GRATIS. PAKAI "BUAT MOTION" ATAU PERSINGKAT KODE.' },
      { status: 413 },
    );
  }

  const width = clampInt(body?.width, 64, 1920, 1280);
  const height = clampInt(body?.height, 64, 1920, 720);
  const duration = clampInt(body?.duration, 1, 90, 5);

  const userMessage =
    body?.mode === 'edit' && currentCode.trim()
      ? `Kode HTML saat ini:\n\n${currentCode}\n\nUbah sesuai permintaan berikut, lalu keluarkan dokumen HTML lengkap yang sudah diperbarui:\n${prompt}`
      : `Buat motion graphic berikut:\n${prompt}`;

  let model;
  try {
    model = await pickModel(apiKey);
  } catch (err) {
    return NextResponse.json({ error: err.message || 'GAGAL MEMILIH MODEL GROQ.' }, { status: 502 });
  }

  const payload = {
    model,
    messages: [
      { role: 'system', content: buildSystem(width, height, duration) },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_completion_tokens: 3500,
  };
  if (/gpt-oss/i.test(model)) payload.reasoning_effort = 'low';

  let upstream;
  try {
    upstream = await fetch(`${API}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(55000),
    });
  } catch {
    return NextResponse.json({ error: 'AI TIDAK MERESPONS (TIMEOUT). COBA DESKRIPSI LEBIH SEDERHANA.' }, { status: 504 });
  }

  const data = await upstream.json().catch(() => null);
  if (!upstream.ok || !data) {
    if (upstream.status === 429) {
      return NextResponse.json({ error: 'BATAS GRATIS GROQ TERCAPAI. TUNGGU SEKITAR 1 MENIT LALU COBA LAGI.' }, { status: 429 });
    }
    if (upstream.status === 401) {
      return NextResponse.json({ error: 'GROQ_API_KEY SALAH ATAU SUDAH TIDAK BERLAKU.' }, { status: 502 });
    }
    if (upstream.status === 400 || upstream.status === 404) modelCache = { id: null, at: 0 };
    const detail = data?.error?.message ? String(data.error.message).slice(0, 200) : `STATUS ${upstream.status}`;
    return NextResponse.json({ error: `AI GAGAL: ${detail}` }, { status: 502 });
  }

  const choice = data.choices && data.choices[0];
  if (choice && choice.finish_reason === 'length') {
    return NextResponse.json({ error: 'HASIL TERPOTONG KARENA TERLALU PANJANG. COBA DESKRIPSI LEBIH SEDERHANA.' }, { status: 422 });
  }

  const html = extractHtml(choice && choice.message && choice.message.content);
  if (html.length < 30 || !/<\w+/.test(html)) {
    return NextResponse.json({ error: 'AI tidak menghasilkan kode HTML yang valid. Coba lagi.' }, { status: 502 });
  }

  return NextResponse.json({ code: html });
}
