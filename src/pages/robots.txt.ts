import type { APIContext } from 'astro';

export function GET(context: APIContext) {
  const sitemap = new URL('sitemap-index.xml', context.site).href;
  return new Response(
    ['User-agent: *', 'Allow: /', '', 'Sitemap: ' + sitemap, ''].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  );
}
