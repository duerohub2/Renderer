'use client';

export default function ResultPanel({ result, onDownload, onReset }) {
  const sizeMb = (result.size / 1024 / 1024).toFixed(2);
  const label = result.format.toUpperCase();

  return (
    <section className="panel result-panel">
      <div className="panel-head">
        <h2 className="panel-title">HASIL RENDER</h2>
        <span className="tag tag-mint">SELESAI</span>
      </div>
      <div className="panel-body">
        <video className="result-video" src={result.url} controls playsInline />
        <dl className="info-grid">
          <div><dt>RESOLUSI</dt><dd>{result.width}x{result.height}</dd></div>
          <div><dt>DURASI</dt><dd>{result.duration} DETIK</dd></div>
          <div><dt>FPS</dt><dd>{result.fps}</dd></div>
          <div><dt>FORMAT</dt><dd>{label}</dd></div>
          <div><dt>UKURAN</dt><dd>{sizeMb} MB</dd></div>
        </dl>
        <div className="btn-row">
          <button type="button" className="btn btn-yellow btn-big" onClick={onDownload}>
            DOWNLOAD {label}
          </button>
          <button type="button" className="btn btn-big" onClick={onReset}>
            RENDER ULANG
          </button>
        </div>
      </div>
    </section>
  );
}
