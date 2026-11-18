// Screen: Profile (/profile). Every change saves immediately.
import { h, resizeJpeg, kgToLb, lbToKg, cmToFtIn, ftInToCm, round1 } from '../lib/util.js';
import * as store from '../lib/storage.js';
import { openSheet, confirmDialog, num } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { track, register } from '../lib/analytics.js';
import { recommend, ageFrom, ACTIVITY_LABELS } from '../lib/nutrition.js';

const set = (patch, silent) => store.update((s) => { Object.assign(s.profile, patch); }, { silent });
const opts = (pairs) => pairs.map(([v, l]) => h('option', { value: v }, l));
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const row = (label, control) => h('label', { class: 'list-row' }, h('span', { class: 'row-label' }, label), control);
const group = (title, body, right) => h('section', {}, h('h3', { class: 'group-title' }, h('span', {}, title), right), h('div', { class: 'card flush' }, body));

function hero(p) {
  const file = h('input', { type: 'file', accept: 'image/*', class: 'sr-only', 'aria-label': 'Choose profile photo', onchange: async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { set({ avatar: await resizeJpeg(f, { size: 256, square: true, quality: 0.85 }) }); } catch { alert('That image could not be read.'); }
  } });
  const imp = p.units === 'imperial';
  const w = store.currentWeight();
  const age = ageFrom(p.birthDate);
  const heightTxt = !p.heightCm ? '—' : imp ? (() => { const { ft, inch } = cmToFtIn(p.heightCm); return `${ft}′${inch}″`; })() : `${Math.round(p.heightCm)} cm`;
  const weightTxt = w == null ? '—' : imp ? `${round1(kgToLb(w))} lb` : `${round1(w)} kg`;
  return h('section', { class: 'profile-hero' },
    file,
    h('button', { class: 'avatar big', 'aria-label': 'Change profile photo', onclick: () => file.click() },
      p.avatar ? h('img', { src: p.avatar, alt: '' }) : (p.name || store.APP_NAME).trim().charAt(0).toUpperCase(), h('span', { class: 'avatar-edit' }, 'Edit')),
    h('input', { type: 'text', class: 'name-input', value: p.name, placeholder: 'Your name', 'aria-label': 'Name', oninput: (e) => set({ name: e.target.value }, true), onchange: () => store.update(() => {}) }),
    h('div', { class: 'pstats' },
      h('div', { class: 'pstat' }, h('strong', {}, age ?? '—'), h('span', {}, 'Age')),
      h('div', { class: 'pstat' }, h('strong', {}, heightTxt), h('span', {}, 'Height')),
      h('div', { class: 'pstat' }, h('strong', {}, weightTxt), h('span', {}, 'Weight'))));
}

function recommended(p) {
  const r = recommend(p, store.currentWeight());
  const goal = store.get().settings.dailyKcalGoal;
  if (r.missing) {
    return h('section', { class: 'card reco-card reco-missing', 'aria-label': 'Recommended daily calories' },
      h('div', { class: 'hero-label' }, 'Recommended daily calories'),
      h('p', {}, 'Fill in the fields below to get your personal number:'),
      h('div', { class: 'reco-chips' }, r.missing.map((m) => h('span', { class: 'chip warn' }, m))));
  }
  const adj = r.adj === 0 ? 'Maintain' : `${r.adj > 0 ? '+' : '−'}${Math.abs(r.adj)} aim`;
  return h('section', { class: 'card reco-card', 'aria-label': 'Recommended daily calories' },
    h('div', { class: 'hero-label' }, 'Recommended daily calories'),
    h('div', { class: 'reco-num' }, h('strong', {}, fmt(r.kcal)), h('span', {}, 'kcal / day')),
    h('div', { class: 'reco-chips' }, h('span', { class: 'chip' }, `BMR ${fmt(r.bmr)}`), h('span', { class: 'chip' }, `TDEE ${fmt(r.tdee)}`), h('span', { class: 'chip' }, adj)),
    goal === r.kcal
      ? h('p', { class: 'muted', style: 'color:inherit;opacity:.75' }, 'This is your current daily goal.')
      : h('button', { class: 'btn dark', onclick: () => store.setDailyGoal(r.kcal) }, icon('target', 18), 'Use as daily goal'));
}

function bodyForm(p, extraRight) {
  const imp = p.units === 'imperial';
  const w = store.currentWeight();
  let height;
  if (imp) {
    const { ft, inch } = p.heightCm ? cmToFtIn(p.heightCm) : { ft: '', inch: '' };
    const ftI = num({ value: ft, step: 1, 'aria-label': 'Feet' }), inI = num({ value: inch, step: 1, 'aria-label': 'Inches' });
    const commit = () => { if (ftI.value === '' && inI.value === '') return set({ heightCm: null }); set({ heightCm: Math.round(ftInToCm(Number(ftI.value) || 0, Number(inI.value) || 0) * 10) / 10 }); };
    ftI.onchange = inI.onchange = commit;
    height = h('span', { class: 'pair' }, ftI, 'ft', inI, 'in');
  } else {
    height = num({ value: p.heightCm ?? '', step: 1, placeholder: 'cm', 'aria-label': 'Height in cm', onchange: (e) => set({ heightCm: e.target.value ? Number(e.target.value) : null }) });
  }
  const weight = num({ value: w == null ? '' : round1(imp ? kgToLb(w) : w), step: 0.1, placeholder: imp ? 'lb' : 'kg', 'aria-label': `Current weight in ${imp ? 'lb' : 'kg'}`,
    onchange: (e) => { const v = Number(e.target.value); if (v > 0) store.setWeightToday(imp ? lbToKg(v) : v); } });
  const units = h('div', { class: 'segmented small', role: 'group', 'aria-label': 'Units' }, [['metric', 'kg · cm'], ['imperial', 'lb · ft-in']].map(([v, l]) => h('button', { class: p.units === v ? 'on' : '', 'aria-pressed': p.units === v ? 'true' : 'false', onclick: () => set({ units: v }) }, l)));

  return group('Body data', [
    row('Sex', h('select', { value: p.sex || '', 'aria-label': 'Sex', onchange: (e) => set({ sex: e.target.value || null }) }, opts([['', 'Select…'], ['female', 'Female'], ['male', 'Male']]))),
    row('Birth date', h('input', { type: 'date', value: p.birthDate || '', 'aria-label': 'Birth date', max: new Date().toISOString().slice(0, 10), onchange: (e) => set({ birthDate: e.target.value || null }) })),
    row('Height', height),
    row('Weight', weight),
    row('Activity', h('select', { value: p.activity, 'aria-label': 'Activity level', onchange: (e) => set({ activity: e.target.value }) }, opts(Object.entries(ACTIVITY_LABELS)))),
    row('Aim', h('select', { value: p.aim, 'aria-label': 'Aim', onchange: (e) => set({ aim: e.target.value }) }, opts([['lose', 'Lose weight'], ['maintain', 'Maintain'], ['gain', 'Gain weight']]))),
  ], extraRight || units);
}

