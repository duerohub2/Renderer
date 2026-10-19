'use client';

import { useEffect, useRef, useState } from 'react';
import Editor from './Editor';
import Preview from './Preview';
import AiPanel from './AiPanel';
import AudioPanel from './AudioPanel';
import ProjectBar from './ProjectBar';
import Settings from './Settings';
import ProgressModal from './ProgressModal';
import ResultPanel from './ResultPanel';
import { renderVideo, normalizeSettings, isWebCodecsSupported } from '../lib/renderer';
import { DEMO_HTML } from '../lib/demos';
import { createProject, loadProjects, saveProjects, MAX_PROJECTS } from '../lib/projects';
import { saveAudio, loadAudio, removeAudio, copyAudio } from '../lib/storage';
import { decodeAudioFile } from '../lib/audio';

const DEFAULT_SETTINGS = {
  width: 1280,
  height: 720,
  duration: 5,
  fps: 30,
  format: 'mp4',
  bitrate: 5_000_000,
  background: '#ffffff',
  speed: 1,
  virtualTime: false,
  audioVolume: 1,
  audioStart: 0,
  audioLoop: true,
  audioFade: false,
};
const WEBCODECS_MESSAGE = 'Browser tidak support WebCodecs. Pakai Chrome/Edge/Safari 16.4+';
const TABS = [
  { id: 'editor', label: 'KODE' },
  { id: 'ai', label: 'AI' },
  { id: 'preview', label: 'PREVIEW' },
  { id: 'settings', label: 'ATUR' },
  { id: 'result', label: 'HASIL' },
];

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
  const [tab, setTab] = useState('editor');
  const [undoCode, setUndoCode] = useState(null);
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [audio, setAudio] = useState(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioError, setAudioError] = useState('');
  const abortRef = useRef(null);
  const activeIdRef = useRef('');
  const audioBufferRef = useRef(null);
  const audioUrlRef = useRef('');

  const rendering = status === 'rendering';
  const hasResult = status === 'done' && Boolean(result);
  const panel = (name) => `tab-panel ${tab === name ? 'is-active' : ''}`;

  const clearAudio = () => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = '';
    audioBufferRef.current = null;
    setAudio(null);
  };

  const restoreAudio = async (id) => {
    clearAudio();
    try {
      const record = await loadAudio(id);
      if (!record || !record.blob) return;
      const buffer = await decodeAudioFile(record.blob);
      if (activeIdRef.current !== id) return;
      const url = URL.createObjectURL(record.blob);
      audioBufferRef.current = buffer;
      audioUrlRef.current = url;
      setAudio({ name: record.name, size: record.blob.size, duration: buffer.duration, url });
    } catch {
      /* audio tersimpan tidak bisa dibaca, abaikan */
    }
  };

  useEffect(() => {
    setUnsupported(!isWebCodecsSupported());
    const loaded = loadProjects(DEFAULT_SETTINGS);
    const active = loaded.items.find((p) => p.id === loaded.activeId) || loaded.items[0];
    activeIdRef.current = active.id;
    setProjects(loaded.items);
    setActiveId(active.id);
    setCode(active.code);
    setPreviewCode(active.code);
    setSettings(normalizeSettings({ ...DEFAULT_SETTINGS, ...active.settings }));
    setHydrated(true);
    restoreAudio(active.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simpan kode dan pengaturan ke proyek aktif, lalu tulis semua proyek ke browser.
  useEffect(() => {
    if (!hydrated || !activeId) return;
    setProjects((prev) =>
      prev.map((p) => (p.id === activeId ? { ...p, code: previewCode, settings } : p)),
    );
  }, [previewCode, settings, activeId, hydrated]);

  useEffect(() => {
    if (!hydrated || !activeId) return;
    saveProjects(projects, activeId);
  }, [projects, activeId, hydrated]);

  useEffect(() => {
    const timer = setTimeout(() => setPreviewCode(code), 400);
    return () => clearTimeout(timer);
  }, [code]);

  const releaseResult = () => {
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
  };

  const openProject = (project) => {
    activeIdRef.current = project.id;
    setActiveId(project.id);
    setCode(project.code);
    setPreviewCode(project.code);
    setSettings(normalizeSettings({ ...DEFAULT_SETTINGS, ...project.settings }));
    setUndoCode(null);
    setAudioError('');
    releaseResult();
    setError('');
    setStatus('idle');
    restoreAudio(project.id);
  };

  const commitCurrent = (list) =>
    list.map((p) => (p.id === activeId ? { ...p, code, settings, updatedAt: Date.now() } : p));

  const handleSwitchProject = (id) => {
    if (id === activeId || rendering) return;
    const list = commitCurrent(projects);
    const target = list.find((p) => p.id === id);
    if (!target) return;
    setProjects(list);
    openProject(target);
  };

  const handleNewProject = () => {
    if (projects.length >= MAX_PROJECTS) {
      setError(`BATAS ${MAX_PROJECTS} PROYEK TERCAPAI. HAPUS PROYEK YANG TIDAK DIPAKAI.`);
      return;
    }
    const project = createProject(`Proyek ${projects.length + 1}`, '', DEFAULT_SETTINGS);
    setProjects([...commitCurrent(projects), project]);
    openProject(project);
  };

  const handleDuplicateProject = async () => {
    if (projects.length >= MAX_PROJECTS) {
      setError(`BATAS ${MAX_PROJECTS} PROYEK TERCAPAI. HAPUS PROYEK YANG TIDAK DIPAKAI.`);
      return;
    }
    const current = projects.find((p) => p.id === activeId);
    const copy = createProject(`${current ? current.name : 'Proyek'} (salinan)`, code, settings);
    await copyAudio(activeId, copy.id).catch(() => {});
    setProjects([...commitCurrent(projects), copy]);
    openProject(copy);
  };

  const handleRenameProject = () => {
    const current = projects.find((p) => p.id === activeId);
    if (!current) return;
    const name = window.prompt('NAMA PROYEK', current.name);
    if (name === null) return;
    const trimmed = name.trim().slice(0, 40);
    if (!trimmed) return;
    setProjects(projects.map((p) => (p.id === activeId ? { ...p, name: trimmed } : p)));
  };

  const handleDeleteProject = () => {
    const current = projects.find((p) => p.id === activeId);
    if (!current) return;
    if (!window.confirm(`HAPUS PROYEK "${current.name}"? KODE DAN AUDIO-NYA IKUT TERHAPUS.`)) return;

    removeAudio(activeId).catch(() => {});
    const remaining = projects.filter((p) => p.id !== activeId);
    if (remaining.length === 0) {
      const fresh = createProject('Proyek 1', '', DEFAULT_SETTINGS);
      setProjects([fresh]);
      openProject(fresh);
      return;
    }
    setProjects(remaining);
    openProject(remaining[0]);
  };

  const handlePickAudio = async (file) => {
    setAudioError('');
    setAudioBusy(true);
    try {
      const buffer = await decodeAudioFile(file);
      clearAudio();
      const url = URL.createObjectURL(file);
      audioBufferRef.current = buffer;
      audioUrlRef.current = url;
      setAudio({ name: file.name, size: file.size, duration: buffer.duration, url });
      saveAudio(activeId, { name: file.name, blob: file }).catch(() => {});
    } catch (err) {
      setAudioError((err && err.message) || 'GAGAL MEMBACA AUDIO.');
    } finally {
      setAudioBusy(false);
    }
  };

  const handleRemoveAudio = () => {
    clearAudio();
    setAudioError('');
    removeAudio(activeId).catch(() => {});
  };

  const handleApplyAi = (newCode) => {
    setUndoCode(code);
    setCode(newCode);
    setPreviewCode(newCode);
    setTab('preview');
  };

  const handleUndoAi = () => {
    if (undoCode === null) return;
    setCode(undoCode);
    setPreviewCode(undoCode);
    setUndoCode(null);
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

    const audioInput =
      audio && audioBufferRef.current
        ? {
            buffer: audioBufferRef.current,
            startAt: config.audioStart,
            volume: config.audioVolume,
            fade: config.audioFade,
            loop: config.audioLoop,
          }
        : null;

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
        audio: audioInput,
        signal: controller.signal,
        onProgress: setProgress,
      });
      setResult(output);
      setStatus('done');
      setTab('result');

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
    setTab('settings');
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

      <ProjectBar
        projects={projects}
        activeId={activeId}
        onSwitch={handleSwitchProject}
        onNew={handleNewProject}
        onDuplicate={handleDuplicateProject}
        onRename={handleRenameProject}
        onDelete={handleDeleteProject}
        disabled={rendering}
      />

      {unsupported && (
        <div className="panel notice" role="alert">
          {WEBCODECS_MESSAGE}
        </div>
      )}

      <div className="grid-two">
        <div className={panel('editor')}>
          <Editor code={code} onChange={setCode} onLoadDemo={() => setCode(DEMO_HTML)} disabled={rendering} />
        </div>
        <div className={panel('preview')}>
          <Preview code={previewCode} width={settings.width} height={settings.height} duration={settings.duration} />
        </div>
      </div>

      <div className={panel('ai')}>
        <AiPanel
          currentCode={code}
          settings={settings}
          onApply={handleApplyAi}
          canUndo={undoCode !== null}
          onUndo={handleUndoAi}
          disabled={rendering}
        />
      </div>

      <div className={panel('settings')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <AudioPanel
            audio={audio}
            busy={audioBusy}
            error={audioError}
            settings={settings}
            onChange={setSettings}
            onPick={handlePickAudio}
            onRemove={handleRemoveAudio}
            disabled={rendering}
          />
          <Settings
            settings={settings}
            onChange={setSettings}
            onRender={handleRender}
            disabled={rendering}
            blocked={unsupported}
          />
        </div>
      </div>

      {error && (
        <div className="panel notice notice-error" role="alert">
          GAGAL: {error}
        </div>
      )}

      {hasResult && (
        <div className={panel('result')}>
          <ResultPanel result={result} onDownload={handleDownload} onReset={handleReset} />
        </div>
      )}

      {rendering && <ProgressModal progress={progress} onCancel={handleCancel} />}

      <nav className="tabbar" aria-label="NAVIGASI">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tab ${tab === item.id ? 'is-active' : ''}`}
            disabled={item.id === 'result' && !hasResult}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </main>
  );
}
