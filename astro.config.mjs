// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 部署后把 site 改成你的真实域名，例如 'https://blog.yourname.com'
export default defineConfig({
  site: 'https://example.com',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      themes: { light: 'vitesse-light', dark: 'vitesse-dark' },
      wrap: true,
    },
  },
});
