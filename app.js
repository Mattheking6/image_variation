'use strict';

const PARAMS = [
  { name: 'Fragmentation', tag: 'Découpage', desc: "Découpe l'image en carrés ou en pièces de puzzle remises au mauvais endroit.",
    labels: ['Aucune', 'Carrés tournés', 'Carrés échangés', 'Carrés mélangés', 'Puzzle imparfait', 'Puzzle mélangé', 'Cubes éparpillés', 'Chaos'], def: 0,
    note: 'Le découpage et le mélange sont fixes : un même code donne toujours le même assemblage.' },
  { name: 'Recoloration', tag: 'Colorimétrie', desc: 'Réaffecte une couleur à chaque niveau de gris selon une palette.',
    labels: ['Aucune', 'Sépia', 'Bleu / orange', 'Coucher de soleil', 'Thermique', 'Néon inversé', 'Arc-en-ciel', 'Psyché&shy;délique'], def: 0,
    note: 'Fonctionne même sur une image en noir et blanc : les tons sombres et clairs reçoivent des couleurs différentes.' },
  { name: 'Flou gaussien', tag: 'Structure', desc: 'Efface les détails et finit par faire disparaître les contours.',
    labels: ['0', '1', '2', '4', '8', '16', '32', '64 px'], def: 0,
    note: "Le rayon dépend de la résolution de l'image (référence : 1000 px)." },
  { name: 'Postérisation', tag: 'Rendu', desc: 'Réduit le nombre de niveaux de couleur et transforme les dégradés en aplats.',
    labels: ['2', '3', '4', '6', '8', '12', '16', '32'], def: 7,
    note: "Très efficace pour déformer l'apparence d'une photo." },
  { name: 'Distorsion numérique', tag: 'Déformation', desc: 'Décale les canaux RVB, étire les pixels et introduit des décalages visuels.',
    labels: ['Aucune', 'RVB léger', 'Décalage horiz.', 'Décalage vert.', 'Glitch', 'Pixel sorting', 'Ondulation', 'Glitch extrême'], def: 0,
    note: 'Ce paramètre peut rendre un sujet presque méconnaissable.' },
  { name: 'Extraction des contours', tag: 'Formes', desc: 'Remplace progressivement les surfaces par leurs contours.',
    labels: ['0 %', '15 %', '30 %', '45 %', '60 %', '75 %', '90 %', '100 %'], def: 0,
    note: 'À pleine intensité, une photo peut devenir un dessin de contours.' },
  { name: 'Style artistique', tag: 'Texture', desc: 'Remplace le rendu photographique par un style visuel prédéfini.',
    labels: ['Photo', 'Photocopie', 'BD', "Huile", 'Aquarelle', 'Cubisme', 'Mosaïque', 'Tissage'], def: 0,
    note: 'Styles déterministes : un même code redonne toujours exactement la même image.' },
  { name: 'Déformation géométrique', tag: 'Géométrie', desc: 'Déplace les pixels et modifie les formes, les proportions et la position des éléments.',
    labels: ['Aucune', 'Ondul. légère', 'Ondul. forte', 'Vagues', 'Spirale', 'Bombement', 'Grille', 'Extrême'], def: 0 },
];

const state = { idx: PARAMS.map(p => p.def), src: null, timer: null };
const $ = id => document.getElementById(id);
const controls = [];

function buildControls() {
  PARAMS.forEach((p, k) => {
    const el = document.createElement('div');
    el.className = 'param';
    el.innerHTML = `
      <div class="param-head"><h2>${k + 1}. ${p.name}</h2><span class="tag">${p.tag}</span></div>
      <p>${p.desc}</p>
      <input type="range" min="0" max="7" step="1">
      <div class="ticks">${p.labels.map((l, i) => `<button type="button" data-i="${i}">${l}</button>`).join('')}</div>
      ${p.note ? `<p class="note">${p.note}</p>` : ''}`;
    const range = el.querySelector('input');
    const ticks = [...el.querySelectorAll('.ticks button')];
    range.addEventListener('input', () => setParam(k, +range.value));
    ticks.forEach(b => b.addEventListener('click', () => setParam(k, +b.dataset.i)));
    controls.push({ range, ticks });
    $('controls').appendChild(el);
  });
}

