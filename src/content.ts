import type { TopicKey, Phrase } from './types';

export const TOPICS: Record<TopicKey, string> = {
  ai: 'AI tools & trends', tech: 'Tech news', crm: 'CRM & automation', hubspot: 'HubSpot', world: 'Around the world',
  space: 'Space & science', future: 'Future tech', culture: 'Culture & history', psych: 'Psychology', money: 'Money & economics',
  general: 'General knowledge', local: 'Local news', sport: 'Your sports', sign: 'Sign language (BSL)', lang: 'Languages',
};
/* Topics offered in onboarding and the chat (local, sport and languages have their own questions) */
export const PICKABLE = (Object.keys(TOPICS) as TopicKey[]).filter(k => !['local', 'sport', 'lang'].includes(k));

/* One line for each topic on Discover cards */
export const BLURB: Partial<Record<TopicKey, string>> = {
  ai: 'How AI actually works, and the ideas behind the headlines.',
  tech: 'The day’s tech stories from the BBC, The Verge, Ars Technica and more.',
  crm: 'The ideas behind customer data, sales and marketing systems.',
  hubspot: 'What’s new in HubSpot, straight from the changelog and blog.',
  world: 'The biggest stories from the UK and around the world.',
  space: 'NASA’s picture of the day, science news and the universe explained.',
  future: 'Batteries, robots, fusion and the tech that’s coming next.',
  culture: 'History, art, sport and the stories behind famous places.',
  psych: 'Why your brain does odd things, and what psychologists have found.',
  money: 'Interest rates, inflation and business news in plain English.',
  general: 'Wikipedia’s featured article, most-read pages and on this day.',
  sign: 'British Sign Language and Deaf culture.',
};

/* Rule-based suggestions for the chat: people who like X often enjoy Y */
export const RELATED: Partial<Record<TopicKey, TopicKey[]>> = {
  ai: ['future', 'tech', 'psych'], tech: ['ai', 'future'], crm: ['hubspot', 'money'], hubspot: ['crm', 'ai'], space: ['future', 'general'],
  future: ['ai', 'space'], world: ['money', 'general'], culture: ['general', 'sign'], general: ['space', 'culture'], psych: ['money', 'general'],
  money: ['crm', 'world'], sign: ['general', 'culture'], local: ['world'], sport: ['culture'], lang: ['sign'],
};

/* Default illustrated scene for each topic, used when a card has no photo */
export const SCENE: Record<TopicKey, string> = {
  ai: 'network', tech: 'network', crm: 'pipeline', hubspot: 'sprocket', world: 'globe', space: 'planet', future: 'robot',
  culture: 'road', psych: 'mind', money: 'chart', general: 'spark', local: 'city', sport: 'pitch', sign: 'sign', lang: 'lang',
};

export const WORK: [string, string, string, TopicKey[], string][] = [
  ['tech', 'Tech & data', 'chip', ['ai', 'tech', 'future'], 'Building the future, and occasionally debugging it.'],
  ['crm', 'CRM & sales ops', 'db', ['crm', 'hubspot', 'ai'], 'Keeping the data clean so everyone else can trust it.'],
  ['mkt', 'Marketing', 'mega', ['crm', 'psych'], 'Half science, half working out what people actually want.'],
  ['fin', 'Finance', 'chart', ['money', 'ai'], "A numbers person. I'll keep the charts honest."],
  ['cre', 'Creative', 'pen', ['psych', 'future'], 'Making things people actually stop and look at.'],
  ['stu', 'Student', 'cap', ['general', 'space'], 'Learning is already the day job, then.'],
  ['oth', 'Something else', 'dots', [], 'Fair enough. Your likes will teach me the rest.'],
];
export const SPORTS = ['Football', 'Rugby', 'Cricket', 'Tennis', 'Formula 1', 'Golf', 'Boxing & MMA', 'NFL', 'Basketball', 'Cycling', 'Athletics'];
export const CLUBS = ['Arsenal', 'Aston Villa', 'Chelsea', 'Everton', 'Liverpool', 'Man City', 'Man United', 'Newcastle', 'Spurs', 'West Ham', 'Celtic', 'Rangers'];
export const UK_CITIES = ['London', 'Manchester', 'Birmingham', 'Glasgow', 'Edinburgh', 'Leeds', 'Bristol', 'Liverpool', 'Cardiff', 'Belfast'];
export const WORLD_CITIES = ['New York', 'Paris', 'Dublin', 'Berlin', 'Dubai', 'Singapore', 'Sydney', 'Toronto'];

/* Languages: speech codes for the device voice */
export const LANG_CODES: Record<string, string> = {
  Spanish: 'es-ES', French: 'fr-FR', Italian: 'it-IT', German: 'de-DE', Portuguese: 'pt-PT', Romanian: 'ro-RO', Japanese: 'ja-JP',
};
export const LANG_OPTS = [...Object.keys(LANG_CODES), 'British Sign Language'];

/* Phrase packs live in content/phrases/<language>.json and are bundled at build time */
const packFiles = import.meta.glob('../content/phrases/*.json', { eager: true, import: 'default' }) as Record<string, Phrase[]>;
export const PACKS: Record<string, Phrase[]> = {};
for (const [path, list] of Object.entries(packFiles)) {
  const name = path.split('/').pop()!.replace('.json', '');
  const lang = Object.keys(LANG_CODES).find(l => l.toLowerCase() === name.toLowerCase());
  if (lang && Array.isArray(list) && list.length) PACKS[lang] = [...list].sort((a, b) => a.level - b.level);
}
