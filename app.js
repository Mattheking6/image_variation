'use strict';

const DEFAULT_CODE = [6, 2, 3, 4, 7, 0, 1, 5];
function readVisited() {
  try {
    const v = JSON.parse(sessionStorage.getItem('visited') || '[]');
    if (Array.isArray(v)) return v.filter(n => Number.isInteger(n) && n >= 0 && n < 8);
  } catch (e) {
    const s = sessionStorage.getItem('visited');
    if (s)
      return s
        .split(',')
        .map(Number)
        .filter(n => Number.isInteger(n) && n >= 0 && n < 8);
  }
  return [];
}
const state = {
  idx: parseCode(location.hash.slice(1)) || DEFAULT_CODE,
  src: null,
  timer: null,
  visited: readVisited()
};
const $ = id => document.getElementById(id);
const controls = [];
const cards = [];
let countdownTimer = null;
let winTimer = null;
let mapFitted = false;
let lastFlank = null;
const DEADLINE = new Date('2027-05-04T00:00:00');

function get_image(image_id) {
  let p = PUZZLES.filter(el => el.val == image_id)[0];
  return { src: p.src, name: p.name };
}

function get_puzzle(puzzle_id) {
  return PUZZLES.filter(el => el.puzzle == puzzle_id)[0];
}

function update_image_select(el, image_id, param_id) {
  let p = get_image(image_id);
  let img = el.querySelector('img');
  img.src = p.src;
  img.alt = 'portrait de ${p.name}';
  el.querySelector('h2').innerText = p.name;
  setParam(param_id, +image_id);
}

function buildImageSelector(param_id, init_image_id) {
  let p = get_image(init_image_id);
  const el = document.createElement('div');
  el.id = `control_${param_id}`;
  el.className = 'param';
  el.innerHTML = `
    <div class="param-thumb">
      <span class="param-badge" aria-hidden="true">${param_id + 1}</span>
      <img src="${p.src}" alt="portrait de ${p.name}" loading="lazy" tabindex="0" role="button" aria-label="Agrandir le portrait de ${p.name}">
      <button class="btn param-nav prev" type="button" aria-label="Image précédente"><</button>
      <button class="btn param-nav next" type="button" aria-label="Image suivante">></button>
    </div>
    <div class="param-info">
      <h2 id="param-title-${param_id}">${p.name}</h2>
      <input type="range" min="0" max="7" step="1" value="${init_image_id}" aria-labelledby="param-title-${param_id}">
    </div>`;
  const btns = el.querySelectorAll('button');
  const range = el.querySelector('input');
  range.addEventListener('input', () => update_image_select(el, +range.value, param_id));
  btns[0].addEventListener('click', () =>
    update_image_select(el, (((parseInt(range.value) - 1) % 8) + 8) % 8, param_id)
  );
  btns[1].addEventListener('click', () =>
    update_image_select(el, (((parseInt(range.value) + 1) % 8) + 8) % 8, param_id)
  );
  controls[param_id] = { range };
  el.dataset.idx = param_id;
  cards[param_id] = el;
}

/* Layout-dependent card placement (see ADR-0001): the flank layout splits
   the cards 4/4 between the side asides — in column-major order so each 2×2
   grid reads 1 2 / 3 4 and 5 6 / 7 8 — while the compact layout puts all
   eight, in numeric order, into the #controls-left filmstrip. */
const flankQuery = matchMedia('(min-aspect-ratio: 1/1) and (min-width: 900px)');

function placeCards() {
  const left = $('controls-left');
  const right = $('controls-right');
  left.textContent = '';
  right.textContent = '';
  if (flankQuery.matches) {
    [0, 2, 1, 3].forEach(k => left.appendChild(cards[k]));
    [4, 6, 5, 7].forEach(k => right.appendChild(cards[k]));
  } else {
    [0, 1, 2, 3, 4, 5, 6, 7].forEach(k => left.appendChild(cards[k]));
  }
  resizeMap();
}

flankQuery.addEventListener('change', placeCards);

function buildControls() {
  [0, 1, 2, 3, 4, 5, 6, 7].forEach(k => buildImageSelector(k, state.idx[k]));
  placeCards();
}

