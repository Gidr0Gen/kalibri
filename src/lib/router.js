// Tiny History-API router: /, /progress, /profile + bottom tab bar.
import { h, svg } from './util.js';
import * as store from './storage.js';
import { trackPageview } from './analytics.js';

// Works at the domain root (dev) and under a sub-path (GitHub Pages: /kalibri/).
const BASE = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');
const current = () => { const p = location.pathname.slice(BASE.length) || '/'; return p.length > 1 ? p.replace(/\/$/, '') : p; };

let routes = {};
let viewEl;
let tabEl;
let lastPath = null;
let enterTimer;

export function navigate(path) {
  if (current() !== path) history.pushState({}, '', BASE + path);
  rerender();
  window.scrollTo(0, 0);
}

export function rerender() {
  const cur = current();
  const route = routes[cur] || routes['/'];
  const path = routes[cur] ? cur : '/';
  if (path !== lastPath) {
    lastPath = path;
    trackPageview(path);
    viewEl.classList.add('enter');
    clearTimeout(enterTimer);
    enterTimer = setTimeout(() => viewEl.classList.remove('enter'), 900);
  }
  viewEl.replaceChildren(route.view());
  tabEl.querySelectorAll('a').forEach((a) => {
    const on = a.dataset.path === path;
    a.classList.toggle('active', on);
    on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });
}

const icon = (d) => svg('svg', { viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, svg('path', { d }));
const ICONS = {
  '/': 'M12 3a9 9 0 1 0 9 9M12 3v9l6 3',
  '/progress': 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  '/profile': 'M20 21a8 8 0 0 0-16 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
};

export function start(root, routeTable) {
  routes = routeTable;
  viewEl = h('main', { class: 'view' });
  tabEl = h('nav', { class: 'tabbar', 'aria-label': 'Main' },
    Object.entries(routes).map(([path, r]) => h('a', {
      href: BASE + path, 'data-path': path, class: 'tab',
      onclick: (e) => { e.preventDefault(); navigate(path); },
    }, h('span', { class: 'ico' }, icon(ICONS[path])), h('span', {}, r.label))));
  root.replaceChildren(viewEl, tabEl);
  window.addEventListener('popstate', rerender);
  store.subscribe(rerender);
  rerender();
}
