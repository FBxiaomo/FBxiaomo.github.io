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
    name: '数码图鉴',
    desc: '手机 · 充电宝 · 充电器 · 处理器参数图鉴，液态玻璃 UI，支持拼音与别名搜索。',
    href: 'https://xiaomowiki.top',
    tags: ['Web', '工具', '数据库'],
    status: 'active',
    external: true,
    featured: true,
    cover: '/images/digital-gallery-cover.png',
  },
];
