const styles = [
  { id: 'ascii', name: 'ASCII MONO', desc: 'Контрастный портрет из символов' },
  { id: 'colorAscii', name: 'ASCII COLOR', desc: 'Символы сохраняют цвет фотографии' },
  { id: 'gradientAscii', name: 'GRADIENT ASCII', desc: 'ASCII с цветовым градиентом' },
  { id: 'lyrics', name: 'LYRIC FIELD', desc: 'Изображение из повторяющегося текста' },
  { id: 'colorLyrics', name: 'COLOR LYRIC', desc: 'Каждая буква берёт цвет фотографии' },
  { id: 'organicLyrics', name: 'ORGANIC LYRIC', desc: 'Живое поле букв без строгой сетки' },
  { id: 'echoLyrics', name: 'ECHO LYRICS', desc: 'Призрачные текстовые следы' },
  { id: 'tinyLyrics', name: 'TINY LYRICS', desc: 'Плотный постер из мелкого текста' },
  { id: 'binary', name: 'BINARY', desc: 'Цифровая структура из нулей и единиц' },
  { id: 'halftone', name: 'HALFTONE', desc: 'Печатные точки переменного размера' },
  { id: 'scanline', name: 'BROKEN SCAN', desc: 'Полосы, разрывы и смещения строк' },
  { id: 'rgbSplit', name: 'RGB SPLIT', desc: 'Разъехавшиеся цветовые каналы' },
  { id: 'blockGlitch', name: 'BLOCK GLITCH', desc: 'Повреждённые прямоугольные фрагменты' },
  { id: 'pixelSort', name: 'PIXEL SORT', desc: 'Пиксели растекаются по яркости' },
  { id: 'dataBend', name: 'DATA BEND', desc: 'Цифровое повреждение и цветовые сбои' },
  { id: 'xerox', name: 'XEROX', desc: 'Грубая фотокопия для шелкографии' },
  { id: 'contour', name: 'CONTOUR', desc: 'Светящиеся края и линии формы' },
  { id: 'dissolve', name: 'NOISE DISSOLVE', desc: 'Изображение распадается на частицы' }
];

const els = {
  file: document.querySelector('#fileInput'), canvas: document.querySelector('#mainCanvas'),
  empty: document.querySelector('#emptyState'), styleGrid: document.querySelector('#styleGrid'),
  exportBtn: document.querySelector('#exportBtn'), randomBtn: document.querySelector('#randomBtn'),
  status: document.querySelector('#status'), columns: document.querySelector('#columns'),
  effect: document.querySelector('#effect'), structure: document.querySelector('#structure'),
  contrast: document.querySelector('#contrast'), brightness: document.querySelector('#brightness'),
  charset: document.querySelector('#charset'), ink: document.querySelector('#inkColor'),
  bg: document.querySelector('#bgColor'), invert: document.querySelector('#invert'),
  transparent: document.querySelector('#transparent'),
  exportPngBtn: document.querySelector('#exportPngBtn'), exportSvgBtn: document.querySelector('#exportSvgBtn'),
  exportVideoBtn: document.querySelector('#exportVideoBtn'), videoCanvas: document.querySelector('#videoCanvas'),
  videoControls: document.querySelector('#videoControls'), commonControls: document.querySelector('#commonControls'),
  animation: document.querySelector('#animation'), duration: document.querySelector('#duration'), speed: document.querySelector('#speed'),
  format: document.querySelector('#format'), loop: document.querySelector('#loop'), playBtn: document.querySelector('#playBtn'),
  recordingBadge: document.querySelector('#recordingBadge'),
  audioInput: document.querySelector('#audioInput'), audioPlayer: document.querySelector('#audioPlayer'),
  audioFileName: document.querySelector('#audioFileName'), audioReactive: document.querySelector('#audioReactive'),
  bassMeter: document.querySelector('#bassMeter'), midMeter: document.querySelector('#midMeter'), highMeter: document.querySelector('#highMeter'),
  bassSensitivity: document.querySelector('#bassSensitivity'), midSensitivity: document.querySelector('#midSensitivity'),
  highSensitivity: document.querySelector('#highSensitivity'), recognitionBase: document.querySelector('#recognitionBase'),
  syncAudio: document.querySelector('#syncAudio'),
  modGlow: document.querySelector('#modGlow'), modGrain: document.querySelector('#modGrain'),
  modRgb: document.querySelector('#modRgb'), modOutline: document.querySelector('#modOutline'),
  modVignette: document.querySelector('#modVignette'), modifierAmount: document.querySelector('#modifierAmount')
};

const state = { image: null, style: 'ascii', audioUrl: null, audioCtx: null, analyser: null, audioSource: null, audioDestination: null, audioData: null, bands: {bass:0,mid:0,high:0}, seed: Math.random() * 100000, mode: 'photo', playing: false, raf: 0, animationStart: 0 };
const previewCanvases = new Map();
let renderTimer;

function createStyleCards() {
  styles.forEach(style => {
    const button = document.createElement('button');
    button.className = 'style-card' + (style.id === state.style ? ' active' : '');
    button.dataset.style = style.id;
    button.innerHTML = `<canvas width="240" height="240"></canvas><div class="style-meta"><span class="style-name">${style.name}</span><span class="style-desc">${style.desc}</span></div>`;
    button.addEventListener('click', () => {
      state.style = style.id;
      document.querySelectorAll('.style-card').forEach(card => card.classList.toggle('active', card.dataset.style === style.id));
      scheduleRender(false);
    });
    els.styleGrid.append(button);
    previewCanvases.set(style.id, button.querySelector('canvas'));
  });
}

