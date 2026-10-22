import assert from 'node:assert/strict';
import { test } from 'node:test';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { createMarkdownPost, postSlug, remarkRepositoryLinks } from '../scripts/blog-source.mjs';

const context = {
  config: { repository: 'FBxiaomo/Study-Note', directory: '博客', label: 'Study-Note', tags: ['学习笔记'] },
  filePath: '博客/第2周学习博客（2026.9.7-9.13）.md',
  commit: 'a'.repeat(40),
  firstCommitDate: '2026-09-14T08:00:00Z',
  lastCommitDate: '2026-09-16T09:00:00Z',
};

test('plain Chinese notes infer title, summary, period end and update date without duplicating H1', () => {
  const markdown = '# 第二周学习博客\n\n> **时间范围**：2026.9.7 — 2026.9.13\n\n---\n\n## 本周收获\n\n学会了 **Python** 循环。\n\n```python\nprint("# 保留代码")\n```\n';
  const post = matter(createMarkdownPost(markdown, context));
  assert.equal(post.data.title, '第二周学习博客');
  assert.equal(post.data.description, '学会了 Python 循环。');
  assert.equal(post.data.pubDate, '2026-09-13');
  assert.equal(post.data.updatedDate, context.lastCommitDate);
  assert.deepEqual(post.data.tags, ['学习笔记']);
  assert(!post.content.startsWith('# 第二周'));
  assert(post.content.includes('print("# 保留代码")'));
  assert(post.data.source.url.includes(context.commit));
});

test('existing YAML fields and draft status take precedence; covers resolve against the source', () => {
  const markdown = '---\ntitle: 自定义标题\ndescription: 自定义简介\npubDate: 2026-08-01\nupdatedDate: 2026-08-02\ndraft: true\ntags: [Python]\ncover: ./images/封面.png\n---\n# 正文标题\n\n正文。';
  const post = matter(createMarkdownPost(markdown, context));
  assert.equal(post.data.title, '自定义标题');
  assert.equal(post.data.description, '自定义简介');
  assert.equal(new Date(post.data.pubDate).toISOString().slice(0, 10), '2026-08-01');
  assert.equal(new Date(post.data.updatedDate).toISOString().slice(0, 10), '2026-08-02');
  assert.equal(post.data.draft, true);
  assert.deepEqual(post.data.tags, ['Python']);
  assert(post.data.cover.startsWith(`https://raw.githubusercontent.com/FBxiaomo/Study-Note/${context.commit}/`));
  assert(post.content.includes('# 正文标题'));
});

test('notes without declared dates use original Git dates, not build time', () => {
  const post = matter(createMarkdownPost('# 标题\n\n正文', context));
  assert.equal(post.data.pubDate, context.firstCommitDate);
  assert.equal(post.data.updatedDate, context.lastCommitDate);
});

test('remote paths are namespaced, stable and cannot escape the configured article folder', () => {
  assert.equal(postSlug('博客/子目录/Hello World.md', '博客'), 'study-note/子目录/hello-world');
  assert.throws(() => postSlug('other/post.md', '博客'));
});

test('migrated posts retain their original addresses and metadata via explicit slug', () => {
  const post = matter(createMarkdownPost('---\ntitle: 开张第一天\ndescription: 原来的简介\npubDate: 2026-10-20\nslug: hello-world\ntags: [随笔]\n---\n原文正文。', { ...context, filePath: '博客/hello-world.md' }));
  assert.equal(post.data.slug, 'hello-world');
  assert.equal(post.data.title, '开张第一天');
  assert.equal(new Date(post.data.pubDate).toISOString().slice(0, 10), '2026-10-20');
  assert.deepEqual(post.data.tags, ['随笔']);
  for (const slug of ['/absolute', '../escape', 'a//b', 'a/../b', 'a?query', 'a%2fb', 'a\\b']) {
    assert.throws(() => postSlug('博客/note.md', '博客', slug));
  }
});

test('repository links honor migrated addresses and do not create links to unpublished posts', async () => {
  const parser = unified().use(remarkParse).use(remarkRepositoryLinks);
  const source = structuredClone(matter(createMarkdownPost('# 标题\n\n正文', context)).data.source);
  source.routes = { '博客/hello-world.md': 'hello-world' };
  const tree = parser.parse('[旧文](./hello-world.md)\n\n[草稿](./draft.md)');
  const result = await parser.run(tree, { data: { astro: { frontmatter: { source } } } });
  assert.equal(result.children[0].children[0].url, '/blog/hello-world/');
  assert(result.children[1].children[0].url.startsWith('https://github.com/FBxiaomo/Study-Note/blob/'));
});

test('repository images, reference images and article links resolve without touching code or external URLs', async () => {
  const post = matter(createMarkdownPost('# 标题\n\n正文', context));
  const parser = unified().use(remarkParse).use(remarkRepositoryLinks);
  const input = '![截图](./images/test.png)\n\n[下一篇](./下一篇.md#收获)\n\n[主页](https://example.com/)\n\n![引用][pic]\n\n[pic]: ../assets/photo.png\n\n```md\n![不改](./code.png)\n```';
  const tree = parser.parse(input);
  const result = await parser.run(tree, { data: { astro: { frontmatter: post.data } } });
  const nodes = [];
  const visit = node => { nodes.push(node); for (const child of node.children ?? []) visit(child); };
  visit(result);
  const image = nodes.find(node => node.type === 'image');
  assert(image.url.includes(`${context.commit}/%E5%8D%9A%E5%AE%A2/images/test.png`));
  const links = nodes.filter(node => node.type === 'link');
  assert.equal(decodeURI(links[0].url), '/blog/study-note/下一篇/#收获');
  assert.equal(links[1].url, 'https://example.com/');
  assert(nodes.find(node => node.type === 'definition').url.endsWith('/assets/photo.png'));
  assert.equal(nodes.find(node => node.type === 'code').value, '![不改](./code.png)');
});

test('local website Markdown links are unaffected by the source plugin', async () => {
  const parser = unified().use(remarkParse).use(remarkRepositoryLinks);
  const tree = parser.parse('[链接](/blog/hello-world/)');
  const before = structuredClone(tree);
  assert.deepEqual(await parser.run(tree), before);
});

test('JavaScript frontmatter is rejected without evaluating source code', () => {
  assert.throws(() => createMarkdownPost('---javascript\n({title: "不应执行"})\n---\n正文', context), /只支持 YAML/);
});
