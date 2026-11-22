export const CONFIG = {
  EDGE_BASE: (import.meta.env.VITE_EDGE_BASE || '').trim().replace(/\/$/, ''),
  MAP_CENTER: [61.7849, 34.3469] as [number, number],
  MAP_ZOOM: 13,
  MAP_TILES_URL: import.meta.env.VITE_MAP_TILES_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  MAP_TILES_ATTR: import.meta.env.VITE_MAP_TILES_ATTRIBUTION || '© OpenStreetMap contributors',
};

export function assertConfig() {
  if (!CONFIG.MAP_TILES_URL.startsWith('https://')) {
    throw new Error('Адрес картографических тайлов должен начинаться с https://');
  }
}