function settings() {
  return {
    columns: Number(els.columns.value), effect: Number(els.effect.value) / 100,
    structure: Number(els.structure.value) / 100, contrast: Number(els.contrast.value),
    brightness: Number(els.brightness.value), text: els.charset.value.trim() || 'DARK AFTER',
    ink: els.ink.value, bg: els.bg.value, invert: els.invert.checked,
    transparent: els.transparent.checked, seed: state.seed,
    modifiers: { glow: els.modGlow.checked, grain: els.modGrain.checked, rgb: els.modRgb.checked,
      outline: els.modOutline.checked, vignette: els.modVignette.checked,
      amount: Number(els.modifierAmount.value) / 100 }
  };
}

function scheduleRender(includeThumbnails = true) {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    if (!state.image) return;
    try {
      renderMain();
      if (includeThumbnails) renderThumbnails();
    } catch (error) {
      console.error(error);
      els.status.textContent = 'Ошибка обработки изображения';
    }
  }, 50);
}

function fitDimensions(img, maxSide = 1400) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  return { width: Math.max(1, Math.round(img.naturalWidth * scale)), height: Math.max(1, Math.round(img.naturalHeight * scale)) };
}

function preparedSource(img, width, height, opts, grayscale = false) {
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const filters = [`contrast(${100 + opts.contrast}%)`, `brightness(${100 + opts.brightness}%)`];
  if (grayscale) filters.push('grayscale(100%)');
  if (opts.invert) filters.push('invert(100%)');
  ctx.filter = filters.join(' ');
  ctx.drawImage(img, 0, 0, width, height);
  ctx.filter = 'none';
  return c;
}

function getPixels(img, width, height, opts) {
  const c = preparedSource(img, width, height, opts, false);
  const data = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data;
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    pixels.push({ r, g, b, lum: 0.2126 * r + 0.7152 * g + 0.0722 * b, a: data[i + 3] });
  }
  return pixels;
}

function clearCanvas(ctx, canvas, opts) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!opts.transparent) { ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, canvas.width, canvas.height); }
}

function renderStyle(canvas, styleId, img, opts, preview = false) {
  const dims = preview ? { width: canvas.width, height: canvas.height } : fitDimensions(img);
  canvas.width = dims.width; canvas.height = dims.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  clearCanvas(ctx, canvas, opts);
  const handlers = {
    halftone: drawHalftone, scanline: drawScanline, rgbSplit: drawRgbSplit,
    blockGlitch: drawBlockGlitch, pixelSort: drawPixelSort, dataBend: drawDataBend,
    xerox: drawXerox, contour: drawContour, dissolve: drawDissolve
  };
  if (handlers[styleId]) handlers[styleId](ctx, canvas, img, opts, preview);
  else drawTextMode(ctx, canvas, img, opts, styleId, preview);
  applyModifiers(canvas, opts, preview);
}

