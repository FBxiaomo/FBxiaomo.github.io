import path from 'node:path';
import matter from 'gray-matter';
import { slug } from 'github-slugger';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

const parser = unified().use(remarkParse).use(remarkGfm);
export const encodePath = value => value.split('/').map(encodeURIComponent).join('/');

export function postSlug(filePath, directory, customSlug) {
  const relative = path.posix.relative(directory, filePath).replace(/\.md$/i, '');
  if (relative.startsWith('../') || path.posix.isAbsolute(relative)) throw new Error('文章不在配置的目录内');
  if (customSlug !== undefined && customSlug !== '') {
    if (typeof customSlug !== 'string' || !customSlug || /[\\%?#]/.test(customSlug) || customSlug.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
      throw new Error(`文章地址无效：${customSlug}`);
    }
    return customSlug;
  }
  return 'study-note/' + relative.split('/').map(segment => slug(segment)).join('/');
}

export function parsePost(markdown) {
  return matter(markdown.replace(/^\uFEFF/, ''), {
    engines: { javascript: () => { throw new Error('文章信息头只支持 YAML'); } },
  });
}

function textOf(node) {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value;
  if (node.type === 'break') return ' ';
  return (node.children ?? []).map(textOf).join('');
}

function declaredDate(tree) {
  // 原仓库的时间范围 / 完成时间通常写在开头引用块中，取范围结束日。
  for (const node of tree.children) {
    if (node.type !== 'blockquote') continue;
    const text = textOf(node);
    if (!/(时间范围|完成时间|发布日期|日期)/.test(text)) continue;
    const dates = [...text.matchAll(/\b(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})\b/g)];
    const last = dates.at(-1);
    if (last) return `${last[1]}-${last[2].padStart(2, '0')}-${last[3].padStart(2, '0')}`;
  }
}

export function createMarkdownPost(markdown, context) {
  // 禁用 gray-matter 的 JavaScript 引擎，只接收普通 YAML 元数据。
  const parsed = parsePost(markdown);
  const tree = parser.parse(parsed.content);
  const heading = tree.children.find(node => node.type === 'heading' && node.depth === 1);
  const paragraph = tree.children.find(node => node.type === 'paragraph' && textOf(node).trim());
  const title = parsed.data.title ?? (heading ? textOf(heading) : path.posix.basename(context.filePath, '.md'));
  const description = parsed.data.description ?? (paragraph ? textOf(paragraph).replace(/\s+/g, ' ').trim().slice(0, 160) : title);
  const pubDate = parsed.data.pubDate ?? parsed.data.date ?? declaredDate(tree) ?? context.firstCommitDate;
  if (Number.isNaN(new Date(pubDate).valueOf())) throw new Error(`${context.filePath}: 无法确定有效的发布日期`);
  const updatedDate = parsed.data.updatedDate ?? (
    context.lastCommitDate.slice(0, 10) > new Date(pubDate).toISOString().slice(0, 10) ? context.lastCommitDate : undefined
  );
  const source = {
    label: context.config.label,
    url: `https://github.com/${context.config.repository}/blob/${context.commit}/${encodePath(context.filePath)}`,
    repository: context.config.repository,
    commit: context.commit,
    path: context.filePath,
    directory: context.config.directory,
    ...(context.routes ? { routes: context.routes } : {}),
  };
  const cover = parsed.data.cover ? repositoryUrl(parsed.data.cover, source, true) : undefined;
  const metadata = {
    title, description, pubDate,
    ...(updatedDate ? { updatedDate } : {}),
    tags: parsed.data.tags ?? context.config.tags,
    draft: parsed.data.draft ?? false,
    ...(cover ? { cover } : {}),
    slug: postSlug(context.filePath, context.config.directory, parsed.data.slug),
    source,
  };
  // 页面已经显示文章标题，正文中的相同一级标题不再重复。
  let body = parsed.content;
  if (heading && textOf(heading) === title) {
    body = body.slice(0, heading.position.start.offset) + body.slice(heading.position.end.offset);
  }
  return matter.stringify(body.trimStart(), metadata);
}

function repositoryUrl(value, source, image = false) {
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return value;
  const base = new URL(`https://repository.invalid/${encodePath(source.path)}`);
  const target = new URL(value, base);
  let filePath;
  try { filePath = decodeURIComponent(target.pathname).replace(/^\//, ''); }
  catch { throw new Error(`无法解析仓库链接：${value}`); }
  const articleSlug = source.routes ? source.routes[filePath] : (
    /\.md$/i.test(filePath) && filePath.startsWith(source.directory + '/') && !/\/(?:readme)\.md$/i.test(filePath) ? postSlug(filePath, source.directory) : undefined
  );
  if (!image && articleSlug) {
    return '/blog/' + encodePath(articleSlug) + '/' + target.search + target.hash;
  }
  const origin = image ? 'https://raw.githubusercontent.com' : 'https://github.com';
  const ref = image ? source.commit : `blob/${source.commit}`;
  return `${origin}/${source.repository}/${ref}/${encodePath(filePath)}${target.search}${target.hash}`;
}

/** 仅处理同步文章的相对链接；普通站内文章和代码示例保持原样。 */
export function remarkRepositoryLinks() {
  return (tree, file) => {
    const source = file.data.astro?.frontmatter?.source;
    if (!source) return;
    const imageReferences = new Set();
    const visit = (node, fn) => { fn(node); for (const child of node.children ?? []) visit(child, fn); };
    visit(tree, node => { if (node.type === 'imageReference') imageReferences.add(node.identifier); });
    visit(tree, node => {
      if (node.type === 'image' || node.type === 'link' || node.type === 'definition') {
        node.url = repositoryUrl(node.url, source, node.type === 'image' || imageReferences.has(node.identifier));
      }
    });
  };
}
