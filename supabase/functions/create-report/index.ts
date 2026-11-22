import {
  createAdminClient,
  corsHeaders,
  errorResponse,
  HttpError,
  jsonResponse,
  PHOTO_BUCKET,
  requireTelegramUser,
} from '../_shared/common.ts';
import { REPORT_COLUMNS, toClientReport } from '../_shared/reports.ts';

const categories = new Set(['pothole', 'ice', 'icicles']);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Метод не поддерживается' }, 405);

  try {
    const user = await requireTelegramUser(request);
    let payload: Record<string, unknown>;
    try {
      payload = await request.json();
    } catch {
      throw new HttpError(400, 'Тело запроса должно быть JSON');
    }

    const districtId = stringField(payload.districtId, 'districtId', 80);
    const category = stringField(payload.category, 'category', 20);
    const address = stringField(payload.address, 'address', 500);
    const complaintText = stringField(payload.complaintText, 'complaintText', 10000);
    const lat = numberField(payload.lat, 'lat', -90, 90);
    const lng = numberField(payload.lng, 'lng', -180, 180);
    const accuracy = payload.accuracy === undefined ? null : numberField(payload.accuracy, 'accuracy', 0, 100000);
    const photoPath = payload.photoPath === undefined ? null : stringField(payload.photoPath, 'photoPath', 300);

    if (!categories.has(category)) throw new HttpError(400, 'Недопустимая категория заявки');
    if (photoPath && !photoPath.startsWith(`${user.id}/`)) {
      throw new HttpError(403, 'Нельзя прикрепить фотографию другого пользователя');
    }

    const supabase = createAdminClient();
    let photoUrl: string | null = null;
    if (photoPath) {
      const [folder, ...fileParts] = photoPath.split('/');
      const filename = fileParts.join('/');
      if (folder !== user.id || !filename || filename.includes('..')) {
        throw new HttpError(400, 'Некорректный путь фотографии');
      }
      const { data: files, error: storageError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .list(user.id, { search: filename, limit: 100 });
      if (storageError) throw storageError;
      if (!files?.some((file) => file.name === filename)) {
        throw new HttpError(400, 'Загруженная фотография не найдена');
      }
      photoUrl = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(photoPath).data.publicUrl;
    }

    const { data, error } = await supabase
      .from('reports')
      .insert({
        district_id: districtId,
        category,
        address,
        lat,
        lng,
        accuracy,
        complaint_text: complaintText,
        telegram_user_id: user.id,
        photo_path: photoPath,
        photo_url: photoUrl,
      })
      .select(REPORT_COLUMNS)
      .single();

    if (error) throw error;
    return jsonResponse({ report: toClientReport(data) }, 201);
  } catch (error) {
    if (!(error instanceof HttpError)) console.error('create-report failed:', error);
    return errorResponse(error);
  }
});

function stringField(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new HttpError(400, `Поле ${name} обязательно и должно содержать не более ${maxLength} символов`);
  }
  return value.trim();
}

function numberField(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new HttpError(400, `Поле ${name} должно быть числом от ${min} до ${max}`);
  }
  return value;
}
