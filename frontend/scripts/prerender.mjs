// Build-time prerender for SEO landing + lesson pages (§18). Emits standalone,
// indexable static HTML (full content + meta + JSON-LD) into dist/ AFTER the Vite
// build, plus sitemap.xml + robots.txt. Vercel serves these files directly
// (filesystem-first, before the SPA rewrite); every CTA links into the SPA.
//
// Runs as a plain Node ESM script (no JSX/SSR) so the build stays dependency-free.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

// Canonical origin for <link rel=canonical>/OG/sitemap. Override at build time.
const SITE = (process.env.PUBLIC_WEB_ORIGIN || 'https://fluentkeys.com').replace(/\/$/, '')

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Full standalone HTML document for a marketing/lesson page. */
function page({ path, title, description, h1, intro, sections = [], jsonLd, related = [] }) {
  const url = `${SITE}/${path}`
  const sectionHtml = sections
    .map((s) => `<section><h2>${esc(s.heading)}</h2><p>${esc(s.body)}</p></section>`)
    .join('\n')
  const relatedHtml = related.length
    ? `<nav class="related"><h2>Keep learning</h2><ul>${related
        .map((r) => `<li><a href="/${r.path}">${esc(r.label)}</a></li>`)
        .join('')}</ul></nav>`
    : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${url}" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${url}" />
<meta name="twitter:card" content="summary" />
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  :root { color-scheme: dark }
  * { box-sizing: border-box }
  body { margin: 0; background: #18181b; color: #f4f4f5;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.6 }
  .wrap { max-width: 720px; margin: 0 auto; padding: 3rem 1.25rem 5rem }
  a { color: #34d399 }
  h1 { font-size: 2.2rem; margin: 0 0 .5rem }
  h2 { font-size: 1.3rem; margin: 2rem 0 .5rem }
  .lead { color: #a1a1aa; font-size: 1.1rem }
  .cta { display: inline-block; margin: 1.5rem 0; background: #34d399; color: #18181b;
    font-weight: 700; padding: .75rem 1.5rem; border-radius: .5rem; text-decoration: none }
  .related ul { padding-left: 1.1rem } .brand { font-weight: 800; color: #34d399; text-decoration: none }
  footer { margin-top: 3rem; color: #71717a; font-size: .85rem }
</style>
</head>
<body>
<div class="wrap">
  <p><a class="brand" href="/">FluentKeys</a></p>
  <h1>${esc(h1)}</h1>
  <p class="lead">${esc(intro)}</p>
  <a class="cta" href="/">Start the typing test →</a>
  ${sectionHtml}
  ${relatedHtml}
  <footer><a href="/">FluentKeys</a> — a free typing trainer that adapts to your weak keys.</footer>
</div>
</body>
</html>`
}

const PAGES = [
  {
    path: 'typing-test',
    title: 'Free Typing Test — Check Your WPM & Accuracy | FluentKeys',
    description:
      'Take a free typing test to measure your words per minute (WPM) and accuracy. No sign-up required — practice for 15, 30, or 60 seconds and see instant results.',
    h1: 'Free typing test — what’s your WPM?',
    intro:
      'Measure your typing speed and accuracy in seconds. Pick a duration, start typing, and get an instant WPM score with a per-key breakdown of your trouble spots.',
    sections: [
      {
        heading: 'How the typing test works',
        body: 'Type the words as they appear. We track every keystroke to compute your net WPM, raw WPM, and accuracy, then highlight the keys you miss most so you know what to practice.',
      },
      {
        heading: 'Why words per minute matters',
        body: 'WPM is the standard measure of typing speed. The average typist hits 40 WPM; touch typists reach 60–80; the fastest exceed 120. Regular practice with targeted feedback is the quickest way to improve.',
      },
    ],
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'FluentKeys Typing Test',
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
    related: [
      { path: 'learn', label: 'Learn to type' },
      { path: 'lessons/home-row', label: 'Home row lesson' },
    ],
  },
  {
    path: 'learn',
    title: 'Learn to Type — Free Touch Typing Lessons | FluentKeys',
    description:
      'Learn to touch type for free. A guided, adaptive trainer that unlocks the keyboard one row at a time and biases practice toward your weakest keys.',
    h1: 'Learn to type — the adaptive way',
    intro:
      'FluentKeys teaches touch typing by unlocking the keyboard gradually and focusing on the keys you struggle with most, so every minute of practice counts.',
    sections: [
      {
        heading: 'Start with the home row',
        body: 'Touch typing begins with the home row (ASDF JKL;). Keep your fingers there, learn the reach to each key, and build muscle memory before moving on.',
      },
      {
        heading: 'Practice your weak keys',
        body: 'The trainer measures the accuracy and speed of every letter and surfaces the weakest ones more often. You stop wasting time on keys you’ve already mastered.',
      },
    ],
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: 'Learn to Type with FluentKeys',
      description: 'Free adaptive touch-typing lessons.',
      provider: { '@type': 'Organization', name: 'FluentKeys' },
    },
    related: [
      { path: 'lessons/home-row', label: 'Home row lesson' },
      { path: 'lessons/top-row', label: 'Top row lesson' },
      { path: 'lessons/numbers', label: 'Numbers lesson' },
    ],
  },
  {
    path: 'lessons/home-row',
    title: 'Home Row Typing Lesson (ASDF JKL;) | FluentKeys',
    description:
      'Master the home row keys — ASDF for the left hand, JKL; for the right. The foundation of touch typing, with a free interactive drill.',
    h1: 'Home row lesson: ASDF JKL;',
    intro:
      'The home row is where your fingers rest and return to. Master it first and every other key becomes a short, predictable reach.',
    sections: [
      {
        heading: 'Finger placement',
        body: 'Left hand on A S D F, right hand on J K L semicolon. The small bumps on F and J let you find home without looking. Thumbs rest on the space bar.',
      },
    ],
    jsonLd: { '@context': 'https://schema.org', '@type': 'LearningResource', name: 'Home Row Lesson' },
    related: [{ path: 'lessons/top-row', label: 'Top row lesson' }],
  },
  {
    path: 'lessons/top-row',
    title: 'Top Row Typing Lesson (QWERTY) | FluentKeys',
    description:
      'Learn the top row — QWERTY UIOP — with correct finger reaches from the home row. Free interactive practice.',
    h1: 'Top row lesson: QWERTY UIOP',
    intro:
      'Once the home row is solid, the top row is the next step. Each finger reaches up one key and returns home.',
    sections: [
      {
        heading: 'Reaching up',
        body: 'Reach each finger straight up from its home key: the left index covers R and T, the right index covers Y and U, and so on. Return to home after every key.',
      },
    ],
    jsonLd: { '@context': 'https://schema.org', '@type': 'LearningResource', name: 'Top Row Lesson' },
    related: [{ path: 'lessons/numbers', label: 'Numbers lesson' }],
  },
  {
    path: 'lessons/numbers',
    title: 'Number Row Typing Lesson | FluentKeys',
    description:
      'Practice typing numbers fast and accurately with the number row. Free interactive drills for the 1234567890 keys.',
    h1: 'Numbers lesson: the number row',
    intro:
      'Numbers live on the top row above the letters. Accurate number typing is essential for data entry, coding, and spreadsheets.',
    sections: [
      {
        heading: 'Without looking',
        body: 'Reach from the top row up to the number row with the same finger. It feels long at first; with practice you’ll hit any digit without glancing down.',
      },
    ],
    jsonLd: { '@context': 'https://schema.org', '@type': 'LearningResource', name: 'Numbers Lesson' },
    related: [{ path: 'typing-test', label: 'Take the typing test' }],
  },
]

let written = 0
for (const p of PAGES) {
  const outDir = join(DIST, ...p.path.split('/'))
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'index.html'), page(p), 'utf8')
  written += 1
}

// sitemap.xml (marketing/lesson pages + app root).
const urls = ['', ...PAGES.map((p) => p.path)]
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}/${u}</loc></url>`).join('\n')}
</urlset>`
writeFileSync(join(DIST, 'sitemap.xml'), sitemap, 'utf8')

// robots.txt
writeFileSync(
  join(DIST, 'robots.txt'),
  `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`,
  'utf8',
)

console.log(`prerender: wrote ${written} pages + sitemap.xml + robots.txt to dist/`)
