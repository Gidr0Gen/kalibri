// Screen: Progress (/progress)
import { h, svg, ymd, parseYmd, addDays, WEEKDAYS, startOfWeek, daysBetween, todayStr, fmtDateShort, clamp, kgToLb, lbToKg } from '../lib/util.js';
import * as store from '../lib/storage.js';
import { rerender } from '../lib/router.js';
import { icon } from '../lib/icons.js';
import { openSheet, confirmDialog, field, num } from '../lib/ui.js';

let period = '7D';
const PERIODS = ['7D', '30D', '90D', 'All'];

// ---- weight unit display (storage is kg) ----
const imperial = () => store.get().profile.units === 'imperial';
const isWeight = (g) => g.source === 'manual' && g.unit === 'kg';
const unitLabel = (g) => (isWeight(g) && imperial() ? 'lb' : g.unit);
const toDisp = (g, v) => (isWeight(g) && imperial() ? Math.round(kgToLb(v) * 10) / 10 : Math.round(v * 10) / 10);
const toStore = (g, v) => (isWeight(g) && imperial() ? lbToKg(v) : v);

// ---- data ----
function periodRange() {
  const end = todayStr();
  if (period !== 'All') return { start: addDays(end, -({ '7D': 6, '30D': 29, '90D': 89 }[period])), end };
  const s = store.get();
  const all = [...s.scans.map(store.scanDay), ...s.goalEntries.map((e) => e.date)].sort();
  return { start: all[0] && all[0] < addDays(end, -6) ? all[0] : addDays(end, -6), end };
}

function dailySeries(source, { start, end }) {
  const byDay = new Map();
  for (const sc of store.get().scans) {
    const d = store.scanDay(sc);
    if (d < start || d > end) continue;
    const v = source === 'protein' ? sc.items.reduce((a, i) => a + (i.protein || 0), 0) : sc.totalKcal;
    byDay.set(d, (byDay.get(d) || 0) + v);
  }
  return [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value: Math.round(value) }));
}

function seriesFor(goal, range) {
  if (goal.source === 'manual') return store.entriesFor(goal.id).filter((e) => e.date >= range.start && e.date <= range.end).map((e) => ({ date: e.date, value: e.value }));
  return dailySeries(goal.source, range);
}

// slope per week via least squares
function trendPerWeek(points) {
  if (points.length < 2) return null;
  const x0 = points[0].date;
  const xs = points.map((p) => daysBetween(x0, p.date));
  const n = points.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = points.reduce((a, p) => a + p.value, 0) / n;
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  if (!den) return null;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (points[i].value - my), 0) / den;
  return slope * 7;
}

const inRange = (g, v) => v >= g.targetValue * 0.9 && v <= g.targetValue * 1.1;

function pctOf(g, cur, series) {
  if (g.direction === 'range') return series.length ? Math.round((100 * series.filter((p) => inRange(g, p.value)).length) / series.length) : 0;
  const span = g.targetValue - g.startValue;
  if (cur == null || !span) return 0;
  return clamp(Math.round((100 * (cur - g.startValue)) / span), 0, 100);
}

// ---- charts (SVG) ----
const W = 320, H = 170, PL = 34, PR = 12, PT = 14, PB = 24;
let chartId = 0;

function frame(points, target, range, extra) {
  const vals = points.map((p) => p.value).concat(target ? [target] : [], extra || []);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.14; lo -= pad; hi += pad;
  const span = Math.max(1, daysBetween(range.start, range.end));
  const IN = 12; // keep first/last marks clear of the y-axis labels
  const X = (d) => PL + IN + ((W - PL - PR - 2 * IN) * daysBetween(range.start, d)) / span;
  const Y = (v) => PT + (H - PT - PB) * (1 - (v - lo) / (hi - lo));
  const els = [];
  for (const v of [hi - pad, (hi + lo) / 2, lo + pad]) {
    els.push(svg('line', { x1: PL, x2: W - PR, y1: Y(v), y2: Y(v), class: 'grid-line' }),
      svg('text', { x: PL - 6, y: Y(v) + 3.5, class: 'tick-label', 'text-anchor': 'end' }, Math.round(v)));
  }
  els.push(
    svg('text', { x: PL, y: H - 6, class: 'tick-label' }, fmtDateShort(range.start)),
    svg('text', { x: W - PR, y: H - 6, class: 'tick-label', 'text-anchor': 'end' }, fmtDateShort(range.end)));
  return { els, X, Y };
}

