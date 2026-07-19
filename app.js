const styles = [
  { id: 'ascii', name: 'ASCII MONO', desc: 'Контрастный портрет из символов' },
  { id: 'colorAscii', name: 'ASCII COLOR', desc: 'Символы сохраняют цвет фотографии' },
  { id: 'lyrics', name: 'LYRIC FIELD', desc: 'Изображение из повторяющегося текста' },
  { id: 'binary', name: 'BINARY', desc: 'Цифровая структура из нулей и единиц' },
  { id: 'halftone', name: 'HALFTONE', desc: 'Печатные точки переменного размера' },
  { id: 'scanline', name: 'BROKEN SCAN', desc: 'Полосы, разрывы и смещения строк' },
  { id: 'rgbSplit', name: 'RGB SPLIT', desc: 'Разъехавшиеся цветовые каналы' },
  { id: 'blockGlitch', name: 'BLOCK GLITCH', desc: 'Повреждённые прямоугольные фрагменты' },
  { id: 'pixelSort', name: 'PIXEL SORT', desc: 'Пиксели растекаются по яркости' },
  { id: 'dataBend', name: 'DATA BEND', desc: 'Цифровое повреждение и цветовые сбои' },
  { id: 'xerox', name: 'XEROX', desc: 'Грубая фотокопия для шелкографии' },
  { id: 'contour', name: 'CONTOUR', desc: 'Светящиеся края и линии формы' },
  { id: 'barcode', name: 'BARCODE', desc: 'Портрет из вертикальных полос' },
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
  recordingBadge: document.querySelector('#recordingBadge')
};

const state = { image: null, style: 'ascii', seed: Math.random() * 100000, mode: 'photo', playing: false, raf: 0, animationStart: 0 };
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
    transparent: els.transparent.checked, seed: state.seed
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
    xerox: drawXerox, contour: drawContour, barcode: drawBarcode, dissolve: drawDissolve
  };
  if (handlers[styleId]) handlers[styleId](ctx, canvas, img, opts, preview);
  else drawTextMode(ctx, canvas, img, opts, styleId, preview);
}

