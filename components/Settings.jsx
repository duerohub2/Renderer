'use client';

import { normalizeSettings } from '../lib/renderer';

const FIELDS = [
  { key: 'width', label: 'LEBAR (PX)', min: 64, max: 1920, step: 16 },
  { key: 'height', label: 'TINGGI (PX)', min: 64, max: 1080, step: 16 },
  { key: 'duration', label: 'DURASI (DETIK)', min: 1, max: 90, step: 1 },
  { key: 'fps', label: 'FPS', min: 12, max: 60, step: 1 },
];

const PRESETS = [
  { label: '360P', width: 640, height: 360 },
  { label: '720P', width: 1280, height: 720 },
  { label: '1080P', width: 1920, height: 1080 },
  { label: 'KOTAK', width: 1080, height: 1080 },
];

export default function Settings({ settings, onChange, onRender, disabled, blocked }) {
  const set = (key, value) => onChange({ ...settings, [key]: value });
  const commit = () => onChange(normalizeSettings(settings));
  const totalFrames = (Number(settings.duration) || 0) * (Number(settings.fps) || 0);
  const estimatedMb = (((Number(settings.bitrate) || 5000000) * (Number(settings.duration) || 0)) / 8 / 1024 / 1024).toFixed(1);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">PENGATURAN RENDER</h2>
        <span className="tag tag-mint">{totalFrames} FRAME</span>
      </div>
      <div className="panel-body">
        <div className="btn-row">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="btn btn-small"
              disabled={disabled}
              onClick={() => onChange(normalizeSettings({ ...settings, width: preset.width, height: preset.height }))}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="field-grid">
          {FIELDS.map((field) => (
            <label key={field.key} className="field">
              <span className="label">{field.label}</span>
              <input
                type="number"
                className="input"
                min={field.min}
                max={field.max}
                step={field.step}
                value={settings[field.key]}
                disabled={disabled}
                onChange={(e) => set(field.key, e.target.value === '' ? '' : Number(e.target.value))}
                onBlur={commit}
              />
            </label>
          ))}
          <div className="field">
            <span className="label">FORMAT</span>
            <div className="toggle-row">
              {['mp4', 'webm'].map((format) => (
                <button
                  key={format}
                  type="button"
                  className={`btn btn-toggle ${settings.format === format ? 'is-active' : ''}`}
                  aria-pressed={settings.format === format}
                  disabled={disabled}
                  onClick={() => set('format', format)}
                >
                  {format.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span className="label">KUALITAS</span>
            <select
              className="input"
              value={settings.bitrate}
              disabled={disabled}
              onChange={(e) => set('bitrate', Number(e.target.value))}
            >
              <option value={2500000}>HEMAT (2.5 MBPS)</option>
              <option value={5000000}>STANDAR (5 MBPS)</option>
              <option value={10000000}>TINGGI (10 MBPS)</option>
            </select>
          </label>
          <label className="field">
            <span className="label">WARNA LATAR</span>
            <input
              type="color"
              className="input input-color"
              value={settings.background}
              disabled={disabled}
              onChange={(e) => set('background', e.target.value)}
            />
          </label>
          <label className="field">
            <span className="label">KECEPATAN ANIMASI</span>
            <select
              className="input"
              value={settings.speed}
              disabled={disabled}
              onChange={(e) => set('speed', Number(e.target.value))}
            >
              <option value={0.25}>0.25X (SLOW MOTION)</option>
              <option value={0.5}>0.5X</option>
              <option value={1}>1X (NORMAL)</option>
              <option value={2}>2X</option>
              <option value={4}>4X (TIMELAPSE)</option>
            </select>
          </label>
          <label className="field">
            <span className="label">WAKTU VIRTUAL (JS / GSAP / RAF)</span>
            <input
              type="checkbox"
              className="input-check"
              checked={Boolean(settings.virtualTime)}
              disabled={disabled}
              onChange={(e) => set('virtualTime', e.target.checked)}
            />
            <span className="hint">AKTIFKAN JIKA ANIMASI MEMAKAI JAVASCRIPT (GSAP, REQUESTANIMATIONFRAME, SETTIMEOUT).</span>
          </label>
        </div>

        <p className="hint">ESTIMASI UKURAN: ~{estimatedMb} MB (MAKS. PADA BITRATE TERPILIH)</p>

        {totalFrames > 1800 && (
          <p className="warn">BEBAN BERAT: {totalFrames} FRAME. PROSES BISA MEMAKAN BEBERAPA MENIT DAN MEMORI BESAR.</p>
        )}

        <button type="button" className="btn btn-red btn-big" onClick={onRender} disabled={disabled || blocked}>
          {disabled ? 'SEDANG RENDER...' : 'RENDER VIDEO'}
        </button>
      </div>
    </section>
  );
}
