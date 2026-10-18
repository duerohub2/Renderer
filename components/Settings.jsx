'use client';

import { normalizeSettings } from '../lib/renderer';

const FIELDS = [
  { key: 'width', label: 'LEBAR (PX)', min: 64, max: 1920, step: 2 },
  { key: 'height', label: 'TINGGI (PX)', min: 64, max: 1920, step: 2 },
  { key: 'duration', label: 'DURASI (DETIK)', min: 1, max: 90, step: 1 },
  { key: 'fps', label: 'FPS', min: 12, max: 60, step: 1 },
];

const RATIOS = [
  { label: '16:9', w: 16, h: 9 },
  { label: '9:16', w: 9, h: 16 },
  { label: '4:3', w: 4, h: 3 },
  { label: '3:4', w: 3, h: 4 },
  { label: '1:1', w: 1, h: 1 },
];

// P = sisi terpendek video. 1080P pada 9:16 menghasilkan 1080x1920.
const TIERS = [
  { label: '360P', side: 360 },
  { label: '720P', side: 720 },
  { label: '1080P', side: 1080 },
];

function dimsFor(ratio, side) {
  const long = Math.round((side * Math.max(ratio.w, ratio.h)) / Math.min(ratio.w, ratio.h) / 2) * 2;
  return ratio.w >= ratio.h ? { width: long, height: side } : { width: side, height: long };
}

export default function Settings({ settings, onChange, onRender, disabled, blocked }) {
  const set = (key, value) => onChange({ ...settings, [key]: value });
  const commit = () => onChange(normalizeSettings(settings));
  const totalFrames = (Number(settings.duration) || 0) * (Number(settings.fps) || 0);
  const estimatedMb = (((Number(settings.bitrate) || 5000000) * (Number(settings.duration) || 0)) / 8 / 1024 / 1024).toFixed(1);

  const w = Number(settings.width) || 0;
  const h = Number(settings.height) || 0;
  const activeRatio = w > 0 && h > 0 ? RATIOS.find((r) => Math.abs(w / h - r.w / r.h) < 0.01) : undefined;
  const activeTier = TIERS.find((t) => t.side === Math.min(w, h));

  const applyRatio = (ratio) => {
    const side = activeTier ? activeTier.side : 720;
    onChange(normalizeSettings({ ...settings, ...dimsFor(ratio, side) }));
  };
  const applyTier = (tier) => {
    const ratio = activeRatio || RATIOS[0];
    onChange(normalizeSettings({ ...settings, ...dimsFor(ratio, tier.side) }));
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">PENGATURAN RENDER</h2>
        <span className="tag tag-mint">{totalFrames} FRAME</span>
      </div>
      <div className="panel-body">
        <div className="field">
          <span className="label">RASIO VIDEO</span>
          <div className="btn-row">
            {RATIOS.map((ratio) => (
              <button
                key={ratio.label}
                type="button"
                className={`btn btn-small btn-toggle ${activeRatio && activeRatio.label === ratio.label ? 'is-active' : ''}`}
                aria-pressed={Boolean(activeRatio && activeRatio.label === ratio.label)}
                disabled={disabled}
                onClick={() => applyRatio(ratio)}
              >
                {ratio.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label">RESOLUSI</span>
          <div className="btn-row">
            {TIERS.map((tier) => (
              <button
                key={tier.label}
                type="button"
                className={`btn btn-small btn-toggle ${activeTier && activeTier.side === tier.side ? 'is-active' : ''}`}
                aria-pressed={Boolean(activeTier && activeTier.side === tier.side)}
                disabled={disabled}
                onClick={() => applyTier(tier)}
              >
                {tier.label}
              </button>
            ))}
          </div>
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
