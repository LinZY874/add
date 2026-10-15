import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertValidLibrary, duplicateUrlKey, isDate, json, normalizeLibrary } from './library.mjs';

const args = process.argv.slice(2);
const usage = 'Usage: npm run add -- --file /path/to/item.json [--date YYYY-MM-DD] [--allow-duplicate-url]\nImports one item into content/library.json. Run npm run build afterwards.';

try {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage);
  } else {
    let input;
    let updateDate = new Date().toISOString().slice(0, 10);
    let allowDuplicate = false;
    for (let index = 0; index < args.length; index++) {
      if (args[index] === '--file' && args[index + 1] && !args[index + 1].startsWith('--')) input = args[++index];
      else if (args[index] === '--date' && args[index + 1] && !args[index + 1].startsWith('--')) updateDate = args[++index];
      else if (args[index] === '--allow-duplicate-url') allowDuplicate = true;
      else throw new Error(`Unknown or incomplete argument: ${args[index]}\n${usage}`);
    }
    if (!input) throw new Error(usage);
    if (!isDate(updateDate)) throw new Error('--date must be a real date in YYYY-MM-DD format');
    const canonicalPath = fileURLToPath(new URL('../content/library.json', import.meta.url));
    const canonicalBefore = await readFile(canonicalPath, 'utf8');
    const library = assertValidLibrary(JSON.parse(canonicalBefore));
    let item;
    try { item = JSON.parse(await readFile(path.resolve(input), 'utf8')); }
    catch (error) { throw new Error(`Cannot read item JSON: ${error.message}`); }
    const next = {
      version: 1,
      updatedAt: [library.updatedAt, updateDate, typeof item?.createdAt === 'string' ? item.createdAt : ''].sort().at(-1),
      items: [...library.items, item],
    };
    assertValidLibrary(next);
    const newUrl = duplicateUrlKey(item.source?.url);
    const duplicate = newUrl && library.items.find(existing => duplicateUrlKey(existing.source?.url) === newUrl);
    if (duplicate && !allowDuplicate) throw new Error(`This source URL is already collected as "${duplicate.id}" (${duplicate.title}). Use --allow-duplicate-url only if a separate entry is intentional.`);
    // Detect changes made while the import was being prepared instead of overwriting them.
    if (await readFile(canonicalPath, 'utf8') !== canonicalBefore) throw new Error('Collection changed during import; rerun the command to preserve the other edit.');
    const tempPath = `${canonicalPath}.${process.pid}.tmp`;
    await writeFile(tempPath, json(normalizeLibrary(next)), { flag: 'wx' });
    await rename(tempPath, canonicalPath);
    console.log(`Added "${item.id}" (${item.title}). Run npm run build, then review and commit the changes.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
