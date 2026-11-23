import type { Report, CreateReportPayload } from './types';
import { CONFIG } from './config';

export const tg = (window as any).Telegram?.WebApp;

export function initTelegram() {
  if (!tg) return null;
  try {
    tg.ready();
    tg.expand();
  } catch {
    // Telegram WebApp methods are unavailable in a regular browser.
  }
  return tg.initDataUnsafe?.user || null;
}

export function haptic(type: 'light' | 'medium' | 'heavy' | 'rigid' = 'light') {
  try { tg?.HapticFeedback?.impactOccurred(type); } catch { /* Optional Telegram feature. */ }
}

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c] || c));
}

let toastTimer: any = null;
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
  toastTimer = setTimeout(() => el!.classList.remove('show'), 2600);
}

export function shareText(text: string) {
  const url = `https://t.me/share/url?text=${encodeURIComponent(text)}`;
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

export function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Геолокация недоступна в этом браузере'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
  });
}

async function edgeCall<T>(fn: string, init: RequestInit = {}): Promise<T> {
  if (!CONFIG.EDGE_BASE) {
    throw new Error('Адрес Supabase Edge Functions не настроен или некорректен. Укажите VITE_EDGE_BASE или VITE_SUPABASE_URL с https://.');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `tma ${tg?.initData || ''}`);
  const url = new URL(`${fn}`, `${CONFIG.EDGE_BASE}/`).toString();
  const res = await fetch(url, {
    ...init,
    headers,
  });
  const text = await res.text();
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Сервер вернул некорректный ответ (${res.status})`);
    }
  }
  if (!res.ok) throw new Error(data.error || `Ошибка сервера (${res.status})`);
  return data;
}

export async function apiListReports(): Promise<Report[]> {
  if (!CONFIG.EDGE_BASE) return [];
  const { reports } = await edgeCall<{ reports: Report[] }>('list-reports', { method: 'GET' });
  if (!Array.isArray(reports)) throw new Error('Сервер вернул некорректный список заявок');
  return reports;
}

export async function apiUploadPhoto(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const { path } = await edgeCall<{ path: string }>('upload-photo', { method: 'POST', body: form });
  return path;
}

export async function apiCreateReport(payload: CreateReportPayload): Promise<Report> {
  const { report } = await edgeCall<{ report: Report }>('create-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!report || !Number.isFinite(report.lat) || !Number.isFinite(report.lng)) {
    throw new Error('Сервер вернул некорректные данные заявки');
  }
  return report;
}
