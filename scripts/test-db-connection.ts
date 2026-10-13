import { Types } from 'mongoose';
import { connectDb, DATABASE_NAME, disconnectDb } from '@/lib/db';

const expectedDatabase = 'cinerusubs';

async function main() {
  const connection = await connectDb();
  const database = connection.connection.db;
  if (!database || database.databaseName !== expectedDatabase || DATABASE_NAME !== expectedDatabase) {
    throw new Error('Database safety verification failed.');
  }

  const testId = new Types.ObjectId();
  const movies = database.collection('movies');
  try {
    await movies.insertOne({
      _id: testId,
      title: 'CineSeya Database Test',
      publicationStatus: 'draft',
    });
    const saved = await movies.findOne({
      _id: testId,
      title: 'CineSeya Database Test',
      publicationStatus: 'draft',
    });
    if (!saved) throw new Error('Temporary database record could not be read back.');

    process.stdout.write('MongoDB connected successfully\n');
    process.stdout.write('Database: ' + database.databaseName + '\n');
  } finally {
    await movies.deleteOne({ _id: testId });
    await disconnectDb();
  }
}

main().catch(() => {
  process.stderr.write('MongoDB connection test failed. No connection details were logged.\n');
  process.exitCode = 1;
});
