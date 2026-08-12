/**
 * 背景音乐:使用生成的治愈系 BGM(healing_bgm.mp3,D 大调 72BPM,柔和钢琴+弦乐)。
 * 用一个 <audio> 循环播放;音量比默认略低,避免盖过游戏音效。
 */
let audio: HTMLAudioElement | null = null;
let muted = false;
let bgmVolume = 1 / 3; // 背景音默认 1/3

function getAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!audio) {
    audio = new Audio(`${import.meta.env.BASE_URL}bgm/healing_bgm.mp3`);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = muted ? 0 : bgmVolume;
  }
  return audio;
}

export function startMusic(): void {
  const a = getAudio();
  if (!a) return;
  void a.play().catch(() => {
    /* 自动播放策略未解锁,首次点击后再试 */
  });
}

export function stopMusic(): void {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}

export function setMusicMuted(m: boolean): void {
  muted = m;
  if (audio) audio.volume = m ? 0 : bgmVolume;
}

/** 背景音音量 0..1(默认 1/3)。 */
export function setMusicVolume(v: number): void {
  bgmVolume = Math.max(0, Math.min(1, v));
  if (audio) audio.volume = muted ? 0 : bgmVolume;
}
