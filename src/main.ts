import { cloneLevel, SAMPLE_LEVELS } from './core/levels';
import { decodeLevels } from './core/format';
import { GameState } from './core/logic';
import { VERIFY_PHRASES } from './core/phrases';
import { loadProgress, saveProgress } from './core/progress';
import { generateEggs } from './core/eggs';
import { sfx, setMuted, isMuted, setSfxVolume } from './core/sound';
import { startMusic, setMusicMuted, setMusicVolume } from './core/music';
import { DIR_VEC, Dir, Level, screenDir } from './core/types';
import { Renderer, RenderPig } from './render/renderer';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const canvasWrap = document.getElementById('canvas-wrap') as HTMLDivElement;
const statusEl = document.getElementById('status')!;
const timerEl = document.getElementById('timer') as HTMLSpanElement;
const timeBarEl = document.getElementById('time-bar') as HTMLDivElement;
const timeFillEl = document.getElementById('time-fill') as HTMLDivElement;
const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;
const btnMenu = document.getElementById('btn-menu') as HTMLButtonElement;
const btnEggs = document.getElementById('btn-eggs') as HTMLButtonElement;
const btnSound = document.getElementById('btn-sound') as HTMLButtonElement;
const btnSettings = document.getElementById('btn-settings') as HTMLButtonElement;
const settingsModal = document.getElementById('settings-modal') as HTMLDivElement;
const settingsClose = document.getElementById('settings-close') as HTMLButtonElement;
const btnToolHint = document.getElementById('btn-tool-hint') as HTMLButtonElement;
const btnToolRotate = document.getElementById('btn-tool-rotate') as HTMLButtonElement;
const btnToolGrab = document.getElementById('btn-tool-grab') as HTMLButtonElement;
const btnToolAddTime = document.getElementById('btn-tool-addtime') as HTMLButtonElement;
const volSfx = document.getElementById('vol-sfx') as HTMLInputElement;
const volBgm = document.getElementById('vol-bgm') as HTMLInputElement;
const modalEl = document.getElementById('modal') as HTMLDivElement;
const modalPhrase = document.getElementById('modal-phrase') as HTMLParagraphElement;
const modalInput = document.getElementById('modal-input') as HTMLInputElement;
const modalOk = document.getElementById('modal-ok') as HTMLButtonElement;
const modalCancel = document.getElementById('modal-cancel') as HTMLButtonElement;
const modalError = document.getElementById('modal-error') as HTMLParagraphElement;
const doneModal = document.getElementById('done-modal') as HTMLDivElement;
const doneStars = document.getElementById('done-stars') as HTMLParagraphElement;
const doneNext = document.getElementById('done-next') as HTMLButtonElement;
const doneRetry = document.getElementById('done-retry') as HTMLButtonElement;
const doneMenu = document.getElementById('done-menu') as HTMLButtonElement;
const menuModal = document.getElementById('menu-modal') as HTMLDivElement;
const menuGrid = document.getElementById('menu-grid') as HTMLDivElement;
const menuClose = document.getElementById('menu-close') as HTMLButtonElement;
const eggModal = document.getElementById('egg-modal') as HTMLDivElement;
const eggText = document.getElementById('egg-text') as HTMLParagraphElement;
const eggOk = document.getElementById('egg-ok') as HTMLButtonElement;
const eggListModal = document.getElementById('egg-list-modal') as HTMLDivElement;
const eggList = document.getElementById('egg-list') as HTMLDivElement;
const eggListClose = document.getElementById('egg-list-close') as HTMLButtonElement;

let levelIndex = 0;
/** 关卡池:启动时尝试加载生成器产出的关卡;失败则退回手摆样例 */
let levels: Level[] = SAMPLE_LEVELS;
let progress = loadProgress();
let eggs: string[] = [];
let state: GameState;
let renderer: Renderer;
/** 当前关卡可解性缓存(滑动感知,切关时算一次)。 */
let currentSolvable = true;
/** 动物模板:用 dirtypig 一张图,按不同颜色上色(原版做法) */
let baseSprite: HTMLImageElement | undefined;

function loadBaseSprite(): void {
  const img = new Image();
  img.onload = () => {
    baseSprite = img;
    if (state && renderer) {
      renderer = new Renderer(ctx, canvas, state.level, baseSprite, currentBg());
      render();
    }
  };
  img.src = `${import.meta.env.BASE_URL}pig/animal_dirtypig.png`;
  baseSprite = img;
}

