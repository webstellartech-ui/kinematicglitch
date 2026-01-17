import './style.css'
import gsap from 'gsap'

const canvas = document.getElementById('glitch-canvas');
const ctx = canvas.getContext('2d');
let width = window.innerWidth;
let height = window.innerHeight;

// Config
const TEXT = "KINEMATIC";
const PARTICLE_DENSITY = 4; // Step size
const EXPLOSION_RADIUS = 1000;

// State
let particles = [];
let bgImage = null;
let scrollProgress = 0;
let time = 0;

// Load Image
const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
};

// Resize
const resize = () => {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  if (bgImage) initParticles();
};
window.addEventListener('resize', resize);

// Init Particles (Text Rasterization)
const initParticles = () => {
  particles = [];

  // 1. Setup Offscreen Canvas for Text
  const osc = document.createElement('canvas');
  const osCtx = osc.getContext('2d');
  osc.width = width;
  osc.height = height;

  // 2. Draw Text centered
  osCtx.fillStyle = 'white';
  // Responsive font size
  const fontSize = Math.min(width * 0.15, 200);
  osCtx.font = `900 ${fontSize}px "Inter", sans-serif`;
  osCtx.textAlign = 'center';
  osCtx.textBaseline = 'middle';
  osCtx.fillText(TEXT, width / 2, height / 2);

  // 3. Get Data
  const imgData = osCtx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // 4. Create Particles - Sample from BG
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = width;
  bgCanvas.height = height;
  const bgCtx = bgCanvas.getContext('2d');

  const scale = Math.max(width / bgImage.width, height / bgImage.height);
  const x = (width - bgImage.width * scale) / 2;
  const y = (height - bgImage.height * scale) / 2;
  bgCtx.drawImage(bgImage, x, y, bgImage.width * scale, bgImage.height * scale);
  const bgData = bgCtx.getImageData(0, 0, width, height).data;

  for (let y = 0; y < height; y += PARTICLE_DENSITY) {
    for (let x = 0; x < width; x += PARTICLE_DENSITY) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3]; // Text Alpha

      if (alpha > 128) {
        const r = bgData[index];
        const g = bgData[index + 1];
        const b = bgData[index + 2];

        // Calculate Explosion Target (Vector from center)
        const dx = x - width / 2;
        const dy = y - height / 2;
        const angle = Math.atan2(dy, dx);

        const targetX = x + Math.cos(angle) * (Math.random() * width * 1.5);
        const targetY = y + Math.sin(angle) * (Math.random() * height * 1.5);

        particles.push({
          x: x,
          y: y,
          originX: x,
          originY: y,
          targetX: targetX,
          targetY: targetY,
          color: `rgb(${r},${g},${b})`,
          r: r, g: g, b: b,
          size: PARTICLE_DENSITY,
          vx: 0,
          vy: 0
        });
      }
    }
  }
  console.log(`Created ${particles.length} particles`);
};

// Render
const render = () => {
  time += 0.05;

  // Fill background black
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  // Calculate Scroll Progress with fallbacks
  // Use documentElement.scrollHeight for consistency
  const docHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
  const maxScroll = docHeight - window.innerHeight;
  const currentScroll = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;

  // Normalized 0 to 1
  const rawProgress = maxScroll > 0 ? Math.min(currentScroll / maxScroll, 1) : 0;

  // Smooth it out
  scrollProgress += (rawProgress - scrollProgress) * 0.1;

  // Control Phases
  // 0.0 - 0.2: Glitch Intensity ramps up
  // 0.2 - 1.0: Explosion

  const glitchFactor = scrollProgress < 0.2 ? scrollProgress * 5 : (1 - (scrollProgress - 0.2) * 1.25);

  const explosionProgress = Math.max(0, (scrollProgress - 0.1) * 1.5); // Starts at 0.1

  // Draw Final Image Fading In (Reveal)
  if (explosionProgress > 0.8) {
    const opacity = (explosionProgress - 0.8) * 5;
    ctx.globalAlpha = Math.min(opacity, 1);

    const scale = Math.max(width / bgImage.width, height / bgImage.height);
    const x = (width - bgImage.width * scale) / 2;
    const y = (height - bgImage.height * scale) / 2;
    ctx.drawImage(bgImage, x, y, bgImage.width * scale, bgImage.height * scale);
    ctx.globalAlpha = 1;
  }

  ctx.globalCompositeOperation = 'lighter';

  particles.forEach(p => {
    let currentX = p.originX;
    let currentY = p.originY;

    // 1. Idle Animation (Breathing/Floating)
    // subtle noise based on position
    const idleX = Math.sin(time + p.y * 0.05) * 1.5;
    const idleY = Math.cos(time + p.x * 0.05) * 1.5;
    currentX += idleX;
    currentY += idleY;

    // 2. Explosion Logic
    if (explosionProgress > 0) {
      const t = Math.min(explosionProgress, 1);
      const ease = t * t * t;
      currentX = currentX + (p.targetX - currentX) * ease;
      currentY = currentY + (p.targetY - currentY) * ease;
    }

    // 3. Glitch Jitter
    let jx = 0;
    let jy = 0;
    // Always minimal glitch
    const activeGlitch = Math.max(glitchFactor, 0.02);

    if (activeGlitch > 0.01) {
      if (Math.random() < 0.1 * activeGlitch) {
        jx = (Math.random() - 0.5) * 40 * activeGlitch;
        jy = (Math.random() - 0.5) * 5 * activeGlitch;
      }
    }

    // Draw
    if (activeGlitch > 0.15) {
      const offset = activeGlitch * 6;
      // R
      ctx.fillStyle = `rgba(${p.r}, 0, 0, 0.8)`;
      ctx.fillRect(currentX + jx - offset, currentY + jy, p.size, p.size);
      // G
      ctx.fillStyle = `rgba(0, ${p.g}, 0, 0.8)`;
      ctx.fillRect(currentX + jx, currentY + jy, p.size, p.size);
      // B
      ctx.fillStyle = `rgba(0, 0, ${p.b}, 0.8)`;
      ctx.fillRect(currentX + jx + offset, currentY + jy, p.size, p.size);
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(currentX + jx, currentY + jy, p.size, p.size);
    }
  });

  ctx.globalCompositeOperation = 'source-over';
  requestAnimationFrame(render);
};

// Main
(async () => {
  try {
    bgImage = await loadImage('/2.jpeg');
    resize();
    render();
  } catch (e) {
    console.error("Failed to load image", e);
  }
})();
