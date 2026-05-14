import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InkakoDevice, transferImage } from './bluetooth.js';
import {
  DEFAULT_ADJUSTMENTS,
  PALETTE,
  colorDistribution,
  loadImageBitmap,
  processImage,
} from './imageProcessor.js';
import { SCREEN_TYPES } from './protocol.js';

const SCREEN_OPTIONS = Object.entries(SCREEN_TYPES).map(([id, dims]) => ({
  id: Number(id),
  ...dims,
  label: `Type ${id} — ${dims.width}×${dims.height}`,
}));

const EXAMPLE_IMAGES = [
  'sakamoto.png',
  'sensei.png',
  'konata.png',
  'kenny_chito.png',
  'rwby_logos.png',
  'chito_yuuri.png',
  'hakumei_mikochi.jpg',
  'zelda.jpg',
  'silksong.jpg',
].map((name) => ({
  name,
  src: `examples/${name}`,
  thumb: `examples/thumbs/${name.replace(/\.(png|jpg|jpeg)$/i, '.webp')}`,
}));

const THEME_KEY = 'inkako-theme';
const THEME_OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

const FOOTER_LINKS = [
  {
    href: 'https://www.ztemall.com/cn/goodsdetail/1453',
    label: 'Product Details',
    title: 'Official product page · ZTE Mall (CN)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.59 13.41 13.41 20.59a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
  },
  {
    href: 'https://m-bbs.ztedevices.com/?master_type=0&type=6&id=657159&state=',
    label: 'User Manual',
    title: 'Official user manual · ZTE Devices BBS (CN)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    href: 'https://m-appstore.nubia.com/detail_soft.html?softId=2192555',
    label: 'Android App',
    title: 'Official Android app · Nubia App Store (CN)',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7.2 5.6 6 3.5a.5.5 0 0 1 .87-.5l1.2 2.08A7.9 7.9 0 0 1 12 4.2c1.42 0 2.76.3 3.93.88l1.2-2.08a.5.5 0 0 1 .87.5l-1.2 2.1A7.5 7.5 0 0 1 20 11.5H4a7.5 7.5 0 0 1 3.2-5.9zM9 9a.9.9 0 1 0 0-1.8A.9.9 0 0 0 9 9zm6 0a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8zM3.5 12.8a1.3 1.3 0 0 1 2.6 0v5.2a1.3 1.3 0 1 1-2.6 0zm14.4 0a1.3 1.3 0 0 1 2.6 0v5.2a1.3 1.3 0 1 1-2.6 0zM7 12.5h10v7.6a1.4 1.4 0 0 1-1.4 1.4H15v2.1a1.3 1.3 0 1 1-2.6 0V21.5h-1.8V23.6a1.3 1.3 0 1 1-2.6 0V21.5h-.6A1.4 1.4 0 0 1 7 20.1z" />
      </svg>
    ),
  },
  {
    href: 'https://apps.apple.com/cn/app/inkbloom/id6462630055',
    label: 'InkBloom (iOS)',
    title: 'Unofficial iOS alternative · InkBloom on App Store (CN)',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.05 12.04c-.03-2.93 2.4-4.34 2.51-4.41-1.37-2-3.5-2.28-4.26-2.31-1.81-.18-3.54 1.07-4.46 1.07-.93 0-2.35-1.04-3.87-1.01-1.99.03-3.83 1.16-4.85 2.94-2.07 3.59-.53 8.91 1.49 11.83 1 1.43 2.18 3.04 3.71 2.98 1.49-.06 2.05-.96 3.86-.96 1.8 0 2.31.96 3.88.93 1.6-.03 2.62-1.46 3.6-2.9 1.14-1.66 1.6-3.27 1.63-3.36-.04-.02-3.12-1.2-3.15-4.76M14.31 4.04c.82-1 1.38-2.38 1.22-3.77-1.18.05-2.62.79-3.47 1.78-.76.87-1.43 2.27-1.25 3.62 1.32.1 2.66-.67 3.5-1.63" />
      </svg>
    ),
  },
  {
    href: 'https://github.com/whoisnian/inkako-web',
    label: 'inkako-web',
    title: 'GitHub source · whoisnian/inkako-web',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 .5C5.4.5 0 5.9 0 12.5c0 5.3 3.4 9.8 8.2 11.4.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.8-1.6 8.2-6.1 8.2-11.4C24 5.9 18.6.5 12 .5z" />
      </svg>
    ),
  },
  {
    href: 'https://github.com/whoisnian/misc/tree/master/cmd/inkako',
    label: 'inkako CLI',
    title: 'Alternative Go/Python reverse-engineered implementation',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
];