/** 10 张背景图,每 100 关换一张 */
let bgImages: HTMLImageElement[] = [];

function loadBgs(): void {
  bgImages = Array.from({ length: 10 }, (_, i) => {
    const img = new Image();
    img.onload = () => {
      if (state && renderer) {
        renderer = new Renderer(ctx, canvas, state.level, baseSprite, currentBg());
        render();
      }
    };
    img.src = `${import.meta.env.BASE_URL}bg/bg${i}.jpg`;
    return img;
  });
}

function currentBg(): HTMLImageElement | undefined {
  if (!state) return undefined;
  const idx = Math.floor((state.level.id - 1) / 100) % 10;
  return bgImages[idx];
}
/** 播放中的动画;动画期间锁输入 */
let animating = false;

interface Anim {
  pigId: number;
  dir: Dir;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  exiting: boolean;
  /** 撞障碍物的回弹距离(像素);撞猪或飞出时无 */
  bounce?: number;
  t: number;
  duration: number;
}

let anims: Anim[] = [];
/** 提示:当前高亮哪只猪 */
let hintPigId: number | null = null;
let hintTimer: number | undefined;
let hintRaf: number | undefined;
let hintBlink = 0;
/** 掉头模式:true 时,下一只被点击的猪反转 180° */
let reverseMode = false;
/** 抓走模式:true 时,下一只被点击的猪被直接移除 */
let grabMode = false;
/** 等待口令验证的道具类型 */
let pendingTool: 'hint' | 'rotate' | 'grab' | 'addtime' | null = null;
let currentPhrase = '';

/** 倒计时(毫秒):按难度 5分钟→3分钟 */
let timeMs = 0;
let initialTimeMs = 0; // 本关初始时间,用于进度条百分比
let timerPaused = false; // 口令验证时暂停
let timeUp = false;

/** 画布自适应容器:按设备像素比设置内部分辨率,重建渲染器以重算格子大小。 */
function resizeCanvas(): void {
  const rect = canvasWrap.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  if (w <= 1 || h <= 1) {
    // 布局尚未就绪,稍后重试
    requestAnimationFrame(resizeCanvas);
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  if (state && renderer) {
  renderer = new Renderer(ctx, canvas, state.level, baseSprite, currentBg());
    render();
  }
  console.log(`[resize] 画布 ${canvas.width}x${canvas.height} (CSS ${w}x${h})`);
}

new ResizeObserver(() => resizeCanvas()).observe(canvasWrap);
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);
window.addEventListener('load', resizeCanvas);

function loadLevel(index: number): void {
  const level = cloneLevel(levels[index]);
  state = new GameState(level);
  renderer = new Renderer(ctx, canvas, level, baseSprite, currentBg());
  anims = [];
  animating = false;
  hintPigId = null;
  hintBlink = 0;
  if (hintTimer !== undefined) window.clearTimeout(hintTimer);
  if (hintRaf !== undefined) cancelAnimationFrame(hintRaf);
  reverseMode = false;
  grabMode = false;
  timeUp = false;
  timerPaused = false;
  timeMs = startTimeForLevel();
  initialTimeMs = timeMs;
  setupTimeBar();
  closeVerify();
  currentSolvable = GameState.solveSliding(level, 120000).solvable;
  console.log(`第 ${level.id} 关 可解性(滑动感知):`, currentSolvable);
  render();
  renderTimer();
  updateStatus();
  progress.lastLevel = levelIndex + 1;
  saveProgress(progress);
}

/** 每只猪 1.5 秒:时间 = 猪数 × 1.5 秒(至少 60 秒,避免教学关太短)。 */
function startTimeForLevel(): number {
  const pigCount = state?.level.pigs.length ?? 0;
  return Math.max(60000, Math.round(pigCount * 1500));
}

