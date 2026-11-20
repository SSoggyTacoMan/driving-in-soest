import * as THREE from 'three';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvasTexture(width, height, draw, { repeat = [1, 1], srgb = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = 8;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function noise(ctx, w, h, amount, alpha, rng, colors = ['#000', '#fff']) {
  for (let i = 0; i < amount; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const s = 0.5 + rng() * 2.2;
    ctx.globalAlpha = alpha * (0.3 + rng() * 0.7);
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
}

export function createTextures() {
  const grass = makeCanvasTexture(512, 512, (ctx, w, h) => {
    const rng = mulberry32(11);
    ctx.fillStyle = '#849868';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 64) {
      ctx.fillStyle = y % 128 === 0 ? 'rgba(255,255,230,0.045)' : 'rgba(25,48,24,0.035)';
      ctx.fillRect(0, y, w, 64);
    }
    const colors = ['#6f8556', '#95a879', '#708b5e', '#a3b184', '#5f7851'];
    for (let i = 0; i < 16000; i++) {
      ctx.globalAlpha = 0.18 + rng() * 0.4;
      ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
      const x = rng() * w;
      const y = rng() * h;
      ctx.fillRect(x, y, 1 + rng() * 2, 1 + rng() * 3);
    }
    ctx.globalAlpha = 1;
  }, { repeat: [60, 60] });

  const asphalt = makeCanvasTexture(512, 512, (ctx, w, h) => {
    const rng = mulberry32(21);
    ctx.fillStyle = '#73746c';
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 16000, 0.14, rng, ['#4a4b45', '#9b9a8f', '#7a7a70']);
    for (let i = 0; i < 16; i++) {
      ctx.strokeStyle = 'rgba(35,36,33,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      let x = rng() * w;
      let y = rng() * h;
      ctx.moveTo(x, y);
      for (let j = 0; j < 4; j++) {
        x += (rng() - 0.5) * 38;
        y += rng() * 28;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, { repeat: [1, 1] });

  const paving = makeCanvasTexture(512, 512, (ctx, w, h) => {
    const rng = mulberry32(31);
    ctx.fillStyle = '#a8a093';
    ctx.fillRect(0, 0, w, h);
    const bw = 64;
    const bh = 40;
    for (let row = 0; row < h / bh + 1; row++) {
      for (let col = -1; col < w / bw + 1; col++) {
        const offset = row % 2 === 0 ? 0 : bw / 2;
        const x = col * bw + offset;
        const y = row * bh;
        ctx.fillStyle = ['#b5ad9f', '#aaa294', '#c0b8a9', '#9d978b'][Math.floor(rng() * 4)];
        ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
        ctx.strokeStyle = 'rgba(80,76,68,0.12)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 2, y + 2, bw - 4, bh - 4);
      }
    }
    noise(ctx, w, h, 3000, 0.09, rng, ['#6e6a61', '#ddd5c7']);
  }, { repeat: [1, 1] });

  const cobble = makeCanvasTexture(512, 512, (ctx, w, h) => {
    const rng = mulberry32(41);
    ctx.fillStyle = '#8e877b';
    ctx.fillRect(0, 0, w, h);
    const bw = 40;
    const bh = 25;
    for (let row = 0; row < h / bh + 1; row++) {
      for (let col = -1; col < w / bw + 1; col++) {
        const offset = (row % 2) * 20;
        const x = col * bw + offset;
        const y = row * bh;
        ctx.fillStyle = ['#a29a8c', '#978f82', '#b1a798', '#89847b', '#ada393'][Math.floor(rng() * 5)];
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, bw - 4, bh - 4, 4);
        ctx.fill();
      }
    }
    noise(ctx, w, h, 3600, 0.08, rng, ['#665f55', '#d2c7b5']);
  }, { repeat: [1, 1] });

  const brick = makeCanvasTexture(512, 512, (ctx, w, h) => {
    const rng = mulberry32(51);
    ctx.fillStyle = '#9d9185';
    ctx.fillRect(0, 0, w, h);
    const bw = 64;
    const bh = 28;
    for (let row = 0; row < h / bh + 1; row++) {
      for (let col = -1; col < w / bw + 1; col++) {
        const offset = (row % 2) * 32;
        const x = col * bw + offset;
        const y = row * bh;
        const v = 190 + Math.floor(rng() * 35);
        ctx.fillStyle = `rgb(${v},${v - 10},${v - 22})`;
        ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x + 2, y + 2, bw - 4, 2);
        ctx.fillStyle = 'rgba(60,52,44,0.09)';
        ctx.fillRect(x + 2, y + bh - 6, bw - 4, 4);
      }
    }
    noise(ctx, w, h, 5000, 0.07, rng, ['#6c5e51', '#fff3df']);
  }, { repeat: [1, 1] });

  const plaster = makeCanvasTexture(512, 512, (ctx, w, h) => {
    const rng = mulberry32(61);
    ctx.fillStyle = '#e2daca';
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 9000, 0.055, rng, ['#b7ad9d', '#fff7e8']);
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.035;
      ctx.fillStyle = '#6f675c';
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h, 12 + rng() * 34, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, { repeat: [1, 1] });

  const roof = makeCanvasTexture(512, 512, (ctx, w, h) => {
    const rng = mulberry32(71);
    ctx.fillStyle = '#b8b3a9';
    ctx.fillRect(0, 0, w, h);
    const th = 22;
    for (let row = 0; row < h / th + 1; row++) {
      const y = row * th;
      const offset = (row % 2) * 12;
      for (let x = -1; x < w / 32 + 1; x++) {
        const v = 168 + Math.floor(rng() * 50);
        ctx.fillStyle = `rgb(${v},${v - 8},${v - 16})`;
        ctx.fillRect(x * 32 + offset, y, 30, th - 2);
      }
      ctx.fillStyle = 'rgba(46,42,38,0.22)';
      ctx.fillRect(0, y + th - 3, w, 3);
    }
    noise(ctx, w, h, 2600, 0.08, rng, ['#5b5751', '#e7e0d5']);
  }, { repeat: [1, 1] });

  const sand = makeCanvasTexture(512, 512, (ctx, w, h) => {
    const rng = mulberry32(81);
    ctx.fillStyle = '#d3b477';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 180; i++) {
      ctx.strokeStyle = `rgba(120,92,49,${0.025 + rng() * 0.05})`;
      ctx.lineWidth = 1 + rng() * 2;
      ctx.beginPath();
      const y = rng() * h;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.3, y + (rng() - 0.5) * 50, w * 0.7, y + (rng() - 0.5) * 50, w, y + (rng() - 0.5) * 22);
      ctx.stroke();
    }
    noise(ctx, w, h, 13000, 0.13, rng, ['#9d7b43', '#f0d9a8', '#b99559']);
  }, { repeat: [5, 5] });

  const water = makeCanvasTexture(512, 512, (ctx, w, h) => {
    const rng = mulberry32(91);
    ctx.fillStyle = '#6e9c9f';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      ctx.strokeStyle = `rgba(220,242,226,${0.025 + rng() * 0.07})`;
      ctx.lineWidth = 0.8 + rng() * 1.6;
      ctx.beginPath();
      const x = rng() * w;
      const y = rng() * h;
      ctx.arc(x, y, 10 + rng() * 45, 0.1, Math.PI * (0.5 + rng() * 0.8));
      ctx.stroke();
    }
  }, { repeat: [8, 8] });

  const windowTex = makeCanvasTexture(256, 320, (ctx, w, h) => {
    ctx.fillStyle = '#f3ead8';
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 20, 0, h - 20);
    g.addColorStop(0, '#314b55');
    g.addColorStop(0.52, '#6d9aa2');
    g.addColorStop(1, '#293d45');
    ctx.fillStyle = g;
    ctx.fillRect(18, 18, w - 36, h - 36);
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.beginPath();
    ctx.moveTo(24, 24);
    ctx.lineTo(108, 24);
    ctx.lineTo(24, 132);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#f3ead8';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(w / 2, 18);
    ctx.lineTo(w / 2, h - 18);
    ctx.moveTo(18, h * 0.53);
    ctx.lineTo(w - 18, h * 0.53);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(30,40,40,0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(13, 13, w - 26, h - 26);
  });

  const litWindow = makeCanvasTexture(128, 160, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.7);
    g.addColorStop(0, 'rgba(255,225,155,0.95)');
    g.addColorStop(0.55, 'rgba(255,191,91,0.55)');
    g.addColorStop(1, 'rgba(255,171,68,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { srgb: true });

  const door = makeCanvasTexture(160, 320, (ctx, w, h) => {
    ctx.fillStyle = '#f2e8d5';
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#264a46');
    g.addColorStop(1, '#183a38');
    ctx.fillStyle = g;
    ctx.fillRect(13, 13, w - 26, h - 13);
    ctx.strokeStyle = 'rgba(230,210,168,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 36, w - 60, 92);
    ctx.strokeRect(30, 154, w - 60, 125);
    ctx.fillStyle = '#d9b66c';
    ctx.beginPath();
    ctx.arc(w - 37, 171, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(13, 13, 10, h - 13);
  });

  const shopWindow = makeCanvasTexture(512, 320, (ctx, w, h) => {
    ctx.fillStyle = '#2d3431';
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#668781');
    g.addColorStop(0.55, '#2c4a48');
    g.addColorStop(1, '#bb9b63');
    ctx.fillStyle = g;
    ctx.fillRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = 'rgba(255,220,160,0.22)';
    ctx.beginPath();
    ctx.arc(w * 0.7, h * 0.6, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e7d3a9';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.beginPath();
    ctx.moveTo(w / 2, 10);
    ctx.lineTo(w / 2, h - 10);
    ctx.stroke();
  });

  const awningStripe = makeCanvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f0e3c4';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#a64e3f';
    for (let x = 0; x < w; x += 48) ctx.fillRect(x, 0, 24, h);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(0, 0, w, 10);
  }, { repeat: [3, 1] });

  return { grass, asphalt, paving, cobble, brick, plaster, roof, sand, water, window: windowTex, litWindow, door, shopWindow, awningStripe };
}

