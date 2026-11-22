export const REPORT_COLUMNS = [
  'id',
  'category',
  'status',
  'address',
  'district_id',
  'lat',
  'lng',
  'photo_url',
  'created_at',
  'resolved_at',
  'resolved_photo_url',
].join(',');

export function toClientReport(row: Record<string, unknown>) {
  return {
    id: row.id,
    category: row.category,
    status: row.status,
    address: row.address,
    districtId: row.district_id,
    lat: row.lat,
    lng: row.lng,
    photoUrl: row.photo_url,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolvedPhotoUrl: row.resolved_photo_url,
  };
}
