import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMarkdownPost, parsePost, postSlug } from './blog-source.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cacheDir = path.resolve(root, '.cache/blog-sync');
const output = path.join(cacheDir, 'content');
const cacheFile = path.join(cacheDir, 'manifest.json');
const config = JSON.parse(await readFile(path.join(root, 'blog-source.config.json'), 'utf8'));
const signature = JSON.stringify({ version: 3, config });
let cache;
try { cache = JSON.parse(await readFile(cacheFile, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const cachedConfig = cache?.signature ? JSON.parse(cache.signature).config : undefined;
const sameSource = cachedConfig?.repository === config.repository && cachedConfig?.branch === config.branch && cachedConfig?.directory === config.directory;

// 只操作同步脚本自己的缓存目录，网站仓库不维护文章原稿。
function assertOwned(file) {
  const relative = path.relative(output, path.resolve(file));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('拒绝操作同步目录之外的文件');
}

async function cachedFilesExist() {
  if (cache?.signature !== signature || !cache.files?.length) return false;
  try {
    for (const entry of cache.files) {
      const file = path.join(output, entry.file);
      assertOwned(file);
      if (await readFile(file, 'utf8') !== entry.content) return false;
    }
    return true;
  } catch { return false; }
}

const headers = { 'User-Agent': 'FBxiaomo-personal-blog', Accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
async function github(endpoint) {
  const url = endpoint.startsWith('https://api.github.com/') ? endpoint : `https://api.github.com/repos/${config.repository}/${endpoint}`;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`GitHub 返回 ${response.status}：${url}`);
  return { data: await response.json(), link: response.headers.get('link') };
}

async function main() {
  const hasCache = await cachedFilesExist();
  if (process.argv.includes('--prefer-cache') && hasCache) {
    console.log(`[blog] 使用已同步的 ${cache.files.length} 篇文章；运行 pnpm sync:blog 获取更新。`);
    return;
  }
  const { data: head } = await github(`commits/${encodeURIComponent(config.branch)}`);
  if (hasCache && cache.commit === head.sha) {
    console.log(`[blog] ${config.repository} 没有更新（${cache.files.length} 篇）。`);
    return;
  }
  const { data: tree } = await github(`git/trees/${head.commit.tree.sha}?recursive=1`);
  if (tree.truncated) throw new Error('仓库文件列表不完整，已停止同步以免遗漏文章');
  const files = tree.tree.filter(file => file.type === 'blob' && file.mode !== '120000' && file.path.startsWith(config.directory + '/') && /\.md$/i.test(file.path) && !/\/(?:readme)\.md$/i.test(file.path));
  if (!files.length) throw new Error('指定目录没有 Markdown 文章，保留现有内容并停止构建');
  const entries = [];
  // 顺序读取，避免公开 API 突发并发请求；相同内容复用缓存。
  for (const file of files) {
    const previous = sameSource ? cache.files.find(entry => entry.path === file.path && entry.sha === file.sha) : undefined;
    let markdown, firstCommitDate, lastCommitDate;
    if (previous) {
      ({ markdown, firstCommitDate, lastCommitDate } = previous);
    } else {
      const { data: blob } = await github(`git/blobs/${file.sha}`);
      if (blob.encoding !== 'base64') throw new Error(`无法读取文章：${file.path}`);
      markdown = Buffer.from(blob.content, 'base64').toString('utf8');
      const history = await github(`commits?sha=${head.sha}&path=${encodeURIComponent(file.path)}&per_page=100`);
      if (!history.data.length) throw new Error(`无法读取文章时间：${file.path}`);
      const lastPageUrl = history.link?.match(/<([^>]+)>; rel="last"/)?.[1];
      const oldest = lastPageUrl ? (await github(lastPageUrl)).data.at(-1) : history.data.at(-1);
      firstCommitDate = oldest.commit.author.date;
      lastCommitDate = history.data[0].commit.author.date;
    }
    entries.push({ path: file.path, sha: file.sha, file: `${createHash('sha256').update(file.path).digest('hex').slice(0, 20)}.md`, markdown, firstCommitDate, lastCommitDate });
  }
  const slugs = new Set();
  const routes = {};
  for (const entry of entries) {
    const { data } = parsePost(entry.markdown);
    const id = postSlug(entry.path, config.directory, data.slug);
    if (slugs.has(id)) throw new Error(`文章地址重复：${id}`);
    slugs.add(id);
    if (!data.draft) routes[entry.path] = id;
  }
  for (const entry of entries) {
    entry.content = createMarkdownPost(entry.markdown, {
      config, filePath: entry.path, commit: head.sha, routes,
      firstCommitDate: entry.firstCommitDate, lastCommitDate: entry.lastCommitDate,
    });
  }
  // 所有网络请求和解析成功后再更新文件；失败不会清空已同步文章。
  await mkdir(output, { recursive: true });
  for (const entry of entries) {
    const destination = path.join(output, entry.file);
    assertOwned(destination);
    await writeFile(destination + '.tmp', entry.content);
    await rename(destination + '.tmp', destination);
  }
  const expected = new Set(entries.map(entry => entry.file));
  for (const existing of await readdir(output)) {
    if (/^[a-f0-9]{20}\.md$/.test(existing) && !expected.has(existing)) {
      const stale = path.join(output, existing);
      assertOwned(stale);
      await rm(stale);
    }
  }
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cacheFile, JSON.stringify({ signature, commit: head.sha, files: entries }, null, 2));
  console.log(`[blog] 已同步 ${entries.length} 篇文章：${config.repository}/${config.directory}（${head.sha.slice(0, 7)}）。`);
}

main().catch(error => {
  console.error(`[blog] 同步失败：${error.message}。现有文章未被清空，请重试；本地可用 pnpm dev 读取已有缓存。`);
  process.exitCode = 1;
});
