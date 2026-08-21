/* منطق التطبيق: التوليد من البيانات، الحالة، الحفظ التلقائي. */

const KEY_REPORTS = 'sc.reports';   /* كلّ التقارير: { id: report } */
const KEY_CURRENT = 'sc.current';   /* معرّف التقرير المفتوح */
const KEY_PREFS   = 'sc.prefs';
const KEY_LEGACY  = 'sc.report.draft';

const store = {
  read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  },
  write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }
};

const prefs = store.read(KEY_PREFS, { inspector: '' });

function newId() {
  return 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

function blankReport(id) {
  return {
    id: id,
    savedAt: 0,
    meta: {
      club: '', stadium: '', date: '', time: '', season: '',
      inspector: prefs.inspector,
      decision: '',   /* تجاوز يدوي لحالة الاعتماد؛ فارغ = يُؤخذ الاقتراح الآلي */
      recheck: '',
      general: '',
      extra: {}   /* قيم الحقول المضافة من صفحة التعديل */
    },
    items: {},  /* "1.3": { s: 'fix', note: '...' } */
    nums: {},   /* قيم رقمية داخل البنود، مثل السعة الجماهيرية */
    meas: {}    /* جدول القياسات: { len: { v, note } } */
  };
}

/* ترقيع تقرير قديم ليطابق البنية الحالية */
function normalize(r, id) {
  if (!r.id) r.id = id;
  if (!r.meta) r.meta = blankReport(id).meta;
  if (!r.items) r.items = {};
  if (!r.nums) r.nums = {};
  if (!r.meas) r.meas = {};
  if (!r.savedAt) r.savedAt = 0;
  ['decision', 'recheck', 'general'].forEach(k => { if (!(k in r.meta)) r.meta[k] = ''; });
  if (!r.meta.extra || typeof r.meta.extra !== 'object') r.meta.extra = {};
  /* ترحيل المفاتيح الموضعية القديمة (3.5) إلى المعرّفات الثابتة (i-3-5) */
  Object.keys(r.items).forEach(k => {
    const m = k.match(/^(\d+)\.(\d+)$/);
    if (m) { r.items['i-' + m[1] + '-' + m[2]] = r.items[k]; delete r.items[k]; }
  });
  Object.values(r.items).forEach(x => {
    if (x.s === 'na') x.s = '';
    /* تقارير سُجّلت حين كانت العبارات تُختار لا تُدرَج: تُدمج في نصّ الملاحظة */
    if (Array.isArray(x.sel)) {
      if (x.sel.length) {
        const head = (x.s === 'ok' ? 'مطابق: ' : '') + x.sel.join(' · ');
        x.note = x.note ? head + ' — ' + x.note : head;
      }
      delete x.sel;
    }
  });
  return r;
}

const reports = store.read(KEY_REPORTS, {});
let currentId = store.read(KEY_CURRENT, '');

/* ترحيل مسودّة النسخة السابقة إلى الأرشيف */
const legacy = store.read(KEY_LEGACY, null);
if (legacy && !Object.keys(reports).length) {
  const id = newId();
  reports[id] = normalize(legacy, id);
  currentId = id;
  try { localStorage.removeItem(KEY_LEGACY); } catch (e) { /* لا يضرّ بقاؤها */ }
}

Object.keys(reports).forEach(id => normalize(reports[id], id));

if (!currentId || !reports[currentId]) {
  currentId = newId();
  reports[currentId] = blankReport(currentId);
}

const state = reports[currentId];

/* ــــ أدوات ــــ */

const $  = (sel, root) => (root || document).querySelector(sel);
const el = (tag, attrs, kids) => {
  const node = document.createElement(tag);
  for (const k in (attrs || {})) {
    if (k === 'text') node.textContent = attrs[k];
    else if (k === 'html') node.innerHTML = attrs[k];
    else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
  }
  (kids || []).forEach(c => node.appendChild(c));
  return node;
};

function pad(n) { return String(n).padStart(2, '0'); }

/* تمييز العدد في العربية: بند واحد · بندان · ٣–١٠ بنود · ما بعدها بنداً */
function bandCount(n) {
  if (n === 1) return 'بندٍ واحد';
  if (n === 2) return 'بندَين';
  if (n >= 3 && n <= 10) return `${n} بنود`;
  return `${n} بنداً`;
}

/* مطابقة الفعل/الوصف للعدد: مفرد · مثنّى · جمع */
function agree(n, one, two, many) { return n === 1 ? one : n === 2 ? two : many; }

/* نصّ الملاحظة — صار حقلاً نصّياً واحداً تُدرَج فيه العبارات ويُعدَّل عليها */
function noteText(rec) {
  return rec && rec.note ? rec.note.trim() : '';
}

function seasonOf(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d)) return '';
  const y = d.getFullYear();
  /* الموسم الرياضي يبدأ في سبتمبر */
  return d.getMonth() >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    state.savedAt = Date.now();
    reports[currentId] = state;
    const ok = store.write(KEY_REPORTS, reports) && store.write(KEY_CURRENT, currentId);
    store.write(KEY_PREFS, { inspector: state.meta.inspector });
    const now = new Date();
    $('#savedAt').innerHTML = ok
      ? `<b>حُفظ</b> تلقائياً · ${pad(now.getHours())}:${pad(now.getMinutes())}`
      : 'تعذّر الحفظ في هذا المتصفّح';
  }, 300);
}

