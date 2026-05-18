/**
 * scripts/seed-exercises.ts
 *
 * Imports ~800 exercises from yuhonas/free-exercise-db into Supabase.
 *
 * Run from the project root:
 *   npx tsx scripts/seed-exercises.ts
 *
 * Requires .env.local to have NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set.
 */

import { createClient } from '@supabase/supabase-js';
import * as https from 'https';
// Env vars are loaded via --env-file=.env.local (Node 20+)

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Source data ────────────────────────────────────────────
const EXERCISES_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

// Base URL for exercise images (hosted on GitHub via jsDelivr CDN — no CORS issues)
const IMAGE_BASE =
  'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises';

// ── Type for raw data ──────────────────────────────────────
interface RawExercise {
  id:               string;
  name:             string;
  force:            string | null;
  level:            string;       // beginner | intermediate | expert
  mechanic:         string | null;
  equipment:        string | null;
  primaryMuscles:   string[];
  secondaryMuscles: string[];
  instructions:     string[];
  category:         string;       // strength | stretching | cardio | olympic weightlifting | powerlifting | strongman | plyometrics
  images:           string[];
}

// ── Category mapping ───────────────────────────────────────
// brigid-pro enum: 'healing' | 'forging' | 'verse'
function mapCategory(raw: string): 'healing' | 'forging' | 'verse' {
  switch (raw.toLowerCase()) {
    case 'stretching': return 'healing';
    case 'cardio':     return 'verse';
    default:           return 'forging';  // strength, powerlifting, olympic, plyometrics, strongman
  }
}

// ── Fetch helper ───────────────────────────────────────────
function fetchJSON(url: string): Promise<RawExercise[]> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Follow redirects (GitHub raw redirects once)
      if (res.statusCode === 301 || res.statusCode === 302) {
        if (res.headers.location) return resolve(fetchJSON(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

// ── Main ───────────────────────────────────────────────────
async function main() {
  console.log('📥  Fetching exercises from GitHub…');
  const raw = await fetchJSON(EXERCISES_URL);
  console.log(`✅  Fetched ${raw.length} exercises`);

  // Check for existing seed to avoid duplicates
  const { count: existing } = await supabase
    .from('exercises')
    .select('*', { count: 'exact', head: true })
    .eq('is_custom', false)
    .is('created_by_pt_id', null);

  if ((existing ?? 0) > 50) {
    console.log(`⚠️   ${existing} public exercises already exist. Skipping seed to avoid duplicates.`);
    console.log('    Delete them first or run with --force to overwrite.');
    if (!process.argv.includes('--force')) process.exit(0);
  }

  // Map raw data → brigid-pro schema
  const rows = raw.map((ex) => {
    const category = mapCategory(ex.category);

    // Build tags: muscles + equipment + level + mechanic
    const tags = [
      ...ex.primaryMuscles.map(m => m.toLowerCase().replace(/\s+/g, '-')),
      ...ex.secondaryMuscles.map(m => m.toLowerCase().replace(/\s+/g, '-')),
      ex.equipment ? ex.equipment.toLowerCase().replace(/\s+/g, '-') : null,
      ex.level,
      ex.mechanic ? ex.mechanic.toLowerCase() : null,
      ex.force   ? ex.force.toLowerCase()     : null,
      ex.category.toLowerCase().replace(/\s+/g, '-'),
    ].filter(Boolean) as string[];

    // Deduplicate tags
    const uniqueTags = [...new Set(tags)];

    // Use first image as default_video_url (these are JPGs, not videos, but
    // good enough as a thumbnail placeholder until you add real media)
    const imageUrl = ex.images.length > 0
      ? `${IMAGE_BASE}/${ex.images[0]}`
      : null;

    // Join instructions into coaching cues
    const coachingCues = ex.instructions.length > 0
      ? ex.instructions.join('\n\n')
      : null;

    return {
      name:              ex.name,
      description:       `${ex.category} — ${ex.level}${ex.mechanic ? ` — ${ex.mechanic}` : ''}`,
      category,
      default_video_url: imageUrl,
      coaching_cues:     coachingCues,
      tags:              uniqueTags,
      is_custom:         false,
      created_by_pt_id:  null,
    };
  });

  // Insert in batches of 100
  const BATCH = 100;
  let inserted = 0;

  console.log(`\n⬆️   Inserting ${rows.length} exercises in batches of ${BATCH}…\n`);

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('exercises').insert(batch);

    if (error) {
      console.error(`❌  Batch ${Math.floor(i / BATCH) + 1} failed:`, error.message);
      process.exit(1);
    }

    inserted += batch.length;
    const pct = Math.round((inserted / rows.length) * 100);
    process.stdout.write(`\r   ${inserted}/${rows.length} (${pct}%)`);
  }

  console.log('\n\n🎉  Done! Exercise library seeded.\n');

  // Quick summary by category
  const summary = rows.reduce(
    (acc, r) => { acc[r.category] = (acc[r.category] ?? 0) + 1; return acc; },
    {} as Record<string, number>
  );
  console.log('  📊  Breakdown:');
  console.log(`       🟢 Healing  (stretching):   ${summary.healing  ?? 0}`);
  console.log(`       🟡 Forging  (strength etc): ${summary.forging  ?? 0}`);
  console.log(`       🔵 Verse    (cardio):        ${summary.verse    ?? 0}`);
}

main().catch(err => {
  console.error('\n❌  Seed failed:', err);
  process.exit(1);
});