function targetMark(target, X, Y, range) {
  if (!target) return [];
  return [svg('line', { x1: PL, x2: W - PR, y1: Y(target), y2: Y(target), class: 'target-line' }),
    svg('text', { x: W - PR, y: Y(target) - 5, class: 'target-label', 'text-anchor': 'end' }, 'Goal')];
}

function lineChart(points, goal, range, label) {
  const { els, X, Y } = frame(points, goal.targetValue || null, range);
  const id = `area${++chartId}`;
  const base = Y(Math.min(...points.map((p) => p.value))) + 0;
  const bottom = H - PB;
  const d = `M ${X(points[0].date)} ${bottom} ` + points.map((p) => `L ${X(p.date)} ${Y(p.value)}`).join(' ') + ` L ${X(points[points.length - 1].date)} ${bottom} Z`;
  void base;
  els.unshift(svg('defs', {}, svg('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 },
    svg('stop', { offset: 0, style: 'stop-color:var(--color-primary-deep);stop-opacity:.35' }), svg('stop', { offset: 1, style: 'stop-color:var(--color-primary-deep);stop-opacity:0' }))));
  els.push(svg('path', { d, fill: `url(#${id})` }), ...targetMark(goal.targetValue, X, Y, range),
    svg('polyline', { points: points.map((p) => `${X(p.date)},${Y(p.value)}`).join(' '), class: 'line' }));
  points.forEach((p, i) => {
    if (i === points.length - 1) els.push(svg('circle', { cx: X(p.date), cy: Y(p.value), r: 9, class: 'halo' }));
    els.push(svg('circle', { cx: X(p.date), cy: Y(p.value), r: i === points.length - 1 ? 5 : 3, class: 'pt' }));
  });
  return svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': label }, els);
}

function barChart(points, goal, range, label) {
  const { els, X, Y } = frame(points.map((p) => ({ ...p })), goal.targetValue, range, [0]);
  const span = Math.max(1, daysBetween(range.start, range.end)) + 1;
  const bw = clamp(((W - PL - PR - 24) / span) * 0.66, 2, 24);
  for (const p of points) {
    const y = Y(p.value), y0 = Y(0);
    els.push(svg('rect', { x: X(p.date) - bw / 2, y, width: bw, height: Math.max(2, y0 - y), rx: Math.min(5, bw / 2), class: inRange(goal, p.value) ? 'bar-in' : 'bar-out' }));
  }
  els.push(...targetMark(goal.targetValue, X, Y, range));
  return svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': label }, els);
}

// ---- cards ----
const goalIcon = (g) => (g.source === 'calories' ? 'flame' : g.source === 'protein' ? 'protein' : isWeight(g) ? 'scale' : 'target');

