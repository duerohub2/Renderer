'use client';

function formatEta(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '--:--';
  const total = Math.max(0, Math.round(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export default function ProgressModal({ progress, onCancel }) {
  const { phase, current, total, etaMs } = progress;

  let status = 'MENYIAPKAN...';
  let percent = 0;
  if (phase === 'capture') {
    status = `CAPTURING ${current}/${total}`;
    percent = Math.min(100, Math.floor((current / total) * 100));
  } else if (phase === 'finalize') {
    status = 'FINALIZING...';
    percent = 100;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="PROGRESS RENDER">
      <div className="panel modal">
        <div className="panel-head">
          <h2 className="panel-title">SEDANG RENDER</h2>
          <span className="tag tag-yellow">{percent}%</span>
        </div>
        <div className="panel-body">
          <p className="status-line">{status}</p>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <div className="progress-meta">
            <span>SISA WAKTU: {phase === 'capture' ? formatEta(etaMs) : '--:--'}</span>
            <span>JANGAN PINDAH TAB (RENDER MELAMBAT)</span>
          </div>
          <button type="button" className="btn btn-pink" onClick={onCancel}>
            BATALKAN
          </button>
        </div>
      </div>
    </div>
  );
}