function drawTextMode(ctx, canvas, img, opts, styleId, preview) {
  const columns = preview ? 38 : opts.columns;
  const rows = Math.max(1, Math.round(columns * canvas.height / canvas.width * 0.52));
  const pixels = getPixels(img, columns, rows, opts);
  const cellW = canvas.width / columns, cellH = canvas.height / rows;
  ctx.font = `700 ${Math.ceil(cellH * 1.15)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textBaseline = 'top'; ctx.textAlign = 'center';
  const density = '@%#*+=-:. ';
  const phrase = opts.text.replace(/\s+/g, ' ') || 'DARK AFTER';
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const p = pixels[y * columns + x]; let char;
    if (styleId === 'binary') char = p.lum < 128 ? '1' : '0';
    else if (styleId === 'lyrics') char = phrase[(y * columns + x) % phrase.length];
    else char = density[Math.min(density.length - 1, Math.floor(p.lum / 255 * density.length))];
    if (styleId === 'colorAscii') ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
    else if (styleId === 'lyrics') ctx.fillStyle = hexToRgba(opts.ink, 0.1 + (1 - p.lum / 255) * 0.9);
    else ctx.fillStyle = opts.ink;
    ctx.fillText(char, x * cellW + cellW / 2, y * cellH);
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

function drawBarcode(ctx, canvas, img, opts, preview) {
  const columns = preview ? 48 : Math.max(40, Math.round(opts.columns * (0.5 + opts.structure)));
  const pixels = getPixels(img, columns, 1, opts);
  const source = preparedSource(img, columns, Math.max(1, Math.round(canvas.height / canvas.width * columns)), opts, true);
  const data = source.getContext('2d', { willReadFrequently: true }).getImageData(0,0,source.width,source.height).data;
  const w = canvas.width / columns;
  ctx.fillStyle = opts.ink;
  for (let x=0;x<columns;x++) {
    let sum=0; for(let y=0;y<source.height;y++) sum += data[(y*columns+x)*4];
    const darkness=1-sum/(source.height*255);
    const width=w*Math.max(0.08, Math.pow(darkness, 0.5+opts.effect)*0.95);
    ctx.fillRect(x*w+(w-width)/2,0,width,canvas.height);
  }
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
['columns','effect','structure','contrast','brightness','charset','inkColor','bgColor','invert','transparent'].forEach(id=>document.querySelector('#'+id).addEventListener('input',()=>scheduleRender(true)));
['columns','effect','structure','contrast','brightness'].forEach(id=>{const input=document.querySelector('#'+id),out=document.querySelector('#'+id+'Value'); input.addEventListener('input',()=>out.value=input.value);});
els.randomBtn.addEventListener('click',()=>{state.seed=Math.random()*1000000; scheduleRender(true);});


function styleSlug() { return state.style.replace(/[A-Z]/g, m => '-' + m.toLowerCase()); }
function downloadBlob(blob, name) { const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500); }

function exportPng() { renderMain(); els.canvas.toBlob(blob=>blob&&downloadBlob(blob,`dark-after-${styleSlug()}.png`),'image/png'); }

function svgEsc(s){return String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
function createSvg() {
  const opts=settings(), img=state.image, dims=fitDimensions(img,1800), w=dims.width,h=dims.height;
  const bg=opts.transparent?'':`<rect width="100%" height="100%" fill="${opts.bg}"/>`;
  let body='';
  if(['ascii','colorAscii','lyrics','binary'].includes(state.style)){
    const cols=Math.min(180,opts.columns), rows=Math.max(1,Math.round(cols*h/w*.52)), px=getPixels(img,cols,rows,opts), cw=w/cols,ch=h/rows;
    const density='@%#*+=-:. ', phrase=opts.text.replace(/\s+/g,' ')||'DARK AFTER';
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const p=px[y*cols+x]; let char=state.style==='binary'?(p.lum<128?'1':'0'):state.style==='lyrics'?phrase[(y*cols+x)%phrase.length]:density[Math.min(density.length-1,Math.floor(p.lum/255*density.length))];
      const fill=state.style==='colorAscii'?`rgb(${p.r},${p.g},${p.b})`:opts.ink; const opacity=state.style==='lyrics'?(0.1+(1-p.lum/255)*.9):1;
      body+=`<text x="${(x+.5)*cw}" y="${y*ch}" fill="${fill}" fill-opacity="${opacity}" font-family="monospace" font-weight="700" font-size="${ch*1.15}" text-anchor="middle" dominant-baseline="hanging">${svgEsc(char)}</text>`;
    }
  } else if(state.style==='halftone'){
    const cols=Math.max(18,Math.round(opts.columns*(.35+opts.structure*.45))),rows=Math.max(1,Math.round(cols*h/w)),px=getPixels(img,cols,rows,opts),cw=w/cols,ch=h/rows;
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const p=px[y*cols+x],r=Math.min(cw,ch)*.5*Math.pow(1-p.lum/255,.7+opts.effect);body+=`<circle cx="${(x+.5)*cw}" cy="${(y+.5)*ch}" r="${r}" fill="${opts.ink}"/>`;}
  } else if(state.style==='barcode'){
    const cols=Math.max(40,Math.round(opts.columns*(.5+opts.structure))),source=preparedSource(img,cols,Math.max(1,Math.round(h/w*cols)),opts,true),d=source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,source.width,source.height).data,cw=w/cols;
    for(let x=0;x<cols;x++){let sum=0;for(let y=0;y<source.height;y++)sum+=d[(y*cols+x)*4];const dark=1-sum/(source.height*255),bw=cw*Math.max(.08,Math.pow(dark,.5+opts.effect)*.95);body+=`<rect x="${x*cw+(cw-bw)/2}" y="0" width="${bw}" height="${h}" fill="${opts.ink}"/>`;}
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
function renderVideoFrame(t){
  if(!state.image)return; setVideoSize(); const c=els.videoCanvas,ctx=c.getContext('2d'),opts=settings(),speed=Number(els.speed.value)/100;
  const p=((t*speed)%1+1)%1, wave=.5-.5*Math.cos(p*Math.PI*2); ctx.clearRect(0,0,c.width,c.height); if(!opts.transparent){ctx.fillStyle=opts.bg;ctx.fillRect(0,0,c.width,c.height);}
  const temp=document.createElement('canvas'), anim=els.animation.value; let local={...opts};
  if(anim==='glitchStorm'||anim==='signal'){local.seed=state.seed+Math.floor(p*24);local.effect=Math.min(1,opts.effect*(.45+wave*1.2));}
  if(anim==='rgbPulse') local.effect=Math.min(1,.2+wave*.8);
  renderStyle(temp,state.style,state.image,local,false);
  if(anim==='assemble'){
    const bands=24,visible=Math.ceil(bands*p);for(let i=0;i<visible;i++){const sy=i*temp.height/bands,sh=temp.height/bands+1,drift=(1-p)*(i%2?1:-1)*c.width*.18;ctx.drawImage(temp,0,sy,temp.width,sh,drift,i*c.height/bands,c.width, c.height/bands+1);}
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
function startPreview(){if(!state.image)return;stopPreview();state.playing=true;state.animationStart=performance.now();els.playBtn.textContent='Остановить превью';els.videoCanvas.hidden=false;state.raf=requestAnimationFrame(previewLoop);}
function stopPreview(){state.playing=false;cancelAnimationFrame(state.raf);if(els.playBtn)els.playBtn.textContent='Запустить превью';}
async function exportVideo(){
  if(!state.image||!els.videoCanvas.captureStream||typeof MediaRecorder==='undefined'){alert('Этот браузер не умеет экспортировать видео. Попробуй Safari или Chrome поновее.');return;}
  stopPreview(); setVideoSize(); const fps=30,stream=els.videoCanvas.captureStream(fps),types=['video/mp4;codecs=h264','video/mp4','video/webm;codecs=vp9','video/webm'];let mime=types.find(t=>MediaRecorder.isTypeSupported(t))||'';
  const recorder=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:8_000_000}:undefined),chunks=[];recorder.ondataavailable=e=>e.data.size&&chunks.push(e.data);
  const duration=Number(els.duration.value)*1000,start=performance.now();els.recordingBadge.hidden=false;els.exportVideoBtn.disabled=true;
  recorder.start(200);
  await new Promise(resolve=>{function step(now){const p=Math.min(1,(now-start)/duration);renderVideoFrame(p%1);if(p<1)requestAnimationFrame(step);else resolve();}requestAnimationFrame(step);});
  await new Promise(resolve=>{recorder.onstop=resolve;recorder.stop();});els.recordingBadge.hidden=true;els.exportVideoBtn.disabled=false;
  const ext=mime.includes('mp4')?'mp4':'webm';downloadBlob(new Blob(chunks,{type:mime||'video/webm'}),`dark-after-${styleSlug()}-${els.animation.value}.${ext}`);startPreview();
}

els.exportPngBtn.addEventListener('click',exportPng);els.exportSvgBtn.addEventListener('click',exportSvg);els.exportVideoBtn.addEventListener('click',exportVideo);
document.querySelectorAll('.mode-tab').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
els.playBtn.addEventListener('click',()=>state.playing?stopPreview():startPreview());
['animation','format','loop'].forEach(id=>document.querySelector('#'+id).addEventListener('input',()=>{if(state.mode==='video'&&state.image)startPreview();}));
['duration','speed'].forEach(id=>{const input=document.querySelector('#'+id),out=document.querySelector('#'+id+'Value');input.addEventListener('input',()=>{out.value=input.value;if(state.mode==='video'&&state.image)startPreview();});});
createStyleCards();setMode('photo');
