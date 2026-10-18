'use client';

import { useEffect, useRef, useState } from 'react';

export default function Preview({ code, width, height, duration }) {
  const stageRef = useRef(null);
  const frameRef = useRef(null);
  const [stageWidth, setStageWidth] = useState(0);
  const [seek, setSeek] = useState(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const update = () => setStageWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const applySeek = (value) => {
    const doc = frameRef.current && frameRef.current.contentDocument;
    if (!doc) return;
    let animations = [];
    try {
      animations = doc.getAnimations();
    } catch {
      return;
    }
    for (const animation of animations) {
      try {
        if (value === null) {
          animation.play();
        } else {
          animation.pause();
          animation.currentTime = value * 1000;
        }
      } catch {
        /* animasi tidak bisa di-seek */
      }
    }
  };

  useEffect(() => {
    applySeek(seek);
  }, [seek]);

  const w = Number(width) || 1280;
  const h = Number(height) || 720;
  const maxTime = Number(duration) || 5;
  const scale = stageWidth > 0 ? Math.min(1, stageWidth / w) : 1;

  // Sebelum lebar terukur, pakai rasio aspek supaya tidak sempat tampil raksasa.
  const stageStyle = stageWidth > 0 ? { height: Math.round(h * scale) } : { aspectRatio: `${w} / ${h}` };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">PREVIEW LIVE</h2>
        <span className="tag tag-pink">{w}x{h}</span>
      </div>
      <div className="panel-body">
        <div className="preview-stage" ref={stageRef} style={stageStyle}>
          <iframe
            ref={frameRef}
            title="PREVIEW"
            sandbox="allow-scripts allow-same-origin"
            srcDoc={code}
            onLoad={() => applySeek(seek)}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: w,
              height: h,
              transform: `scale(${scale})`,
              transformOrigin: '0 0',
            }}
          />
          {!code.trim() && <div className="preview-empty">BELUM ADA KODE</div>}
        </div>

        <div className="scrubber">
          <span className="label">{seek === null ? 'LIVE' : `T = ${seek.toFixed(2)} DETIK`}</span>
          <input
            type="range"
            min={0}
            max={maxTime}
            step={0.05}
            value={seek === null ? 0 : Math.min(seek, maxTime)}
            onChange={(e) => setSeek(Number(e.target.value))}
            aria-label="SEEK ANIMASI"
          />
          <button type="button" className="btn btn-small" onClick={() => setSeek(null)} disabled={seek === null}>
            LIVE
          </button>
        </div>
      </div>
    </section>
  );
}
