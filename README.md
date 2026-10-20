# 个人博客

Astro + Markdown，静态部署在 GitHub Pages。写完 push 就上线。

---

## 一、改你自己的信息（5 分钟）

| 要改的东西 | 文件 |
| --- | --- |
| 站名、简介、头像、社交链接、备案号 | `src/data/site.ts` |
| 作品卡片（外链跳转） | `src/data/projects.ts` |
| 友链 | `src/pages/links.astro` |
| 关于页正文 | `src/pages/about.astro` |
| 域名（SEO / RSS / sitemap 用） | `astro.config.mjs` 里的 `site` |
| 配色、字号、圆角 | `src/styles/global.css` 顶部的 CSS 变量 |

头像换成自己的：把图片丢进 `public/`（比如 `public/avatar.jpg`），然后把 `site.ts` 里的 `avatar` 改成 `'/avatar.jpg'`。

---

## 二、写一篇文章

在 `src/content/blog/` 下新建 `随便什么名字.md`（文件名就是 URL 里的 slug）：

```markdown
---
title: 文章标题
description: 一句话摘要，会显示在列表页和搜索结果里
pubDate: 2026-10-20
tags: [标签1, 标签2]
draft: false
---

正文从这里开始，正常写 Markdown 就行。
```

**frontmatter 字段说明**

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `title` | ✅ | 标题 |
| `description` | ✅ | 摘要 |
| `pubDate` | ✅ | 发布日期，`YYYY-MM-DD` |
| `updatedDate` | | 更新时间，会显示在文章页 |
| `tags` | | 标签数组 |
| `cover` | | 封面图路径（暂未使用，留给以后） |
| `draft` | | `true` 时不参与构建，本地也看不到 |

写错字段名或类型 → 构建直接报错，不会带着错误上线。

图片放 `public/images/`，文章里用 `/images/xxx.png` 引用。

---

## 三、本地预览

```bash
pnpm install
pnpm dev          # http://localhost:4321
pnpm build        # 构建到 dist/
pnpm preview      # 预览构建结果
```

---

## 四、部署到 GitHub Pages

### 1. 推到 GitHub

```bash
git init
git add -A
git commit -m "init blog"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

### 2. 打开 Actions 权限

仓库 → **Settings → Pages → Build and deployment → Source**，选 **GitHub Actions**。

> 这一步千万别漏。选错了会出现「Actions 绿了但站点 404」。

### 3. 等第一次构建

推到 main 后，`.github/workflows/deploy.yml` 会自动跑：构建 → 上传 → 部署。
大约 1 分钟，站点出现在 `https://<用户名>.github.io/<仓库名>/`。

### 4. 绑定自己的域名（可选但推荐）

1. 在域名 DNS 里加一条 CNAME：`blog` → `<用户名>.github.io`
2. 仓库 → Settings → Pages → Custom domain 填 `blog.yourdomain.com`，保存
3. 勾选 **Enforce HTTPS**
4. 把 `astro.config.mjs` 的 `site` 改成 `'https://blog.yourdomain.com'`，然后 push

> **注意**：如果绑定了自定义域名，就不要在 `astro.config.mjs` 里设 `base`。
> 只有用 `username.github.io/repo-name/` 这种项目页路径、且没有自定义域名时，才需要 `base: '/repo-name'`。

---

## 五、动效与设计（改之前先看这段）

设计上融合了三家的东西，但各自只负责一件事，**每屏只有一个"主角"**：

| 来源 | 借了什么 | 用在哪 |
| --- | --- | --- |
| Apple | 流体大字号（`clamp`）、紧字距、逐行升起、吸顶叙事、深色区块分段 | Hero 标题、`/src/components/Story.astro`、`StatsBand.astro` |
| maorx | 卡片式作品墙、悬停抬升 | `ProjectRail.astro` |
| openless | 指针光斑网格、卡片聚光 | `CursorTrail.astro`、`[data-tilt]` |

**几个可以直接调的参数：**

| 想改什么 | 在哪 |
| --- | --- |
| 光标轨迹明显程度 | `CursorTrail.astro` 里 `#cursor-trail` 的 `opacity`（默认 .55） |
| 网格疏密 / 大小 | 同文件 `buildGrid()` 里的 `size` / `step` |
| 卡片倾斜角度 | `BaseLayout.astro` 脚本里的 `MAX`（默认 3 度） |
| 磁性按钮吸力 | 同文件 `* 0.22` 那个系数 |
| 吸顶叙事的滚动长度 | `Story.astro` 里 `.stage` 的 `height: 300vh` |
| 渐变字颜色 | `global.css` 的 `.grad` |

**降级规则（已内置，不用你管）：**
- `prefers-reduced-motion: reduce` → 所有动效关闭，内容照常显示
- 触屏设备 → 光标轨迹自动隐藏
- 指针静止 700ms → 轨迹的 rAF 自动停，不空转耗电

**加一个新的"卡片可倾斜"元素**，只要给它 `data-tilt` 属性；让按钮有磁性，加 `data-magnet`。

---

## 六、目录结构

```
.
├─ .github/workflows/deploy.yml   自动部署
├─ public/                        静态资源（头像、favicon、图片）
├─ src/
│  ├─ content/blog/               ← 文章都在这
│  ├─ content.config.ts           文章 frontmatter 的类型定义
│  ├─ data/site.ts                站点信息
│  ├─ data/projects.ts            作品卡片
│  ├─ components/                 Header / Footer / 卡片 / 列表
│  ├─ layouts/BaseLayout.astro    HTML 骨架 + SEO + 主题
│  ├─ pages/                      每个文件就是一个页面
│  └─ styles/global.css           设计变量 + 全局样式
└─ astro.config.mjs
```

**页面路由**

| 文件 | 地址 |
| --- | --- |
| `pages/index.astro` | `/` |
| `pages/projects.astro` | `/projects` |
| `pages/blog/index.astro` | `/blog` |
| `pages/blog/[...slug].astro` | `/blog/<文件名>/` |
| `pages/about.astro` | `/about` |
| `pages/links.astro` | `/links` |
| `pages/404.astro` | `/404.html` |
| `pages/rss.xml.ts` | `/rss.xml` |
| `pages/robots.txt.ts` | `/robots.txt` |

---

## 七、常见问题

**Q：想加一个新页面？**
在 `src/pages/` 下新建 `.astro` 文件，文件名就是路径。

**Q：想让某个作品卡片跳到自己另一个站？**
改 `src/data/projects.ts`，`href` 填完整 URL，`external: true`。

**Q：暗色模式怎么记不住？**
主题存在 `localStorage` 的 `theme` 键里。如果写死成 `light`，检查 `BaseLayout.astro` 里的内联脚本。

**Q：构建报 `Ignored build scripts: esbuild, sharp`？**
项目已配好 `pnpm-workspace.yaml`，正常不会出现。如果出现，跑 `pnpm approve-builds`。

**Q：文章里的代码块没高亮？**
Astro 内置 Shiki，双主题（亮/暗）已配在 `astro.config.mjs`，深色模式下会自动换配色。