function refreshControls() {
  console.log(state.visited.values());
  state.idx.forEach((v, k) => {
    controls[k].range.value = v;
    let control = $(`control_${k}`);
    let btns = control.querySelectorAll('.btn');
    const disabled = control.hasAttribute('disabled');
    const visited = state.visited.includes(k);
    console.log(
      k,
      v,
      'visited',
      visited,
      'disabled',
      disabled,
      'visited & disabled',
      visited & disabled,
      '!visited & !disabled',
      !visited & !disabled
    );
    if (visited & disabled) {
      control.removeAttribute('disabled');
      btns.forEach(el => el.removeAttribute('disabled'));
    } else {
      if (!visited & !disabled) {
        control.setAttribute('disabled', '');
        btns.forEach(el => el.setAttribute('disabled', ''));
      }
    }
  });
  const code = state.idx.map(v => v).join('');
  history.replaceState(null, '', '#' + code);

  applyViews();
}

/* Keep the trail framed to the map's actual size: Leaflet fits bounds at
   init before the layout (lazy-loaded portraits, viewport) has settled, so
   refit once the first real size is known, and again whenever the layout
   flips between compact and flank. Plain resizes only invalidate size so a
   user's pan/zoom is not yanked away. */
function resizeMap() {
  if (!state.map) return fitCanvas();
  setTimeout(() => {
    state.map.invalidateSize();
    const flipped = flankQuery.matches !== lastFlank;
    lastFlank = flankQuery.matches;
    if (state.trackBounds && (!mapFitted || flipped)) {
      mapFitted = true;
      state.map.fitBounds(state.trackBounds, { padding: [24, 24] });
    }
  }, 60);
  fitCanvas();
}

function applyViews() {
  const won = state.idx.join('') === SOLUTION && state.visited.length == 8;
  if (won) {
    // Morph vers l'image finale, puis 1 s plus tard : passage au panneau de victoire.
    if (!state.finalShown) armFinalRender();
    clearTimeout(winTimer);
    winTimer = setTimeout(startWinTransition, FADE_MS + 1000);
    return;
  }
  $('success-container').hidden = true;
  state.finalShown = false;
  clearTimeout(winTimer);
  winTimer = null;
  clearInterval(countdownTimer);
  countdownTimer = null;
  endWinFlight();
  resizeMap();
}

function armFinalRender() {
  if (!state.src || state.finalShown) return;
  state.finalShown = true;
  clearTimeout(state.timer);
  state.timer = setTimeout(() => requestAnimationFrame(() => setTimeout(render, 0)), 40);
}

function startWinTransition() {
  winTimer = null;
  if (state.idx.join('') !== SOLUTION || state.visited.length != 8) return;
  if (!state.finalShown) {
    winTimer = setTimeout(startWinTransition, 300);
    return;
  }
  beginWinFlight();
  openSuccess();
  setTimeout(resizeMap, 60);
  if (!countdownTimer) startCountdown();
}

function openSuccess() {
  state.lastFocus = document.activeElement;
  $('success-container').hidden = false;
  $('success').focus();
}

function closeSuccess() {
  $('success-container').hidden = true;
  if (state.lastFocus && typeof state.lastFocus.focus === 'function') state.lastFocus.focus();
}

let winFlight = null;

