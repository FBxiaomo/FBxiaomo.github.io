export function createCmsConfig({ source, cms }) {
  let authUrl;
  if (cms.oauthBaseUrl) {
    const parsed = new URL(cms.oauthBaseUrl);
    if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username) throw new Error('OAuth 地址必须是 HTTPS 服务根地址');
    authUrl = parsed.origin;
  }
  return {
    load_config_file: false,
    locale: 'zh_Hans',
    backend: { name: 'github', repo: source.repository, branch: source.branch, ...(authUrl ? { base_url: authUrl } : {}), auth_endpoint: 'auth' },
    site_url: cms.siteUrl,
    display_url: cms.siteUrl,
    media_folder: source.directory + '/images',
    public_folder: './images',
    slug: { encoding: 'unicode', clean_accents: false, sanitize_replacement: '-' },
    collections: [{
      name: 'blog', label: '博客文章', label_singular: '文章', folder: source.directory,
      create: true, delete: true, extension: 'md', format: 'yaml-frontmatter',
      slug: '{{slug}}', identifier_field: 'title',
      summary: '{{title}}', sortable_fields: ['pubDate', 'title'],
      fields: [
        { label: '标题', name: 'title', widget: 'string' },
        { label: '摘要', name: 'description', widget: 'text', required: false },
        { label: '发布日期', name: 'pubDate', widget: 'datetime', date_format: 'YYYY-MM-DD', time_format: false, format: 'YYYY-MM-DD' },
        { label: '更新时间', name: 'updatedDate', widget: 'datetime', date_format: 'YYYY-MM-DD', time_format: false, format: 'YYYY-MM-DD', required: false },
        { label: '标签', name: 'tags', widget: 'list', required: false, default: source.tags },
        { label: '封面', name: 'cover', widget: 'image', required: false },
        { label: '草稿（勾选后网站不展示）', name: 'draft', widget: 'boolean', default: false },
        { label: '固定文章地址', name: 'slug', widget: 'string', required: false, hint: '已有文章请保留，新文章可留空。' },
        { label: '正文', name: 'body', widget: 'markdown' },
      ],
    }],
  };
}