function renderTimer(): void {
  const s = Math.max(0, Math.ceil(timeMs / 1000));
  if (timeUp) {
    timerEl.textContent = '⏱ 0:00';
  } else {
    timerEl.textContent = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  timerEl.classList.toggle('low', !timeUp && s <= 30);
  const pct = initialTimeMs > 0 ? Math.max(0, Math.min(100, (timeMs / initialTimeMs) * 100)) : 0;
  timeFillEl.style.width = pct + '%';
  timeFillEl.classList.toggle('low', !timeUp && s <= 30);
}

/** 进度条:标记 30s/20s/10s 三个"丢星"阈值(低于该位置就少一颗星)。 */
function setupTimeBar(): void {
  timeBarEl.querySelectorAll('.tick').forEach((t) => t.remove());
  const thresholds = [30, 20, 10];
  for (const t of thresholds) {
    if (initialTimeMs <= 0) continue;
    const tick = document.createElement('span');
    tick.className = 'tick';
    tick.style.left = (Math.min(98, (t * 1000) / initialTimeMs * 100)) + '%';
    timeBarEl.appendChild(tick);
  }
  timeFillEl.style.width = '100%';
}

/** 计时器:每 500ms 减一次;口令验证/通关后暂停。 */
setInterval(() => {
  if (!state || timeUp || timerPaused || state.cleared()) return;
  timeMs -= 500;
  if (timeMs <= 0) {
    timeMs = 0;
    timeUp = true;
    sfx.fail();
    statusEl.textContent = '⏰ 时间到!这关失败了,点"重开"再来。';
  }
  renderTimer();
}, 500);

function updateStatus(): void {
  const remaining = state.pigs.length;
  const toolMode = grabMode
    ? ' | 🐷 请点一只猪抓走'
    : reverseMode
      ? ' | 🔃 请点一只猪掉头'
      : '';
  statusEl.textContent =
    `第 ${levelIndex + 1}/${levels.length} 关 | 剩余 ${remaining} | 点击 ${state.taps} 次 | ` +
    `${currentSolvable ? '✓必有解' : '✗无解'}${toolMode}`;
}

function render(): void {
  const pigs: RenderPig[] = state.pigs.map((p) => {
    const c = renderer.cellCenter(p.pos.x, p.pos.y);
    return { pig: p, px: c.x, py: c.y, exiting: false };
  });
  for (const a of anims) {
    let idx = pigs.findIndex((r) => r.pig.id === a.pigId);
    if (idx < 0) {
      // 已从 state 移除(跑出)的猪:用动画数据补一张"幽灵"继续画
      idx = pigs.length;
      pigs.push({
        pig: { id: a.pigId, pos: { x: -1, y: -1 }, dir: a.dir },
        px: a.fromX,
        py: a.fromY,
        exiting: a.exiting,
      });
    }
    const p = animPos(a);
    pigs[idx].px = p.x;
    pigs[idx].py = p.y;
    pigs[idx].exiting = a.exiting;
  }
  renderer.draw(pigs, hintPigId ?? undefined, hintBlink);
}

function clearHint(): void {
  hintPigId = null;
  hintBlink = 0;
  if (hintTimer !== undefined) window.clearTimeout(hintTimer);
  if (hintRaf !== undefined) cancelAnimationFrame(hintRaf);
}

function onTapAt(cx: number, cy: number): void {
  // 允许动画播放中继续点(状态即时更新,动画叠加播放)
  if (state.cleared() || timeUp) return;
  const cell = renderer.cellAt(cx, cy);
  if (!cell) return;
  const pig = state.pigAt(cell.x, cell.y);
  if (!pig) return;

  // 抓走模式:点中的猪直接移除
  if (grabMode) {
    state.removePig(pig.id);
    grabMode = false;
    sfx.exit();
    updateStatus();
    render();
    if (state.cleared()) {
      onCleared();
    }
    return;
  }

  // 掉头模式:点中的猪反转 180°
  if (reverseMode) {
    state.reverse(pig.id);
    reverseMode = false;
    sfx.click();
    updateStatus();
    render();
    return;
  }

  clearHint();

  const from = renderer.cellCenter(pig.pos.x, pig.pos.y);
  const result = state.slideTarget(pig); // 非破坏性:先算目标
  if (result.exited) sfx.exit();
  else if (result.blockedBy === 'obstacle') sfx.bounce();
  else sfx.slide();
  const dir = pig.dir;
  const fromCell = { ...pig.pos }; // 记下 tap 前的格子(用于动画时长)
  state.tap(pig.id); // 破坏性:更新状态

  if (result.exited) {
    // 跑出棋盘:动画严格沿对角射线,终点 = 第一个出界格子的中心
    const d = DIR_VEC[dir];
    const cells = exitCells(pig, d);
    const end = exitEndpoint(pig, d);
    anims.push({
      pigId: pig.id,
      dir,
      fromX: from.x,
      fromY: from.y,
      toX: end.x,
      toY: end.y,
      exiting: true,
      t: 0,
      duration: animDuration(cells),
    });
  } else if (result.target) {
    const to = renderer.cellCenter(result.target.x, result.target.y);
    const cells = Math.abs(result.target.x - fromCell.x);
    const bounce = result.blockedBy === 'obstacle' ? renderer.cellSize * 0.3 : undefined;
    anims.push({
      pigId: pig.id,
      dir,
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      exiting: false,
      ...(bounce ? { bounce } : {}),
      t: 0,
      duration: animDuration(cells) + (bounce ? 150 : 0),
    });
  }
  if (!animating) {
    animating = true;
    requestAnimationFrame(tick);
  }
}

/** 动画时长:滑动与飞出统一速度(约 9 格/秒),只设一个最低时长保证可读。 */
function animDuration(cells: number): number {
  return Math.max(160, cells * 110);
}

/** 沿 dir 跑出棋盘需要的格子数(用于退出动画时长)。 */
function exitCells(pig: { pos: { x: number; y: number } }, d: { x: number; y: number }): number {
  let x = pig.pos.x;
  let y = pig.pos.y;
  let n = 0;
  while (true) {
    x += d.x;
    y += d.y;
    if (x < 0 || y < 0 || x >= state.level.width || y >= state.level.height) {
      return n + 1;
    }
    n++;
  }
}

/**
 * 飞出终点:从猪的格子出发,沿对角方向延伸到"第一个出界格子"的中心。
 * 这样动画轨迹严格落在格子对角线上,只经过空格子,不会扫过旁边有猪的格子。
 */
function exitEndpoint(
  pig: { pos: { x: number; y: number } },
  d: { x: number; y: number },
): { x: number; y: number } {
  const { width: w, height: h } = state.level;
  let lx = pig.pos.x;
  let ly = pig.pos.y;
  while (lx + d.x >= 0 && ly + d.y >= 0 && lx + d.x < w && ly + d.y < h) {
    lx += d.x;
    ly += d.y;
  }
  // 第一个出界格子再往外一格:让 1×2 的整只猪都离开棋盘
  return renderer.cellCenter(lx + d.x * 2, ly + d.y * 2);
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

/** 回弹位置:0~0.75 滑近障碍 → 0.75~0.9 向后回弹 → 0.9~1 归位。 */
function animPos(a: Anim): { x: number; y: number } {
  if (a.bounce) {
    const d = screenDir(a.dir);
    const rx = a.toX - d.x * a.bounce;
    const ry = a.toY - d.y * a.bounce;
    const t = a.t;
    if (t < 0.75) {
      const k = t / 0.75;
      return { x: lerp(a.fromX, a.toX, k), y: lerp(a.fromY, a.toY, k) };
    } else if (t < 0.9) {
      return { x: lerp(a.toX, rx, (t - 0.75) / 0.15), y: lerp(a.toY, ry, (t - 0.75) / 0.15) };
    } else {
      return { x: lerp(rx, a.toX, (t - 0.9) / 0.1), y: lerp(ry, a.toY, (t - 0.9) / 0.1) };
    }
  }
  return { x: a.fromX + (a.toX - a.fromX) * a.t, y: a.fromY + (a.toY - a.fromY) * a.t };
}

let lastTime = 0;
function tick(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  let done = true;
  for (const a of anims) {
    a.t += dt / (a.duration / 1000);
    if (a.t >= 1) {
      a.t = 1;
    } else {
      done = false;
    }
  }
  if (done) {
    // 移除已跑出的猪
    for (const a of anims) {
      if (a.exiting) {
        state.pigs = state.pigs.filter((p) => p.id !== a.pigId);
      }
    }
    anims = [];
    animating = false;
  }
  render();
  if (!done) {
    requestAnimationFrame(tick);
  }
  updateStatus();
  if (state.cleared() && !animating) {
    onCleared();
  }
}

/** 通关:按剩余时间给星(≥30秒=3星, ≥20秒=2星, ≥10秒=1星, <10秒=0星)。 */
function onCleared(): void {
  const stars = timeMs >= 30000 ? 3 : timeMs >= 20000 ? 2 : timeMs >= 10000 ? 1 : 0;
  const lvId = state.level.id;
  const oldStars = progress.stars[lvId] ?? 0;
  if (stars > oldStars) {
    progress.stars[lvId] = stars;
    if (stars === 3 && oldStars !== 3) {
      progress.total3Stars++;
      // 每拿到第 5 个三星解锁一个彩蛋
      if (progress.total3Stars % 5 === 0) {
        const eggIndex = progress.total3Stars / 5 - 1;
        if (eggIndex >= 0 && eggIndex < eggs.length && !progress.eggs.includes(eggIndex)) {
          progress.eggs.push(eggIndex);
          showEgg(eggIndex);
        }
      }
    }
  }
  progress.lastLevel = Math.max(progress.lastLevel, lvId + 1);
  saveProgress(progress);
  sfx.win();
  doneStars.textContent = `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`;
  doneModal.classList.remove('hidden');
  renderTimer();
}

/* ---------- 道具:口令验证 ---------- */

function openVerify(tool: 'hint' | 'rotate' | 'grab' | 'addtime'): void {
  pendingTool = tool;
  currentPhrase = VERIFY_PHRASES[Math.floor(Math.random() * VERIFY_PHRASES.length)];
  modalPhrase.textContent = currentPhrase;
  modalInput.value = '';
  modalError.classList.add('hidden');
  modalEl.classList.remove('hidden');
  timerPaused = true; // 口令验证时计时暂停
  modalInput.focus();
}

function closeVerify(): void {
  pendingTool = null;
  modalEl.classList.add('hidden');
  timerPaused = false; // 关闭验证,恢复计时
}

function confirmVerify(): void {
  if (modalInput.value.trim() === currentPhrase) {
    const tool = pendingTool;
    closeVerify();
    if (tool === 'hint') {
      doHint();
    } else if (tool === 'rotate') {
      reverseMode = true;
      updateStatus();
    } else if (tool === 'grab') {
      grabMode = true;
      updateStatus();
    } else if (tool === 'addtime') {
      timeMs += 60000;
      renderTimer();
    }
    sfx.verifyOk();
  } else {
    modalError.classList.remove('hidden');
    modalInput.select();
    sfx.verifyFail();
  }
}

function doHint(): void {
  const p = state.hintSliding();
  if (p) {
    hintPigId = p.id;
    if (hintTimer !== undefined) window.clearTimeout(hintTimer);
    if (hintRaf !== undefined) cancelAnimationFrame(hintRaf);
    const start = performance.now();
    const blink = (now: number): void => {
      if (hintPigId === null) return;
      hintBlink = 0.5 + 0.5 * Math.abs(Math.sin(((now - start) / 1000) * Math.PI * 4));
      render();
      hintRaf = requestAnimationFrame(blink);
    };
    hintRaf = requestAnimationFrame(blink);
    hintTimer = window.setTimeout(() => {
      hintPigId = null;
      hintBlink = 0;
      render();
    }, 4000);
    render();
  } else {
    statusEl.textContent = '没有可提示的猪(棋盘已清空或真的卡死了)';
  }
}

btnToolHint.addEventListener('click', () => openVerify('hint'));
btnToolRotate.addEventListener('click', () => openVerify('rotate'));
btnToolGrab.addEventListener('click', () => openVerify('grab'));
btnToolAddTime.addEventListener('click', () => openVerify('addtime'));
modalOk.addEventListener('click', confirmVerify);
modalCancel.addEventListener('click', closeVerify);
modalInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') confirmVerify();
  if (e.key === 'Escape') closeVerify();
});

