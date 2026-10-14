import { createApp } from '../server/index.js';
let application;
export default async function handler(req, res) {
  try {
    application ||= createApp().catch(error => { application = undefined; throw error; });
    const app = await application;
    await app.handle(req, res);
  } catch {
    console.error('API startup failed', {
    name: error.name,
    code: error.code,
  })
  }
}
