// Desire Archetype — i18n runtime (Phase D)
// Loads locale JSON on boot, exposes window.i18n, and triggers window.rerenderCurrent on language switch.

(function () {
  const DEFAULT_LANG = 'zh-TW';
  const SUPPORTED = ['zh-TW', 'ja', 'en'];
  let dict = null;
  let currentLang = DEFAULT_LANG;

  function detectLang() {
    try {
      const stored = localStorage.getItem('desireLang');
      if (SUPPORTED.includes(stored)) return stored;
    } catch (e) {}
    const url = new URLSearchParams(location.search).get('lang');
    if (SUPPORTED.includes(url)) return url;
    const nav = (navigator.language || '').toLowerCase();
    if (nav.startsWith('ja')) return 'ja';
    if (nav.startsWith('en')) return 'en';
    if (nav.startsWith('zh')) return 'zh-TW';
    return DEFAULT_LANG;
  }

  function t(path, vars) {
    if (!dict) return path;
    const parts = path.split('.');
    let v = dict;
    for (const p of parts) {
      v = v && v[p];
      if (v == null) return path;
    }
    if (vars && typeof v === 'string') {
      return v.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
    }
    return v;
  }

  function renderBreaks(s) {
    if (typeof s !== 'string') return '';
    const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const em = esc.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Use <br><br> instead of nested <p> so markup works inside existing <p> containers.
    return em.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
  }

  function applyStaticBindings() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const v = t(el.dataset.i18n);
      if (typeof v === 'string') el.textContent = v;
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const v = t(el.dataset.i18nHtml);
      if (typeof v === 'string') el.innerHTML = renderBreaks(v);
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
      el.dataset.i18nAttr.split(';').forEach(pair => {
        const [attr, key] = pair.split(':');
        const v = t(key.trim());
        if (typeof v === 'string') el.setAttribute(attr.trim(), v);
      });
    });
    const title = t('ui.meta.title');
    if (title && typeof title === 'string' && title !== 'ui.meta.title') document.title = title;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      const v = t('ui.meta.description');
      if (typeof v === 'string' && v !== 'ui.meta.description') desc.setAttribute('content', v);
    }
    // Highlight active language button
    document.querySelectorAll('#lang-switcher button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
  }

  async function loadLang(code) {
    const res = await fetch(`locales/${code}.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error('locale fetch failed: ' + code);
    dict = await res.json();
    currentLang = code;
    document.documentElement.lang = code;
    applyStaticBindings();
  }

  function setLang(code) {
    if (!SUPPORTED.includes(code)) return;
    try { localStorage.setItem('desireLang', code); } catch (e) {}
    loadLang(code).then(() => {
      if (typeof window.rerenderCurrent === 'function') window.rerenderCurrent();
    }).catch(err => {
      console.error('[i18n] setLang failed:', err);
    });
  }

  function getLang() { return currentLang; }
  function getDict() { return dict; }

  // Boot: detect lang, fetch JSON, apply bindings, then signal ready.
  currentLang = detectLang();
  window.i18n = { t, setLang, getLang, getDict, applyStaticBindings };

  loadLang(currentLang)
    .then(() => {
      window.dispatchEvent(new CustomEvent('i18n:ready', { detail: { lang: currentLang } }));
    })
    .catch(err => {
      console.error('[i18n] initial load failed:', err);
      // Signal ready anyway so the quiz boots with its hardcoded fallback.
      window.dispatchEvent(new CustomEvent('i18n:ready', { detail: { lang: null, error: String(err) } }));
    });

  // Wire the language switcher once the DOM is ready.
  function wireSwitcher() {
    const sw = document.getElementById('lang-switcher');
    if (!sw) return;
    sw.addEventListener('click', e => {
      const code = e.target && e.target.dataset && e.target.dataset.lang;
      if (code) setLang(code);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireSwitcher);
  } else {
    wireSwitcher();
  }
})();
