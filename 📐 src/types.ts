export type ReportCategory = 'pothole' | 'ice' | 'icicles';
export type ReportStatus = 'active' | 'in_progress' | 'solved' | 'rejected';

export interface District {
  id: string;
  name: string;
  ukName: string;
  ukRating: number;
  address: string;
}

export interface Report {
  id: string;
  category: ReportCategory;
  status: ReportStatus;
  address: string;
  lat: number;
  lng: number;
  districtId: string;
  photoUrl: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedPhotoUrl: string | null;
}

export interface CreateReportPayload {
  districtId: string;
  category: ReportCategory;
  address: string;
  lat: number;
  lng: number;
  accuracy?: number;
  complaintText: string;
  photoPath?: string;
}

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
  photo_url?: string;
}

export interface AppState {
  theme: 'dark' | 'light';
  currentTab: 'radar' | 'scan' | 'battle' | 'profile';
  currentPreset: ReportCategory;
  reports: Report[];
  filter: 'all' | 'active' | 'solved';
  photoFile: File | null;
  photoPreviewUrl: string | null;
  user: TelegramUser | null;
  pickedLocation: { lat: number; lng: number; accuracy?: number } | null;
}
