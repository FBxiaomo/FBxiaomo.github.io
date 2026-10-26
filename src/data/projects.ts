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
  /** 首页默认显示，设为 false 则仅在作品页显示 */
  featured?: boolean;
  /** 封面图：/images/xxx.jpg。留空会自动用暖色渐变兜底 */
  cover?: string;
  /** 悬停浮层和弹窗里的大图；不设就用 cover。适合给 logo 类封面单独配一张页面截图 */
  preview?: string;
};

export const statusLabel = { active: '维护中', wip: '开发中', archived: '已归档' } as const;

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
    preview: '/images/digital-gallery-shot.jpg',
  },
  {
    name: '声墨',
    desc: '语音输入法，让声音化为文字，减少日常打字负担。',
    href: 'https://fbxiaomo.github.io/shengmo/',
    tags: ['语音输入', 'Tauri', 'Rust'],
    status: 'active',
    external: true,
    featured: true,
    cover: '/images/shengmo-cover.svg',
  },
];
