import { beforeAll, afterAll, beforeEach } from '@jest/globals';
import { connect, disconnect, mongoose } from '../src/config/db.js';

beforeAll(async () => {
  await connect(process.env.MONGODB_URI);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnect();
});

beforeEach(async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});
