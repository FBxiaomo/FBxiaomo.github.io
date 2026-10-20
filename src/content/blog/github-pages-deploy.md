---
title: GitHub Pages 自动部署踩坑记录
description: Actions 权限、base 路径、404 页面，这三个坑基本人人都会踩。
pubDate: 2026-10-15
tags: [部署, GitHub]
---

把 Astro 部署到 GitHub Pages，官方文档写得很清楚，但第一次做还是会卡在几个地方。

## 坑一：Settings → Pages 要选 GitHub Actions

仓库设置里的 Source 有三种：

- **Deploy from a branch** —— 老方案，从 `gh-pages` 分支或 main 的 `/docs` 目录取文件
- **GitHub Actions** —— 新方案，workflow 直接上传构建产物

用新的 workflow 就必须选第二个，否则你会看到 Actions 成功了，但站点一直是 404。

## 坑二：自定义域名 + base 路径

如果你用的是 `username.github.io/repo-name/` 这种项目页，所有资源路径都要加前缀：

```js
export default defineConfig({
  site: 'https://username.github.io',
  base: '/repo-name',
});
```

但如果绑定的是**自定义域名**（`blog.example.com`），根路径就是 `/`，**不要设 base**。

这两种情况我各踩了一次。

## 坑三：404 页面

GitHub Pages 会自动把 `404.html` 当作 404 页面。Astro 的 `src/pages/404.astro` 构建出来正好是这个名字，不用额外配置。

但项目页有个细节：404 页面里的绝对路径链接（`/blog`）会跳到 `username.github.io/blog` 而不是 `/repo-name/blog`。要么用相对路径，要么上自定义域名。

## 完整 workflow

```yaml
name: Deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: withastro/action@v3
```

`withastro/action` 把装依赖、构建、上传产物全包了，比自己写省事。
