# Phrase packs

One file per language: `spanish.json`, `french.json`, `german.json`, `italian.json`, `portuguese.json`. These are the one fixed content type in Knowfeed; everything else is live.

- Written by Claude Code, around 135 phrases each, easiest and most useful first, across the 11 themes.
- Every phrase has `checked: false` until a native speaker confirms it. When they do, set `checked: true` and put who checked it in `notes`, for example `"notes": "Checked by Ana (native, Madrid), Oct 2026"`. The app shows "Not yet checked" until then, and never hides unchecked phrases.
- Portuguese is European Portuguese, as spoken in Portugal. Brazilian differences are in the `notes`.
- `say` is an English-sounding guide. Capitals mark the stressed syllable.
- To add a language, add `<language>.json` in the same format (see the schema in `CLAUDE.md`). The file name must match the language name in `src/languages.ts`, in lower case.

`SAMPLES-for-approval.md` holds the earlier 20-phrase samples, including Romanian and Japanese for the next packs.
