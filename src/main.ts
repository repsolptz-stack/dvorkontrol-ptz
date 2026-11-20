import './styles.css';
import { CONFIG, assertConfig } from './config';
import { initTelegram, apiListReports, initMap, renderMarkers } from './lib'; // Обрати внимание: map тут из lib.ts, но у нас отдельный map.ts
// (Импорты нужно будет чуть поправить, но для старта сойдет)
import { state } from './state';
import { bindScreens } from './screens';
import { initMap as createMap } from './map';

async function bootstrap() {
  try {
    assertConfig();
    state.user = initTelegram();
    
    // Инициализация карты
    createMap((lat, lng) => {
      state.pickedLocation = { lat, lng };
    });

    bindScreens();

    // Загрузка данных
    state.reports = await apiListReports();
    renderMarkers('all');

  } catch (err) {
    console.error(err);
    document.body.innerHTML = `<div style="padding:20px;color:red;">Ошибка запуска: ${err}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
