interface ImportMetaEnv {
  readonly VITE_EDGE_BASE?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_YANDEX_MAPS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
