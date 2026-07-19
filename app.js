const styles = [
  { id: 'ascii', name: 'ASCII MONO', desc: 'Контрастный портрет из символов' },
  { id: 'colorAscii', name: 'ASCII COLOR', desc: 'Символы сохраняют цвет фотографии' },
  { id: 'lyrics', name: 'LYRIC FIELD', desc: 'Изображение из повторяющегося текста' },
  { id: 'binary', name: 'BINARY', desc: 'Цифровая структура из нулей и единиц' },
  { id: 'halftone', name: 'HALFTONE', desc: 'Печатные точки переменного размера' },
  { id: 'scanline', name: 'BROKEN SCAN', desc: 'Сканлайны, смещения и цифровой шум' }
];

const els = {
  file: document.querySelector('#fileInput'),
  canvas: document.querySelector('#mainCanvas'),
  empty: document.querySelector('#emptyState'),
  styleGrid: document.querySelector('#styleGrid'),
  exportBtn: document.querySelector('#exportBtn'),
  randomBtn: document.querySelector('#randomBtn'),
  status: document.querySelector('#status'),
  columns: document.querySelector('#columns'),
  contrast: document.querySelector('#contrast'),
  brightness: document.querySelector('#brightness'),
  charset: document.querySelector('#charset'),
  ink: document.querySelector('#inkColor'),
  bg: document.querySelector('#bgColor'),
  invert: document.querySelector('#invert'),
  transparent: document.querySelector('#transparent')
};

const state = { image: null, style: 'ascii', seed: Math.random() * 10000 };
const previewCanvases = new Map();
let renderTimer;

function createStyleCards() {
  styles.forEach(style => {
    const button = document.createElement('button');
    button.className = 'style-card' + (style.id === state.style ? ' active' : '');
    button.dataset.style = style.id;
    button.innerHTML = `<canvas width="260" height="260"></canvas><div class="style-meta"><span class="style-name">${style.name}</span><span class="style-desc">${style.desc}</span></div>`;
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
    columns: Number(els.columns.value),
    contrast: Number(els.contrast.value),
    brightness: Number(els.brightness.value),
    text: els.charset.value.trim() || 'DARK AFTER',
    ink: els.ink.value,
    bg: els.bg.value,
    invert: els.invert.checked,
    transparent: els.transparent.checked,
    seed: state.seed
  };
}

function scheduleRender(includeThumbnails = true) {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    if (!state.image) return;
    renderMain();
    if (includeThumbnails) renderThumbnails();
  }, 40);
}

function fitDimensions(img, maxSide = 1200) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  return { width: Math.max(1, Math.round(img.naturalWidth * scale)), height: Math.max(1, Math.round(img.naturalHeight * scale)) };
}

function getPixels(img, width, height, opts) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  const pixels = [];
  const factor = (259 * (opts.contrast + 255)) / (255 * (259 - opts.contrast));
  for (let i = 0; i < data.length; i += 4) {
    let r = factor * (data[i] - 128) + 128 + opts.brightness;
    let g = factor * (data[i+1] - 128) + 128 + opts.brightness;
    let b = factor * (data[i+2] - 128) + 128 + opts.brightness;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (opts.invert) lum = 255 - lum;
    pixels.push({ r, g, b, lum, a: data[i+3] });
  }
  return pixels;
}

function clearCanvas(ctx, canvas, opts) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!opts.transparent) { ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, canvas.width, canvas.height); }
}

function renderStyle(canvas, styleId, img, opts, preview = false) {
  const dims = preview ? { width: canvas.width, height: canvas.height } : fitDimensions(img, 1400);
  canvas.width = dims.width; canvas.height = dims.height;
  const ctx = canvas.getContext('2d');
  clearCanvas(ctx, canvas, opts);
  if (styleId === 'halftone') return drawHalftone(ctx, canvas, img, opts, preview);
  if (styleId === 'scanline') return drawScanline(ctx, canvas, img, opts, preview);
  return drawTextMode(ctx, canvas, img, opts, styleId, preview);
}

function drawTextMode(ctx, canvas, img, opts, styleId, preview) {
  const columns = preview ? 44 : opts.columns;
  const aspectCorrection = 0.52;
  const rows = Math.max(1, Math.round(columns * (canvas.height / canvas.width) * aspectCorrection));
  const pixels = getPixels(img, columns, rows, opts);
  const cellW = canvas.width / columns;
  const cellH = canvas.height / rows;
  const fontSize = Math.ceil(cellH * 1.12);
  ctx.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  const density = '@%#*+=-:. ';
  const phrase = opts.text.replace(/\s+/g, ' ') || 'DARK AFTER';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const p = pixels[y * columns + x];
      let char;
      if (styleId === 'binary') char = p.lum < 128 ? '1' : '0';
      else if (styleId === 'lyrics') char = phrase[(y * columns + x) % phrase.length];
      else char = density[Math.min(density.length - 1, Math.floor((p.lum / 255) * density.length))];
      if (styleId === 'colorAscii') ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
      else if (styleId === 'lyrics') {
        const alpha = .12 + (1 - p.lum / 255) * .88;
        ctx.fillStyle = hexToRgba(opts.ink, alpha);
      } else ctx.fillStyle = opts.ink;
      ctx.fillText(char, x * cellW + cellW / 2, y * cellH);
    }
  }
}

