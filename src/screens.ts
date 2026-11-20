import { state } from './state';
import { TEMPLATES } from './templates';
import { apiCreateReport, apiUploadPhoto, getPosition, showToast, haptic, shareText } from './lib';
import { renderMarkers, centerMap } from './map';
import type { ReportCategory } from './types';

export function bindScreens() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab')!;
      state.currentTab = tab as any;
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById('screen-' + tab)?.classList.add('active');
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (tab === 'radar') setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
    });
  });

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset') as ReportCategory;
      state.currentPreset = preset;
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('aiBadge')!.textContent = TEMPLATES[preset].ai;
      generateComplaint();
      haptic('light');
    });
  });

  document.getElementById('districtSelect')?.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value;
    const [district, uk] = val.split('|');
    (document.getElementById('addressInput') as HTMLInputElement).value = `г. Петрозаводск, ${district}`;
    document.getElementById('ukTag')!.textContent = `🏢 Ответственный: ${uk}`;
    generateComplaint();
  });

  function generateComplaint() {
    const address = (document.getElementById('addressInput') as HTMLInputElement).value;
    const uk = document.getElementById('ukTag')!.textContent?.replace('🏢 Ответственный: ', '');
    const t = TEMPLATES[state.currentPreset];
    const date = new Date().toLocaleDateString('ru-RU');

    const text = `В Государственный комитет РК по строительному, жилищному и дорожному надзору\nи в Комитет ЖКХ Администрации ПГО\n\nОтветственный: ${uk}\n\nЖАЛОБА\n\nПо адресу: ${address}\nзафиксировано ${t.law}\n\nПриложение: фотофиксация с геопривязкой от ${date}.\n\nПрошу рассмотреть обращение в установленные сроки.`;
    document.getElementById('complaintText')!.textContent = text;
  }

  document.getElementById('btnCopyComplaint')?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(document.getElementById('complaintText')!.textContent || '');
    showToast('Текст жалобы скопирован');
  });

  document.getElementById('btnSocialPost')?.addEventListener('click', () => {
    const addr = (document.getElementById('addressInput') as HTMLInputElement).value;
    shareText(`⚠️ ${addr} — зафиксировали нарушение через «ДворКонтроль ПТЗ». #Петрозаводск`);
  });

  document.getElementById('btnPublish')?.addEventListener('click', async (e) => {
    const btn = e.target as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = "Публикуем...";
    
    try {
      const pos = state.pickedLocation || await getPosition().then((p: GeolocationPosition) => ({ lat: p.coords.latitude, lng: p.coords.longitude }));
      let photoPath = undefined;
      
      if (state.photoFile) {
        showToast("Загружаем фото...");
        photoPath = await apiUploadPhoto(state.photoFile);
      }

      const address = (document.getElementById('addressInput') as HTMLInputElement).value;
      const districtId = (document.getElementById('districtSelect') as HTMLSelectElement).value.split('|')[0] || '';

      const report = await apiCreateReport({
        districtId: 'dummy-id',
        category: state.currentPreset,
        address,
        lat: pos.lat,
        lng: pos.lng,
        complaintText: document.getElementById('complaintText')!.textContent || '',
        photoPath
      });

      state.reports.unshift(report);
      renderMarkers(state.filter);
      showToast("Точка добавлена на Радар ПТЗ!");
      document.querySelector('.nav-btn[data-tab="radar"]')?.dispatchEvent(new Event('click'));
      centerMap(report.lat, report.lng);
    } catch (err: any) {
      showToast(err.message || "Ошибка публикации", true);
    } finally {
      btn.disabled = false;
      btn.textContent = "📍 На Радар ПТЗ";
    }
  });
}
