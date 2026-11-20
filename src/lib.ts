import type { Report, CreateReportPayload, TelegramUser } from './types';
import { CONFIG } from './config';

/* ==========================================================
   1. TELEGRAM
   ========================================================== */
export const tg = window.Telegram?.WebApp;

export function initTelegram(): TelegramUser | null {
  if (!tg) return null;
  tg.ready();
  tg.expand();
  syncTheme();
  tg.onEvent?.('themeChanged', syncTheme);
  return (tg.initDataUnsafe?.user as TelegramUser) ?? null;
}

export function syncTheme() {
  if (!tg) return;
  const isDark = tg.colorScheme === 'dark';
  const bg = isDark ? '#0f172a' : '#f2f4f7';
  tg.setHeaderColor(bg as never);
  tg.setBackgroundColor(bg as never);
}

export function haptic(type: 'light' | 'medium' | 'heavy' | 'rigid' = 'light') {
  try {
    tg?.HapticFeedback?.impactOccurred(type);
  } catch { /* noop */ }
}

export function getInitData(): string {
  return tg?.initData ?? '';
}

export function shareText(text: string) {
  const url = `https://t.me/share/url?url=${encodeURIComponent('https://t.me')}&text=${encodeURIComponent(text)}`;
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, '_blank');
}

/* ==========================================================
   2. DOM
   ========================================================== */
export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}

export function $<T extends HTMLElement = HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Element not found: ${sel}`);
  return el;
}

let toastTimer: number | null = null;
export function showToast(msg: string, isError = false) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove('show'), 2600);
}

/* ==========================================================
   3. API — только Edge Functions, никакого anon-ключа
   ========================================================== */
async function edgeCall<T>(
  fn: 'create-report' | 'list-reports' | 'upload-photo',
  init: RequestInit & { query?: Record<string, string> } = {},
): Promise<T> {
  const url = new URL(`${CONFIG.EDGE_BASE}/${fn}`);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `tma ${getInitData()}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export async function apiListReports(status?: string): Promise<Report[]> {
  const { reports } = await edgeCall<{ reports: Report[] }>('list-reports', {
    method: 'GET',
    query: status ? { status } : {},
  });
  return reports;
}

export async function apiUploadPhoto(file: File): Promise<string> {
  const compressed = await compressImage(file);
  const form = new FormData();
  form.append('file', compressed);
  const { path } = await edgeCall<{ path: string }>('upload-photo', {
    method: 'POST',
    body: form,
  });
  return path;
}

export async function apiCreateReport(
  payload: CreateReportPayload,
): Promise<Report> {
  const { report } = await edgeCall<{ report: Report }>('create-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return report;
}

/* ==========================================================
   4. GEO — GPS + компрессия фото
   ========================================================== */
export function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Геолокация недоступна'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12_000,
      maximumAge: 0,
    });
  });
}

/** Сжатие фото на клиенте до CONFIG.PHOTO_MAX_DIM / PHOTO_MAX_SIZE */
export function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Это не изображение'));
    }
    if (file.size <= CONFIG.PHOTO_MAX_SIZE && file.type !== 'image/heic') {
      return resolve(file);
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(
        1,
        CONFIG.PHOTO_MAX_DIM / Math.max(img.width, img.height),
      );
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas 2D недоступен'));
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        blob => {
          if (!blob) return reject(new Error('Не удалось сжать фото'));
          resolve(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.82,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось прочитать изображение'));
    };
    img.src = url;
  });
}

/* ==========================================================
   5. STORAGE — тема через CloudStorage, fallback localStorage
   ========================================================== */
export async function loadTheme(): Promise<'dark' | 'light'> {
  const local = localStorage.getItem('theme');
  if (local === 'dark' || local === 'light') return local;
  try {
    const fromCloud = await new Promise<string | null>(resolve => {
      if (!tg?.CloudStorage) return resolve(null);
      tg.CloudStorage.getItem('theme', (err, val) => {
        resolve(err ? null : (val ?? null));
      });
    });
    if (fromCloud === 'dark' || fromCloud === 'light') return fromCloud;
  } catch { /* noop */ }
  return tg?.colorScheme === 'light' ? 'light' : 'dark';
}

export function saveTheme(theme: 'dark' | 'light') {
  localStorage.setItem('theme', theme);
  try {
    tg?.CloudStorage?.setItem('theme', theme, () => {});
  } catch { /* noop */ }
}
