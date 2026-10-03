# Round 5 — Tagline Blind-Native Hunt (2026-10-03)

Cross-language review of all 24 taglines sitting together. Looking for: translationese, lexical repetition across types, rhythm drift, template leaks.

## zh-TW (baseline, preserved)

### Repetition inventory
- 「身體」appears in 7 taglines (A-G-N, A-S-N, R-S-N, R-S-P, R-T-C, R-S-C, A-G-X-adj.) — thematically coherent but **a touch frequent**. Not a bug; baseline stays.
- 「規則」appears 3× (A-G-C, R-T-C, R-G-C) — all C-axis, intentional cluster. ✓
- 「門 / 邊界」cluster across X types — intentional. ✓

### Style-rule violations (acknowledged pre-existing)
- 「不是…是…」structure: A-T-P, A-T-C, R-G-C (3 instances). Violates Michael's "不是⋯而是" rule, but these are zh baseline that project doc §7 flag 7 says is not touched this phase.
- Em-dash (——) not found in taglines directly; appears in other zh fields (also flagged §7 as deferred).

### Verdict
zh baseline is preserved. No tagline changes recommended in this round.

## ja

### Repetition inventory
- 「欲望」appears 5× across taglines (A-T-N, A-G-C, A-S-C, R-T-X? let me recount: A-T-N "欲を隠す気はない", A-G-C "欲望の扉", A-S-C "欲望に輪郭", R-G-X "何を求めて" (indirect)). Actually counted directly:「欲望」appears in A-G-C, A-S-C, A-T-C (indirect)— 2-3 times. Within tolerance.
- 「扉」appears 3× (A-G-C, A-G-X, R-G-X) — thematic for door/boundary types. ✓
- 「身」 / 「身は」 / 「身を」 appears in R-T-N, R-S-N, R-T-C, R-S-C, R-T-X, A-T-X (6×) — all T/S types where receptivity matters. **Thematically consistent, acceptable.**
- 「〜していく」 / 「〜ていく」 endings: A-T-P "向かう", A-G-P "変えていく", A-G-X "決める" — spread across types, not clustered. ✓

### Structure diversity
- Opening patterns are varied (noun-first, verb-first, 「ただ〜」, direct description, questions)
- Period pacing: most are 2-3 short sentences. Rhythm feels native.

### Verdict
ja taglines read as native-level after B.7 ja_lifter + B.5 GPT Batch A. No further rewrites recommended this round. Known deferred: 118 ではない in body text (Fork B handling).

## en

### Repetition inventory
- 「The body」 appears 5× (A-G-N "The body moves", A-S-N "the hunger", R-S-N "the body falls", R-S-P "the body wants", R-T-X "the body..."). Actually re-counting direct: A-G-N "The body moves before thought", R-S-N "the body falls into step", R-S-P "the closer the body wants to drift". = 3 direct uses. Acceptable.
- 「The door」 appears 3× (A-G-C "its door", A-G-X "where the door is", R-G-X "The door can open"). Thematic for G-C/G-X. ✓
- 「The edge」 appears 3× (A-T-P "to the edge", A-T-X "The edge only", R-T-X "the edges begin to dissolve"). Thematic for T + X. ✓
- 「the scene」 appears 3× (A-G-N indirect, R-G-C "the scene takes shape", R-S-C "Set the scene"). Reasonable.
- 「closer / close / closeness」 across types but varied forms. ✓

### Structure diversity
- Opening patterns vary: verb-first ("Spots", "Reads", "Walks", "Knows", "Leave", "Sets"), noun-phrase ("Something wanted", "Anticipation builds"), participle ("Lingers", "Waiting one moment").
- Period pacing: typically 2 short sentences. **Minor concern: period-dense 2-sentence rhythm across most types could feel formulaic as a set.** Taglines A-S-P "Waiting one moment. Making someone else wait the next." stand out as rhythmically distinct in a good way.
- No "If your secondary is X" leaking from subDescription. ✓

### Potential polish (not blocker)
- A-T-N "Wants it fully. Wants to be filled until hunger gives way to excess. No appetite hidden." — the triple short-sentence is strong, but "No appetite hidden" is slightly stilted. Could become "No pretense of restraint." — judgment call, leave as-is unless Fork A improves it inline.
- A-S-N "One sensation wakes the hunger for another. The next one is already calling." — "the next one is already calling" has slight echo with A-T-P "whose arms are waiting below". Different enough; acceptable.

### Verdict
en taglines are in good shape after B.7 en_lifter + GPT Batch A. No required rewrites this round. If Fork A touches them during Not-X cleanup, the polish will be opportunistic.

## Summary

| Language | Rewrite required? | Known deferred |
|---|---|---|
| zh | No (preserve baseline) | pre-existing 不是…是… + em-dash (project §7) |
| ja | No | 118 ではない in body text → Fork B |
| en | No | 93 Not-X family in body text → Fork A; 24 subDesc template → Fork A |

**Round 5 conclusion**: tagline sets stand native-level in all three languages as of the current JSON state. The remaining work is body-text cleanup, which is already dispatched to Fork A (en) and Fork B (ja).
