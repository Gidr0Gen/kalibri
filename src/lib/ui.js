// Shared UI pieces: bottom sheet, confirm dialog, form field, items editor.
import { h } from './util.js';

export function openSheet(title, build, { onClose } = {}) {
  const prevFocus = document.activeElement;
  const close = () => { if (!back.isConnected) return; back.remove(); document.removeEventListener('keydown', onKey); prevFocus?.focus?.(); onClose?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'grabber', 'aria-hidden': 'true' }),
    h('div', { class: 'sheet-head' },
      h('h2', {}, title),
      h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close }, '✕')),
    build(close));
  const back = h('div', { class: 'backdrop', onclick: (e) => { if (e.target === back) close(); } }, panel);
  document.body.append(back);
  document.addEventListener('keydown', onKey);
  panel.querySelector('input,select,button.primary')?.focus?.({ preventScroll: true });
  return close;
}

export function confirmDialog(message, { requireWord = null, okLabel = 'Confirm', danger = true } = {}) {
  return new Promise((resolve) => {
    openSheet('Are you sure?', (close) => {
      const input = requireWord ? h('input', { type: 'text', placeholder: `Type ${requireWord}`, autocapitalize: 'characters', 'aria-label': `Type ${requireWord} to confirm` }) : null;
      const ok = h('button', { class: danger ? 'btn danger' : 'btn primary', disabled: !!requireWord, onclick: () => { resolve(true); close(); } }, okLabel);
      input?.addEventListener('input', () => { ok.disabled = input.value.trim() !== requireWord; });
      return h('div', { class: 'stack' }, h('p', {}, message), input,
        h('div', { class: 'row-btns' }, h('button', { class: 'btn', onclick: close }, 'Cancel'), ok));
    }, { onClose: () => resolve(false) }); // resolve(true) above wins; later resolve(false) is a no-op
  });
}

export const field = (label, control, hint) => h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), control, hint && h('span', { class: 'hint' }, hint));

export const num = (props) => h('input', { type: 'number', inputmode: 'decimal', step: 'any', min: 0, ...props });

// Editable list of items. Mutates draft.items / draft.totalKcal. Editing grams scales the
// item's nutrition proportionally; editing kcal changes kcal only.
export function itemsEditor(draft, onChange) {
  const total = h('div', { class: 'total-line' });
  const list = h('div', { class: 'items' });
  const recalc = () => {
    draft.totalKcal = Math.round(draft.items.reduce((a, i) => a + (Number(i.kcal) || 0), 0));
    total.replaceChildren('Total ', h('strong', {}, `${draft.totalKcal} kcal`));
    onChange?.();
  };
  const draw = () => {
    list.replaceChildren(...draft.items.map((it) => {
      const kcalIn = num({ value: it.kcal, 'aria-label': `${it.name} kcal` });
      const gramsIn = num({ value: it.grams, 'aria-label': `${it.name} grams` });
      gramsIn.addEventListener('input', () => {
        const g = Math.max(0, Number(gramsIn.value) || 0);
        if (it.grams > 0 && g > 0) {
          const k = g / it.grams;
          it.kcal = Math.round(it.kcal * k);
          for (const m of ['protein', 'carbs', 'fat']) it[m] = Math.round((it[m] || 0) * k * 10) / 10;
          kcalIn.value = it.kcal;
        }
        it.grams = g; recalc();
      });
      kcalIn.addEventListener('input', () => { it.kcal = Math.max(0, Number(kcalIn.value) || 0); recalc(); });
      return h('div', { class: 'item-row' },
        h('input', { type: 'text', value: it.name, 'aria-label': 'Item name', class: 'item-name', oninput: (e) => { it.name = e.target.value; } }),
        h('div', { class: 'item-nums' },
          h('label', {}, gramsIn, h('span', {}, 'g')),
          h('label', {}, kcalIn, h('span', {}, 'kcal'))),
        h('button', { class: 'icon-btn', 'aria-label': `Remove ${it.name}`, onclick: () => { draft.items = draft.items.filter((x) => x !== it); draw(); recalc(); } }, '✕'));
    }));
  };
  draw(); recalc();
  return h('div', { class: 'stack' }, list, total);
}
