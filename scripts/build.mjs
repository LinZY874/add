import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { isAssetPath, json, normalizeLibrary, readLibrary } from './library.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = path.join(root, 'site');
const output = path.join(root, 'docs');
const check = process.argv.slice(2).includes('--check');
const typeLabels = { prompt: '提示词', image: '风格化图片', tutorial: '教程链接' };

function escapeMarkdown(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([\\`*_{}\[\]()#+.!|])/g, '\\$1');
}

function linkUrl(value) {
  return value.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/ /g, '%20');
}

function fenced(value) {
  const runs = value.match(/`+/g) || [];
  const fence = '`'.repeat(Math.max(3, ...runs.map(run => run.length + 1)));
  return `${fence}text\n${value}${value.endsWith('\n') ? '' : '\n'}${fence}`;
}

function itemMarkdown(item) {
  const lines = [
    '---',
    `id: ${JSON.stringify(item.id)}`,
    `type: ${JSON.stringify(item.type)}`,
    `title: ${JSON.stringify(item.title)}`,
    `createdAt: ${JSON.stringify(item.createdAt)}`,
    `tags: ${JSON.stringify(item.tags)}`,
    ...(item.topics ? [`topics: ${JSON.stringify(item.topics)}`] : []),
    ...(item.status ? [`status: ${JSON.stringify(item.status)}`] : []),
    '---', '',
    `# ${escapeMarkdown(item.title)}`, '',
    escapeMarkdown(item.summary), '',
    `- 分类：${typeLabels[item.type]}`,
    `- 收藏日期：${item.createdAt}`,
    `- 标签：${item.tags.map(escapeMarkdown).join('、') || '暂无'}`,
    ...(item.topics?.length ? [`- 主题：${item.topics.map(escapeMarkdown).join('、')}`] : []),
    ...(item.source ? [`- 来源：[${escapeMarkdown(item.source.title || item.source.url)}](${linkUrl(item.source.url)})${item.source.author ? ` · ${escapeMarkdown(item.source.author)}` : ''}`] : []),
    ...(item.generation ? [`- 使用模型：${escapeMarkdown(item.generation.model)}`] : []),
    '',
  ];
  if (item.gallery?.length) {
    for (const [role, heading] of [['reference', '参考图'], ['result', '生成结果']]) {
      const images = item.gallery.filter(image => image.role === role);
      if (!images.length) continue;
      lines.push(`## ${heading}`, '');
      for (const image of images) {
        lines.push(`![${escapeMarkdown(image.alt)}](${linkUrl(isAssetPath(image.src) ? `../${image.src}` : image.src)})`, '');
        if (image.caption) lines.push(escapeMarkdown(image.caption), '');
        if (image.prompt) lines.push('### 本图提示词', '', fenced(image.prompt), '');
      }
    }
  } else if (item.image) lines.push(`![${escapeMarkdown(item.image.alt)}](${linkUrl(isAssetPath(item.image.src) ? `../${item.image.src}` : item.image.src)})`, '');
  if (item.content) lines.push(item.type === 'prompt' ? '## 提示词' : item.type === 'image' && item.generation ? '## 提示词原文' : '## 内容', '', fenced(item.content), '');
  if (item.attachments?.length) {
    lines.push('## 附件', '');
    for (const attachment of item.attachments) {
      lines.push(`- [${escapeMarkdown(attachment.title)}](${linkUrl(isAssetPath(attachment.src) ? `../${attachment.src}` : attachment.src)})`, '');
      if (attachment.description) lines.push(escapeMarkdown(attachment.description), '');
    }
  }
  if (item.notes) lines.push('## 收藏备注', '', escapeMarkdown(item.notes), '');
  if (item.related?.length) lines.push('## 相关收藏', '', ...item.related.map(id => `- [${escapeMarkdown(id)}](./${id}.md)`), '');
  lines.push(`[返回全部收藏](./index.md) · [读取 JSON](../api/items/${item.id}.json)`, '');
  return lines.join('\n');
}

async function listFiles(directory, prefix = '') {
  const files = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not allowed in generated or source site files: ${relative}`);
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
    else throw new Error(`Unsupported file in site: ${relative}`);
  }
  return files;
}

async function absentOrDirectory(directory) {
  try {
    const stat = await lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Refusing to replace ${directory}: expected a regular directory`);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function write(directory, relative, contents) {
  const destination = path.join(directory, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, contents);
}

async function compare(expected, actual) {
  if (!await absentOrDirectory(actual)) return ['docs/ does not exist'];
  const expectedFiles = await listFiles(expected);
  const actualFiles = await listFiles(actual);
  const differences = [];
  const expectedSet = new Set(expectedFiles);
  const actualSet = new Set(actualFiles);
  for (const file of expectedFiles) {
    if (!actualSet.has(file)) differences.push(`missing docs/${file}`);
    else if (!(await readFile(path.join(expected, file))).equals(await readFile(path.join(actual, file)))) differences.push(`outdated docs/${file}`);
  }
  for (const file of actualFiles) if (!expectedSet.has(file)) differences.push(`unexpected docs/${file}`);
  return differences;
}

let stage;
try {
  if (process.argv.slice(2).some(argument => argument !== '--check')) throw new Error('Usage: node scripts/build.mjs [--check]');
  const library = normalizeLibrary(await readLibrary(path.join(root, 'content/library.json')));
  if (!await absentOrDirectory(site)) throw new Error('Missing site/ source directory.');
  const siteFiles = await listFiles(site);
  if (!siteFiles.includes('index.html')) throw new Error('Missing site/index.html. Add the website source before building.');
  const reserved = siteFiles.find(file => /^(api|data|entries)\//.test(file));
  if (reserved) throw new Error(`site/${reserved} conflicts with generated collection output; edit content/library.json instead`);
  for (const item of library.items) {
    for (const image of [...(item.image ? [item.image] : []), ...(item.gallery || [])]) {
      if (isAssetPath(image.src) && !siteFiles.includes(image.src)) throw new Error(`Image item "${item.id}" references missing site/${image.src}`);
    }
    for (const attachment of item.attachments || []) {
      if (isAssetPath(attachment.src) && !siteFiles.includes(attachment.src)) throw new Error(`Attachment item "${item.id}" references missing site/${attachment.src}`);
    }
  }
  await absentOrDirectory(output);
  stage = await mkdtemp(path.join(root, '.build-'));
  await cp(site, stage, { recursive: true });
  let entryHtml = await readFile(path.join(stage, 'index.html'), 'utf8');
  for (const asset of ['app.js', 'styles.css']) {
    if (!siteFiles.includes(asset)) continue;
    const revision = createHash('sha256').update(await readFile(path.join(stage, asset))).digest('hex').slice(0, 12);
    entryHtml = entryHtml.replaceAll(`./${asset}"`, `./${asset}?v=${revision}"`);
  }
  await write(stage, 'index.html', entryHtml);
  await write(stage, '.nojekyll', '');
  await write(stage, 'data/library.json', json(library));
  await write(stage, 'api/library.json', json(library));
  await write(stage, 'api/library.schema.json', await readFile(path.join(root, 'schema/library.schema.json')));
  for (const item of library.items) {
    await write(stage, `api/items/${item.id}.json`, json(item));
    await write(stage, `entries/${item.id}.md`, itemMarkdown(item));
  }
  const index = [
    '# ADD · 收藏索引', '',
    `更新日期：${library.updatedAt} · 共 ${library.items.length} 条收藏`, '',
    ...library.items.map(item => `- [${escapeMarkdown(item.title)}](./${item.id}.md) · ${typeLabels[item.type]} · ${item.createdAt}\n  ${escapeMarkdown(item.summary)}`),
    ...(library.items.length ? [] : ['还没有收藏。添加的内容会自动出现在这里。']),
    '', '[完整 JSON 数据](../api/library.json) · [数据结构](../api/library.schema.json)', '',
  ].join('\n');
  await write(stage, 'entries/index.md', index);
  if (check) {
    const differences = await compare(stage, output);
    if (differences.length) throw new Error(`Generated website is out of date. Run npm run build:\n${differences.map(difference => `  - ${difference}`).join('\n')}`);
    console.log(`Website is current; ${library.items.length} item(s), collection and generated files validated.`);
  } else {
    // Only this repository's fixed docs/ directory is replaced; symlinks are rejected above.
    await rm(output, { recursive: true, force: true });
    await rename(stage, output);
    stage = undefined;
    console.log(`Built docs/ with ${library.items.length} item(s), JSON API, and Markdown exports.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (stage) await rm(stage, { recursive: true, force: true });
}
