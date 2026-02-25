# Am I Cooked? — Product Requirements Document

## Overview

"Am I Cooked?" is a viral, consumer-facing web app that lets anyone type in their job title and instantly get an AI-generated "disruption score" — a dramatic, shareable assessment of how likely AI is to automate their role. The output should be visually punchy, screenshot-friendly, and designed to be shared on Twitter/X.

This is a **build-in-public portfolio piece**, not a business. The goal is virality, engagement, and demonstrating cutting-edge AI capabilities. Every design decision should optimize for **"will someone screenshot this and tweet it?"**

---

## Build Phases

### V1 — Ship It (Target: One Session)
Core experience. Job title in, disruption score out. No bells and whistles. Goal: get it live, get screenshots, get tweets.

### V1.5 — Richer Input (Target: Same Weekend)
Add optional "Advanced Mode" expandable section below the main input with:
- **Years of experience** (dropdown: 0-2, 3-5, 6-10, 10-15, 15+)
- **Education level** (dropdown: High School, Associate's, Bachelor's, Master's, PhD, Bootcamp/Self-Taught)
- **Day-to-day description** (free text, 280 char max): "What do you actually do all day?" — this is the killer input because it lets Claude assess the *actual tasks* rather than just the title

These fields are optional. If provided, they get appended to the Claude prompt for much richer, more personalized analysis. Zero additional infrastructure — just a slightly longer prompt.

### V2 — LinkedIn Integration (Only If V1 Gets Traction)
Let users upload their **LinkedIn PDF export** (LinkedIn → Settings → Get a copy of your data → download profile PDF). This gives you their full work history, skills, education, and summary without any scraping or third-party APIs. Legal, free, and comprehensive.

The app parses the PDF client-side (using pdf.js), extracts the text, and feeds it to Claude for a deeply personalized disruption analysis. This is the premium experience — the results would be *so specific* to the individual that they'd be irresistible to share.

**Why LinkedIn PDF export over scraping:** LinkedIn aggressively blocks scrapers and sends cease-and-desist letters. Third-party scraping APIs (Proxycurl, PhantomBuster) cost money per lookup. The PDF export is the clean, legal, free path that gives you the same data.

---

## V1 Core User Flow (Build This First)

1. User lands on a single-page app with a bold headline and a single input field
2. User types their job title (e.g., "Senior Financial Analyst", "Dental Hygienist", "Junior Frontend Developer", "Paralegal")
3. App sends the job title to Claude via the Anthropic API
4. Claude analyzes the role against known AI capabilities and returns structured data
5. App renders a dramatic, shareable "disruption report card" with:
   - A big, impossible-to-miss score (0–100)
   - A status label (e.g., "Fully Cooked", "Medium Rare", "Raw — You're Safe... For Now")
   - A timeline estimate (e.g., "~18 months before significant disruption")
   - A breakdown of which parts of the job are most/least vulnerable
   - A one-liner AI-generated hot take (e.g., "Your boss is already Googling 'Claude for financial modeling'")
6. User screenshots the result and shares it on Twitter

---

## Tech Stack

- **Frontend**: Single-page React app (Next.js or Vite — builder's choice)
- **Styling**: Tailwind CSS
- **AI Backend**: Anthropic Claude API (claude-sonnet-4-20250514 for speed + cost efficiency on this use case)
- **Hosting**: Vercel (free tier is fine for launch)
- **No database needed** — stateless, each query is independent
- **No auth needed** — fully public, no accounts

---

## API Integration: Claude Prompt Design

### System Prompt for Claude

```
You are an AI job disruption analyst. Given a job title, you assess how vulnerable that role is to AI automation based on current and near-future AI capabilities (as of early 2026).

You must respond ONLY with valid JSON matching this exact schema:

{
  "score": <number 0-100>,
  "status": "<string: one of 'Fully Cooked', 'Well Done', 'Medium', 'Medium Rare', 'Raw'>",
  "status_emoji": "<single emoji matching the status>",
  "timeline": "<string: estimated time until significant disruption, e.g. '6-12 months', '2-3 years', '5+ years'>",
  "hot_take": "<string: one punchy, slightly irreverent sentence about this role's AI future. Be specific to the role, not generic. Make it quotable and funny.>",
  "vulnerable_tasks": [
    {"task": "<specific task AI can already do or will soon>", "risk": "<high/medium/low>"}
  ],
  "safe_tasks": [
    {"task": "<specific task that remains hard for AI>", "reason": "<brief why>"}
  ],
  "tldr": "<2-3 sentence summary of the overall outlook for this role>"
}

Scoring guidelines:
- 90-100: "Fully Cooked" — AI can already do most of this job today (e.g., basic data entry, simple translation, boilerplate legal docs)
- 70-89: "Well Done" — Major disruption within 1-2 years, significant parts already automatable
- 40-69: "Medium" — Mixed picture, some tasks automated but core judgment/creativity/physical skills remain
- 20-39: "Medium Rare" — Mostly safe for now, but AI is nibbling at the edges
- 0-19: "Raw" — Physical, deeply human, or highly creative work that AI can't touch yet

Be honest and data-driven but lean slightly dramatic for entertainment value. Reference specific AI tools and capabilities where relevant (Claude, GPT, Copilot, Midjourney, etc.). Be specific to the actual job, not generic platitudes.
```

### User Message
```
Job title: {user_input}
```

### V1.5 Enhanced User Message (when optional fields are provided)
```
Job title: {user_input}
Years of experience: {years_experience}
Education: {education_level}
Day-to-day responsibilities: {daily_description}

Use these additional details to make your analysis much more specific and personalized. A junior analyst with 1 year of experience is far more vulnerable than a senior analyst with 15 years of client relationships. Factor in the specific tasks they describe, not just the generic job title.
```

---

## UI/UX Design Direction

### Aesthetic: "Doom Scroll Meets Bloomberg Terminal"

Think: dramatic data visualization meets internet humor. The vibe should feel like a mix of a credit score app and a meme generator. **Not** corporate. **Not** generic SaaS. This should feel like something a tech-savvy person built in a weekend because they thought it was funny.

### Color Palette
- **Background**: Deep dark (near-black, like #0a0a0a)
- **Primary accent**: Hot red/orange for danger, electric green for safe
- **Score display**: Giant, glowing number — like a threat level indicator
- **Text**: Clean white/light gray, monospace for the "data" feel
- **Cards/containers**: Subtle dark cards with thin borders, slight glow effects

### Typography
- **Score number**: Massive, bold, potentially with a glow or pulse animation
- **Headlines**: Bold, condensed, uppercase sans-serif (think impact/urgency)
- **Body text**: Clean monospace or technical sans-serif
- **Hot take**: Slightly different styling — italic or highlighted to stand out as the quotable moment

### Layout (Single Page)

```
┌─────────────────────────────────────────────┐
│                                             │
│         🍳 AM I COOKED?                     │
│   Find out if AI is coming for your job     │
│                                             │
│   ┌───────────────────────────────────┐     │
│   │  Enter your job title...          │     │
│   └───────────────────────────────────┘     │
│              [ Find Out → ]                 │
│                                             │
└─────────────────────────────────────────────┘

         ↓ (after submission, smooth reveal)

┌─────────────────────────────────────────────┐
│                                             │
│              YOUR SCORE                     │
│                                             │
│               🔥 78 🔥                      │
│            ██████████░░░                    │
│            WELL DONE                        │
│                                             │
│   "Your boss is already asking ChatGPT     │
│    to write the job posting for your        │
│    replacement."                            │
│                                             │
│   ⏱ Timeline: 12-18 months                 │
│                                             │
│   ┌─── WHAT'S AT RISK ──────────────┐      │
│   │ ● Financial modeling    🔴 HIGH  │      │
│   │ ● Report generation     🔴 HIGH  │      │
│   │ ● Data analysis         🟡 MED   │      │
│   └──────────────────────────────────┘      │
│                                             │
│   ┌─── WHAT'S SAFE (FOR NOW) ───────┐      │
│   │ ● Client relationships          │      │
│   │ ● Strategic judgment             │      │
│   │ ● Stakeholder management         │      │
│   └──────────────────────────────────┘      │
│                                             │
│   📋 TL;DR                                  │
│   Financial analysts face significant...    │
│                                             │
│   ┌──────────┐  ┌──────────────────┐       │
│   │ Try Again │  │ Share on 𝕏      │       │
│   └──────────┘  └──────────────────┘       │
│                                             │
│        Built by @spencerYOURHANDLE          │
│        Powered by Claude · Feb 2026         │
│                                             │
└─────────────────────────────────────────────┘
```

### Key UI Details

- **Score animation**: When the result loads, the score should count up from 0 to the final number (like a slot machine / credit score reveal). This is the *money moment* for screenshots and screen recordings.
- **Score color**: Gradient from green (0) → yellow (50) → red (100)
- **Loading state**: While waiting for Claude's response, show something fun — a cooking animation, a "scanning job market..." progress bar, rotating AI-related quips
- **Share button**: Pre-populate a tweet like: "Am I Cooked? My job as a [title] scored [score]/100 🔥 Check yours: [url]" — include Open Graph meta tags so the link preview looks good
- **Mobile-first**: This WILL be shared on Twitter, which means most people will view it on mobile. The result card must look great at 375px width.
- **Screenshot-optimized**: The result card should be visually self-contained — if someone screenshots just the score area, it should still make sense and look good with no surrounding context needed.

### Interactions
- Press Enter or click button to submit
- Smooth scroll/reveal animation for results
- "Try Again" resets to input (no page reload)
- Share button copies pre-written tweet text to clipboard and/or opens Twitter intent URL

---

## Open Graph / Social Meta Tags

Critical for link previews when shared on Twitter:

```html
<meta property="og:title" content="Am I Cooked? — AI Job Disruption Score" />
<meta property="og:description" content="Find out if AI is coming for your job. Type your title, get your score." />
<meta property="og:image" content="[static preview image — design a good one]" />
<meta name="twitter:card" content="summary_large_image" />
```

---

## Edge Cases to Handle

- **Empty input**: Disable button, show placeholder text
- **Nonsense input** (e.g., "asdfasdf"): Claude should still return a fun response — "We couldn't find this job in any database, which might mean you're either very safe or very confused"
- **Very long input**: Truncate to 100 characters
- **Offensive input**: Claude's built-in safety will handle this, but add a simple client-side filter for obvious slurs
- **API rate limiting**: Show a friendly "too many cooks in the kitchen" message
- **API errors**: Generic "something went wrong, try again" with retry button

---

## Performance Requirements

- **Time to first paint**: < 1 second (it's a single page)
- **API response time**: Claude Sonnet should respond in 2-5 seconds — the loading animation covers this
- **Total bundle size**: Keep it small, no heavy dependencies beyond React + Tailwind

---

## Launch / Virality Checklist

- [ ] Build the app
- [ ] Deploy to Vercel
- [ ] Create a compelling OG image for link previews
- [ ] Test on mobile (iPhone Safari, Android Chrome)
- [ ] Test the share button / tweet intent
- [ ] Take screenshots of interesting job titles for launch thread
- [ ] Write a Twitter thread: "I built a tool that tells you if AI is coming for your job. I asked it about 20 different roles. Some of these results are brutal. 🧵"
- [ ] Pre-generate 10-15 interesting results to screenshot for the thread (mix of high scores, low scores, and surprising ones)
- [ ] Post, engage with replies, quote-tweet interesting results

---

## Future Ideas (V3+, Only If It Really Takes Off)

- **Leaderboard**: "Most Cooked Jobs" / "Least Cooked Jobs" based on aggregate scores
- **Compare mode**: Enter two job titles side by side
- **Historical tracking**: "Your job was 45/100 last month, now it's 62/100 after [new AI release]"
- **Industry view**: See average scores by industry
- **Embed widget**: Let people embed their score card on their personal site

---

## Cost Estimate

- **Claude API**: Sonnet at ~$3/M input tokens, ~$15/M output tokens. Each query is ~500 input tokens, ~500 output tokens. So roughly $0.01 per query. 10,000 queries = ~$100. Very manageable for a viral launch.
- **Vercel**: Free tier handles significant traffic
- **Domain**: ~$12/year for something like amicooked.ai or amicooked.dev

---

## Summary

Ship V1 as a **single-session build** — job title in, score out, screenshot, tweet. Get it live fast. Then layer on the advanced inputs (V1.5) the same weekend, and only tackle the LinkedIn PDF integration (V2) if the thing actually gets traction. The hard part isn't the code — it's the design polish, the prompt engineering for consistently entertaining results, and the launch strategy. Optimize for screenshot-ability and shareability above all else.

**For Claude Code: Start with V1 only. Build the complete app as described in the "V1 Core User Flow" section. Ignore V1.5 and V2 for now — those will be separate follow-up sessions.**
