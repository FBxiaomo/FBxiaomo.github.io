/** 粗略估算阅读时长：中文 350 字/分钟，英文 200 词/分钟 */
export function readingTime(body: string | undefined): number {
  if (!body) return 1;
  const cjk = (body.match(/[\u4e00-\u9fff]/g) || []).length;
  const words = (body.match(/[a-zA-Z0-9]+/g) || []).length;
  return Math.max(1, Math.round(cjk / 350 + words / 200));
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}
