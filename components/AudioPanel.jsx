'use client';

import { useRef } from 'react';
import { normalizeSettings } from '../lib/renderer';

function formatTime(seconds) {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function AudioPanel({ audio, busy, error, settings, onChange, onPick, onRemove, disabled }) {
  const fileRef = useRef(null);
  const set = (key, value) => onChange({ ...settings, [key]: value });
  const commit = () => onChange(normalizeSettings(settings));

  const handleFile = (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) onPick(file);
    event.target.value = '';
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">MUSIK / AUDIO</h2>
        <span className="tag tag-mint">{audio ? 'AKTIF' : 'OPSIONAL'}</span>
      </div>
      <div className="panel-body">
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-blue"
            onClick={() => fileRef.current && fileRef.current.click()}
            disabled={disabled || busy}
          >
            {busy ? 'MEMBACA...' : audio ? 'GANTI AUDIO' : 'PILIH AUDIO'}
          </button>
          {audio && (
            <button type="button" className="btn btn-pink" onClick={onRemove} disabled={disabled || busy}>
              HAPUS AUDIO
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
            onChange={handleFile}
            hidden
          />
        </div>

        {audio && (
          <>
            <p className="hint">
              {audio.name} ({formatTime(audio.duration)}, {(audio.size / 1024 / 1024).toFixed(1)} MB)
            </p>
            <audio controls src={audio.url} style={{ width: '100%' }} />

            <div className="field-grid">
              <label className="field">
                <span className="label">VOLUME</span>
                <select
                  className="input"
                  value={settings.audioVolume}
                  disabled={disabled}
                  onChange={(e) => set('audioVolume', Number(e.target.value))}
                >
                  <option value={0.5}>50%</option>
                  <option value={1}>100%</option>
                  <option value={1.5}>150%</option>
                </select>
              </label>
              <label className="field">
                <span className="label">MULAI DARI DETIK</span>
                <input
                  type="number"
                  className="input"
                  min={0}
                  max={3600}
                  step={0.5}
                  value={settings.audioStart}
                  disabled={disabled}
                  onChange={(e) => set('audioStart', e.target.value === '' ? '' : Number(e.target.value))}
                  onBlur={commit}
                />
              </label>
              <label className="field">
                <span className="label">ULANG JIKA LEBIH PENDEK</span>
                <input
                  type="checkbox"
                  className="input-check"
                  checked={Boolean(settings.audioLoop)}
                  disabled={disabled}
                  onChange={(e) => set('audioLoop', e.target.checked)}
                />
              </label>
              <label className="field">
                <span className="label">FADE IN DAN OUT</span>
                <input
                  type="checkbox"
                  className="input-check"
                  checked={Boolean(settings.audioFade)}
                  disabled={disabled}
                  onChange={(e) => set('audioFade', e.target.checked)}
                />
              </label>
            </div>
          </>
        )}

        {error && <p className="warn">{error}</p>}
        <p className="hint">
          MP3, WAV, M4A, OGG. MAKS. 25 MB DAN 5 MENIT. PAKAI MUSIK MILIKMU SENDIRI ATAU YANG BEBAS HAK CIPTA.
        </p>
      </div>
    </section>
  );
}