/* ---------- 选关 / 彩蛋 ---------- */

function openMenu(): void {
  menuGrid.innerHTML = '';
  for (let i = 0; i < levels.length; i++) {
    const b = document.createElement('button');
    b.textContent = String(i + 1);
    const st = progress.stars[levels[i].id] ?? 0;
    if (st > 0) {
      const s = document.createElement('span');
      s.className = 'star';
      s.textContent = '★'.repeat(st);
      b.appendChild(s);
    }
    b.addEventListener('click', () => {
      menuModal.classList.add('hidden');
      levelIndex = i; // 先记录所选关卡,否则状态/重开/下一关会用旧关卡
      loadLevel(i);
    });
    menuGrid.appendChild(b);
  }
  menuModal.classList.remove('hidden');
}

function openEggList(): void {
  eggList.innerHTML = '';
  for (let i = 0; i < eggs.length; i++) {
    const div = document.createElement('div');
    const has = progress.eggs.includes(i);
    div.className = 'egg-item' + (has ? '' : ' locked');
    div.textContent = `${i + 1}. ${has ? eggs[i] : '???'}`;
    eggList.appendChild(div);
  }
  eggListModal.classList.remove('hidden');
}

function showEgg(index: number): void {
  eggText.textContent = eggs[index] ?? '爱你哟';
  eggModal.classList.remove('hidden');
  sfx.egg();
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  onTapAt((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
});

const closeSettings = (): void => settingsModal.classList.add('hidden');
btnSettings.addEventListener('click', () => settingsModal.classList.remove('hidden'));
settingsClose.addEventListener('click', closeSettings);
btnRestart.addEventListener('click', () => {
  closeSettings();
  loadLevel(levelIndex);
});
btnMenu.addEventListener('click', () => {
  closeSettings();
  openMenu();
});
btnEggs.addEventListener('click', () => {
  closeSettings();
  openEggList();
});
btnSound.addEventListener('click', () => {
  const m = !isMuted();
  setMuted(m);
  setMusicMuted(m);
  progress.muted = m;
  saveProgress(progress);
  btnSound.textContent = m ? '🔇' : '🔊';
  if (!m) sfx.click();
});

// 音量滑块:音效 / 背景音(背景音默认 1/3)
function applyVolumes(): void {
  const sfxV = Math.max(0, Math.min(1, progress.sfxVolume ?? 1));
  const bgmV = Math.max(0, Math.min(1, progress.bgmVolume ?? 1 / 3));
  volSfx.value = String(Math.round(sfxV * 100));
  volBgm.value = String(Math.round(bgmV * 100));
  setSfxVolume(sfxV);
  setMusicVolume(bgmV);
}
volSfx.addEventListener('input', () => {
  progress.sfxVolume = Number(volSfx.value) / 100;
  saveProgress(progress);
  setSfxVolume(progress.sfxVolume);
  sfx.click();
});
volBgm.addEventListener('input', () => {
  progress.bgmVolume = Number(volBgm.value) / 100;
  saveProgress(progress);
  setMusicVolume(progress.bgmVolume);
});
doneNext.addEventListener('click', () => {
  doneModal.classList.add('hidden');
  levelIndex = (levelIndex + 1) % levels.length;
  loadLevel(levelIndex);
});
doneRetry.addEventListener('click', () => {
  doneModal.classList.add('hidden');
  loadLevel(levelIndex);
});
doneMenu.addEventListener('click', () => {
  doneModal.classList.add('hidden');
  openMenu();
});
menuClose.addEventListener('click', () => menuModal.classList.add('hidden'));
eggOk.addEventListener('click', () => eggModal.classList.add('hidden'));
eggListClose.addEventListener('click', () => eggListModal.classList.add('hidden'));

async function boot(): Promise<void> {
  resizeCanvas();
  setMuted(progress.muted ?? false);
  setMusicMuted(progress.muted ?? false);
  btnSound.textContent = isMuted() ? '🔇' : '🔊';
  applyVolumes();
  loadBaseSprite();
  loadBgs();
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}levels/levels.json`);
    if (res.ok) {
      const data = await res.json();
      const decoded = decodeLevels(data);
      if (decoded.length > 0) {
        levels = decoded;
        console.log(`已加载生成器关卡 ${levels.length} 关`);
      }
    }
  } catch (e) {
    console.warn('关卡加载失败,使用手摆样例关卡', e);
  }
  eggs = generateEggs(Math.max(1, Math.ceil(levels.length / 5)));
  const resume = Math.min(levels.length - 1, Math.max(0, (progress.lastLevel || 1) - 1));
  levelIndex = resume;
  loadLevel(levelIndex);
}

// 首次点按后启动背景音乐(满足浏览器自动播放策略)
document.addEventListener(
  'pointerdown',
  () => {
    startMusic();
  },
  { once: true },
);

boot();
