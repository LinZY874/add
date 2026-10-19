import { readFile } from 'node:fs/promises';

export const ITEM_TYPES = ['prompt', 'image', 'tutorial'];
export const ITEM_STATUSES = ['inbox', 'organized', 'used'];
const ITEM_KEYS = ['id', 'type', 'title', 'summary', 'tags', 'createdAt', 'source', 'content', 'image', 'gallery', 'generation', 'notes', 'related', 'status', 'topics'];

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateKeys(value, allowed, path, errors) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`${path}.${key}: unknown field`);
  }
}

function nonempty(value, path, errors) {
  if (typeof value !== 'string' || !value.trim()) errors.push(`${path}: expected a nonempty string`);
}

function stringList(value, path, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${path}: expected an array of strings`);
    return;
  }
  for (const [index, entry] of value.entries()) nonempty(entry, `${path}[${index}]`, errors);
  if (new Set(value).size !== value.length) errors.push(`${path}: duplicate values are not allowed`);
}

function validateImage(value, path, errors, gallery = false) {
  if (!object(value)) {
    errors.push(`${path}: expected an object`);
    return;
  }
  validateKeys(value, gallery ? ['src', 'alt', 'role', 'caption'] : ['src', 'alt'], path, errors);
  if (!isWebUrl(value.src) && !isAssetPath(value.src)) errors.push(`${path}.src: expected an HTTP(S) URL or a safe assets/ path`);
  nonempty(value.alt, `${path}.alt`, errors);
  if (gallery) {
    if (!['reference', 'result'].includes(value.role)) errors.push(`${path}.role: expected reference or result`);
    if ('caption' in value) nonempty(value.caption, `${path}.caption`, errors);
  }
}

export function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function isWebUrl(value) {
  if (typeof value !== 'string' || /[\u0000-\u0020\u007f]/.test(value)) return false;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isAssetPath(value) {
  return typeof value === 'string' && value.startsWith('assets/') && value.split('/').slice(1).every(segment =>
    segment !== '.' && segment !== '..' && /^[a-zA-Z0-9_][a-zA-Z0-9._-]*$/.test(segment));
}

export function validateLibrary(library) {
  const errors = [];
  if (!object(library)) return ['library: expected an object'];
  validateKeys(library, ['version', 'updatedAt', 'items'], 'library', errors);
  if (library.version !== 1) errors.push('library.version: expected 1');
  if (!isDate(library.updatedAt)) errors.push('library.updatedAt: expected a real date in YYYY-MM-DD format');
  if (!Array.isArray(library.items)) return [...errors, 'library.items: expected an array'];
  const ids = new Set();
  for (const [index, item] of library.items.entries()) {
    const path = `library.items[${index}]`;
    if (!object(item)) {
      errors.push(`${path}: expected an object`);
      continue;
    }
    validateKeys(item, ITEM_KEYS, path, errors);
    if (typeof item.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(item.id)) errors.push(`${path}.id: use 1–80 lowercase letters, digits, or hyphens; start with a letter or digit`);
    if (ids.has(item.id)) errors.push(`${path}.id: duplicate ID "${item.id}"`);
    ids.add(item.id);
    if (!ITEM_TYPES.includes(item.type)) errors.push(`${path}.type: expected prompt, image, or tutorial`);
    nonempty(item.title, `${path}.title`, errors);
    nonempty(item.summary, `${path}.summary`, errors);
    stringList(item.tags, `${path}.tags`, errors);
    if (!isDate(item.createdAt)) errors.push(`${path}.createdAt: expected a real date in YYYY-MM-DD format`);
    else if (isDate(library.updatedAt) && item.createdAt > library.updatedAt) errors.push(`${path}.createdAt: cannot be later than library.updatedAt`);
    for (const key of ['content', 'notes']) {
      if (key in item && typeof item[key] !== 'string') errors.push(`${path}.${key}: expected a string`);
    }
    if ('source' in item) {
      if (!object(item.source)) errors.push(`${path}.source: expected an object`);
      else {
        validateKeys(item.source, ['url', 'title', 'author'], `${path}.source`, errors);
        if (!isWebUrl(item.source.url)) errors.push(`${path}.source.url: expected an absolute HTTP or HTTPS URL without credentials`);
        for (const key of ['title', 'author']) if (key in item.source) nonempty(item.source[key], `${path}.source.${key}`, errors);
      }
    }
    if ('image' in item) {
      validateImage(item.image, `${path}.image`, errors);
    }
    if ('gallery' in item) {
      if (!Array.isArray(item.gallery) || !item.gallery.length) errors.push(`${path}.gallery: expected a nonempty array`);
      else item.gallery.forEach((image, imageIndex) => validateImage(image, `${path}.gallery[${imageIndex}]`, errors, true));
    }
    if ('generation' in item) {
      if (!object(item.generation)) errors.push(`${path}.generation: expected an object`);
      else {
        validateKeys(item.generation, ['model'], `${path}.generation`, errors);
        nonempty(item.generation.model, `${path}.generation.model`, errors);
      }
    }
    if ('status' in item && !ITEM_STATUSES.includes(item.status)) errors.push(`${path}.status: expected inbox, organized, or used`);
    for (const key of ['topics', 'related']) if (key in item) stringList(item[key], `${path}.${key}`, errors);
    if (item.type === 'prompt') nonempty(item.content, `${path}.content (required for prompts)`, errors);
    if (item.type === 'image' && !object(item.image) && !object(item.source)) errors.push(`${path}: image items require an image or a source URL`);
    if (item.type === 'tutorial' && !object(item.source)) errors.push(`${path}.source: required for tutorial items`);
  }
  for (const [index, item] of library.items.entries()) {
    if (!object(item) || !Array.isArray(item.related)) continue;
    for (const id of item.related) {
      if (id === item.id) errors.push(`library.items[${index}].related: an item cannot refer to itself`);
      else if (!ids.has(id)) errors.push(`library.items[${index}].related: unknown item ID "${id}"`);
    }
  }
  return errors;
}

export function assertValidLibrary(library) {
  const errors = validateLibrary(library);
  if (errors.length) throw new Error(`Collection validation failed:\n${errors.map(error => `  - ${error}`).join('\n')}`);
  return library;
}

export async function readLibrary(path) {
  let library;
  try { library = JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { throw new Error(`Cannot read collection JSON at ${path}: ${error.message}`); }
  return assertValidLibrary(library);
}

export function normalizeLibrary(library) {
  return {
    version: 1,
    updatedAt: library.updatedAt,
    items: library.items.map(item => Object.fromEntries(ITEM_KEYS.filter(key => key in item).map(key => {
      if (key === 'source') return [key, Object.fromEntries(['url', 'title', 'author'].filter(field => field in item.source).map(field => [field, item.source[field]]))];
      if (key === 'image') return [key, { src: item.image.src, alt: item.image.alt }];
      if (key === 'gallery') return [key, item.gallery.map(image => Object.fromEntries(['src', 'alt', 'role', 'caption'].filter(field => field in image).map(field => [field, image[field]])))];
      if (key === 'generation') return [key, { model: item.generation.model }];
      return [key, item[key]];
    })))
  };
}

export function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function duplicateUrlKey(value) {
  if (!isWebUrl(value)) return null;
  const url = new URL(value);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || ['fbclid', 'gclid'].includes(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString().replace(/\/$/, '');
}
