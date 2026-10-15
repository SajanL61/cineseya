import { isValidObjectId } from 'mongoose';
import { adminMovieSchema, moviePublicationPatchSchema } from '@/lib/validation/movie';
import { assertMutationRequest, requirePermission } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { AuditLog, Movie } from '@/models';

const validId=(id:string)=>{if(!isValidObjectId(id))throw Object.assign(new Error('Movie was not found.'),{status:404,code:'NOT_FOUND'});};
export async function GET(_request:Request,{params}:RouteContext<'/api/admin/movies/[id]'>){try{await requirePermission('content.read');const{id}=await params;validId(id);await connectDb();const movie=await Movie.findById(id).lean();if(!movie)throw Object.assign(new Error('Movie was not found.'),{status:404,code:'NOT_FOUND'});return Response.json({movie},{headers:{'Cache-Control':'private, no-store'}});}catch(error){return apiError(error);}}
export async function PATCH(request: Request, { params }: RouteContext<'/api/admin/movies/[id]'>) {
  try {
    const session = await requirePermission('content.update');
    await assertMutationRequest(request, session);
    const { id } = await params;
    validId(id);
    const body = await request.json();
    const publishOnly = body && typeof body === 'object' && Object.keys(body).length === 1 && body.publicationStatus === 'published';
    const input = publishOnly ? moviePublicationPatchSchema.parse(body) : adminMovieSchema.parse(body);
    if (input.publicationStatus === 'published' && !session.user.permissions.includes('content.publish')) throw Object.assign(new Error('Publishing permission is required.'), { status: 403, code: 'FORBIDDEN' });
    await connectDb();
    const prior = await Movie.findById(id);
    if (!prior) throw Object.assign(new Error('Movie was not found.'), { status: 404, code: 'NOT_FOUND' });
    const previousStatus = prior.publicationStatus;
    const firstPublish = input.publicationStatus === 'published' && previousStatus !== 'published';
    prior.set({ ...input, publishedAt: firstPublish ? new Date() : prior.publishedAt, updatedBy: session.user.id });
    await prior.save();
    await AuditLog.create({ actor: session.user.id, action: publishOnly ? 'movie.publish' : 'movie.update', entity: 'Movie', entityId: id, metadata: { title: prior.title, previousStatus, publicationStatus: prior.publicationStatus, rightsStatus: prior.rightsStatus } });
    return Response.json({ id, slug: prior.slug, publicationStatus: prior.publicationStatus });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return Response.json({ error: { code: 'SLUG_EXISTS', message: 'That movie slug is already in use.' } }, { status: 409 });
    return apiError(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext<'/api/admin/movies/[id]'>) {
  try {
    const session = await requirePermission('content.archive');
    await assertMutationRequest(request, session);
    const { id } = await params;
    validId(id);
    await connectDb();
    const current = await Movie.findById(id).select('title publicationStatus').lean();
    if (!current) throw Object.assign(new Error('Movie was not found.'), { status: 404, code: 'NOT_FOUND' });
    if (current.publicationStatus === 'archived') return Response.json({ ok: true, id, publicationStatus: 'archived' });
    const movie = await Movie.findOneAndUpdate({ _id: id, publicationStatus: { $ne: 'archived' } }, { publicationStatus: 'archived', updatedBy: session.user.id }, { new: true });
    if (!movie) throw Object.assign(new Error('This movie was changed by another administrator. Reload the list and try again.'), { status: 409, code: 'ARCHIVE_CONFLICT' });
    await AuditLog.create({ actor: session.user.id, action: 'movie.archive', entity: 'Movie', entityId: id, metadata: { title: movie.title, previousStatus: current.publicationStatus, recordPreserved: true, linkedMediaPreserved: true, subtitlesPreserved: true } });
    return Response.json({ ok: true, id, publicationStatus: 'archived' });
  } catch (error) {
    return apiError(error);
  }
}
