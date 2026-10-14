// Compila a app React (client/) para a pasta public/, que o servidor mostra.
// Uso: npm run build   ·   npm run build -- --watch (recompila ao gravar)
import * as esbuild from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';

import { config } from '../server/config.js';
const storageOrigin = config.supabaseUrl ? new URL(config.supabaseUrl).origin : '';
const csp = `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self' ${storageOrigin}; base-uri 'self'; form-action 'self'`;
const watch = process.argv.includes('--watch');
const out = 'public';
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/assets`, { recursive: true });

const version = Date.now().toString(36);
const writeHtml = () => writeFileSync(`${out}/index.html`, readFileSync('client/index.html', 'utf8').replaceAll('__V__', version).replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${csp}">`));

const options = {
  entryPoints: { app: 'client/src/main.jsx' },
  outdir: `${out}/assets`,
  bundle: true,
  format: 'esm',
  target: ['es2020', 'safari15'],
  jsx: 'automatic',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  loader: { '.json': 'json' },
  define: { 'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production') },
  legalComments: 'none',
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  writeHtml();
  await ctx.watch();
} else {
  await esbuild.build(options);
  writeHtml();
  console.log(`Pronto: ${out}/ (versão ${version})`);
}
