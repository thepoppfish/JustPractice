/**
 * Renders a 1080p JustPractice logo intro (MP4 + PNG sequence).
 * Run: node scripts/render-logo-intro-video.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const logoPath = path.join(root, 'public', 'icons', 'logo-source.png');
const outDir = path.join(root, 'assets', 'logo-intro');
const framesDir = path.join(outDir, 'frames');
const outMp4 = path.join(outDir, 'JustPractice-logo-intro-1080p.mp4');

const W = 1920;
const H = 1080;
const FPS = 30;
const DURATION_SEC = 5;
const TOTAL_FRAMES = FPS * DURATION_SEC;

const LOGO_SIZE = 300;
const LOGO_CX = W / 2;
const LOGO_CY = H / 2 - 40;
const RING_R = 168;
const RING_CIRC = 2 * Math.PI * RING_R;

const logoB64 = fs.readFileSync(logoPath).toString('base64');

function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function easeOutElastic(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 2 ** (-10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function frameSvg(frameIndex) {
  const t = frameIndex / (TOTAL_FRAMES - 1);
  const sec = frameIndex / FPS;

  const logoIn = clamp01(sec / 1.1);
  const logoScale = 0.15 + easeOutElastic(logoIn) * 0.85;
  const logoOpacity = easeOutCubic(clamp01(sec / 0.55));

  const ringIn = clamp01((sec - 0.45) / 1.35);
  const ringDraw = easeOutCubic(ringIn);
  const ringDash = RING_CIRC * (1 - ringDraw);
  const ringOpacity = 0.35 + ringDraw * 0.65;

  const textIn = clamp01((sec - 1.35) / 0.9);
  const textOpacity = easeOutCubic(textIn);
  const textY = 680 + (1 - easeOutCubic(textIn)) * 18;

  const breathe = 1 + Math.sin(sec * 2.1) * 0.018 * clamp01((sec - 1.8) / 0.5);
  const glowPulse = 0.55 + 0.45 * Math.sin(sec * 1.8 + 0.4);
  const glowScale = 1 + glowPulse * 0.12;

  const particles = [];
  const particleCount = 8;
  for (let i = 0; i < particleCount; i += 1) {
    const phase = (i / particleCount) * Math.PI * 2;
    const orbitStart = 1.1 + i * 0.05;
    const orbit = clamp01((sec - orbitStart) / 0.8);
    if (orbit <= 0) continue;
    const angle = sec * (0.9 + i * 0.08) + phase;
    const radius = RING_R + 28 + Math.sin(sec * 2 + i) * 8;
    const px = LOGO_CX + Math.cos(angle) * radius;
    const py = LOGO_CY + Math.sin(angle) * radius;
    const size = 4 + (i % 3) * 2;
    particles.push(
      `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${size}" fill="#ff8a4c" opacity="${(orbit * 0.75).toFixed(3)}"/>`,
    );
  }

  const logoX = LOGO_CX - (LOGO_SIZE * logoScale * breathe) / 2;
  const logoY = LOGO_CY - (LOGO_SIZE * logoScale * breathe) / 2;
  const logoDraw = LOGO_SIZE * logoScale * breathe;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="42%" r="55%">
      <stop offset="0%" stop-color="#ff6b26" stop-opacity="${(0.14 * glowPulse).toFixed(3)}"/>
      <stop offset="45%" stop-color="#ff6b26" stop-opacity="${(0.06 * glowPulse).toFixed(3)}"/>
      <stop offset="100%" stop-color="#0f0f10" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="logoGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ff8a4c" stop-opacity="${(0.35 * glowPulse * logoOpacity).toFixed(3)}"/>
      <stop offset="100%" stop-color="#ff6b26" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="logoClip">
      <circle cx="${LOGO_CX}" cy="${LOGO_CY}" r="${LOGO_SIZE * 0.52 * logoScale * breathe}"/>
    </clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="#0f0f10"/>
  <rect width="${W}" height="${H}" fill="url(#bgGlow)"/>
  <ellipse cx="${LOGO_CX}" cy="${LOGO_CY}" rx="${220 * glowScale}" ry="${200 * glowScale}" fill="url(#logoGlow)"/>
  ${particles.join('\n  ')}
  <circle
    cx="${LOGO_CX}" cy="${LOGO_CY}" r="${RING_R}"
    fill="none"
    stroke="#ff6b26"
    stroke-width="5"
    stroke-linecap="round"
    opacity="${ringOpacity.toFixed(3)}"
    stroke-dasharray="${RING_CIRC.toFixed(2)}"
    stroke-dashoffset="${ringDash.toFixed(2)}"
    transform="rotate(-90 ${LOGO_CX} ${LOGO_CY})"
  />
  <image
    href="data:image/png;base64,${logoB64}"
    x="${logoX.toFixed(2)}"
    y="${logoY.toFixed(2)}"
    width="${logoDraw.toFixed(2)}"
    height="${logoDraw.toFixed(2)}"
    opacity="${logoOpacity.toFixed(3)}"
    clip-path="url(#logoClip)"
  />
  <text
    x="${LOGO_CX}"
    y="${textY.toFixed(1)}"
    text-anchor="middle"
    fill="#f1f3f4"
    font-family="Segoe UI, system-ui, -apple-system, Roboto, sans-serif"
    font-size="52"
    font-weight="600"
    letter-spacing="0.5"
    opacity="${textOpacity.toFixed(3)}"
  >JustPractice</text>
</svg>`;
}

async function renderFrames() {
  fs.mkdirSync(framesDir, { recursive: true });
  for (const f of fs.readdirSync(framesDir)) {
    if (f.endsWith('.png')) fs.unlinkSync(path.join(framesDir, f));
  }

  console.info(`[logo-intro] rendering ${TOTAL_FRAMES} frames at ${W}x${H}…`);
  for (let i = 0; i < TOTAL_FRAMES; i += 1) {
    const svg = frameSvg(i);
    const out = path.join(framesDir, `frame-${String(i).padStart(4, '0')}.png`);
    await sharp(Buffer.from(svg)).png().toFile(out);
    if (i % 30 === 0 || i === TOTAL_FRAMES - 1) {
      console.info(`[logo-intro] frame ${i + 1}/${TOTAL_FRAMES}`);
    }
  }
}

function encodeMp4() {
  const ffmpeg = ffmpegInstaller.path;
  const args = [
    '-y',
    '-framerate',
    String(FPS),
    '-i',
    path.join(framesDir, 'frame-%04d.png'),
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '18',
    '-movflags',
    '+faststart',
    outMp4,
  ];
  console.info('[logo-intro] encoding MP4…');
  const r = spawnSync(ffmpeg, args, { stdio: 'inherit' });
  if (r.status !== 0) {
    throw new Error('ffmpeg encode failed');
  }
}

function cleanupFrames() {
  if (!fs.existsSync(framesDir)) return;
  for (const f of fs.readdirSync(framesDir)) {
    fs.unlinkSync(path.join(framesDir, f));
  }
  fs.rmdirSync(framesDir);
}

fs.mkdirSync(outDir, { recursive: true });
await renderFrames();
encodeMp4();
cleanupFrames();
console.info(`[logo-intro] done → ${outMp4}`);
