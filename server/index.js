import env from './src/config/env.js';
import { connect, disconnect } from './src/config/db.js';
import createApp from './src/app.js';

async function start() {
  try {
    await connect();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`SmartResolve API listening on http://127.0.0.1:${env.port} (${env.nodeEnv})`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      // eslint-disable-next-line no-console
      console.error(`Port ${env.port} is already in use. Set PORT to a free port.`);
    } else {
      // eslint-disable-next-line no-console
      console.error('Server error:', err.message);
    }
    process.exit(1);
  });

  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`Received ${signal}, shutting down.`);
    server.close(async () => {
      await disconnect().catch(() => {});
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
