export const PROJECTS_KEY = 'renderizer:projects:v2';
export const MAX_PROJECTS = 20;
const LEGACY_KEY = 'renderizer:v1';

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function createProject(name, code, settings) {
  return { id: newId(), name, code: code || '', settings, updatedAt: Date.now() };
}

export function loadProjects(defaultSettings) {
  try {
    const raw = JSON.parse(localStorage.getItem(PROJECTS_KEY) || 'null');
    if (raw && Array.isArray(raw.items)) {
      const items = raw.items
        .filter((p) => p && typeof p.id === 'string')
        .map((p) => ({
          id: p.id,
          name: typeof p.name === 'string' && p.name ? p.name : 'Proyek',
          code: typeof p.code === 'string' ? p.code : '',
          settings: p.settings && typeof p.settings === 'object' ? p.settings : defaultSettings,
          updatedAt: Number(p.updatedAt) || Date.now(),
        }));
      if (items.length) {
        return { items, activeId: items.some((p) => p.id === raw.activeId) ? raw.activeId : items[0].id };
      }
    }
  } catch {
    /* data rusak, lanjut ke cadangan */
  }

  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
    if (legacy && typeof legacy.code === 'string') {
      const migrated = createProject('Proyek 1', legacy.code, legacy.settings || defaultSettings);
      return { items: [migrated], activeId: migrated.id };
    }
  } catch {
    /* abaikan */
  }

  const first = createProject('Proyek 1', '', defaultSettings);
  return { items: [first], activeId: first.id };
}

export function saveProjects(items, activeId) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify({ items, activeId }));
  } catch {
    /* kuota penuh atau storage diblokir */
  }
}
