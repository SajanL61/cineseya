import { isValidObjectId } from 'mongoose';
import { notFound } from 'next/navigation';
import { MovieForm } from '@/components/admin/movie-form';
import { requirePagePermission } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { Movie } from '@/models';
import { MediaVersionManager, type VersionRow } from '@/components/admin/enhanced-media-version-manager';
import { getAdminMediaVersions } from '@/services/admin';
import { MasterStreamUpload, type JobRow } from '@/components/admin/master-stream-upload';
import { getAdminTranscodeJobsForContent } from '@/services/transcoding';
export const metadata={title:'Edit movie'};
export default async function EditMoviePage({params}:PageProps<'/admin/movies/[id]'>){const{user}=await requirePagePermission('content.update','/admin/movies');const{id}=await params;if(!isValidObjectId(id))notFound();await connectDb();const[movie,versions,jobs]=await Promise.all([Movie.findById(id).lean(),user.permissions.includes('media.read')?getAdminMediaVersions(id):Promise.resolve([]),user.permissions.includes('media.read')?getAdminTranscodeJobsForContent(id,'movie'):Promise.resolve([])]);if(!movie)notFound();const initial=JSON.parse(JSON.stringify(movie));return <><header className="admin-page-head"><div><span>Catalog editor</span><h1>Edit {String(movie.title)}</h1><p>Changes are validated, permission-checked and written to the audit trail.</p></div></header><MovieForm initial={initial}/>{user.permissions.includes('media.upload')&&<><MasterStreamUpload contentId={id} rightsStatus={String(movie.rightsStatus)} initialJobs={jobs as unknown as JobRow[]}/><MediaVersionManager contentId={id} initialVersions={versions as unknown as VersionRow[]}/></>}</>;}