// ---- A/B: control = form rows, test = macro tiles + Edit button ----
let editing = false;
let exposed = false;
const tile = (ico, label, value, unit) => h('div', { class: 'btile' },
  h('span', { class: 'btile-ico' }, icon(ico, 20)),
  h('strong', {}, value, unit ? h('small', {}, ` ${unit}`) : null),
  h('span', { class: 'btile-label' }, label));

function bodyTiles(p) {
  const imp = p.units === 'imperial';
  const w = store.currentWeight();
  const age = ageFrom(p.birthDate);
  const heightV = !p.heightCm ? ['—'] : imp ? (() => { const { ft, inch } = cmToFtIn(p.heightCm); return [`${ft}′${inch}″`]; })() : [Math.round(p.heightCm), 'cm'];
  const weightV = w == null ? ['—'] : imp ? [round1(kgToLb(w)), 'lb'] : [round1(w), 'kg'];
  const sexV = p.sex ? (p.sex === 'female' ? 'Female' : 'Male') : '—';
  const act = ACTIVITY_LABELS[p.activity] ? ACTIVITY_LABELS[p.activity].split(' (')[0] : '—';
  const aim = { lose: 'Lose', maintain: 'Maintain', gain: 'Gain' }[p.aim] || '—';
  const editBtn = h('button', { class: 'btn-edit', onclick: () => { editing = true; track('body_edit_opened'); store.update(() => {}); } }, icon('edit', 16), 'Edit');
  return h('section', {},
    h('h3', { class: 'group-title' }, h('span', {}, 'Body data'), editBtn),
    h('div', { class: 'btiles' },
      tile('user', 'Sex', sexV),
      tile('calendar', 'Age', age ?? '—', age != null ? 'yrs' : ''),
      tile('ruler', 'Height', ...heightV),
      tile('scale', 'Weight', ...weightV),
      tile('activity', 'Activity', act),
      tile('target', 'Aim', aim)));
}

function bodyData(p, variant) {
  if (variant !== 'test') return bodyForm(p);
  if (!editing) return bodyTiles(p);
  const done = h('button', { class: 'btn-edit on', onclick: () => { editing = false; track('body_edit_done'); store.update(() => {}); } }, icon('check', 16), 'Done');
  return bodyForm(p, h('span', { class: 'edit-actions' }, done));
}

function dataBlock() {
  const file = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', 'aria-label': 'Choose backup file', onchange: async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const text = await f.text();
    let probe; try { probe = JSON.parse(text); } catch { probe = null; }
    if (!probe || !store.validate(probe)) return openSheet('Import failed', (close) => h('div', { class: 'stack' }, h('p', {}, 'This file is not a valid Kalibri backup.'), h('button', { class: 'btn primary', onclick: close }, 'OK')));
    if (await confirmDialog('Importing replaces all current data on this device.', { okLabel: 'Import' })) store.importJson(text);
  } });
  const item = (ico, label, onclick, cls = '') => h('button', { class: `list-row ${cls}`, onclick },
    h('span', { class: 'row-label' }, h('span', { class: `row-ico ${cls}` }, icon(ico, 18)), label), h('span', { class: 'chev' }, icon('chevron', 18)));
  return group('Data', [file,
    item('download', 'Export data', () => {
      const a = h('a', { href: URL.createObjectURL(new Blob([store.exportJson()], { type: 'application/json' })), download: `kalibri-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.append(a); a.click(); a.remove();
    }),
    item('upload', 'Import data', () => file.click()),
    item('reset', 'Reset all data', async () => { if (await confirmDialog('This permanently deletes all scans, goals and profile data on this device.', { requireWord: 'RESET', okLabel: 'Reset everything' })) store.reset(); }, 'danger')]);
}

export function profileScreen() {
  store.ensureDefaultGoals();
  const p = store.get().profile;
  const variant = store.abVariant('body_data');
  register({ ab_body_data: variant });
  if (!exposed) { exposed = true; track('ab_exposure', { experiment: 'body_data', variant }); }
  return h('div', { class: 'screen' },
    hero(p), recommended(p), bodyData(p, variant), dataBlock(),
    h('footer', { class: 'foot' }, h('p', {}, `${store.APP_NAME} v${store.APP_VERSION}`), h('p', {}, 'Demo estimates only. This app does not give medical advice.')));
}
