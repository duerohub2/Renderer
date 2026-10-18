'use client';

import { useRef, useState } from 'react';

function readFile(file, onChange) {
  const reader = new FileReader();
  reader.onload = () => onChange(String(reader.result || ''));
  reader.readAsText(file);
}

export default function Editor({ code, onChange, onLoadDemo, disabled }) {
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) readFile(file, onChange);
    event.target.value = '';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) readFile(file, onChange);
  };

  const handleKeyDown = (event) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const target = event.target;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    onChange(code.slice(0, start) + '  ' + code.slice(end));
    requestAnimationFrame(() => {
      target.selectionStart = target.selectionEnd = start + 2;
    });
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">EDITOR KODE</h2>
        <span className="tag tag-yellow">{code.length} KARAKTER</span>
      </div>
      <div
        className={`panel-body ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className="btn-row">
          <button type="button" className="btn btn-blue" onClick={() => fileRef.current && fileRef.current.click()} disabled={disabled}>
            UPLOAD FILE
          </button>
          <button type="button" className="btn btn-mint" onClick={onLoadDemo} disabled={disabled}>
            LOAD DEMO
          </button>
          <input ref={fileRef} type="file" accept=".html,.htm,.txt" onChange={handleFile} hidden />
        </div>
        <textarea
          className="code-area"
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="PASTE KODE HTML/CSS/JS DI SINI, ATAU DRAG-DROP FILE KE SINI..."
          spellCheck={false}
          disabled={disabled}
        />
      </div>
    </section>
  );
}