function drawTextMode(ctx, canvas, img, opts, styleId, preview) {
  let columns = preview ? 38 : opts.columns;
  if (styleId === 'tinyLyrics') columns = preview ? 62 : Math.min(260, Math.round(opts.columns * 1.65));
  const rows = Math.max(1, Math.round(columns * canvas.height / canvas.width * 0.52));
  const pixels = getPixels(img, columns, rows, opts);
  const cellW = canvas.width / columns, cellH = canvas.height / rows;
  const fontScale = styleId === 'tinyLyrics' ? 0.72 : 1.15;
  ctx.font = `700 ${Math.ceil(cellH * fontScale)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textBaseline = 'top'; ctx.textAlign = 'center';
  const density = '@%#*+=-:. ';
  const phrase = opts.text.replace(/\s+/g, ' ') || 'DARK AFTER';
  const rand = seededRandom(opts.seed + 73);
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const p = pixels[y * columns + x]; let char;
    const lyricMode = ['lyrics','colorLyrics','organicLyrics','echoLyrics','tinyLyrics'].includes(styleId);
    if (styleId === 'binary') char = p.lum < 128 ? '1' : '0';
    else if (lyricMode) char = phrase[(y * columns + x) % phrase.length];
    else char = density[Math.min(density.length - 1, Math.floor(p.lum / 255 * density.length))];
    let px = x * cellW + cellW / 2, py = y * cellH;
    if (styleId === 'organicLyrics') {
      px += (rand() - .5) * cellW * 0.8 * opts.effect;
      py += (rand() - .5) * cellH * 0.8 * opts.effect;
      ctx.save(); ctx.translate(px, py); ctx.rotate((rand() - .5) * 0.22 * opts.effect);
    }
    const alpha = 0.08 + (1 - p.lum / 255) * 0.92;
    if (styleId === 'colorAscii' || styleId === 'colorLyrics' || styleId === 'organicLyrics' || styleId === 'tinyLyrics') {
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
    } else if (styleId === 'gradientAscii') {
      const a = hexToRgb(opts.ink), b = hexToRgb('#ff315f'), mix = y / Math.max(1, rows - 1);
      ctx.fillStyle = `rgb(${Math.round(a.r*(1-mix)+b.r*mix)},${Math.round(a.g*(1-mix)+b.g*mix)},${Math.round(a.b*(1-mix)+b.b*mix)})`;
    } else if (lyricMode) ctx.fillStyle = hexToRgba(opts.ink, alpha);
    else ctx.fillStyle = opts.ink;
    if (styleId === 'echoLyrics') {
      const d = cellW * (0.12 + opts.effect * 0.35);
      ctx.fillStyle = hexToRgba('#ff315f', alpha * .35); ctx.fillText(char, px - d, py);
      ctx.fillStyle = hexToRgba('#39d5ff', alpha * .28); ctx.fillText(char, px + d, py);
      ctx.fillStyle = hexToRgba(opts.ink, alpha); ctx.fillText(char, px, py);
    } else if (styleId === 'organicLyrics') {
      ctx.fillText(char, 0, 0); ctx.restore();
    } else ctx.fillText(char, px, py);
  }
}

function drawHalftone(ctx, canvas, img, opts, preview) {
  const columns = preview ? 30 : Math.max(18, Math.round(opts.columns * (0.35 + opts.structure * 0.45)));
  const rows = Math.max(1, Math.round(columns * canvas.height / canvas.width));
  const pixels = getPixels(img, columns, rows, opts);
  const cellW = canvas.width / columns, cellH = canvas.height / rows;
  ctx.fillStyle = opts.ink;
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const p = pixels[y * columns + x];
    const radius = Math.min(cellW, cellH) * 0.5 * Math.pow(1 - p.lum / 255, 0.7 + opts.effect);
    ctx.beginPath(); ctx.arc(x * cellW + cellW / 2, y * cellH + cellH / 2, radius, 0, Math.PI * 2); ctx.fill();
  }
}

function drawScanline(ctx, canvas, img, opts, preview) {
  const source = preparedSource(img, canvas.width, canvas.height, opts, true);
  const rand = seededRandom(opts.seed);
  const band = preview ? Math.max(2, Math.round(2 + opts.structure * 5)) : Math.max(2, Math.round(canvas.height * (0.002 + opts.structure * 0.018)));
  const maxShift = canvas.width * (0.01 + opts.effect * 0.22);
  for (let y = 0; y < canvas.height; y += band) {
    const broken = rand() < 0.12 + opts.effect * 0.55;
    const shift = broken ? (rand() - 0.5) * maxShift : (rand() - 0.5) * maxShift * 0.05;
    ctx.globalAlpha = 0.65 + rand() * 0.35;
    ctx.drawImage(source, 0, y, canvas.width, band, shift, y, canvas.width, band);
    if (broken && rand() < opts.effect) {
      ctx.fillStyle = hexToRgba(opts.ink, 0.08 + opts.effect * 0.28);
      ctx.fillRect(0, y, canvas.width, Math.max(1, band * rand()));
    }
  }
  ctx.globalAlpha = 1; ctx.fillStyle = hexToRgba(opts.ink, 0.08 + opts.effect * 0.15);
  const gap = Math.max(2, Math.round(band * (1.5 + (1 - opts.structure) * 4)));
  for (let y = 0; y < canvas.height; y += gap) ctx.fillRect(0, y, canvas.width, 1);
}

function drawRgbSplit(ctx, canvas, img, opts) {
  const source = preparedSource(img, canvas.width, canvas.height, opts, false);
  const shift = Math.max(1, Math.round(canvas.width * (0.005 + opts.effect * 0.045)));
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.9;
  ctx.drawImage(tintCanvas(source, '#ff003c'), -shift, 0);
  ctx.drawImage(tintCanvas(source, '#00f0ff'), shift, 0);
  ctx.globalAlpha = 0.45 + (1 - opts.effect) * 0.45;
  ctx.drawImage(source, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function drawBlockGlitch(ctx, canvas, img, opts, preview) {
  const source = preparedSource(img, canvas.width, canvas.height, opts, false);
  ctx.drawImage(source, 0, 0);
  const rand = seededRandom(opts.seed);
  const count = Math.round((preview ? 8 : 16) + opts.effect * (preview ? 22 : 70));
  for (let i = 0; i < count; i++) {
    const h = Math.max(2, canvas.height * (0.006 + rand() * 0.05 * opts.structure));
    const y = rand() * (canvas.height - h);
    const x = rand() * canvas.width * 0.45;
    const w = canvas.width * (0.2 + rand() * 0.8);
    const shift = (rand() - 0.5) * canvas.width * (0.03 + opts.effect * 0.28);
    ctx.drawImage(source, x, y, w, h, x + shift, y, w, h);
    if (rand() < 0.35) { ctx.fillStyle = hexToRgba(opts.ink, 0.08 + opts.effect * 0.3); ctx.fillRect(x + shift, y, w, h); }
  }
}

function drawPixelSort(ctx, canvas, img, opts, preview) {
  const source = preparedSource(img, canvas.width, canvas.height, opts, false);
  const sctx = source.getContext('2d', { willReadFrequently: true });
  const imageData = sctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  const step = preview ? 3 : Math.max(1, Math.round(1 + (1 - opts.structure) * 5));
  const threshold = 70 + (1 - opts.effect) * 130;
  for (let y = 0; y < canvas.height; y += step) {
    let start = -1;
    for (let x = 0; x <= canvas.width; x++) {
      const i = (y * canvas.width + Math.min(x, canvas.width - 1)) * 4;
      const lum = x < canvas.width ? (d[i] + d[i + 1] + d[i + 2]) / 3 : 0;
      if (lum > threshold && start < 0) start = x;
      if ((lum <= threshold || x === canvas.width) && start >= 0) {
        const end = x; const pixels = [];
        for (let px = start; px < end; px++) { const j = (y * canvas.width + px) * 4; pixels.push([d[j], d[j+1], d[j+2], d[j+3]]); }
        pixels.sort((a, b) => (a[0]+a[1]+a[2]) - (b[0]+b[1]+b[2]));
        pixels.forEach((p, n) => { const j = (y * canvas.width + start + n) * 4; d[j]=p[0]; d[j+1]=p[1]; d[j+2]=p[2]; d[j+3]=p[3]; });
        start = -1;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function drawDataBend(ctx, canvas, img, opts) {
  const source = preparedSource(img, canvas.width, canvas.height, opts, false);
  ctx.drawImage(source, 0, 0);
  const rand = seededRandom(opts.seed);
  const slices = Math.round(8 + opts.effect * 45);
  for (let i = 0; i < slices; i++) {
    const y = rand() * canvas.height;
    const h = Math.max(1, canvas.height * (0.002 + rand() * 0.025 * opts.structure));
    const shift = (rand() - 0.5) * canvas.width * opts.effect * 0.35;
    ctx.globalCompositeOperation = rand() > 0.5 ? 'difference' : 'screen';
    ctx.globalAlpha = 0.2 + rand() * 0.65;
    ctx.drawImage(source, 0, y, canvas.width, h, shift, y, canvas.width, h);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function drawXerox(ctx, canvas, img, opts) {
  const source = preparedSource(img, canvas.width, canvas.height, opts, true);
  const data = source.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
  const d = data.data; const threshold = 80 + (1 - opts.effect) * 130;
  const rand = seededRandom(opts.seed);
  for (let i = 0; i < d.length; i += 4) {
    const grain = (rand() - 0.5) * opts.structure * 90;
    const on = d[i] + grain < threshold;
    const c = on ? hexToRgb(opts.ink) : hexToRgb(opts.bg);
    d[i] = c.r; d[i+1] = c.g; d[i+2] = c.b; d[i+3] = opts.transparent && !on ? 0 : 255;
  }
  ctx.putImageData(data, 0, 0);
}

function drawContour(ctx, canvas, img, opts) {
  const smallW = Math.min(canvas.width, 700), smallH = Math.round(canvas.height * smallW / canvas.width);
  const source = preparedSource(img, smallW, smallH, opts, true);
  const data = source.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, smallW, smallH);
  const out = new ImageData(smallW, smallH); const threshold = 8 + (1 - opts.effect) * 55;
  const rgb = hexToRgb(opts.ink);
  for (let y = 1; y < smallH - 1; y++) for (let x = 1; x < smallW - 1; x++) {
    const i = (y * smallW + x) * 4;
    const gx = Math.abs(data.data[i + 4] - data.data[i - 4]);
    const gy = Math.abs(data.data[i + smallW * 4] - data.data[i - smallW * 4]);
    const edge = gx + gy;
    if (edge > threshold) { out.data[i]=rgb.r; out.data[i+1]=rgb.g; out.data[i+2]=rgb.b; out.data[i+3]=Math.min(255, edge * 3); }
  }
  const temp = document.createElement('canvas'); temp.width=smallW; temp.height=smallH; temp.getContext('2d').putImageData(out,0,0);
  ctx.imageSmoothingEnabled = opts.structure < 0.5; ctx.drawImage(temp,0,0,canvas.width,canvas.height);
}

function drawDissolve(ctx, canvas, img, opts, preview) {
  const source = preparedSource(img, canvas.width, canvas.height, opts, false);
  ctx.globalAlpha = 0.3 + (1 - opts.effect) * 0.7; ctx.drawImage(source,0,0); ctx.globalAlpha=1;
  const rand=seededRandom(opts.seed); const count=Math.round((preview?800:3500)*(0.3+opts.effect*1.7));
  const sample=source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height).data;
  const radius=preview?1:Math.max(1, canvas.width*(0.001+opts.structure*0.004));
  for(let i=0;i<count;i++){
    const x=Math.floor(rand()*canvas.width), y=Math.floor(rand()*canvas.height), p=(y*canvas.width+x)*4;
    const lum=(sample[p]+sample[p+1]+sample[p+2])/765;
    if(rand()>lum*(1.2-opts.effect*0.5)){
      const drift=(rand()-0.5)*canvas.width*opts.effect*0.18;
      ctx.fillStyle=`rgba(${sample[p]},${sample[p+1]},${sample[p+2]},${0.25+rand()*0.75})`;
      ctx.fillRect(x+drift,y+(rand()-0.5)*drift*0.25,radius,radius);
    }
  }
}


function applyModifiers(canvas, opts, preview) {
  if (!opts.modifiers) return;
  const m = opts.modifiers, amount = m.amount || 0;
  if (!(m.glow || m.grain || m.rgb || m.outline || m.vignette) || amount <= 0) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const base = document.createElement('canvas'); base.width = canvas.width; base.height = canvas.height;
  base.getContext('2d').drawImage(canvas, 0, 0);
  if (m.rgb) {
    const shift = Math.max(1, Math.round(canvas.width * 0.012 * amount));
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .32 * amount;
    ctx.drawImage(tintCanvas(base, '#ff2455'), -shift, 0);
    ctx.drawImage(tintCanvas(base, '#16d9ff'), shift, 0);
    ctx.restore();
  }
  if (m.glow) {
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .25 + .35 * amount;
    ctx.filter = `blur(${Math.max(1, canvas.width * .006 * amount)}px)`;
    ctx.drawImage(base, 0, 0); ctx.restore();
  }
  if (m.outline) {
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .38 * amount;
    const d = Math.max(1, Math.round(1 + 3 * amount));
    ctx.drawImage(base, -d, 0); ctx.drawImage(base, d, 0); ctx.drawImage(base, 0, -d); ctx.drawImage(base, 0, d);
    ctx.restore();
  }
  if (m.grain) {
    const image = ctx.getImageData(0,0,canvas.width,canvas.height), data=image.data;
    const rand = seededRandom(opts.seed + 991);
    const step = preview ? 12 : 4;
    for (let y=0;y<canvas.height;y+=step) for(let x=0;x<canvas.width;x+=step){
      const n=(rand()-.5)*100*amount, i=(y*canvas.width+x)*4;
      data[i]=Math.max(0,Math.min(255,data[i]+n)); data[i+1]=Math.max(0,Math.min(255,data[i+1]+n)); data[i+2]=Math.max(0,Math.min(255,data[i+2]+n));
    }
    ctx.putImageData(image,0,0);
  }
  if (m.vignette) {
    const g=ctx.createRadialGradient(canvas.width/2,canvas.height/2,Math.min(canvas.width,canvas.height)*.18,canvas.width/2,canvas.height/2,Math.max(canvas.width,canvas.height)*.72);
    g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(0,0,0,${.78*amount})`);
    ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);
  }
}

