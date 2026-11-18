// DOM + date + image helpers (no dependencies)

const SVG_NS = 'http://www.w3.org/2000/svg';

function build(el, props, kids) {
  let value;
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') value = v; // set after children (needed for <select>)
    else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  if (value !== undefined) el.value = value;
  return el;
}

export const h = (tag, props, ...kids) => build(document.createElement(tag), props, kids);
export const svg = (tag, props, ...kids) => build(document.createElementNS(SVG_NS, tag), props, kids);

// ---- dates (all local time, YYYY-MM-DD strings) ----
const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const startOfWeek = (s) => { const d = parseYmd(s); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return ymd(d); };
export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 864e5);
export const todayStr = () => ymd(new Date());
export const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const fmtDateShort = (s) => parseYmd(s).toLocaleDateString([], { month: 'short', day: 'numeric' });
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const round1 = (v) => Math.round(v * 10) / 10;

// ---- images ----
// Resize a Blob to a JPEG data URL. square=true crops the centre square.
export async function resizeJpeg(blob, { size, square = false, quality = 0.8 }) {
  let bmp;
  try { bmp = await createImageBitmap(blob); } catch { throw new Error('image-unreadable'); }
  let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height, cw, ch;
  if (square) {
    const s = Math.min(sw, sh);
    sx = (sw - s) / 2; sy = (sh - s) / 2; sw = sh = s; cw = ch = size;
  } else {
    const k = Math.min(1, size / Math.max(sw, sh));
    cw = Math.max(1, Math.round(sw * k)); ch = Math.max(1, Math.round(sh * k));
  }
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  canvas.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, cw, ch);
  bmp.close?.();
  return canvas.toDataURL('image/jpeg', quality);
}

// ---- unit conversion (UI only; storage is metric) ----
export const kgToLb = (kg) => kg * 2.2046226;
export const lbToKg = (lb) => lb / 2.2046226;
export const cmToFtIn = (cm) => { const t = cm / 2.54; let ft = Math.floor(t / 12); let inch = Math.round(t - ft * 12); if (inch === 12) { ft++; inch = 0; } return { ft, inch }; };
export const ftInToCm = (ft, inch) => (ft * 12 + inch) * 2.54;
