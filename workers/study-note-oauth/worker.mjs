// 可直接粘贴到 Cloudflare Worker 编辑器，无第三方依赖。
const COOKIE = '__Host-study_note_oauth';
const TTL = 600;
const encoder = new TextEncoder();
const baseHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
const hex = bytes => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const clearCookie = `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;

function settings(env) {
  const origin = new URL(env.CMS_ORIGIN || 'https://fbxiaomo.github.io');
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) throw new Error('CMS_ORIGIN 必须是 HTTPS 网站来源');
  const owner = env.ALLOWED_GITHUB_LOGIN || 'FBxiaomo';
  const ownerId = env.ALLOWED_GITHUB_ID ? Number(env.ALLOWED_GITHUB_ID) : undefined;
  if (ownerId !== undefined && (!Number.isSafeInteger(ownerId) || ownerId <= 0)) throw new Error('ALLOWED_GITHUB_ID 配置无效');
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) throw new Error('请先配置 GitHub OAuth 密钥');
  return { origin: origin.origin, owner, ownerId };
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode('study-note-oauth:' + value))));
}

function same(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8', ...headers } });
}

function callbackPage(origin, token) {
  const nonce = random();
  const message = JSON.stringify('authorization:github:success:' + JSON.stringify({ token, provider: 'github' })).replace(/</g, '\\u003c');
  const destination = JSON.stringify(origin);
  return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>登录成功</title><p>登录成功，正在返回写作后台。若窗口未自动关闭，请返回原来的页面。</p><script nonce="${nonce}">
    const destination = ${destination};
    function receive(event) {
      if (event.origin !== destination || event.source !== window.opener) return;
      window.removeEventListener('message', receive);
      window.opener.postMessage(${message}, destination);
      window.close();
    }
    if (window.opener) {
      window.addEventListener('message', receive);
      window.opener.postMessage('authorizing:github', destination);
    }
  </script></html>`, { headers: {
    ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': clearCookie,
    'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
  } });
}

export function createWorker({ fetcher = fetch, now = Date.now } = {}) {
  async function github(path, token, options = {}) {
    const response = await fetcher('https://api.github.com' + path, {
      ...options,
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'study-note-cms', ...options.headers },
      signal: AbortSignal.timeout(10000),
    });
    return response;
  }
  async function isOwner(token, config) {
    const response = await github('/user', token);
    if (!response.ok) return false;
    const user = await response.json();
    return (config.ownerId === undefined || user.id === config.ownerId) && user.login?.toLowerCase() === config.owner.toLowerCase();
  }
  return {
    async fetch(request, env) {
      let config;
      try { config = settings(env); }
      catch (error) { return json({ error: error.message }, 503); }
      const url = new URL(request.url);
      try {
        if (url.pathname === '/' || url.pathname === '/health') return json({ ready: true, owner: config.owner, site: config.origin });

        if (url.pathname === '/auth') {
          if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
          if (url.searchParams.get('provider') !== 'github') return json({ error: '仅支持 GitHub 登录' }, 400);
          const state = random();
          const expires = Math.floor(now() / 1000) + TTL;
          const signature = await sign(`${state}.${expires}.${config.origin}`, env.GITHUB_CLIENT_SECRET);
          const authorize = new URL('https://github.com/login/oauth/authorize');
          authorize.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: url.origin + '/callback', scope: 'public_repo', state }).toString();
          return new Response(null, { status: 302, headers: {
            ...baseHeaders, Location: authorize.href,
            'Set-Cookie': `${COOKIE}=${state}.${expires}.${signature}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${TTL}`,
          } });
        }

        if (url.pathname === '/callback') {
          if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
          const cookie = request.headers.get('Cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
          const [nonce, expires, signature] = (cookie || '').split('.');
          const timestamp = Math.floor(now() / 1000);
          const valid = nonce && expires && signature && same(nonce, url.searchParams.get('state')) && Number(expires) > timestamp && Number(expires) <= timestamp + TTL && same(signature, await sign(`${nonce}.${expires}.${config.origin}`, env.GITHUB_CLIENT_SECRET));
          if (!valid) return json({ error: '登录校验失败或已过期，请返回写作页面重新登录' }, 400, { 'Set-Cookie': clearCookie });
          if (!url.searchParams.get('code') || url.searchParams.has('error')) return json({ error: 'GitHub 授权未完成，请重新登录' }, 400, { 'Set-Cookie': clearCookie });
          const exchange = await fetcher('https://github.com/login/oauth/access_token', {
            method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code: url.searchParams.get('code'), redirect_uri: url.origin + '/callback' }),
            signal: AbortSignal.timeout(10000),
          });
          const result = exchange.ok ? await exchange.json() : {};
          if (!result.access_token) return json({ error: 'GitHub 登录失败，请重新授权' }, 502, { 'Set-Cookie': clearCookie });
          const token = result.access_token;
          if (!await isOwner(token, config)) return json({ error: '此写作后台仅允许站主本人登录' }, 403, { 'Set-Cookie': clearCookie });
          return callbackPage(config.origin, token);
        }

        if (url.pathname === '/publish') {
          if (request.headers.get('Origin') !== config.origin) return json({ error: '不允许此网站发起发布' }, 403);
          const cors = { 'Access-Control-Allow-Origin': config.origin, Vary: 'Origin' };
          if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...baseHeaders, ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' } });
          if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);
          const token = request.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
          if (!token || !await isOwner(token, config)) return json({ error: '请使用站主 GitHub 账号重新登录' }, 403, cors);
          // 目标固定在服务端；不接受请求提供的仓库、分支或工作流。
          const response = await github('/repos/FBxiaomo/FBxiaomo.github.io/actions/workflows/deploy.yml/dispatches', token, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: 'main' }),
          });
          if (!response.ok) return json({ error: '文章已保存，但网站更新未启动，请稍后重试' }, 502, cors);
          return json({ ok: true, message: '网站正在更新，稍后刷新博客即可查看' }, 200, cors);
        }
        return json({ error: 'Not found' }, 404);
      } catch {
        return json({ error: '登录服务暂时无法连接 GitHub，请稍后重试' }, 502, { 'Set-Cookie': clearCookie });
      }
    },
  };
}

export default createWorker();
