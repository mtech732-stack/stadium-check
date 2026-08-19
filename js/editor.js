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

/* ــــ ترويسة النموذج ــــ */

function renderHeader() {
  const root = $('#edHeader');
  root.textContent = '';
  const m = FORM.meta;

  const body = el('div', { class: 'body' }, [
    textField('اسم الجهة', m.org, v => m.org = v),
    textField('العنوان الرسمي (يظهر في المطبوعة)', m.title, v => m.title = v, true),
    textField('العنوان المختصر (يظهر أعلى شاشة التطبيق)', m.shortTitle, v => m.shortTitle = v)
  ]);

  root.appendChild(el('section', { class: 'card' }, [
    el('header', {}, [el('h2', { text: 'ترويسة النموذج' })]),
    body
  ]));
}

/* ــــ حقول بيانات الزيارة ــــ */

const FIELD_TYPES = [
  { id: 'text',   label: 'نصّ' },
  { id: 'date',   label: 'تاريخ' },
  { id: 'number', label: 'رقم' }
];

function renderFields() {
  const root = $('#edFields');
  root.textContent = '';
  const body = el('div', { class: 'body' });

  FORM.fields.forEach((f, i) => {
    const head = el('div', { class: 'head' }, [
      el('div', { class: 'no', text: String(i + 1) }),
      el('div', { class: 'sp' }),
      tools(FORM.fields, i, structuralChange,
        f.builtin
          ? `حذف حقل «${f.label}»؟ هو من حقول النموذج الأصلية، والأفضل إخفاؤه بدل حذفه.`
          : `حذف حقل «${f.label}»؟ القيم المدخلة فيه في التقارير القديمة تبقى محفوظة ولا تظهر.`)
    ]);

    const box = el('div', {}, [head, textField('التسمية', f.label, v => f.label = v)]);

    if (!f.builtin) {
      const sel = el('select');
      FIELD_TYPES.forEach(t => sel.appendChild(el('option', { value: t.id, text: t.label })));
      sel.value = f.type || 'text';
      sel.onchange = () => { f.type = sel.value; persist(false); };
      box.appendChild(el('div', { class: 'ed-field' }, [el('label', { text: 'النوع' }), sel]));
    }

    const chk = el('input', { type: 'checkbox', id: 'fx-' + f.id });
    chk.checked = f.enabled !== false;
    chk.onchange = () => { f.enabled = chk.checked; persist(false); };
    box.appendChild(el('label', { class: 'ed-check', for: 'fx-' + f.id }, [
      chk, el('span', { text: 'يظهر في التطبيق والمطبوعة' })
    ]));

    if (f.builtin) {
      box.appendChild(el('div', { class: 'ed-flag', text: 'حقل أصلي — تسميته تُعدَّل وسلوكه ثابت.' }));
    }

    body.appendChild(el('div', { class: 'ed-item' }, [box]));
  });

  const add = el('button', { type: 'button', class: 'ed-add', text: '+ حقل جديد' });
  add.onclick = () => {
    FORM.fields.push({ id: newFormId('f'), label: '', type: 'text', enabled: true });
    persist(true);
  };
  body.appendChild(add);

  root.appendChild(el('section', { class: 'card' }, [
    el('header', {}, [el('h2', { text: 'حقول بيانات الزيارة' })]),
    body
  ]));
}

/* ــــ القياسات ــــ */

