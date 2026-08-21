/* طبقة النموذج: تجمع بين النسخة الأصلية في data.js وتعديلات المستخدم المحفوظة.
   كلّ ما بعدها في التطبيق يقرأ من هنا، لا من data.js مباشرة. */

const KEY_FORM = 'sc.form';

/* معرّف ثابت لكلّ بند ومحور — لا يتغيّر بالحذف ولا بإعادة الترتيب،
   فتبقى إجابات التقارير القديمة مرتبطة ببندها الصحيح. */
function newFormId(prefix) {
  return prefix + '-' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
}

function defaultForm() {
  return {
    v: FORM_VERSION,
    meta: JSON.parse(JSON.stringify(DEFAULT_META)),
    fields: JSON.parse(JSON.stringify(DEFAULT_FIELDS)),
    sections: DEFAULT_SECTIONS.map((sec, si) => ({
      id: 's-' + (si + 1),
      title: sec.title,
      items: sec.items.map((it, ii) => {
        const copy = {
          id: 'i-' + (si + 1) + '-' + (ii + 1),
          text: it.text,
          phrases: (it.phrases || []).slice(),
          phrasesOk: (it.phrasesOk || []).slice()
        };
        if (it.num) copy.num = JSON.parse(JSON.stringify(it.num));
        return copy;
      })
    })),
    measurements: JSON.parse(JSON.stringify(DEFAULT_MEASUREMENTS)),
    clubs: JSON.parse(JSON.stringify(DEFAULT_CLUBS)),
    venues: DEFAULT_VENUES.slice()
  };
}

/* ترقيم العرض يُشتقّ من الترتيب لا من المعرّف — فالحذف والإضافة لا يتركان فجوات. */
function annotateForm(form) {
  form.sections.forEach((sec, si) => {
    sec._n = si + 1;
    sec.items.forEach((it, ii) => { it._n = ii + 1; });
  });
  return form;
}

function stripRuntime(form) {
  const copy = JSON.parse(JSON.stringify(form));
  copy.sections.forEach(sec => {
    delete sec._n;
    sec.items.forEach(it => delete it._n);
  });
  return copy;
}

/* التحقّق من سلامة نموذج محفوظ قبل اعتماده — نموذج معطوب يعطّل التطبيق كلّه. */
function validForm(f) {
  return !!(f && f.meta && Array.isArray(f.sections) && f.sections.length &&
    f.sections.every(s => s.id && typeof s.title === 'string' && Array.isArray(s.items)) &&
    Array.isArray(f.measurements) && Array.isArray(f.clubs));
}

/* بعد إخراج صفحة «تعديل النموذج»، صار النموذج الرسمي هو المرجع الوحيد.
   وأيّ نسخة محفوظة قديمة تُمحى من الجهاز، وإلّا بقيت تحجب التحديثات عنه. */
function loadForm() {
  try {
    if (localStorage.getItem(KEY_FORM)) localStorage.removeItem(KEY_FORM);
  } catch (e) { /* لا يضرّ */ }
  return annotateForm(defaultForm());
}

/* محفوظة للرجوع إليها إن أُعيدت صفحة التعديل يوماً */
function loadSavedForm() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY_FORM)); } catch (e) { saved = null; }
  if (!validForm(saved)) return annotateForm(defaultForm());

  /* ترقيع الحقول الناقصة كي لا يسقط التطبيق مع نموذج قديم */
  if (!Array.isArray(saved.venues)) saved.venues = saved.clubs.map(c => c.stadium);
  if (!Array.isArray(saved.fields) || !saved.fields.length) {
    saved.fields = JSON.parse(JSON.stringify(DEFAULT_FIELDS));
  } else {
    /* أيّ حقل أصلي مفقود يُعاد، فبعضه يحمل سلوكاً لا يُستغنى عنه */
    DEFAULT_FIELDS.forEach(def => {
      if (!saved.fields.some(f => f.id === def.id)) saved.fields.push(JSON.parse(JSON.stringify(def)));
    });
  }
  /* نموذج محفوظ بنسخة أقدم قد ينقصه حقل استُحدث بعده.
     يُستكمل من النموذج الأصلي بمطابقة المعرّف، لا بقائمة فارغة —
     وإلّا اختفت عبارات «مطابق» من نموذج المستخدم بلا سبب ظاهر. */
  const base = defaultForm();
  const baseItem = id => {
    for (const s of base.sections) {
      const hit = s.items.find(x => x.id === id);
      if (hit) return hit;
    }
    return null;
  };

  saved.sections.forEach(sec => sec.items.forEach(it => {
    if (!it.id) it.id = newFormId('i');
    const orig = baseItem(it.id);
    if (!Array.isArray(it.phrases))   it.phrases   = orig ? orig.phrases.slice()   : [];
    if (!Array.isArray(it.phrasesOk)) it.phrasesOk = orig ? orig.phrasesOk.slice() : [];
  }));

  /* النسخة المحفوظة تُجمّد النموذج على لحظة حفظها؛ فإن تغيّر الرسمي بعدها
     لا يصل التعديل إلى الجهاز. هنا نرفع العلم ليُعرض على المستخدم. */
  if (saved.v !== FORM_VERSION) FORM_OUTDATED = true;

  return annotateForm(saved);
}

function saveForm(form) {
  try {
    localStorage.setItem(KEY_FORM, JSON.stringify(stripRuntime(form)));
    return true;
  } catch (e) { return false; }
}

function resetForm() {
  try { localStorage.removeItem(KEY_FORM); } catch (e) { /* لا شيء */ }
}

function isFormCustomized() {
  try { return !!localStorage.getItem(KEY_FORM); } catch (e) { return false; }
}

/* هل النسخة المحفوظة أقدم من الرسمية؟ يُقرأ في الواجهة لعرض إشعار التحديث. */
var FORM_OUTDATED = false;

/* النموذج الفعّال + الأسماء التي يستعملها بقيّة التطبيق */
var FORM = loadForm();
var FORM_META = FORM.meta;
var FIELDS = FORM.fields;
var SECTIONS = FORM.sections;
var MEASUREMENTS = FORM.measurements;
var CLUBS = FORM.clubs;
var VENUES = FORM.venues;
