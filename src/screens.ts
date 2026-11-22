import { state } from './state';
import { TEMPLATES } from './templates';
import { apiCreateReport, apiUploadPhoto, getPosition, showToast, haptic, shareText } from './lib';
import { renderMarkers, centerMap } from './map';
import { CONFIG } from './config';
import type { AppState, ReportCategory, ReportFilter } from './types';

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);

export function bindScreens() {
  const addressInput = $('#addressInput') as HTMLInputElement | null;
  const districtSelect = $('#districtSelect') as HTMLSelectElement | null;
  const complaintText = $('#complaintText');
  const ukTag = $('#ukTag');

  function generateComplaint() {
    if (!addressInput || !districtSelect || !complaintText || !ukTag) return;
    const responsible = ukTag.textContent?.replace(/^🏢 Ответственный: /, '').trim() || 'не указан';
    const template = TEMPLATES[state.currentPreset];
    const date = new Date().toLocaleDateString('ru-RU');
    const photoText = state.photoFile
      ? `Приложение: фотофиксация от ${date}.`
      : 'Фотография не приложена.';

    complaintText.textContent = [
      'В Государственный комитет Республики Карелия по строительному, жилищному и дорожному надзору',
      'и в Комитет ЖКХ Администрации Петрозаводского городского округа',
      '',
      `Ответственный: ${responsible}`,
      '',
      'ЖАЛОБА',
      '',
      `По адресу: ${addressInput.value.trim() || 'укажите адрес'}`,
      `зафиксирована проблема: ${template.law}`,
      '',
      photoText,
      '',
      'Прошу рассмотреть обращение в установленный законом срок.',
    ].join('\n');
  }

  function setPhoto(file: File | null) {
    if (state.photoPreviewUrl) URL.revokeObjectURL(state.photoPreviewUrl);
    state.photoFile = file;
    state.photoPreviewUrl = file ? URL.createObjectURL(file) : null;
    const preview = $('#previewImg') as HTMLImageElement | null;
    if (preview) {
      preview.src = state.photoPreviewUrl || '';
      preview.style.display = state.photoPreviewUrl ? 'block' : 'none';
    }
    const badge = $('#aiBadge');
    if (badge) badge.textContent = file ? `Фото выбрано: ${file.name}` : TEMPLATES[state.currentPreset].ai;
    generateComplaint();
  }

  document.querySelectorAll<HTMLButtonElement>('.nav-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab as AppState['currentTab'] | undefined;
      if (!tab || !$('#screen-' + tab)) return;
      state.currentTab = tab;
      document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
      $('#screen-' + tab)?.classList.add('active');
      document.querySelectorAll('.nav-btn').forEach((navButton) => navButton.classList.remove('active'));
      button.classList.add('active');
      if (tab === 'radar') setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
    });
  });

  document.querySelectorAll<HTMLButtonElement>('.preset-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const preset = button.dataset.preset as ReportCategory | undefined;
      if (!preset || !TEMPLATES[preset]) return;
      state.currentPreset = preset;
      document.querySelectorAll('.preset-btn').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      if (!state.photoFile) {
        const badge = $('#aiBadge');
        if (badge) badge.textContent = TEMPLATES[preset].ai;
      }
      generateComplaint();
      haptic('light');
    });
  });

  districtSelect?.addEventListener('change', () => {
    const [districtId, responsible] = districtSelect.value.split('|');
    const selected = districtSelect.selectedOptions[0];
    const districtName = selected?.dataset.address || selected?.textContent?.trim() || '';
    if (addressInput) addressInput.value = `г. Петрозаводск, ${districtName}`;
    if (ukTag) ukTag.textContent = `🏢 Ответственный: ${responsible || 'не указан'}`;
    const locationHint = $('#locationHint');
    if (locationHint) locationHint.textContent = `Выбран район ${districtId}. Нажмите на карту, чтобы указать точное место.`;
    generateComplaint();
  });

  addressInput?.addEventListener('input', generateComplaint);

  $('#themeToggle')?.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = state.theme;
    try {
      localStorage.setItem('theme', state.theme);
    } catch {
      // The selected theme still applies for this session if storage is disabled.
    }
    const button = $('#themeToggle');
    if (button) button.textContent = state.theme === 'dark' ? '☀️ Полярный день' : '🌙 Полярная ночь';
  });
  document.documentElement.dataset.theme = state.theme;
  const themeButton = $('#themeToggle');
  if (themeButton) themeButton.textContent = state.theme === 'dark' ? '☀️ Полярный день' : '🌙 Полярная ночь';

  document.querySelectorAll<HTMLButtonElement>('.chip[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter as ReportFilter | undefined;
      if (!filter) return;
      state.filter = filter;
      document.querySelectorAll('.chip[data-filter]').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      renderMarkers(filter);
    });
  });

  $('#btnLocate')?.addEventListener('click', async () => {
    try {
      const position = await getPosition();
      state.pickedLocation = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy };
      centerMap(position.coords.latitude, position.coords.longitude);
      const locationHint = $('#locationHint');
      if (locationHint) locationHint.textContent = 'Ваше местоположение выбрано. Перейдите в «Камера», чтобы создать заявку.';
      showToast('Показано ваше местоположение');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось определить местоположение', true);
    }
  });

  const photoInput = $('#photoInput') as HTMLInputElement | null;
  photoInput?.addEventListener('change', () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Выберите файл изображения', true);
      photoInput.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('Размер фотографии не должен превышать 10 МБ', true);
      photoInput.value = '';
      return;
    }
    setPhoto(file);
    showToast('Фотография добавлена');
  });

  $('#btnDemoPhoto')?.addEventListener('click', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="#64748b"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs><rect width="960" height="540" fill="url(#g)"/><path d="M0 380 260 310l120 65 160-130 120 70 300-100v325H0z" fill="#1e293b"/><path d="m360 445 90-95 54 34-62 61z" fill="#020617"/><text x="480" y="500" text-anchor="middle" fill="white" font-family="sans-serif" font-size="24">ДЕМО-ФОТО — НЕ РЕАЛЬНАЯ ЗАЯВКА</text></svg>`;
    setPhoto(new File([svg], 'demo-photo.svg', { type: 'image/svg+xml' }));
    showToast('Добавлено демонстрационное изображение');
  });

  $('#btnCopyComplaint')?.addEventListener('click', async () => {
    const text = complaintText?.textContent || '';
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const temporary = document.createElement('textarea');
        temporary.value = text;
        temporary.style.position = 'fixed';
        temporary.style.opacity = '0';
        document.body.append(temporary);
        temporary.select();
        const copied = document.execCommand('copy');
        temporary.remove();
        if (!copied) throw new Error('Копирование не поддерживается браузером');
      }
      showToast('Текст жалобы скопирован');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось скопировать текст', true);
    }
  });

  $('#btnSocialPost')?.addEventListener('click', () => {
    shareText(`⚠️ ${addressInput?.value.trim() || 'Петрозаводск'} — проблема зафиксирована через «ДворКонтроль ПТЗ». #Петрозаводск`);
  });

  $('#toggleSheetBtn')?.addEventListener('click', () => {
    const sheet = $('#baSheet');
    if (!sheet) return;
    const collapsed = sheet.classList.toggle('collapsed');
    const button = $('#toggleSheetBtn');
    if (button) button.textContent = collapsed ? 'Открыть' : 'Свернуть';
  });

  document.querySelectorAll<HTMLButtonElement>('.react-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const count = button.querySelector('span');
      if (!count || button.classList.contains('active')) return;
      count.textContent = String(Number(count.textContent || 0) + 1);
      button.classList.add('active');
    });
  });

  const slider = $('#baSlider');
  const before = $('#baBefore');
  const divider = $('#baDivider');
  slider?.addEventListener('pointerdown', (event) => {
    const update = (pointerEvent: PointerEvent) => {
      const bounds = slider.getBoundingClientRect();
      const percentage = Math.min(100, Math.max(0, ((pointerEvent.clientX - bounds.left) / bounds.width) * 100));
      if (before) before.style.clipPath = `inset(0 ${100 - percentage}% 0 0)`;
      if (divider) divider.style.left = `${percentage}%`;
    };
    slider.setPointerCapture(event.pointerId);
    update(event);
    const finish = () => slider.removeEventListener('pointermove', update);
    slider.addEventListener('pointermove', update);
    slider.addEventListener('pointerup', finish, { once: true });
    slider.addEventListener('pointercancel', finish, { once: true });
  });

  $('#btnPublish')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    if (!addressInput || !districtSelect || !complaintText) return;
    if (!CONFIG.EDGE_BASE) {
      showToast('Сервер не настроен: добавьте VITE_EDGE_BASE в .env', true);
      return;
    }
    const address = addressInput.value.trim();
    if (!address) {
      showToast('Укажите адрес проблемы', true);
      addressInput.focus();
      return;
    }

    button.disabled = true;
    button.textContent = 'Публикуем…';
    try {
      const position = state.pickedLocation || await getPosition().then((result) => ({
        lat: result.coords.latitude,
        lng: result.coords.longitude,
        accuracy: result.coords.accuracy,
      }));
      const [districtId] = districtSelect.value.split('|');
      const photoPath = state.photoFile ? await apiUploadPhoto(state.photoFile) : undefined;
      const report = await apiCreateReport({
        districtId,
        category: state.currentPreset,
        address,
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy,
        complaintText: complaintText.textContent || '',
        ...(photoPath ? { photoPath } : {}),
      });

      state.reports.unshift(report);
      renderMarkers(state.filter);
      showToast('Заявка опубликована на радаре');
      document.querySelector<HTMLButtonElement>('.nav-btn[data-tab="radar"]')?.click();
      centerMap(report.lat, report.lng);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось отправить заявку', true);
    } finally {
      button.disabled = false;
      button.textContent = '📍 На Радар ПТЗ';
    }
  });

  generateComplaint();
}
