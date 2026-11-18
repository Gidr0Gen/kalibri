// Scanner modal: camera → analyzing → result | error
import { h, resizeJpeg, parseYmd, todayStr } from '../lib/util.js';
import * as store from '../lib/storage.js';
import { estimate } from '../lib/estimator.js';
import { itemsEditor, field } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { track } from '../lib/analytics.js';

export function openScanner({ date }) {
  let stream = null;
  track('scan_started');
  const modal = h('div', { class: 'scanner', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Food scanner' });
  const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'sr-only', 'aria-label': 'Choose a photo', onchange: (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) analyze(f); } });

  const stopCamera = () => { stream?.getTracks().forEach((t) => t.stop()); stream = null; };
  const close = () => { stopCamera(); document.removeEventListener('keydown', onKey); modal.remove(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  const scanTop = () => h('div', { class: 'scan-top' }, h('span', { class: 'scan-title' }, 'Scan food'), closeBtn());
  const closeBtn = () => h('button', { class: 'icon-btn light', 'aria-label': 'Close scanner', onclick: close }, '✕');
  const galleryBtn = (cls = 'btn') => h('button', { class: cls, onclick: () => fileInput.click() }, icon('image', 18), 'Gallery');
  const show = (...kids) => modal.replaceChildren(fileInput, ...kids);

  async function cameraState() {
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) return galleryOnly('Camera is not available on this device.');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch {
      return galleryOnly('Camera access was blocked. You can still pick a photo from your gallery.');
    }
    const video = h('video', { class: 'cam', autoplay: true, playsinline: true, muted: true });
    video.srcObject = stream;
    video.muted = true;
    show(video,
      scanTop(),
      h('div', { class: 'viewfinder', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')),
      h('p', { class: 'vf-hint' }, 'Center your meal in the frame'),
      h('div', { class: 'scan-controls' },
        galleryBtn('btn glass'),
        h('button', { class: 'shutter', 'aria-label': 'Capture', onclick: () => capture(video) }),
        h('span', { class: 'spacer' })));
  }

  function galleryOnly(msg) {
    show(scanTop(),
      h('div', { class: 'scan-center' }, h('p', {}, msg), galleryBtn('btn primary')));
  }

  function capture(video) {
    if (!video.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = video.videoWidth; c.height = video.videoHeight;
    c.getContext('2d').drawImage(video, 0, 0);
    c.toBlob((blob) => (blob ? analyze(blob) : errorState('Could not capture the photo.', cameraState)), 'image/jpeg', 0.9);
  }

  async function analyze(blob) {
    stopCamera();
    const url = URL.createObjectURL(blob);
    show(scanTop(),
      h('div', { class: 'analyzing' },
        h('div', { class: 'photo-wrap' }, h('img', { src: url, alt: 'Your photo' }), h('div', { class: 'sweep' })),
        h('p', { role: 'status' }, 'Estimating calories…')));
    try {
      const thumbnail = await resizeJpeg(blob, { size: 240 });
      const est = await estimate(blob);
      track('scan_analyzed', { confidence: est.confidence, total_kcal: est.totalKcal, item_count: est.items.length });
      resultState({ ...est, thumbnail }, url);
    } catch {
      track('scan_failed');
      errorState('That image could not be read. Try another photo.', () => cameraState());
    }
  }

  function resultState(draft, url) {
    const confLabel = { low: 'Low confidence', medium: 'Medium confidence', high: 'High confidence' }[draft.confidence];
    const sum = h('div', { class: 'sum' });
    const renderSum = () => {
      const t = (k) => Math.round(draft.items.reduce((a, i) => a + (Number(i[k]) || 0), 0));
      sum.replaceChildren(...[['kcal', draft.totalKcal], ['protein', t('protein')], ['carbs', t('carbs')], ['fat', t('fat')]].map(([l, v]) => h('div', {}, h('strong', {}, v + (l === 'kcal' ? '' : ' g')), h('span', {}, l === 'kcal' ? 'kcal total' : l[0].toUpperCase() + l.slice(1)))));
    };
    show(
      scanTop(),
      h('div', { class: 'result' },
        h('img', { class: 'result-img', src: draft.thumbnail, alt: 'Your photo' }),
        h('div', { class: 'badges' }, h('span', { class: `badge conf-${draft.confidence}` }, confLabel), h('span', { class: 'badge demo' }, 'Demo estimate')),
        sum,
        field('Dish', h('input', { type: 'text', value: draft.dish, oninput: (e) => { draft.dish = e.target.value; } })),
        itemsEditor(draft, renderSum),
        h('div', { class: 'row-btns' },
          h('button', { class: 'btn', onclick: () => { URL.revokeObjectURL(url); cameraState(); } }, 'Retake'),
          h('button', { class: 'btn primary', onclick: () => save(draft) }, 'Save'))));
    renderSum();
  }

  function save(draft) {
    const when = new Date();
    if (date !== todayStr()) { const d = parseYmd(date); d.setHours(when.getHours(), when.getMinutes(), 0, 0); when.setTime(d.getTime()); }
    store.addScan({
      id: crypto.randomUUID(), createdAt: when.toISOString(), dish: draft.dish.trim() || 'Meal',
      items: draft.items, totalKcal: draft.totalKcal, confidence: draft.confidence, thumbnail: draft.thumbnail,
    });
    track('scan_saved', { saved_total: store.get().scans.length, total_kcal: draft.totalKcal, item_count: draft.items.length, confidence: draft.confidence });
    close();
  }

  function errorState(msg, retry) {
    show(scanTop(),
      h('div', { class: 'scan-center' }, h('p', { role: 'alert' }, msg), h('div', { class: 'row-btns' }, galleryBtn(), h('button', { class: 'btn primary', onclick: retry }, 'Retry'))));
  }

  document.body.append(modal);
  cameraState();
}
