import { DIR_VEC, Level, Pig, Vec, screenDir } from '../core/types';
import { drawScene } from './scenes';

/** 每种动物的身体配色(头部用动物立绘) */
const ANIMAL_COLORS = [
  '#ffb7c5', // 猪 - 粉
  '#d9a066', // 狗 - 棕
  '#f2efe9', // 牛 - 白
  '#a9b2c0', // 大象 - 灰
  '#c99b6a', // 水豚 - 棕
  '#eef0ee', // 奶牛 - 米白
  '#b98a5a', // 脏猪 - 深棕
  '#f7b2c2', // 小猪 - 粉
];

/** 用颜色给模板上色:保留透明形状 + 叠回原始纹理保持立体感。 */
function tintSprite(img: HTMLImageElement, color: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || 128;
  c.height = img.naturalHeight || 128;
  const x = c.getContext('2d')!;
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'source-over';
  x.globalAlpha = 0.35;
  x.drawImage(img, 0, 0);
  x.globalAlpha = 1;
  return c;
}

export interface RenderPig {
  pig: Pig;
  /** 头部中心(屏幕像素,动画插值位置) */
  px: number;
  py: number;
  exiting: boolean;
}

/**
 * 菱形渲染器:整体画面旋转 45°,猪和小方格都倾斜。
 * 虚拟网格 (x,y) → 屏幕 ((x-y)*h, (x+y)*h);格子是边长 h 的菱形,猪是沿对角线的 1×2 长猪。
 * 手机竖屏适配:生成器已把猪铺成"高"的椭圆区(手机屏比例),这里按 min(宽,高)
 * 均匀缩放即可铺满屏幕;不拉伸 u/v,保证格子是正菱形、猪不重叠、点击不偏。
 */
