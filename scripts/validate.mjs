import { fileURLToPath } from 'node:url';
import { readLibrary } from './library.mjs';

try {
  const library = await readLibrary(fileURLToPath(new URL('../content/library.json', import.meta.url)));
  console.log(`Collection is valid: ${library.items.length} item(s).`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
