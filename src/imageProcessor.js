// 4-color palette: 0=Black, 1=White, 2=Yellow, 3=Red (matches BLE encoding)
export const PALETTE = [
  [0, 0, 0],
  [255, 255, 255],
  [255, 255, 0],
  [255, 0, 0],
];
export const PALETTE_NAMES = ['Black', 'White', 'Yellow', 'Red'];

export const DEFAULT_ADJUSTMENTS = {
  brightness: 51, // → 1.02
  contrast: 30,   // → 1.50
  saturation: 23, // → 1.15
};

// Load a File or Blob into an ImageBitmap (decoded off the main thread by the UA)
export async function loadImageBitmap(blob) {
  return await createImageBitmap(blob);
}

// Resize a source bitmap to (w, h) using bilinear filtering, returning ImageData
export function resizeToImageData(bitmap, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

// Apply brightness/contrast/saturation adjustments to RGBA buffer in place.
// Mirrors apply_color_adjustments() from inkako.py.
export function applyColorAdjustments(rgba, { brightness = 51, contrast = 30, saturation = 23 } = {}) {
  const b = brightness / 50;
  const c = contrast / 20;
  const s = saturation / 20;

  let satR = 1, satG = 1;
  if (s !== 1) {
    const d = s - 1;
    satR = 1 + 0.3 * d;
    satG = 1 + 0.15 * d;
  }
  const satB = 1;

  const contrastOffset = (1 - c) * 0.5 * 255;
  const brightnessOffset = (b - 1) * 255;
  const offset = contrastOffset + brightnessOffset;

  const mr = c * satR;
  const mg = c * satG;
  const mb = c * satB;

  for (let i = 0; i < rgba.length; i += 4) {
    let r = rgba[i] * mr + offset;
    let g = rgba[i + 1] * mg + offset;
    let bl = rgba[i + 2] * mb + offset;
    rgba[i] = r < 0 ? 0 : r > 255 ? 255 : r | 0;
    rgba[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g | 0;
    rgba[i + 2] = bl < 0 ? 0 : bl > 255 ? 255 : bl | 0;
  }
  return rgba;
}

// Floyd-Steinberg dither with weighted color distance, matching the native
// PicDither + applyErrorDiffusion: 4-color BWYR palette (BLE order), integer
// error diffusion with C-style truncation, [0,255] clamping per pixel.
//   Returns Uint8Array(width*height) with palette indices 0..3.
export function floydSteinbergDither(rgba, width, height) {
  const buf = new Int16Array(width * height * 3);
  for (let i = 0, j = 0; j < buf.length; i += 4, j += 3) {
    buf[j] = rgba[i];
    buf[j + 1] = rgba[i + 1];
    buf[j + 2] = rgba[i + 2];
  }

  const result = new Uint8Array(width * height);

  // Palette in BLE order: Black, White, Yellow, Red.
  const palR = [0, 255, 255, 255];
  const palG = [0, 255, 255, 0];
  const palB = [0, 255, 0, 0];

  // Squared luma weights baked in (avoids one multiply per channel).
  const wr2 = 0.299 * 0.299;
  const wg2 = 0.587 * 0.587;
  const wb2 = 0.114 * 0.114;

  const w3 = width * 3;

  for (let y = 0; y < height; y++) {
    const rowOff = y * w3;
    const nextOff = y < height - 1 ? rowOff + w3 : -1;
    for (let x = 0; x < width; x++) {
      const idx = rowOff + x * 3;
      const r = buf[idx];
      const g = buf[idx + 1];
      const b = buf[idx + 2];

      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < 4; i++) {
        const dr = r - palR[i];
        const dg = g - palG[i];
        const db = b - palB[i];
        const d = dr * dr * wr2 + dg * dg * wg2 + db * db * wb2;
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      result[y * width + x] = bestIdx;

      const er = r - palR[bestIdx];
      const eg = g - palG[bestIdx];
      const eb = b - palB[bestIdx];

      // C-style integer division by 16 (truncation toward zero):
      // (v < 0) ? -((-v) >> 4) : (v >> 4)
      if (x < width - 1) {
        const p = idx + 3;
        let v;
        let t = er * 7; v = buf[p]     + (t < 0 ? -((-t) >> 4) : (t >> 4)); buf[p]     = v < 0 ? 0 : v > 255 ? 255 : v;
        t = eg * 7;     v = buf[p + 1] + (t < 0 ? -((-t) >> 4) : (t >> 4)); buf[p + 1] = v < 0 ? 0 : v > 255 ? 255 : v;
        t = eb * 7;     v = buf[p + 2] + (t < 0 ? -((-t) >> 4) : (t >> 4)); buf[p + 2] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
      if (nextOff !== -1) {
        if (x > 0) {
          const p = nextOff + (x - 1) * 3;
          let v;
          let t = er * 3; v = buf[p]     + (t < 0 ? -((-t) >> 4) : (t >> 4)); buf[p]     = v < 0 ? 0 : v > 255 ? 255 : v;
          t = eg * 3;     v = buf[p + 1] + (t < 0 ? -((-t) >> 4) : (t >> 4)); buf[p + 1] = v < 0 ? 0 : v > 255 ? 255 : v;
          t = eb * 3;     v = buf[p + 2] + (t < 0 ? -((-t) >> 4) : (t >> 4)); buf[p + 2] = v < 0 ? 0 : v > 255 ? 255 : v;
        }
        {
          const p = nextOff + x * 3;
          let v;
          let t = er * 5; v = buf[p]     + (t < 0 ? -((-t) >> 4) : (t >> 4)); buf[p]     = v < 0 ? 0 : v > 255 ? 255 : v;
          t = eg * 5;     v = buf[p + 1] + (t < 0 ? -((-t) >> 4) : (t >> 4)); buf[p + 1] = v < 0 ? 0 : v > 255 ? 255 : v;
          t = eb * 5;     v = buf[p + 2] + (t < 0 ? -((-t) >> 4) : (t >> 4)); buf[p + 2] = v < 0 ? 0 : v > 255 ? 255 : v;
        }
        if (x < width - 1) {
          const p = nextOff + (x + 1) * 3;
          let v;
          let t = er; v = buf[p]     + (t < 0 ? -((-t) >> 4) : (t >> 4)); buf[p]     = v < 0 ? 0 : v > 255 ? 255 : v;
          t = eg;     v = buf[p + 1] + (t < 0 ? -((-t) >> 4) : (t >> 4)); buf[p + 1] = v < 0 ? 0 : v > 255 ? 255 : v;
          t = eb;     v = buf[p + 2] + (t < 0 ? -((-t) >> 4) : (t >> 4)); buf[p + 2] = v < 0 ? 0 : v > 255 ? 255 : v;
        }
      }
    }
  }
  return result;
}

// HSV-based classification (no-dither path); matches hsv_classify_pixel().
export function hsvClassifyPixel(r, g, b) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const v = max;
  const delta = max - min;
  const s = max === 0 ? 0 : delta / max;
  let h = 0;
  if (delta > 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  if (v < 0.3) return 0;
  if (v > 0.85 && s < 0.2) return 1;
  if ((h <= 15 || h >= 345) && s > 0.6) return 3;
  if (h >= 45 && h <= 65 && s > 0.5) return 2;
  return v > 0.5 ? 1 : 0;
}

export function hsvClassifyAll(rgba, width, height) {
  const out = new Uint8Array(width * height);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) {
    out[j] = hsvClassifyPixel(rgba[i], rgba[i + 1], rgba[i + 2]);
  }
  return out;
}

// 2-bit pack (4 pixels per byte, MSB first); pad with 1 (white) like the app.
export function packEinkData(indices, width, height) {
  const nPixels = width * height;
  const nBytes = (nPixels + 3) >> 2;
  const out = new Uint8Array(nBytes);
  for (let bi = 0; bi < nBytes; bi++) {
    const o = bi * 4;
    const p0 = o < nPixels ? indices[o] : 1;
    const p1 = o + 1 < nPixels ? indices[o + 1] : 1;
    const p2 = o + 2 < nPixels ? indices[o + 2] : 1;
    const p3 = o + 3 < nPixels ? indices[o + 3] : 1;
    out[bi] = (p0 << 6) | (p1 << 4) | (p2 << 2) | p3;
  }
  return out;
}

// Render palette indices to an ImageData for canvas preview.
export function indicesToImageData(indices, width, height) {
  const out = new ImageData(width, height);
  const d = out.data;
  for (let i = 0, j = 0; j < indices.length; i += 4, j++) {
    const c = PALETTE[indices[j]] || PALETTE[1];
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
    d[i + 3] = 255;
  }
  return out;
}

export function colorDistribution(indices) {
  const counts = [0, 0, 0, 0];
  for (let i = 0; i < indices.length; i++) counts[indices[i]] += 1;
  const total = indices.length;
  return counts.map((count, idx) => ({
    index: idx,
    name: PALETTE_NAMES[idx],
    count,
    percent: total > 0 ? (count / total) * 100 : 0,
  }));
}

// One-shot pipeline: takes a decoded ImageBitmap or any drawable source and
// returns { indices, packed, preview } for a target screen size.
export async function processImage(source, {
  width = 428,
  height = 428,
  brightness = 51,
  contrast = 30,
  saturation = 23,
  dither = true,
} = {}) {
  const imageData = resizeToImageData(source, width, height);
  applyColorAdjustments(imageData.data, { brightness, contrast, saturation });
  const indices = dither
    ? floydSteinbergDither(imageData.data, width, height)
    : hsvClassifyAll(imageData.data, width, height);
  const packed = packEinkData(indices, width, height);
  const preview = indicesToImageData(indices, width, height);
  return { indices, packed, preview };
}
