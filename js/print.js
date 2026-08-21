/* توليد المطبوعة الرسمية من حالة التقرير.
   تُبنى عند الطباعة أو عند فتح المعاينة، لا قبل ذلك. */

(function () {

  const P = (tag, attrs, kids) => {
    const n = document.createElement(tag);
    for (const k in (attrs || {})) {
      if (k === 'text') n.textContent = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(c => c && n.appendChild(c));
    return n;
  };

  const dash = v => (v === '' || v === null || v === undefined) ? '—' : v;

  function fmtDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function fmtTime(t) {
    if (!t) return '—';
    const [h, m] = t.split(':').map(Number);
    const period = h < 12 ? 'صباحاً' : 'مساءً';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(m).padStart(2, '0')} ${period}`;
  }

  /* جدول بيانات الزيارة */
  function metaTable() {
    const m = state.meta;
    const value = f => {
      if (f.id === 'date') return fmtDate(m.date);
      if (f.id === 'time') return fmtTime(m.time);
      if (f.id in m) return dash(m[f.id]);
      if (f.type === 'date') return fmtDate((m.extra || {})[f.id]);
      return dash((m.extra || {})[f.id]);
    };
    const cells = FIELDS.filter(f => f.enabled !== false).map(f => [f.label, value(f)]);
    const tb = P('tbody');
    for (let i = 0; i < cells.length; i += 3) {
      const row = P('tr');
      cells.slice(i, i + 3).forEach(([k, v]) => {
        row.appendChild(P('th', { text: k, class: 'k' }));
        row.appendChild(P('td', { text: v }));
      });
      tb.appendChild(row);
    }
    return P('table', { class: 'p-meta' }, [tb]);
  }

  /* جدول محور فحص */
  function sectionTable(sec) {
    const head = P('tr', {}, [
      P('th', { text: 'م', class: 'c-n' }),
      P('th', { text: 'بند الفحص', class: 'c-q' }),
      P('th', { text: 'مطابق', class: 'c-s' }),
      P('th', { text: 'يحتاج معالجة', class: 'c-s' }),
      P('th', { text: 'غير مطابق', class: 'c-s' }),
      P('th', { text: 'الملاحظات / الإجراء المطلوب', class: 'c-note' })
    ]);

    const tb = P('tbody');
    sec.items.forEach(it => {
      const rec = state.items[it.id] || { s: '', note: '' };
      let q = it.text;
      if (it.num) {
        const v = state.nums[it.num.id];
        q += `  (${it.num.label}: ${dash(v)} ${it.num.unit})`;
      }
      tb.appendChild(P('tr', {}, [
        P('td', { text: String(it._n), class: 'c-n' }),
        P('td', { text: q, class: 'c-q' }),
        P('td', { text: rec.s === 'ok' ? '✓' : '', class: 'c-s mark' }),
        P('td', { text: rec.s === 'fix' ? '✓' : '', class: 'c-s mark' }),
        P('td', { text: rec.s === 'no' ? '✓' : '', class: 'c-s mark' }),
        P('td', { text: noteText(rec), class: 'c-note' })
      ]));
    });

    return P('section', { class: 'p-block' }, [
      P('h3', { text: sec._n + '. ' + sec.title }),
      P('table', { class: 'p-items' }, [P('thead', {}, [head]), tb])
    ]);
  }

  /* جدول القياسات */
  function measTable() {
    const tb = P('tbody');
    MEASUREMENTS.forEach(ms => {
      const rec = state.meas[ms.id] || { v: '', note: '' };
      tb.appendChild(P('tr', {}, [
        P('td', { text: ms.label, class: 'c-q' }),
        P('td', { text: rec.v === '' ? '—' : `${rec.v} ${ms.unit}`, class: 'c-v' }),
        P('td', { text: ms.ref, class: 'c-v' }),
        P('td', { text: rec.note || '', class: 'c-note' })
      ]));
    });
    return P('section', { class: 'p-block' }, [
      P('h3', { text: 'القياسات والقراءات الأساسية' }),
      P('table', { class: 'p-items' }, [
        P('thead', {}, [P('tr', {}, [
          P('th', { text: 'القياس', class: 'c-q' }),
          P('th', { text: 'القيمة الفعلية', class: 'c-v' }),
          P('th', { text: 'المتطلب / المرجع', class: 'c-v' }),
          P('th', { text: 'ملاحظات', class: 'c-note' })
        ])]),
        tb
      ])
    ]);
  }

  /* التقييم العام وحالة الاعتماد */
  function summaryBlock() {
    const ev = evaluate();
    const m = state.meta;
    const decision = m.decision || ev.suggestion;
    const label = (DECISIONS.find(d => d.id === decision) || {}).label || '—';

    const counts = P('table', { class: 'p-items' }, [
      P('thead', {}, [P('tr', {}, STATUSES.map(st => P('th', { text: st.label }))
        .concat([P('th', { text: 'لم يُعبَّأ' })]))]),
      P('tbody', {}, [P('tr', {}, STATUSES.map(st => P('td', { text: String(ev.counts[st.id]), class: 'mark' }))
        .concat([P('td', { text: String(ev.missing), class: 'mark' })]))])
    ]);

    const showRecheck = decision === 'conditional' || decision === 'rejected';

    const decideRow = P('table', { class: 'p-meta' }, [P('tbody', {}, [
      P('tr', {}, [
        P('th', { text: 'حالة الاعتماد', class: 'k' }),
        P('td', { text: label, class: 'strong' }),
        showRecheck ? P('th', { text: 'موعد إعادة الفحص', class: 'k' }) : null,
        showRecheck ? P('td', { text: fmtDate(m.recheck) }) : null
      ])
    ])]);

    return P('section', { class: 'p-block' }, [
      P('h3', { text: 'التقييم العام وحالة الاعتماد' }),
      counts,
      decideRow,
      P('div', { class: 'p-general' }, [
        P('div', { class: 'lbl', text: 'ملاحظات عامة' }),
        P('div', { class: 'box', text: m.general || '' })
      ])
    ]);
  }

  function signatures() {
    const m = state.meta;
    const cell = (role, name) => P('div', { class: 'sig' }, [
      P('div', { class: 'role', text: role }),
      P('div', { class: 'name', text: name || '' }),
      P('div', { class: 'line' }),
      P('div', { class: 'cap', text: 'التوقيع' })
    ]);
    return P('section', { class: 'p-sign' }, [
      cell('الفاحص / مراقب المباريات', m.inspector),
      cell('ممثل النادي', '')
    ]);
  }

  function build() {
    const root = document.getElementById('printView');
    root.textContent = '';

    const crest = P('img', { class: 'crest', src: 'assets/kfa-logo.png', alt: FORM_META.org });
    root.appendChild(P('header', { class: 'p-head' }, [
      crest,
      P('div', { class: 'org', text: FORM_META.org }),
      P('h1', { text: FORM_META.title }),
      P('div', { class: 'rule' }, [
        P('span', { class: 'b' }), P('span', { class: 'g' }), P('span', { class: 'r' })
      ])
    ]));

    root.appendChild(metaTable());
    SECTIONS.forEach(sec => root.appendChild(sectionTable(sec)));
    if (MEASUREMENTS.length) root.appendChild(measTable());
    root.appendChild(summaryBlock());
    root.appendChild(signatures());
  }

  /* ــــ الأزرار ــــ */

  document.getElementById('btnPrint').onclick = () => { build(); window.print(); };

  const btnPreview = document.getElementById('btnPreview');
  btnPreview.onclick = () => {
    const on = document.body.classList.toggle('preview');
    if (on) { build(); window.scrollTo(0, 0); }
    btnPreview.textContent = on ? 'عودة إلى التعبئة' : 'معاينة المطبوعة';
  };

  window.buildPrintView = build;
})();
