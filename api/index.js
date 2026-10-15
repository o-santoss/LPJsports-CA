import { createApp } from '../server/index.js';

let application;

export default async function handler(req, res) {
  try {
    application ||= createApp().catch(error => {
      application = undefined;
      throw error;
    });

    const app = await application;
    await app.handle(req, res);
  } catch (error) {
    console.error('API_STARTUP_ERROR', {
      name: error?.name,
      code: error?.code,
      message: String(error?.message || 'startup failed').replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[redacted]').replace(/sb_secret_[\w-]+/g, '[redacted]'),
    });

    res.writeHead(503, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });

    res.end(JSON.stringify({
      error: 'Serviço temporariamente indisponível.',
    }));
  }
}