export class Renderer {
  private readonly h: number;
  private readonly ox: number;
  private readonly oy: number;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly canvas: HTMLCanvasElement,
    private readonly level: Level,
    private readonly baseSprite?: HTMLImageElement,
    private readonly bgImage?: HTMLImageElement,
  ) {
    // 按"可见区(有猪的格子 ±1)"确定格子大小 → 猪簇放大铺满画面并居中。
    // 没有猪的格子超出屏幕也没关系(它们本来就不显示)。
    let uMin = Infinity;
    let uMax = -Infinity;
    let vMin = Infinity;
    let vMax = -Infinity;
    for (const p of level.pigs) {
      const d = DIR_VEC[p.dir];
      for (const c of [p.pos, { x: p.pos.x - d.x, y: p.pos.y - d.y }]) {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const u = c.x + dx - (c.y + dy);
            const v = c.x + dx + (c.y + dy);
            if (u < uMin) uMin = u;
            if (u > uMax) uMax = u;
            if (v < vMin) vMin = v;
            if (v > vMax) vMax = v;
          }
        }
      }
    }
    const clusterW = uMax - uMin + 2;
    const clusterH = vMax - vMin + 2;
    // 均匀缩放:猪簇整体放大到"最多占满一边"并居中。
    // 生成器已把猪铺成手机屏比例的高椭圆,所以这里放大后自然铺满屏幕。
    this.h = Math.max(
      2,
      Math.min(canvas.width / (clusterW + 1), canvas.height / (clusterH + 1)),
    );
    this.ox = canvas.width / 2 - ((uMin + uMax) / 2) * this.h;
    this.oy = canvas.height / 2 - ((vMin + vMax) / 2) * this.h;
    this.tinted = [];
    if (baseSprite && baseSprite.complete && baseSprite.naturalWidth > 0) {
      this.tinted = ANIMAL_COLORS.map((c) => tintSprite(baseSprite, c));
    }
  }

  private readonly tinted: HTMLCanvasElement[] = [];

  get cellSize(): number {
    return this.h;
  }

  cellCenter(x: number, y: number): Vec {
    return { x: this.ox + (x - y) * this.h, y: this.oy + (x + y) * this.h };
  }

  cellAt(px: number, py: number): Vec | null {
    const u = (px - this.ox) / this.h;
    const v = (py - this.oy) / this.h;
    const x = Math.round((u + v) / 2);
    const y = Math.round((v - u) / 2);
    if (x < 0 || y < 0 || x >= this.level.width || y >= this.level.height) return null;
    // 真菱形:点在菱形内(到中心的曼哈顿距离 ≤ 1)
    if (Math.abs(u - (x - y)) + Math.abs(v - (x + y)) > 1.05) return null;
    return { x, y };
  }

  /** 某个朝向对应的屏幕像素向量(一格)。 */
  screenOffset(dir: import('../core/types').Dir): Vec {
    const s = screenDir(dir);
    return { x: s.x * this.h, y: s.y * this.h };
  }

  draw(pigs: RenderPig[], hintId?: number, hintBlink = 1): void {
    const { ctx, h, level } = this;
    // 背景:有背景图则覆盖绘制,否则用程序化场景兜底
    if (this.bgImage && this.bgImage.complete && this.bgImage.naturalWidth > 0) {
      drawCover(ctx, this.bgImage, this.canvas.width, this.canvas.height);
    } else {
      const sceneIndex = Math.floor((level.id - 1) / 100) % 6;
      drawScene(ctx, this.canvas.width, this.canvas.height, sceneIndex);
    }

    // 障碍物
    for (const ob of level.obstacles) {
      const c = this.cellCenter(ob.pos.x, ob.pos.y);
      const r = h * 0.55;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#7a5a35';
      ctx.fill();
      ctx.strokeStyle = '#5c4326';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 长猪(沿对角线)
    for (const rp of pigs) {
      this.drawPig(rp);
    }

    // 提示光圈(画在猪的头部)
    if (hintId !== undefined) {
      const rp = pigs.find((p) => p.pig.id === hintId);
      if (rp) {
        ctx.beginPath();
        ctx.arc(rp.px, rp.py, h * (0.8 + 0.15 * hintBlink), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,210,63,${(0.35 + 0.65 * hintBlink).toFixed(2)})`;
        ctx.lineWidth = Math.max(3, h * 0.3);
        ctx.stroke();
      }
    }
  }

  private drawPig(rp: RenderPig): void {
    const { ctx, h } = this;
    const sd = this.screenOffset(rp.pig.dir);
    // 头部 = 动画插值位置;尾部 = 头部 - 屏幕方向*格 —— 整只猪沿对角线轨迹滑动
    const front = { x: rp.px, y: rp.py };
    const rear = { x: rp.px - sd.x * h, y: rp.py - sd.y * h };
    const color = ANIMAL_COLORS[rp.pig.id % ANIMAL_COLORS.length];
    const headImg: HTMLCanvasElement | HTMLImageElement | undefined =
      this.tinted[rp.pig.id % 8] ?? this.baseSprite;

    const isCanvas = headImg instanceof HTMLCanvasElement;
    const imgReady =
      headImg instanceof HTMLImageElement && headImg.complete && headImg.naturalWidth > 0;
    if (headImg && (isCanvas || imgReady)) {
      // 整只猪:旋转 45° 对齐斜格子,拉伸到覆盖 2 个格子;头朝移动方向
      const midX = (front.x + rear.x) / 2;
      const midY = (front.y + rear.y) / 2;
      const sizeW = h * 1.3;
      const sizeH = 2 * Math.SQRT2 * h;
      const angle = Math.atan2(sd.x, -sd.y) + Math.PI;
      ctx.save();
      ctx.translate(midX, midY);
      ctx.rotate(angle);
      ctx.drawImage(headImg, -sizeW / 2, -sizeH / 2, sizeW, sizeH);
      ctx.restore();
    } else {
      // 占位:身体胶囊 + 头圆球(无箭头)
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(4, h * 0.8);
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(rear.x, rear.y);
      ctx.lineTo(front.x, front.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(front.x, front.y, Math.max(4, h * 0.4), 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
}

/** 背景图覆盖绘制(object-fit: cover):拉伸填满并裁剪溢出。 */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
): void {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}
