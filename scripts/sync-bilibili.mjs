#!/usr/bin/env node
// 手动刷新 B 站粉丝数的兜底快照：src/data/bilibili.snapshot.json
// 构建时如果连不上 B 站接口（比如 CI 被风控），页面就用这份数字。
// 用法：pnpm sync:fans [UID]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const snapshotFile = path.join(root, 'src', 'data', 'bilibili.snapshot.json');

const current = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
const uid = process.argv[2] ?? current.uid;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

const res = await fetch(`https://api.bilibili.com/x/web-interface/card?mid=${uid}`, {
  headers: { 'User-Agent': UA, Accept: 'application/json' },
  signal: AbortSignal.timeout(10000),
});
if (!res.ok) throw new Error(`B 站接口返回 ${res.status}`);
const json = await res.json();
const fans = json?.data?.card?.fans;
if (typeof fans !== 'number') throw new Error(`没拿到粉丝数：${JSON.stringify(json).slice(0, 200)}`);

const next = { uid, fans, fetchedAt: new Date().toISOString() };
fs.writeFileSync(snapshotFile, JSON.stringify(next, null, 2) + '\n');
console.log(`粉丝数 ${current.fans} → ${fans}（uid ${uid}）已写入 ${path.relative(root, snapshotFile)}`);
