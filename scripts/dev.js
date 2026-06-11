import { createServer } from 'vite';

async function start() {
  try {
    const server = await createServer();
    await server.listen();
    server.printUrls();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

start();
