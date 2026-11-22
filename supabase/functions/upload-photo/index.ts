import {
  createAdminClient,
  corsHeaders,
  errorResponse,
  HttpError,
  jsonResponse,
  PHOTO_BUCKET,
  requireTelegramUser,
} from '../_shared/common.ts';

const imageTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
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

    const extension = imageTypes[file.type as keyof typeof imageTypes];
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
