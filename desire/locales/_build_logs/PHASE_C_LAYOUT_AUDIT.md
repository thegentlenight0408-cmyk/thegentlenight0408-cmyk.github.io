# Phase C — Layout QA Audit (2026-10-03)

Pre-Phase-D audit. Documents layout risks when ja/en replace zh-TW. All findings are from static JSON + index.html analysis; no browser testing (because i18n runtime doesn't exist yet).

## 1. Length comparison (chars) vs zh baseline

| Field | zh | ja | en | Risk |
|---|---|---|---|---|
| `name` | 72 | 68 (94%) | 172 (239%) | **en: 12-char names (Shapeshifter, Transgressor) vs 2-4 zh** |
| `tagline` | 474 | 837 (177%) | 2106 (444%) | **en: 115-char taglines vs 27 zh. Will wrap 3-4 lines.** |
| `description` | 7886 | 10581 (134%) | 24431 (310%) | High — need vertical padding review |
| `subDescription` | 3752 | 5100 (136%) | 11927 (318%) | High |
| `shadow` | 4913 | 7232 (147%) | 15778 (321%) | High |
| `compatText` | 5414 | 7689 (142%) | 17596 (325%) | High |
| `ui.safety.body` | 120 | 162 (135%) | 341 (284%) | Medium |

Note on char-count vs pixel-width: Chinese chars are ~1em, Latin chars avg ~0.5em. En's 3× char count ≈ ~1.5× pixel width in practice. Still significant.

## 2. Hard-coded Chinese that blocks i18n (critical for Phase D)

| Line | What | Problem |
|---|---|---|
| 495-497 | Landing `.tagline-item` × 3: `點燃。/流動。/牽引。` | No JSON key, no `data-i18n`. Must externalize. |
| 629 | `.body-text`: `——` (em-dash) | Michael禁用 em-dash; must remove or replace per-locale |
| 1537 | Safety X notice body | Hard-coded zh — need JSON key already exists (`ui.chapterTransitions.ch3.xNotice` or `ui.result.xNote`); must switch render path |
| 1612 | Result footer | Hard-coded zh (probably attribution/legal) |
| 1634-1637 | Radar axes `label` array (主動/回應/給予/承接/交替/感官/張力/儀式/越界) | **Must load from `axisInfo[K].label` in current locale** |
| 1644 | `keyOf` map (Chinese → short-code) | Replace with reverse lookup from `axisInfo` or hard-code A/R/G/T/S/N/P/C/X only |
| 480-485 | Counter page strings (`妳是第`, `位來探索慾望的人`, `妳準備好了嗎？`) | Need `ui.counter.*` keys |
| 1620-1621 | Buttons (`重新測驗`, `儲存結果圖`) | Need `ui.result.actions.*` keys |

## 3. Overflow / clipping risks per locale

### en.json
- **Type names 10-12 chars** (Shapeshifter, Transgressor, Submissive): check `.sub-type-name` (line 404, font-size 14px), `.compat-name` display, result header. Current `font-size: clamp(26px, 7vw, 36px)` on `.result-type` — long names could still overflow on narrow screens. **Recommend: add `overflow-wrap: break-word; hyphens: auto` to type-name containers.**
- **Taglines 100-115 chars**: landing `.tagline-item` has no `max-width`; parent container does. At 17px, 115 chars ≈ ~770px — will wrap heavily. Review `line-height: 1.9` for 4-line taglines (becomes ~130px tall each × 3 = 390px, cramped on small screens).
- **Radar axis labels** (8-char `Sensory`, `Boundary`, `Initiate`, `Respond`, `Receive`): current font-size 10.5pt in SVG viewBox 380. English labels at top/bottom (anchor=middle) will exceed the ~30px radial slot. **Recommend: en-only CSS rule `svg text { font-size: 9px }` or shorten labels to 2-letter codes for en.**
- **Button widths**: `min-width: 140px` plus `padding: 18px 28px`. "Print / Save as PDF" (19 chars) + letter-spacing 0.08em needs ~180px — borderline but OK. "Core Compatibility" (18 chars) UPPERCASE as label — OK as caption.
- **Letter-spacing**: zh uses 0.08-0.3em for aesthetic; en needs 0 or 0.02em (English words shouldn't have inter-letter spacing). **Add rule `html[lang="en"] { letter-spacing: normal }` for body text.**

### ja.json
- **Length +34-47% vs zh**: generally safe but descriptions at 160+ chars could push mobile below the fold. Review `.safety-body` and chapter transitions.
- **Mixed kanji/kana rhythm**: kana are narrower than kanji. Line-breaking at 2em grid acceptable. No urgent action.
- **Line-breaking**: Japanese allows breaking anywhere except after small kana. Browsers handle this. No special CSS needed unless specific `word-break: keep-all` was used (it's not here).
- **Font**: current CSS loads 'Noto Sans TC' — this does NOT render ja kana correctly for all glyphs. **Must add `Noto Sans JP` + `Noto Serif JP` for ja. See fallback stack in §4.**

### zh-TW.json
- Baseline. No changes needed. (Reminder: existing zh em-dashes (——) violate Michael's rule — this is a known pre-existing issue, out of scope for this audit; flagged in project doc §7.)

## 4. Font pairing recommendations

Current CSS has only zh fonts. Phase D must add per-locale font stacks:

```css
/* Default (zh-TW) */
html { font-family: 'Noto Sans TC', sans-serif; }
.serif-cn { font-family: 'LXGW WenKai Screen', 'Noto Sans TC', serif; }

/* ja */
html[lang="ja"] { font-family: 'Noto Sans JP', 'Hiragino Sans', sans-serif; }
html[lang="ja"] .serif-cn { font-family: 'Noto Serif JP', 'Hiragino Mincho', serif; }

/* en */
html[lang="en"] {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  letter-spacing: normal;
}
html[lang="en"] .serif-cn { font-family: 'Cormorant Garant', Georgia, serif; }
```

Google Fonts link additions needed:
- `Noto+Sans+JP:wght@400;500` + `Noto+Serif+JP:wght@400;600`
- `Inter:wght@400;500` (optional, system fallback OK)
- Cormorant Garant already loaded.

## 5. Specific CSS adjustments needed in Phase D

| Priority | Target | Change |
|---|---|---|
| P0 | `.result-type` (around L353) | Add `overflow-wrap: break-word; hyphens: auto;` |
| P0 | `.sub-type-name` (L404) | Allow wrap, add max-width 240px |
| P0 | Radar SVG text (L1673) | Add locale-aware `font-size`: 10.5 for zh/ja, 9 for en |
| P0 | `axes` array (L1634) | Pull `label` from `axisInfo[K].label` in current locale |
| P1 | Landing `.taglines` (L494-497) | Externalize to `ui.landing.taglines[]` |
| P1 | `.tagline-item` (L160) | Add `max-width: 280px; margin: 0 auto; text-align: center;` |
| P1 | `html[lang="en"]` body | Add `letter-spacing: normal;` |
| P1 | Buttons (`.btn-primary`) | Review `min-width: 140px` — OK for en but verify "Confirm, Start Quiz" (19 chars) fits with letter-spacing stripped |
| P2 | `.axis-breakdown` labels | Verify en labels (SENSORY, TENSION) don't push numbers off |
| P2 | `.result-tagline` (L355) | Review line-height for en multi-line taglines |

## 6. Chapter transition / safety notice specific risks

- `ui.chapterTransitions.ch1.body` through `ch3.body`: en versions can be 2-3× length. The chapter transition screens use `.prose` with `max-width: 480px` and `line-height: 2` — tall en text may overflow viewport on small mobile. **Add `overflow-y: auto` to the screen container, verify in Phase D.**
- `ui.safety.body` + `ui.chapterTransitions.ch3.xNotice` + `ui.result.xNote`: four ethical anchors (consent/withdraw/safeword/aftercare) must be preserved verbatim. No layout tweaks should truncate them.

## 7. Images directory check

`/desire/images/` has 48 PNG files (male/female × 24 types). Image file names are coded by type (e.g. `A-G-N_male.png`), language-independent. ✓ No locale split needed.

## 8. Testing checklist for Phase D (post-integration)

Once `js/i18n.js` is built:
- [ ] Switch to `?lang=ja`, verify radar labels render as 2-3 char ja
- [ ] Switch to `?lang=en`, verify radar labels render legibly
- [ ] View result page for A-S-C (Shapeshifter) in en — longest name
- [ ] View result page for R-T-X (Melter/Undone) in en — longest tagline
- [ ] View landing in en — 3 one-word taglines must render stacked
- [ ] View safety page in en — longest body, verify no overflow on 375px viewport
- [ ] View chapter 3 transition in ja — longest ethical anchor section
- [ ] Download result PNG in each language (html2canvas font loading check)
- [ ] Narrow viewport (320px) sanity check

## 9. Known deferred (not Phase C scope)

- GA4 `language` param (Phase D §Deploy)
- `api.countapi.xyz` dead (project doc §7 flag 5) — unrelated to i18n
- Dynamic `downloadResult` HTML template (L1742) — hardest to i18n, can keep zh-only initially
- Pre-existing zh em-dashes (——) in zh-TW.json — out of scope

---

**Owner**: Nyxa  
**Context**: project_mafiana_quiz.md  
**Follow-up**: this file feeds Phase D's CSS section.