function renderMeas() {
  const root = $('#edMeas');
  root.textContent = '';
  const body = el('div', { class: 'body' });

  FORM.measurements.forEach((ms, i) => {
    const num = (label, key) => {
      const inp = el('input', { type: 'number', step: 'any' });
      inp.value = (ms[key] === null || ms[key] === undefined) ? '' : ms[key];
      inp.oninput = () => { ms[key] = inp.value === '' ? null : parseFloat(inp.value); persist(false); };
      return el('div', { class: 'ed-field half' }, [el('label', { text: label }), inp]);
    };

    body.appendChild(el('div', { class: 'ed-item' }, [
      el('div', { class: 'head' }, [
        el('div', { class: 'no', text: String(i + 1) }),
        el('div', { class: 'sp' }),
        tools(FORM.measurements, i, structuralChange, `حذف قياس «${ms.label}» من النموذج؟`)
      ]),
      textField('اسم القياس', ms.label, v => ms.label = v),
      el('div', { class: 'ed-row' }, [
        num('الحدّ الأدنى', 'min'),
        num('الحدّ الأعلى', 'max')
      ]),
      textField('الوحدة', ms.unit, v => ms.unit = v),
      textField('نصّ المرجع المعتمد', ms.ref, v => ms.ref = v)
    ]));
  });

  const add = el('button', { type: 'button', class: 'ed-add', text: '+ قياس جديد' });
  add.onclick = () => {
    FORM.measurements.push({ id: newFormId('m'), label: '', unit: '', min: null, max: null, ref: '' });
    persist(true);
  };
  body.appendChild(add);

  root.appendChild(el('section', { class: 'card' }, [
    el('header', {}, [el('h2', { text: 'القياسات والقراءات' })]),
    el('div', { class: 'ed-hint', text: 'اترك الحدّ فارغاً إن لم يكن له سقف أو أرضية. القيمة الخارجة عن الحدّين تُنبَّه في التطبيق.' }),
    body
  ]));
}

/* ــــ الأندية والملاعب ــــ */

function renderClubs() {
  const root = $('#edClubs');
  root.textContent = '';
  const body = el('div', { class: 'body' });

  FORM.clubs.forEach((c, i) => {
    const name = el('input', { type: 'text', value: c.name, placeholder: 'النادي' });
    name.oninput = () => { c.name = name.value; persist(false); };
    const stad = el('input', { type: 'text', value: c.stadium, placeholder: 'الملعب' });
    stad.oninput = () => {
      /* الاسم القديم يُرفع من قائمة الملاعب، وإلّا بقي فيها كأنّه ملعب إضافي */
      const prev = c.stadium;
      c.stadium = stad.value;
      if (prev && !FORM.clubs.some(x => x.stadium === prev)) {
        const i2 = FORM.venues.indexOf(prev);
        if (i2 > -1) FORM.venues.splice(i2, 1);
      }
      syncVenues();
      persist(false);
    };
    const del = el('button', { type: 'button', class: 'danger', text: '×', 'aria-label': 'حذف' });
    del.onclick = () => {
      if (!confirm(`حذف نادي «${c.name}» من القائمة؟`)) return;
      FORM.clubs.splice(i, 1); syncVenues(); persist(true);
    };
    body.appendChild(el('div', { class: 'ed-club' }, [name, stad, del]));
  });

  const add = el('button', { type: 'button', class: 'ed-add', text: '+ نادٍ جديد' });
  add.onclick = () => { FORM.clubs.push({ name: '', stadium: '' }); persist(true); };
  body.appendChild(add);

  body.appendChild(el('div', { class: 'ed-sub', text: 'ملاعب إضافية (تظهر في قائمة اختيار الملعب)' }));
  const extras = FORM.venues.filter(v => !FORM.clubs.some(c => c.stadium === v));
  extras.forEach(v => {
    const inp = el('input', { type: 'text', value: v });
    inp.oninput = () => {
      const idx = FORM.venues.indexOf(v);
      if (idx > -1) { FORM.venues[idx] = inp.value; }
      persist(false);
    };
    const rm = el('button', { type: 'button', text: '×', 'aria-label': 'حذف الملعب' });
    rm.onclick = () => {
      const idx = FORM.venues.indexOf(v);
      if (idx > -1) FORM.venues.splice(idx, 1);
      persist(true);
    };
    body.appendChild(el('div', { class: 'ed-phrase' }, [inp, rm]));
  });

  const addV = el('button', { type: 'button', class: 'ed-add small', text: '+ ملعب إضافي' });
  addV.onclick = () => { FORM.venues.push(''); persist(true); };
  body.appendChild(addV);

  root.appendChild(el('section', { class: 'card' }, [
    el('header', {}, [el('h2', { text: 'الأندية والملاعب' })]),
    body
  ]));
}

/* ملاعب الأندية تدخل قائمة الاختيار تلقائياً، مع ما أُضيف يدوياً */
function syncVenues() {
  const extras = FORM.venues.filter(v => v && !FORM.clubs.some(c => c.stadium === v));
  FORM.venues = FORM.clubs.map(c => c.stadium).filter(Boolean).concat(extras);
}

