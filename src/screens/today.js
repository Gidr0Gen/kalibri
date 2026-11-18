// Screen: Today (/)
import { h, svg, addDays, startOfWeek, parseYmd, fmtTime, todayStr, WEEKDAYS, clamp } from '../lib/util.js';
import * as store from '../lib/storage.js';
import { navigate, rerender } from '../lib/router.js';
import { openSheet, confirmDialog, itemsEditor, field, num } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { openScanner } from './scanner.js';

let selected = todayStr();
let weekStart = startOfWeek(selected);

const fmt = (n) => Math.round(n).toLocaleString('en-US');

function shiftWeek(n) {
  weekStart = addDays(weekStart, 7 * n);
  selected = addDays(selected, 7 * n);
  rerender();
}

function header(profile) {
  const initial = (profile.name || store.APP_NAME).trim().charAt(0).toUpperCase();
  return h('header', { class: 'top' },
    h('div', { class: 'logo-row' }, h('span', { class: 'logo', 'aria-hidden': 'true' }, 'K'), h('h1', { class: 'brand' }, store.APP_NAME)),
    h('button', { class: 'avatar', 'aria-label': 'Open profile', onclick: () => navigate('/profile') },
      profile.avatar ? h('img', { src: profile.avatar, alt: '' }) : initial));
}

function weekBar() {
  const dots = store.datesWithScans();
  const today = todayStr();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const label = parseYmd(selected).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  return h('section', { class: 'week', 'aria-label': 'Week calendar' },
    h('div', { class: 'week-head' },
      h('button', { class: 'icon-btn', 'aria-label': 'Previous week', onclick: () => shiftWeek(-1) }, '‹'),
      h('span', { class: 'week-label' }, label),
      h('button', { class: 'icon-btn', 'aria-label': 'Next week', onclick: () => shiftWeek(1) }, '›')),
    h('div', { class: 'week-days' }, days.map((d, i) => h('button', {
      class: 'day' + (d === selected ? ' selected' : '') + (d === today ? ' today' : ''),
      'aria-pressed': d === selected ? 'true' : 'false',
      'aria-label': parseYmd(d).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) + (dots.has(d) ? ', has scans' : ''),
      onclick: () => { selected = d; rerender(); },
    }, h('span', { class: 'dow' }, WEEKDAYS[i]), h('span', { class: 'dom' }, parseYmd(d).getDate()), h('span', { class: 'dot' + (dots.has(d) ? ' on' : '') })))));
}

// 270° open-bottom gauge. Clockwise from bottom-left (135°) to bottom-right (45°); centre (100,100), r=80.
const GAUGE_PATH = 'M 43.43 156.57 A 80 80 0 1 1 156.57 156.57';
const polar = (deg, r) => [100 + r * Math.cos((deg * Math.PI) / 180), 100 + r * Math.sin((deg * Math.PI) / 180)];

function gauge(consumed, goal) {
  const frac = clamp(consumed / goal, 0, 1);
  const over = consumed > goal;
  const left = Math.round(goal - consumed);
  const [kx, ky] = polar(135 + 270 * frac, 80);
  const ticks = Array.from({ length: 28 }, (_, i) => {
    const deg = 135 + (270 * i) / 27;
    const [x1, y1] = polar(deg, 94), [x2, y2] = polar(deg, i % 9 === 0 ? 101 : 98);
    return svg('line', { x1, y1, x2, y2, class: 'tick' });
  });
  return h('button', { class: 'gauge-btn', 'aria-label': `${over ? -left + ' kilocalories over' : left + ' kilocalories remaining'} of ${goal}. Change daily goal`, onclick: goalSheet },
    h('div', { class: 'gauge-wrap' },
      svg('svg', { viewBox: '0 0 200 180', class: 'gauge', 'aria-hidden': 'true' },
        svg('defs', {}, svg('linearGradient', { id: 'gaugeGrad', x1: '0', y1: '1', x2: '1', y2: '0' },
          svg('stop', { offset: '0', style: 'stop-color:var(--color-primary)' }), svg('stop', { offset: '1', style: 'stop-color:var(--color-primary-deep)' }))),
        ...ticks,
        svg('path', { d: GAUGE_PATH, class: 'gauge-bg' }),
        frac > 0 && svg('path', { d: GAUGE_PATH, class: 'gauge-fg', pathLength: 100, 'stroke-dasharray': `${frac * 100} 100`, stroke: over ? 'var(--color-warn)' : 'url(#gaugeGrad)' }),
        frac > 0 && svg('circle', { cx: kx, cy: ky, r: 9, class: 'gauge-knob' + (over ? ' over' : '') })),
      h('div', { class: 'gauge-text' },
        h('span', { class: 'gauge-flame' }, icon('flame', 20)),
        h('span', { class: 'gauge-label' }, over ? 'Over by' : 'Remaining'),
        h('strong', { class: 'gauge-num' + (over ? ' over' : '') }, fmt(Math.abs(left))),
        h('span', { class: 'gauge-unit' }, 'kcal'))));
}

function statRow(consumed, goal) {
  const left = Math.round(goal - consumed);
  return h('div', { class: 'stats' },
    h('div', { class: 'stat' }, h('strong', {}, fmt(consumed)), h('span', {}, 'Eaten')),
    h('div', { class: 'stat' }, h('strong', {}, fmt(goal)), h('span', {}, 'Goal')),
    h('div', { class: 'stat' }, h('strong', {}, fmt(Math.abs(left))), h('span', {}, left < 0 ? 'Over' : 'Left')));
}

