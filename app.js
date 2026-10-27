'use strict';

const state = { idx: parseCode(location.hash.slice(1)) || [7, 6, 5, 4, 3, 2, 1, 0], src: null, timer: null };
const $ = id => document.getElementById(id);
const controls = [];


function get_image(image_id) {
  let p = PUZZLES.filter((el) => (el.val == image_id))[0]
  return { src: p.src, name: p.name }
}

function get_puzzle(puzzle_id) {
  return PUZZLES.filter((el) => (el.puzzle == puzzle_id))[0]
}

function update_image_select(el, image_id, param_id) {
  let p = get_image(image_id)
  el.querySelector("h2").innerText = `${param_id + 1}. ${p.name}`
  let img = el.querySelector("img")
  img.src = p.src
  img.alt = "portrait de ${p.name}"
  setParam(param_id, +image_id)
}

function buildImageSelector(param_id, init_image_id) {
  let p = get_image(init_image_id)
  const el = document.createElement('div');
  el.className = 'param';
  el.innerHTML = `
    <div class="param-head">
      <button class="btn" type="button"><</button>
      <h2>${param_id + 1}. ${p.name}</h2>
      <button class="btn" type="button">></button>
    </div>
    <div>
      <img src="${p.src}" alt="portrait de ${p.name}">
    </div>
      <input type="range" min="0" max="7" step="1" value="${init_image_id}">`;
  const btns = el.querySelectorAll('button');
  const range = el.querySelector('input');
  range.addEventListener('input', () => update_image_select(el, +range.value, param_id));
  btns[0].addEventListener('click', () => update_image_select(el, ((parseInt(range.value) - 1) % 8 + 8) % 8, param_id));
  btns[1].addEventListener('click', () => update_image_select(el, ((parseInt(range.value) + 1) % 8 + 8) % 8, param_id));
  controls.push({ range });
  $('controls').appendChild(el);
}


function buildControls() {
  state.idx.forEach((v, k) => {
    buildImageSelector(k, v)
  })
}

function refreshControls() {
  state.idx.forEach((v, k) => {
    controls[k].range.value = v;
  });
  const code = state.idx.map(v => v).join('');
  history.replaceState(null, '', '#' + code);

  if (code == SOLUTION) {
    $("map").hidden = true
  } else {
    $("map").hidden = false
  }
}

function setParam(k, v) {
  state.idx[k] = v;
  refreshControls();
  scheduleRender();
}

function setAll(idx) {
  console.log("setall", idx)
  state.idx = idx.slice();
  refreshControls();
  scheduleRender();
}

function parseCode(str) {
  return /^[0-7]{8}$/.test(str) ? [...str].map(c => +c) : [7, 6, 5, 4, 3, 2, 1, 0];
}

/* ---------- Image ---------- */

function loadImage(img) {
  const max = 1000;
  const ratio = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * ratio)), h = Math.max(1, Math.round(img.naturalHeight * ratio));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  state.src = { w, h, d: data.data };
  state.image = img;
  $('views').hidden = false;
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

function loadDefault() {
  // En file://, l'image polluerait le canvas ; on laisse la zone de dépôt.
  if (!/^https?:$/.test(location.protocol)) return;
  state.name = 'wip1';
  const img = new Image();
  img.onload = () => loadImage(img);
  img.src = 'image/wip1.png';
}

/* ---------- Rendu ---------- */

function scheduleRender() {
  if (!state.src) return;
  clearTimeout(state.timer);
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
}


function showPuzzlePopup(puzzle_id) {
  let puzzle = get_puzzle(puzzle_id)
  let el = $("popup-container")
  el.hidden = false
  el.querySelector('h2').innerText = puzzle.desc;
  el.querySelector('img').src = puzzle.psrc;
}

function init_map() {
  var map = L.map('map').setView([45.769239, 4.852714], 14);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  var track = L.polyline(TRACK_POINTS, { color: 'darkorange' }).addTo(map);
  map.fitBounds(track.getBounds());

  const markers = [
    L.marker([45.775418, 4.856354], { title: "1" }).addTo(map),
    L.marker([45.777530, 4.853036], { title: "2" }).addTo(map),
    L.marker([45.777843, 4.845228], { title: "3" }).addTo(map),
    L.marker([45.771774, 4.843887], { title: "4" }).addTo(map),
    L.marker([45.768967, 4.847245], { title: "5" }).addTo(map),
    L.marker([45.763609, 4.848254], { title: "6" }).addTo(map),
    L.marker([45.762598, 4.857620], { title: "7" }).addTo(map),
    L.marker([45.768369, 4.859101], { title: "8" }).addTo(map),
  ]
  markers.forEach((el, idx) => el.addEventListener("click", () => showPuzzlePopup(idx)))

}


/* ---------- Événements ---------- */
buildControls();
setAll(parseCode(location.hash.slice(1)) || state.idx);
loadDefault();
init_map();

$("popup-container").addEventListener("click", () => $("popup-container").hidden = true)
$("popup").addEventListener("click", (e) => e.stopPropagation())