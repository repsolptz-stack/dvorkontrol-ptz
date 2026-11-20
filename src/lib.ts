import type { Report, CreateReportPayload } from './types';
import { CONFIG } from './config';

export const tg = (window as any).Telegram?.WebApp;

export function initTelegram() {
  if (!tg) return null;
  tg.ready();
  tg.expand();
  return tg.initDataUnsafe?.user || null;
}

export function haptic(type: 'light' | 'medium' | 'heavy' | 'rigid' = 'light') {
  try { tg?.HapticFeedback?.impactOccurred(type); } catch (e) {}
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
  const url = `https://t.me/share/url?url=${encodeURIComponent('https://t.me')}&text=${encodeURIComponent(text)}`;
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, '_blank');
}

export function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
  });
}

async function edgeCall<T>(fn: string, init: any = {}): Promise<T> {
  const res = await fetch(`${CONFIG.EDGE_BASE}/${fn}`, {
    ...init,
    headers: { ...init.headers, Authorization: `tma ${tg?.initData || ''}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
  return data;
}

export async function apiListReports(): Promise<Report[]> {
  try {
    const { reports } = await edgeCall<{ reports: Report[] }>('list-reports', { method: 'GET' });
    return reports;
  } catch (e) {
    return []; // Если бэкенд не настроен, возвращаем пустой массив, чтобы карта запустилась
  }
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
  return report;
}