const COMPAT_LIST = [
  { ok: true,  browser: 'Chrome',   platform: 'Android', title: 'Tested on Chrome for Android — Web Bluetooth works.' },
  { ok: true,  browser: 'Chrome',   platform: 'Windows', title: 'Tested on Chrome for Windows — Web Bluetooth works.' },
  { ok: true,  browser: 'Bluefy',   platform: 'iOS',     title: 'Tested on Bluefy — Web BLE browser for iOS.', href: 'https://apps.apple.com/cn/app/bluefy-web-ble-browser/id1492822055' },
  { ok: false, browser: 'Chromium', platform: 'Linux',   title: 'Fails on Chromium for Linux: "No Services matching UUID 79223401-1a11-21e1-8300-0940a1146603 found in Device".' },
];

function readSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* ignore */ }
  return 'auto';
}

function fmtTime(date = new Date()) {
  return date.toTimeString().slice(0, 8);
}

export default function App() {
  const [supported] = useState(() =>
    typeof navigator !== 'undefined' && !!navigator.bluetooth,
  );

  const [theme, setTheme] = useState(readSavedTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') {
      delete root.dataset.theme;
      try { localStorage.removeItem(THEME_KEY); } catch { /* ignore */ }
    } else {
      root.dataset.theme = theme;
      try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
    }
  }, [theme]);

  const deviceRef = useRef(null);
  if (deviceRef.current === null) deviceRef.current = new InkakoDevice();

  const [connState, setConnState] = useState('disconnected'); // disconnected | connecting | connected
  const [deviceName, setDeviceName] = useState('');

  const [screenType, setScreenType] = useState(8);
  const screenDims = SCREEN_TYPES[screenType];

  const [imageBitmap, setImageBitmap] = useState(null);
  const [imageName, setImageName] = useState('');
  const [loadingExample, setLoadingExample] = useState('');

  const [adjustments, setAdjustments] = useState(DEFAULT_ADJUSTMENTS);
  const [dither, setDither] = useState(true);
  const [imageIndex, setImageIndex] = useState(1);

  const [processed, setProcessed] = useState(null); // { indices, packed, preview, distribution }
  const [processing, setProcessing] = useState(false);

  const [transferring, setTransferring] = useState(false);
  const [progress, setProgress] = useState({ row: 0, total: 0 });
  const abortRef = useRef(null);

  const [log, setLog] = useState([]);
  const logRef = useRef(null);

  const sourceCanvasRef = useRef(null);
  const previewCanvasRef = useRef(null);

  const appendLog = useCallback((message, level = 'info') => {
    setLog((prev) => {
      const next = prev.concat({ time: fmtTime(), level, message });
      return next.length > 200 ? next.slice(-200) : next;
    });
  }, []);

  // Auto-scroll log to bottom when new entries arrive.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // Wire device disconnect callback.
  useEffect(() => {
    const device = deviceRef.current;
    device.onDisconnect = () => {
      setConnState('disconnected');
      setDeviceName('');
      appendLog('Device disconnected', 'warn');
    };
    return () => { device.onDisconnect = null; };
  }, [appendLog]);

  const handleConnect = useCallback(async () => {
    if (connState === 'connecting') return;
    if (connState === 'connected') {
      try { await deviceRef.current.disconnect(); } catch { /* ignore */ }
      setConnState('disconnected');
      setDeviceName('');
      appendLog('Disconnected.');
      return;
    }
    setConnState('connecting');
    appendLog('Requesting device...');
    try {
      const info = await deviceRef.current.connect();
      setDeviceName(info.name);
      setConnState('connected');
      appendLog(`Connected to ${info.name}`, 'ok');
    } catch (err) {
      setConnState('disconnected');
      appendLog(`Connect failed: ${err.message || err}`, 'err');
    }
  }, [connState, appendLog]);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    try {
      const bm = await loadImageBitmap(file);
      setImageBitmap(bm);
      setImageName(file.name);
      appendLog(`Loaded ${file.name} (${bm.width}×${bm.height})`);
    } catch (err) {
      appendLog(`Failed to load image: ${err.message || err}`, 'err');
    }
  }, [appendLog]);

  const handleExample = useCallback(async (example) => {
    const SHOW_DELAY_MS = 100;
    const showTimer = setTimeout(() => {
      setLoadingExample(example.name);
    }, SHOW_DELAY_MS);
    try {
      const res = await fetch(example.src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const bm = await loadImageBitmap(blob);
      setImageBitmap(bm);
      setImageName(example.name);
      appendLog(`Loaded example ${example.name} (${bm.width}×${bm.height})`);
    } catch (err) {
      appendLog(`Failed to load example: ${err.message || err}`, 'err');
    } finally {
      clearTimeout(showTimer);
      setLoadingExample((cur) => (cur === example.name ? '' : cur));
    }
  }, [appendLog]);

  // Snap preview CSS size so each canvas pixel maps to an integer
  // number of device pixels (or canvas pixels per device pixel when
  // the canvas is larger than the cap). Keeps the preview crisp under
  // any window.devicePixelRatio.
  useEffect(() => {
    const root = document.documentElement;
    const maxCssDim = 428;
    const apply = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width: cw, height: ch } = screenDims;
      const longest = Math.max(cw, ch);
      const target = (maxCssDim * dpr) / longest;
      const ratio = target >= 1 ? Math.floor(target) : 1 / Math.ceil(1 / target);
      root.style.setProperty('--preview-css-w', `${(ratio * cw) / dpr}px`);
      root.style.setProperty('--preview-aspect', `${cw} / ${ch}`);
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [screenDims.width, screenDims.height]);

  // Draw the source image onto the source canvas at screen dimensions.
  // Leave the pixel buffer transparent when empty so the canvas's CSS
  // background (--canvas-bg) shows through and follows the active theme.
  useEffect(() => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;
    canvas.width = screenDims.width;
    canvas.height = screenDims.height;
    if (imageBitmap) {
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
    }
  }, [imageBitmap, screenDims.width, screenDims.height]);

  // Re-process the image whenever any input changes (debounced).
  useEffect(() => {
    if (!imageBitmap) {
      setProcessed(null);
      return;
    }
    let cancelled = false;
    setProcessing(true);
    const timer = setTimeout(async () => {
      try {
        const t0 = performance.now();
        const result = await processImage(imageBitmap, {
          width: screenDims.width,
          height: screenDims.height,
          ...adjustments,
          dither,
        });
        const elapsed = Math.round(performance.now() - t0);
        if (cancelled) return;
        const distribution = colorDistribution(result.indices);
        setProcessed({ ...result, distribution, elapsed });
      } catch (err) {
        if (!cancelled) appendLog(`Processing failed: ${err.message || err}`, 'err');
      } finally {
        if (!cancelled) setProcessing(false);
      }
    }, 80);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [imageBitmap, screenDims.width, screenDims.height, adjustments, dither, appendLog]);

  // Render processed preview onto its canvas. When there's nothing to
  // render, leave the buffer transparent and let --canvas-bg show through.
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    canvas.width = screenDims.width;
    canvas.height = screenDims.height;
    if (processed && processed.preview) {
      canvas.getContext('2d').putImageData(processed.preview, 0, 0);
    }
  }, [processed, screenDims.width, screenDims.height]);

  const handleSend = useCallback(async () => {
    if (transferring || !processed || connState !== 'connected') return;
    setTransferring(true);
    setProgress({ row: 0, total: 0 });
    abortRef.current = new AbortController();
    try {
      await transferImage(deviceRef.current, processed.packed, {
        screenInfo: screenType,
        imageIndex,
        width: screenDims.width,
        log: (msg) => appendLog(msg),
        onProgress: (row, total) => setProgress({ row, total }),
        signal: abortRef.current.signal,
      });
      appendLog('Image transferred and refresh triggered.', 'ok');
    } catch (err) {
      appendLog(`Transfer failed: ${err.message || err}`, 'err');
    } finally {
      setTransferring(false);
      abortRef.current = null;
    }
  }, [transferring, processed, connState, screenType, imageIndex, screenDims.width, appendLog]);

  const handleAbort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      appendLog('Aborting transfer...', 'warn');
    }
  }, [appendLog]);

  const handleResetAdjustments = useCallback(() => {
    setAdjustments(DEFAULT_ADJUSTMENTS);
  }, []);

  const adjustmentLabels = useMemo(() => ({
    brightness: { min: 0, max: 100, factor: 50, format: (v) => (v / 50).toFixed(2) },
    contrast:   { min: 0, max: 100, factor: 20, format: (v) => (v / 20).toFixed(2) },
    saturation: { min: 0, max: 100, factor: 20, format: (v) => (v / 20).toFixed(2) },
  }), []);

  const progressPct = progress.total > 0 ? (progress.row / progress.total) * 100 : 0;

  return (
    <div className="app">
      <header>
        <h1><span className="accent">inkako</span> · Web Bluetooth Uploader</h1>
        <div className="header-right">
          <span className="sub">4-color e-ink (BWYR) image converter</span>
          <div className="theme-toggle" role="group" aria-label="Theme">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={theme === opt.id ? 'active' : ''}
                aria-pressed={theme === opt.id}
                onClick={() => setTheme(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {!supported && (
        <div className="banner">
          Web Bluetooth is not available in this browser. Please use Chrome on
          desktop or Android. (iOS does not support Web Bluetooth.)
        </div>
      )}

      <section className="panel">
        <h2>Device</h2>
        <div className="row">
          <button
            className={connState === 'connected' ? 'danger' : 'primary'}
            onClick={handleConnect}
            disabled={!supported || connState === 'connecting' || transferring}
          >
            {connState === 'connecting'
              ? 'Connecting…'
              : connState === 'connected' ? 'Disconnect' : 'Scan & Connect'}
          </button>
          <span className={`status-pill ${connState === 'connected' ? 'connected' : ''}`}>
            <span className="dot" />
            {connState === 'connected'
              ? `Connected to ${deviceName}`
              : connState === 'connecting' ? 'Connecting…' : 'Not connected'}
          </span>
          <span className="spacer" />
          <label className="muted" htmlFor="screen-select">Screen:</label>
          <select
            id="screen-select"
            value={screenType}
            onChange={(e) => setScreenType(Number(e.target.value))}
            disabled={transferring}
          >
            {SCREEN_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
          <label className="muted" htmlFor="image-index">Slot:</label>
          <select
            id="image-index"
            value={imageIndex}
            onChange={(e) => setImageIndex(Number(e.target.value))}
            disabled={transferring}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="panel">
        <h2>Image</h2>
        <div className="row">
          <label className="file-label">
            Choose Image…
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
          <span className="muted">
            {imageName || 'No file selected'}
            {imageBitmap && ` · source ${imageBitmap.width}×${imageBitmap.height}`}
          </span>
        </div>
        <div className="examples">
          <span className="muted examples-label">Examples:</span>
          {EXAMPLE_IMAGES.map((ex) => (
            <button
              key={ex.name}
              type="button"
              className={`example${imageName === ex.name ? ' active' : ''}${loadingExample === ex.name ? ' loading' : ''}`}
              onClick={() => handleExample(ex)}
              disabled={loadingExample === ex.name}
              title={ex.name}
            >
              <img src={ex.thumb} alt={ex.name} loading="lazy" />
              {loadingExample === ex.name && <span className="example-spinner" aria-hidden="true" />}
            </button>
          ))}
        </div>
        <div className="previews" style={{ marginTop: 12 }}>
          <div className="preview">
            <span className="label">Original (resized)</span>
            <canvas ref={sourceCanvasRef} />
          </div>
          <div className="preview">
            <span className="label">
              Preview {processing ? '(processing…)' : processed ? `(${processed.elapsed} ms)` : ''}
            </span>
            <canvas ref={previewCanvasRef} />
          </div>
        </div>
        {processed && (
          <div className="distribution">
            {processed.distribution.map((item) => (
              <span key={item.index} className="swatch">
                <span
                  className="chip"
                  style={{ background: `rgb(${PALETTE[item.index].join(',')})` }}
                />
                {item.name}: {item.percent.toFixed(1)}%
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Adjustments</h2>
        <div className="sliders">
          {(['brightness', 'contrast', 'saturation']).map((key) => {
            const cfg = adjustmentLabels[key];
            return (
              <Slider
                key={key}
                name={key}
                value={adjustments[key]}
                min={cfg.min}
                max={cfg.max}
                onChange={(v) => setAdjustments((a) => ({ ...a, [key]: v }))}
                format={cfg.format}
              />
            );
          })}
          <div className="reset-row">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={dither}
                onChange={(e) => setDither(e.target.checked)}
              />
              Floyd-Steinberg dithering
            </label>
            <span className="spacer" style={{ flex: 1 }} />
            <button onClick={handleResetAdjustments}>Reset to defaults</button>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Transfer</h2>
        <div className="row">
          {transferring ? (
            <button className="danger" onClick={handleAbort}>Abort</button>
          ) : (
            <button
              className="primary"
              onClick={handleSend}
              disabled={!processed || connState !== 'connected'}
            >
              Send to Device
            </button>
          )}
          <span className="muted">
            {processed
              ? `Output: ${processed.packed.length} bytes`
              : 'Load an image to enable sending'}
          </span>
          <span className="spacer" />
          <span className="muted">
            {progress.total > 0
              ? `Row ${progress.row}/${progress.total} (${progressPct.toFixed(0)}%)`
              : '—'}
          </span>
        </div>
        <div className="progress" style={{ marginTop: 10 }}>
          <div style={{ width: `${progressPct}%` }} />
        </div>
        <h2 style={{ marginTop: 14 }}>Log</h2>
        <div className="log" ref={logRef}>
          {log.length === 0 && <span className="muted">No log entries yet.</span>}
          {log.map((entry, i) => (
            <div key={i} className={entry.level}>
              <span className="ts">[{entry.time}]</span>
              {entry.message}
            </div>
          ))}
        </div>
      </section>

      <footer className="app-footer">
        <div className="footer-row">
          <span className="footer-label">Tested:</span>
          {COMPAT_LIST.map((c) => {
            const className = `tested-chip ${c.ok ? 'ok' : 'err'}${c.href ? ' is-link' : ''}`;
            const body = (
              <>
                <span aria-hidden="true" className="mark">{c.ok ? '✓' : '✗'}</span>
                {c.browser} · {c.platform}
              </>
            );
            return c.href ? (
              <a
                key={`${c.browser}-${c.platform}`}
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                title={c.title}
                className={className}
              >
                {body}
              </a>
            ) : (
              <span
                key={`${c.browser}-${c.platform}`}
                className={className}
                title={c.title}
              >
                {body}
              </span>
            );
          })}
          <a
            className="footer-spec"
            href="https://github.com/WebBluetoothCG/web-bluetooth/blob/main/implementation-status.md"
            target="_blank"
            rel="noopener noreferrer"
            title="WebBluetoothCG implementation status"
          >
            spec status ↗
          </a>
        </div>
        <div className="footer-row">
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              title={link.title}
              className="footer-link"
            >
              {link.icon}
              <span>{link.label}</span>
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}

function Slider({ name, value, min, max, onChange, format }) {
  return (
    <>
      <label htmlFor={`s-${name}`} style={{ textTransform: 'capitalize' }}>{name}</label>
      <input
        id={`s-${name}`}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="value">
        {value}
        <span className="muted"> · {format(value)}×</span>
      </span>
    </>
  );
}
