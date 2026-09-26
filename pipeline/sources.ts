import type { TopicKey } from '../src/types';

/* Keep in step with sources.md */

export interface FeedDef { name: string; url: string; outlet: string; topic: TopicKey }

export const NEWS_FEEDS: FeedDef[] = [
  { name: 'BBC top stories', url: 'https://feeds.bbci.co.uk/news/rss.xml', outlet: 'BBC', topic: 'world' },
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', outlet: 'BBC', topic: 'world' },
  { name: 'BBC UK', url: 'https://feeds.bbci.co.uk/news/uk/rss.xml', outlet: 'BBC', topic: 'world' },
  { name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', outlet: 'BBC', topic: 'money' },
  { name: 'BBC Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', outlet: 'BBC', topic: 'tech' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', outlet: 'The Verge', topic: 'tech' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', outlet: 'Ars Technica', topic: 'tech' },
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', outlet: 'TechCrunch', topic: 'ai' },
  { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/', outlet: 'MIT Technology Review', topic: 'ai' },
  { name: 'BBC Science & Environment', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', outlet: 'BBC', topic: 'space' },
  { name: 'NASA news', url: 'https://www.nasa.gov/news-release/feed/', outlet: 'NASA', topic: 'space' },
  { name: 'Space.com', url: 'https://www.space.com/feeds/all', outlet: 'Space.com', topic: 'space' },
  { name: 'Bank of England news', url: 'https://www.bankofengland.co.uk/rss/news', outlet: 'Bank of England', topic: 'money' },
];

export const GUARDIAN_SECTIONS: { section: string; topic: TopicKey }[] = [
  { section: 'world', topic: 'world' },
  { section: 'uk-news', topic: 'world' },
  { section: 'technology', topic: 'tech' },
  { section: 'science', topic: 'space' },
  { section: 'business', topic: 'money' },
];

export const UK_CITIES: Record<string, string> = {
  London: 'https://feeds.bbci.co.uk/news/england/london/rss.xml',
  Manchester: 'https://feeds.bbci.co.uk/news/england/manchester/rss.xml',
  Birmingham: 'https://feeds.bbci.co.uk/news/england/birmingham_and_black_country/rss.xml',
  Leeds: 'https://feeds.bbci.co.uk/news/england/leeds_and_west_yorkshire/rss.xml',
  Bristol: 'https://feeds.bbci.co.uk/news/england/bristol/rss.xml',
  Liverpool: 'https://feeds.bbci.co.uk/news/england/merseyside/rss.xml',
  Glasgow: 'https://feeds.bbci.co.uk/news/scotland/glasgow_and_west/rss.xml',
  Edinburgh: 'https://feeds.bbci.co.uk/news/scotland/edinburgh_east_and_fife/rss.xml',
  Cardiff: 'https://feeds.bbci.co.uk/news/wales/south_east_wales/rss.xml',
  Belfast: 'https://feeds.bbci.co.uk/news/northern_ireland/rss.xml',
};

const REGION = {
  usca: 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml',
  europe: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml',
  me: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml',
  asia: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml',
  aus: 'https://feeds.bbci.co.uk/news/world/australia/rss.xml',
};

/* World cities: the BBC regional feed filtered to stories mentioning the place, plus a Guardian search */
export const WORLD_CITIES: Record<string, { feed: string; words: RegExp }> = {
  'New York': { feed: REGION.usca, words: /\bnew york\b|\bnyc\b|manhattan|brooklyn/i },
  Toronto: { feed: REGION.usca, words: /toronto|ontario|canada|canadian/i },
  Paris: { feed: REGION.europe, words: /paris|france|french/i },
  Dublin: { feed: REGION.europe, words: /dublin|ireland|irish/i },
  Berlin: { feed: REGION.europe, words: /berlin|germany|german/i },
  Dubai: { feed: REGION.me, words: /dubai|uae|emirat/i },
  Singapore: { feed: REGION.asia, words: /singapore/i },
  Sydney: { feed: REGION.aus, words: /sydney|new south wales|\bnsw\b/i },
};

/* Sport names match the onboarding choices */
export const SPORT_FEEDS: Record<string, string> = {
  Football: 'https://feeds.bbci.co.uk/sport/football/rss.xml',
  Rugby: 'https://feeds.bbci.co.uk/sport/rugby-union/rss.xml',
  Cricket: 'https://feeds.bbci.co.uk/sport/cricket/rss.xml',
  Tennis: 'https://feeds.bbci.co.uk/sport/tennis/rss.xml',
  'Formula 1': 'https://feeds.bbci.co.uk/sport/formula1/rss.xml',
  Golf: 'https://feeds.bbci.co.uk/sport/golf/rss.xml',
  'Boxing & MMA': 'https://feeds.bbci.co.uk/sport/boxing/rss.xml',
  Athletics: 'https://feeds.bbci.co.uk/sport/athletics/rss.xml',
  Cycling: 'https://feeds.bbci.co.uk/sport/cycling/rss.xml',
  NFL: 'https://feeds.bbci.co.uk/sport/american-football/rss.xml',
  Basketball: 'https://feeds.bbci.co.uk/sport/basketball/rss.xml',
};

/* Team names match the onboarding list. Teams typed in by hand fall back to filtering the football feed in the app. */
export const TEAM_SLUGS: Record<string, string> = {
  Arsenal: 'arsenal',
  'Aston Villa': 'aston-villa',
  Chelsea: 'chelsea',
  Everton: 'everton',
  Liverpool: 'liverpool',
  'Man City': 'manchester-city',
  'Man United': 'manchester-united',
  Newcastle: 'newcastle-united',
  Spurs: 'tottenham-hotspur',
  'West Ham': 'west-ham-united',
  Celtic: 'celtic',
  Rangers: 'rangers',
};
