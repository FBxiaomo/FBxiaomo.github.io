# 个人博客

Astro 静态个人网站，部署在 GitHub Pages。文章统一在 `FBxiaomo/Study-Note` 中维护，网站负责同步与展示。

---

## 一、改你自己的信息（5 分钟）

| 要改的东西 | 文件 |
| --- | --- |
| 站名、简介、头像、社交链接、备案号 | `src/data/site.ts` |
| 作品卡片（外链跳转） | `src/data/projects.ts` |
| 友链 | `src/data/friends.ts` |
| 关于页正文 | `src/pages/about.astro` |
| 域名（SEO / RSS / sitemap 用） | `astro.config.mjs` 里的 `site` |
| 配色、字号、圆角 | `src/styles/global.css` 顶部的 CSS 变量 |

头像换成自己的：把图片丢进 `public/`（比如 `public/avatar.jpg`），然后把 `site.ts` 里的 `avatar` 改成 `'/avatar.jpg'`。

关于页轮播里那张 B 站头像：把图片放进 `public/images/`，命名为 `bilibili-avatar.jpg`（`png` / `webp` / `avif` / `svg` 也认，改后缀即可）。
组件会在构建时自动找到这张图；没有图片时该卡片显示一个占位图标，其它卡片不受影响。图片按 1:1 方形裁切显示，和其它卡片一样大。

这张卡片悬停时会显示 B 站粉丝数。B 站接口不允许跨域，所以数字是**构建时**抓的：本地构建/预览会缓存 6 小时，请求失败就用上一份缓存，再不行就用随程序打包的 `src/data/bilibili.snapshot.json`。站点每 6 小时自动部署时尝试更新（见 `deploy.yml` 的 `cron`）；接口不可用时保留旧数字，卡片会显示该数字的更新时间。想手动刷新兜底数字：`pnpm sync:fans`。UID 在 `site.ts` 的 `bilibiliUid`，改一处，社交链接和粉丝数一起跟着变。

---

## 二、写一篇文章

### 在线写作后台

