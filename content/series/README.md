# Series (Imprint-style courses)

Each file here is one Series: a few short episodes of five to eight cards, read one card at a time in the app.

## How they're made

- Claude Code drafts them from the sources listed in each file (Wikipedia, Project Gutenberg and similar). Every card names its source, and the app links to it.
- `npm run check` (and the Health check on GitHub, run on every change here) confirms every source link works and that every quote from a book appears word for word in the book's text.
- Quick checks only ask about what the episode has just taught.

## Review

Every Series starts as `"reviewed": false` and is hidden from testers. Language Series are the exception: they appear with "Not yet checked", like the phrase packs.

To review on your phone: tap the Knowfeed wordmark 5 times, then **Show Series drafts for review**. Drafts then appear in your editions and in Learn, marked "Draft". At the end of each episode, tap **Looks good** or **Something's wrong**. Then tell Claude Code which Series are approved (or what to change), and it sets `"reviewed": true`.

## Format

```jsonc
{
  "id": "how-money-works", "title": "How money works",
  "kind": "idea",                // idea | history | skill | book | language
  "topic": "money",              // colour family and cover
  "interests": ["personalfinance"],  // who it's offered to (interest ids from content/interests.json)
  "areas": ["marketing"],        // optional: work areas (src/workareas.ts)
  "lang": "Spanish",             // language Series only
  "colours": ["#059669", "#0EA5E9"],
  "blurb": "One line on what you'll learn.",
  "reviewed": false,
  "book": { "author": "", "translator": "", "text": "plain-text URL used to verify quotes" },  // book Series only
  "sources": [{ "id": "infl", "title": "Inflation", "url": "https://en.wikipedia.org/wiki/Inflation" }],
  "episodes": [{ "n": 1, "title": "Why prices rise", "cards": [
    { "type": "title", "big": "Inflation", "text": "…", "src": ["infl"] },
    { "type": "idea" | "fact" | "example" | "tip", "big": "…", "text": "…", "src": ["…"] },
    { "type": "quote", "text": "exact words from the book", "who": "Chapter 1", "src": ["…"] },
    { "type": "phrase", "id": "es-020" },          // language Series: a phrase from the pack
    { "type": "check", "q": "…", "opts": ["…", "…", "…"], "answer": 1, "explain": "…", "src": ["…"] },
    { "type": "recap", "points": ["…", "…", "…"] }
  ]}]
}
```

Keep cards short: a big word or number, then no more than two or three short sentences.
