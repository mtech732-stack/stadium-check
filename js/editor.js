/* تعديل النموذج — عيّنة الخطوة ٦أ: المحور الأول وحده.
   البنود تُعرّف بمعرّف ثابت، فالحذف وإعادة الترتيب لا يمسّان التقارير المحفوظة. */

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
    if (rerender) render();
  }, 250);
}

function refreshState() {
  const s = $('#edState');
  if (isFormCustomized()) {
    s.innerHTML = '<span class="ed-custom">نموذج معدَّل</span> — يختلف عن الأصل';
  } else {
    s.textContent = 'النموذج الأصلي';
  }
}

/* حقل نصّي يحفظ عند كلّ حرف */
function textField(label, value, onChange, multiline) {
  const input = multiline
    ? el('textarea', { rows: '3' })
    : el('input', { type: 'text' });
  input.value = value || '';
  input.oninput = () => { onChange(input.value); persist(false); };
  return el('div', { class: 'ed-field' }, [
    label ? el('label', { text: label }) : null,
    input
  ].filter(Boolean));
}

function buildItem(sec, item, idx) {
  const tools = el('div', { class: 'ed-tools' });

  const up = el('button', { type: 'button', text: '▲', title: 'أعلى' });
  up.disabled = idx === 0;
  up.onclick = () => {
    sec.items.splice(idx - 1, 0, sec.items.splice(idx, 1)[0]);
    annotateForm(FORM); persist(true);
  };

  const down = el('button', { type: 'button', text: '▼', title: 'أسفل' });
  down.disabled = idx === sec.items.length - 1;
  down.onclick = () => {
    sec.items.splice(idx + 1, 0, sec.items.splice(idx, 1)[0]);
    annotateForm(FORM); persist(true);
  };

  const del = el('button', { type: 'button', class: 'danger', text: 'حذف' });
  del.onclick = () => {
    if (!confirm('حذف هذا البند من النموذج؟ الإجابات المسجّلة عليه في التقارير القديمة تبقى محفوظة ولا تظهر.')) return;
    sec.items.splice(idx, 1);
    annotateForm(FORM); persist(true);
  };

  tools.appendChild(up); tools.appendChild(down); tools.appendChild(del);

  const head = el('div', { class: 'head' }, [
    el('div', { class: 'no', text: String(item._n) }),
    el('div', { class: 'sp' }),
    tools
  ]);

  const body = el('div', {}, [
    textField('نصّ البند', item.text, v => item.text = v, true),
    el('div', { class: 'ed-sub', text: 'العبارات الجاهزة' })
  ]);

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

function render() {
  const root = $('#edSection');
  root.textContent = '';

  const sec = FORM.sections[0];
  const body = el('div', { class: 'body' });

  body.appendChild(textField('عنوان المحور', sec.title, v => sec.title = v));
  body.appendChild(el('div', { class: 'ed-sub', text: `البنود (${sec.items.length})` }));

  sec.items.forEach((it, i) => body.appendChild(buildItem(sec, it, i)));

  const add = el('button', { type: 'button', class: 'ed-add', text: '+ بند جديد' });
  add.onclick = () => {
    sec.items.push({ id: newFormId('i'), text: '', phrases: [] });
    annotateForm(FORM); persist(true);
  };
  body.appendChild(add);

  root.appendChild(el('section', { class: 'card' }, [
    el('header', {}, [
      el('div', { class: 'num', text: String(sec._n) }),
      el('h2', { text: sec.title || 'محور بلا عنوان' })
    ]),
    body
  ]));
}

$('#edReset').onclick = () => {
  if (!confirm('استعادة النموذج الأصلي؟ سيُلغى كلّ تعديل أجريتَه على البنود والعبارات. التقارير المحفوظة لا تتأثّر.')) return;
  resetForm();
  location.reload();
};

render();
refreshState();
