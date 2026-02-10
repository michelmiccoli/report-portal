import fs from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import slugify from 'slugify';

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, 'content', 'reports');
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUT_DIR = path.join(ROOT, 'src', 'generated');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function safeSlug(s) {
  return slugify(String(s), { lower: true, strict: true });
}

function normalizeText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function detectRiskLevel(title) {
  const t = title.toLowerCase();
  if (t.includes('high')) return 'high';
  if (t.includes('medium')) return 'medium';
  if (t.includes('low')) return 'low';
  if (t.includes('trigger')) return 'triggered';
  return 'other';
}

// Extract tables as structured "issues" (best effort)
function extractIssuesFromHtml(html) {
  const $ = cheerio.load(html);
  const issues = [];

  // Find headings and tables following them
  const headings = $('h1,h2,h3').toArray();

  for (const h of headings) {
    const headingText = normalizeText($(h).text());
    const riskLevel = detectRiskLevel(headingText);

    // Next siblings until next heading: collect tables
    let el = $(h).next();
    while (el.length && !el.is('h1,h2,h3')) {
      if (el.is('table')) {
        const rows = el.find('tr').toArray().map(tr =>
          $(tr).find('th,td').toArray().map(cell => normalizeText($(cell).text()))
        );

        if (rows.length >= 2) {
          const header = rows[0].map(x => x.toLowerCase());
          const findIdx = header.findIndex(x => x.includes('finding'));
          const recIdx = header.findIndex(x => x.includes('recommendation') || x.includes('action'));

          for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            const finding = findIdx >= 0 ? r[findIdx] : '';
            const recommendation = recIdx >= 0 ? r[recIdx] : '';
            if (finding || recommendation) {
              issues.push({
                id: `issue-${issues.length + 1}`,
                riskLevel,
                sectionTitle: headingText,
                finding,
                recommendation,
                raw: r
              });
            }
          }
        }
      }
      el = el.next();
    }
  }

  return issues;
}

async function convertDocxToHtml(absDocxPath) {
  const result = await mammoth.convertToHtml({ path: absDocxPath }, {
    styleMap: [
      // Make Word headings map to h2/h3 where possible
      "p[style-name='Heading 1'] => h2:fresh",
      "p[style-name='Heading 2'] => h3:fresh"
    ]
  });
  return {
    html: result.value,
    messages: result.messages || []
  };
}

async function main() {
  ensureDir(OUT_DIR);

  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json'));
  const index = [];

  for (const file of files) {
    const entryPath = path.join(CONTENT_DIR, file);
    const entry = readJson(entryPath);

    const slug = safeSlug(entry.slug);
    const version = safeSlug(entry.version);
    const title = entry.title || `${entry.slug} ${entry.version}`;

    const docxRel = entry.docx?.startsWith('/') ? entry.docx.slice(1) : entry.docx;
    const absDocx = path.join(PUBLIC_DIR, docxRel || '');

    if (!docxRel || !fs.existsSync(absDocx)) {
      console.warn(`[WARN] Missing DOCX for ${file}. Expected: ${absDocx}`);
      continue;
    }

    const { html, messages } = await convertDocxToHtml(absDocx);
    const issues = extractIssuesFromHtml(html);

    const outFolder = path.join(OUT_DIR, slug);
    ensureDir(outFolder);

    const outJson = {
      slug,
      version,
      title,
      date: entry.date,
      notes: entry.notes || '',
      docx: entry.docx,
      html,
      issues,
      conversionMessages: messages
    };

    fs.writeFileSync(path.join(outFolder, `${version}.json`), JSON.stringify(outJson, null, 2), 'utf8');

    index.push({
      slug,
      version,
      title,
      date: entry.date,
      url: `/reports/${slug}/${version}`,
      docx: entry.docx,
      issuesCount: issues.length,
      high: issues.filter(i => i.riskLevel === 'high').length,
      medium: issues.filter(i => i.riskLevel === 'medium').length,
      low: issues.filter(i => i.riskLevel === 'low').length,
      triggered: issues.filter(i => i.riskLevel === 'triggered').length
    });
  }

  // Sort newest first
  index.sort((a,b) => (b.date || '').localeCompare(a.date || ''));

  fs.writeFileSync(path.join(OUT_DIR, `index.json`), JSON.stringify(index, null, 2), 'utf8');
  console.log(`[OK] Generated ${index.length} report versions into src/generated/`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