function beginWinFlight() {
  const front = $('result-front');
  const back = $('result');
  const target = $('success-img');
  const from = front.getBoundingClientRect();

  $('win-slot')?.remove?.();
  back.hidden = true;
  front.style.transition = 'opacity 300ms ease';
  front.style.opacity = '0';
  // L'image de victoire prend exactement la taille (et les coins) de l'image finale : aucun changement de taille.
  if (from.width > 0) {
    target.style.width = from.width + 'px';
    target.style.height = from.height + 'px';
    target.style.maxHeight = 'none';
    target.style.objectFit = 'cover';
  }
  target.style.opacity = '0';

  if (reducedMotion.matches || from.width === 0 || from.height === 0) {
    target.style.transition = 'none';
    target.style.opacity = '1';
    return;
  }

  requestAnimationFrame(() => {
    const to = target.getBoundingClientRect();
    let ended = false;
    const img = new Image();
    img.src = front.toDataURL();
    img.id = 'win-slot';
    img.style.cssText = `position: fixed; left: ${from.left}px; top: ${from.top}px; width: ${from.width}px; height: ${from.height}px; margin: 0; z-index: 1100; pointer-events: none; background: #0c0d10; border-radius: 6px;`;
    document.body.appendChild(img);
    winFlight = img;
    const land = () => {
      if (ended) return;
      ended = true;
      // L'image finale (au premier plan) s'efface en fondu et révèle l'image de victoire dessous.
      target.style.transition = 'opacity 2000ms ease';
      target.style.opacity = '1';
      img.style.transition = 'opacity 2000ms ease';
      img.style.opacity = '0';
      setTimeout(() => {
        img.remove();
        if (winFlight === img) winFlight = null;
      }, 2060);
    };
    const fly = () => {
      img.style.transition = 'transform 1000ms cubic-bezier(.45, 0, .2, 1)';
      img.style.transformOrigin = 'top left';
      img.style.transform = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`;
      img.addEventListener('transitionend', land, { once: true });
      setTimeout(land, 1150);
    };
    if (img.complete) fly();
    else img.onload = fly;
  });
}

function endWinFlight() {
  if (winFlight) {
    winFlight.remove();
    winFlight = null;
  }
  const target = $('success-img');
  target.style.transition = 'none';
  target.style.opacity = '';
  target.style.transform = '';
  target.style.width = '';
  target.style.height = '';
  target.style.maxHeight = '';
  target.style.objectFit = '';
  $('result').hidden = false;
  const front = $('result-front');
  if (front) {
    front.style.transition = 'none';
    front.style.opacity = '1';
  }
}

function startCountdown() {
  const el = $('countdown');
  const pad = n => String(n).padStart(2, '0');
  const tick = () => {
    const diff = DEADLINE - Date.now();
    if (diff <= 0) {
      el.textContent = 'Le 4 mai 2027 est arrivé.';
      clearInterval(countdownTimer);
      countdownTimer = null;
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor(diff / 3600000) % 24;
    const m = Math.floor(diff / 60000) % 60;
    const s = Math.floor(diff / 1000) % 60;
    el.textContent = `${d} j ${pad(h)} h ${pad(m)} min ${pad(s)} s`;
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
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
  return /^[0-7]{8}$/.test(str) ? [...str].map(c => +c) : DEFAULT_CODE;
}

/* ---------- Image ---------- */

function loadImage(img) {
  const max = 1000;
  const ratio = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * ratio)),
    h = Math.max(1, Math.round(img.naturalHeight * ratio));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
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
  img.onload = () => {
    loadImage(img);
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

function loadDefault() {
  // En file://, l'image polluerait le canvas ; on laisse la zone de dépôt.
  if (!/^https?:$/.test(location.protocol)) return;
  state.name = 'wip';
  const img = new Image();
  img.onload = () => loadImage(img);
  img.src = 'image/wip4.png';
}

/* ---------- Rendu ---------- */

function scheduleRender() {
  if (!state.src) return;
  if (state.idx.join('') === SOLUTION) {
    // Code trouvé : on rend l'image finale une seule fois (la victoire suit).
    if (state.visited.length == 8) armFinalRender();
    return;
  }
  clearTimeout(state.timer);
  // Laisse le navigateur afficher le statut avant le calcul (bloquant).
  state.timer = setTimeout(() => requestAnimationFrame(() => setTimeout(render, 0)), 40);
}

let fadeTimer = null;
let fading = false;
const FADE_MS = 500;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function render() {
  const t0 = performance.now();
  const out = FX.process(state.src, state.idx);
  const back = $('result');
  back.width = out.w;
  back.height = out.h;
  back.getContext('2d').putImageData(new ImageData(out.d, out.w, out.h), 0, 0);
  state.result = out;
  fitCanvas();
  startFade();
}

function winBox() {
  // Taille à l'écran de l'image de victoire (wip3) : la taille de référence de l'aperçu.
  const img = $('success-img');
  const nw = img.naturalWidth || 338,
    nh = img.naturalHeight || 237;
  const mh = parseFloat(getComputedStyle(img).maxHeight) || 200;
  let w = Math.min(nw, Math.max(10, $('canvas-figure').clientWidth - 4));
  let h = (w * nh) / nw;
  if (h > mh) {
    h = mh;
    w = (h * nw) / nh;
  }
  return { w: Math.round(w), h: Math.round(h) };
}

function fitCanvas() {
  const back = $('result');
  if (!back.width || !back.height) return;
  const fig = $('canvas-figure');
  const ratio = back.width / back.height;
  const box = winBox();
  const aw = Math.max(10, Math.min(fig.clientWidth - 4, box.w));
  const ah = Math.max(10, Math.min(fig.clientHeight - 24, box.h));
  let dw = Math.min(back.width, aw);
  let dh = dw / ratio;
  if (dh > ah) {
    dh = ah;
    dw = dh * ratio;
  }
  back.style.width = dw + 'px';
  back.style.height = dh + 'px';
}

function copyCanvas(dst, src) {
  dst.width = src.width;
  dst.height = src.height;
  dst.getContext('2d').drawImage(src, 0, 0);
}

function startFade() {
  const back = $('result');
  const front = $('result-front');

  if (fading) {
    clearTimeout(fadeTimer);
    const a = parseFloat(getComputedStyle(front).opacity) || 0;
    const tmp = (state.tmp ||= document.createElement('canvas'));
    copyCanvas(tmp, back);
    const tctx = tmp.getContext('2d');
    tctx.globalCompositeOperation = 'source-over';
    tctx.clearRect(0, 0, tmp.width, tmp.height);
    tctx.globalAlpha = 1 - a;
    tctx.drawImage(back, 0, 0);
    tctx.globalAlpha = a;
    tctx.drawImage(front, 0, 0);
    copyCanvas(front, tmp);
    front.style.transition = 'none';
    front.style.opacity = '1';
    front.getBoundingClientRect();
    fading = false;
  }

  if (front.width !== back.width || front.height !== back.height || reducedMotion.matches) {
    copyCanvas(front, back);
    front.style.transition = 'none';
    front.style.opacity = '1';
    return;
  }

  fading = true;
  front.style.transition = `opacity ${FADE_MS}ms linear`;
  front.style.opacity = '0';
  fadeTimer = setTimeout(() => {
    copyCanvas(front, back);
    front.style.transition = 'none';
    front.style.opacity = '1';
    fading = false;
  }, FADE_MS);
}

function showPuzzlePopup(puzzle_id) {
  let puzzle = get_puzzle(puzzle_id);
  let el = $('popup-container');
  el.hidden = false;
  el.querySelector('h2').innerText = puzzle.desc;
  const img = el.querySelector('img');
  img.hidden = true;
  img.onload = img.onerror = () => (img.hidden = false);
  img.src = puzzle.psrc;

  const steps = [
    { label: 'Indice', text: puzzle.indice_1 },
    { label: '2ᵉ indice', text: puzzle.indice_2 },
    { label: 'Réponse', text: `Il faut mettre ${puzzle.name} en ${puzzle.puzzle + 1}ᵉ position.`, kind: 'answer' }
  ].filter(s => s.text);

  const hints = $('popup-hints');
  const btn = $('hint-btn');
  hints.innerHTML = '';
  let shown = 0;

  const update = () => {
    if (shown < steps.length) {
      btn.hidden = false;
      btn.innerText = steps[shown].label;
    } else {
      btn.hidden = true;
    }
  };

  btn.onclick = () => {
    const s = steps[shown];
    const p = document.createElement('p');
    p.className = 'hint' + (s.kind === 'answer' ? ' answer' : '');
    const label = document.createElement('span');
    label.className = 'hint-label';
    label.textContent = s.label + ' - ';
    p.appendChild(label);
    p.appendChild(document.createTextNode(s.text));
    hints.appendChild(p);
    shown++;
    update();
  };
  update();

  state.lastFocus = document.activeElement;
  $('popup').focus();
}

function closePopup() {
  $('popup-container').hidden = true;
  if (state.lastFocus && typeof state.lastFocus.focus === 'function') state.lastFocus.focus();
}

function openZoom(index) {
  const p = get_image(controls[index].range.value);
  const img = $('zoom-img');
  img.hidden = true;
  img.onload = img.onerror = () => (img.hidden = false);
  img.src = p.src;
  img.alt = `Portrait agrandi de ${p.name}`;
  $('zoom-title').textContent = `${index + 1}. ${p.name}`;
  state.lastFocus = document.activeElement;
  $('zoom-container').hidden = false;
  $('zoom').focus();
}

function closeZoom() {
  $('zoom-container').hidden = true;
  if (state.lastFocus && typeof state.lastFocus.focus === 'function') state.lastFocus.focus();
}

function openHelp() {
  state.lastFocus = document.activeElement;
  $('help-container').hidden = false;
  $('help').focus();
}

function closeHelp() {
  $('help-container').hidden = true;
  if (state.lastFocus && typeof state.lastFocus.focus === 'function') state.lastFocus.focus();
}

function init_map() {
  var map = (state.map = L.map('map').setView([45.769239, 4.852714], 14));
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  var track = L.polyline(TRACK_POINTS, { color: '#f5a524' }).addTo(map);
  state.trackBounds = track.getBounds();
  map.fitBounds(state.trackBounds, { padding: [24, 24] });

  const points = [
    [45.775418, 4.856354],
    [45.77753, 4.853036],
    [45.777843, 4.845228],
    [45.771774, 4.843887],
    [45.768967, 4.847245],
    [45.763609, 4.848254],
    [45.762598, 4.85762],
    [45.768369, 4.859101]
  ];
  state.markers = points.map((p, i) =>
    L.marker(p, { title: `Lieu ${i + 1}`, alt: `Lieu ${i + 1}`, icon: badgeIcon(i, !state.visited.includes(i)) }).addTo(
      map
    )
  );
  state.markers.forEach((m, i) =>
    m.addEventListener('click', () => {
      if (!state.visited.includes(i)) {
        state.visited = state.visited.concat([i]);
        sessionStorage.setItem('visited', JSON.stringify(state.visited));
        state.markers.forEach((other, j) => other.setIcon(badgeIcon(j, !state.visited.includes(j))));
        let control = $(`control_${i}`);
        let btns = control.querySelectorAll('.btn');
        control.removeAttribute('disabled');
        btns.forEach(el => el.removeAttribute('disabled'));
      }
      showPuzzlePopup(i);
    })
  );
  resizeMap();
}

function badgeIcon(n, locked) {
  return L.divIcon({
    className: 'puzzle-badge' + (locked ? ' locked' : ''),
    html: `<span>${n + 1}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
}

/* ---------- Événements ---------- */
buildControls();
setAll(parseCode(location.hash.slice(1)) || state.idx);
loadDefault();
init_map();

$('popup-container').addEventListener('click', closePopup);
$('popup').addEventListener('click', e => e.stopPropagation());
$('popup-close').addEventListener('click', closePopup);
$('success-container').addEventListener('click', closeSuccess);
$('success').addEventListener('click', e => e.stopPropagation());
$('success-close').addEventListener('click', closeSuccess);
$('zoom-container').addEventListener('click', closeZoom);
$('zoom').addEventListener('click', e => e.stopPropagation());
$('zoom-close').addEventListener('click', closeZoom);
$('help-btn').addEventListener('click', openHelp);
$('help-container').addEventListener('click', closeHelp);
$('help').addEventListener('click', e => e.stopPropagation());
$('help-close').addEventListener('click', closeHelp);
document.addEventListener('click', e => {
  const img = e.target.closest('.param img');
  if (img) openZoom(+img.closest('.param').dataset.idx);
});
document.addEventListener('keydown', e => {
  if ((e.key !== 'Enter' && e.key !== ' ') || !e.target.matches('.param img')) return;
  e.preventDefault();
  openZoom(+e.target.closest('.param').dataset.idx);
});
window.addEventListener('resize', resizeMap);
document.addEventListener('keydown', e => {
  const isPopup = !$('popup-container').hidden;
  const isZoom = !$('zoom-container').hidden;
  const isSuccess = !$('success-container').hidden;
  const isHelp = !$('help-container').hidden;
  if (!isPopup && !isZoom && !isSuccess && !isHelp) return;
  if (e.key === 'Escape') {
    if (isPopup) closePopup();
    else if (isZoom) closeZoom();
    else if (isHelp) closeHelp();
    else closeSuccess();
    return;
  }
  if (e.key !== 'Tab') return;
  const panel = isPopup ? $('popup') : isZoom ? $('zoom') : isHelp ? $('help') : $('success');
  const focusables = [...panel.querySelectorAll('button, [tabindex]')].filter(b => !b.hidden);
  const targets = focusables.length ? focusables : [panel];
  const first = targets[0];
  const last = targets[targets.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === panel)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
});
