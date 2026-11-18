// All localStorage reads/writes live here. One versioned key. Values are metric.
import { ymd, todayStr } from './util.js';

export const APP_NAME = 'Kalibri';
export const APP_VERSION = '0.1.0';
const KEY = 'kalibri-v1';

const defaults = () => ({
  version: 1,
  scans: [],
  settings: { dailyKcalGoal: 2000 },
  profile: {
    name: '', avatar: null, sex: null, birthDate: null, heightCm: null,
    activity: 'light', aim: 'maintain', units: 'metric',
  },
  goals: [],
  goalEntries: [],
});

export function validate(s) {
  const isArr = Array.isArray;
  return !!s && s.version === 1 && isArr(s.scans) && isArr(s.goals) && isArr(s.goalEntries)
    && s.settings && typeof s.settings.dailyKcalGoal === 'number' && s.profile && typeof s.profile === 'object'
    && s.scans.every((x) => x && typeof x.id === 'string' && typeof x.createdAt === 'string' && isArr(x.items) && typeof x.totalKcal === 'number')
    && s.goals.every((g) => g && typeof g.id === 'string' && typeof g.title === 'string')
    && s.goalEntries.every((e) => e && typeof e.goalId === 'string' && typeof e.date === 'string' && typeof e.value === 'number');
}

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (validate(s)) return { ...defaults(), ...s, profile: { ...defaults().profile, ...s.profile } };
    }
  } catch { /* fall through */ }
  return defaults();
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('Kalibri: could not save', e); }
}

export const get = () => state;
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function update(fn, { silent = false } = {}) {
  fn(state);
  persist();
  if (!silent) listeners.forEach((l) => l());
}

// ---- scans ----
export const scanDay = (scan) => ymd(new Date(scan.createdAt));
export const scansOn = (date) => state.scans.filter((s) => scanDay(s) === date).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export function totalsOn(date) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, count: 0 };
  for (const s of scansOn(date)) {
    t.count++; t.kcal += s.totalKcal;
    for (const i of s.items) { t.protein += i.protein || 0; t.carbs += i.carbs || 0; t.fat += i.fat || 0; }
  }
  return t;
}
export const datesWithScans = () => new Set(state.scans.map(scanDay));
export const addScan = (scan) => update((s) => { s.scans.push(scan); });
export const saveScan = (scan) => update((s) => { const i = s.scans.findIndex((x) => x.id === scan.id); if (i >= 0) s.scans[i] = scan; });
export const deleteScan = (id) => update((s) => { s.scans = s.scans.filter((x) => x.id !== id); });

// ---- goals ----
export function ensureDefaultGoals() {
  if (state.goals.length) return;
  const now = new Date().toISOString();
  update((s) => {
    s.goals.push(
      { id: crypto.randomUUID(), title: 'Daily calories', unit: 'kcal', source: 'calories', startValue: s.settings.dailyKcalGoal, targetValue: s.settings.dailyKcalGoal, direction: 'range', deadline: null, createdAt: now },
      { id: crypto.randomUUID(), title: 'Body weight', unit: 'kg', source: 'manual', startValue: 0, targetValue: 0, direction: 'down', deadline: null, createdAt: now },
    );
  }, { silent: true });
}
export const bodyWeightGoal = () => state.goals.find((g) => g.source === 'manual' && g.title === 'Body weight') || null;
export const entriesFor = (goalId) => state.goalEntries.filter((e) => e.goalId === goalId).sort((a, b) => a.date.localeCompare(b.date));
export function currentWeight() {
  const g = bodyWeightGoal();
  const list = g ? entriesFor(g.id) : [];
  return list.length ? list[list.length - 1].value : null;
}
export function setWeightToday(kg) {
  ensureDefaultGoals();
  const g = bodyWeightGoal();
  if (!g) return;
  update((s) => {
    const today = todayStr();
    const ex = s.goalEntries.find((e) => e.goalId === g.id && e.date === today);
    if (ex) ex.value = kg; else s.goalEntries.push({ id: crypto.randomUUID(), goalId: g.id, date: today, value: kg });
    const goal = s.goals.find((x) => x.id === g.id);
    if (!goal.startValue) goal.startValue = kg;
  });
}
export function setDailyGoal(kcal) {
  update((s) => {
    s.settings.dailyKcalGoal = kcal;
    for (const g of s.goals) if (g.source === 'calories') g.targetValue = kcal;
  });
}

// ---- data management ----
export const exportJson = () => JSON.stringify(state, null, 2);
export function importJson(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { return { ok: false, error: 'File is not valid JSON.' }; }
  if (!validate(parsed)) return { ok: false, error: 'File does not look like a Kalibri backup.' };
  state = { ...defaults(), ...parsed, profile: { ...defaults().profile, ...parsed.profile } };
  persist(); listeners.forEach((l) => l());
  return { ok: true };
}
export function reset() { state = defaults(); persist(); listeners.forEach((l) => l()); }

// ---- A/B test assignment (separate key so reset/import never reshuffles users) ----
// Override for QA: ?ab_body_data=test|control (not persisted).
export function abVariant(name) {
  const forced = new URLSearchParams(location.search).get(`ab_${name}`);
  if (forced === 'test' || forced === 'control') return forced;
  let all = {};
  try { all = JSON.parse(localStorage.getItem('kalibri-ab') || '{}'); } catch { /* ignore */ }
  if (all[name] !== 'test' && all[name] !== 'control') {
    all[name] = Math.random() < 0.5 ? 'test' : 'control';
    try { localStorage.setItem('kalibri-ab', JSON.stringify(all)); } catch { /* ignore */ }
  }
  return all[name];
}

// True only the first time per device for a given name (e.g. one-off analytics milestones).
export function once(name) {
  let all = {};
  try { all = JSON.parse(localStorage.getItem('kalibri-once') || '{}'); } catch { /* ignore */ }
  if (all[name]) return false;
  all[name] = 1;
  try { localStorage.setItem('kalibri-once', JSON.stringify(all)); } catch { /* ignore */ }
  return true;
}
