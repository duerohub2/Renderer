'use client';

import { useEffect, useRef, useState } from 'react';
import Editor from './Editor';
import Preview from './Preview';
import Settings from './Settings';
import ProgressModal from './ProgressModal';
import ResultPanel from './ResultPanel';
import { renderVideo, normalizeSettings, isWebCodecsSupported } from '../lib/renderer';
import { DEMO_HTML } from '../lib/demos';

const DEFAULT_SETTINGS = {
  width: 1280,
  height: 720,
  duration: 5,
  fps: 30,
  format: 'mp4',
  bitrate: 5_000_000,
  background: '#ffffff',
};
const STORAGE_KEY = 'renderizer:v1';
const WEBCODECS_MESSAGE = 'Browser tidak support WebCodecs. Pakai Chrome/Edge/Safari 16.4+';

export default function RenderStudio() {
  const [code, setCode] = useState('');
  const [previewCode, setPreviewCode] = useState('');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState({ phase: 'prepare', current: 0, total: 0, etaMs: null });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [unsupported, setUnsupported] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    setUnsupported(!isWebCodecsSupported());
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved) {
        if (typeof saved.code === 'string') {
          setCode(saved.code);
          setPreviewCode(saved.code);
        }
        if (saved.settings) setSettings(normalizeSettings({ ...DEFAULT_SETTINGS, ...saved.settings }));
      }
    } catch {
      /* storage tidak tersedia */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, settings }));
    } catch {
      /* kuota penuh atau storage diblokir */
    }
  }, [code, settings, hydrated]);

  useEffect(() => {
    const timer = setTimeout(() => setPreviewCode(code), 400);
    return () => clearTimeout(timer);
  }, [code]);

  const rendering = status === 'rendering';

  const releaseResult = () => {
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
  };

  const handleRender = async () => {
    if (rendering) return;
    if (!code.trim()) {
      setError('KODE KOSONG. PASTE, UPLOAD, ATAU LOAD DEMO DULU.');
      return;
    }

    const config = normalizeSettings(settings);
    setSettings(config);
    releaseResult();
    setError('');
    setStatus('rendering');
    setProgress({ phase: 'prepare', current: 0, total: config.duration * config.fps, etaMs: null });

    const controller = new AbortController();
    abortRef.current = controller;

    let wakeLock = null;
    try {
      if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      /* wake lock ditolak, lanjut tanpa */
    }
    const warnBeforeLeave = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeave);

    try {
      const output = await renderVideo({
        code,
        ...config,
        signal: controller.signal,
        onProgress: setProgress,
      });
      setResult(output);
      setStatus('done');

      fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          width: output.width,
          height: output.height,
          duration: output.duration,
          fps: output.fps,
          format: output.format,
          sizeBytes: output.size,
        }),
      }).catch(() => {});
    } catch (err) {
      setStatus('idle');
      if (err && err.name !== 'AbortError') {
        setError(err.message || 'RENDER GAGAL.');
      }
    } finally {
      abortRef.current = null;
      window.removeEventListener('beforeunload', warnBeforeLeave);
      if (wakeLock) wakeLock.release().catch(() => {});
    }
  };

  const handleCancel = () => {
    if (abortRef.current) abortRef.current.abort();
  };

  const handleDownload = () => {
    if (!result) return;
    const link = document.createElement('a');
    link.href = result.url;
    link.download = `renderizer-${result.width}x${result.height}-${result.fps}fps.${result.extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleReset = () => {
    releaseResult();
    setError('');
    setStatus('idle');
  };

  return (
    <main className="studio">
      <header className="panel topbar">
        <div>
          <h1 className="brand">RENDERIZER</h1>
          <p className="brand-sub">RENDER HTML/CSS/JS JADI VIDEO LANGSUNG DI BROWSER</p>
        </div>
        <span className="tag tag-red">100% CLIENT-SIDE</span>
      </header>

      {unsupported && (
        <div className="panel notice" role="alert">
          {WEBCODECS_MESSAGE}
        </div>
      )}

      <div className="grid-two">
        <Editor code={code} onChange={setCode} onLoadDemo={() => setCode(DEMO_HTML)} disabled={rendering} />
        <Preview code={previewCode} width={settings.width} height={settings.height} duration={settings.duration} />
      </div>

      <Settings
        settings={settings}
        onChange={setSettings}
        onRender={handleRender}
        disabled={rendering}
        blocked={unsupported}
      />

      {error && (
        <div className="panel notice notice-error" role="alert">
          GAGAL: {error}
        </div>
      )}

      {status === 'done' && result && (
        <ResultPanel result={result} onDownload={handleDownload} onReset={handleReset} />
      )}

      {rendering && <ProgressModal progress={progress} onCancel={handleCancel} />}
    </main>
  );
}