/* ــــ الترويسة ــــ */

function buildMeta() {
  const wrap = $('#metaFields');
  const m = state.meta;

  if (!m.date) {
    const now = new Date();
    m.date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    m.time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
  if (!m.season) m.season = seasonOf(m.date);

  const clubSel = el('select', { id: 'f_club' }, [el('option', { value: '', text: 'اختر النادي' })]);
  CLUBS.forEach(c => clubSel.appendChild(el('option', { value: c.name, text: c.name })));
  clubSel.value = m.club;
  clubSel.onchange = () => {
    m.club = clubSel.value;
    const found = CLUBS.find(c => c.name === m.club);
    if (found) { m.stadium = found.stadium; $('#f_stadium').value = found.stadium; }
    save();
  };

  const field = (label, control, hint, wide) => {
    const kids = [el('label', { text: label, for: control.id }), control];
    if (hint) kids.push(el('div', { class: 'hint', text: hint }));
    return el('div', { class: 'field' + (wide ? ' wide' : '') }, kids);
  };

  const input = (id, type, value, onInput) => {
    const i = el('input', { id, type, value: value || '' });
    i.oninput = () => { onInput(i.value); save(); };
    return i;
  };

  /* قائمة الملاعب المقترحة — يُختار منها أو يُكتب اسم آخر */
  const venues = el('datalist', { id: 'venues' });
  VENUES.forEach(v => venues.appendChild(el('option', { value: v })));
  wrap.appendChild(venues);

  /* الحقول تُبنى من تعريف النموذج، فتعديل تسمية أو إخفاء حقل يسري هنا وفي المطبوعة */
  FIELDS.filter(f => f.enabled !== false).forEach(f => {
    if (f.id === 'club') {
      wrap.appendChild(field(f.label, clubSel));
      return;
    }
    if (f.id === 'stadium') {
      const stadium = input('f_stadium', 'text', m.stadium, v => m.stadium = v);
      stadium.setAttribute('list', 'venues');
      wrap.appendChild(field(f.label, stadium, 'يُملأ تلقائياً · أو اختر من القائمة'));
      return;
    }
    if (f.id === 'date') {
      wrap.appendChild(field(f.label, input('f_date', 'date', m.date, v => {
        m.date = v; m.season = seasonOf(v);
        const s = $('#f_season'); if (s) s.value = m.season;
      })));
      return;
    }
    if (f.id === 'time') {
      wrap.appendChild(field(f.label, input('f_time', 'time', m.time, v => m.time = v)));
      return;
    }
    if (f.id === 'season') {
      const season = el('input', { id: 'f_season', type: 'text', value: m.season, readonly: 'readonly' });
      wrap.appendChild(field(f.label, season, 'يُشتقّ من التاريخ'));
      return;
    }
    if (f.id === 'inspector') {
      wrap.appendChild(field(f.label,
        input('f_inspector', 'text', m.inspector, v => m.inspector = v),
        'يُحفظ ويظهر في كلّ تقرير', true));
      return;
    }
    /* حقل مضاف من صفحة التعديل */
    wrap.appendChild(field(f.label,
      input('f_' + f.id, f.type === 'number' ? 'number' : (f.type === 'date' ? 'date' : 'text'),
        m.extra[f.id], v => m.extra[f.id] = v),
      null, f.type === 'text'));
  });
}

/* ــــ بنود الفحص ــــ */

/* العبارات المتاحة تتبع الحالة: «مطابق» له مجموعته، والمخالفة لها مجموعتها */
function phrasesFor(item, s) {
  if (s === 'ok') return item.phrasesOk || [];
  if (s === 'fix' || s === 'no') return item.phrases || [];
  return [];
}

function buildItem(sec, item) {
  const key = item.id;
  const rec = state.items[key] || (state.items[key] = { s: '', note: '' });

  const autoOpen = () =>
    rec.s === 'fix' || rec.s === 'no' || !!rec.note ||
    (rec.s === 'ok' && phrasesFor(item, 'ok').length > 0);

  const note = el('div', { class: 'note', hidden: autoOpen() ? null : 'hidden' });
  const ta = el('textarea', { placeholder: 'الملاحظة / الإجراء المطلوب', rows: '2' });
  /* ملاحظات أُدرجت قبل التنقيط: كلّ سطر يطابق عبارةً معروفة يُنقَّط الآن،
     فتستوي القديمة والجديدة ولا يظنّ المستخدم أنّ التنقيط لا يعمل. */
  const known = (item.phrases || []).concat(item.phrasesOk || []);
  if (rec.note && known.length) {
    const fixed = rec.note.split('\n').map(line => {
      const t = line.trim();
      return (t && known.indexOf(t) > -1) ? '• ' + t : line;
    }).join('\n');
    if (fixed !== rec.note) { rec.note = fixed; save(); }
  }

  ta.value = rec.note;
  ta.rows = Math.max(2, String(rec.note || '').split('\n').length);

  /* العبارة تُدرَج نصّاً في الملاحظة عند النقر، فيعدّل عليها أو يضيف إليها مباشرةً */
  const chips = el('div', { class: 'phrases' });

  /* كلّ عبارة سطرٌ مُنقَّط. والمقارنة تتجاهل النقطة، فتصحّ مع ملاحظات
     سُجّلت قبل التنقيط ولا تُكرَّر العبارة بسببها. */
  const BULLET = '• ';
  const bare = line => line.replace(/^\s*[•\-–]\s*/, '').trim();
  const hasPhrase = p => ta.value.split('\n').some(line => bare(line) === p);

  /* كلّ عبارة في سطر مستقلّ — أوضح للقراءة في الشاشة وفي المطبوعة */
  function addPhrase(p) {
    if (hasPhrase(p)) return;
    let cur = ta.value.replace(/\s+$/, '');
    if (rec.s === 'ok' && !cur.trim()) cur = 'مطابق:';
    ta.value = cur ? cur + '\n' + BULLET + p : BULLET + p;
    ta.rows = Math.max(2, ta.value.split('\n').length);
  }

  function removePhrase(p) {
    const kept = ta.value.split('\n').filter(line => bare(line) !== p);
    let t = kept.join('\n').replace(/\n{2,}/g, '\n').trim();
    if (t === 'مطابق:') t = '';
    ta.value = t;
    ta.rows = Math.max(2, ta.value.split('\n').length);
  }

  function togglePhrase(p, btn) {
    if (hasPhrase(p)) removePhrase(p); else addPhrase(p);
    rec.note = ta.value;
    btn.setAttribute('aria-pressed', hasPhrase(p) ? 'true' : 'false');
    syncChips();
    syncNote();
    save();
  }

  /* بعد أيّ تغيير في النصّ تُعاد مطابقة أزرار العبارات لما فيه فعلاً */
  function syncChips() {
    chips.querySelectorAll('button[data-p]').forEach(b => {
      b.setAttribute('aria-pressed', hasPhrase(b.dataset.p) ? 'true' : 'false');
    });
  }

  function renderChips() {
    chips.textContent = '';
    const list = phrasesFor(item, rec.s);
    if (!list.length) return;
    chips.appendChild(el('div', { class: 'lbl',
      text: 'انقر العبارة لإضافتها، وانقرها ثانيةً لإزالتها — والنصّ قابل للتعديل' }));
    list.forEach(p => {
      const b = el('button', {
        type: 'button', text: p, 'data-p': p,
        'aria-pressed': hasPhrase(p) ? 'true' : 'false'
      });
      b.onclick = () => togglePhrase(p, b);
      chips.appendChild(b);
    });
  }

  note.appendChild(chips);
  note.appendChild(ta);
  renderChips();

  const seg = el('div', { class: 'seg', role: 'group' });

  const noteBtn = el('button', {
    type: 'button', 'data-s': 'note', text: 'ملاحظة',
    'aria-pressed': autoOpen() ? 'true' : 'false',
    'aria-label': 'إضافة ملاحظة'
  });

  const syncNote = () => {
    const open = !note.hasAttribute('hidden');
    noteBtn.setAttribute('aria-pressed', open ? 'true' : 'false');
    noteBtn.textContent = rec.note ? 'ملاحظة ✓' : 'ملاحظة';
  };

  STATUSES.forEach(st => {
    const b = el('button', {
      type: 'button', 'data-s': st.id, text: st.short,
      'aria-pressed': rec.s === st.id ? 'true' : 'false',
      'aria-label': st.label
    });
    b.onclick = () => {
      rec.s = rec.s === st.id ? '' : st.id;
      seg.querySelectorAll('button[data-s]:not([data-s="note"])').forEach(x =>
        x.setAttribute('aria-pressed', x.dataset.s === rec.s ? 'true' : 'false'));
      renderChips();
      if (autoOpen()) note.removeAttribute('hidden');
      else note.setAttribute('hidden', 'hidden');
      syncNote();
      refreshTally();
      save();
    };
    seg.appendChild(b);
  });

  noteBtn.onclick = () => {
    if (note.hasAttribute('hidden')) { note.removeAttribute('hidden'); ta.focus(); }
    else if (!rec.note) { note.setAttribute('hidden', 'hidden'); }
    syncNote();
  };
  seg.appendChild(noteBtn);

  ta.oninput = () => { rec.note = ta.value; syncChips(); syncNote(); save(); };
  syncNote();

  const kids = [
    el('div', { class: 'q' }, [el('b', { text: item._n + "." }), el('span', { text: item.text })])
  ];

  /* بند يحمل قيمة رقمية (مثل السعة الجماهيرية) */
  if (item.num) {
    const inp = el('input', { type: 'number', inputmode: 'numeric', placeholder: '0' });
    inp.value = state.nums[item.num.id] || '';
    inp.oninput = () => { state.nums[item.num.id] = inp.value; save(); };
    kids.push(el('div', { class: 'numrow' }, [
      el('label', { text: item.num.label }),
      inp,
      el('span', { class: 'unit', text: item.num.unit })
    ]));
  }

  kids.push(seg, note);
  return el('div', { class: 'item', 'data-key': key }, kids);
}

function buildSections() {
  const main = $('#sections');
  SECTIONS.forEach(sec => {
    const head = el('header', {}, [
      el('div', { class: 'num', text: String(sec._n) }),
      el('h2', { text: sec.title }),
      el('div', { class: 'badge', id: 'sb' + sec.id, text: '' })
    ]);
    const body = el('div', { class: 'body' });
    sec.items.forEach(it => body.appendChild(buildItem(sec, it)));
    main.appendChild(el('section', { class: 'card' }, [head, body]));
  });
}

/* ــــ جدول القياسات ــــ */

function buildMeasurements() {
  const body = $('#measBody');

  /* نموذج بلا قياسات — تُخفى البطاقة كلّها بدل أن تظهر فارغة */
  if (!MEASUREMENTS.length) {
    const card = body.closest('section');
    if (card) card.setAttribute('hidden', 'hidden');
    return;
  }

  MEASUREMENTS.forEach(ms => {
    const rec = state.meas[ms.id] || (state.meas[ms.id] = { v: '', note: '' });

    const warn = el('div', { class: 'warn', hidden: 'hidden' });

    const check = () => {
      const v = parseFloat(rec.v);
      if (rec.v === '' || isNaN(v)) { warn.setAttribute('hidden', 'hidden'); return; }
      const low  = ms.min !== null && ms.min !== undefined && v < ms.min;
      const high = ms.max !== null && ms.max !== undefined && v > ms.max;
      if (low || high) {
        warn.textContent = `القيمة خارج المرجع المعتمد (${ms.ref}).`;
        warn.removeAttribute('hidden');
      } else {
        warn.setAttribute('hidden', 'hidden');
      }
    };

    const inp = el('input', { type: 'number', step: 'any', inputmode: 'decimal', placeholder: '—' });
    inp.value = rec.v;
    inp.oninput = () => { rec.v = inp.value; check(); refreshTally(); save(); };

    const note = el('input', { type: 'text', placeholder: 'ملاحظة' });
    note.value = rec.note;
    note.oninput = () => { rec.note = note.value; save(); };

    check();

    body.appendChild(el('div', { class: 'meas' }, [
      el('div', { class: 'mhead' }, [
        el('span', { class: 'mlabel', text: ms.label }),
        el('span', { class: 'mref', text: ms.ref })
      ]),
      el('div', { class: 'mrow' }, [
        inp,
        el('span', { class: 'unit', text: ms.unit }),
        note
      ]),
      warn
    ]));
  });
}

/* ــــ حالة الاعتماد ــــ

   قاعدة الاقتراح:
   • بندٌ واحد «غير مطابق»، أو قياسٌ خارج مرجعه  ⟵  غير معتمد
   • لا مخالفات، ووجود «يحتاج معالجة»            ⟵  معتمد بشروط
   • جميع البنود مطابقة                          ⟵  معتمد
   والاقتراح قابل للتجاوز يدوياً في كلّ الأحوال. */

const DECISIONS = [
  { id: 'approved',   label: 'معتمد',        cls: 'ok' },
  { id: 'conditional', label: 'معتمد بشروط', cls: 'fix' },
  { id: 'rejected',   label: 'غير معتمد',    cls: 'no' }
];

function outOfRange() {
  return MEASUREMENTS.filter(ms => {
    const rec = state.meas[ms.id];
    if (!rec || rec.v === '') return false;
    const v = parseFloat(rec.v);
    if (isNaN(v)) return false;
    return (ms.min !== null && ms.min !== undefined && v < ms.min) ||
           (ms.max !== null && ms.max !== undefined && v > ms.max);
  }).length;
}

function evaluate() {
  const counts = {};
  STATUSES.forEach(st => counts[st.id] = 0);
  const total = SECTIONS.reduce((a, s) => a + s.items.length, 0);
  let answered = 0;

  Object.values(state.items).forEach(r => {
    if (r.s && counts[r.s] !== undefined) { counts[r.s]++; answered++; }
  });

  const bad = outOfRange();
  let suggestion = '';
  if (counts.no > 0 || bad > 0) suggestion = 'rejected';
  else if (counts.fix > 0) suggestion = 'conditional';
  else if (answered === total) suggestion = 'approved';

  return { counts, total, answered, missing: total - answered, badMeasures: bad, suggestion };
}

/* ــــ بطاقة التقييم ــــ */

function buildSummary() {
  const body = $('#summaryBody');
  const m = state.meta;

  const stats = el('div', { class: 'stats', id: 'stats' });

  const missBox = el('div', { class: 'missing', id: 'missing', hidden: 'hidden' });
  const missText = el('span', { id: 'missText' });
  const missBtn = el('button', { type: 'button', class: 'link', text: 'انتقل إلى أوّل بند ناقص' });
  missBtn.onclick = () => {
    for (const sec of SECTIONS) {
      for (const it of sec.items) {
        if (!(state.items[it.id] || {}).s) {
          const node = document.querySelector(`[data-key=""]`);
          if (node) {
            /* حساب يدوي للموضع: أدقّ من scrollIntoView مع الشريط العلوي الثابت */
            const y = node.getBoundingClientRect().top + window.scrollY - 130;
            window.scrollTo(0, Math.max(0, y));
            node.classList.add('flash');
            setTimeout(() => node.classList.remove('flash'), 1400);
          }
          return;
        }
      }
    }
  };
  missBox.appendChild(missText);
  missBox.appendChild(missBtn);

  const hint = el('div', { class: 'hint suggest', id: 'suggestHint' });

  const pick = el('div', { class: 'decide', id: 'decide' });
  DECISIONS.forEach(d => {
    const b = el('button', { type: 'button', 'data-d': d.id, 'data-c': d.cls, text: d.label });
    b.onclick = () => {
      m.decision = m.decision === d.id ? '' : d.id;
      refreshTally();
      save();
    };
    pick.appendChild(b);
  });

  const reset = el('button', { type: 'button', class: 'link', id: 'resetDecision', text: 'عُد إلى الاقتراح الآلي', hidden: 'hidden' });
  reset.onclick = () => { m.decision = ''; refreshTally(); save(); };

  const recheckWrap = el('div', { class: 'field', id: 'recheckWrap', hidden: 'hidden' }, [
    el('label', { text: 'موعد إعادة الفحص', for: 'f_recheck' })
  ]);
  const recheck = el('input', { id: 'f_recheck', type: 'date', value: m.recheck });
  recheck.oninput = () => { m.recheck = recheck.value; save(); };
  recheckWrap.appendChild(recheck);

  const gen = el('textarea', { id: 'f_general', placeholder: 'ملاحظات عامة على الملعب', rows: '4' });
  gen.value = m.general;
  gen.oninput = () => { m.general = gen.value; save(); };
  const genWrap = el('div', { class: 'field wide' }, [
    el('label', { text: 'ملاحظات عامة', for: 'f_general' }), gen
  ]);

  body.appendChild(stats);
  body.appendChild(missBox);
  body.appendChild(el('div', { class: 'sep' }));
  body.appendChild(hint);
  body.appendChild(pick);
  body.appendChild(reset);
  body.appendChild(recheckWrap);
  body.appendChild(genWrap);
}

function refreshSummary(ev) {
  const m = state.meta;

  $('#stats').innerHTML = STATUSES.map(st =>
    `<div class="stat s-${st.id}"><b>${ev.counts[st.id]}</b><span>${st.label}</span></div>`
  ).join('') + `<div class="stat s-miss"><b>${ev.missing}</b><span>لم يُعبّأ</span></div>`;

  const miss = $('#missing');
  if (ev.missing > 0) {
    $('#missText').textContent =
      `${bandCount(ev.missing)} ${agree(ev.missing, 'لم يُعبَّأ', 'لم يُعبَّآ', 'لم تُعبَّأ')} بعد.`;
    miss.removeAttribute('hidden');
  } else {
    miss.setAttribute('hidden', 'hidden');
  }

  const effective = m.decision || ev.suggestion;
  const sugLabel = (DECISIONS.find(d => d.id === ev.suggestion) || {}).label;

  let hintText;
  if (!ev.suggestion) hintText = 'أكمل البنود ليُقترح تقييمٌ للاعتماد.';
  else if (m.decision && m.decision !== ev.suggestion) hintText = `اخترتَ تقييماً يخالف الاقتراح الآلي (${sugLabel}).`;
  else {
    const why = ev.badMeasures > 0 && ev.counts.no === 0
      ? 'لوجود قياس خارج مرجعه المعتمد'
      : ev.counts.no > 0 ? `لوجود ${bandCount(ev.counts.no)} ${agree(ev.counts.no, 'غير مطابق', 'غير مطابقَين', 'غير مطابقة')}`
      : ev.counts.fix > 0 ? `لوجود ${bandCount(ev.counts.fix)} ${agree(ev.counts.fix, 'يحتاج', 'يحتاجان', 'تحتاج')} معالجة`
      : 'لمطابقة جميع البنود';
    hintText = `الاقتراح الآلي: ${sugLabel} — ${why}.`;
  }
  $('#suggestHint').textContent = hintText;

  $('#decide').querySelectorAll('button').forEach(b => {
    b.setAttribute('aria-pressed', b.dataset.d === effective ? 'true' : 'false');
    b.classList.toggle('auto', !m.decision && b.dataset.d === effective);
  });

  const reset = $('#resetDecision');
  if (m.decision) reset.removeAttribute('hidden'); else reset.setAttribute('hidden', 'hidden');

  const rw = $('#recheckWrap');
  if (effective === 'conditional' || effective === 'rejected') rw.removeAttribute('hidden');
  else rw.setAttribute('hidden', 'hidden');
}

/* ــــ التقييم العام ــــ */

function refreshTally() {
  const ev = evaluate();
  const counts = ev.counts, total = ev.total, answered = ev.answered;

  /* عدّاد لكلّ محور — يكشف المحور الناقص بنظرة */
  SECTIONS.forEach(sec => {
    const done = sec.items.filter(it => (state.items[it.id] || {}).s).length;
    const badge = $('#sb' + sec.id);
    if (!badge) return;
    badge.textContent = `${done} / ${sec.items.length}`;
    badge.className = 'badge' + (done === sec.items.length ? ' done' : '');
  });

  $('#tally').innerHTML = STATUSES
    .map(st => `<span>${st.label} <b>${counts[st.id]}</b></span>`).join('');
  $('#bar').style.width = Math.round(answered / total * 100) + '%';
  $('#count').textContent = `${answered} من ${total} بنداً`;

  refreshSummary(ev);
}

/* ــــ الإقلاع ــــ */

$('#appTitle').textContent = FORM_META.shortTitle || FORM_META.title;
document.title = (FORM_META.shortTitle || FORM_META.title) + ' — ' + FORM_META.org;

buildMeta();
buildSections();
buildMeasurements();
buildSummary();
refreshTally();
save();

/* بطاقة تشخيص: أيّ ملفّات يشغّلها الجهاز، ومن أين يقرأ النموذج.
   سطرٌ واحد يغني عن تخمين سبب اختلاف جهاز عن جهاز. */
const BUILD = 17;

const buildInfo = $('#buildInfo');
if (buildInfo) {
  buildInfo.innerHTML =
    `نسخة التطبيق: <b>${BUILD}</b> · النموذج: <b>الرسمي ${FORM_VERSION}</b> · ` +
    `<b>${SECTIONS.reduce((a, s) => a + s.items.length, 0)}</b> بنداً`;
}

