// ============================================================
//  站点全局信息 —— 想改的地方基本都在这里
// ============================================================

export const site = {
  /** 站点名：用在首页欢迎语、页脚、SEO */
  name: '风暴小末',

  /** 顶部标题栏左上角的品牌名 */
  brand: 'xiao.M',

  /** 一句话简介 */
  tagline: '写代码，也写点别的。',

  /** 首页 Hero 下面那段自我描述 */
  intro:
    '这里是我的数字花园：一些技术笔记，一些半成品项目，和一些还没想清楚的想法。',

  /** 头像：把图片放进 public/ 然后改这里 */
  avatar: '/avatar.svg',

  /** 用于 SEO / RSS 的站点描述 */
  description: '个人博客与作品集',

  /** 语言 */
  lang: 'zh-CN',

  /** 备案号，没有就留空字符串 */
  icp: '',
  /** 公安备案，没有就留空 */
  police: '',

  /** 社交链接：想加就加，想删就删 */
  socials: [
    { label: 'GitHub', href: 'https://github.com/FBxiaomo', icon: 'github' },
    { label: 'Bilibili', href: 'https://space.bilibili.com/', icon: 'bilibili' },
    { label: '订阅', href: '/rss.xml', icon: 'rss' },
  ],

  /** 页脚 */
  footerNote: '用 Astro 构建，托管在 GitHub Pages。',
} as const;
