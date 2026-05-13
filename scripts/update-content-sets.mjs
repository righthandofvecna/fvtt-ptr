/**
 * Batch updates packs/_source/ JSON files to:
 *  - Strip content set suffixes from `name` (e.g. "[CR]", "[F&S Playtest]", "[WP]")
 *  - Set `system.contentSet` based on the detected suffix
 *  - Compute and write `system.slug` (base slug + short suffix) if not already correctly set
 *  - Strip suffixes from `system.class` on Feat items
 *
 * Run with: node scripts/update-content-sets.mjs
 * Dry run:  node scripts/update-content-sets.mjs --dry-run
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PACK_SRC = "packs/_source";
const DRY_RUN = process.argv.includes("--dry-run");

if (DRY_RUN) console.log("DRY RUN — no files will be written.\n");

// ---------------------------------------------------------------------------
// Suffix definitions (most-specific first to avoid partial matches)
// ---------------------------------------------------------------------------
const SUFFIX_MAP = [
  { pattern: /\s*\[F&S Playtest\]\s*$/i, contentSet: "friendship-spirit", slug: "-fs" },
  { pattern: /\s*\[F&S\]\s*$/i, contentSet: "friendship-spirit", slug: "-fs" },
  { pattern: /\s*\[Weather Playtest\]\s*$/i, contentSet: "weather-playtest", slug: "-wp" },
  { pattern: /\s*\[WP\]\s*$/i, contentSet: "weather-playtest", slug: "-wp" },
  { pattern: /\s*\[Class Rework\]\s*$/i, contentSet: "class-rework", slug: "-cr" },
  { pattern: /\s*\[CR\]\s*$/i, contentSet: "class-rework", slug: "-cr" },
];

/**
 * @param {string} str
 * @returns {{ clean: string, contentSet: string, slugSuffix: string }}
 */
function detectSuffix(str) {
  if (!str) return null;
  for (const { pattern, contentSet, slug } of SUFFIX_MAP) {
    if (pattern.test(str)) {
      return { clean: str.replace(pattern, "").trim(), contentSet, slugSuffix: slug };
    }
  }
  return { clean: str.trim(), contentSet: "", slugSuffix: "" };
}

/**
 * Slugifies a string following the same algorithm as the system's `sluggify()`.
 * @param {string} text
 */
function slugify(text) {
  if (!text) return "";
  const lowerCaseThenUpperCaseRE = /([a-z])([A-Z])/g;
  const nonWordCharacterRE = /[^a-z0-9-]+/gi;
  const startsNegativeNumber = text.trim().match(/^-\d/) !== null;
  return (startsNegativeNumber ? "-" : "") + text
    .replace(lowerCaseThenUpperCaseRE, "$1-$2")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(nonWordCharacterRE, " ")
    .trim()
    .replace(/[-\s]+/g, "-");
}

// ---------------------------------------------------------------------------
// Walk directories
// ---------------------------------------------------------------------------
async function* walkDir(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(full);
    } else if (entry.name.endsWith(".json") && entry.name !== "_folder.json") {
      yield full;
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
let updated = 0;
let skipped = 0;

for await (const filePath of walkDir(PACK_SRC)) {
  let raw;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    console.error(`Could not read ${filePath}`);
    continue;
  }

  let doc;
  try {
    doc = JSON.parse(raw);
  } catch {
    console.error(`Invalid JSON in ${filePath}`);
    continue;
  }

  if (!doc.name || !doc.system) {
    skipped++;
    continue;
  }

  // Only process item documents that have a system object with base template fields
  // (skip Actor, Journal, RollTable etc.)
  if (!("slug" in doc.system) && !("keywords" in doc.system) && !("effect" in doc.system)) {
    skipped++;
    continue;
  }

  const { clean: cleanName, contentSet, slugSuffix } = detectSuffix(doc.name);
  const originalSlug = slugify(cleanName);
  const expectedSlug = originalSlug + slugSuffix;

  let changed = false;

  // Strip suffix from name
  if (doc.name !== cleanName) {
    doc.name = cleanName;
    changed = true;
  }

  // Set contentSet
  if (doc.system.contentSet !== contentSet) {
    doc.system.contentSet = contentSet;
    changed = true;
  }

  if (originalSlug !== expectedSlug) {
    doc.system.replacesSlug ??= originalSlug;
  }

  // Ensure replacesSlug field exists (don't overwrite if already set)
  if (!("replacesSlug" in doc.system)) {
    doc.system.replacesSlug = "";
    changed = true;
  }
  // Ensure contentSet field exists (don't overwrite if already set, even if empty string)
  if (!("contentSet" in doc.system)) {
    doc.system.contentSet = "";
    changed = true;
  }

  // Set slug if it doesn't match the expected value
  if (doc.system.slug !== expectedSlug) {
    doc.system.slug = expectedSlug;
    changed = true;
  }

  // For Feats: strip suffix from system.class
  if (doc.type === "feat" && doc.system.class) {
    const classResult = detectSuffix(doc.system.class);
    if (classResult && doc.system.class !== classResult.clean) {
      doc.system.class = classResult.clean;
      changed = true;
    }
  }

  // Strip suffixes from prerequisites
  if (Array.isArray(doc.system.prerequisites)) {
    const cleaned = doc.system.prerequisites.map((p) => {
      if (typeof p !== "string") return p;
      const result = detectSuffix(p);
      return result ? result.clean : p;
    });
    if (cleaned.some((c, i) => c !== doc.system.prerequisites[i])) {
      doc.system.prerequisites = cleaned;
      changed = true;
    }
  }

  if (!changed) {
    skipped++;
    continue;
  }

  const output = `${JSON.stringify(doc, null, 2)}\n`;

  if (DRY_RUN) {
    console.log(`[DRY] Would update: ${filePath}`);
    console.log(`  name: "${cleanName}", contentSet: "${contentSet}", slug: "${expectedSlug}"`);
  } else {
    await writeFile(filePath, output, "utf8");
    console.log(`Updated: ${filePath}`);
  }
  updated++;
}

console.log(`\nDone. ${updated} file(s) updated, ${skipped} skipped.`);