function isLyricStyle(id){ return ['lyrics','colorLyrics','organicLyrics','echoLyrics','tinyLyrics'].includes(id); }

function drawAnimatedLyrics(ctx, canvas, progress, anim, opts) {
  const cols = Math.min(90, Math.max(34, Math.round(opts.columns * .62)));
  const rows = Math.max(1, Math.round(cols * canvas.height / canvas.width * .52));
  const pixels = getPixels(state.image, cols, rows, opts);
  const cellW = canvas.width / cols, cellH = canvas.height / rows;
  const phrase = opts.text.replace(/\s+/g,' ') || 'DARK AFTER';
  const rand = seededRandom(opts.seed + 404);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=`700 ${Math.ceil(cellH*.96)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  const wave=.5-.5*Math.cos(progress*Math.PI*2);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const i=y*cols+x,p=pixels[i],char=phrase[i%phrase.length],alpha=.08+(1-p.lum/255)*.92;
    let tx=(x+.5)*cellW,ty=(y+.5)*cellH,rot=0,scale=1,visible=1;
    const r1=rand(),r2=rand(),r3=rand(),phase=r1*Math.PI*2;
    if(anim==='letterDrift'){tx+=Math.sin(progress*Math.PI*2+phase)*cellW*.28;ty+=Math.cos(progress*Math.PI*2*.8+phase)*cellH*.28;rot=Math.sin(progress*Math.PI*2+phase)*.08;}
    if(anim==='letterWind'){const gust=Math.sin(progress*Math.PI*2);tx+=gust*canvas.width*(.015+.035*r1)*(1-p.lum/255);ty+=Math.sin(progress*Math.PI*4+phase)*cellH*.18;}
    if(anim==='letterPulse'){scale=.78+.32*(.5+.5*Math.sin(progress*Math.PI*2+phase));}
    if(anim==='letterFlicker'){visible=((Math.floor(progress*28+i*13)%17)<2&&r2<.45)?0:1;}
    if(anim==='letterAssemble'){const delay=(i/(cols*rows))*.58;const q=Math.max(0,Math.min(1,(progress-delay)/.42));tx=(r1*canvas.width)*(1-q)+tx*q;ty=((r2-.5)*canvas.height*2+canvas.height/2)*(1-q)+ty*q;scale=.3+.7*q;visible=q;}
    if(anim==='letterCollapse'){const q=Math.max(0,Math.min(1,(progress-.12)/.78));tx+=Math.sin(phase)*canvas.width*.32*q;ty+=Math.cos(phase)*canvas.height*.28*q+canvas.height*.22*q*q;rot=q*(r3-.5)*2;visible=1-q*.92;}
    ctx.save();ctx.translate(tx,ty);ctx.rotate(rot);ctx.scale(scale,scale);ctx.globalAlpha=alpha*visible;
    const colorMode=['colorLyrics','organicLyrics','tinyLyrics'].includes(state.style);
    if(colorMode) ctx.fillStyle=`rgb(${p.r},${p.g},${p.b})`; else ctx.fillStyle=opts.ink;
    if(anim==='letterEcho'||state.style==='echoLyrics'){
      const d=cellW*(.16+.28*wave);ctx.globalAlpha=alpha*visible*.28;ctx.fillStyle='#ff315f';ctx.fillText(char,-d,0);ctx.fillStyle='#39d5ff';ctx.fillText(char,d,0);ctx.globalAlpha=alpha*visible;ctx.fillStyle=colorMode?`rgb(${p.r},${p.g},${p.b})`:opts.ink;
    }
    ctx.fillText(char,0,0);ctx.restore();
  }
  ctx.globalAlpha=1;
}

function tintCanvas(source, color) {
  const c=document.createElement('canvas'); c.width=source.width; c.height=source.height;
  const ctx=c.getContext('2d'); ctx.drawImage(source,0,0); ctx.globalCompositeOperation='source-in'; ctx.fillStyle=color; ctx.fillRect(0,0,c.width,c.height); return c;
}
function seededRandom(seed) { let value=Math.floor(seed)||1; return()=>{value=(value*16807)%2147483647; return(value-1)/2147483646;}; }
function hexToRgba(hex, alpha) { const c=hexToRgb(hex); return `rgba(${c.r},${c.g},${c.b},${alpha})`; }
function hexToRgb(hex) { const n=parseInt(hex.slice(1),16); return {r:n>>16,g:(n>>8)&255,b:n&255}; }

function renderMain() {
  els.canvas.hidden=false; els.empty.hidden=true;
  els.status.textContent=styles.find(s=>s.id===state.style).name;
  renderStyle(els.canvas,state.style,state.image,settings(),false);
}
function renderThumbnails() { styles.forEach(style=>renderStyle(previewCanvases.get(style.id),style.id,state.image,settings(),true)); }

function loadImage(file) {
  if (!file) return;
  const name=(file.name||'').toLowerCase();
  if (name.endsWith('.heic') || name.endsWith('.heif')) { els.status.textContent='HEIC пока не поддерживается. Выбери JPG или PNG.'; return; }
  els.status.textContent='Загрузка фотографии...';
  const reader=new FileReader();
  reader.onerror=()=>{els.status.textContent='Не удалось прочитать файл';};
  reader.onload=()=>{
    const img=new Image();
    img.onload=()=>{state.image=img; els.exportPngBtn.disabled=false; els.exportSvgBtn.disabled=false; els.exportVideoBtn.disabled=false; els.playBtn.disabled=false; els.randomBtn.disabled=false; els.status.textContent='Фотография загружена'; scheduleRender(true); if(state.mode==='video') startPreview();};
    img.onerror=()=>{els.status.textContent='Формат изображения не поддерживается';};
    img.src=reader.result;
  };
  reader.readAsDataURL(file);
}

els.file.addEventListener('change',e=>loadImage(e.target.files[0]));
['columns','effect','structure','contrast','brightness','charset','inkColor','bgColor','invert','transparent','modGlow','modGrain','modRgb','modOutline','modVignette','modifierAmount'].forEach(id=>document.querySelector('#'+id).addEventListener('input',()=>scheduleRender(true)));
['columns','effect','structure','contrast','brightness','modifierAmount'].forEach(id=>{const input=document.querySelector('#'+id),out=document.querySelector('#'+id+'Value'); input.addEventListener('input',()=>out.value=input.value);});
els.randomBtn.addEventListener('click',()=>{state.seed=Math.random()*1000000; scheduleRender(true);});


function styleSlug() { return state.style.replace(/[A-Z]/g, m => '-' + m.toLowerCase()); }
function downloadBlob(blob, name) { const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500); }

function exportPng() { renderMain(); els.canvas.toBlob(blob=>blob&&downloadBlob(blob,`dark-after-${styleSlug()}.png`),'image/png'); }

function svgEsc(s){return String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
function createSvg() {
  const opts=settings(), img=state.image, dims=fitDimensions(img,1800), w=dims.width,h=dims.height;
  const bg=opts.transparent?'':`<rect width="100%" height="100%" fill="${opts.bg}"/>`;
  let body='';
  if(['ascii','colorAscii','gradientAscii','lyrics','colorLyrics','organicLyrics','echoLyrics','tinyLyrics','binary'].includes(state.style)){
    const cols=Math.min(180,opts.columns), rows=Math.max(1,Math.round(cols*h/w*.52)), px=getPixels(img,cols,rows,opts), cw=w/cols,ch=h/rows;
    const density='@%#*+=-:. ', phrase=opts.text.replace(/\s+/g,' ')||'DARK AFTER';
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const p=px[y*cols+x], lyric=['lyrics','colorLyrics','organicLyrics','echoLyrics','tinyLyrics'].includes(state.style); let char=state.style==='binary'?(p.lum<128?'1':'0'):lyric?phrase[(y*cols+x)%phrase.length]:density[Math.min(density.length-1,Math.floor(p.lum/255*density.length))];
      const colorMode=['colorAscii','colorLyrics','organicLyrics','tinyLyrics'].includes(state.style); const fill=colorMode?`rgb(${p.r},${p.g},${p.b})`:opts.ink; const opacity=lyric?(0.1+(1-p.lum/255)*.9):1;
      body+=`<text x="${(x+.5)*cw}" y="${y*ch}" fill="${fill}" fill-opacity="${opacity}" font-family="monospace" font-weight="700" font-size="${ch*1.15}" text-anchor="middle" dominant-baseline="hanging">${svgEsc(char)}</text>`;
    }
  } else if(state.style==='halftone'){
    const cols=Math.max(18,Math.round(opts.columns*(.35+opts.structure*.45))),rows=Math.max(1,Math.round(cols*h/w)),px=getPixels(img,cols,rows,opts),cw=w/cols,ch=h/rows;
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const p=px[y*cols+x],r=Math.min(cw,ch)*.5*Math.pow(1-p.lum/255,.7+opts.effect);body+=`<circle cx="${(x+.5)*cw}" cy="${(y+.5)*ch}" r="${r}" fill="${opts.ink}"/>`;}
  } else {
    const c=document.createElement('canvas'); renderStyle(c,state.style,img,opts,false); const data=c.toDataURL('image/png'); body=`<image href="${data}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg}${body}</svg>`;
}
function exportSvg(){downloadBlob(new Blob([createSvg()],{type:'image/svg+xml'}),`dark-after-${styleSlug()}.svg`);}

