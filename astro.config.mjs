// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { remarkRepositoryLinks } from './scripts/blog-source.mjs';

// 部署后把 site 改成你的真实域名，例如 'https://blog.yourname.com'
export default defineConfig({
  site: 'https://fbxiaomo.github.io',
  integrations: [sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/admin') })],
  markdown: {
    remarkPlugins: [remarkRepositoryLinks],
    shikiConfig: {
      themes: { light: 'vitesse-light', dark: 'vitesse-dark' },
      wrap: true,
    },
  },
});
