import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './.cache/blog-sync/content' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    draft: z.boolean().default(false),
    source: z.object({
      label: z.string(),
      url: z.string().url(),
      repository: z.string(),
      commit: z.string(),
      path: z.string(),
      directory: z.string(),
      routes: z.record(z.string()).optional(),
    }),
  }),
});

export const collections = { blog };
