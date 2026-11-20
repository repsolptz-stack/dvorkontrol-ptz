import './styles.css';
import { assertConfig } from './config';
import { initTelegram, apiListReports } from './lib';
import { state } from './state';
import { bindScreens } from './screens';
import { initMap, renderMarkers } from './map';

async function bootstrap() {
  try {
    assertConfig();
    state.user = initTelegram();

    initMap((lat, lng) => {
      state.pickedLocation = { lat, lng };
    });

    bindScreens();

    state.reports = await apiListReports();
    renderMarkers('all');
  } catch (err) {
    console.error(err);
    document.body.innerHTML = `<div style="padding:20px;color:red;">Ошибка запуска: ${err}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
