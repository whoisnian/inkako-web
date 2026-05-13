import * as esbuild from 'esbuild';
import { cp, mkdir, writeFile } from 'node:fs/promises';

const args = new Set(process.argv.slice(2));
const isServe = args.has('--serve');
const isWatch = args.has('--watch');
const isDev = isServe || isWatch;

const baseOptions = {
  entryPoints: ['src/main.jsx'],
  bundle: true,
  outdir: 'dist',
  format: 'esm',
  target: ['chrome120'],
  jsx: 'automatic',
  loader: { '.js': 'jsx' },
  sourcemap: isDev,
  minify: !isDev,
  define: {
    'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production'),
  },
  logLevel: 'info',
};

function buildHtml(jsPath, cssPath) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#1a1a1a" />
  <title>inkako Web</title>
  <link rel="icon" href="favicon.ico" />
  <script>
    (function () {
      try {
        var t = localStorage.getItem('inkako-theme');
        if (t === 'light' || t === 'dark') {
          document.documentElement.dataset.theme = t;
        }
      } catch (e) { /* ignore */ }
    })();
  </script>
  <link rel="stylesheet" href="${cssPath}" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${jsPath}"></script>
</body>
</html>
`;
}

async function generateHtml(jsPath, cssPath) {
  await mkdir('dist', { recursive: true });
  await writeFile('dist/index.html', buildHtml(jsPath, cssPath));
}

if (isDev) {
  const ctx = await esbuild.context({
    ...baseOptions,
    entryNames: 'static/bundle',
  });

  await cp('public', 'dist', { recursive: true });
  await generateHtml('static/bundle.js', 'static/bundle.css');

  if (isServe) {
    await ctx.serve({ servedir: 'dist', port: 8000, host: '0.0.0.0' });
    console.log('Note: Web Bluetooth requires HTTPS or localhost.\n');
  } else {
    await ctx.watch();
    console.log('Watching for changes...');
  }
} else {
  const result = await esbuild.build({
    ...baseOptions,
    entryNames: 'static/bundle-[hash]',
    metafile: true,
  });

  const outputs = Object.keys(result.metafile.outputs);
  const jsPath = outputs.find(p => p.endsWith('.js')).replace(/^dist\//, '');
  const cssPath = outputs.find(p => p.endsWith('.css')).replace(/^dist\//, '');

  await cp('public', 'dist', { recursive: true });
  await generateHtml(jsPath, cssPath);

  console.log('Build complete.');
}
