import { Store } from './storage.js';

const API_URL = 'https://api.anthropic.com/v1/messages';

class MissingKeyError extends Error {
  constructor() { super('missing-anthropic-key'); this.code = 'missing-anthropic-key'; }
}

async function callClaude({ system, messages, maxTokens = 1024, effort = 'low' }) {
  const { anthropicKey, aiModel } = Store.getSettings();
  if (!anthropicKey) throw new MissingKeyError();

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: aiModel || 'claude-opus-5',
      max_tokens: maxTokens,
      system,
      output_config: { effort },
      messages
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Claude API error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === 'text');
  return textBlock ? textBlock.text : '';
}

function looksRomanian(text) {
  return /[ăâîșț]/i.test(text);
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch (e) { return null; }
}

export async function translate(inputText) {
  const system = 'You are a precise Romanian-English translator embedded in a beginner-friendly language-learning app. ' +
    'Detect whether the input text is Romanian or English, then translate it to the other language. ' +
    'Respond with ONLY a JSON object of the exact shape {"direction":"ro-en"|"en-ro","translation":"..."} and nothing else — no markdown, no explanation.';

  const raw = await callClaude({
    system,
    messages: [{ role: 'user', content: inputText }],
    maxTokens: 512,
    effort: 'low'
  });

  const parsed = extractJson(raw);
  if (parsed && parsed.translation) {
    return { direction: parsed.direction || (looksRomanian(inputText) ? 'ro-en' : 'en-ro'), translation: parsed.translation };
  }
  return { direction: looksRomanian(inputText) ? 'ro-en' : 'en-ro', translation: raw.trim() };
}

// vocabList: array of Romanian words/phrases the learner has already studied.
// scenario: { title, description }
// history: array of { role: 'user'|'assistant', ro, en }
export async function chatReply(scenario, vocabList, history) {
  const vocabText = vocabList.length
    ? vocabList.join(', ')
    : '(no vocabulary studied yet — greet the learner simply and encourage them to start Phase 0)';

  const system = `You are role-playing as a warm Romanian family member helping a beginner practice conversational Romanian, ` +
    `in this scenario: "${scenario.title}" — ${scenario.description}. ` +
    `STRICT RULE: only use Romanian words and phrases from this approved list the learner has already studied (light grammatical variation like conjugation/plurals is fine, but do not introduce new vocabulary items): ${vocabText}. ` +
    `If you genuinely need a word outside the list, keep it to a bare minimum and gloss it in parentheses in English. ` +
    `Keep every reply to 1-2 short sentences appropriate for an absolute beginner. ` +
    `Respond with ONLY a JSON object of the exact shape {"ro":"<Romanian reply>","en":"<simple English gloss>"} and nothing else.`;

  const messages = history.map((h) => ({
    role: h.role,
    content: h.role === 'assistant' ? h.ro : h.ro
  }));

  const raw = await callClaude({ system, messages, maxTokens: 512, effort: 'medium' });
  const parsed = extractJson(raw);
  if (parsed && parsed.ro) return { ro: parsed.ro, en: parsed.en || '' };
  return { ro: raw.trim(), en: '' };
}

export { MissingKeyError };
