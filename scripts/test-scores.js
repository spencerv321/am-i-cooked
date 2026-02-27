import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-20250514';

// Import the actual prompt from the server to keep tests in sync
// (Duplicated here since server/api.js uses export function, not the prompt directly)
const SYSTEM_PROMPT = `You are an AI job disruption analyst. Given a job title, you assess how vulnerable that role is to AI automation based on current and near-future AI capabilities (as of early 2026).

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

CRITICAL SCORING RULES:
1. Use the FULL 0-100 range. Some jobs genuinely deserve 5, 12, 93, or 97. Don't cluster similar-seeming jobs at the same score.
2. Be precise: a therapist (AI therapy chatbots exist but trust/rapport is irreplaceable) is different from a dentist (AI diagnostics help but hands-on oral work is untouchable) is different from a construction worker (fully physical, zero AI overlap). These should NOT get the same score — think about what percentage of each role's daily tasks involve data, text, analysis, or pattern recognition (AI-vulnerable) vs. physical presence, human judgment, or creative originality (AI-resistant).
3. Avoid round numbers and repeated scores. 42 is better than 40. 73 is better than 75. Think carefully about the exact number.
4. Consider the SPECIFIC task mix for THIS role. What percentage of the day is spent on AI-automatable work (data processing, writing, analysis, scheduling) vs. AI-resistant work (physical tasks, emotional intelligence, novel problem-solving, in-person interaction)?

Be honest and data-driven but lean slightly dramatic for entertainment value. Reference specific AI tools and capabilities where relevant (Claude, GPT, Copilot, Midjourney, etc.). Be specific to the actual job, not generic platitudes.`;

const JOBS = [
  'Data Entry Clerk',
  'Telemarketer',
  'Cashier',
  'Truck Driver',
  'Radiologist',
  'Software Engineer',
  'Accountant',
  'Lawyer',
  'Teacher',
  'Nurse',
  'Plumber',
  'Electrician',
  'Chef',
  'Therapist',
  'Journalist',
  'Graphic Designer',
  'Real Estate Agent',
  'Dentist',
  'Construction Worker',
  'Social Media Manager',
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function analyzeJob(jobTitle) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Job title: ${jobTitle}` }],
  });

  let text = message.content[0].text;
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  const data = JSON.parse(text);
  return data;
}

async function main() {
  const results = [];

  console.log('=== Am I Cooked - Score Distribution Test ===\n');
  console.log(`Model: ${MODEL}`);
  console.log(`Jobs to test: ${JOBS.length}\n`);

  for (let i = 0; i < JOBS.length; i++) {
    const job = JOBS[i];
    process.stdout.write(`[${i + 1}/${JOBS.length}] ${job}... `);
    try {
      const data = await analyzeJob(job);
      console.log(`score=${data.score} (${data.status})`);
      results.push({ job, score: data.score, status: data.status });
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      results.push({ job, score: null, status: 'ERROR' });
    }
    if (i < JOBS.length - 1) {
      await sleep(1000);
    }
  }

  // Sort by score descending
  const valid = results.filter(r => r.score !== null);
  valid.sort((a, b) => b.score - a.score);

  console.log('\n========================================');
  console.log('  RESULTS (sorted by score, high to low)');
  console.log('========================================\n');

  for (const r of valid) {
    const bar = '#'.repeat(Math.round(r.score / 2));
    console.log(`  ${String(r.score).padStart(3)}  ${r.status.padEnd(14)} ${r.job.padEnd(22)} ${bar}`);
  }

  // Statistics
  const scores = valid.map(r => r.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];

  // Buckets
  const buckets = {
    '0-19 (Raw)':        scores.filter(s => s >= 0 && s <= 19).length,
    '20-39 (Med Rare)':  scores.filter(s => s >= 20 && s <= 39).length,
    '40-69 (Medium)':    scores.filter(s => s >= 40 && s <= 69).length,
    '70-89 (Well Done)': scores.filter(s => s >= 70 && s <= 89).length,
    '90-100 (Cooked)':   scores.filter(s => s >= 90 && s <= 100).length,
  };

  console.log('\n========================================');
  console.log('  STATISTICS');
  console.log('========================================\n');
  console.log(`  Min:     ${min}`);
  console.log(`  Max:     ${max}`);
  console.log(`  Average: ${avg.toFixed(1)}`);
  console.log(`  Median:  ${median}`);
  console.log(`  Range:   ${max - min}`);

  console.log('\n  Score Distribution:');
  for (const [bucket, count] of Object.entries(buckets)) {
    const pct = ((count / scores.length) * 100).toFixed(0);
    const bar = '█'.repeat(count);
    console.log(`    ${bucket.padEnd(22)} ${String(count).padStart(2)} (${pct.padStart(2)}%)  ${bar}`);
  }

  // Check clustering
  const midRange = scores.filter(s => s >= 25 && s <= 75).length;
  const midPct = ((midRange / scores.length) * 100).toFixed(0);
  console.log(`\n  Jobs scoring 25-75:  ${midRange}/${scores.length} (${midPct}%)`);
  if (parseInt(midPct) > 70) {
    console.log('  ⚠️  WARNING: Scores are heavily clustered in the 25-75 range!');
  } else {
    console.log('  ✅  Good spread — scores are not overly clustered.');
  }

  // Errors
  const errors = results.filter(r => r.score === null);
  if (errors.length > 0) {
    console.log(`\n  Errors: ${errors.length} jobs failed`);
    errors.forEach(e => console.log(`    - ${e.job}`));
  }

  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