function render() {
  renderHeader();
  renderFields();

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

  renderMeas();
  renderClubs();
}

/* ــــ ملخّص التعديلات مقارنةً بالنموذج الأصلي ــــ */

function diffLines() {
  const base = defaultForm();
  const L = [];

  /* الترويسة */
  const metaLabels = { org: 'اسم الجهة', title: 'العنوان الرسمي', shortTitle: 'العنوان المختصر' };
  const metaChanges = Object.keys(metaLabels)
    .filter(k => (FORM.meta[k] || '') !== (base.meta[k] || ''))
    .map(k => `• ${metaLabels[k]}: «${base.meta[k]}» ← «${FORM.meta[k]}»`);
  if (metaChanges.length) L.push('— الترويسة', ...metaChanges, '');

  /* حقول بيانات الزيارة */
  const fieldChanges = [];
  FORM.fields.forEach(f => {
    const old = base.fields.find(x => x.id === f.id);
    if (!old) { fieldChanges.push(`• حقل جديد: «${f.label}» (${f.type})`); return; }
    if (old.label !== f.label) fieldChanges.push(`• تسمية: «${old.label}» ← «${f.label}»`);
    if ((f.enabled !== false) !== (old.enabled !== false)) {
      fieldChanges.push(`• ${f.enabled === false ? 'أُخفي' : 'أُظهر'}: «${f.label}»`);
    }
  });
  base.fields.forEach(old => {
    if (!FORM.fields.some(f => f.id === old.id)) fieldChanges.push(`• حُذف حقل: «${old.label}»`);
  });
  if (fieldChanges.length) L.push('— حقول بيانات الزيارة', ...fieldChanges, '');

  /* المحاور والبنود */
  const secChanges = [];
  FORM.sections.forEach((sec, si) => {
    const old = base.sections.find(s => s.id === sec.id);
    const no = si + 1;
    if (!old) {
      secChanges.push(`• محور جديد (${no}): «${sec.title}» — ${sec.items.length} بنود`);
      sec.items.forEach((it, i) => secChanges.push(`    ${no}/${i + 1} بند جديد: ${it.text}`));
      return;
    }
    if (old.title !== sec.title) secChanges.push(`• عنوان المحور ${no}: «${old.title}» ← «${sec.title}»`);

    sec.items.forEach((it, ii) => {
      const oi = old.items.find(x => x.id === it.id);
      const ref = `${no}/${ii + 1}`;
      if (!oi) { secChanges.push(`    ${ref} بند جديد: ${it.text}`); return; }
      if (oi.text !== it.text) secChanges.push(`    ${ref} نصّ: «${oi.text}» ← «${it.text}»`);
      const added = (it.phrases || []).filter(p => !(oi.phrases || []).includes(p));
      const gone  = (oi.phrases || []).filter(p => !(it.phrases || []).includes(p));
      added.forEach(p => secChanges.push(`    ${ref} + عبارة: ${p}`));
      gone.forEach(p => secChanges.push(`    ${ref} − عبارة: ${p}`));
    });

    old.items.forEach(oi => {
      if (!sec.items.some(x => x.id === oi.id)) secChanges.push(`    (محور ${no}) حُذف بند: ${oi.text}`);
    });
  });
  base.sections.forEach(old => {
    if (!FORM.sections.some(s => s.id === old.id)) secChanges.push(`• حُذف محور: «${old.title}» بكلّ بنوده`);
  });

  const baseOrder = base.sections.map(s => s.id).filter(id => FORM.sections.some(s => s.id === id));
  const nowOrder  = FORM.sections.map(s => s.id).filter(id => base.sections.some(s => s.id === id));
  if (baseOrder.join() !== nowOrder.join()) secChanges.push('• أُعيد ترتيب المحاور');

  if (secChanges.length) L.push('— المحاور والبنود', ...secChanges, '');

  /* القياسات */
  const measChanges = [];
  FORM.measurements.forEach(ms => {
    const old = base.measurements.find(x => x.id === ms.id);
    if (!old) { measChanges.push(`• قياس جديد: «${ms.label}» ${ms.ref}`); return; }
    const keyLabels = { label: 'الاسم', unit: 'الوحدة', ref: 'نصّ المرجع', min: 'الحدّ الأدنى', max: 'الحدّ الأعلى' };
    Object.keys(keyLabels).forEach(k => {
      const a = old[k] === null || old[k] === undefined ? '—' : old[k];
      const b = ms[k] === null || ms[k] === undefined ? '—' : ms[k];
      if (String(a) !== String(b)) measChanges.push(`• ${old.label} · ${keyLabels[k]}: ${a} ← ${b}`);
    });
  });
  base.measurements.forEach(old => {
    if (!FORM.measurements.some(m => m.id === old.id)) measChanges.push(`• حُذف قياس: «${old.label}»`);
  });
  if (measChanges.length) L.push('— القياسات', ...measChanges, '');

  /* الأندية والملاعب */
  const clubChanges = [];
  FORM.clubs.forEach(c => {
    const old = base.clubs.find(x => x.name === c.name);
    if (!old) { clubChanges.push(`• نادٍ جديد: ${c.name} — ${c.stadium}`); return; }
    if (old.stadium !== c.stadium) clubChanges.push(`• ملعب ${c.name}: «${old.stadium}» ← «${c.stadium}»`);
  });
  base.clubs.forEach(old => {
    if (!FORM.clubs.some(c => c.name === old.name)) clubChanges.push(`• حُذف نادٍ: ${old.name}`);
  });
  const vAdd = FORM.venues.filter(v => v && !base.venues.includes(v) && !FORM.clubs.some(c => c.stadium === v));
  const vDel = base.venues.filter(v => !FORM.venues.includes(v) && !base.clubs.some(c => c.stadium === v));
  vAdd.forEach(v => clubChanges.push(`• ملعب إضافي: ${v}`));
  vDel.forEach(v => clubChanges.push(`• حُذف ملعب إضافي: ${v}`));
  if (clubChanges.length) L.push('— الأندية والملاعب', ...clubChanges, '');

  return L;
}

