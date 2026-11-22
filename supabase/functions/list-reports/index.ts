import {
  createAdminClient,
  corsHeaders,
  errorResponse,
  HttpError,
  jsonResponse,
  requireTelegramUser,
} from '../_shared/common.ts';
import { REPORT_COLUMNS, toClientReport } from '../_shared/reports.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'GET') return jsonResponse({ error: 'Метод не поддерживается' }, 405);

  try {
    await requireTelegramUser(request);
    const { data, error } = await createAdminClient()
      .from('reports')
      .select(REPORT_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;
    return jsonResponse({ reports: (data || []).map(toClientReport) });
  } catch (error) {
    if (!(error instanceof HttpError)) console.error('list-reports failed:', error);
    return errorResponse(error);
  }
});
