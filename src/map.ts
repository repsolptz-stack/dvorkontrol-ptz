import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { CONFIG } from './config';
import { state } from './state';
import { esc } from './lib';
import type { Report, ReportFilter } from './types';

let map: L.Map;
let markersLayer: any; // Чтобы TypeScript не ругался на markercluster

export function initMap(onPickLocation: (lat: number, lng: number) => void) {
  map = L.map('map', { zoomControl: false }).setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);
  L.tileLayer(CONFIG.MAP_TILES_URL, {
    maxZoom: 19,
    attribution: CONFIG.MAP_TILES_ATTR,
  }).addTo(map);

  markersLayer = (L as any).markerClusterGroup();
  map.addLayer(markersLayer);

  // Тап по карте для выбора координат
  map.on('click', (e: L.LeafletMouseEvent) => {
    onPickLocation(e.latlng.lat, e.latlng.lng);
  });
}

export function renderMarkers(filter: ReportFilter) {
  if (!markersLayer) return;
  markersLayer.clearLayers();
  const list = state.reports.filter((report: Report) => {
    if (filter === 'all') return true;
    if (filter === 'active') return report.status === 'active' || report.status === 'in_progress';
    return report.status === 'solved';
  });

  list.forEach((report: Report) => {
    if (!Number.isFinite(report.lat) || !Number.isFinite(report.lng)) return;
    const color = report.status === 'solved' ? '#10b981' : report.status === 'rejected' ? '#94a3b8' : '#ef4444';
    const marker = L.circleMarker([report.lat, report.lng], {
      radius: 9,
      fillColor: color,
      color: '#ffffff',
      weight: 2,
      fillOpacity: 0.92,
    });
    marker.bindPopup(
      `<b>${esc(categoryLabel(report.category))}</b><br>${esc(report.address)}<br>Статус: ${
        statusLabel(report.status)
      }`
    );
    markersLayer.addLayer(marker);
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

export function centerMap(lat: number, lng: number) {
  if (map) map.setView([lat, lng], 16);
}
