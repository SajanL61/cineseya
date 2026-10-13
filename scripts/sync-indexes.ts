import mongoose from 'mongoose';
import { connectDb } from '@/lib/db';
import { ensureCineSeyaIndexes } from '@/models';

try {
  await connectDb();
  await ensureCineSeyaIndexes();
  process.stdout.write('CineSeya MongoDB indexes are synchronized.\n');
} finally { await mongoose.disconnect(); }
