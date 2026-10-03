# Desire Archetypes — i18n Architecture (Phase C)

Baseline string table + runtime design for making
`/Users/gentlenight/website-deploy/desire/index.html` trilingual
(**zh-TW** / **ja** / **en**).

- **Phase C (this doc):** extract strings to `locales/zh-TW.json`, specify runtime, hand off translation brief.
- **Phase D (next session):** apply the surgical refactor spelled out below to `index.html`, add `ja.json` + `en.json`, add the language toggle, add Google Fonts.

Nothing in `index.html` was modified in Phase C.

---

## 1. What's in `zh-TW.json`

Top-level keys:

| Key | Shape | Translate? |
|---|---|---|
| `_meta` | locale metadata | no |
| `ui` | all HTML + JS-rendered chrome strings | **yes** |
| `axisInfo` | 9 letters × `{en, label, description}` | `label` + `description` only (`en` stays) |
| `questions` | 36 × `{id, chapter, text, options:[{key,text,scores}]}` | `text` and each `option.text` only — **never touch `scores`, `key`, `chapter`, `id`** |
| `types` | 24 keys (`A-G-N` … `R-S-X`) × 8 fields | **yes** (all fields) |
| `compat` | type-code → type-code map | **no** (used by runtime to pair types) |

The scoring vectors (`options[].scores`) and the compat mapping live in the locale file alongside the prose. That is deliberate: it means one `fetch(locales/<lang>.json)` is enough — the runtime does not need to cross-reference `index.html` for scoring data.

### Field-name map (index.html → JSON)

Questions (`QUESTIONS` array, line 642–899 of index.html):

| JS | JSON | Notes |
|---|---|---|
| `q.text` | `question.text` | translate |
| `q.opts[i].t` | `question.options[i].text` | translate; **preserve display order** (see §6) |
| `q.opts[i].s` | `question.options[i].scores` | never translate / never reorder keys |
| `q.chapter` | `question.chapter` | integer 1/2/3 |
| (new) | `question.id` | `Q01` … `Q36` for translator reference |
| (new) | `question.options[i].key` | `A`/`B`/`C`/`D`, author order |

Types (`TYPES` object, line 900–1142):

| JS | JSON | Notes |
|---|---|---|
| `name` | `name` | 2–3 char archetype name — see translation brief §9 |
| `tagline` | `tagline` | single-line poetic subtitle |
| `desc` | `description` | main body, uses `\n` + `\n\n` |
| `shadow` | `shadow` | shadow-side body |
| `subDesc` | `subDescription` | sub-type variant body |
| `compat` | `compatCode` | type code string, **don't translate** |
| `compatName` | `compatName` | mirror of the paired type's `name`; keep consistent |
| `compatText` | `compatText` | compatibility body |

Axis info (`AXIS_INFO`, line 1170–1180):

| JS | JSON |
|---|---|
| `en` | `en` (stays, used as all-caps label on radar + axis cards) |
| `zh` | `label` (short 2-char axis word) |
| `desc` | `description` |

### Newline convention

- `\n` = soft line break (render as `<br>`)
- `\n\n` = paragraph break (render as `</p><p>`)
- The runtime must do this conversion once in a helper; the existing `white-space: pre-line` on `.result-para` handles the `<br>` case natively, so most result-page prose can stay as `white-space: pre-line` and the renderer only needs to split on `\n\n` for paragraph tags when it wants true `<p>` semantics.

---

## 2. Runtime design (vanilla, ~60 lines)

A single new file `js/i18n.js` loaded with `defer` from `<head>`:

```js
// js/i18n.js
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
  if (nav.startsWith('zh')) return 'zh-TW'; // all zh variants fall back to zh-TW
  return DEFAULT_LANG;
}

async function loadLang(code) {
  const res = await fetch(`locales/${code}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error('locale fetch failed: ' + code);
  dict = await res.json();
  currentLang = code;
  document.documentElement.lang = code === 'zh-TW' ? 'zh-TW'
                                  : code === 'ja'    ? 'ja'
                                  :                    'en';
  applyStaticBindings();
}

