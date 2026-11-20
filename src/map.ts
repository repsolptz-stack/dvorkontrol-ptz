import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { CONFIG } from './config';
import { state } from './state';
import { esc } from './lib';
import type { Report } from './types';

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

export function renderMarkers(filter: 'all' | 'active' | 'solved') {
  markersLayer.clearLayers();
  // Указали тип (p: Report), чтобы робот не ругался
  const list = state.reports.filter((p: Report) => filter === 'all' || p.status === filter);

  list.forEach((p: Report) => {
    const color = p.status === 'active' ? '#ef4444' : '#10b981';
    const marker = L.circleMarker([p.lat, p.lng], {
      radius: 9,
      fillColor: color,
      color: '#ffffff',
      weight: 2,
      fillOpacity: 0.92,
    });
    marker.bindPopup(
      `<b>${esc(p.category)}</b><br>${esc(p.address)}<br>Статус: ${
        p.status === 'active' ? '🔴 В работе' : '🟢 Решено'
      }`
    );
    markersLayer.addLayer(marker);
  });

  const chip = document.querySelector('.chip[data-filter="all"]');
  if (chip) chip.textContent = `Все точки (${state.reports.length})`;
}

export function centerMap(lat: number, lng: number) {
  if (map) map.setView([lat, lng], 16);
}
