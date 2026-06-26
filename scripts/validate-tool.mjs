import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// `client:visible` is applied to every tool island by ToolLayout.astro. Confirm
// once there that it is in use, instead of grepping each tool's index.ts (which
// never contains the directive). The AGENTS.md rule is enforced globally here.
const toolLayoutUsesClientVisible = (() => {
  try {
    return /client:visible/.test(
      readFileSync(resolve(root, 'src/layouts/ToolLayout.astro'), 'utf8'),
    );
  } catch {
    return false;
  }
})();

function readCategories() {
  const file = readFileSync(resolve(root, 'src/data/categories.ts'), 'utf8');
  const catSlugs = [...file.matchAll(/slug:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
  return new Set(catSlugs);
}

function readSubcategories(categorySlug) {
  const file = readFileSync(resolve(root, 'src/data/categories.ts'), 'utf8');
  // Find the top-level category object (2-space indent) by slug, then capture
  // its body up to the next top-level object or end of array.
  const catStart = file.indexOf(`slug: '${categorySlug}'`);
  if (catStart === -1) return new Set();
  // Find the subcategories array within this category block.
  const subStart = file.indexOf('subcategories:', catStart);
  // The category block ends at the next top-level "},\n  {" or end of file.
  const nextCat = file.indexOf('},\n  {', catStart);
  const blockEnd = nextCat === -1 ? file.length : nextCat;
  if (subStart === -1 || subStart > blockEnd) return new Set();
  const subBlock = file.slice(subStart, blockEnd);
  return new Set(
    [...subBlock.matchAll(/slug:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
  );
}

function findToolFiles() {
  const toolsDir = resolve(root, 'src/tools');
  const out = [];
  for (const cat of readdirSync(toolsDir, { withFileTypes: true })) {
    if (!cat.isDirectory()) continue;
    const catDir = resolve(toolsDir, cat.name);
    for (const tool of readdirSync(catDir, { withFileTypes: true })) {
      if (!tool.isDirectory() || tool.name.startsWith('_')) continue;
      const indexFile = resolve(catDir, tool.name, 'index.ts');
      try {
        out.push({ category: cat.name, id: tool.name, indexFile });
      } catch {
        // ignore
      }
    }
  }
  return out;
}

function readToolObject(indexFile) {
  const src = readFileSync(indexFile, 'utf8');
  const errors = [];

  const idMatch = src.match(/id:\s*['"]([^'"]+)['"]/);
  const nameMatch = src.match(/name:\s*['"]([^'"]+)['"]/);
  const catMatch = src.match(/category:\s*['"]([^'"]+)['"]/);
  const subMatch = src.match(/subcategory:\s*['"]([^'"]+)['"]/);
  const shortMatch = src.match(/shortDescription:\s*['`]([^'`]+)['`]/);
  const heavyMatch = src.match(/heavy:\s*(true|false)/);
  const statusMatch = src.match(/status:\s*['"]([^'"]+)['"]/);

  const id = idMatch?.[1];
  const name = nameMatch?.[1];
  const category = catMatch?.[1];
  const subcategory = subMatch?.[1];
  const shortDescription = shortMatch?.[1]?.trim();
  const heavy = heavyMatch?.[1] === 'true';
  const status = statusMatch?.[1];

  const tags = parseStringArray(src, 'tags');
  const keywords = parseStringArray(src, 'keywords');

  if (!id) errors.push('missing `id`');
  if (id && !KEBAB.test(id)) errors.push(`id "${id}" is not kebab-case`);
  if (!name) errors.push('missing `name`');
  if (!category) errors.push('missing `category`');
  if (!status) errors.push('missing `status`');
  if (status && !['active', 'beta', 'experimental'].includes(status)) {
    errors.push(`invalid status "${status}"`);
  }
  if (!shortDescription) errors.push('missing `shortDescription`');
  if (shortDescription && shortDescription.length > 100) {
    errors.push(`shortDescription is ${shortDescription.length} chars (max 100)`);
  }
  if (heavy && !toolLayoutUsesClientVisible) {
    // heavy tools must use client:visible; this is enforced globally in
    // ToolLayout.astro (see the module-level check above).
    errors.push('heavy tools must render with client:visible (enforced in ToolLayout)');
  }

  // Check component is a lazy import
  if (!/component:\s*\(\)\s*=>\s*import\(/.test(src)) {
    errors.push('`component` must be a lazy `() => import(...)`');
  }

  if (tags.length === 0) {
    errors.push('missing `tags` (add SEO synonyms users search for, e.g. "home loan")');
  }
  const nameLower = (name || '').toLowerCase();
  for (const tag of tags) {
    if (tag.toLowerCase() === nameLower) {
      errors.push(`tag "${tag}" duplicates the tool name; tags should be synonyms not the name`);
    }
    if (keywords.includes(tag)) {
      errors.push(`tag "${tag}" duplicates a keyword; tags should add new synonyms`);
    }
  }

  return { id, name, category, subcategory, shortDescription, heavy, errors };
}

function parseStringArray(src, field) {
  const re = new RegExp(`${field}:\\s*\\[([\\s\\S]*?)\\]`);
  const m = src.match(re);
  if (!m) return [];
  return [...m[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((x) => x[1].trim());
}

function main() {
  const targetId = process.argv[2];
  const categorySlugs = readCategories();

  const allToolFiles = findToolFiles();
  const toolFiles = targetId
    ? allToolFiles.filter((t) => t.id === targetId)
    : allToolFiles;

  if (targetId && toolFiles.length === 0) {
    console.error(`\n✗ No tool folder found with id "${targetId}".`);
    process.exit(1);
  }

  let totalErrors = 0;
  const seenIds = new Set();

  for (const { id, category, indexFile } of toolFiles) {
    const { id: parsedId, category: parsedCat, subcategory, errors } =
      readToolObject(indexFile);

    const label = parsedId || id;
    const localErrors = [...errors];

    if (!categorySlugs.has(parsedCat || category)) {
      localErrors.push(`category "${parsedCat || category}" not found in categories.ts`);
    }
    if (subcategory) {
      const subs = readSubcategories(parsedCat || category);
      if (!subs.has(subcategory)) {
        localErrors.push(
          `subcategory "${subcategory}" not found under category "${parsedCat || category}"`,
        );
      }
    }

    if (parsedId && seenIds.has(parsedId)) {
      localErrors.push(`duplicate tool id "${parsedId}"`);
    }
    if (parsedId) seenIds.add(parsedId);

    if (localErrors.length === 0) {
      console.log(`✓ ${label}`);
    } else {
      totalErrors += localErrors.length;
      console.log(`✗ ${label}`);
      for (const e of localErrors) console.log(`    - ${e}`);
    }
  }

  if (totalErrors > 0) {
    console.error(`\n${totalErrors} validation error(s) found.`);
    process.exit(1);
  } else {
    console.log(`\nAll ${toolFiles.length} tool(s) valid.`);
  }
}

main();