export function t(path, vars) {
  const parts = path.split('.');
  let v = dict;
  for (const p of parts) { v = v && v[p]; if (v == null) return path; }
  if (vars && typeof v === 'string') {
    return v.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
  }
  return v;
}

export function setLang(code) {
  if (!SUPPORTED.includes(code)) return;
  try { localStorage.setItem('desireLang', code); } catch (e) {}
  loadLang(code).then(() => {
    // Re-render whichever screen is currently visible.
    if (typeof window.rerenderCurrent === 'function') window.rerenderCurrent();
  });
}

// Walk the DOM and set text / attribute from data-i18n markers.
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
    // format: "attr:key.path;attr2:key2.path"
    el.dataset.i18nAttr.split(';').forEach(pair => {
      const [attr, key] = pair.split(':');
      const v = t(key.trim());
      if (typeof v === 'string') el.setAttribute(attr.trim(), v);
    });
  });
  // Also update <title> and meta description from ui.meta.
  const title = t('ui.meta.title');
  if (title) document.title = title;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', t('ui.meta.description'));
  const ogT = document.querySelector('meta[property="og:title"]');
  if (ogT) ogT.setAttribute('content', t('ui.meta.ogTitle'));
  const ogD = document.querySelector('meta[property="og:description"]');
  if (ogD) ogD.setAttribute('content', t('ui.meta.ogDescription'));
}

// \n -> <br>, \n\n -> paragraph (used for emphasis-containing prose)
function renderBreaks(s) {
  // escape HTML, then convert *marked* to <em>, then paragraph+break.
  const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const em  = esc.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return em.split('\n\n').map(p => p.replace(/\n/g, '<br>')).join('</p><p>');
}

// Boot
currentLang = detectLang();
loadLang(currentLang);
window.i18n = { t, setLang, getLang: () => currentLang };
```

Design rationale:

- **No framework.** Keeps the file tiny and avoids the 70 KB-ish react/vue cost on a page that's already 144 KB of static HTML.
- **One JSON per language.** Loaded once per switch. `cache: 'no-cache'` because the file will change often during translation review; swap to default cache once stable.
- **`data-i18n`** for text, **`data-i18n-html`** for strings that must render as paragraphs/`<em>`, **`data-i18n-attr`** for `alt`/`placeholder`/etc.
- **`setLang()`** writes to `localStorage` and triggers a `rerenderCurrent()` callback that `index.html`'s own code must expose (see §3).
- **`?lang=` URL param** wins over `localStorage` for sharing links.
- **`navigator.language`** is a soft default — any `zh-*` falls back to `zh-TW` because the quiz was authored in Taiwan.
- **Interpolation** uses `{name}` placeholders, as in `result.subTypeFallback1`.

---

## 3. Surgical refactor plan for `index.html` (for Phase D)

The pattern is: everywhere a Chinese literal is hard-coded, replace with either (a) `data-i18n="..."` on the element, or (b) a `t(...)` call for JS-rendered strings.

### 3.1 Head block

Line 2: `<html lang="zh-TW">` → `<html lang="zh-TW">` (unchanged; `i18n.js` updates it at runtime).

Line 6–9: wrap in `data-i18n` or let `applyStaticBindings` rewrite via `ui.meta.*`.

Line 20: already loads Cormorant Garant + Noto Sans TC. Add CJK + Latin fonts for ja/en (see §5):

```html
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garant:ital,wght@0,300;0,400;0,600;1,300&family=Noto+Sans+TC:wght@300;400;500&family=Noto+Serif+JP:wght@400;500;700&family=Noto+Sans+JP:wght@300;400;500&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
```

Line 22: insert immediately after html2canvas:
```html
<script type="module" src="js/i18n.js" defer></script>
```

### 3.2 Static HTML strings (replace with `data-i18n`)

Example rewrite for the landing screen (lines 489–504):

**Before**
```html
<p class="title-sub" style="margin-bottom:16px">DESIRE ARCHETYPE</p>
<h1 class="title-main">慾望原型</h1>
...
<button class="btn-primary" onclick="startFresh()">進入測驗</button>
```

**After**
```html
<p class="title-sub" data-i18n="ui.brand.wordmark" style="margin-bottom:16px">DESIRE ARCHETYPE</p>
<h1 class="title-main" data-i18n="ui.landing.heading">慾望原型</h1>
...
<button class="btn-primary" data-i18n="ui.landing.startButton" onclick="startFresh()">進入測驗</button>
```

(The hard-coded fallback stays as the visible text until `i18n.js` finishes loading — avoids a flash of empty content.)

Apply this pattern to every element across lines 476–635 (every screen from counter through chapter transitions through quiz chrome). Taglines (three `.tagline-item` lines) are a short array — easiest to render as:

```html
<div class="taglines" id="landing-taglines"></div>
```

and fill from JS:

```js
const tags = t('ui.landing.taglines') || [];
document.getElementById('landing-taglines').innerHTML =
  tags.map(x => `<p class="tagline-item">${x}</p>`).join('');
