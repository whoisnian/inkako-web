import * as esbuild from 'esbuild';

const args = new Set(process.argv.slice(2));
const isServe = args.has('--serve');
const isWatch = args.has('--watch');
const isDev = isServe || isWatch;

const ctx = await esbuild.context({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  outfile: 'dist/bundle.js',
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
});

if (isServe) {
  await ctx.serve({ servedir: '.', port: 8000, host: '0.0.0.0' });
  console.log('Note: Web Bluetooth requires HTTPS or localhost.\n');
} else if (isWatch) {
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('Build complete.');
}