function refreshControls() {
  state.idx.forEach((v, k) => {
    controls[k].range.value = v;
    controls[k].ticks.forEach((b, i) => b.classList.toggle('active', i === v));
  });
  const code = state.idx.map(v => v + 1).join('');
  $('code').value = code;
  $('code').classList.remove('invalid');
  history.replaceState(null, '', '#' + code);
}

function setParam(k, v) {
  state.idx[k] = v;
  refreshControls();
  scheduleRender();
}

function setAll(idx) {
  state.idx = idx.slice();
  refreshControls();
  scheduleRender();
}

function parseCode(str) {
  return /^[1-8]{8}$/.test(str) ? [...str].map(c => +c - 1) : null;
}

/* ---------- Image ---------- */

function loadImage(img) {
  const max = +$('res').value;
  const ratio = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * ratio)), h = Math.max(1, Math.round(img.naturalHeight * ratio));
  const c = $('original');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  state.src = { w, h, d: data.data };
  state.image = img;
  $('drop').hidden = true;
  $('views').hidden = false;
  $('download').disabled = false;
  scheduleRender();
}

function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  state.name = file.name.replace(/\.[^.]+$/, '');
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { loadImage(img); URL.revokeObjectURL(url); };
  img.src = url;
}

/* ---------- Rendu ---------- */

function scheduleRender() {
  if (!state.src) return;
  clearTimeout(state.timer);
  $('status').textContent = 'calcul…';
  // Laisse le navigateur afficher le statut avant le calcul (bloquant).
  state.timer = setTimeout(() => requestAnimationFrame(() => setTimeout(render, 0)), 40);
}

function render() {
  const t0 = performance.now();
  const out = FX.process(state.src, state.idx);
  const c = $('result');
  c.width = out.w; c.height = out.h;
  c.getContext('2d').putImageData(new ImageData(out.d, out.w, out.h), 0, 0);
  state.result = out;
  $('status').textContent = `${out.w}×${out.h} · ${Math.round(performance.now() - t0)} ms`;
}

function showOriginal(on) {
  if (!state.result) return;
  const c = $('result'), ctx = c.getContext('2d');
  const img = on ? state.src : state.result;
  ctx.putImageData(new ImageData(img.d, img.w, img.h), 0, 0);
}

/* ---------- Événements ---------- */

buildControls();
setAll(parseCode(location.hash.slice(1)) || state.idx);

$('file').addEventListener('change', e => loadFile(e.target.files[0]));
$('code').addEventListener('input', e => {
  const idx = parseCode(e.target.value.trim());
  e.target.classList.toggle('invalid', !idx);
  if (idx) setAll(idx);
});
$('random').addEventListener('click', () => setAll(PARAMS.map(() => Math.floor(Math.random() * 8))));
$('reset').addEventListener('click', () => setAll(PARAMS.map(p => p.def)));
$('res').addEventListener('change', () => state.image && loadImage(state.image));
$('download').addEventListener('click', () => {
  const a = document.createElement('a');
  a.download = `${state.name || 'image'}_${$('code').value}.png`;
  a.href = $('result').toDataURL('image/png');
  a.click();
});

const peek = $('peek');
['pointerdown'].forEach(ev => peek.addEventListener(ev, () => showOriginal(true)));
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => peek.addEventListener(ev, () => showOriginal(false)));

window.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('dragging'); });
window.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('dragging'); });
window.addEventListener('drop', e => {
  e.preventDefault();
  document.body.classList.remove('dragging');
  loadFile(e.dataTransfer.files[0]);
});
window.addEventListener('paste', e => {
  const item = [...e.clipboardData.items].find(i => i.type.startsWith('image/'));
  if (item) loadFile(item.getAsFile());
});
