/* الأرشيف: التقارير المحفوظة، فتح تقرير، تقرير جديد، حذف، نسخة احتياطية. */

(function () {

  const panel = document.getElementById('archive');
  const listEl = document.getElementById('archList');

  function fmtDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function progressOf(r) {
    const total = SECTIONS.reduce((a, s) => a + s.items.length, 0);
    const done = Object.values(r.items || {}).filter(x => x.s).length;
    return { done, total };
  }

  function decisionOf(r) {
    const counts = { ok: 0, fix: 0, no: 0 };
    Object.values(r.items || {}).forEach(x => { if (counts[x.s] !== undefined) counts[x.s]++; });
    const bad = MEASUREMENTS.some(ms => {
      const rec = (r.meas || {})[ms.id];
      if (!rec || rec.v === '') return false;
      const v = parseFloat(rec.v);
      if (isNaN(v)) return false;
      return (ms.min != null && v < ms.min) || (ms.max != null && v > ms.max);
    });
    const p = progressOf(r);
    let id = r.meta.decision;
    if (!id) {
      if (counts.no > 0 || bad) id = 'rejected';
      else if (counts.fix > 0) id = 'conditional';
      else if (p.done === p.total) id = 'approved';
    }
    return DECISIONS.find(d => d.id === id) || null;
  }

  function open(id) {
    if (id === currentId) { close(); return; }
    store.write(KEY_CURRENT, id);
    location.reload();
  }

  function remove(id) {
    const r = reports[id];
    const name = r.meta.club || 'تقرير بلا نادٍ';
    if (!confirm(`حذف تقرير «${name}» نهائياً؟ لا يمكن التراجع.`)) return;
    delete reports[id];
    store.write(KEY_REPORTS, reports);
    if (id === currentId) {
      const rest = Object.keys(reports);
      store.write(KEY_CURRENT, rest.length ? rest[0] : '');
      location.reload();
      return;
    }
    render();
  }

  function createNew() {
    const id = newId();
    reports[id] = blankReport(id);
    store.write(KEY_REPORTS, reports);
    store.write(KEY_CURRENT, id);
    location.reload();
  }

  function render() {
    listEl.textContent = '';

    const ids = Object.keys(reports).sort((a, b) => (reports[b].savedAt || 0) - (reports[a].savedAt || 0));

    if (!ids.length) {
      listEl.appendChild(el('p', { class: 'empty', text: 'لا توجد تقارير محفوظة بعد.' }));
      return;
    }

    ids.forEach(id => {
      const r = reports[id];
      const p = progressOf(r);
      const d = decisionOf(r);

      const head = el('div', { class: 'arow-head' }, [
        el('strong', { text: r.meta.club || 'تقرير بلا نادٍ' }),
        id === currentId ? el('span', { class: 'now', text: 'مفتوح الآن' }) : null
      ].filter(Boolean));

      const meta = el('div', { class: 'arow-meta', text:
        `${fmtDate(r.meta.date)} · ${r.meta.stadium || '—'} · ${p.done} من ${p.total} بنداً` });

      const tags = el('div', { class: 'arow-tags' }, [
        d ? el('span', { class: 'tag t-' + d.cls, text: d.label }) : el('span', { class: 'tag', text: 'قيد التعبئة' })
      ]);

      const btnOpen = el('button', { type: 'button', class: 'small', text: id === currentId ? 'إغلاق الأرشيف' : 'افتح' });
      btnOpen.onclick = () => open(id);

      const btnDel = el('button', { type: 'button', class: 'small danger', text: 'حذف' });
      btnDel.onclick = () => remove(id);

      listEl.appendChild(el('div', { class: 'arow' }, [
        el('div', { class: 'arow-main' }, [head, meta, tags]),
        el('div', { class: 'arow-actions' }, [btnOpen, btnDel])
      ]));
    });
  }

  /* ــــ النسخة الاحتياطية ــــ */

  function exportAll() {
    const blob = new Blob([JSON.stringify({ v: 1, reports: reports }, null, 2)],
      { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const a = el('a', {
      href: url,
      download: `نسخة-تقارير-الملاعب-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); }
      catch (e) { alert('الملفّ غير صالح — تعذّرت قراءته.'); return; }

      const incoming = data && data.reports;
      if (!incoming || typeof incoming !== 'object') { alert('الملفّ لا يحتوي تقارير.'); return; }

      let added = 0;
      Object.keys(incoming).forEach(id => {
        const key = reports[id] ? newId() : id;
        reports[key] = normalize(incoming[id], key);
        added++;
      });
      store.write(KEY_REPORTS, reports);
      alert(`استُوردت ${added} من التقارير.`);
      render();
    };
    reader.readAsText(file);
  }

  /* ــــ الفتح والإغلاق ــــ */

  function show() { render(); panel.removeAttribute('hidden'); document.body.classList.add('locked'); }
  function close() { panel.setAttribute('hidden', 'hidden'); document.body.classList.remove('locked'); }

  document.getElementById('btnArchive').onclick = show;
  document.getElementById('archClose').onclick = close;
  document.getElementById('archNew').onclick = createNew;
  document.getElementById('archExport').onclick = exportAll;

  const fileInput = document.getElementById('archFile');
  document.getElementById('archImport').onclick = () => fileInput.click();
  fileInput.onchange = () => { if (fileInput.files[0]) importFile(fileInput.files[0]); fileInput.value = ''; };

  panel.onclick = ev => { if (ev.target === panel) close(); };
})();
