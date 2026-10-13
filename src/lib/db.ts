import mongoose from 'mongoose';
import { env, useDemoData } from './env';

const DATABASE_NAME = 'cinerusubs' as const;

type Cache = { connection: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const globalWithMongoose = globalThis as typeof globalThis & { __cineseyaMongoose?: Cache };
const cache = globalWithMongoose.__cineseyaMongoose ?? { connection: null, promise: null };
globalWithMongoose.__cineseyaMongoose = cache;

export async function connectDb() {
  if (useDemoData) throw new Error('MongoDB is unavailable while CineSeya.lk demo mode is active');
  if (env.MONGODB_DB !== DATABASE_NAME) throw new Error('CineSeya.lk must use the isolated cinerusubs database');
  if (cache.connection) {
    assertConnectedDatabase(cache.connection);
    return cache.connection;
  }
  cache.promise ??= mongoose.connect(env.MONGODB_URI!, {
    dbName: DATABASE_NAME,
    autoIndex: env.NODE_ENV !== 'production',
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 8_000,
  });
  cache.connection = await cache.promise;
  assertConnectedDatabase(cache.connection);
  return cache.connection;
}

export function assertCineSeyaDatabaseName(databaseName: string | undefined) {
  if (databaseName?.toLocaleLowerCase() === 'smartreact') throw new Error('CRITICAL: CineSeya.lk refused to connect to the protected SmartReact database.');
  if (databaseName !== DATABASE_NAME) {
    throw new Error(`CRITICAL: CineSeya.lk expected database "${DATABASE_NAME}" but connected to "${databaseName ?? 'unknown'}".`);
  }
}

function assertConnectedDatabase(connection: typeof mongoose) {
  try {
    assertCineSeyaDatabaseName(connection.connection.db?.databaseName);
  } catch (error) {
    void connection.disconnect();
    cache.connection = null;
    cache.promise = null;
    throw error;
  }
}

export async function disconnectDb() {
  if (cache.connection) await mongoose.disconnect();
  cache.connection = null;
  cache.promise = null;
}

export { DATABASE_NAME };
