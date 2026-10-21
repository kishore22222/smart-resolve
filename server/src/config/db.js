import mongoose from 'mongoose';
import env from './env.js';

let connectionPromise = null;

/**
 * Connect to MongoDB. The single connection is memoized so repeated calls (for
 * example from tests plus the server bootstrap) never open duplicate pools.
 */
export function connect(uri = env.mongoUri) {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (connectionPromise) return connectionPromise;

  mongoose.set('strictQuery', true);
  connectionPromise = mongoose
    .connect(uri, { serverSelectionTimeoutMS: 10000 })
    .then(() => mongoose.connection)
    .catch((err) => {
      connectionPromise = null; // allow a retry after a failed attempt
      throw err;
    });

  return connectionPromise;
}

export function disconnect() {
  connectionPromise = null;
  return mongoose.disconnect();
}

export { mongoose };