function setMode(mode){
  state.mode=mode; document.querySelectorAll('.mode-tab').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  const video=mode==='video'; els.videoControls.hidden=!video; els.exportVideoBtn.hidden=!video; els.exportPngBtn.hidden=video; els.exportSvgBtn.hidden=video;
  els.canvas.hidden=video||!state.image; els.videoCanvas.hidden=!video||!state.image; if(video&&state.image)startPreview(); else stopPreview();
}
function setVideoSize(){
  if(els.format.value==='vertical'){els.videoCanvas.width=720;els.videoCanvas.height=1280;}
  else if(els.format.value==='square'){els.videoCanvas.width=900;els.videoCanvas.height=900;}
  else {const d=fitDimensions(state.image,1080);els.videoCanvas.width=d.width;els.videoCanvas.height=d.height;}
}
function drawCover(ctx,source,w,h,scale=1,dx=0,dy=0,alpha=1){const r=Math.max(w/source.width,h/source.height)*scale,sw=source.width*r,sh=source.height*r;ctx.globalAlpha=alpha;ctx.drawImage(source,(w-sw)/2+dx,(h-sh)/2+dy,sw,sh);ctx.globalAlpha=1;}

function ensureAudioGraph(){
  if(!els.audioPlayer.src) return false;
  if(!state.audioCtx){
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextClass) return false;
    state.audioCtx=new AudioContextClass();
    state.analyser=state.audioCtx.createAnalyser();state.analyser.fftSize=1024;state.analyser.smoothingTimeConstant=.72;
    state.audioDestination=state.audioCtx.createMediaStreamDestination();
    state.audioSource=state.audioCtx.createMediaElementSource(els.audioPlayer);
    state.audioSource.connect(state.analyser);state.analyser.connect(state.audioCtx.destination);state.analyser.connect(state.audioDestination);
    state.audioData=new Uint8Array(state.analyser.frequencyBinCount);
  }
  if(state.audioCtx.state==='suspended') state.audioCtx.resume();
  return true;
}
function bandAverage(data,from,to){let sum=0,count=0;for(let i=from;i<=to&&i<data.length;i++){sum+=data[i];count++;}return count?sum/count/255:0;}
function updateAudioBands(){
  if(!els.audioReactive.checked||!state.analyser||els.audioPlayer.paused){state.bands={bass:0,mid:0,high:0};}
  else{
    state.analyser.getByteFrequencyData(state.audioData);
    const nyquist=state.audioCtx.sampleRate/2, binHz=nyquist/state.audioData.length;
    const idx=f=>Math.max(0,Math.min(state.audioData.length-1,Math.round(f/binHz)));
    state.bands={bass:bandAverage(state.audioData,idx(45),idx(180)),mid:bandAverage(state.audioData,idx(250),idx(2400)),high:bandAverage(state.audioData,idx(3500),idx(11000))};
  }
  els.bassMeter.style.width=`${Math.min(100,state.bands.bass*140)}%`;els.midMeter.style.width=`${Math.min(100,state.bands.mid*140)}%`;els.highMeter.style.width=`${Math.min(100,state.bands.high*160)}%`;
  return state.bands;
}
function drawRecognition(ctx,canvas,progress,opts,bands){
  const cols=Math.min(94,Math.max(38,Math.round(opts.columns*.65))),rows=Math.max(1,Math.round(cols*canvas.height/canvas.width*.52));
  const pixels=getPixels(state.image,cols,rows,opts),cw=canvas.width/cols,ch=canvas.height/rows,phrase=opts.text.replace(/\s+/g,' ')||'DARK AFTER';
  const symbols='@#$%&*+=?/\\|01<>[]{}',base=Number(els.recognitionBase.value)/100;
  const midGain=Number(els.midSensitivity.value)/100,bassGain=Number(els.bassSensitivity.value)/100,highGain=Number(els.highSensitivity.value)/100;
  const recognition=Math.max(0,Math.min(1,base+progress*.32+bands.mid*midGain*.72));
  const rowShift=canvas.width*(.006+bands.bass*bassGain*.12),flicker=.02+bands.high*highGain*.34;
  const rand=seededRandom(opts.seed+Math.floor(progress*180));ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${Math.ceil(ch*.98)}px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace`;
  for(let y=0;y<rows;y++){
    const burst=(Math.sin(progress*Math.PI*18+y*.73)>0.84?1:0)*bands.bass;
    const shift=(rand()<.12+bands.bass*.35?(rand()-.5)*rowShift*(1+burst*2):0);
    for(let x=0;x<cols;x++){
      const i=y*cols+x,p=pixels[i],target=phrase[i%phrase.length],localWave=(x/cols+progress*1.4)%1;
      const localRecognition=Math.max(0,Math.min(1,recognition+(localWave<.18?.28:0)-(p.lum/255)*.08));
      const wrong=rand()>localRecognition,char=wrong?symbols[Math.floor(rand()*symbols.length)]:target;
      if(rand()<flicker*(wrong?1.4:.35))continue;
      const alpha=.08+(1-p.lum/255)*.92, colorZone=((x/cols+progress*.55)%1)<(.08+bands.mid*.18);
      ctx.globalAlpha=alpha*(wrong?.72:1);ctx.fillStyle=colorZone?`rgb(${p.r},${p.g},${p.b})`:(wrong?(rand()>.5?'#ff315f':'#39d5ff'):opts.ink);
      const jitter=wrong?(rand()-.5)*ch*.22*bands.high:0;ctx.fillText(char,(x+.5)*cw+shift,(y+.5)*ch+jitter);
    }
  }
  ctx.globalAlpha=1;
  if(bands.bass>.28){ctx.fillStyle=`rgba(255,255,255,${bands.bass*.08})`;ctx.fillRect(0,0,canvas.width,canvas.height);}
}

function renderVideoFrame(t){
  if(!state.image)return; setVideoSize(); const c=els.videoCanvas,ctx=c.getContext('2d'),opts=settings(),speed=Number(els.speed.value)/100;
  const p=((t*speed)%1+1)%1, wave=.5-.5*Math.cos(p*Math.PI*2), bands=updateAudioBands(); ctx.clearRect(0,0,c.width,c.height); if(!opts.transparent){ctx.fillStyle=opts.bg;ctx.fillRect(0,0,c.width,c.height);}
  const anim=els.animation.value;
  if(anim==='recognition'){drawRecognition(ctx,c,p,opts,bands);return;}
  if(isLyricStyle(state.style) && anim.startsWith('letter')){
    drawAnimatedLyrics(ctx,c,p,anim,opts); return;
  }
  const temp=document.createElement('canvas'); let local={...opts};
  if(anim==='glitchStorm'||anim==='signal'){local.seed=state.seed+Math.floor(p*24);local.effect=Math.min(1,opts.effect*(.45+wave*1.2));}
  if(anim==='rgbPulse') local.effect=Math.min(1,.2+wave*.8);
  renderStyle(temp,state.style,state.image,local,false);
  if(anim==='assemble'){
    const bands=24,visible=Math.ceil(bands*p);for(let i=0;i<visible;i++){const sy=i*temp.height/bands,sh=temp.height/bands+1,drift=(1-p)*(i%2?1:-1)*c.width*.18;ctx.drawImage(temp,0,sy,temp.width,sh,drift,i*c.height/bands,c.width,c.height/bands+1);}
  } else if(anim==='decay'){
    drawCover(ctx,temp,c.width,c.height,1,0,0,1-p*.75);const rand=seededRandom(state.seed+Math.floor(p*60));ctx.fillStyle=opts.bg;const count=Math.floor(p*900);for(let i=0;i<count;i++){const x=rand()*c.width,y=rand()*c.height,s=2+rand()*18*p;ctx.fillRect(x,y,s,s);}
  } else if(anim==='scanner'){
    ctx.globalAlpha=.18;drawCover(ctx,temp,c.width,c.height);ctx.globalAlpha=1;ctx.save();ctx.beginPath();ctx.rect(0,0,c.width,c.height*p);ctx.clip();drawCover(ctx,temp,c.width,c.height);ctx.restore();ctx.fillStyle=opts.ink;ctx.globalAlpha=.65;ctx.fillRect(0,c.height*p-2,c.width,4);ctx.globalAlpha=1;
  } else if(anim==='rgbPulse'){
    const sh=c.width*(.004+.025*wave);ctx.globalCompositeOperation='screen';ctx.globalAlpha=.8;drawCover(ctx,tintCanvas(temp,'#ff003c'),c.width,c.height,1,-sh,0);drawCover(ctx,tintCanvas(temp,'#00f0ff'),c.width,c.height,1,sh,0);ctx.globalAlpha=.55;drawCover(ctx,temp,c.width,c.height);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  } else if(anim==='breathing'){
    drawCover(ctx,temp,c.width,c.height,1+.025*wave,0,0,.72+.28*wave);
  } else if(anim==='glitchStorm'){
    drawCover(ctx,temp,c.width,c.height);const rand=seededRandom(local.seed);for(let i=0;i<8+Math.floor(wave*25);i++){const y=rand()*c.height,h=2+rand()*c.height*.035,shift=(rand()-.5)*c.width*.25*wave;ctx.drawImage(c,0,y,c.width,h,shift,y,c.width,h);}
  } else {
    const jitter=Math.sin(p*Math.PI*12)*c.width*.006*wave;drawCover(ctx,temp,c.width,c.height,1,jitter,0,.82+.18*wave);
  }
}
function previewLoop(now){if(!state.playing)return;const duration=Number(els.duration.value)*1000;const p=((now-state.animationStart)%duration)/duration;renderVideoFrame(p);state.raf=requestAnimationFrame(previewLoop);}
function startPreview(){if(!state.image)return;stopPreview();state.playing=true;if(els.syncAudio.checked&&els.audioPlayer.src){ensureAudioGraph();els.audioPlayer.currentTime=0;els.audioPlayer.play().catch(()=>{});}state.animationStart=performance.now();els.playBtn.textContent='Остановить превью';els.videoCanvas.hidden=false;state.raf=requestAnimationFrame(previewLoop);}
function stopPreview(){state.playing=false;cancelAnimationFrame(state.raf);if(els.syncAudio&&els.syncAudio.checked&&!els.audioPlayer.paused)els.audioPlayer.pause();if(els.playBtn)els.playBtn.textContent='Запустить превью';}
async function exportVideo(){
  if(!state.image||!els.videoCanvas.captureStream||typeof MediaRecorder==='undefined'){alert('Этот браузер не умеет экспортировать видео. Попробуй Safari или Chrome поновее.');return;}
  stopPreview(); setVideoSize(); const fps=30,stream=els.videoCanvas.captureStream(fps);if(els.audioPlayer.src&&ensureAudioGraph()){state.audioDestination.stream.getAudioTracks().forEach(track=>stream.addTrack(track));els.audioPlayer.currentTime=0;await els.audioPlayer.play().catch(()=>{});}const types=['video/mp4;codecs=h264','video/mp4','video/webm;codecs=vp9','video/webm'];let mime=types.find(t=>MediaRecorder.isTypeSupported(t))||'';
  const recorder=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:8_000_000}:undefined),chunks=[];recorder.ondataavailable=e=>e.data.size&&chunks.push(e.data);
  const duration=Number(els.duration.value)*1000,start=performance.now();els.recordingBadge.hidden=false;els.exportVideoBtn.disabled=true;
  recorder.start(200);
  await new Promise(resolve=>{function step(now){const p=Math.min(1,(now-start)/duration);renderVideoFrame(p%1);if(p<1)requestAnimationFrame(step);else resolve();}requestAnimationFrame(step);});
  await new Promise(resolve=>{recorder.onstop=resolve;recorder.stop();});els.audioPlayer.pause();els.recordingBadge.hidden=true;els.exportVideoBtn.disabled=false;
  const ext=mime.includes('mp4')?'mp4':'webm';downloadBlob(new Blob(chunks,{type:mime||'video/webm'}),`dark-after-${styleSlug()}-${els.animation.value}.${ext}`);startPreview();
}

els.exportPngBtn.addEventListener('click',exportPng);els.exportSvgBtn.addEventListener('click',exportSvg);els.exportVideoBtn.addEventListener('click',exportVideo);
document.querySelectorAll('.mode-tab').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
els.playBtn.addEventListener('click',()=>state.playing?stopPreview():startPreview());
['animation','format','loop'].forEach(id=>document.querySelector('#'+id).addEventListener('input',()=>{if(state.mode==='video'&&state.image)startPreview();}));
['duration','speed'].forEach(id=>{const input=document.querySelector('#'+id),out=document.querySelector('#'+id+'Value');input.addEventListener('input',()=>{out.value=input.value;if(state.mode==='video'&&state.image)startPreview();});});

els.audioInput.addEventListener('change',e=>{const file=e.target.files&&e.target.files[0];if(!file)return;if(state.audioUrl)URL.revokeObjectURL(state.audioUrl);state.audioUrl=URL.createObjectURL(file);els.audioPlayer.src=state.audioUrl;els.audioFileName.textContent=file.name;els.status.textContent='Песня загружена — выбери Recognition Engine';});
els.audioPlayer.addEventListener('play',()=>ensureAudioGraph());
['bassSensitivity','midSensitivity','highSensitivity','recognitionBase'].forEach(id=>{const input=document.querySelector('#'+id),out=document.querySelector('#'+id+'Value');input.addEventListener('input',()=>out.value=input.value);});

createStyleCards();setMode('photo');
