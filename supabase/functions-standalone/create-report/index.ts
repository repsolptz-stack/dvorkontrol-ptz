import { createClient } from 'npm:@supabase/supabase-js@2';

type ReportCategory = 'pothole' | 'ice' | 'icicles';
type ReportStatus = 'active' | 'in_progress' | 'solved' | 'rejected';

interface TelegramUser {
  id: string;
}

interface ReportRow {
  id: string;
  category: ReportCategory;
  status: ReportStatus;
  address: string;
  district_id: string;
  lat: number;
  lng: number;
  photo_url: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_photo_url: string | null;
}

interface CreateReportPayload {
  districtId?: unknown;
  category?: unknown;
  address?: unknown;
  lat?: unknown;
  lng?: unknown;
  accuracy?: unknown;
  complaintText?: unknown;
  photoPath?: unknown;
}

const REPORT_COLUMNS = [
  'id', 'category', 'status', 'address', 'district_id', 'lat', 'lng',
  'photo_url', 'created_at', 'resolved_at', 'resolved_photo_url',
].join(',');
const PHOTO_BUCKET = 'report-photos';
const VALID_CATEGORIES = new Set<ReportCategory>(['pothole', 'ice', 'icicles']);
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const encoder = new TextEncoder();

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return jsonResponse({ error: error.message }, error.status);
  console.error(error);
  return jsonResponse({ error: 'Внутренняя ошибка сервера' }, 500);
}

function createAdminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) throw new Error('Supabase Edge Function secrets are missing');
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireTelegramUser(request: Request): Promise<TelegramUser> {
  const authorization = request.headers.get('Authorization') || '';
  const initData = authorization.startsWith('tma ') ? authorization.slice(4) : '';
  if (!initData || initData.length > 8192) {
    throw new HttpError(401, 'Откройте приложение через Telegram');
  }

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) throw new HttpError(500, 'На сервере не настроена проверка Telegram');

  const params = new URLSearchParams(initData);
  const suppliedHash = params.get('hash') || '';
  if (!/^[a-f0-9]{64}$/i.test(suppliedHash)) {
    throw new HttpError(401, 'Некорректная подпись Telegram');
  }

  const checkString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const telegramKey = await crypto.subtle.importKey(
    'raw', encoder.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const secret = await crypto.subtle.sign('HMAC', telegramKey, encoder.encode(botToken));
  const dataKey = await crypto.subtle.importKey(
    'raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const expectedHash = [...new Uint8Array(await crypto.subtle.sign('HMAC', dataKey, encoder.encode(checkString)))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  if (!constantTimeEqual(expectedHash, suppliedHash.toLowerCase())) {
    throw new HttpError(401, 'Подпись Telegram не прошла проверку');
  }

  const authDate = Number(params.get('auth_date'));
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (!Number.isFinite(authDate) || ageSeconds < -60 || ageSeconds > 86400) {
    throw new HttpError(401, 'Срок действия данных Telegram истёк; откройте приложение заново');
  }

  try {
    const user = JSON.parse(params.get('user') || '{}');
    if (user.id === undefined || user.id === null) throw new Error('Missing Telegram user id');
    return { id: String(user.id) };
  } catch {
    throw new HttpError(401, 'В данных Telegram отсутствует пользователь');
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function toClientReport(row: ReportRow) {
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return jsonResponse({ error: 'Метод не поддерживается' }, 405);

  try {
    const user = await requireTelegramUser(request);
    let payload: CreateReportPayload;
    try {
      payload = await request.json();
    } catch {
      throw new HttpError(400, 'Тело запроса должно быть JSON');
    }

    const districtId = stringField(payload.districtId, 'districtId', 80);
    const category = stringField(payload.category, 'category', 20) as ReportCategory;
    const address = stringField(payload.address, 'address', 500);
    const complaintText = stringField(payload.complaintText, 'complaintText', 10000);
    const lat = numberField(payload.lat, 'lat', -90, 90);
    const lng = numberField(payload.lng, 'lng', -180, 180);
    const accuracy = payload.accuracy === undefined ? null : numberField(payload.accuracy, 'accuracy', 0, 100000);
    const photoPath = payload.photoPath === undefined ? null : stringField(payload.photoPath, 'photoPath', 300);

    if (!VALID_CATEGORIES.has(category)) throw new HttpError(400, 'Недопустимая категория заявки');
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
      if (!files?.some((file: { name: string }) => file.name === filename)) {
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
    return jsonResponse({ report: toClientReport(data as ReportRow) }, 201);
  } catch (error) {
    if (!(error instanceof HttpError)) console.error('create-report failed:', error);
    return errorResponse(error);
  }
});
