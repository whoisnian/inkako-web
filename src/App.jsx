import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InkakoDevice, transferImage } from './bluetooth.js';
import {
  DEFAULT_ADJUSTMENTS,
  PALETTE,
  PALETTE_NAMES,
  colorDistribution,
  indicesToImageData,
  loadImageBitmap,
  processImage,
} from './imageProcessor.js';
import { SCREEN_TYPES } from './protocol.js';

const SCREEN_OPTIONS = Object.entries(SCREEN_TYPES).map(([id, dims]) => ({
  id: Number(id),
  ...dims,
  label: `Type ${id} — ${dims.width}×${dims.height}`,
}));

function fmtTime(date = new Date()) {
  return date.toTimeString().slice(0, 8);
}

export default function App() {
  const [supported] = useState(() =>
    typeof navigator !== 'undefined' && !!navigator.bluetooth,
  );

  const deviceRef = useRef(null);
  if (deviceRef.current === null) deviceRef.current = new InkakoDevice();

  const [connState, setConnState] = useState('disconnected'); // disconnected | connecting | connected
  const [deviceName, setDeviceName] = useState('');

  const [screenType, setScreenType] = useState(8);
  const screenDims = SCREEN_TYPES[screenType];

  const [imageBitmap, setImageBitmap] = useState(null);
  const [imageName, setImageName] = useState('');

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
      try { await deviceRef.current.disconnect(); } catch {}
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

  // Draw the source image onto the source canvas at screen dimensions.
  useEffect(() => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;
    canvas.width = screenDims.width;
    canvas.height = screenDims.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (imageBitmap) {
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

  // Render processed preview onto its canvas.
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    canvas.width = screenDims.width;
    canvas.height = screenDims.height;
    const ctx = canvas.getContext('2d');
    if (processed && processed.preview) {
      ctx.putImageData(processed.preview, 0, 0);
    } else {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
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
        <span className="sub">4-color e-ink (BWYR) image converter</span>
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
