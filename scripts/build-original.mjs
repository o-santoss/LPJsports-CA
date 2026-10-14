// Compila a app React (client/) para a pasta public/, que o servidor mostra.
// Uso: npm run build   ·   npm run build -- --watch (recompila ao gravar)
import * as esbuild from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const out = 'public';
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/assets`, { recursive: true });

const version = Date.now().toString(36);
const writeHtml = () => writeFileSync(`${out}/index.html`, readFileSync('client/index.html', 'utf8').replaceAll('__V__', version));

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
