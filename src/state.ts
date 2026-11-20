import type { AppState } from './types';

export const state: AppState = {
  theme: 'dark',
  currentTab: 'radar',
  currentPreset: 'pothole',
  reports: [],
  filter: 'all',
  photoFile: null,
  photoPreviewUrl: null,
  user: null,
  pickedLocation: null,
};
