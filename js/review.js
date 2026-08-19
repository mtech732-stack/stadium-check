/* صفحة المراجعة: ملاحظة لكلّ بند، حفظ تلقائي، وتصدير نصّ جاهز للإرسال. */

const KEY_REVIEW = 'sc.review';

const R = {
  read() {
    try { return JSON.parse(localStorage.getItem(KEY_REVIEW)) || null; }
    catch (e) { return null; }
  },
  write(v) {
    try { localStorage.setItem(KEY_REVIEW, JSON.stringify(v)); return true; }
    catch (e) { return false; }
  }
};

/* الجوانب غير البنديّة */
const ASPECTS = [
  { id: 'phrases', label: 'العبارات الجاهزة', hint: 'هل صياغتها تشبه ما تكتبه فعلاً؟ ما ينقصها؟' },
  { id: 'meas',    label: 'جدول القياسات',    hint: 'القيم المرجعية · ما يلزم إضافته' },
  { id: 'eval',    label: 'التقييم وحالة الاعتماد', hint: 'هل قاعدة الاقتراح الآلي صحيحة؟' },
  { id: 'print',   label: 'المطبوعة',          hint: 'الشكل · الترويسة · تقسيم الصفحات · التوقيعات' },
  { id: 'archive', label: 'الأرشيف والحفظ',    hint: 'التقارير السابقة · النسخة الاحتياطية' },
  { id: 'clubs',   label: 'الأندية والملاعب',  hint: 'صحّح أسماء الملاعب غير الدقيقة' },
  { id: 'other',   label: 'ملاحظات عامّة',     hint: 'أيّ شيء آخر' }
];

const state = R.read() || { reviewer: '', notes: {}, aspects: {} };
if (!state.notes) state.notes = {};
if (!state.aspects) state.aspects = {};

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
function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const ok = R.write(state);
    const now = new Date();
    $('#rvSaved').innerHTML = ok
      ? `<b style="color:var(--ok)">حُفظ</b> · ${pad(now.getHours())}:${pad(now.getMinutes())}`
      : 'تعذّر الحفظ في هذا المتصفّح';
    refreshCount();
  }, 300);
}

function refreshCount() {
  const n = Object.values(state.notes).filter(v => v && v.trim()).length
          + Object.values(state.aspects).filter(v => v && v.trim()).length;
  $('#rvCount').textContent = n === 0 ? 'لم تُكتب ملاحظات بعد'
    : n === 1 ? 'ملاحظة واحدة' : n === 2 ? 'ملاحظتان' : `${n} ملاحظات`;
}

function noteBox(getter, setter, placeholder) {
  const ta = el('textarea', { placeholder: placeholder, rows: '2' });
  ta.value = getter() || '';
  if (ta.value.trim()) ta.classList.add('filled');
  ta.oninput = () => {
    setter(ta.value);
    ta.classList.toggle('filled', !!ta.value.trim());
    save();
  };
  return el('div', { class: 'rv-note' }, [ta]);
}

function build() {
  const name = $('#rvName');
  name.value = state.reviewer;
  name.oninput = () => { state.reviewer = name.value; save(); };

  const root = $('#rvSections');
  SECTIONS.forEach(sec => {
    const body = el('div', { class: 'body' });
    sec.items.forEach(it => {
      const key = `${sec.id}.${it.n}`;
      body.appendChild(el('div', { class: 'item' }, [
        el('div', { class: 'q' }, [
          el('b', { text: `${sec.id}/${it.n}` }),
          el('span', { text: it.text })
        ]),
        noteBox(() => state.notes[key], v => state.notes[key] = v, 'ملاحظتك على هذا البند')
      ]));
    });

    root.appendChild(el('section', { class: 'card' }, [
      el('header', {}, [
        el('div', { class: 'num', text: String(sec.id) }),
        el('h2', { text: sec.title })
      ]),
      body
    ]));
  });

  const gen = $('#rvGeneral');
  ASPECTS.forEach(a => {
    gen.appendChild(el('div', { class: 'item' }, [
      el('div', { class: 'q' }, [el('span', { text: a.label })]),
      el('div', { class: 'hint', text: a.hint }),
      noteBox(() => state.aspects[a.id], v => state.aspects[a.id] = v, 'ملاحظتك')
    ]));
  });
}

/* ــــ تصدير النصّ ــــ */

function buildText() {
  const now = new Date();
  const lines = [];
  lines.push('ملاحظات على نموذج فحص الملاعب');
  if (state.reviewer.trim()) lines.push(`المراجع: ${state.reviewer.trim()}`);
  lines.push(`التاريخ: ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`);
  lines.push('');

  SECTIONS.forEach(sec => {
    const wrote = sec.items.filter(it => (state.notes[`${sec.id}.${it.n}`] || '').trim());
    if (!wrote.length) return;
    lines.push(`— المحور ${sec.id}: ${sec.title}`);
    wrote.forEach(it => {
      const key = `${sec.id}.${it.n}`;
      lines.push(`[${sec.id}/${it.n}] ${it.text}`);
      lines.push(`    ← ${state.notes[key].trim().replace(/\n+/g, ' ')}`);
    });
    lines.push('');
  });

  const asp = ASPECTS.filter(a => (state.aspects[a.id] || '').trim());
  if (asp.length) {
    lines.push('— جوانب عامّة');
    asp.forEach(a => {
      lines.push(`[${a.label}]`);
      lines.push(`    ← ${state.aspects[a.id].trim().replace(/\n+/g, ' ')}`);
    });
    lines.push('');
  }

  if (lines.length <= 4) lines.push('(لا ملاحظات)');
  return lines.join('\n');
}

function showText(text) {
  const out = $('#rvOut');
  out.textContent = '';
  const ta = el('textarea', { readonly: 'readonly' });
  ta.value = text;
  out.appendChild(ta);
  out.removeAttribute('hidden');
  ta.focus();
  ta.setSelectionRange(0, ta.value.length);
  out.scrollIntoView({ block: 'start' });
}

$('#rvShow').onclick = () => showText(buildText());

$('#rvCopy').onclick = async () => {
  const text = buildText();
  const btn = $('#rvCopy');
  try {
    await navigator.clipboard.writeText(text);
    const old = btn.textContent;
    btn.textContent = 'نُسخت ✓';
    setTimeout(() => { btn.textContent = old; }, 1800);
  } catch (e) {
    /* المتصفّح منع النسخ التلقائي — نعرض النصّ محدَّداً لينسخه بنفسه */
    showText(text);
    $('#rvSaved').textContent = 'انسخ النصّ الظاهر يدوياً';
  }
};

build();
refreshCount();