```

Chapter 3's `xNotice` red-tinted box (lines 603–607) binds with `data-i18n-html="ui.chapterTransitions.ch3.xNotice"` so `\n\n` becomes a paragraph break.

Safety screen `<em>` (line 534) — the body in JSON uses `*原型傾向*` markers; use `data-i18n-html="ui.safety.body"` and the renderer converts `*...*` to `<em>...</em>`.

### 3.3 JS-rendered strings (replace with `t()`)

| Location | Change |
|---|---|
| `renderQuestion` line 1259 | `const chLabels = { 1: t('ui.quiz.chapterLabels.1'), ... }` |
| line 1266 | `t('ui.quiz.counterFormat', { current, total })` |
| line 1267 | `t('questions')[idx].text` (full switch to `t('questions')`) |
| line 1288 | option text from `t('questions')[idx].options[origIdx].text` |
| line 1317, 1333 | scoring reads from `t('questions')[idx].options[optIdx].scores` |
| line 1390 | type name from `t('types.' + code + '.name')` |
| `renderResult` lines 1448–1625 | every Chinese string from `t('ui.result.*')` or `t('types.' + code + '.*')` |
| line 1484–1487 | sub-type cards: `t('types.' + subCode + '.name')` etc. |
| line 1494, 1513 | fallback uses `t('ui.result.subTypeFallback1', { name })` |
| line 1517 | `t('ui.result.tightScoresNote')` |
| line 1537 | `t('ui.result.xNote')` |
| line 1552–1618 | section labels from `t('ui.result.sectionLabels.*')` and `t('ui.result.sectionTitles.*')` |
| line 1606 | `t('ui.result.compatDisclaimer')` |
| line 1613 | `t('ui.result.disclaimer')` with `\n` → `<br>` |
| line 1620, 1621 | `t('ui.result.retakeButton')`, `t('ui.result.downloadButton')` |
| `buildRadarChart` lines 1636–1637 | derive from `t('axisInfo')` map (see §7, flag 2) |
| line 1687, 1689, 1729, 1742, 1756 | `t('ui.download.*')` |
| line 1828 | `t('ui.counter.numberFallback')` |
| line 480, 482, 484, 485 | counter-page strings |

Expose a `window.rerenderCurrent()` function so `setLang()` can trigger a re-render without reload:

```js
window.rerenderCurrent = function () {
  if (state.screen === 'quiz')   { renderQuestion(state.currentQ); return; }
  if (state.screen === 'result') { renderResult(state.result); return; }
  applyStaticBindings();                      // static screens re-bind
};
```

### 3.4 File layout after Phase D

```
desire/
├── index.html          # refactored to use data-i18n + t()
├── js/
│   └── i18n.js         # ~60 lines, see §2
├── locales/
│   ├── README.md       # this file
│   ├── zh-TW.json      # baseline (122 KB)
│   ├── ja.json         # same shape, translated
│   └── en.json         # same shape, translated
└── images/             # unchanged
```

---

## 4. Language-switcher UI

- **Location:** fixed top-right of viewport, above the progress bar (`z-index: 101`).
- **Visual:** three plain text buttons, `繁 / 日 / EN`, separated by hair-space dots. 11 px, letter-spacing 0.2 em, `color: var(--fog)`. Active one gets `color: var(--gold)`.
- **Markup:**
  ```html
  <nav id="lang-switcher" aria-label="Language">
    <button data-lang="zh-TW">繁</button>·<button data-lang="ja">日</button>·<button data-lang="en">EN</button>
  </nav>
  ```
- **CSS:**
  ```css
  #lang-switcher {
    position: fixed; top: 10px; right: 16px; z-index: 101;
    font-family: 'Cormorant Garant', serif;
    font-size: 11px; letter-spacing: 0.2em; color: var(--fog);
  }
  #lang-switcher button {
    background: none; border: 0; padding: 2px 4px;
    font: inherit; color: inherit; cursor: pointer;
  }
  #lang-switcher button.active { color: var(--gold); }
  ```
- **Behavior:** `addEventListener('click', e => { if (e.target.dataset.lang) i18n.setLang(e.target.dataset.lang); })`. On every `applyStaticBindings`, toggle `.active` based on `i18n.getLang()`.
- **Persistence:** `localStorage.desireLang` (already set by `setLang`).

---

## 5. Font strategy per language

| Lang | Headings (serif) | Body (sans) |
|---|---|---|
| zh-TW | `'LXGW WenKai Screen'` (current) | `'Noto Sans TC'` |
| ja | `'Noto Serif JP'` | `'Noto Sans JP'` |
| en | `'Cormorant Garant'` (current) | `'Inter'` |

Switch via `html[lang]` attribute selector (set by `i18n.js`):

```css
/* zh-TW default already in :root, overrides below */
html[lang="ja"] body { font-family: 'Noto Sans JP', sans-serif; }
html[lang="ja"] .title-main,
html[lang="ja"] .section-title,
html[lang="ja"] .q-text,
html[lang="ja"] .result-name,
html[lang="ja"] .chapter-title,
html[lang="ja"] .btn-primary,
html[lang="ja"] .result-actions button {
  font-family: 'Noto Serif JP', serif;
}

