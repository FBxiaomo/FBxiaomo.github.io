import fs from 'node:fs';
import path from 'node:path';
import snapshot from '../data/bilibili.snapshot.json';

// B 站接口不允许跨域，粉丝数只能在构建时抓取：
//   1. 构建机在线 → 实时请求一次，写进 .cache/bilibili/fans.json（6 小时内复用，避免每次预览都打接口）
//   2. 请求失败 → 用缓存里的旧数字
//   3. 构建机断网（或 B 站风控 CI 的 IP）→ 用仓库里提交的 src/data/bilibili.snapshot.json
// 站点每 6 小时自动部署时尝试更新；接口不可用时保留旧数字与原更新时间。

export interface BilibiliStats {
  fans: number;
  /** 抓到这个数字的时间（ISO 字符串） */
  fetchedAt: string;
  source: 'live' | 'cache' | 'snapshot';
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const TTL = 6 * 60 * 60 * 1000;
const FAIL_TTL = 10 * 60 * 1000;

const cacheFile = path.join(process.cwd(), '.cache', 'bilibili', 'fans.json');

interface CacheEntry {
  uid: string;
  fans: number | null;
  fetchedAt: number;
  failedAt?: number;
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

function writeCache(entry: CacheEntry) {
  try {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(entry, null, 2));
  } catch {
    // 缓存写不进去不影响构建
  }
}

async function fetchFans(uid: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.bilibili.com/x/web-interface/card?mid=${uid}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { code?: number; data?: { card?: { fans?: number } } };
    const fans = json.data?.card?.fans;
    return typeof fans === 'number' ? fans : null;
  } catch {
    return null;
  }
}

/** 拿粉丝数；三种来源都拿不到时返回 null，卡片会退回占位样式 */
export async function getBilibiliStats(uid: string): Promise<BilibiliStats | null> {
  const now = Date.now();
  const cached = readJson<CacheEntry>(cacheFile);
  const usable = cached && cached.uid === uid && typeof cached.fans === 'number' ? cached : null;

  if (usable && now - usable.fetchedAt < TTL) {
    return { fans: usable.fans!, fetchedAt: new Date(usable.fetchedAt).toISOString(), source: 'cache' };
  }

  const recentFailure = cached?.uid === uid && cached.failedAt && now - cached.failedAt < FAIL_TTL;
  if (!recentFailure) {
    const live = await fetchFans(uid);
    if (live !== null) {
      writeCache({ uid, fans: live, fetchedAt: now });
      return { fans: live, fetchedAt: new Date(now).toISOString(), source: 'live' };
    }
    writeCache({ uid, fans: usable?.fans ?? null, fetchedAt: usable?.fetchedAt ?? 0, failedAt: now });
  }

  if (usable) {
    return { fans: usable.fans!, fetchedAt: new Date(usable.fetchedAt).toISOString(), source: 'cache' };
  }

  if (snapshot && snapshot.uid === uid && typeof snapshot.fans === 'number') {
    return { fans: snapshot.fans, fetchedAt: snapshot.fetchedAt, source: 'snapshot' };
  }
  return null;
}
