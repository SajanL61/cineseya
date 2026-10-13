import JSZip from 'jszip';
import { demoSubtitles } from '@/data/demo';
import { connectDb } from '@/lib/db';
import { useDemoData } from '@/lib/env';
import { apiError } from '@/lib/http';
import { enforceRateLimit, requestClientKey } from '@/lib/rate-limit';
import { signedDownloadUrl } from '@/lib/r2';
import { DownloadEvent, Subtitle } from '@/models';
import { recordAnalyticsEvent } from '@/services/analytics';

const ALLOWED_FORMATS = new Set(['srt','ass','vtt','zip']);
const safeName = (name:string) => name.replace(/[^a-zA-Z0-9._-]/g,'_');
function demoSrt(title:string){return `1\n00:00:01,000 --> 00:00:04,000\n${title} — CineSeya.lk demonstration subtitle\n\n2\n00:00:05,000 --> 00:00:09,000\nමෙය ආරක්ෂිත නිරූපණ උපසිරැසි ගොනුවකි.\n`;}

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    await enforceRateLimit(request,'subtitle-download',30,10*60_000);
    const {id}=await params;
    if(useDemoData){
      const subtitle=demoSubtitles.find(item=>item.id===id);
      if(!subtitle||subtitle.status!=='published')throw Object.assign(new Error('Subtitle is unavailable'),{status:404,code:'NOT_FOUND'});
      const filename=safeName(subtitle.fileName);
      if(subtitle.format==='zip'){
        const zip=new JSZip();zip.file(filename.replace(/\.zip$/i,'.srt'),demoSrt(subtitle.contentTitle));
        const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
        return new Response(Uint8Array.from(bytes).buffer,{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
      }
      const content=demoSrt(subtitle.contentTitle);
      return new Response(content,{headers:{'Content-Type':'text/plain; charset=utf-8','Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    }
    await connectDb();
    const subtitle=await Subtitle.findOne({_id:id,status:'published'});
    if(!subtitle)throw Object.assign(new Error('Subtitle is unavailable'),{status:404,code:'NOT_FOUND'});
    if(!ALLOWED_FORMATS.has(String(subtitle.format)))throw Object.assign(new Error('Subtitle format is not permitted'),{status:422,code:'FORMAT_BLOCKED'});
    const [url]=await Promise.all([
      signedDownloadUrl(String(subtitle.fileKey),safeName(String(subtitle.fileName))),
      Subtitle.updateOne({_id:subtitle._id},{$inc:{downloadCount:1}}),
      DownloadEvent.create({kind:'subtitle',targetId:subtitle._id,contentId:subtitle.movie??subtitle.episode,ipHash:requestClientKey(request)}),
      recordAnalyticsEvent(request,{eventType:'subtitle_download',contentType:'subtitle',contentId:String(subtitle._id)}),
    ]);
    return Response.redirect(url,302);
  }catch(error){return apiError(error)}
}
