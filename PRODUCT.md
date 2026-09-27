# Knowfeed: product vision and decisions

This document explains why Knowfeed works the way it does. `CLAUDE.md` explains how to build it. When the two seem to disagree, ask Jasper.

## The idea in one line

A personal newspaper and learning app that ends. It gives you the news you care about and teaches you things you actually want to learn (your job, a language, your interests) in an Instagram-style swipe format, without the endless scroll.

## Who it's for

- People who want to replace mindless scrolling with something useful, without giving up the swipe habit.
- Working adults who want to get better at their job and keep up with their industry.
- People learning a language.
- People who want to stay informed without doomscrolling.

## Principles (these win arguments)

1. **It ends.** News comes in editions that finish. When you're up to date, the app says so. Learning continues only when you choose it.
2. **Everything is real.** No placeholder, sample or invented content. Every fact has a source, and news always links to the original.
3. **Informative, not influencers.** Words, facts, stories and ideas. No influencer videos and no engagement bait.
4. **Personal from minute one.** Your job, your interests, your languages, your city. We never force people into a short list of options.
5. **Serious and light, balanced.** Work learning and important news, broken up with sport, culture and fun facts, like a good newspaper.
6. **Respect people's time and attention.** No infinite feed, no autoplay video, no notifications during work hours, and clear "you're done" moments.
7. **Looks professional.** Every card has a strong image, clean typography and consistent design. It should look like a premium publication, not a hobby project.

## How a day works: the edition model

- **Three editions a day:** Morning (default 07:00), Midday (default 12:30) and Evening (default 18:00). Users can change the times or turn editions off.
- **Each edition is a finite set:**
  - the most important and most relevant stories since the last edition
  - a sports page
  - learning cards woven through the stories
- **Catch-up if you've been away:** if you first open the app in the afternoon, you get the Morning and Midday editions merged and ranked, with a "While you were away" header. Duplicates are removed, and the most important stories rise to the top.
- **Nothing is lost:** anything below the cut stays reachable in "Earlier today" at the end.
- **Big breaking stories** that match your interests can appear at the top between editions as "Just in".

## When the news runs out, learning takes over

