'use client';

import { useEffect, useRef, useState } from 'react';

const IDEAS = [
  'Logo neon berputar dengan efek glow',
  'Hitung mundur 5 sampai 1 gaya bold',
  'Teks kinetik PROMO 50% muncul bergantian',
  'Gelombang gradient warna-warni bergerak',
];
const CODE_KEY = 'renderizer:ai-code';

export default function AiPanel({ currentCode, settings, onApply, canUndo, onUndo, disabled }) {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(null);
  const [accessCode, setAccessCode] = useState('');
  const abortRef = useRef(null);

  useEffect(() => {
    try {
      setAccessCode(localStorage.getItem(CODE_KEY) || '');
    } catch {
      /* storage diblokir */
    }
    fetch('/api/generate')
      .then((res) => res.json())
      .then(setInfo)
      .catch(() => setInfo({ enabled: false, needsCode: false }));
  }, []);

  const run = async (mode) => {
    if (busy) return;
    const text = prompt.trim();
    if (text.length < 3) {
      setError('TULIS DESKRIPSI MINIMAL 3 HURUF.');
      return;
    }
    setError('');
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 65000);

    try {
      try {
        localStorage.setItem(CODE_KEY, accessCode);
      } catch {
        /* abaikan */
      }
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-access-code': accessCode },
        body: JSON.stringify({
          prompt: text,
          mode,
          currentCode: mode === 'edit' ? currentCode : '',
          width: settings.width,
          height: settings.height,
          duration: settings.duration,
        }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `SERVER ERROR ${res.status}`);
      onApply(data.code);
    } catch (err) {
      if (err && err.name === 'AbortError') {
        setError('DIBATALKAN ATAU TERLALU LAMA. COBA DESKRIPSI LEBIH SEDERHANA.');
      } else {
        setError((err && err.message) || 'GAGAL MEMBUAT MOTION.');
      }
    } finally {
      clearTimeout(timer);
      abortRef.current = null;
      setBusy(false);
    }
  };

  const inactive = info && !info.enabled;
  const locked = disabled || busy || inactive;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">AI TEXT TO MOTION</h2>
        <span className="tag tag-pink">BETA</span>
      </div>
      <div className="panel-body">
        {inactive && (
          <p className="warn">AI BELUM AKTIF: ISI GROQ_API_KEY DI VERCEL (SETTINGS, ENVIRONMENT VARIABLES), LALU REDEPLOY.</p>
        )}

        <textarea
          className="prompt-area"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={800}
          placeholder="DESKRIPSIKAN MOTION YANG DIINGINKAN. CONTOH: LOGO NEON BERPUTAR DENGAN LATAR GELAP"
          disabled={locked}
        />

        <div className="chips">
          {IDEAS.map((idea) => (
            <button key={idea} type="button" className="btn btn-small" disabled={locked} onClick={() => setPrompt(idea)}>
              {idea}
            </button>
          ))}
        </div>

        {info && info.needsCode && (
          <label className="field">
            <span className="label">KODE AKSES</span>
            <input
              type="password"
              className="input"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              autoComplete="off"
              disabled={locked}
            />
          </label>
        )}

        <div className="btn-row">
          <button type="button" className="btn btn-red" onClick={() => run('new')} disabled={locked}>
            {busy ? 'MEMBUAT...' : 'BUAT MOTION'}
          </button>
          <button
            type="button"
            className="btn btn-blue"
            onClick={() => run('edit')}
            disabled={locked || !currentCode.trim()}
          >
            EDIT KODE SAAT INI
          </button>
          {busy && (
            <button type="button" className="btn btn-pink" onClick={() => abortRef.current && abortRef.current.abort()}>
              BATAL
            </button>
          )}
          {canUndo && !busy && (
            <button type="button" className="btn" onClick={onUndo} disabled={disabled}>
              KEMBALIKAN KODE SEBELUMNYA
            </button>
          )}
        </div>

        {error && <p className="warn">{error}</p>}
        <p className="hint">HASIL AI LANGSUNG MASUK KE EDITOR DAN PREVIEW. BIASANYA SELESAI DALAM 5 SAMPAI 20 DETIK.</p>
      </div>
    </section>
  );
}
