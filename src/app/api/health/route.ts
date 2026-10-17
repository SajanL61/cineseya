import { connectDb, DATABASE_NAME } from '@/lib/db';
import { useDemoData } from '@/lib/env';
import { r2Configured } from '@/lib/r2';
export async function GET(){
  const base={service:'cineseya',database:useDemoData?'demo':DATABASE_NAME,storage:r2Configured()?'ready':'unavailable',time:new Date().toISOString()};
  if(useDemoData)return Response.json({status:'ok',...base},{headers:{'Cache-Control':'no-store'}});
  try{const connection=await connectDb();await connection.connection.db?.admin().ping();return Response.json({status:'ok',...base},{headers:{'Cache-Control':'no-store'}});}
  catch{return Response.json({status:'unavailable',...base},{status:503,headers:{'Cache-Control':'no-store'}});}
}