- **When you finish an edition:** the "You're up to date" screen shows when the next edition arrives.
- **Then it offers learning, never more news:**
  - continue your Series (today's episode)
  - a 5-minute language lesson
  - a quick review quiz of things you've learned
  - explore your library
- **Learning sessions are finite too:** each lesson or episode ends. You can start another, but nothing autoplays.
- **No hard daily limit by default.** People who want to use Knowfeed as their main source of news and learning can do that, because the content is structured, not infinite.
- **Optional wellbeing tools:**
  - a daily reading goal
  - an optional daily limit set by the user
  - a gentle check-in after 45 minutes of continuous use: "You've been reading for a while. Keep going or take a break?"
  - a weekly summary of time spent and things learned

## Notifications

- **Default:** one notification per edition, only if there's something new. Maximum three a day.
- **Quiet during work hours by default** (09:00 to 12:00 and 13:30 to 17:30, Monday to Friday). Lunchtime is fine.
- **Users can change or turn off** any of it.
- **Tone:** helpful, never guilt-tripping. For example: "Your midday edition: 9 stories, 6 minutes." Never "You're losing your streak!"

## What gets priority

Each story's score is a mix of:

| Factor | What it means | Starting weight |
|---|---|---|
| Relevance | How well it matches the person's interests, job and followed stories | 35% |
| Importance | How many outlets are covering it and how quickly coverage is growing | 25% |
| Freshness | Newer is better, fading over about 12 hours | 15% |
| Personal ties | City, followed teams, followed stories | 15% |
| Variety | Topics the person hasn't seen yet today | 10% |

Rules on top of the score:
- **No same topic twice in a row.**
- **Editions stay balanced:** roughly 50 to 60% news, 30 to 40% learning, and about 10% light and fun.
- **Sport stays compact:** one "Sports page" card per edition with results, fixtures and one or two headlines, like a newspaper sports page. A live match banner appears only while your team is playing.
- **A few "most important" stories everyone sees:** the top 2 or 3 stories of the day by importance, even outside someone's interests, so nobody misses something big.
- **These weights are a starting point.** Tune them during the beta using what people open, finish, like and save.

## Learning for every job

- **Free-text job title:** people type their job title in their own words. We match it to the closest of about 3,000 occupations in ESCO (the EU's free occupations and skills database), then show the top 3 matches plus "something else".
- **Each occupation comes with its skills and knowledge areas.** These become:
  - **Skill of the day:** learning cards built from the official skill description plus related Wikipedia content.
  - **Industry news:** stories matched to that field.
  - **Series:** multi-part mini-courses. We start with the most common job families and add more over time, all reviewed before release.
- **People can add skills** they want to learn that aren't part of their current job, like "data analysis" or "public speaking".

## Interests

- A starter set of about 60 interests across news, culture, science, hobbies, sport and lifestyle.
- A search box where people type anything, like "Formula 1", "rewilding" or "Ancient Rome". We search the Guardian's tags and Wikipedia to find a match.
- Every interest can be followed for news, for learning, or both.

## Languages

- Around 25 popular languages at launch (see `CLAUDE.md`), plus British Sign Language.
- Onboarding asks the person's level and why they're learning (travel, family, work, fun), and lessons adapt to it.
- Lessons use short scenario Series (for example "Family dinner, part 1 of 6"), a phrase of the day, and spaced review.
- 100+ phrases per language to start, each marked checked or "Not yet checked" by a native speaker.

## Series: the Imprint-style part

A Series is a short story or lesson told in 5 to 8 swipeable cards, taking about 2 to 5 minutes per episode. It's used for:
- **Work skills**, for example "Data governance in 7 days".
- **Language scenarios.**
- **Big ideas and history**, from reliable sources.
- **Classic books** that are out of copyright, for example Meditations, The Art of War and On the Origin of Species.

Modern books are recommended per topic with cover, description and where to get them, but not summarised until we can license summaries.

## Images and look

Order of preference for every card:
1. The article's own image.
2. A free-licence image of the main subject from Wikimedia Commons.
3. A high-quality free stock photo (Unsplash or Pexels) matched to the topic.
4. A designed cover in the Knowfeed style for that topic.

Every image is cropped well, credited, and never low resolution. It should look like a premium magazine.

## Business model ideas (for after the beta)

- **Free tier:** one edition a day, limited learning.
- **Subscription:** all editions, all Series, all languages, Listen mode.
- **Loyalty pricing: the longer you stay, the cheaper it gets.** For example:
  - full price in year 1
  - 15% off in year 2
  - 25% off from year 3 onwards
- **A useful fact:** Apple and Google take a smaller commission on subscriptions after a subscriber's first year (Apple drops from 30% to 15%). That naturally helps fund loyalty discounts.
- **"Paying back" instead of discounting:**
  - It's possible if people pay us directly on the web (for example with Stripe), as a yearly loyalty credit or refund.
  - It isn't really possible through the App Store, where Apple handles billing and refunds.
  - A simple lower price is easier to understand, so test both ideas with beta users before deciding.
- **Teams:** a team version where companies pay for their staff to learn their industry. Worth exploring, because businesses pay more readily than individuals.

## The beta

- **Size:** 20 to 50 testers, free, installed as a home-screen web app from a link.
- **Accounts:** email magic link and Google sign-in. Sign in with Apple needs a paid Apple developer account, so it's added later.
- **What we measure:**
  - how many testers come back after 1, 7 and 30 days
  - editions opened per day and the share finished
  - Series episodes completed
  - language lessons done
  - likes and saves
  - what people skip
- **Talking to testers:** a short feedback button in the app, plus a 15-minute chat with 5 to 10 testers after two weeks.
- **What would count as success:**
  - a good share of testers still opening it most days after a month
  - testers saying they'd miss it if it disappeared

## What the research says about scrolling

- Heavy short-form video use (TikTok, Reels, Shorts) is associated with poorer attention and impulse control.
- Most studies are snapshots, so they show a link, not proof that scrolling causes the harm.
- Fast switching between videos is one of the suspected causes.
- Knowfeed deliberately avoids the risky patterns: no video autoplay, no infinite feed, and a slower pace with reading and depth.
- Knowfeed should be positioned as a replacement for doomscrolling during dead time (commute, queues, lunch), not another thing to check during focused work.
