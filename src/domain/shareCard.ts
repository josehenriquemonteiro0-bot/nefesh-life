/**
 * Cartão de evolução partilhável (especificação v2, secção 9): imagem 1080×1350 com a
 * marca NEFESH, desenhada no telemóvel, para o Instagram ou o WhatsApp.
 * Não inclui dados de saúde: só o progresso do desafio, dias de ritual e a sequência.
 */

export interface ShareCard {
  title: string;
  subtitle: string;
  progress?: { done: number; total: number };
  stats: [string, string][];
  nick: string;
  link: string;
}

const W = 1080;
const H = 1350;
const NEON = '#00FE8A';
const GOLD = '#C9A85C';

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > max && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

export async function drawShareCard(c: ShareCard): Promise<Blob> {
  try {
    await document.fonts?.ready;
  } catch {
    /* sem fontes: usa as do sistema */
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  // fundo
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#003a40');
  g.addColorStop(0.55, '#06181a');
  g.addColorStop(1, '#060d0e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.85, H * 0.12, 20, W * 0.85, H * 0.12, 520);
  glow.addColorStop(0, 'rgba(0,254,138,.28)');
  glow.addColorStop(1, 'rgba(0,254,138,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const font = (w: number, size: number) => `${w} ${size}px Sora, "Segoe UI", system-ui, sans-serif`;
  // marca
  ctx.fillStyle = NEON;
  ctx.font = font(700, 64);
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('nefesh', 90, 150);
  const mw = ctx.measureText('nefesh').width;
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.fillRect(90 + mw + 24, 104, 3, 56);
  ctx.fillStyle = GOLD;
  ctx.font = font(600, 34);
  ctx.fillText('L I F E', 90 + mw + 50, 146);

  // título
  ctx.fillStyle = '#eef3f0';
  ctx.font = font(700, 76);
  let y = 300;
  for (const l of wrap(ctx, c.title, W - 180)) {
    ctx.fillText(l, 90, y);
    y += 88;
  }
  ctx.fillStyle = 'rgba(238,243,240,.8)';
  ctx.font = font(500, 42);
  ctx.fillText(c.subtitle, 90, y + 6);
  y += 70;

  // anel de progresso
  if (c.progress) {
    const cx = W / 2;
    const cy = y + 230;
    const r = 195;
    ctx.lineWidth = 34;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,.1)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    const p = Math.max(0, Math.min(1, c.progress.done / c.progress.total));
    const ring = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    ring.addColorStop(0, GOLD);
    ring.addColorStop(1, NEON);
    ctx.strokeStyle = ring;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, p));
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = font(700, 120);
    ctx.fillText(`${c.progress.done}`, cx, cy + 30);
    ctx.fillStyle = 'rgba(238,243,240,.7)';
    ctx.font = font(500, 40);
    ctx.fillText(`de ${c.progress.total} dias`, cx, cy + 90);
    ctx.textAlign = 'left';
    y = cy + r + 70;
  } else y += 40;

  // números
  const n = c.stats.length;
  const colW = (W - 180) / Math.max(1, n);
  c.stats.forEach(([label, value], i) => {
    const x = 90 + colW * i;
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.beginPath();
    ctx.roundRect?.(x + 8, y, colW - 16, 170, 28);
    if (!ctx.roundRect) ctx.rect(x + 8, y, colW - 16, 170);
    ctx.fill();
    ctx.fillStyle = NEON;
    ctx.font = font(700, 58);
    ctx.textAlign = 'center';
    ctx.fillText(value, x + colW / 2, y + 82);
    ctx.fillStyle = 'rgba(238,243,240,.75)';
    ctx.font = font(500, 28);
    wrap(ctx, label, colW - 40).slice(0, 2).forEach((l, k) => ctx.fillText(l, x + colW / 2, y + 124 + k * 32));
    ctx.textAlign = 'left';
  });

  // rodapé
  ctx.fillStyle = 'rgba(238,243,240,.9)';
  ctx.font = font(600, 38);
  ctx.fillText(c.nick, 90, H - 112);
  ctx.fillStyle = GOLD;
  ctx.font = font(500, 30);
  ctx.fillText('Viva a sua melhor versão · NEFESH Life', 90, H - 68);
  ctx.fillStyle = 'rgba(238,243,240,.55)';
  ctx.font = font(400, 26);
  // a imagem não é clicável: endereço curto e o código de convite
  const u = (() => { try { return new URL(c.link); } catch { return null; } })();
  const code = u?.searchParams.get('amigo');
  ctx.fillText(`${u ? u.host + u.pathname.replace(/\/$/, '') : c.link}${code ? ` · convite ${code}` : ''}`, 90, H - 30);

  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('sem imagem'))), 'image/png'));
}

/** Partilha a imagem (folha de partilha do telemóvel) ou, sem ela, descarrega-a. */
export async function shareImage(blob: Blob, text: string, filename = 'nefesh-life.png') {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return 'partilhado';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelado';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'descarregado';
}
