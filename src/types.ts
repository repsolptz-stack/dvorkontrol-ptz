export type ReportCategory = 'pothole' | 'ice' | 'icicles';
export type ReportStatus = 'active' | 'in_progress' | 'solved' | 'rejected';
export type ReportFilter = 'all' | 'active' | 'solved';

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

export interface AppState {
  theme: 'dark' | 'light';
  currentTab: 'radar' | 'scan' | 'battle' | 'profile';
  currentPreset: ReportCategory;
  reports: Report[];
  filter: ReportFilter;
  photoFile: File | null;
  photoPreviewUrl: string | null;
  user: any;
  pickedLocation: { lat: number; lng: number; accuracy?: number } | null;
}
