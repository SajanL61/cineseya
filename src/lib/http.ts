import { ZodError } from 'zod';

export function apiError(error: unknown) {
  if (error instanceof ZodError) return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Please review the submitted fields.', fields: error.flatten().fieldErrors } }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  if (error instanceof SyntaxError) return Response.json({ error: { code: 'INVALID_JSON', message: 'The request body is not valid JSON.' } }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  const value = error as { status?: number; code?: string; message?: string; expose?: boolean };
  const status = value.status && value.status >= 400 && value.status < 600 ? value.status : 500;
  const message = status >= 500 && !value.expose ? 'The service could not complete this request.' : value.message ?? 'The request could not be completed.';
  return Response.json({ error: { code: value.code ?? 'INTERNAL_ERROR', message } }, { status, headers: { 'Cache-Control': 'no-store' } });
}