export function makeSignTexture(text, { bg = '#173a36', fg = '#f3e4c4', accent = '#e7b95f', sub = '' } = {}) {
  const texture = makeCanvasTexture(512, 160, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 54px Georgia, serif';
    ctx.fillText(text, w / 2, sub ? h / 2 - 14 : h / 2 + 2);
    if (sub) {
      ctx.fillStyle = accent;
      ctx.font = '600 18px system-ui, sans-serif';
      ctx.fillText(sub.toUpperCase(), w / 2, h / 2 + 37);
    }
  });
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function makeLabelTexture(title, subtitle, color = '#f7e9c7') {
  const w = 640;
  const h = 180;
  const texture = makeCanvasTexture(w, h, (ctx) => {
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(8,18,17,0.35)';
    ctx.beginPath();
    ctx.roundRect(44, 26, w - 88, h - 64, 22);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = '500 56px Georgia, serif';
    ctx.fillText(title, w / 2, 94);
    if (subtitle) {
      ctx.fillStyle = 'rgba(247,233,199,0.58)';
      ctx.font = '700 19px system-ui, sans-serif';
      ctx.fillText(subtitle.toUpperCase(), w / 2, 128);
    }
  });
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function makeRadialTexture(inner = 'rgba(255,235,180,1)', outer = 'rgba(255,210,120,0)') {
  return makeCanvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.25, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function makeBeamTexture() {
  const texture = makeCanvasTexture(64, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, 'rgba(255,235,170,0.9)');
    g.addColorStop(0.35, 'rgba(255,225,150,0.28)');
    g.addColorStop(1, 'rgba(255,220,160,0)');
    ctx.fillStyle = g;
    ctx.fillRect(w * 0.3, 0, w * 0.4, h);
  });
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