function diffText() {
  const now = new Date();
  const head = [
    'تعديلات على نموذج فحص الملاعب',
    `التاريخ: ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`,
    ''
  ];
  const body = diffLines();
  if (!body.length) return head.concat(['(لا تعديلات — النموذج مطابق للأصل)']).join('\n');
  return head.concat(body).join('\n').replace(/\n+$/, '\n');
}

function showOut(text) {
  const out = $('#edOut');
  out.textContent = '';
  const ta = el('textarea', { readonly: 'readonly' });
  ta.value = text;
  out.appendChild(ta);
  out.removeAttribute('hidden');
  ta.focus();
  ta.setSelectionRange(0, ta.value.length);
}

$('#edShow').onclick = () => showOut(diffText());

$('#edCopy').onclick = async () => {
  const text = diffText();
  const btn = $('#edCopy');
  try {
    await navigator.clipboard.writeText(text);
    const old = btn.textContent;
    btn.textContent = 'نُسخت ✓';
    setTimeout(() => { btn.textContent = old; }, 1800);
  } catch (e) {
    showOut(text);
  }
};

$('#edDownload').onclick = () => {
  const blob = new Blob([JSON.stringify(stripRuntime(FORM), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const a = el('a', {
    href: url,
    download: `نموذج-فحص-الملاعب-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
  });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

const edFile = $('#edFile');
$('#edImport').onclick = () => edFile.click();
edFile.onchange = () => {
  const file = edFile.files[0];
  edFile.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); }
    catch (e) { alert('الملفّ غير صالح — تعذّرت قراءته.'); return; }
    if (!validForm(data)) { alert('الملفّ ليس نموذجاً صالحاً.'); return; }
    if (!confirm('استيراد هذا النموذج؟ سيحلّ محلّ نموذجك الحالي. التقارير المحفوظة لا تتأثّر.')) return;
    saveForm(annotateForm(data));
    location.reload();
  };
  reader.readAsText(file);
};

$('#edReset').onclick = () => {
  if (!confirm('استعادة النموذج الأصلي؟ سيُلغى كلّ تعديل أجريتَه على المحاور والبنود والعبارات. التقارير المحفوظة لا تتأثّر.')) return;
  resetForm();
  location.reload();
};

render();
refreshState();
