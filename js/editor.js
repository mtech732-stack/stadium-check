/* تعديل النموذج — المحاور الثمانية وبنودها كلّها.
   البنود والمحاور تُعرّف بمعرّف ثابت، فالحذف وإعادة الترتيب لا يمسّان التقارير المحفوظة. */

const $ = s => document.querySelector(s);

const el = (tag, attrs, kids) => {
  const n = document.createElement(tag);
  for (const k in (attrs || {})) {
    if (k === 'text') n.textContent = attrs[k];
    else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
  }
  (kids || []).forEach(c => c && n.appendChild(c));
  return n;
};

function pad(n) { return String(n).padStart(2, '0'); }

/* المحور المفتوح حالياً — يُحفظ ليبقى مفتوحاً بعد إعادة الرسم */
let openSection = null;

let timer = null;
function persist(rerender) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const ok = saveForm(FORM);
    const now = new Date();
    $('#edSaved').innerHTML = ok
      ? `<b style="color:var(--ok)">حُفظ</b> · ${pad(now.getHours())}:${pad(now.getMinutes())}`
      : 'تعذّر الحفظ في هذا المتصفّح';
    refreshState();
    if (rerender) {
      const y = window.scrollY;
      render();
      window.scrollTo(0, y);
    }
  }, 250);
}

function refreshState() {
  const items = FORM.sections.reduce((a, s) => a + s.items.length, 0);
  const label = `${FORM.sections.length} محاور · ${items} بنداً`;
  $('#edState').innerHTML = isFormCustomized()
    ? `<span class="ed-custom">نموذج معدَّل</span> — ${label}`
    : `النموذج الأصلي — ${label}`;
}

function textField(label, value, onChange, multiline) {
  const input = multiline ? el('textarea', { rows: '3' }) : el('input', { type: 'text' });
  input.value = value || '';
  input.oninput = () => { onChange(input.value); persist(false); };
  return el('div', { class: 'ed-field' }, [
    label ? el('label', { text: label }) : null,
    input
  ].filter(Boolean));
}

/* أزرار الترتيب والحذف — مشتركة بين المحور والبند */
function tools(list, idx, onChange, delMsg, extraClass) {
  const box = el('div', { class: 'ed-tools' + (extraClass ? ' ' + extraClass : '') });

  const up = el('button', { type: 'button', text: '▲', 'aria-label': 'تحريك لأعلى' });
  up.disabled = idx === 0;
  up.onclick = ev => {
    ev.stopPropagation();
    list.splice(idx - 1, 0, list.splice(idx, 1)[0]);
    onChange();
  };

  const down = el('button', { type: 'button', text: '▼', 'aria-label': 'تحريك لأسفل' });
  down.disabled = idx === list.length - 1;
  down.onclick = ev => {
    ev.stopPropagation();
    list.splice(idx + 1, 0, list.splice(idx, 1)[0]);
    onChange();
  };

  const del = el('button', { type: 'button', class: 'danger', text: 'حذف' });
  del.onclick = ev => {
    ev.stopPropagation();
    if (!confirm(delMsg)) return;
    list.splice(idx, 1);
    onChange();
  };

  box.appendChild(up); box.appendChild(down); box.appendChild(del);
  return box;
}

function structuralChange() {
  annotateForm(FORM);
  persist(true);
}

function buildItem(sec, item, idx) {
  const head = el('div', { class: 'head' }, [
    el('div', { class: 'no', text: String(item._n) }),
    el('div', { class: 'sp' }),
    tools(sec.items, idx, structuralChange,
      'حذف هذا البند من النموذج؟ الإجابات المسجّلة عليه في التقارير القديمة تبقى محفوظة ولا تظهر.')
  ]);

  const body = el('div', {}, [
    textField('نصّ البند', item.text, v => item.text = v, true)
  ]);

  if (item.num) {
    body.appendChild(el('div', { class: 'ed-flag', text:
      `يحمل هذا البند حقلاً رقمياً: ${item.num.label} (${item.num.unit}). تعديله في مرحلة لاحقة.` }));
  }

  body.appendChild(el('div', { class: 'ed-sub', text: 'العبارات الجاهزة' }));

  (item.phrases || []).forEach((p, pi) => {
    const inp = el('input', { type: 'text', value: p });
    inp.oninput = () => { item.phrases[pi] = inp.value; persist(false); };
    const rm = el('button', { type: 'button', text: '×', 'aria-label': 'حذف العبارة' });
    rm.onclick = () => { item.phrases.splice(pi, 1); persist(true); };
    body.appendChild(el('div', { class: 'ed-phrase' }, [inp, rm]));
  });

  const addP = el('button', { type: 'button', class: 'ed-add small', text: '+ عبارة جاهزة' });
  addP.onclick = () => { item.phrases.push(''); persist(true); };
  body.appendChild(addP);

  return el('div', { class: 'ed-item' }, [head, body]);
}

function buildSection(sec, idx) {
  const isOpen = openSection === sec.id;

  const caret = el('span', { class: 'caret', text: isOpen ? '▲' : '▼' });
  const head = el('header', { class: 'ed-sechead' }, [
    el('div', { class: 'num', text: String(sec._n) }),
    el('h2', { text: sec.title || 'محور بلا عنوان' }),
    el('span', { class: 'badge', text: `${sec.items.length} بنود` }),
    caret
  ]);
  head.onclick = () => {
    openSection = isOpen ? null : sec.id;
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  };

  const card = el('section', { class: 'card ed-sec' + (isOpen ? ' open' : '') }, [head]);
  if (!isOpen) return card;

  const body = el('div', { class: 'body' });

  body.appendChild(el('div', { class: 'ed-secrow' }, [
    tools(FORM.sections, idx, structuralChange,
      `حذف المحور «${sec.title}» بكلّ بنوده؟ الإجابات المسجّلة عليها في التقارير القديمة تبقى محفوظة ولا تظهر.`,
      'wide')
  ]));

  body.appendChild(textField('عنوان المحور', sec.title, v => {
    sec.title = v;
    head.querySelector('h2').textContent = v || 'محور بلا عنوان';
  }));

  body.appendChild(el('div', { class: 'ed-sub', text: `البنود (${sec.items.length})` }));
  sec.items.forEach((it, i) => body.appendChild(buildItem(sec, it, i)));

  const add = el('button', { type: 'button', class: 'ed-add', text: '+ بند جديد' });
  add.onclick = () => {
    sec.items.push({ id: newFormId('i'), text: '', phrases: [] });
    structuralChange();
  };
  body.appendChild(add);

  card.appendChild(body);
  return card;
}

function render() {
  const root = $('#edSections');
  root.textContent = '';
  FORM.sections.forEach((sec, i) => root.appendChild(buildSection(sec, i)));

  const addSec = el('button', { type: 'button', class: 'ed-add', text: '+ محور جديد' });
  addSec.onclick = () => {
    const sec = { id: newFormId('s'), title: '', items: [] };
    FORM.sections.push(sec);
    openSection = sec.id;
    structuralChange();
  };
  root.appendChild(addSec);
}

$('#edReset').onclick = () => {
  if (!confirm('استعادة النموذج الأصلي؟ سيُلغى كلّ تعديل أجريتَه على المحاور والبنود والعبارات. التقارير المحفوظة لا تتأثّر.')) return;
  resetForm();
  location.reload();
};

render();
refreshState();