html[lang="en"] body { font-family: 'Inter', sans-serif; }
html[lang="en"] .title-main,
html[lang="en"] .section-title,
html[lang="en"] .q-text,
html[lang="en"] .result-name,
html[lang="en"] .chapter-title,
html[lang="en"] .btn-primary,
html[lang="en"] .result-actions button {
  font-family: 'Cormorant Garant', serif;
}
```

Add the font imports to the Google Fonts link in `<head>` (see §3.1).

---

## 6. Layout risks for QA

Flag these to whoever runs the browser pass after Phase D:

- **English expansion.** Chinese bodies are terse; the English version will likely be 1.5–2× longer. The result page is already long — expect scroll length to grow materially. Buttons `btn-primary` (fixed `padding: 14px 40px`) may wrap awkwardly on narrow screens with longer English CTAs; consider `white-space: nowrap` + letting the pill grow.
- **Japanese line breaking.** No word spaces — `word-break: keep-all; overflow-wrap: anywhere;` on `.q-text`, `.chapter-desc`, `.result-para` prevents mid-character wrap. Verify on 320 px width.
- **Button width.** `.gender-card` has `min-width: 140px`. "Female image" / "女性の画像" / "女性圖像" differ enough that the pair should be allowed to flex.
- **Radar chart label overlap.** Labels at 9 points around a 320 px circle (lines 1660–1676) — English words like `COMPATIBILITY`, `TRANSGRESSION` won't fit. See flag 2 in §7; recommend keeping the radar axis labels in the 2-char zh/ja form or using letter codes (A/R/G/T/S/N/P/C/X) in English rather than full words.
- **Title truncation.** `.title-main` uses `font-size: clamp(28px, 8vw, 44px);`. English "Desire Archetypes" is long — may truncate at 320 px without `line-height` tuning.
- **Option ordering.** The quiz shuffles option display order per question (lines 1277–1282). Translators must **not** reorder options in the JSON — the `scores` key is positional against the author order, and the shuffler maps display→original by index.
- **`white-space: pre-line` on `.result-para`** preserves `\n` as line break. If a translator uses literal `\n` text instead of a real newline in JSON, it won't render. Confirm each PR with a visual check.
- **`<em>` marker in safety body.** Uses `*...*` convention — if the translator wraps a different word, the renderer still accepts it, but confirm visually.

---

## 7. Weird things in the current code — flag for Phase D

1. **Two separate chapter name sources.**
   - Chapter transition **screen titles** (lines 580, 590, 600): `慾火怎麼升起`, `權力怎麼流動`, `你的慾望究竟來自何處？`
   - Chapter **progress-bar labels** (line 1259): `第一章｜火如何升起`, `第二章｜關係如何牽動`, `第三章｜深處如何召喚`
   Both are preserved in JSON (`ui.chapterTransitions.chN.title` vs `ui.quiz.chapterLabels.N`). The translation team should keep them consistent in spirit but different in form — the screen is a dramatic one-line title, the progress bar is a terse section marker.

2. **Radar axis labels duplicated.** Lines 1636–1637 hard-code `主動/回應/給予/承接/交替/感官/張力/儀式/越界`. These are the same words as `AXIS_INFO[letter].zh` (line 1170–1180). JSON ships both (`axisInfo.*.label` and `radarLabels.*`); in Phase D, delete `radarLabels` from the JSON and have the chart pull from `axisInfo` to keep one source of truth. Kept in Phase C only so a hasty integrator doesn't miss the hard-coded array.

3. **Compat text contains leftover section dividers.** Three of the compatTexts end with vestigial author-outline headers:
   - `types["R-S-N"].compatText` ends with `\n\n張力軸 P`
   - `types["R-S-P"].compatText` ends with `────────────────────────────────────────\n\n儀式軸 C`
   - `types["R-S-C"].compatText` ends with `\n\n越界軸 X`
   Translation team: **drop these trailing tokens**. Michael should also strip them from the zh-TW baseline before deploy (one-line edit per type).

4. **Counter page uses female pronoun 妳.** Lines 480, 482, 484: `妳是第 … 位來探索慾望的人 … 妳準備好了嗎？`. The rest of the quiz uses neutral `你`. This is a deliberate audience signal (quiz is marketed on X/t.co to a largely female audience per project memory). Translation can neutralize this in ja (`あなた`) and en (`you`) without flagging — but Michael, confirm you want this.

5. **Comma-vs-fullstop punctuation.** Prose uses mixed ASCII commas and Chinese full-width punctuation. Preserve as given in the baseline; ja should use `、。`, en should use `. ,`.

6. **Em-dash `——`.** The current zh-TW text uses `——` in a few places (`intro.body`, `chapterTransitions.ch1.body`). Michael's writing taboo (project memory) says "no em-dash because it reads AI-generated" — but it's already in the authored baseline. Flag to Michael: should Phase D also strip these from zh-TW? ja/en translators should use their language's natural equivalent (ja: `——` is fine stylistically; en: avoid em-dash per Michael's rule, use short sentence breaks).

7. **`sub2.subDesc` paragraph splitting inconsistency.** Line 1490: `sub.subDesc.split('\n\n').forEach(...)` for sub1, but line 1511 passes `sub2.subDesc` straight into one `<p>`. Looks like a bug in the current code; preserve for now but worth a Phase-D cleanup.

8. **Visitor counter API.** Line 1823 calls `api.countapi.xyz` — that service shut down in 2024/2025. The counter is likely dead already. Not an i18n issue, but worth telling Michael. The fallback renders `——` which is already in JSON as `ui.counter.numberFallback`.

9. **Web Share API title + download popup HTML.** Lines 1729 and 1742 contain inline strings. The popup HTML template at 1742 is especially gnarly — it uses `${filename}` interpolation inside a `document.write` block with inline CSS. Phase D should extract that into a helper that reads from `t('ui.download.*')`.

10. **No ARIA / lang attributes on dynamic content.** When `renderResult` injects HTML, nothing sets `lang=` or `dir=`. Not a bug today (all content is single-language per render), but after Phase D the `<html lang>` swap handles it.

---

## 8. Translation brief for the ja / en teams

Pass this verbatim.

### 8.1 Writing voice (hard rules from the author)

- **No em-dash (`——` / `—`).** It reads AI-generated. Use short sentences or ellipses instead.
- **Not "analytical".** The reader is *being seen*, not *being analyzed*. Avoid clinical/workshop/consultant voice.
- **Not formal.** No academic register. Think thoughtful lover, not therapist.
- **No "Mafiana" branding.** The brand is now **慾望原型測驗 / Desire Archetypes**. Mafiana was a predecessor and must not appear anywhere.
- **Short sentences, strong images.** Minimize second-person "you / 你 / あなた" — the Chinese original often drops subjects.
- **Avoid "not A but B" (不是…而是) construction.** Overused in AI-generated Chinese; find other framings.

### 8.2 Register target

Readers who are fluent in intimacy / kink / BDSM community discourse in each language. Vocabulary should feel at home for:

- English: readers of Nagoski (*Come As You Are*), Perel (*Mating in Captivity*), the Fetlife-literate community. Common lexicon: *consent, aftercare, safeword, dom/sub, scene, play, edging, Dom-space / sub-space, D/s dynamic, soft/hard limits, protocol*.
- Japanese: readers of 性教育 / BDSM community blogs and 翻訳本 of the above authors. Common lexicon: `合意、アフターケア、セーフワード、ドム／サブ、プレイ、シーン、ソフト/ハードリミット、プロトコル、サブスペース`.

Theoretical touchstones the vocabulary should quietly honor: **Nagoski dual control model** (accelerators / brakes), **Foucault power dynamics**, **Bataille** (erotism / transgression / sacrifice), **Perel** (desire thrives on distance).

### 8.3 X-axis safety preamble is non-negotiable

The X (越界 / transgression) axis is only valid under: **clear consent, revocable, safeword, aftercare, do not frame violation as transgression**. This appears in three places (`ui.safety.body`, `ui.chapterTransitions.ch3.xNotice`, `ui.result.xNote`). Translate carefully — this is the ethical frame of the whole product.

### 8.4 24 type names

The Chinese names are poetic, 2–3 characters, each hinting at a stance toward intimacy. Target the same poetic register, **not literal translation**. Suggest 2–3 candidates per archetype so Michael can pick. Reference list (zh-TW name + what the archetype actually is):

| Code | zh | What it is | Suggested direction for ja / en |
|---|---|---|---|
| A-G-N | 獵手 | active, giving, sensory — hunts for the moment | ja: 狩人 / 誘う者 ; en: *Hunter* / *The Pursuer* |
| R-T-N | 聆感者 | receptive, taking, sensory — opens when truly listened to | ja: 感応者 / 聞き手 ; en: *Listener* / *The Attuned* |
| A-T-N | 享樂者 | active, taking, sensory — wants to be filled, unashamed | ja: 快楽主義者 ; en: *Hedonist* / *The Appetite* |
| R-G-N | 感應者 | receptive, giving, sensory — reads before being asked | ja: 察知者 ; en: *Reader* / *The Attuned Giver* |
| A-S-N | 逐感者 | active, switch, sensory — chases novelty | ja: 感を追う者 ; en: *Chaser* / *The Seeker* |
| R-S-N | 共舞者 | receptive, switch, sensory — follows the rhythm | ja: 共舞者 ; en: *Dancer* / *The Partner* |
| A-G-P | 支配者 | active, giving, tension — makes the wait feel like reward | ja: 支配者 ; en: *The Dom* / *Commander* |
| R-T-P | 臣服者 | receptive, taking, tension — can finally stop holding on | ja: 服従者 ; en: *Submissive* / *The Yielding* |
| A-T-P | 墜落者 | active, taking, tension — walks to the edge, wants to be caught | ja: 堕ちる者 ; en: *The Faller* |
| R-G-P | 捕時者 | receptive, giving, tension — waits for the exact second | ja: 時を捉える者 ; en: *The Catcher* / *The Timekeeper* |
| A-S-P | 翻轉者 | active, switch, tension — flips roles mid-scene | ja: 反転者 ; en: *The Switch* / *The Flipper* |
| R-S-P | 迷霧者 | receptive, switch, tension — thrives in the undefined | ja: 霧の者 ; en: *The Mist* |
| A-G-C | 編儀者 | active, giving, ritual — designs the ritual | ja: 儀式を編む者 ; en: *The Ritualist* / *The Weaver* |
| R-T-C | 沉浸者 | receptive, taking, ritual — enters when the frame is set | ja: 沈む者 ; en: *The Devotee* / *The Immersed* |
| A-T-C | 求道者 | active, taking, ritual — seeks the path | ja: 求道者 ; en: *The Seeker* / *The Pilgrim* |
| R-G-C | 守儀者 | receptive, giving, ritual — holds the frame when trust arrives | ja: 守儀者 ; en: *The Keeper* / *The Officiant* |
| A-S-C | 化身者 | active, switch, ritual — becomes who the scene needs | ja: 化身 ; en: *The Avatar* / *The Shapeshifter* |
| R-S-C | 應形者 | receptive, switch, ritual — takes the shape of the scene | ja: 応形者 ; en: *The Vessel* / *The Shape-taker* |
| A-G-X | 禁忌嚮導 | active, giving, transgression — leads to the edge, holds the lamp | ja: 禁忌の案内人 ; en: *The Guide* / *Threshold Guide* |
| R-T-X | 消融者 | receptive, taking, transgression — borders dissolve in trust | ja: 融ける者 ; en: *The Dissolving* / *The Melter* |
| A-T-X | 赴界者 | active, taking, transgression — walks the border knowingly | ja: 境へ赴く者 ; en: *The Crosser* / *The Pilgrim-to-the-Edge* |
| R-G-X | 守門人 | receptive, giving, transgression — guards the gate | ja: 門番 ; en: *The Gatekeeper* |
| A-S-X | 越界者 | active, switch, transgression — plays with the line | ja: 越境者 ; en: *The Transgressor* / *The Border-walker* |
| R-S-X | 遊蕩者 | receptive, switch, transgression — wanders the edge, never fixing | ja: 遊蕩者 ; en: *The Wanderer* |

**Important:** every `type.name` also appears as some *other* type's `compatName`. Keep the two consistent. (The runtime does not auto-derive — translator must synchronize.)

### 8.5 Gender-sensitive language

The gender selector only picks the image gender, not the pronoun. Prose generally stays neutral or uses `你` (neutral). Exception: counter page uses `妳` (female pronoun) — Michael may want this neutralized or kept across all three languages (see §7 flag 4).

### 8.6 Terminology mini-glossary

| zh | ja | en |
|---|---|---|
| 合意 | 合意 / コンセント | consent |
| 安全詞 | セーフワード | safeword |
| 可撤回 | 撤回可能 | revocable |
| aftercare | アフターケア | aftercare |
| 越界 | 越境 / 境界越え | transgression (axis) / crossing (verb) |
| 慾望原型 | 欲望の原型 | desire archetype |
| 主導 / 支配 | 主導 / 支配 | dominance / lead |
| 承接 / 臣服 | 受容 / 服従 | receptive / submission |
| 儀式 | 儀式 | ritual |
| 感官 | 感覚 / 感官 | sensory |
| 張力 | 緊張 | tension |

---

## 9. Hand-off checklist for Phase D

- [ ] Create `js/i18n.js` per §2
- [ ] Add Google Fonts (ja + en additions) per §3.1
- [ ] Add `<script type="module" src="js/i18n.js" defer>` to `<head>`
- [ ] Mark every static Chinese string in `<body>` lines 476–635 with `data-i18n` / `data-i18n-html` / `data-i18n-attr`
- [ ] Rewrite `renderQuestion`, `renderResult`, `buildRadarChart`, `downloadResult`, `initCounterPage`, `animateCount` to pull strings via `t()`
- [ ] Delete the hard-coded `chLabels` in `renderQuestion` (line 1259) and the radar label array (lines 1636–1637); pull from JSON
- [ ] Add `window.rerenderCurrent()` wrapper
- [ ] Add `#lang-switcher` HTML + CSS + click handler per §4
- [ ] Add `html[lang="ja"]` and `html[lang="en"]` font blocks per §5
- [ ] Strip the three vestigial `*軸 X` tails from R-S-N / R-S-P / R-S-C `compatText` (§7 flag 3)
- [ ] Verify at 320 px / 768 px / 1280 px per §6
- [ ] GA4 `quiz_complete` event (line 1388) still fires with original Chinese `type_name` — decide whether to keep that stable across languages (recommended: yes, use `type.name` in whichever language — GA4 custom dimensions treat it as a string anyway)
- [ ] Confirm `countapi.xyz` is actually dead; replace or hide counter screen
