'use strict';
/*
 * Traitements d'image déterministes : aucune utilisation de Math.random().
 * Toutes les variations pseudo-aléatoires proviennent de graines fixes,
 * donc un même jeu de paramètres produit toujours exactement la même image.
 */
const FX = (() => {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function mulberry32(seed) {
    let a = seed | 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash2(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function create(w, h) {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let i = 3; i < d.length; i += 4) d[i] = 255;
    return { w, h, d };
  }

  function lumArray(img) {
    const n = img.w * img.h, L = new Float32Array(n), d = img.d;
    for (let i = 0, j = 0; i < n; i++, j += 4) L[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
    return L;
  }

  function sampleInto(img, x, y, out, o) {
    const w = img.w, h = img.h, d = img.d;
    if (!(x >= 0)) x = 0; else if (x > w - 1) x = w - 1;
    if (!(y >= 0)) y = 0; else if (y > h - 1) y = h - 1;
    const x0 = x | 0, y0 = y | 0;
    const x1 = x0 < w - 1 ? x0 + 1 : x0, y1 = y0 < h - 1 ? y0 + 1 : y0;
    const fx = x - x0, fy = y - y0;
    const i00 = (y0 * w + x0) * 4, i10 = (y0 * w + x1) * 4, i01 = (y1 * w + x0) * 4, i11 = (y1 * w + x1) * 4;
    for (let c = 0; c < 3; c++) {
      const a = d[i00 + c] + (d[i10 + c] - d[i00 + c]) * fx;
      const b = d[i01 + c] + (d[i11 + c] - d[i01 + c]) * fx;
      out[o + c] = a + (b - a) * fy;
    }
  }

  function warp(img, fn) {
    const w = img.w, h = img.h, out = create(w, h), p = [0, 0];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        fn(x, y, p);
        sampleInto(img, p[0], p[1], out.d, (y * w + x) * 4);
      }
    }
    return out;
  }

  // Bruit de valeurs lissé, renvoie une fonction f(u, v) dans [-1, 1] pour u, v dans [0, 1].
  function valueNoise(gx, gy, seed) {
    const rnd = mulberry32(seed), W = gx + 1, t = new Float32Array(W * (gy + 1));
    for (let i = 0; i < t.length; i++) t[i] = rnd() * 2 - 1;
    return (u, v) => {
      const X = clamp(u, 0, 1) * gx, Y = clamp(v, 0, 1) * gy;
      let i = Math.floor(X), j = Math.floor(Y);
      if (i >= gx) i = gx - 1;
      if (j >= gy) j = gy - 1;
      let fx = X - i, fy = Y - j;
      fx = fx * fx * (3 - 2 * fx);
      fy = fy * fy * (3 - 2 * fy);
      const a = t[j * W + i], b = t[j * W + i + 1], c = t[(j + 1) * W + i], e = t[(j + 1) * W + i + 1];
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + e) * fx * fy;
    };
  }

  /* ---------- Flou gaussien (approximation par 3 flous boîte) ---------- */

  function boxesForGauss(sigma, n) {
    const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
    let wl = Math.floor(wIdeal);
    if (wl % 2 === 0) wl--;
    const wu = wl + 2;
    const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
    const sizes = [];
    for (let i = 0; i < n; i++) sizes.push(i < m ? wl : wu);
    return sizes;
  }

  function boxH(s, t, w, h, r) {
    const k = 1 / (2 * r + 1);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let i = -r; i <= r; i++) sum += s[(row + clamp(i, 0, w - 1)) * 3 + c];
        for (let x = 0; x < w; x++) {
          t[(row + x) * 3 + c] = sum * k;
          const xa = x + r + 1 < w ? x + r + 1 : w - 1, xr = x - r > 0 ? x - r : 0;
          sum += s[(row + xa) * 3 + c] - s[(row + xr) * 3 + c];
        }
      }
    }
  }

  function boxV(s, t, w, h, r) {
    const k = 1 / (2 * r + 1);
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let i = -r; i <= r; i++) sum += s[(clamp(i, 0, h - 1) * w + x) * 3 + c];
        for (let y = 0; y < h; y++) {
          t[(y * w + x) * 3 + c] = sum * k;
          const ya = y + r + 1 < h ? y + r + 1 : h - 1, yr = y - r > 0 ? y - r : 0;
          sum += s[(ya * w + x) * 3 + c] - s[(yr * w + x) * 3 + c];
        }
      }
    }
  }

  function gaussianBlur(img, sigma) {
    sigma = (sigma - 4)
    if (sigma < 0.5) return img;
    const w = img.w, h = img.h, n = w * h;
    const a = new Float32Array(n * 3), b = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) a[i * 3 + c] = img.d[i * 4 + c];
    for (const size of boxesForGauss(sigma, 3)) {
      const r = (size - 1) >> 1;
      if (r < 1) continue;
      boxH(a, b, w, h, r);
      boxV(b, a, w, h, r);
    }
    const out = create(w, h);
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) out.d[i * 4 + c] = a[i * 3 + c];
    return out;
  }

  function sobel(L, w, h) {
    const M = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const ym = (y > 0 ? y - 1 : 0) * w, yc = y * w, yp = (y < h - 1 ? y + 1 : y) * w;
      for (let x = 0; x < w; x++) {
        const xm = x > 0 ? x - 1 : 0, xp = x < w - 1 ? x + 1 : x;
        const tl = L[ym + xm], t = L[ym + x], tr = L[ym + xp];
        const l = L[yc + xm], r = L[yc + xp];
        const bl = L[yp + xm], b = L[yp + x], br = L[yp + xp];
        const gx = tr + 2 * r + br - (tl + 2 * l + bl);
        const gy = bl + 2 * b + br - (tl + 2 * t + tr);
        M[yc + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    return M;
  }

  /* ---------- 8. Déformation géométrique ---------- */

  function geometry(img, mode) {
    if (!mode) return img;
    const w = img.w, h = img.h, S = Math.max(w, h), m = Math.min(w, h);
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    const nx = valueNoise(8, 8, 101), ny = valueNoise(8, 8, 202);
    const nx2 = valueNoise(4, 4, 303), ny2 = valueNoise(4, 4, 404);
    const swirl = (x, y, p, R, k) => {
      const dx = x - cx, dy = y - cy, r = Math.sqrt(dx * dx + dy * dy);
      if (r < R) {
        const t = 1 - r / R, a = k * t * t, c = Math.cos(a), s = Math.sin(a);
        p[0] = cx + dx * c - dy * s;
        p[1] = cy + dx * s + dy * c;
      } else { p[0] = x; p[1] = y; }
    };
    const fns = {
      1: (x, y, p) => {
        const A = 0.008 * S, L = 0.12 * S;
        p[0] = x + A * Math.sin((TAU * y) / L);
        p[1] = y + A * Math.sin((TAU * x) / L);
      },
      6: (x, y, p) => {
        const A = 0.025 * S, L = 0.09 * S;
        p[0] = x + A * Math.sin((TAU * y) / L);
        p[1] = y + A * Math.sin((TAU * x) / L + 1.3);
      },
      3: (x, y, p) => {
        p[0] = x + 0.045 * S * Math.sin((TAU * y) / (0.28 * S)) + 0.015 * S * Math.sin((TAU * y) / (0.07 * S) + 1);
        p[1] = y + 0.05 * S * Math.sin((TAU * x) / (0.33 * S) + 0.5) + 0.012 * S * Math.sin((TAU * (x + y)) / (0.09 * S));
      },
      4: (x, y, p) => swirl(x, y, p, 0.6 * S, 4.5),
      5: (x, y, p) => {
        const R = 0.55 * m, dx = x - cx, dy = y - cy, r = Math.sqrt(dx * dx + dy * dy);
        if (r < R && r > 0) {
          const f = Math.pow(r / R, 0.75);
          p[0] = cx + dx * f;
          p[1] = cy + dy * f;
        } else { p[0] = x; p[1] = y; }
      },
      1: (x, y, p) => {
        const u = x / w, v = y / h;
        p[0] = x + 0.07 * S * nx(u, v);
        p[1] = y + 0.07 * S * ny(u, v);
      },
      7: (x, y, p) => {
        const u = x / w, v = y / h;
        const X = x + 0.06 * S * Math.sin((TAU * y) / (0.2 * S)) + 0.12 * S * nx2(u, v);
        const Y = y + 0.06 * S * Math.sin((TAU * x) / (0.23 * S) + 2) + 0.12 * S * ny2(u, v);
        swirl(X, Y, p, 0.7 * S, 7);
        p[0] += 0.04 * S * nx(u, v);
        p[1] += 0.04 * S * ny(u, v);
      },
    };
    return warp(img, fns[mode]);
  }

  /* ---------- 7. Styles artistiques ---------- */

  function stylePhotocopy(img, scale) {
    const w = img.w, h = img.h, out = create(w, h), o = out.d;
    const L = lumArray(gaussianBlur(img, 0.8 * scale));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let v = (L[i] - 128) * 2.6 + 150;
        v += (hash2(x, y, 7) - 0.5) * 40 + (hash2(x, 0, 8) - 0.5) * 14;
        v = v < 110 ? v * 0.25 : v > 170 ? 255 - (255 - v) * 0.3 : v;
        v = clamp(v, 0, 255);
        o[i * 4] = v; o[i * 4 + 1] = v * 0.99; o[i * 4 + 2] = v * 0.96;
      }
    }
    return out;
  }

  function styleComic(img, scale) {
    const w = img.w, h = img.h, sm = gaussianBlur(img, 1.5 * scale), s = sm.d;
    const L = lumArray(sm), E = sobel(L, w, h);
    const out = create(w, h), o = out.d;
    const cell = Math.max(3, 5 * scale), k = Math.SQRT1_2 / cell;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, j = i * 4;
        if (E[i] > 100) { o[j] = 15; o[j + 1] = 15; o[j + 2] = 20; continue; }
        const l = L[i];
        let f = 1;
        const dark = 1 - l / 255;
        if (dark > 0.35) {
          const u = (x - y) * k, v = (x + y) * k;
          const fu = u - Math.floor(u) - 0.5, fv = v - Math.floor(v) - 0.5;
          if (Math.sqrt(fu * fu + fv * fv) < (dark - 0.35) * 1.1) f = 0.55;
        }
        for (let c = 0; c < 3; c++) {
          let val = l + (s[j + c] - l) * 1.5;
          val = (Math.round((clamp(val, 0, 255) / 255) * 3) / 3) * 255;
          o[j + c] = val * f;
        }
      }
    }
    return out;
  }

  function styleOil(img, scale) {
    const w = img.w, h = img.h, d = img.d, W = w + 1, N = W * (h + 1);
    const r = Math.max(2, Math.round(4 * scale));
    const IR = new Float64Array(N), IG = new Float64Array(N), IB = new Float64Array(N);
    const IL = new Float64Array(N), IL2 = new Float64Array(N);
    for (let y = 0; y < h; y++) {
      let sr = 0, sg = 0, sb = 0, sl = 0, sl2 = 0;
      for (let x = 0; x < w; x++) {
        const j = (y * w + x) * 4, R = d[j], G = d[j + 1], B = d[j + 2];
        const l = 0.299 * R + 0.587 * G + 0.114 * B;
        sr += R; sg += G; sb += B; sl += l; sl2 += l * l;
        const k = (y + 1) * W + x + 1, ku = y * W + x + 1;
        IR[k] = IR[ku] + sr; IG[k] = IG[ku] + sg; IB[k] = IB[ku] + sb;
        IL[k] = IL[ku] + sl; IL2[k] = IL2[ku] + sl2;
      }
    }
    const rect = (A, x0, y0, x1, y1) => A[(y1 + 1) * W + x1 + 1] - A[y0 * W + x1 + 1] - A[(y1 + 1) * W + x0] + A[y0 * W + x0];
    const mid = create(w, h), md = mid.d;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let best = Infinity, br = 0, bg = 0, bb = 0;
        for (let q = 0; q < 4; q++) {
          const x0 = q & 1 ? x : Math.max(0, x - r), x1 = q & 1 ? Math.min(w - 1, x + r) : x;
          const y0 = q & 2 ? y : Math.max(0, y - r), y1 = q & 2 ? Math.min(h - 1, y + r) : y;
          const area = (x1 - x0 + 1) * (y1 - y0 + 1);
          const mean = rect(IL, x0, y0, x1, y1) / area;
          const v = rect(IL2, x0, y0, x1, y1) / area - mean * mean;
          if (v < best) {
            best = v;
            br = rect(IR, x0, y0, x1, y1) / area;
            bg = rect(IG, x0, y0, x1, y1) / area;
            bb = rect(IB, x0, y0, x1, y1) / area;
          }
        }
        const j = (y * w + x) * 4, l = 0.299 * br + 0.587 * bg + 0.114 * bb;
        md[j] = l + (br - l) * 1.2; md[j + 1] = l + (bg - l) * 1.2; md[j + 2] = l + (bb - l) * 1.2;
      }
    }
    // Relief d'empâtement et traces de pinceau
    const L = lumArray(mid), out = create(w, h), o = out.d;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const gx = L[y * w + Math.min(w - 1, x + 1)] - L[y * w + Math.max(0, x - 1)];
        const gy = L[Math.min(h - 1, y + 1) * w + x] - L[Math.max(0, y - 1) * w + x];
        let f = 1 + clamp(((gx - gy) / 255) * 1.2, -0.25, 0.25);
        f *= 0.97 + 0.06 * hash2(Math.floor((x + y) / (3 * scale)), Math.floor((x - y) / (12 * scale)), 11);
        for (let c = 0; c < 3; c++) o[i * 4 + c] = md[i * 4 + c] * f;
      }
    }
    return out;
  }

  function styleWatercolor(img, scale) {
    const w = img.w, h = img.h;
    const nx = valueNoise(40, 40, 501), ny = valueNoise(40, 40, 502);
    const bled = warp(img, (x, y, p) => {
      p[0] = x + 6 * scale * nx(x / w, y / h);
      p[1] = y + 6 * scale * ny(x / w, y / h);
    });
    const base = gaussianBlur(bled, 2.5 * scale), wide = gaussianBlur(base, 6 * scale);
    const Lb = lumArray(base), Lw = lumArray(wide);
    const paper = valueNoise(120, 120, 503), paper2 = valueNoise(25, 25, 504);
    const out = create(w, h), o = out.d, s = base.d;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, j = i * 4;
        const e = clamp(Math.abs(Lb[i] - Lw[i]) / 60, 0, 1);
        const pp = 0.92 + 0.05 * paper(x / w, y / h) + 0.03 * paper2(x / w, y / h) + (hash2(x, y, 9) - 0.5) * 0.04;
        for (let c = 0; c < 3; c++) {
          let v = s[j + c];
          const q = (Math.round((v / 255) * 5) / 5) * 255;
          v += (q - v) * 0.5;
          v = 255 - (255 - v) * 0.8;
          o[j + c] = v * (1 - 0.3 * e) * pp;
        }
      }
    }
    return out;
  }

  function styleCubism(img, scale) {
    const w = img.w, h = img.h, d = img.d, S = Math.max(w, h), cs = S / 11;
    const gx = Math.ceil(w / cs) + 1, gy = Math.ceil(h / cs) + 1, nc = gx * gy;
    const sx = new Float32Array(nc), sy = new Float32Array(nc), ox = new Int32Array(nc), oy = new Int32Array(nc);
    const ca = new Float32Array(nc), sa = new Float32Array(nc);
    for (let j = 0; j < gy; j++) {
      for (let i = 0; i < gx; i++) {
        const k = j * gx + i;
        sx[k] = (i + 0.15 + 0.7 * hash2(i, j, 21)) * cs;
        sy[k] = (j + 0.15 + 0.7 * hash2(i, j, 22)) * cs;
        ox[k] = Math.round((hash2(i, j, 23) - 0.5) * 0.08 * S);
        oy[k] = Math.round((hash2(i, j, 24) - 0.5) * 0.08 * S);
        const a = hash2(i, j, 25) * TAU;
        ca[k] = Math.cos(a); sa[k] = Math.sin(a);
      }
    }
    const cellOf = new Int32Array(w * h), border = new Float32Array(w * h), shifted = new Int32Array(w * h);
    const sr = new Float64Array(nc), sg = new Float64Array(nc), sb = new Float64Array(nc), cnt = new Float64Array(nc);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i0 = Math.floor(x / cs), j0 = Math.floor(y / cs);
        let d1 = Infinity, d2 = Infinity, k1 = 0;
        for (let dj = -1; dj <= 1; dj++) {
          const jj = j0 + dj;
          if (jj < 0 || jj >= gy) continue;
          for (let di = -1; di <= 1; di++) {
            const ii = i0 + di;
            if (ii < 0 || ii >= gx) continue;
            const k = jj * gx + ii, dx = x - sx[k], dy = y - sy[k], dd = dx * dx + dy * dy;
            if (dd < d1) { d2 = d1; d1 = dd; k1 = k; } else if (dd < d2) d2 = dd;
          }
        }
        const i = y * w + x;
        cellOf[i] = k1;
        border[i] = Math.sqrt(d2) - Math.sqrt(d1);
        const src = (clamp(y + oy[k1], 0, h - 1) * w + clamp(x + ox[k1], 0, w - 1)) * 4;
        shifted[i] = src;
        sr[k1] += d[src]; sg[k1] += d[src + 1]; sb[k1] += d[src + 2]; cnt[k1]++;
      }
    }
    const out = create(w, h), o = out.d, bw = 2.2 * scale + 1, pal = [170, 140, 95];
    const sums = [sr, sg, sb];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, j = i * 4, k = cellOf[i];
        if (border[i] < bw) { o[j] = 35; o[j + 1] = 28; o[j + 2] = 22; continue; }
        const proj = ((x - sx[k]) * ca[k] + (y - sy[k]) * sa[k]) / cs;
        const shade = 1 + 0.35 * proj, src = shifted[i];
        for (let c = 0; c < 3; c++) {
          const base = 0.55 * (sums[c][k] / cnt[k]) + 0.45 * d[src + c];
          o[j + c] = base * shade * 0.8 + pal[c] * 0.2;
        }
      }
    }
    return out;
  }

  function styleMosaic(img, scale) {
    const w = img.w, h = img.h, d = img.d, S = Math.max(w, h);
    const t = Math.max(5, Math.round(S / 75)), g = Math.max(1, Math.round(t * 0.12)), bw = Math.max(1, Math.round(t * 0.1));
    const half = Math.floor(t / 2), ntx = Math.ceil(w / t) + 1, nty = Math.ceil(h / t);
    const n = ntx * nty, sr = new Float64Array(n), sg = new Float64Array(n), sb = new Float64Array(n), cnt = new Float64Array(n);
    const tileIdx = (x, y) => {
      const j = Math.floor(y / t), off = (j & 1) * half;
      return j * ntx + Math.floor((x + off) / t);
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k = tileIdx(x, y), j = (y * w + x) * 4;
        sr[k] += d[j]; sg[k] += d[j + 1]; sb[k] += d[j + 2]; cnt[k]++;
      }
    }
    const out = create(w, h), o = out.d;
    for (let y = 0; y < h; y++) {
      const tj = Math.floor(y / t), off = (tj & 1) * half, ly = y - tj * t;
      for (let x = 0; x < w; x++) {
        const ti = Math.floor((x + off) / t), lx = x + off - ti * t, k = tj * ntx + ti, j = (y * w + x) * 4;
        if (lx < g || ly < g) {
          const gv = 0.85 + 0.1 * hash2(x, y, 32);
          o[j] = 190 * gv; o[j + 1] = 185 * gv; o[j + 2] = 175 * gv;
          continue;
        }
        let f = 0.9 + 0.15 * hash2(ti, tj, 31);
        if (lx < g + bw || ly < g + bw) f *= 1.12;
        else if (lx >= t - bw || ly >= t - bw) f *= 0.88;
        o[j] = (sr[k] / cnt[k]) * f; o[j + 1] = (sg[k] / cnt[k]) * f; o[j + 2] = (sb[k] / cnt[k]) * f;
      }
    }
    return out;
  }

  function styleWeave(img) {
    const w = img.w, h = img.h, S = Math.max(w, h), t = Math.max(4, S / 110);
    const src = gaussianBlur(img, t * 0.35), out = create(w, h), o = out.d, tmp = [0, 0, 0];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const X = x / t, Y = y / t, i = Math.floor(X), j = Math.floor(Y), fx = X - i, fy = Y - j;
        const warpTop = ((i + j) & 1) === 0;
        const across = warpTop ? fx : fy, along = warpTop ? fy : fx;
        if (warpTop) sampleInto(src, (i + 0.5) * t, y, tmp, 0);
        else sampleInto(src, x, (j + 0.5) * t, tmp, 0);
        let f = 0.45 + 0.55 * Math.sin(Math.PI * across);
        f *= 0.85 + 0.15 * Math.sin(Math.PI * along);
        f *= 0.93 + 0.07 * Math.sin((across * 6 + along * 3) * TAU);
        if (across < 0.06 || across > 0.94) f *= 0.4;
        const k = (y * w + x) * 4;
        const tint = warpTop ? [0.96, 0.98, 1.03] : [1.03, 1.0, 0.95];
        for (let c = 0; c < 3; c++) o[k + c] = tmp[c] * f * tint[c];
      }
    }
    return out;
  }

  function style(img, mode, scale) {
    switch (mode) {
      case 7: return stylePhotocopy(img, scale);
      case 2: return styleComic(img, scale);
      case 3: return styleOil(img, scale);
      case 4: return styleWatercolor(img, scale);
      case 5: return styleCubism(img, scale);
      case 6: return styleMosaic(img, scale);
      case 1: return styleWeave(img, scale);
      default: return img;
    }
  }

  /* ---------- 1. Fragmentation (carrés, puzzle, cubes) ---------- */

  const FRAG = [
    null,
    { n: 6, swap: 0, rot: 0.35 },                                              // Carrés tournés
    { n: 6, swap: 0.35, rot: 0.15 },                                           // Carrés échangés
    { n: 9, swap: 1, rot: 0.5 },                                               // Carrés mélangés
    { n: 6, jig: true, swap: 0.35, rot: 0.15 },                                // Puzzle imparfait
    { n: 7, jig: true, swap: 1, rot: 0.5 },                                    // Puzzle mélangé
    { n: 8, swap: 1, rot: 0.5, cube: true, tilt: 0.15, scale: 0.8, jitter: 0.05 }, // Cubes éparpillés
    { n: 14, jig: true, swap: 1, rot: 0.9 },                                   // Chaos
  ];

  // Tenon de puzzle : a = profondeur depuis le bord, b = position le long du bord (0 = milieu).
  const inTab = (a, b) => { const da = a - 0.2; return da * da + b * b < 0.0256 || (a >= 0 && a < 0.2 && Math.abs(b) < 0.08); };

  function fragment(img, mode, scale) {
    const P = FRAG[mode];
    if (!P) return img;
    const w = img.w, h = img.h, S = Math.max(w, h), T = S / P.n;
    const nx = Math.max(1, Math.round(w / T)), ny = Math.max(1, Math.round(h / T));
    const tx = w / nx, ty = h / ny, N = nx * ny, rng = mulberry32(2000 + mode);

    const perm = new Int32Array(N);
    for (let k = 0; k < N; k++) perm[k] = k;
    const ids = Array.from({ length: N }, (_, k) => k);
    for (let k = N - 1; k > 0; k--) { const r = Math.floor(rng() * (k + 1));[ids[k], ids[r]] = [ids[r], ids[k]]; }
    const chosen = ids.slice(0, Math.round(P.swap * N));
    if (chosen.length > 1) chosen.forEach((k, i) => { perm[k] = chosen[(i + 1) % chosen.length]; });

    const rot = new Uint8Array(N), ca = new Float32Array(N), sa = new Float32Array(N), ox = new Float32Array(N), oy = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      rot[k] = rng() < P.rot ? 1 + Math.floor(rng() * 3) : 0;
      const a = P.tilt ? (rng() * 2 - 1) * P.tilt : 0;
      ca[k] = Math.cos(a); sa[k] = Math.sin(a);
      ox[k] = P.jitter ? (rng() * 2 - 1) * P.jitter : 0;
      oy[k] = P.jitter ? (rng() * 2 - 1) * P.jitter : 0;
    }
    // +1 : le tenon appartient à la pièce gauche/haute, -1 : à la pièce droite/basse
    const vEdge = new Int8Array(Math.max(0, nx - 1) * ny), hEdge = new Int8Array(nx * Math.max(0, ny - 1));
    for (let k = 0; k < vEdge.length; k++) vEdge[k] = rng() < 0.5 ? 1 : -1;
    for (let k = 0; k < hEdge.length; k++) hEdge[k] = rng() < 0.5 ? 1 : -1;

    const out = create(w, h), o = out.d, id = new Int32Array(w * h), tmp = [0, 0, 0];
    const sc = P.scale || 1, bevel = 0.06;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const fx = x / tx, fy = y / ty;
        let pi = Math.min(nx - 1, Math.floor(fx)), pj = Math.min(ny - 1, Math.floor(fy));
        if (P.jig) {
          const u = fx - pi, v = fy - pj, i = pi, j = pj;
          if (i > 0 && vEdge[j * (nx - 1) + i - 1] === 1 && inTab(u, v - 0.5)) pi = i - 1;
          else if (i < nx - 1 && vEdge[j * (nx - 1) + i] === -1 && inTab(1 - u, v - 0.5)) pi = i + 1;
          else if (j > 0 && hEdge[(j - 1) * nx + i] === 1 && inTab(v, u - 0.5)) pj = j - 1;
          else if (j < ny - 1 && hEdge[j * nx + i] === -1 && inTab(1 - v, u - 0.5)) pj = j + 1;
        }
        const k = pj * nx + pi, p = (y * w + x) * 4;
        let u = fx - pi, v = fy - pj, shade = 1;
        if (P.cube) {
          const du = u - 0.5 - ox[k], dv = v - 0.5 - oy[k];
          u = (du * ca[k] + dv * sa[k]) / sc + 0.5;
          v = (-du * sa[k] + dv * ca[k]) / sc + 0.5;
          if (u < 0 || u > 1 || v < 0 || v > 1) {
            id[y * w + x] = -1;
            o[p] = 22; o[p + 1] = 22; o[p + 2] = 26;
            continue;
          }
          if (u < bevel || v < bevel) shade = 1.35;
          else if (u > 1 - bevel || v > 1 - bevel) shade = 0.6;
        }
        let a = u, b = v;
        if (rot[k] === 1) { a = v; b = 1 - u; }
        else if (rot[k] === 2) { a = 1 - u; b = 1 - v; }
        else if (rot[k] === 3) { a = 1 - v; b = u; }
        const s = perm[k], si = s % nx, sj = (s - si) / nx;
        sampleInto(img, (si + a) * tx, (sj + b) * ty, tmp, 0);
        o[p] = tmp[0] * shade; o[p + 1] = tmp[1] * shade; o[p + 2] = tmp[2] * shade;
        id[y * w + x] = k;
      }
    }
    // Traits de découpe entre pièces
    const r = Math.max(1, Math.round(scale * 1.5));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, k = id[i];
        if (k < 0) continue;
        const xr = Math.min(w - 1, x + r), yd = Math.min(h - 1, y + r);
        if (id[y * w + xr] !== k || id[yd * w + x] !== k) {
          const p = i * 4;
          o[p] *= 0.25; o[p + 1] *= 0.25; o[p + 2] *= 0.25;
        }
      }
    }
    return out;
  }

  /* ---------- Réglages colorimétriques ---------- */

  function posterize(img, levels) {
    const out = create(img.w, img.h), d = img.d, o = out.d, n = levels - 1;
    for (let j = 0; j < d.length; j += 4) {
      for (let c = 0; c < 3; c++) o[j + c] = (Math.round((d[j + c] / 255) * n) / n) * 255;
    }
    return out;
  }

  function edges(img, amount, scale) {
    if (!amount) return img;
    const w = img.w, h = img.h;
    const E = sobel(lumArray(gaussianBlur(img, scale)), w, h);
    const out = create(w, h), d = img.d, o = out.d;
    for (let i = 0; i < w * h; i++) {
      const draw = 255 * (1 - Math.pow(Math.min(1, E[i] / 180), 0.8)), j = i * 4;
      for (let c = 0; c < 3; c++) o[j + c] = d[j + c] * (1 - amount) + draw * amount;
    }
    return out;
  }

  /* ---------- 2. Recoloration (carte de dégradé : luminance -> couleur) ---------- */

  function hsl(hue, s, l) {
    const k = n => (n + hue / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
    return [f(0), f(8), f(4)];
  }

  function gradientLut(stops) {
    const lut = new Uint8ClampedArray(256 * 3), n = stops.length - 1;
    for (let i = 0; i < 256; i++) {
      const t = (i / 255) * n, k = Math.min(n - 1, Math.floor(t)), f = t - k;
      for (let c = 0; c < 3; c++) lut[i * 3 + c] = stops[k][c] + (stops[k + 1][c] - stops[k][c]) * f;
    }
    return lut;
  }

  function hueLut(cycles, offset) {
    const lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const t = i / 255, l = 0.12 + 0.76 * t;
      const rgb = hsl((offset + 360 * cycles * t) % 360, 0.9, l);
      lut.set(rgb, i * 3);
    }
    return lut;
  }

  const PALETTES = [
    null,
    gradientLut([[25, 12, 5], [112, 66, 32], [196, 150, 100], [250, 236, 210]]),               // Sépia
    gradientLut([[10, 20, 70], [40, 90, 170], [235, 140, 50], [255, 235, 190]]),               // Bleu / orange
    gradientLut([[45, 0, 80], [200, 30, 120], [255, 140, 60], [255, 245, 120]]),               // Coucher de soleil
    gradientLut([[0, 0, 0], [30, 0, 140], [180, 0, 160], [240, 60, 0], [255, 210, 0], [255, 255, 255]]), // Thermique
    gradientLut([[0, 255, 220], [30, 60, 200], [120, 0, 160], [255, 0, 150], [10, 0, 30]]),   // Néon inversé
    hueLut(1, 240),                                                                              // Arc-en-ciel
    hueLut(3, 0),                                                                                // Psychédélique
  ];

  function recolor(img, mode) {
    const lut = PALETTES[mode];
    if (!lut) return img;
    const out = create(img.w, img.h), d = img.d, o = out.d;
    for (let j = 0; j < d.length; j += 4) {
      const l = Math.round(0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2]) * 3;
      o[j] = lut[l]; o[j + 1] = lut[l + 1]; o[j + 2] = lut[l + 2];
    }
    return out;
  }

  /* ---------- 5. Distorsion numérique ---------- */

  function rgbShift(img, dxr, dyr, dxb, dyb) {
    const w = img.w, h = img.h, d = img.d, out = create(w, h), o = out.d;
    for (let y = 0; y < h; y++) {
      const yr = clamp(y - dyr, 0, h - 1), yb = clamp(y - dyb, 0, h - 1);
      for (let x = 0; x < w; x++) {
        const j = (y * w + x) * 4;
        o[j] = d[(yr * w + clamp(x - dxr, 0, w - 1)) * 4];
        o[j + 1] = d[j + 1];
        o[j + 2] = d[(yb * w + clamp(x - dxb, 0, w - 1)) * 4 + 2];
      }
    }
    return out;
  }

  function bandShift(img, rng, horizontal, minB, maxB, prob, maxOff) {
    const w = img.w, h = img.h, d = img.d, out = create(w, h), o = out.d;
    const len = horizontal ? h : w, span = horizontal ? w : h;
    let pos = 0;
    while (pos < len) {
      const size = Math.max(1, Math.round(minB + rng() * (maxB - minB)));
      const off = rng() < prob ? Math.round((rng() * 2 - 1) * maxOff) : 0;
      const end = Math.min(len, pos + size);
      for (let a = pos; a < end; a++) {
        for (let b = 0; b < span; b++) {
          const sb = (((b - off) % span) + span) % span;
          const dst = horizontal ? (a * w + b) * 4 : (b * w + a) * 4;
          const src = horizontal ? (a * w + sb) * 4 : (sb * w + a) * 4;
          o[dst] = d[src]; o[dst + 1] = d[src + 1]; o[dst + 2] = d[src + 2];
        }
      }
      pos = end;
    }
    return out;
  }

  function pixelSort(img, lo, hi) {
    const w = img.w, h = img.h, d = img.d, out = create(w, h), o = out.d;
    o.set(d);
    const L = lumArray(img);
    for (let y = 0; y < h; y++) {
      let x = 0;
      while (x < w) {
        const l = L[y * w + x];
        if (l < lo || l > hi) { x++; continue; }
        let e = x;
        while (e < w && L[y * w + e] >= lo && L[y * w + e] <= hi) e++;
        const idx = [];
        for (let k = x; k < e; k++) idx.push(y * w + k);
        idx.sort((a, b) => L[a] - L[b] || a - b);
        for (let k = 0; k < idx.length; k++) {
          const dst = (y * w + x + k) * 4, src = idx[k] * 4;
          o[dst] = d[src]; o[dst + 1] = d[src + 1]; o[dst + 2] = d[src + 2];
        }
        x = e;
      }
    }
    return out;
  }

  function glitch(img, S, rng, k) {
    const w = img.w, h = img.h;
    let a = rgbShift(img, Math.round(0.01 * S * k), 0, -Math.round(0.01 * S * k), Math.round(0.003 * S * k));
    a = bandShift(a, rng, true, 0.005 * S, 0.05 * S, 0.35 * k, 0.12 * S * k);
    const o = a.d;
    // Bandes avec permutation de canaux / débordement de bits
    for (let n = 0; n < 4 * k; n++) {
      const y0 = Math.floor(rng() * h), bh = Math.round((0.01 + rng() * 0.05) * S), type = Math.floor(rng() * 3);
      for (let y = y0; y < Math.min(h, y0 + bh); y++) {
        for (let x = 0; x < w; x++) {
          const j = (y * w + x) * 4;
          if (type === 0) { const t = o[j]; o[j] = o[j + 2]; o[j + 2] = t; }
          else if (type === 1) o[j + 1] = 255 - o[j + 1];
          else if (k > 1) { o[j] = (o[j] * 4) & 255; o[j + 1] = (o[j + 1] * 4) & 255; o[j + 2] = (o[j + 2] * 4) & 255; }
          else { const t = o[j + 1]; o[j + 1] = o[j + 2]; o[j + 2] = t; }
        }
      }
    }
    // Copie de blocs déplacés
    const src = new Uint8ClampedArray(o);
    for (let n = 0; n < 6 * k; n++) {
      const bw = Math.round((0.05 + rng() * 0.25) * S), bh = Math.round((0.01 + rng() * 0.05) * S);
      const x0 = Math.floor(rng() * w), y0 = Math.floor(rng() * h);
      const sx = Math.floor(rng() * w), sy = Math.floor(rng() * h);
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const dx = x0 + x, dy = y0 + y;
          if (dx >= w || dy >= h) continue;
          const s = (Math.min(h - 1, sy + y) * w + Math.min(w - 1, sx + x)) * 4, j = (dy * w + dx) * 4;
          o[j] = src[s]; o[j + 1] = src[s + 1]; o[j + 2] = src[s + 2];
        }
      }
    }
    // Lignes de balayage
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x++) {
        const j = (y * w + x) * 4;
        o[j] *= 0.88; o[j + 1] *= 0.88; o[j + 2] *= 0.88;
      }
    }
    return a;
  }

  function wobble(img, S) {
    const w = img.w, h = img.h, d = img.d, out = create(w, h), o = out.d;
    const A = 0.02 * S, L = 0.06 * S, phase = [0, 0.8, 1.6];
    for (let y = 0; y < h; y++) {
      const amp = A * (0.5 + 0.5 * Math.sin((TAU * y) / (0.4 * S)));
      for (let c = 0; c < 3; c++) {
        const off = Math.round(amp * Math.sin((TAU * y) / L + phase[c]));
        for (let x = 0; x < w; x++) {
          o[(y * w + x) * 4 + c] = d[(y * w + clamp(x - off, 0, w - 1)) * 4 + c];
        }
      }
    }
    return out;
  }

  function distort(img, mode) {
    if (!mode) return img;
    const S = Math.max(img.w, img.h), rng = mulberry32(1000 + mode);
    switch (mode) {
      case 1: {
        const s = Math.max(1, Math.round(0.006 * S));
        return rgbShift(img, s, 0, -s, Math.round(s / 2));
      }
      case 2: return bandShift(img, rng, true, 0.01 * S, 0.06 * S, 0.5, 0.15 * S);
      case 3: return bandShift(img, rng, false, 0.01 * S, 0.06 * S, 0.5, 0.15 * S);
      case 4: return glitch(img, S, rng, 1);
      case 5: return pixelSort(img, 60, 200);
      case 6: return wobble(img, S);
      case 7: {
        let a = glitch(img, S, rng, 2);
        a = pixelSort(a, 40, 230);
        a = bandShift(a, rng, false, 0.01 * S, 0.08 * S, 0.5, 0.2 * S);
        const s = Math.round(0.03 * S);
        return rgbShift(a, s, Math.round(s / 3), -s, -Math.round(s / 3));
      }
      default: return img;
    }
  }

  /* ---------- Paramètres et pipeline ---------- */

  const VALUES = {
    blur: [0, 1, 2, 4, 8, 16, 32, 64],
    posterize: [2, 3, 4, 6, 8, 12, 16, 32],
    edges: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1],
  };

  // idx : indices (0-7) des 8 paramètres dans l'ordre d'affichage.
  function process(src, idx) {
    const scale = Math.max(src.w, src.h) / 1000;
    let img = src;
    img = geometry(img, idx[7]); // 7
    img = gaussianBlur(img, VALUES.blur[idx[2]] * scale); // 5
    img = style(img, idx[6], scale); // 8
    img = posterize(img, VALUES.posterize[idx[3]]); // 2
    img = edges(img, VALUES.edges[idx[5]], scale); // 6
    img = recolor(img, idx[1]); // 1
    img = fragment(img, idx[0], scale); // 3
    img = distort(img, idx[4]); //4
    return img;
  }

  return { process };
})();
