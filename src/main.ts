import './styles.css';
import { assertConfig } from './config';
import { initTelegram, apiListReports, showToast } from './lib';
import { state } from './state';
import { bindScreens } from './screens';
import { initMap, renderMarkers } from './map';

async function bootstrap() {
  try {
    assertConfig();
    state.user = initTelegram();

    initMap((lat, lng) => {
      state.pickedLocation = { lat, lng };
      const locationHint = document.getElementById('locationHint');
      if (locationHint) {
        locationHint.textContent = `Точка выбрана: ${lat.toFixed(5)}, ${lng.toFixed(5)}. Перейдите в «Камера», чтобы создать заявку.`;
      }
      showToast('Место заявки выбрано на карте');
    });

    bindScreens();

    try {
      state.reports = await apiListReports();
      if (!import.meta.env.VITE_EDGE_BASE?.trim() && !import.meta.env.VITE_SUPABASE_URL?.trim()) {
        showToast('Карта открыта без сервера: просмотр и публикация заявок недоступны', true);
      }
    } catch (err) {
      state.reports = [];
      showToast(`Не удалось загрузить заявки: ${err instanceof Error ? err.message : 'ошибка сети'}`, true);
    }
    renderMarkers('all');
  } catch (err) {
    console.error(err);
    const message = document.createElement('div');
    message.style.cssText = 'padding:20px;color:#ef4444;';
    message.textContent = `Ошибка запуска: ${err instanceof Error ? err.message : String(err)}`;
    document.body.replaceChildren(message);
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
