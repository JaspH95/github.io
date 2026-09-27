/* Shared shapes for everything the pipeline writes to public/data and the app reads. */

/* Colour and cover families. Categories come from content/interests.json; the rest are special card families. */
export type TopicKey =
  | 'news' | 'tech' | 'science' | 'money' | 'culture' | 'life' | 'sport'
  | 'local' | 'general' | 'space' | 'lang' | 'sign' | 'work';

export interface Interest {
  id: string;
  label: string;
  cat: TopicKey;
  guardian: string[];
  match: string[];
  wiki: string[];
  sport?: string;
}
export interface InterestsFile { categories: Record<string, string>; interests: Interest[] }

export interface Article {
  outlet: string;
  url: string;
  title: string;
  standfirst?: string;
  published: string;          // ISO
  image?: string;
}

export interface Img {
  url: string;
  source: 'article' | 'wikimedia' | 'unsplash' | 'pexels';
  credit?: string;            // outlet, photographer or licence
  link?: string;              // where the credit points
  w?: number;
  h?: number;
  lqip?: string;              // tiny blurred preview, a data URI
  focus?: [number, number];   // focal point as percentages, for object-position
}

export interface Entity {
  name: string;               // as written in the articles
  kind?: 'person' | 'place' | 'org' | 'thing';
  desc?: string;              // Wikipedia's short description
  wiki?: string;              // Wikipedia page title
  image?: string;
}

export interface TimelineItem { at: string; text: string; outlet?: string; url?: string }
export interface Quote { text: string; who: string; role?: string; outlet?: string; url?: string }
export interface Section { heading: string; text: string }

/* Written by Gemini in the pipeline, only from the articles' own text, then checked */
export interface Summary {
  gist: string[];
  sections: Section[];
  fivew?: [string, string][];
  quotes?: Quote[];
  model: string;
  at: string;
  n: number;                  // how many articles it was written from
}

export interface Story {
  id: string;
  title: string;
  standfirst: string;
  url: string;                // lead article
  outlet: string;
  published: string;          // lead article time
  first: string;              // when Knowfeed first saw the story
  updated: string;            // latest article in the cluster
  topic: TopicKey;
  tags: string[];             // interest ids
  kw?: string[];              // Guardian keyword tags, for interests found by search
  tag?: string;               // city, sport or team
  articles: Article[];        // every outlet covering it, lead first
  importance: number;         // 0 to 1
  top?: boolean;              // leads a major outlet's front page
  image?: Img;
  summary?: Summary;
  entities?: Entity[];
  timeline?: TimelineItem[];
  via?: string;               // live items: why it's here ("Breaking", an outlet you follow, a topic you follow)
  paywall?: boolean;
}

export interface NewsFile { generated: string; stories: Story[] }
export interface LocalFile { generated: string; regions: Record<string, Story[]> }

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
  interest?: string;          // interest id for topic cards
  title: string;
  description?: string;
  extract: string;
  image?: string;
  url: string;
  source: 'Wikipedia' | 'NASA' | 'Wikimedia Commons';
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
export interface StatusFile {
  generated: string;
  sources: SourceStatus[];
  summaries: { made: number; cached: number; failed: number; skipped?: number; model?: string; notes?: string[] };
  images?: Record<string, number>;
}

/* Jobs: a subset of ESCO occupations for on-device matching */
export interface Occupation { u: string; t: string; a?: string[]; g: string }
export interface OccupationsFile { generated: string; version: string; groups: Record<string, string>; occupations: Occupation[] }
export interface Skill { uri: string; label: string; type: 'essential' | 'optional'; kind?: 'skill' | 'knowledge' }

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
