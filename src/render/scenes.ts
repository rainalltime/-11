/**
 * 程序化场景背景:6 种风格,每 100 关换一张。
 * 中间(猪所在区域)保持纯色干净,装饰只放顶部/底部边缘与四角。
 */

function grad(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, c1: string, c2: string) {
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

export function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, index: number): void {
  ctx.clearRect(0, 0, w, h);
  switch (index % 6) {
    case 0:
      farm(ctx, w, h);
      break;
    case 1:
      forest(ctx, w, h);
      break;
    case 2:
      beach(ctx, w, h);
      break;
    case 3:
      garden(ctx, w, h);
      break;
    case 4:
      snow(ctx, w, h);
      break;
    default:
      night(ctx, w, h);
  }
}

/** 顶部天空带(高度 ~20%,不侵入中间) */
function skyTop(ctx: CanvasRenderingContext2D, w: number, h: number, c1: string, c2: string): void {
  const band = h * 0.2;
  grad(ctx, 0, 0, 0, band, c1, c2);
  ctx.fillRect(0, 0, w, band);
  // 太阳(右上角)
  circle(ctx, w * 0.9, band * 0.5, h * 0.05, '#ffe9a8');
}

function farm(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  skyTop(ctx, w, h, '#bfe3ff', '#e8f6ff');
  // 中间纯草地
  ctx.fillStyle = '#8fd977';
  ctx.fillRect(0, h * 0.2, w, h * 0.8);
  // 底部边缘:深一点草地 + 角落小花
  grad(ctx, 0, h * 0.88, 0, h, '#6fc45f', '#5fb050');
  ctx.fillRect(0, h * 0.88, w, h * 0.12);
  for (let i = 0; i < 6; i++) {
    const x = i < 3 ? w * 0.03 : w * 0.94;
    const y = h * (0.9 + ((i * 13) % 8) / 100);
    circle(ctx, x, y, h * 0.018, ['#ff8fb2', '#fff', '#ffd23f'][i % 3]);
  }
}

function forest(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  skyTop(ctx, w, h, '#cfeaf2', '#eaf9f0');
  // 中间纯草地
  ctx.fillStyle = '#7fc46f';
  ctx.fillRect(0, h * 0.2, w, h * 0.8);
  // 左右边缘各几棵小松树(不侵入中间)
  for (const sx of [w * 0.04, w * 0.96]) {
    for (let i = 0; i < 3; i++) {
      const x = sx;
      const y = h * (0.28 + i * 0.2);
      ctx.fillStyle = '#3e8e4f';
      ctx.beginPath();
      ctx.moveTo(x, y - h * 0.06);
      ctx.lineTo(x - w * 0.02, y + h * 0.02);
      ctx.lineTo(x + w * 0.02, y + h * 0.02);
      ctx.closePath();
      ctx.fill();
    }
  }
  // 底部深色草地
  grad(ctx, 0, h * 0.9, 0, h, '#5fae55', '#4f9e45');
  ctx.fillRect(0, h * 0.9, w, h * 0.1);
}

function beach(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  skyTop(ctx, w, h, '#7ec8ff', '#d0eeff');
  // 中间纯海洋
  ctx.fillStyle = '#3fa9e0';
  ctx.fillRect(0, h * 0.2, w, h * 0.62);
  // 浪花细线(底部边缘处)
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = Math.max(2, h * 0.006);
  ctx.beginPath();
  ctx.moveTo(0, h * 0.79);
  for (let x = 0; x <= w; x += w * 0.04) ctx.lineTo(x, h * 0.79 + Math.sin(x * 0.06) * h * 0.008);
  ctx.stroke();
  // 底部黄沙
  grad(ctx, 0, h * 0.82, 0, h, '#f2dfa8', '#e6c982');
  ctx.fillRect(0, h * 0.82, w, h * 0.18);
  // 角落贝壳
  circle(ctx, w * 0.04, h * 0.9, h * 0.02, '#fff3d6');
  circle(ctx, w * 0.96, h * 0.93, h * 0.018, '#ffe9c2');
}

