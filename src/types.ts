/* Shared shapes for everything the pipeline writes to public/data and the app reads. */

export type TopicKey =
  | 'ai' | 'tech' | 'crm' | 'hubspot' | 'world' | 'space' | 'future' | 'culture'
  | 'psych' | 'money' | 'general' | 'local' | 'sport' | 'sign' | 'lang';

export interface Coverage { outlet: string; url: string; title: string }

export interface SummarySection { heading: string; text: string }
export interface Summary { sections: SummarySection[]; model: string }

export interface Story {
  id: string;
  title: string;
  standfirst: string;
  url: string;
  outlet: string;
  image?: string;
  published: string;          // ISO date
  topic: TopicKey;
  tag?: string;               // sport name, team, city…
  also: Coverage[];           // other outlets covering the same story
  summary?: Summary;          // written by AI in the pipeline, from the article text only
}

export interface NewsFile { generated: string; stories: Story[] }
export interface LocalFile { generated: string; cities: Record<string, Story[]> }

export interface F1Result { pos: number; driver: string; team: string; detail: string }
export interface F1Data {
  last?: { race: string; round: number; date: string; url: string; results: F1Result[] };
  next?: { race: string; round: number; date: string; time?: string; circuit: string; locality: string; country: string; url: string };
}
export interface SportFile {
  generated: string;
  sports: Record<string, Story[]>;
  teams: Record<string, Story[]>;
  f1?: F1Data;
}

export interface LearnCard {
  id: string;
  kind: 'featured' | 'mostread' | 'potd' | 'onthisday' | 'topic' | 'apod';
  topic: TopicKey;
  title: string;
  extract: string;
  image?: string;
  url: string;
  source: 'Wikipedia' | 'NASA';
  year?: number;
  event?: string;             // "On this day" event text
  credit?: string;
}

export interface QuizArticle { title: string; extract: string; image?: string; url: string; source: 'Wikipedia' | 'Wikidata' }
export interface Quiz {
  id: string;
  topic: TopicKey;
  q: string;
  prompt?: string;            // extra line under the question (e.g. the event text)
  opts: string[];
  answer: number;
  explain: string;
  source: { name: string; url: string };
  article?: QuizArticle;
}

export interface HubItem {
  id: string;
  kind: 'changelog' | 'blog';
  title: string;
  summary: string;
  url: string;
  published: string;
  image?: string;
}

export interface LearnFile {
  generated: string;
  date: string;               // YYYY-MM-DD the Wikipedia/NASA content is for
  topicsHash: string;
  cards: LearnCard[];
  quizzes: Quiz[];
  hubspot: HubItem[];
}

export interface SourceStatus { name: string; url: string; ok: boolean; items: number; error?: string }
export interface StatusFile { generated: string; sources: SourceStatus[]; summaries: { made: number; cached: number; failed: number; model?: string } }

/* Phrase packs: content/phrases/<language>.json */
export interface Phrase {
  id: string;
  phrase: string;
  romanisation?: string;
  say: string;
  meaning: string;
  when: string;
  theme: string;
  level: number;
  formality: 'neutral' | 'informal' | 'formal';
  notes?: string;
  checked: boolean;
}
