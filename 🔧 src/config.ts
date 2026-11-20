// Все значения приходят из GitHub Actions secrets → env
// Anon-ключ Supabase НЕ используется во фронте — только Edge Functions

export const CONFIG = {
  EDGE_BASE: import.meta.env.VITE_EDGE_BASE as string,
  MAP_CENTER: [61.7849, 34.3469] as [number, number],
  MAP_ZOOM: 13,
  MAP_TILES_URL: import.meta.env.VITE_MAP_TILES_URL as string,
  MAP_TILES_ATTR: import.meta.env.VITE_MAP_TILES_ATTRIBUTION as string,
  PHOTO_MAX_SIZE: 2 * 1024 * 1024,   // 2 MB — сжимаем клиентом
  PHOTO_MAX_DIM: 1920,
  RATE_LIMIT_PER_DAY: 5,
} as const;

// Проверка на старте — если секреты не подставлены, TMA упадёт с понятной ошибкой
export function assertConfig() {
  const missing: string[] = [];
  if (!CONFIG.EDGE_BASE) missing.push('VITE_EDGE_BASE');
  if (!CONFIG.MAP_TILES_URL) missing.push('VITE_MAP_TILES_URL');
  if (missing.length) {
    throw new Error(`Отсутствуют переменные окружения: ${missing.join(', ')}`);
  }
}
