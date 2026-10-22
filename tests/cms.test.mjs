import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorker } from '../workers/study-note-oauth/worker.mjs';
import { createCmsConfig } from '../scripts/cms-config.mjs';
import { prepareCmsMarkdown } from '../scripts/prepare-cms-content.mjs';
import matter from 'gray-matter';

const base = 'https://study-note-oauth.example.workers.dev';
const origin = 'https://fbxiaomo.github.io';
const env = { GITHUB_CLIENT_ID: 'public-id', GITHUB_CLIENT_SECRET: 'test-secret-do-not-deploy', ALLOWED_GITHUB_LOGIN: 'FBxiaomo', ALLOWED_GITHUB_ID: '123', CMS_ORIGIN: origin };

async function start(worker, variables = env) {
  const response = await worker.fetch(new Request(base + '/auth?provider=github'), variables);
  assert.equal(response.status, 302);
  const cookie = response.headers.get('Set-Cookie');
  const state = new URL(response.headers.get('Location')).searchParams.get('state');
  return { cookie: cookie.split(';')[0], state, response };
}

test('OAuth redirect binds unpredictable state to a signed, secure expiring cookie', async () => {
  const worker = createWorker();
  const a = await start(worker);
  const b = await start(worker);
  assert.notEqual(a.state, b.state);
  assert.equal(a.state.length, 64);
  assert.match(a.response.headers.get('Set-Cookie'), /Secure; HttpOnly; SameSite=Lax; Max-Age=600/);
  const redirect = new URL(a.response.headers.get('Location'));
  assert.equal(redirect.origin, 'https://github.com');
  assert.equal(redirect.searchParams.get('redirect_uri'), base + '/callback');
  assert.equal(redirect.searchParams.get('scope'), 'public_repo');
  assert(!redirect.href.includes(env.GITHUB_CLIENT_SECRET));
});

test('missing, changed, tampered or expired login state never reaches GitHub token exchange', async () => {
  let calls = 0;
  let time = 1700000000000;
  const worker = createWorker({ now: () => time, fetcher: async () => { calls++; throw new Error('unexpected network'); } });
  const auth = await start(worker);
  const callback = (state, cookie = auth.cookie) => worker.fetch(new Request(base + '/callback?code=code&state=' + state, { headers: { Cookie: cookie } }), env);
  assert.equal((await callback(auth.state, '')).status, 400);
  assert.equal((await callback('different')).status, 400);
  assert.equal((await callback(auth.state, auth.cookie.slice(0, -1) + (auth.cookie.endsWith('0') ? '1' : '0'))).status, 400);
  time += 601000;
  assert.equal((await callback(auth.state)).status, 400);
  assert.equal(calls, 0);
});

test('successful login validates GitHub identity and sends the token only to the configured website', async () => {
  const calls = [];
  const worker = createWorker({ fetcher: async (url, options) => {
    calls.push({ url, options });
    return Response.json(url.includes('access_token') ? { access_token: 'owner-token' } : { login: 'FBxiaomo', id: 123 });
  } });
  const auth = await start(worker);
  const response = await worker.fetch(new Request(base + '/callback?code=valid&state=' + auth.state, { headers: { Cookie: auth.cookie } }), env);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert(html.includes(origin));
  assert(html.includes('event.origin !== destination'));
  assert(html.includes('event.source !== window.opener'));
  assert(!html.includes("postMessage('authorizing:github', '*')"));
  assert(response.headers.get('Content-Security-Policy').includes('frame-ancestors'));
  assert(response.headers.get('Set-Cookie').includes('Max-Age=0'));
  assert.equal(calls[1].url, 'https://api.github.com/user');
});

test('other GitHub users cannot receive a publishing token', async () => {
  const worker = createWorker({ fetcher: async url => Response.json(url.includes('access_token') ? { access_token: 'other-token' } : { login: 'someone-else', id: 999 }) });
  const auth = await start(worker);
  const response = await worker.fetch(new Request(base + '/callback?code=valid&state=' + auth.state, { headers: { Cookie: auth.cookie } }), env);
  assert.equal(response.status, 403);
  assert(!(await response.text()).includes('other-token'));
});