写作入口为 [在线写作后台](https://fbxiaomo.github.io/admin/)，使用 GitHub 账号登录，仅允许站主写作。文章统一保存至 Study-Note 的 `博客/` 目录。保存后会请求更新网站；若提示更新失败，可点“更新网站”重试或手动运行部署工作流。登录代理代码在 `workers/study-note-oauth/worker.mjs`，部署及维护步骤见 `docs/写作后台部署.md`。

后台保存的文章直接进入 Study-Note，网站不会另存文章原稿。发布后会尝试立即更新网站；已有定时同步仍作为备用。

### 统一在 Study-Note 中写作

网站只读取 `FBxiaomo/Study-Note` 的 `main` 分支中 `博客/` 目录下的 Markdown，统一展示在列表、首页、RSS 与站点地图中。原网站的三篇文章也已迁入该仓库，网站不再单独保存文章原稿。每篇文章底部提供原文链接。

来源设置在 `blog-source.config.json`。原仓库不需要补写 frontmatter：标题取自一级标题，摘要取自正文首段，日期优先使用文中的时间范围结束日 / 完成时间，没有时间说明时使用文件首次提交日期；更新时间来自文件最近一次提交。若文章已有 YAML 信息头，则优先使用其中的标题、摘要、日期、标签和草稿设置。

仓库中的相对 Markdown 链接会指向本站对应文章，图片会指向同步版本的 GitHub 原始文件地址。新文章默认使用 `/blog/study-note/.../` 地址；迁入的三篇文章通过 `slug` 字段保留 `/blog/hello-world/` 等原有地址，请勿随意更改。

```bash
pnpm sync:blog    # 拉取仓库最新文章；正在运行的开发预览会更新
```

`pnpm dev` 优先读取上次同步的本地缓存；首次启动自动同步。`pnpm build` 始终检查远程更新，同步失败时会中止发布并保留已有文件。同步生成内容位于 `.cache/blog-sync/content/`，不会提交到网站仓库，也不应手动编辑。新增、修改或删除文章，都请在 Study-Note 中进行。

网站工作流除了每次网站提交时同步，也设置了每 6 小时同步构建一次；可以在 GitHub Actions 中手动运行部署来立即更新。定时任务使用默认分支，部署更新后的工作流后才生效。

### 精确设置文章信息（可选）

在 Study-Note 的 `博客/` 目录新建 `.md` 文件，正文可以直接从一级标题开始。需要精确控制展示信息时，可填写：

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
| `title` | | 标题；默认从一级标题提取 |
| `description` | | 摘要；默认从正文首段提取 |
| `pubDate` | | 发布日期；默认从时间说明或首次提交日期提取 |
| `updatedDate` | | 更新时间，会显示在文章页 |
| `tags` | | 标签数组 |
| `cover` | | 封面图路径，用于文章页与分享预览 |
| `draft` | | `true` 时不参与构建，本地也看不到 |
| `slug` | | 自定义 `/blog/` 后的地址；迁入文章用它维持旧链接 |

写错字段名或类型 → 构建直接报错，不会带着错误上线。

文章图片放在 Study-Note 中，通过 `./images/xxx.png` 等相对路径引用。网站的头像、作品封面等资源仍放在本项目的 `public/` 目录。

---

## 三、本地预览

环境统一使用 Node.js 24 和 pnpm 11.10.0（版本记录在 `package.json`）。

```bash
pnpm install
pnpm dev          # http://localhost:4321
pnpm check        # 检查 Astro 与 TypeScript 类型
pnpm test:blog    # 检查独立博客仓库的格式与链接适配
pnpm build        # 同步文章、检查类型，再构建到 dist/
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
用户主页仓库 `<用户名>.github.io` 部署在 `https://<用户名>.github.io/`；其他仓库默认部署在 `https://<用户名>.github.io/<仓库名>/`。

拉取请求也会运行类型检查与构建，但不会部署。合并到 main、手动触发或每 6 小时的定时工作流会同步文章并发布。

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
| 卡片倾斜角度 | `BaseLayout.astro` 脚本里的 `MAX`（默认 6 度） |
| 磁性按钮吸力 | 同文件 `* 0.22` 那个系数 |
| 吸顶叙事的滚动长度 | `Story.astro` 里 `.stage` 的 `height: 300vh` |
| 渐变字颜色 | `global.css` 的 `.grad` |

**降级规则（已内置，不用你管）：**
- `prefers-reduced-motion: reduce` → 关闭滚动叙事、背景移动与主要入场动效，三段叙事顺序展示
- 禁用 JavaScript → 标题、列表和三段叙事仍正常可读
- 文章页 → 保留词汇飘浮动画，与其他页面一致
- 背景完全淡出或页面进入后台 → 词汇动画暂停，恢复可见后继续
- 触屏设备 → 光标轨迹自动隐藏
- 指针静止 700ms → 轨迹的 rAF 自动停，不空转耗电

**加一个新的"卡片可倾斜"元素**，只要给它 `data-tilt` 属性；让按钮有磁性，加 `data-magnet`。

---

## 六、目录结构

```
.
├─ .github/workflows/deploy.yml   自动部署
├─ public/                        静态资源（头像、favicon、图片）
├─ blog-source.config.json        Study-Note 来源设置
├─ scripts/sync-blog.mjs          同步文章到本地缓存
├─ .cache/blog-sync/content/      构建用文章缓存，不提交、不手动编辑
├─ src/
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
| `pages/blog/[...slug].astro` | `/blog/study-note/<文章>/` 或文章指定的 `slug` |
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
首页默认展示作品；设置 `featured: false` 后仅在作品页展示。

**Q：暗色模式怎么记不住？**
主题存在 `localStorage` 的 `theme` 键里。如果写死成 `light`，检查 `BaseLayout.astro` 里的内联脚本。

**Q：构建报 `Ignored build scripts: esbuild, sharp`？**
项目已配好 `pnpm-workspace.yaml`，正常不会出现。如果出现，跑 `pnpm approve-builds`。

**Q：文章里的代码块没高亮？**
Astro 内置 Shiki，双主题（亮/暗）已配在 `astro.config.mjs`，深色模式下会自动换配色。
