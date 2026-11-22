import { createClient } from 'npm:@supabase/supabase-js@2';

const encoder = new TextEncoder();

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export const PHOTO_BUCKET = 'report-photos';

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return jsonResponse({ error: error.message }, error.status);
  console.error(error);
  return jsonResponse({ error: 'Внутренняя ошибка сервера' }, 500);
}

export function createAdminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) throw new Error('Supabase Edge Function secrets are missing');

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireTelegramUser(request: Request): Promise<{ id: string }> {
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