test('publish rejects wrong origins, missing credentials and unauthorized users', async () => {
  const worker = createWorker({ fetcher: async () => Response.json({ login: 'someone-else', id: 999 }) });
  const request = (headers) => worker.fetch(new Request(base + '/publish', { method: 'POST', headers }), env);
  assert.equal((await request({ Origin: 'https://evil.example', Authorization: 'Bearer token' })).status, 403);
  assert.equal((await request({ Origin: origin })).status, 403);
  assert.equal((await request({ Origin: origin, Authorization: 'Bearer other-token' })).status, 403);
});

test('publish verifies the owner and dispatches only the fixed website workflow', async () => {
  const calls = [];
  const worker = createWorker({ fetcher: async (url, options) => {
    calls.push({ url, options });
    return url.endsWith('/user') ? Response.json({ login: 'FBxiaomo', id: 123 }) : new Response(null, { status: 204 });
  } });
  const response = await worker.fetch(new Request(base + '/publish', { method: 'POST', headers: { Origin: origin, Authorization: 'Bearer owner-token' }, body: JSON.stringify({ repo: 'attacker/repo', ref: 'evil' }) }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(calls[1].url, 'https://api.github.com/repos/FBxiaomo/FBxiaomo.github.io/actions/workflows/deploy.yml/dispatches');
  assert.deepEqual(JSON.parse(calls[1].options.body), { ref: 'main' });
});

test('missing secrets fail closed and upstream errors do not disclose credentials', async () => {
  const worker = createWorker({ fetcher: async () => { throw new Error('token-secret'); } });
  assert.equal((await worker.fetch(new Request(base + '/auth?provider=github'), {})).status, 503);
  const auth = await start(worker);
  const response = await worker.fetch(new Request(base + '/callback?code=valid&state=' + auth.state, { headers: { Cookie: auth.cookie } }), env);
  assert.equal(response.status, 502);
  assert(!(await response.text()).includes('token-secret'));
});

test('CMS edits Study-Note only, preserves URL fields and matches the website Markdown schema', () => {
  const config = createCmsConfig({ source: { repository: 'FBxiaomo/Study-Note', branch: 'main', directory: '博客', tags: ['学习笔记'] }, cms: { oauthBaseUrl: base + '/', siteUrl: origin } });
  assert.equal(config.backend.repo, 'FBxiaomo/Study-Note');
  assert.equal(config.backend.base_url, base);
  assert.equal(config.collections[0].folder, '博客');
  const fields = config.collections[0].fields;
  assert(fields.find(field => field.name === 'slug'));
  assert(fields.find(field => field.name === 'body').widget === 'markdown');
  assert.equal(config.media_folder, '博客/images');
  assert.equal(config.public_folder, './images');
  assert.throws(() => createCmsConfig({ source: {}, cms: { oauthBaseUrl: 'http://example.com' } }));
});

test('one-time CMS preparation preserves old note bodies, dates and addresses', () => {
  const original = '# 旧笔记\n\n> 时间范围：2026.9.7 — 2026.9.13\n\n原文正文与代码不改变。\n';
  const normalized = matter.stringify(original, { title: '旧笔记', description: '摘要', pubDate: '2026-09-13', tags: ['学习笔记'], draft: false, slug: 'study-note/old', source: { url: 'https://example.com' } });
  const prepared = matter(prepareCmsMarkdown(original, normalized));
  assert.equal(prepared.content, original);
  assert.equal(prepared.data.pubDate, '2026-09-13');
  assert.equal(prepared.data.slug, 'study-note/old');
  assert.equal(prepared.data.source, undefined);
  const existing = '---\ntitle: 已有文章\ndescription: 原摘要\npubDate: 2026-10-20\nslug: hello-world\n---\n原文';
  assert.equal(prepareCmsMarkdown(existing, normalized), existing);
});
