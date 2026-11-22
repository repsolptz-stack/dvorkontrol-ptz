import type { AppState } from './types';

function getInitialTheme(): AppState['theme'] {
  try {
    return localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export const state: AppState = {
  theme: getInitialTheme(),
  currentTab: 'radar',
  currentPreset: 'pothole',
  reports: [],
  filter: 'all',
  photoFile: null,
  photoPreviewUrl: null,
  user: null,
  pickedLocation: null,
};
