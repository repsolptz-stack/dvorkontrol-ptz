function cleanEnv(value: string | undefined): string {
  // GitHub Actions secrets can accidentally contain a trailing newline or spaces.
  return (value || '').replace(/[\r\n\t]/g, '').trim().replace(/\/+$/, '');
}

function getEdgeBase(): string {
  const explicitBase = cleanEnv(import.meta.env.VITE_EDGE_BASE);
  const supabaseUrl = cleanEnv(import.meta.env.VITE_SUPABASE_URL);
  const candidate = explicitBase || (supabaseUrl ? `${supabaseUrl}/functions/v1` : '');
  if (!candidate) return '';

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || !url.hostname) return '';
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return '';
  }
}

function getYandexMapsApiKey(): string {
  return (import.meta.env.VITE_YANDEX_MAPS_API_KEY || '').replace(/[\r\n\t]/g, '').trim();
}

export const CONFIG = {
  EDGE_BASE: getEdgeBase(),
  YANDEX_MAPS_API_KEY: getYandexMapsApiKey(),
  MAP_CENTER: [61.7849, 34.3469] as [number, number],
  MAP_ZOOM: 13,
};