function goalCard(g, range) {
  const series = seriesFor(g, range);
  const entries = g.source === 'manual' ? store.entriesFor(g.id) : [];
  const avg = series.length ? series.reduce((a, p) => a + p.value, 0) / series.length : null;
  const cur = g.source === 'manual' ? (entries.length ? entries[entries.length - 1].value : null) : avg;
  const u = unitLabel(g);
  const pct = pctOf(g, cur, series);
  const emptyManual = g.source === 'manual' && !entries.length;
  const hasTarget = g.direction === 'range' || g.targetValue;

  let trend = null;
  if (g.direction === 'range') { if (avg != null) trend = h('span', { class: 'chip' }, icon('target', 14), `avg ${Math.round(avg)} ${g.unit} / day`); }
  else {
    const t = trendPerWeek(series);
    if (t != null) {
      const v = toDisp(g, t);
      const good = (g.direction === 'down' && t < 0) || (g.direction === 'up' && t > 0);
      trend = h('span', { class: 'chip ' + (good ? 'good' : 'warn') }, icon(t < 0 ? 'trendDown' : 'trendUp', 14), `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} ${u} / week`);
    }
  }

  const chart = series.length >= 2
    ? (g.source === 'manual' ? lineChart(series.map((p) => ({ ...p, value: toDisp(g, p.value) })), { ...g, targetValue: toDisp(g, g.targetValue) }, range, `${g.title} chart`) : g.direction === 'range' ? barChart(series, g, range, `${g.title} per day`) : lineChart(series, g, range, `${g.title} chart`))
    : h('p', { class: 'chart-empty muted' }, emptyManual ? (isWeight(g) ? 'Log your weight' : `Log your first ${g.title.toLowerCase()} value`) : 'Not enough data yet — need at least 2 points.');

  return h('article', { class: 'card goal' },
    h('button', { class: 'goal-main', onclick: () => goalSheet(g), 'aria-label': `Edit goal ${g.title}` },
      h('div', { class: 'goal-top' },
        h('span', { class: 'goal-ico' }, icon(goalIcon(g), 22)),
        h('div', { class: 'goal-titles' }, h('strong', {}, g.title), h('span', { class: 'muted' }, g.direction === 'range' ? `Target ${g.targetValue} ${u} ±10%` : g.targetValue ? `Target ${toDisp(g, g.targetValue)} ${u}` : 'No target set')),
        h('div', { class: 'goal-val' }, h('strong', {}, cur == null ? '—' : g.source === 'manual' ? toDisp(g, cur) : Math.round(cur)), h('span', {}, u))),
      hasTarget ? h('div', { class: 'goal-prog' },
        h('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': `${g.title} progress` }, h('div', { class: 'bar-fill goal-fill', style: `width:${pct}%` })),
        h('div', { class: 'row' }, h('span', {}, g.direction === 'range' ? `${pct}% of days in range` : `${pct}% of the way`), h('span', {}, `${period}`))) : null,
      chart),
    h('div', { class: 'goal-foot' }, trend || h('span', {}),
      g.source === 'manual' ? h('button', { class: 'btn small primary', onclick: () => logSheet(g) }, icon('plus', 16), 'Log') : null));
}

function weekSummary() {
  const s = store.get();
  const goal = s.settings.dailyKcalGoal;
  const ws = startOfWeek(todayStr());
  const today = todayStr();
  let n = 0;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(ws, i);
    const t = store.totalsOn(d);
    const state = d > today ? 'future' : !t.count ? 'none' : t.kcal >= goal * 0.9 && t.kcal <= goal * 1.1 ? 'in' : 'out';
    if (state === 'in') n++;
    return { d, state, label: WEEKDAYS[i].charAt(0) };
  });
  return h('section', { class: 'card hero-week', 'aria-label': 'This week' },
    h('div', { class: 'hero-label' }, 'This week'),
    h('div', { class: 'hero-big' }, h('strong', {}, `${n} of 7`), h('span', {}, 'days in calorie range')),
    h('div', { class: 'week-dots' }, days.map((x) => h('div', { class: `wd ${x.state}`, role: 'img', 'aria-label': `${x.d}: ${{ in: 'in range', out: 'out of range', none: 'no data', future: 'upcoming' }[x.state]}` },
      h('i', {}, x.state === 'in' ? icon('check', 16) : ''), h('span', {}, x.label)))));
}

// ---- sheets ----
function logSheet(g) {
  openSheet(`Log ${g.title}`, (close) => {
    const val = num({ step: 0.1, 'aria-label': `Value in ${unitLabel(g)}` });
    const date = h('input', { type: 'date', value: todayStr(), max: todayStr() });
    return h('div', { class: 'stack' }, field(`Value (${unitLabel(g)})`, val), field('Date', date),
      h('button', { class: 'btn primary', onclick: () => {
        const v = Number(val.value);
        if (!val.value || !(v > 0) || !date.value) { val.reportValidity(); return; }
        store.update((s) => {
          s.goalEntries.push({ id: crypto.randomUUID(), goalId: g.id, date: date.value, value: toStore(g, v) });
          const goal = s.goals.find((x) => x.id === g.id);
          if (!goal.startValue) goal.startValue = toStore(g, v);
        });
        close();
      } }, 'Save'));
  });
}