function drawHalftone(ctx, canvas, img, opts, preview) {
  const columns = preview ? 34 : Math.max(25, Math.round(opts.columns * .6));
  const rows = Math.round(columns * canvas.height / canvas.width);
  const pixels = getPixels(img, columns, rows, opts);
  const cellW = canvas.width / columns, cellH = canvas.height / rows;
  ctx.fillStyle = opts.ink;
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const p = pixels[y * columns + x];
    const darkness = 1 - p.lum / 255;
    const radius = Math.max(0, Math.min(cellW, cellH) * .48 * darkness);
    ctx.beginPath(); ctx.arc(x * cellW + cellW/2, y * cellH + cellH/2, radius, 0, Math.PI * 2); ctx.fill();
  }
}

function drawScanline(ctx, canvas, img, opts, preview) {
  const source = document.createElement('canvas'); source.width = canvas.width; source.height = canvas.height;
  const sctx = source.getContext('2d'); sctx.filter = `contrast(${100 + opts.contrast}%) brightness(${100 + opts.brightness}%) grayscale(100%)`;
  sctx.drawImage(img, 0, 0, source.width, source.height);
  const band = preview ? 5 : Math.max(3, Math.round(canvas.height / 180));
  const rand = seededRandom(opts.seed);
  for (let y = 0; y < canvas.height; y += band) {
    const shift = (rand() > .78 ? (rand() - .5) * canvas.width * .16 : (rand() - .5) * 4);
    ctx.globalAlpha = .72 + rand() * .28;
    ctx.drawImage(source, 0, y, canvas.width, band, shift, y, canvas.width, band);
    if (rand() > .88) { ctx.fillStyle = hexToRgba(opts.ink, .22); ctx.fillRect(0, y, canvas.width, Math.max(1, band/2)); }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = hexToRgba(opts.ink, .13);
  for (let y = 0; y < canvas.height; y += band * 3) ctx.fillRect(0, y, canvas.width, 1);
  ctx.globalCompositeOperation = 'source-over';
}

function seededRandom(seed) {
  let value = Math.floor(seed) || 1;
  return () => { value = (value * 16807) % 2147483647; return (value - 1) / 2147483646; };
}
function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16); return `rgba(${n>>16},${(n>>8)&255},${n&255},${alpha})`;
}
function renderMain() {
  els.canvas.hidden = false; els.empty.hidden = true;
  els.status.textContent = styles.find(s => s.id === state.style).name;
  renderStyle(els.canvas, state.style, state.image, settings(), false);
}
function renderThumbnails() {
  styles.forEach(style => renderStyle(previewCanvases.get(style.id), style.id, state.image, settings(), true));
}
function loadImage(file) {
  if (!file) return;

  els.status.textContent = `Загрузка: ${file.name}`;

  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const isHeic = /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);

  if (isHeic) {
    els.status.textContent = 'HEIC пока не поддерживается';
    alert('Это HEIC-фотография. Для проверки выбери скриншот PNG или экспортируй фото как JPG.');
    els.file.value = '';
    return;
  }

  if (file.type && !supportedTypes.includes(file.type)) {
    els.status.textContent = `Неподдерживаемый формат: ${file.type}`;
  }

  const reader = new FileReader();
  reader.onerror = () => {
    els.status.textContent = 'Ошибка чтения файла';
    alert('Браузер не смог прочитать файл. Попробуй JPG, PNG или WEBP.');
  };
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      state.image = img;
      els.exportBtn.disabled = false;
      els.randomBtn.disabled = false;
      els.status.textContent = `Загружено: ${file.name}`;
      scheduleRender(true);
    };
    img.onerror = () => {
      els.status.textContent = 'Формат изображения не декодируется';
      alert('Файл выбран, но Safari не смог декодировать изображение. Попробуй скриншот PNG или JPG.');
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

els.file.addEventListener('change', e => loadImage(e.target.files[0]));
['columns','contrast','brightness','charset','inkColor','bgColor','invert','transparent'].forEach(id => {
  document.querySelector('#' + id).addEventListener('input', () => scheduleRender(true));
});
['columns','contrast','brightness'].forEach(id => {
  const input = document.querySelector('#' + id), out = document.querySelector('#' + id + 'Value');
  input.addEventListener('input', () => out.value = input.value);
});
els.randomBtn.addEventListener('click', () => { state.seed = Math.random() * 100000; scheduleRender(true); });
els.exportBtn.addEventListener('click', () => {
  renderMain();
  const link = document.createElement('a');
  const styleName = state.style.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
  link.download = `dark-after-${styleName}.png`;
  link.href = els.canvas.toDataURL('image/png'); link.click();
});

createStyleCards();
