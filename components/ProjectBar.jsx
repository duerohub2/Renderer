'use client';

export default function ProjectBar({ projects, activeId, onSwitch, onNew, onDuplicate, onRename, onDelete, disabled }) {
  return (
    <section className="panel">
      <div className="panel-body">
        <label className="field">
          <span className="label">PROYEK ({projects.length})</span>
          <select
            className="input"
            value={activeId}
            disabled={disabled}
            onChange={(e) => onSwitch(e.target.value)}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <div className="btn-row">
          <button type="button" className="btn btn-small btn-mint" onClick={onNew} disabled={disabled}>
            BARU
          </button>
          <button type="button" className="btn btn-small btn-blue" onClick={onDuplicate} disabled={disabled}>
            GANDA
          </button>
          <button type="button" className="btn btn-small" onClick={onRename} disabled={disabled}>
            UBAH NAMA
          </button>
          <button type="button" className="btn btn-small btn-pink" onClick={onDelete} disabled={disabled}>
            HAPUS
          </button>
        </div>
      </div>
    </section>
  );
}
