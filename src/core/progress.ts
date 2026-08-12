/** 玩家进度:按浏览器指纹存档,下次进来续玩。 */
export interface Progress {
  fingerprint: string;
  /** 上次玩到的关卡(1 基) */
  lastLevel: number;
  /** 每关星级:关卡号 -> 1..3 */
  stars: Record<number, number>;
  /** 累计拿到的三星数(每 5 个解锁一个彩蛋) */
  total3Stars: number;
  /** 已解锁的彩蛋下标 */
  eggs: number[];
  /** 是否静音 */
  muted?: boolean;
  /** 音效音量 0..1 */
  sfxVolume?: number;
  /** 背景音音量 0..1 */
  bgmVolume?: number;
}

const KEY = 'pigrun_progress_v1';
const COOKIE = 'pigrun_progress_v1';
/** 免费隧道会随机换子域名;用父域名 cookie 让进度跨子域名共享(换域名自动恢复)。 */
function saveCookie(p: Progress): void {
  try {
    if (typeof document === 'undefined') return;
    const host = location.hostname || '';
    if (!host.endsWith('natappfree.cc')) return; // 只在隧道域名下写
    // cookie 上限约 4KB:太长时先丢 stars,再丢 eggs,保住 lastLevel/彩蛋
    let data = JSON.stringify(p);
    if (data.length > 3800) {
      data = JSON.stringify({ ...p, stars: {} });
    }
    if (data.length > 3800) {
      data = JSON.stringify({ ...p, eggs: [] });
    }
    if (data.length > 3800) return;
    document.cookie = `${COOKIE}=${encodeURIComponent(data)}; Domain=natappfree.cc; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    /* 忽略 */
  }
}

function loadCookie(): Progress | null {
  try {
    if (typeof document === 'undefined') return null;
    const m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'));
    if (!m) return null;
    const p = JSON.parse(decodeURIComponent(m[1])) as Progress;
    if (p && p.fingerprint && typeof p.lastLevel === 'number') return p;
  } catch {
    /* 忽略 */
  }
  return null;
}

/** 生成一个尽量稳定的"指纹"(UA 哈希 + 随机盐,存本地,同浏览器=同用户)。 */
export function getFingerprint(): string {
  let ua = 0;
  for (const ch of navigator.userAgent || '') ua = (ua * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${ua.toString(36)}-${rand}`;
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Progress;
      if (p && p.fingerprint) return p;
    }
    // 本域名没有 → 从父域名 cookie 恢复(换子域名后自动续)
    const cookieP = loadCookie();
    if (cookieP) {
      localStorage.setItem(KEY, JSON.stringify(cookieP));
      return cookieP;
    }
  } catch {
    /* 忽略读取失败 */
  }
  return {
    fingerprint: getFingerprint(),
    // 首次进入预置"之前用户的进度":前 6 关 3 星 + 第一个彩蛋已解锁,从第 7 关继续
    lastLevel: 7,
    stars: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3 },
    total3Stars: 6,
    eggs: [0],
    muted: false,
    sfxVolume: 1,
    bgmVolume: 1 / 3,
  };
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    saveCookie(p);
  } catch {
    /* 忽略写入失败(隐私模式等) */
  }
}
