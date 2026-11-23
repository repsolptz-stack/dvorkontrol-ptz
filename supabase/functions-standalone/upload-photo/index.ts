import { createClient } from 'npm:@supabase/supabase-js@2';

interface TelegramUser {
  id: string;
}

const PHOTO_BUCKET = 'report-photos';
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
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

function matchesImageSignature(type: string, bytes: Uint8Array): boolean {
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') {
    return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((byte, index) => bytes[index] === byte);
  }
  if (type === 'image/webp') {
    return bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP';
  }
  return false;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return jsonResponse({ error: 'Метод не поддерживается' }, 405);

  try {
    const user = await requireTelegramUser(request);
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new HttpError(400, 'Ожидается multipart/form-data с полем file');
    }

    const file = form.get('file');
    if (!(file instanceof File)) throw new HttpError(400, 'Не найден файл фотографии');
    if (file.size === 0 || file.size > 10 * 1024 * 1024) {
      throw new HttpError(400, 'Размер фотографии должен быть от 1 байта до 10 МБ');
    }

    const extension = IMAGE_TYPES[file.type];
    if (!extension) throw new HttpError(415, 'Поддерживаются только JPEG, PNG и WebP');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesImageSignature(file.type, bytes)) {
      throw new HttpError(415, 'Содержимое файла не соответствует формату изображения');
    }

    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await createAdminClient().storage.from(PHOTO_BUCKET).upload(path, bytes, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    return jsonResponse({ path });
  } catch (error) {
    if (!(error instanceof HttpError)) console.error('upload-photo failed:', error);
    return errorResponse(error);
  }
});
