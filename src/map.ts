import { CONFIG } from './config';
import { state } from './state';
import { esc } from './lib';
import type { Report, ReportFilter } from './types';

let map: YandexMap | undefined;
let apiPromise: Promise<YandexMapsAPI> | undefined;
let reportMarkers: YandexPlacemark[] = [];
let userLocationMarker: YandexPlacemark | undefined;

function loadYandexMaps(): Promise<YandexMapsAPI> {
  if (!CONFIG.YANDEX_MAPS_API_KEY) {
    return Promise.reject(new Error('Не задан VITE_YANDEX_MAPS_API_KEY для загрузки Яндекс Карт'));
  }
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YandexMapsAPI>((resolve, reject) => {
    const ready = () => {
      const api = window.ymaps;
      if (!api) {
        reject(new Error('Яндекс Карты API не загрузился'));
        return;
      }
      api.ready(() => resolve(api));
    };

    if (window.ymaps) {
      ready();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(CONFIG.YANDEX_MAPS_API_KEY)}&lang=ru_RU`;
    script.async = true;
    script.onload = ready;
    script.onerror = () => reject(new Error('Не удалось загрузить JavaScript API Яндекс Карт'));
    document.head.appendChild(script);
  }).catch((error) => {
    apiPromise = undefined;
    throw error;
  });

  return apiPromise;
}

export async function initMap(onPickLocation: (lat: number, lng: number) => void) {
  const ymaps = await loadYandexMaps();
  map = new ymaps.Map('map', {
    center: CONFIG.MAP_CENTER,
    zoom: CONFIG.MAP_ZOOM,
    controls: ['zoomControl'],
  });

  map.events.add('click', (event) => {
    const [lat, lng] = event.get('coords');
    onPickLocation(lat, lng);
  });

  window.addEventListener('resize', () => map?.container.fitToViewport());
}

export function renderMarkers(filter: ReportFilter) {
  if (!map || !window.ymaps) return;
  reportMarkers.forEach((marker) => map!.geoObjects.remove(marker));
  reportMarkers = [];

  const list = state.reports.filter((report: Report) => {
    if (filter === 'all') return true;
    if (filter === 'active') return report.status === 'active' || report.status === 'in_progress';
    return report.status === 'solved';
  });

  list.forEach((report: Report) => {
    if (!Number.isFinite(report.lat) || !Number.isFinite(report.lng)) return;
    const color = report.status === 'solved' ? '#10b981' : report.status === 'rejected' ? '#94a3b8' : report.status === 'in_progress' ? '#f97316' : '#ef4444';
    const marker = new window.ymaps!.Placemark(
      [report.lat, report.lng],
      {
        balloonContent: `<b>${esc(categoryLabel(report.category))}</b><br>${esc(report.address)}<br>Статус: ${statusLabel(report.status)}`,
        hintContent: `${categoryLabel(report.category)} · ${statusLabel(report.status)}`,
      },
      { ...svgIconOptions(reportIcon(color), 34) },
    );
    reportMarkers.push(marker);
    map!.geoObjects.add(marker);
  });

  const allChip = document.querySelector<HTMLElement>('.chip[data-filter="all"]');
  const activeChip = document.querySelector<HTMLElement>('.chip[data-filter="active"]');
  const solvedChip = document.querySelector<HTMLElement>('.chip[data-filter="solved"]');
  if (allChip) allChip.textContent = `Все точки (${state.reports.length})`;
  if (activeChip) activeChip.textContent = `🔴 Активные (${state.reports.filter((r) => r.status === 'active' || r.status === 'in_progress').length})`;
  if (solvedChip) solvedChip.textContent = `🟢 Решённые (${state.reports.filter((r) => r.status === 'solved').length})`;
}

function categoryLabel(category: Report['category']) {
  return { pothole: 'Яма / люк', ice: 'Гололёд', icicles: 'Сосульки' }[category] || 'Проблема';
}

function statusLabel(status: Report['status']) {
  return {
    active: '🔴 Активна',
    in_progress: '🟠 В работе',
    solved: '🟢 Решена',
    rejected: '⚪ Отклонена',
  }[status];
}

function svgIconOptions(svg: string, size: number) {
  return {
    iconLayout: 'default#image',
    iconImageHref: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    iconImageSize: [size, size],
    iconImageOffset: [-size / 2, -size / 2],
  };
}

function reportIcon(color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34"><circle cx="17" cy="17" r="13" fill="${color}" stroke="white" stroke-width="4"/><circle cx="17" cy="17" r="4" fill="white"/></svg>`;
}

function currentLocationIcon() {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 46 46"><circle cx="23" cy="23" r="20" fill="#2563eb" fill-opacity=".22"/><circle cx="23" cy="23" r="12" fill="#2563eb" stroke="white" stroke-width="4"/><circle cx="23" cy="23" r="4" fill="#fde047"/></svg>';
}

export function centerMap(lat: number, lng: number) {
  map?.setCenter([lat, lng], 16, { duration: 300 });
}

export function setUserLocation(lat: number, lng: number) {
  if (!map || !window.ymaps) return;
  const coordinates: [number, number] = [lat, lng];
  if (userLocationMarker) {
    userLocationMarker.geometry.setCoordinates(coordinates);
  } else {
    userLocationMarker = new window.ymaps.Placemark(
      coordinates,
      { hintContent: 'Вы здесь', balloonContent: '<b>Ваше местоположение</b>' },
      svgIconOptions(currentLocationIcon(), 46),
    );
    map.geoObjects.add(userLocationMarker);
  }
  centerMap(lat, lng);
}