function macros(t, goal) {
  const targets = { protein: (goal * 0.25) / 4, carbs: (goal * 0.5) / 4, fat: (goal * 0.25) / 9 };
  return h('div', { class: 'macros' }, [['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat']].map(([k, label]) =>
    h('div', { class: 'macro', role: 'group', 'aria-label': `${label}: ${Math.round(t[k])} of ${Math.round(targets[k])} grams` },
      h('div', { class: 'macro-top' }, h('span', { class: `macro-ico ${k}` }, icon(k, 17)), h('span', {}, label)),
      h('strong', {}, Math.round(t[k]), h('small', {}, ` / ${Math.round(targets[k])} g`)),
      h('div', { class: 'mini-bar' }, h('i', { class: k, style: `width:${clamp((t[k] / targets[k]) * 100, 0, 100)}%` })))));
}

function goalSheet() {
  openSheet('Daily calorie goal', (close) => {
    const input = num({ value: store.get().settings.dailyKcalGoal, step: 50, inputmode: 'numeric', 'aria-label': 'Daily goal in kcal' });
    return h('div', { class: 'stack' }, field('kcal per day', input),
      h('button', { class: 'btn primary', onclick: () => { const v = Math.round(Number(input.value)); if (v >= 500 && v <= 10000) { store.setDailyGoal(v); close(); } else { input.setCustomValidity('Enter 500–10000'); input.reportValidity(); input.setCustomValidity(''); } } }, 'Save'));
  });
}

const macroSum = (scan, k) => Math.round(scan.items.reduce((a, i) => a + (i[k] || 0), 0));

function scanRow(scan) {
  return h('li', {}, h('button', { class: 'scan-row', onclick: () => detailSheet(scan) },
    scan.thumbnail ? h('img', { class: 'thumb', src: scan.thumbnail, alt: '' }) : h('div', { class: 'thumb' }, icon('plate', 24)),
    h('div', { class: 'scan-main' }, h('strong', {}, scan.dish),
      h('div', { class: 'scan-meta' }, h('span', { class: 'time' }, fmtTime(scan.createdAt)), h('span', {}, `P ${macroSum(scan, 'protein')} · C ${macroSum(scan, 'carbs')} · F ${macroSum(scan, 'fat')}`))),
    h('div', { class: 'scan-kcal' }, h('strong', {}, scan.totalKcal), h('span', {}, 'kcal'))));
}

function detailSheet(scan) {
  const draft = structuredClone(scan);
  openSheet('Scan details', (close) => h('div', { class: 'stack' },
    scan.thumbnail && h('img', { class: 'detail-img', src: scan.thumbnail, alt: '' }),
    field('Dish', h('input', { type: 'text', value: draft.dish, oninput: (e) => { draft.dish = e.target.value; } })),
    itemsEditor(draft),
    h('div', { class: 'row-btns' },
      h('button', { class: 'btn danger', onclick: async () => { if (await confirmDialog('Delete this scan?', { okLabel: 'Delete' })) { store.deleteScan(scan.id); close(); } } }, icon('trash', 18), 'Delete'),
      h('button', { class: 'btn primary', onclick: () => { draft.dish = draft.dish.trim() || 'Meal'; store.saveScan(draft); close(); } }, 'Save'))));
}

export function todayScreen() {
  const s = store.get();
  const goal = s.settings.dailyKcalGoal;
  const t = store.totalsOn(selected);
  const scans = store.scansOn(selected);
  const isToday = selected === todayStr();
  return h('div', { class: 'screen' },
    header(s.profile),
    weekBar(),
    h('section', { class: 'card cal-card', 'aria-label': 'Calories' },
      h('div', { class: 'cal-head' },
        h('h2', { class: 'cal-title' }, isToday ? 'Today Calories' : 'Calories', icon('flame', 20)),
        h('button', { class: 'cal-goal', 'aria-label': `Daily goal ${goal} kilocalories, change`, onclick: goalSheet }, `Goal ${fmt(goal)}`)),
      gauge(t.kcal, goal),
      statRow(t.kcal, goal),
      macros(t, goal)),
    h('section', { 'aria-label': 'Meals' },
      h('div', { class: 'section-head' },
        h('h2', { class: 'section-title' }, isToday ? 'Today Meals' : 'Meals'),
        scans.length ? h('span', { class: 'muted' }, `${scans.length} ${scans.length === 1 ? 'meal' : 'meals'} · ${fmt(t.kcal)} kcal`) : null),
      scans.length
        ? h('ul', { class: 'meal-list' }, scans.map(scanRow))
        : h('div', { class: 'empty card' },
          h('div', { class: 'empty-art' }, icon('plate', 40)),
          h('p', {}, isToday ? 'No meals yet today' : 'No meals on this day'),
          h('p', { class: 'muted' }, 'Snap your food and Kalibri estimates the calories'),
          h('div', { class: 'arrow', 'aria-hidden': 'true' }, '↓'))),
    h('button', { class: 'fab', onclick: () => openScanner({ date: selected }) }, icon('camera', 22), 'Scan food'));
}
