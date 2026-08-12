/** 轻量音效:Web Audio API 合成,无需外部音频文件。 */
let ctx: AudioContext | null = null;
let muted = false;
let sfxVolume = 1;
let master: GainNode | null = null;

export function setMuted(m: boolean): void {
  muted = m;
  if (master) {
    master.gain.setValueAtTime(m ? 0 : sfxVolume, master.context.currentTime);
  }
}

export function isMuted(): boolean {
  return muted;
}

/** 音效音量 0..1(默认 1)。 */
export function setSfxVolume(v: number): void {
  sfxVolume = Math.max(0, Math.min(1, v));
  if (master) {
    master.gain.setValueAtTime(muted ? 0 : sfxVolume, master.context.currentTime);
  }
}

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx && ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function ensureMaster(): GainNode | null {
  const c = ensureCtx();
  if (!c) return null;
  if (!master) {
    master = c.createGain();
    master.gain.value = muted ? 0 : sfxVolume;
    master.connect(c.destination);
  }
  return master;
}

function beep(
  freq: number,
  dur: number,
  type: OscillatorType = 'sine',
  gain = 0.12,
  when = 0,
): void {
  const c = ensureCtx();
  if (!c || muted) return;
  const out = ensureMaster();
  if (!out) return;
  const t = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export const sfx = {
  /** 点猪滑动 */
  slide(): void {
    beep(440, 0.08, 'triangle', 0.06);
  },
  /** 跑出棋盘 */
  exit(): void {
    beep(660, 0.14, 'sine', 0.1);
    beep(880, 0.12, 'sine', 0.08, 0.06);
  },
  /** 撞障碍回弹 */
  bounce(): void {
    beep(300, 0.09, 'square', 0.07);
    beep(190, 0.1, 'square', 0.06, 0.03);
  },
  /** 口令答对 */
  verifyOk(): void {
    beep(523, 0.08, 'sine', 0.1);
    beep(784, 0.12, 'sine', 0.1, 0.06);
  },
  /** 口令答错 */
  verifyFail(): void {
    beep(220, 0.15, 'square', 0.08);
  },
  /** 解锁彩蛋 */
  egg(): void {
    beep(660, 0.12, 'sine', 0.1);
    beep(880, 0.12, 'sine', 0.1, 0.09);
    beep(1100, 0.22, 'sine', 0.1, 0.18);
  },
  /** 通关 */
  win(): void {
    [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.18, 'sine', 0.12, i * 0.12));
  },
  /** 时间到 */
  fail(): void {
    beep(300, 0.3, 'sawtooth', 0.08);
    beep(200, 0.4, 'sawtooth', 0.08, 0.22);
  },
  /** 按钮点击 */
  click(): void {
    beep(500, 0.05, 'sine', 0.06);
  },
};