function goalSheet(existing) {
  openSheet(existing ? 'Edit goal' : 'New goal', (close) => {
    const g = existing || { title: '', unit: '', source: 'manual', startValue: 0, targetValue: 0, direction: 'down', deadline: null };
    const title = h('input', { type: 'text', value: g.title, placeholder: 'e.g. Body weight' });
    const unit = h('input', { type: 'text', value: existing ? unitLabel(g) : g.unit, placeholder: 'kg, kcal, g…', disabled: !!existing && isWeight(g) });
    const source = h('select', { value: g.source, disabled: !!existing }, ['manual', 'calories', 'protein'].map((v) => h('option', { value: v }, { manual: 'Manual entries', calories: 'Calories from scans', protein: 'Protein from scans' }[v])));
    const start = num({ value: existing ? toDisp(g, g.startValue) : '' });
    const target = num({ value: existing ? toDisp(g, g.targetValue) : '' });
    const dir = h('select', { value: g.direction }, [['down', 'Go down'], ['up', 'Go up'], ['range', 'Stay in range (±10%)']].map(([v, l]) => h('option', { value: v }, l)));
    const deadline = h('input', { type: 'date', value: g.deadline || '' });
    const entries = existing && existing.source === 'manual' ? store.entriesFor(existing.id) : [];
    const entryList = entries.length ? h('div', { class: 'stack' }, h('h3', { class: 'section-title' }, 'Entries'),
      h('ul', { class: 'entry-list' }, [...entries].reverse().map((e) => h('li', {}, h('span', {}, `${fmtDateShort(e.date)} — ${toDisp(existing, e.value)} ${unitLabel(existing)}`),
        h('button', { class: 'icon-btn', 'aria-label': 'Delete entry', onclick: async () => { if (await confirmDialog('Delete this entry?', { okLabel: 'Delete' })) { store.update((s) => { s.goalEntries = s.goalEntries.filter((x) => x.id !== e.id); }); close(); } } }, icon('trash', 18))))) ) : null;

    return h('div', { class: 'stack' },
      field('Title', title), field('Source', source), field('Unit', unit),
      h('div', { class: 'two-col' }, field('Start', start), field('Target', target)),
      field('Direction', dir), field('Deadline (optional)', deadline), entryList,
      h('div', { class: 'row-btns' },
        existing && h('button', { class: 'btn danger', onclick: async () => { if (await confirmDialog(`Delete “${g.title}” and its entries?`, { okLabel: 'Delete' })) { store.update((s) => { s.goals = s.goals.filter((x) => x.id !== g.id); s.goalEntries = s.goalEntries.filter((x) => x.goalId !== g.id); }); close(); } } }, 'Delete'),
        h('button', { class: 'btn primary', onclick: () => {
          if (!title.value.trim()) { title.setCustomValidity('Title required'); title.reportValidity(); title.setCustomValidity(''); return; }
          const src = source.value;
          const base = existing || { id: crypto.randomUUID(), createdAt: new Date().toISOString() };
          const weight = existing && isWeight(existing);
          const next = {
            ...base, title: title.value.trim(), source: src,
            unit: weight ? 'kg' : (unit.value.trim() || (src === 'calories' ? 'kcal' : src === 'protein' ? 'g' : '')),
            startValue: weight ? toStore(base, Number(start.value) || 0) : Number(start.value) || 0,
            targetValue: weight ? toStore(base, Number(target.value) || 0) : Number(target.value) || 0,
            direction: dir.value, deadline: deadline.value || null,
          };
          store.update((s) => {
            if (existing) s.goals[s.goals.findIndex((x) => x.id === existing.id)] = next; else s.goals.push(next);
            if (next.source === 'calories' && next.targetValue) { s.settings.dailyKcalGoal = Math.round(next.targetValue); }
          });
          close();
        } }, 'Save')));
  });
}

export function progressScreen() {
  store.ensureDefaultGoals();
  const range = periodRange();
  return h('div', { class: 'screen' },
    h('header', { class: 'top' }, h('h1', {}, 'Progress'), h('button', { class: 'btn small primary', onclick: () => goalSheet(null) }, icon('plus', 16), 'Goal')),
    weekSummary(),
    h('div', { class: 'segmented full', role: 'group', 'aria-label': 'Period' }, PERIODS.map((p) => h('button', { class: p === period ? 'on' : '', 'aria-pressed': p === period ? 'true' : 'false', onclick: () => { period = p; rerender(); } }, p))),
    ...store.get().goals.map((g) => goalCard(g, range)));
}
