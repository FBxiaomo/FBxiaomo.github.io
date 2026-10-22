import { getCollection } from 'astro:content';

/** 所有公开文章共用草稿过滤和排序，避免列表、RSS 与文章导航不一致。 */
export async function getPublishedPosts() {
  return (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf() || a.id.localeCompare(b.id)
  );
}
