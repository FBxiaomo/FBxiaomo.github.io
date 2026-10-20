// ============================================================
//  作品 / 项目卡片
//  href 可以是外链（https://...）也可以是站内路径（/xxx/）
//  external: true 时会在新标签页打开，并显示 ↗ 图标
// ============================================================

export type Project = {
  name: string;
  desc: string;
  href: string;
  tags?: string[];
  status?: 'active' | 'wip' | 'archived';
  external?: boolean;
  /** 首页只显示 featured 为 true 的卡片，默认全部显示 */
  featured?: boolean;
  /** 封面图：/images/xxx.jpg。留空会自动用暖色渐变兜底 */
  cover?: string;
};

export const projects: Project[] = [
  {
    name: '示例工具站',
    desc: '一个跑在子域名上的小工具，点开就是独立页面。',
    href: 'https://example.com/',
    tags: ['Web', '工具'],
    status: 'active',
    external: true,
    featured: true,
  },
  {
    name: '另一个独立页面',
    desc: '同一域名下的子目录应用，比如 /lab/ 这种。',
    href: '/lab/',
    tags: ['实验'],
    status: 'wip',
    featured: true,
  },
  {
    name: '开源仓库',
    desc: '扔在 GitHub 上的一些脚本和轮子。',
    href: 'https://github.com/',
    tags: ['开源'],
    status: 'active',
    external: true,
    featured: true,
  },
  {
    name: '归档项目',
    desc: '已经不再维护，但舍不得删。',
    href: 'https://example.com/',
    tags: ['旧项目'],
    status: 'archived',
    external: true,
  },
];