function garden(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  skyTop(ctx, w, h, '#fdeef6', '#fdf6e8');
  // 中间纯草地
  ctx.fillStyle = '#8ed473';
  ctx.fillRect(0, h * 0.2, w, h * 0.8);
  // 底部边缘花丛
  const colors = ['#ff8fb2', '#ffb347', '#d7a5f0', '#f2e38a'];
  for (let i = 0; i < 10; i++) {
    const x = i < 5 ? w * (0.03 + i * 0.015) : w * (0.88 + (i - 5) * 0.015);
    const y = h * (0.86 + ((i * 7) % 8) / 100);
    ctx.strokeStyle = '#4c9e4c';
    ctx.lineWidth = Math.max(2, h * 0.005);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h * 0.03);
    ctx.stroke();
    circle(ctx, x, y, h * 0.016, colors[i % colors.length]);
  }
  // 角落蝴蝶
  circle(ctx, w * 0.05, h * 0.3, h * 0.014, '#c26bd8');
  circle(ctx, w * 0.95, h * 0.34, h * 0.012, '#ff8fb2');
}

function snow(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  skyTop(ctx, w, h, '#cfe6ff', '#eef6ff');
  // 中间纯雪地
  ctx.fillStyle = '#f7fbff';
  ctx.fillRect(0, h * 0.2, w, h * 0.8);
  // 底部淡蓝阴影
  grad(ctx, 0, h * 0.9, 0, h, '#dceaf8', '#c8dcf0');
  ctx.fillRect(0, h * 0.9, w, h * 0.1);
  // 角落小木屋 + 松树
  const bx = w * 0.04;
  const by = h * 0.78;
  ctx.fillStyle = '#8a5a38';
  ctx.fillRect(bx, by, w * 0.09, h * 0.06);
  ctx.fillStyle = '#b23a30';
  ctx.beginPath();
  ctx.moveTo(bx - w * 0.01, by);
  ctx.lineTo(bx + w * 0.045, by - h * 0.04);
  ctx.lineTo(bx + w * 0.1, by);
  ctx.closePath();
  ctx.fill();
  // 雪花(小、稀疏,避开中间)
  for (let i = 0; i < 14; i++) {
    const sx = i < 7 ? w * 0.06 : w * 0.92;
    const sy = h * ((i * 13) % 35 + 22) / 100;
    circle(ctx, sx, sy, Math.max(1, h * 0.005), 'rgba(255,255,255,0.95)');
  }
}

function night(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  grad(ctx, 0, 0, 0, h * 0.25, '#1c2a52', '#2a3260');
  ctx.fillRect(0, 0, w, h * 0.25);
  // 中间纯深蓝
  ctx.fillStyle = '#232c55';
  ctx.fillRect(0, h * 0.25, w, h * 0.6);
  // 月亮(右上角)
  circle(ctx, w * 0.9, h * 0.1, h * 0.045, '#ffe9a8');
  circle(ctx, w * 0.885, h * 0.085, h * 0.04, '#1c2a52');
  // 星星(稀疏,避开中间)
  for (let i = 0; i < 18; i++) {
    const sx = i < 9 ? w * (0.03 + i * 0.04) : w * (0.6 + (i - 9) * 0.04);
    const sy = h * ((i * 17) % 30 + 26) / 100;
    circle(ctx, sx, sy, Math.max(1, h * 0.005), 'rgba(255,255,255,0.85)');
  }
  // 底部远山剪影
  ctx.fillStyle = '#151b36';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.88);
  ctx.lineTo(w * 0.3, h * 0.76);
  ctx.lineTo(w * 0.55, h * 0.86);
  ctx.lineTo(w * 0.8, h * 0.74);
  ctx.lineTo(w, h * 0.84);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
}
