import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import matter from 'gray-matter';
import { parsePost } from './blog-source.mjs';

/** 为没有信息头的旧笔记补齐 CMS 字段；正文、日期及网站地址保持原值。 */
export function prepareCmsMarkdown(markdown, normalizedMarkdown) {
  const original = parsePost(markdown);
  if (original.data.title && original.data.pubDate && original.data.description) return markdown;
  const normalized = parsePost(normalizedMarkdown).data;
  const inferred = {};
  for (const field of ['title', 'description', 'pubDate', 'updatedDate', 'tags', 'draft', 'cover', 'slug']) {
    if (normalized[field] !== undefined) inferred[field] = normalized[field];
  }
  return matter.stringify(original.content, { ...inferred, ...original.data });
}

async function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const manifest = JSON.parse(await readFile(path.join(root, '.cache/blog-sync/manifest.json'), 'utf8'));
  const output = path.join(root, '.cache/blog-sync/cms-prepared');
  let count = 0;
  for (const entry of manifest.files) {
    const content = prepareCmsMarkdown(entry.markdown, entry.content);
    if (content === entry.markdown) continue;
    const destination = path.resolve(output, entry.path);
    const relative = path.relative(output, destination);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('文章路径不在准备目录内');
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content);
    count++;
  }
  console.log(`[cms] 已准备 ${count} 篇旧笔记的编辑器信息头，原仓库尚未修改。`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
