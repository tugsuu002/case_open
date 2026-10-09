/* Бүх зургийг SVG-ээр зурдаг хэсэг */
'use strict';

/* ---------- art: every picture is drawn here as SVG ---------- */
const R1 = (n) => Math.round(n * 10) / 10;
/* mix a #rrggbb colour toward white (amt > 0) or black (amt < 0) */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16), to = amt > 0 ? 255 : 0, k = Math.abs(amt);
  const ch = (v) => Math.round(v + (to - v) * k).toString(16).padStart(2, '0');
  return '#' + ch(n >> 16) + ch((n >> 8) & 255) + ch(n & 255);
}
/* a small repeatable random source, so an item always gets the same drawing */
function seedOf(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function prng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const star4 = (x, y, r) => `M${R1(x)} ${R1(y - r)}L${R1(x + r * 0.22)} ${R1(y - r * 0.22)}L${R1(x + r)} ${R1(y)}L${R1(x + r * 0.22)} ${R1(y + r * 0.22)}L${R1(x)} ${R1(y + r)}L${R1(x - r * 0.22)} ${R1(y + r * 0.22)}L${R1(x - r)} ${R1(y)}L${R1(x - r * 0.22)} ${R1(y - r * 0.22)}Z`;
const dotPath = (x, y, q) => `M${R1(x - q)} ${R1(y)}a${R1(q)} ${R1(q)} 0 1 0 ${R1(q * 2)} 0a${R1(q)} ${R1(q)} 0 1 0 ${R1(-q * 2)} 0`;
function specks(r, n, col) {
  let d = '';
  for (let i = 0; i < n; i++) { const s = R1(0.7 + r() * 1.3); d += `M${R1(r() * 240)} ${R1(10 + r() * 104)}h${s}v${s}h${-s}Z`; }
  return `<path d="${d}" fill="${col}" opacity=".9"/>`;
}
function bigStars(r, n) {
  let d = '';
  for (let i = 0; i < n; i++) d += star4(20 + r() * 200, 26 + r() * 64, 3 + r() * 4);
  return `<path d="${d}" fill="#fff"/>`;
}
function blob(cx, cy, rad, r) {
  const pts = [];
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, q = rad * (0.55 + r() * 0.8); pts.push([cx + Math.cos(a) * q * 1.5, cy + Math.sin(a) * q]); }
  let d = `M${R1((pts[6][0] + pts[0][0]) / 2)} ${R1((pts[6][1] + pts[0][1]) / 2)}`;
  for (let k = 0; k < 7; k++) { const p = pts[k], n = pts[(k + 1) % 7]; d += `Q${R1(p[0])} ${R1(p[1])} ${R1((p[0] + n[0]) / 2)} ${R1((p[1] + n[1]) / 2)}`; }
  return d + 'Z';
}
function zig(x, y, r, n, len) {
  let d = `M${R1(x)} ${R1(y)}`;
  for (let i = 0; i < n; i++) { x += len * (0.5 + r() * 0.7); y += (i % 2 ? -1 : 1) * (6 + r() * 10) + 9; d += `L${R1(x)} ${R1(y)}`; }
  return d;
}
function ridge(base, amp, r, step) {
  let d = `M-10 120V${R1(base)}`;
  for (let x = -10; x <= 250; x += step) d += `L${R1(x + r() * step * 0.4)} ${R1(base - amp * r())}`;
  return d + 'V120Z';
}

/* The graphics painted onto an item. Each draws on a 240 x 120 sheet that is then cut to the item's shape.
   C: a main colour, b second colour, c graphic colour, hi a light tint, lo a dark tint.  r: the item's random source. */
const GFX = {
  two: (C) => `<path d="M0 53H240V120H0Z" fill="${C.b}"/><path d="M0 51.5H240" stroke="${C.c}" stroke-width="2.6"/><path d="M0 56H240" stroke="${C.lo}" stroke-opacity=".5" stroke-width="1.2"/>`,
  reed: (C, r) => {
    let d1 = '', d2 = '';
    for (let i = 0; i < 34; i++) {
      const x = r() * 250 - 5, h = 30 + r() * 60, lean = (r() - 0.3) * 30, seg = `M${R1(x)} 120q${R1(lean * 0.3)} ${R1(-h * 0.6)} ${R1(lean)} ${R1(-h)}`;
      if (i % 3) d1 += seg; else d2 += seg;
    }
    return `<path d="${d1}" fill="none" stroke="${C.c}" stroke-width="2.2" stroke-linecap="round" opacity=".8"/><path d="${d2}" fill="none" stroke="${C.lo}" stroke-width="2.6" stroke-linecap="round" opacity=".6"/>`;
  },
  rain: (C, r) => {
    let d1 = '', d2 = '';
    for (let i = 0; i < 60; i++) {
      const l = 8 + r() * 12, seg = `M${R1(r() * 260 - 10)} ${R1(r() * 110)}l${R1(-l * 0.45)} ${R1(l)}`;
      if (i % 2) d1 += seg; else d2 += seg;
    }
    return `<path d="${d1}" fill="none" stroke="${C.c}" stroke-width="1.8" stroke-linecap="round" opacity=".85"/><path d="${d2}" fill="none" stroke="${C.hi}" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>`;
  },
  camo: (C, r) => {
    let out = '';
    [C.c, C.lo, C.b].forEach((col) => {
      let d = '';
      for (let i = 0; i < 7; i++) d += blob(r() * 240, 20 + r() * 90, 7 + r() * 9, r);
      out += `<path d="${d}" fill="${col}" opacity=".85"/>`;
    });
    return out;
  },
  wave: (C, r) => {
    let out = '';
    [C.c, C.hi, C.b, C.c, C.lo, C.hi].forEach((col, i) => {
      out += `<path d="M${R1(-20 - r() * 30)} ${R1(24 + i * 15 + r() * 6)}q15 ${R1(-7 - r() * 6)} 30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0" fill="none" stroke="${col}" stroke-width="${R1(6 + r() * 7)}" stroke-linecap="round" opacity=".8"/>`;
    });
    return out;
  },
  aurora: (C, r) => {
    let out = '';
    const cols = [C.c, C.hi, '#b06cff', C.c, '#5ad0ff'];
    for (let i = 0; i < 7; i++) out += `<path d="M${R1(10 + i * 36 + r() * 14)} -10q${R1(8 + r() * 8)} 20 0 40t0 40t0 40" fill="none" stroke="${cols[i % 5]}" stroke-width="${R1(8 + r() * 12)}" stroke-linecap="round" opacity="${R1(0.35 + r() * 0.3)}"/>`;
    return out + specks(r, 26, '#fff');
  },
  scale: (C) => {
    let out = '';
    for (let j = 9; j >= 0; j--) {
      const y = 12 + j * 11, x0 = j % 2 ? -12 : -24;
      let d = `M${x0} ${y}`;
      for (let i = 0; i < 12; i++) d += 'a12 11 0 0 0 24 0';
      out += `<path d="${d}V${y - 12}H${x0}Z" fill="${j % 2 ? C.b : C.a}" stroke="${C.c}" stroke-width="1.6"/>`;
    }
    return out;
  },
  haze: (C) => `<linearGradient id="q1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.a}"/><stop offset=".5" stop-color="${C.c}"/><stop offset="1" stop-color="${C.b}"/></linearGradient><rect width="240" height="120" fill="url(#q1)"/><path d="M0 40h70M90 40h120M20 52h150M190 52h50M0 64h40M60 64h150M30 76h180M0 88h110M130 88h110" stroke="#fff" stroke-opacity=".24" stroke-width="1.4"/>`,
  sun: (C) => `<linearGradient id="q1" x1="0" y1="0" x2="0" y2="1"><stop offset=".15" stop-color="${C.b}"/><stop offset=".55" stop-color="${C.a}"/><stop offset=".9" stop-color="${C.c}"/></linearGradient><rect width="240" height="120" fill="url(#q1)"/><circle cx="118" cy="56" r="22" fill="${C.c}"/><circle cx="118" cy="56" r="22" fill="#fff" fill-opacity=".35"/><path d="M92 58h52M92 64h52M92 70h52M92 76h52" stroke="${C.a}" stroke-width="2.6"/><path d="M0 82H240" stroke="${C.lo}" stroke-opacity=".6" stroke-width="2"/><path d="M0 90H240M0 99H240" stroke="${C.lo}" stroke-opacity=".35" stroke-width="1.4"/>`,
  tiger: (C, r) => {
    let d = '';
    for (let i = 0; i < 13; i++) {
      const x = -6 + i * 20 + r() * 8, w = 4 + r() * 6, k = 8 + r() * 14, t = 12 + r() * 16, b = 104 - r() * 18;
      d += `M${R1(x)} ${R1(t)}Q${R1(x + k)} ${R1((t + b) / 2)} ${R1(x - 4)} ${R1(b)}Q${R1(x + k + w)} ${R1((t + b) / 2 + 4)} ${R1(x + w * 0.6)} ${R1(t)}Z`;
    }
    return `<path d="${d}" fill="${C.c}" opacity=".92"/>`;
  },
  bolt: (C, r) => {
    let d = '';
    for (let i = 0; i < 3; i++) d += zig(-4 + i * 74 + r() * 20, 6 + r() * 20, r, 7, 16);
    return `<path d="${d}" fill="none" stroke="${C.c}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" opacity=".35"/><path d="${d}" fill="none" stroke="${C.c}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#fff" stroke-width="1.1" stroke-linejoin="round"/>` + specks(r, 14, C.hi);
  },
  ornament: (C) => {
    let key = '', dia = '';
    for (let x = -4; x < 240; x += 20) { key += `M${x} 69V51H${x + 14}V64H${x + 6}V57`; dia += `M${x + 4} 30l5-5l5 5l-5 5ZM${x + 4} 90l5-5l5 5l-5 5Z`; }
    return `<rect y="44" width="240" height="32" fill="${C.c}"/><path d="${key}" fill="none" stroke="${C.lo}" stroke-width="2.4"/><path d="M0 44H240M0 76H240" stroke="${C.hi}" stroke-width="2"/><path d="M0 39.5H240M0 80.5H240" stroke="${C.c}" stroke-width="1.6"/><path d="${dia}" fill="${C.c}" opacity=".85"/>`;
  },
  dots: (C, r) => {
    let a = '', b = '';
    for (let i = 0; i < 46; i++) { const s = dotPath(r() * 240, 14 + r() * 100, 1.8 + r() * 3.4); if (i % 3) a += s; else b += s; }
    return `<path d="${a}" fill="${C.c}" opacity=".8"/><path d="${b}" fill="${C.lo}" opacity=".55"/>`;
  },
  stripe: (C) => `<path d="M96 0h30L86 120H56Z" fill="${C.c}"/><path d="M132 0h9L101 120h-9Z" fill="${C.hi}"/><path d="M148 0h5L113 120h-5Z" fill="${C.c}"/><path d="M40 0h6L6 120H0Z" fill="${C.lo}" opacity=".6"/><path d="M200 0h14L174 120h-14Z" fill="${C.lo}" opacity=".5"/>`,
  chevron: (C) => {
    let a = '', b = '';
    for (let i = 0; i < 6; i++) { const x = -20 + i * 46, s = `M${x} 14L${x + 30} 60L${x} 106H${x + 12}L${x + 42} 60L${x + 12} 14Z`; if (i % 2) a += s; else b += s; }
    return `<path d="${a}" fill="${C.c}"/><path d="${b}" fill="${C.hi}" opacity=".85"/>`;
  },
  mount: (C, r) => `<path d="${ridge(52, 26, r, 22)}" fill="${C.hi}" opacity=".85"/><path d="${ridge(66, 22, r, 18)}" fill="${C.c}" opacity=".9"/><path d="${ridge(82, 18, r, 16)}" fill="${C.lo}" opacity=".85"/>`,
  drip: (C, r) => {
    let d = 'M250 0V30', x = 250;
    while (x > -10) { const w = 7 + r() * 7, l = 6 + r() * 38, g = 4 + r() * 10; d += `h${R1(-g)}v${R1(l)}a${R1(w / 2)} ${R1(w / 2)} 0 0 1 ${R1(-w)} 0v${R1(-l)}`; x -= g + w; }
    return `<path d="${d}H-10V0Z" fill="${C.c}"/><path d="M0 8H240" stroke="#fff" stroke-opacity=".3" stroke-width="3"/>`;
  },
  cloud: (C, r) => {
    let d = '';
    for (let i = 0; i < 12; i++) {
      const x = -10 + r() * 230, y = 26 + r() * 86, s = 0.6 + r() * 0.7;
      d += `M${R1(x)} ${R1(y)}q0 ${R1(-6 * s)} ${R1(6 * s)} ${R1(-6 * s)}q${R1(s)} ${R1(-7 * s)} ${R1(10 * s)} ${R1(-6 * s)}q${R1(8 * s)} ${R1(-3 * s)} ${R1(11 * s)} ${R1(5 * s)}q${R1(7 * s)} 0 ${R1(7 * s)} ${R1(7 * s)}Z`;
    }
    return `<path d="${d}" fill="${C.hi}" stroke="${C.c}" stroke-width="1" opacity=".8"/>`;
  },
  rays: (C) => {
    let d = '';
    for (let i = 0; i < 12; i++) {
      const a0 = i * Math.PI / 6, a1 = a0 + Math.PI / 12;
      d += `M70 60L${R1(70 + Math.cos(a0) * 300)} ${R1(60 + Math.sin(a0) * 300)}L${R1(70 + Math.cos(a1) * 300)} ${R1(60 + Math.sin(a1) * 300)}Z`;
    }
    return `<path d="${d}" fill="${C.c}" opacity=".7"/><circle cx="70" cy="60" r="15" fill="${C.c}"/><circle cx="70" cy="60" r="10" fill="#fff" fill-opacity=".55"/>`;
  },
  grid: (C) => `<pattern id="q1" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 .8H12M.8 0V12" stroke="${C.c}" stroke-width="1.6"/></pattern><rect width="240" height="120" fill="url(#q1)" opacity=".75"/>`,
  carbon: (C) => `<pattern id="q1" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#000" opacity=".3"/><rect x="4" y="4" width="4" height="4" fill="#000" opacity=".3"/><rect width="4" height="1.2" fill="${C.c}" opacity=".35"/><rect x="4" y="4" width="4" height="1.2" fill="${C.c}" opacity=".35"/></pattern><rect width="240" height="120" fill="url(#q1)"/>`,
  shard: (C, r) => {
    const cols = [C.a, C.b, C.c, C.hi, C.lo], nx = 6, ny = 3, P = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) P.push([R1(i * 240 / nx + (i && i < nx ? (r() - 0.5) * 24 : 0)), R1(j * 120 / ny + (j && j < ny ? (r() - 0.5) * 22 : 0))]);
    let out = '';
    const tri = (p, q, s) => { out += `<path d="M${p[0]} ${p[1]}L${q[0]} ${q[1]}L${s[0]} ${s[1]}Z" fill="${cols[Math.floor(r() * 5)]}" opacity="${R1(0.55 + r() * 0.4)}"/>`; };
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const a = P[j * (nx + 1) + i], b = P[j * (nx + 1) + i + 1], c = P[(j + 1) * (nx + 1) + i], e = P[(j + 1) * (nx + 1) + i + 1];
        if (r() < 0.5) { tri(a, b, c); tri(b, e, c); } else { tri(a, b, e); tri(a, e, c); }
      }
    }
    return `<g stroke="#fff" stroke-opacity=".28" stroke-width=".7" stroke-linejoin="round">${out}</g>`;
  },
  rainbow: () => ['#ff4d5a', '#ff9a3c', '#ffe45c', '#4bd08b', '#4aa8ff', '#8a6cff'].map((col, i) => `<path d="M-20 ${32 + i * 9}Q120 ${2 + i * 9} 260 ${32 + i * 9}" fill="none" stroke="${col}" stroke-width="9.4"/>`).join(''),
  leopard: (C, r) => {
    let ring = '', spot = '';
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 9; i++) {
        const x = i * 28 + (j % 2) * 14 + (r() - 0.5) * 10, y = 22 + j * 24 + (r() - 0.5) * 8, q = 4.5 + r() * 2.5;
        ring += `M${R1(x - q)} ${R1(y - 2)}a${R1(q)} ${R1(q * 0.8)} 0 0 1 ${R1(q * 1.5)} ${R1(-q * 0.5)}M${R1(x + q)} ${R1(y + 1)}a${R1(q)} ${R1(q * 0.8)} 0 0 1 ${R1(-q * 1.4)} ${R1(q * 0.7)}M${R1(x - q * 0.9)} ${R1(y + 2)}l${R1(q * 0.3)} ${R1(q * 0.5)}`;
        spot += dotPath(x, y, q * 0.45);
      }
    }
    return `<path d="${spot}" fill="${C.b}" opacity=".8"/><path d="${ring}" fill="none" stroke="${C.c}" stroke-width="2.6" stroke-linecap="round"/>`;
  },
  circuit: (C, r) => {
    let d = '', pads = '';
    for (let i = 0; i < 16; i++) {
      const x = Math.round(r() * 18) * 10 + 5, y = Math.round(r() * 8) * 10 + 20;
      const l1 = 10 + Math.floor(r() * 4) * 10, dg = r() < 0.5 ? 10 : -10, l2 = 10 + Math.floor(r() * 3) * 10;
      d += `M${x} ${y}h${l1}l10 ${dg}h${l2}`;
      pads += dotPath(x, y, 2.4) + dotPath(x + l1 + 10 + l2, y + dg, 2.4);
    }
    return `<path d="${d}" fill="none" stroke="${C.c}" stroke-width="1.8" stroke-linejoin="round"/><path d="${pads}" fill="${C.hi}"/><rect x="100" y="44" width="26" height="16" rx="2" fill="none" stroke="${C.c}" stroke-width="1.6"/><path d="M104 44v-4M110 44v-4M116 44v-4M122 44v-4M104 60v4M110 60v4M116 60v4M122 60v4" stroke="${C.c}" stroke-width="1.4"/>`;
  },
  vein: (C, r) => {
    let d1 = '', d2 = '';
    for (let i = 0; i < 7; i++) {
      let x = -10, y = 10 + r() * 100, d = `M${x} ${R1(y)}`;
      while (x < 250) {
        x += 14 + r() * 18;
        y += (r() - 0.5) * 26;
        d += `L${R1(x)} ${R1(y)}`;
        if (r() < 0.3) d += `l${R1(8 + r() * 10)} ${R1((r() - 0.5) * 30)}M${R1(x)} ${R1(y)}`;
      }
      if (i % 2) d1 += d; else d2 += d;
    }
    return `<path d="${d1}" fill="none" stroke="${C.c}" stroke-width="2.2" stroke-linejoin="round" opacity=".85"/><path d="${d2}" fill="none" stroke="${C.hi}" stroke-width="1.3" stroke-linejoin="round" opacity=".8"/>`;
  },
  galaxy: (C, r) => {
    let out = '';
    [C.c, C.hi, C.c, '#ffffff'].forEach((col, i) => {
      out += `<radialGradient id="q${i}"><stop offset="0" stop-color="${col}" stop-opacity="${i === 3 ? '.5' : '.75'}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient><ellipse cx="${R1(30 + r() * 180)}" cy="${R1(30 + r() * 60)}" rx="${R1(30 + r() * 40)}" ry="${R1(16 + r() * 22)}" fill="url(#q${i})" transform="rotate(${R1(-30 + r() * 60)} 120 60)"/>`;
    });
    return out + specks(r, 60, '#fff') + bigStars(r, 5);
  },
  flame: (C, r) => {
    let out = '';
    const tongue = (y0, y1, tx, ty, col) => `<path d="M-10 ${R1(y0)}C${R1(tx * 0.35)} ${R1(y0 - 10)} ${R1(tx * 0.6)} ${R1(ty + 12)} ${R1(tx)} ${R1(ty)}C${R1(tx * 0.62)} ${R1(ty + 16)} ${R1(tx * 0.3)} ${R1(y1 + 8)} -10 ${R1(y1)}Z" fill="${col}" opacity=".93"/>`;
    for (let i = 0; i < 5; i++) {
      const y0 = 18 + i * 19, tx = 120 + r() * 110, ty = y0 + 4 + r() * 12;
      out += tongue(y0, y0 + 22, tx, ty, C.c) + tongue(y0 + 5, y0 + 17, tx * 0.72, ty + 2, C.hi);
    }
    return out;
  },
  stars: (C, r) => specks(r, 70, C.c) + bigStars(r, 7),
  constellation: (C, r) => {
    const pts = [];
    for (let i = 0; i < 7; i++) pts.push([R1(24 + i * 32 + (r() - 0.5) * 16), R1(34 + r() * 52)]);
    return specks(r, 46, '#fff') + `<path d="M${pts.map((p) => p[0] + ' ' + p[1]).join('L')}" fill="none" stroke="${C.c}" stroke-width="1.1" stroke-opacity=".85"/><path d="${pts.map((p) => star4(p[0], p[1], 4.6)).join('')}" fill="${C.c}"/>`;
  },
  comet: (C, r) => {
    let out = specks(r, 30, '#fff');
    for (let i = 0; i < 3; i++) {
      const x = R1(70 + i * 62 + r() * 20), y = R1(36 + r() * 46), l = 46 + r() * 30;
      out += `<path d="M${x} ${y}L${R1(x - l)} ${R1(y + l * 0.32 - 3)}L${R1(x - l)} ${R1(y + l * 0.32 + 3)}Z" fill="${C.c}" opacity=".6"/><path d="M${x} ${y}L${R1(x - l * 0.7)} ${R1(y + l * 0.224)}" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="6" fill="${C.c}" opacity=".4"/><circle cx="${x}" cy="${y}" r="3.4" fill="#fff"/>`;
    }
    return out;
  },
  moon: (C, r) => specks(r, 40, '#fff') + `<circle cx="116" cy="54" r="27" fill="none" stroke="${C.c}" stroke-opacity=".3" stroke-width="5"/><circle cx="116" cy="54" r="20" fill="${C.c}"/><circle cx="110" cy="48" r="4.5" fill="#000" fill-opacity=".14"/><circle cx="124" cy="60" r="6" fill="#000" fill-opacity=".12"/><circle cx="112" cy="64" r="2.6" fill="#000" fill-opacity=".14"/>`,
  eclipse: (C, r) => specks(r, 34, '#fff') + `<circle cx="116" cy="54" r="27" fill="${C.c}" opacity=".3"/><circle cx="116" cy="54" r="22" fill="${C.c}" opacity=".75"/><circle cx="116" cy="54" r="19" fill="#07070b"/><path d="M98 44a21 21 0 0 1 12-10" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,
};

/* Each drawing is built in layers.
   b1 the main painted part, b2 the furniture (stock, grip, handguard), b3 an accent part (magazine).
   back / front: bare metal behind and in front.  extra: details on top.  under: a dark base for parts drawn as thick lines.
   {c1}, {c2}, {c3} in extra become the item's colours. */
const PORT = (x, y, w) => `<rect x="${x}" y="${y}" width="${w}" height="9" rx="2" fill="#000" fill-opacity=".42"/><rect x="${x + 2}" y="${y + 1.5}" width="${w - 4}" height="2.5" rx="1.2" fill="#fff" fill-opacity=".18"/>`;
const PAD = (x, y, h) => `<rect x="${x}" y="${y}" width="5" height="${h}" rx="2" fill="#000" fill-opacity=".45"/>`;
const SHAPES = {
  pi: {
    b1: '<path d="M50 38Q50 34 54 34H182L190 39V58H50Z"/>',
    b2: '<path d="M56 56H184V64Q184 69 179 69H134L129 74H107L96 107Q95 111 90 111H66Q60 111 61 105L70 71Q60 68 58 60Z"/>',
    back: '<rect x="188" y="42" width="8" height="12" rx="2"/>',
    front: '<path d="M108 72V80Q108 90 118 90H126Q136 90 136 80V70" fill="none" stroke-width="4"/><path d="M119 72Q117 80 122 84" fill="none" stroke-width="3" stroke-linecap="round"/><rect x="54" y="30" width="10" height="5" rx="1"/><rect x="176" y="30" width="6" height="5" rx="1"/><path d="M62 108H94L93 114Q92 116 90 116H64Q61 116 61 113Z"/><rect x="112" y="60" width="16" height="4" rx="2"/>',
    extra: '<path d="M60 39v16M65 39v16M70 39v16M75 39v16M80 39v16" stroke="#000" stroke-opacity=".38" stroke-width="2"/>' + PORT(116, 38, 30) + '<path d="M50 57.5H190" stroke="#000" stroke-opacity=".4" stroke-width="1.6"/><path d="M52 59.5H188" stroke="#fff" stroke-opacity=".14" stroke-width="1"/><path d="M74 77H101L93 104H67Z" fill="#000" fill-opacity=".3"/><path d="M76 82h22M74 88h22M72 94h22M70 100h22" stroke="#fff" stroke-opacity=".12" stroke-width="2" stroke-dasharray="2 3"/><path d="M146 66v3M154 66v3M162 66v3M170 66v3" stroke="#000" stroke-opacity=".45" stroke-width="2.4"/><circle cx="98" cy="64" r="2" fill="#000" fill-opacity=".5"/>',
  },
  ps: {
    b1: '<path d="M34 33Q34 29 38 29H152L160 34V53H34Z"/>',
    b2: '<path d="M40 51H154V59Q154 64 149 64H118L113 69H91L80 102Q79 106 74 106H50Q44 106 45 100L54 66Q44 63 42 55Z"/>',
    back: '<rect x="158" y="33" width="76" height="18" rx="6"/>',
    front: '<path d="M92 67V75Q92 85 102 85H110Q120 85 120 75V65" fill="none" stroke-width="4"/><path d="M103 67Q101 75 106 79" fill="none" stroke-width="3" stroke-linecap="round"/><rect x="38" y="24" width="10" height="6" rx="1"/><rect x="146" y="24" width="6" height="6" rx="1"/><path d="M46 103H78L77 109Q76 111 74 111H48Q45 111 45 108Z"/><rect x="96" y="55" width="16" height="4" rx="2"/>',
    extra: '<path d="M44 34v15M49 34v15M54 34v15M59 34v15M64 34v15" stroke="#000" stroke-opacity=".38" stroke-width="2"/>' + PORT(100, 33, 30) + '<path d="M34 52.5H160" stroke="#000" stroke-opacity=".4" stroke-width="1.6"/><path d="M58 72H85L77 99H51Z" fill="#000" fill-opacity=".3"/><path d="M60 77h22M58 83h22M56 89h22M54 95h22" stroke="#fff" stroke-opacity=".12" stroke-width="2" stroke-dasharray="2 3"/><path d="M172 34v16M184 34v16M196 34v16M208 34v16M220 34v16" stroke="#000" stroke-opacity=".3" stroke-width="1.6"/><rect x="162" y="35" width="68" height="3" rx="1.5" fill="#fff" fill-opacity=".28"/>',
  },
  rv: {
    b1: '<path d="M126 37H204Q208 37 208 41V50H126Z"/><path d="M126 50H198L190 60H126Z"/><path d="M78 46Q78 33 92 33H130V70H104L78 56Z"/>',
    b2: '<path d="M78 54L106 70Q107 90 97 106Q94 112 87 111L66 107Q59 105 62 98Q73 80 75 62Z"/>',
    back: '',
    front: '<path d="M84 38L72 28L79 24L93 33Z"/><rect x="89" y="36" width="42" height="28" rx="6"/><path d="M108 70V78Q108 88 118 88H122Q132 88 132 78V70" fill="none" stroke-width="4"/><path d="M119 70Q117 78 121 82" fill="none" stroke-width="3" stroke-linecap="round"/><path d="M194 37L200 29L205 37Z"/><rect x="186" y="53" width="10" height="4" rx="2"/>',
    extra: '<path d="M95 44H125M95 56H125" stroke="#000" stroke-opacity=".45" stroke-width="5" stroke-linecap="round"/><path d="M95 42.5H125M95 54.5H125" stroke="#fff" stroke-opacity=".24" stroke-width="1.4" stroke-linecap="round"/><path d="M132 43.5H204" stroke="#000" stroke-opacity=".3" stroke-width="1.5"/><path d="M82 63L100 74Q99 88 91 102L72 98Q80 82 82 63Z" fill="#000" fill-opacity=".28"/><circle cx="88" cy="80" r="4" fill="#e9b44c"/><circle cx="87" cy="79" r="1.4" fill="#fff" fill-opacity=".75"/>',
  },
  sm: {
    b1: '<path d="M70 44Q70 40 74 40H166Q170 40 170 44V66H70Z"/><rect x="164" y="44" width="38" height="16" rx="5"/>',
    b2: '<path d="M94 62H116L108 98Q107 103 102 103H90Q85 103 86 98Z"/><path fill-rule="evenodd" d="M24 42H74V54H50L42 74H24ZM30 57H44L39 69H30Z"/>',
    b3: '<path d="M128 62H147L144 107H127Z"/>',
    back: '<rect x="198" y="48" width="20" height="8" rx="2"/>',
    front: '<rect x="80" y="35" width="76" height="6" rx="1.5"/><rect x="150" y="29" width="6" height="8" rx="1"/><rect x="84" y="29" width="6" height="8" rx="1"/><path d="M116 66V74Q116 80 122 80H128" fill="none" stroke-width="3.5"/><circle cx="150" cy="48" r="3.2"/>',
    extra: '<path d="M172 52h5M182 52h5M192 52h5" stroke="#000" stroke-opacity=".45" stroke-width="4.5" stroke-linecap="round"/>' + PORT(108, 46, 28) + '<path d="M88 35v6M96 35v6M104 35v6M112 35v6M120 35v6M128 35v6M136 35v6M144 35v6" stroke="#000" stroke-opacity=".4" stroke-width="1.6"/><path d="M130 76H145M129.5 88H144.5" stroke="#000" stroke-opacity=".3" stroke-width="2"/><path d="M96 70H112L106 96H90Z" fill="#000" fill-opacity=".28"/><path d="M72 59H168" stroke="#000" stroke-opacity=".3" stroke-width="1.4"/>',
  },
  mp: {
    b1: '<path d="M64 38Q64 34 68 34H168Q172 34 172 38V62H64Z"/>',
    b2: '<path d="M96 60H122L118 96Q117 100 113 100H101Q97 100 97 96Z"/>',
    b3: '<path d="M102 98H116L115 116Q115 118 113 118H104Q102 118 102 116Z"/>',
    under: '<path d="M64 40H22V76" fill="none" stroke-width="7.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M64 56H30" fill="none" stroke-width="7" stroke-linecap="round"/><path d="M150 62V74" fill="none" stroke-width="8.6" stroke-linecap="round"/>',
    back: '<rect x="170" y="44" width="30" height="9" rx="3"/><path d="M64 40H22V76" fill="none" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M64 56H30" fill="none" stroke-width="3.5" stroke-linecap="round"/><rect x="16" y="70" width="12" height="10" rx="3"/>',
    front: '<path d="M150 62V74" fill="none" stroke-width="5" stroke-linecap="round"/><rect x="110" y="28" width="16" height="7" rx="2"/><rect x="72" y="28" width="6" height="7" rx="1"/><rect x="158" y="28" width="6" height="7" rx="1"/><path d="M122 62V70Q122 76 128 76H136Q142 76 142 70V62" fill="none" stroke-width="3.5"/>',
    extra: PORT(128, 39, 26) + '<path d="M66 52H170" stroke="#000" stroke-opacity=".3" stroke-width="1.4"/><path d="M72 40v8M78 40v8M84 40v8" stroke="#000" stroke-opacity=".35" stroke-width="2"/><path d="M100 68H118L115 94H102Z" fill="#000" fill-opacity=".28"/><path d="M103 104H115M103 110H115" stroke="#000" stroke-opacity=".3" stroke-width="1.6"/>',
  },
  ri: {
    b1: '<path d="M70 46Q70 42 74 42H152V64H70Z"/><rect x="148" y="43" width="54" height="18" rx="5"/>',
    b2: '<path d="M10 48Q10 45 13 45H74V60H50L30 78H13Q10 78 10 75Z"/><path d="M84 62H105L98 93Q97 98 92 98H82Q77 98 78 93Z"/>',
    b3: '<path d="M114 62H137Q141 84 154 98L135 107Q120 88 114 62Z"/>',
    back: '<rect x="198" y="48" width="36" height="6" rx="2"/><rect x="150" y="36" width="48" height="5" rx="2.5"/>',
    front: '<rect x="222" y="45" width="13" height="12" rx="2.5"/><path d="M201 44V31H207V44Z"/><path d="M82 42V35H96V42Z"/><path d="M105 64V72Q105 78 111 78H116" fill="none" stroke-width="3.5"/><circle cx="100" cy="57" r="2.6"/>',
    extra: PORT(110, 46, 28) + '<path d="M156 52h9M171 52h9M186 52h9" stroke="#000" stroke-opacity=".42" stroke-width="5" stroke-linecap="round"/><path d="M18 52H68" stroke="#000" stroke-opacity=".3" stroke-width="1.8"/><path d="M18 54H68" stroke="#fff" stroke-opacity=".14" stroke-width="1"/><path d="M86 68H103L97 93H82Z" fill="#000" fill-opacity=".28"/><path d="M118 72Q130 74 139 71M123 84Q134 86 145 82" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="2"/><path d="M226 48v6M230 48v6" stroke="#000" stroke-opacity=".5" stroke-width="1.6"/>' + PAD(10, 46, 31),
  },
  ca: {
    b1: '<path d="M72 44Q72 40 76 40H150V64H72Z"/>',
    b2: '<rect x="146" y="42" width="58" height="17" rx="4"/><path fill-rule="evenodd" d="M12 46H74V56H52L46 78H12ZM22 56H42L38 70H22Z"/><path d="M86 62H106L100 92Q99 96 95 96H85Q81 96 82 92Z"/>',
    b3: '<path d="M116 62H138L142 102H122Z"/>',
    back: '<rect x="200" y="47" width="34" height="6" rx="2"/><path d="M168 59L164 86Q164 90 168 90H174Q178 90 178 86L176 59Z"/>',
    front: '<rect x="224" y="44" width="12" height="12" rx="2.5"/><rect x="78" y="35" width="124" height="5" rx="1"/><rect x="100" y="20" width="26" height="15" rx="3"/><rect x="190" y="29" width="6" height="7" rx="1"/><path d="M106 64V72Q106 78 112 78H116" fill="none" stroke-width="3.5"/><rect x="70" y="42" width="8" height="5" rx="1"/>',
    extra: '<rect x="104" y="23" width="18" height="9" rx="2" fill="#0a0d18"/><circle cx="113" cy="27.5" r="1.7" fill="#ff4a4a"/><path d="M84 35v5M92 35v5M132 35v5M140 35v5M148 35v5M156 35v5M164 35v5M172 35v5M180 35v5" stroke="#000" stroke-opacity=".4" stroke-width="1.6"/><path d="M152 48h8M166 48h8M180 48h8M194 48h6M152 54h8M166 54h8M180 54h8" stroke="#000" stroke-opacity=".4" stroke-width="3.4" stroke-linecap="round"/>' + PORT(112, 45, 28) + '<path d="M120 76H139M121 88H140.5" stroke="#000" stroke-opacity=".3" stroke-width="2"/><path d="M88 68H104L99 92H84Z" fill="#000" fill-opacity=".28"/><path d="M228 47v6M232 47v6" stroke="#000" stroke-opacity=".5" stroke-width="1.6"/>' + PAD(12, 47, 30),
  },
  bp: {
    b1: '<path d="M14 46Q14 40 20 40H150V62H76V66H42V62H34L24 80H14Z"/>',
    b2: '<rect x="146" y="42" width="52" height="18" rx="5"/><path d="M104 60H124L118 92Q117 96 113 96H103Q99 96 100 92Z"/>',
    b3: '<path d="M46 64H72L76 100Q76 104 72 104H52Q48 104 48 100Z"/>',
    back: '<rect x="194" y="47" width="40" height="6" rx="2"/>',
    front: '<rect x="224" y="44" width="12" height="12" rx="2.5"/><rect x="60" y="34" width="96" height="6" rx="1.5"/><rect x="96" y="20" width="34" height="14" rx="4"/><rect x="102" y="33" width="6" height="3"/><rect x="118" y="33" width="6" height="3"/><path d="M124 62V70Q124 76 130 76H138Q144 76 144 70V62" fill="none" stroke-width="3.5"/>',
    extra: '<ellipse cx="128" cy="27" rx="2.5" ry="5.5" fill="#ff6a5a" fill-opacity=".85"/><path d="M100 23H124" stroke="#fff" stroke-opacity=".24" stroke-width="1.4" stroke-linecap="round"/>' + PORT(38, 45, 26) + '<path d="M154 51h8M168 51h8M182 51h8" stroke="#000" stroke-opacity=".42" stroke-width="4.5" stroke-linecap="round"/><path d="M20 58H148" stroke="#000" stroke-opacity=".28" stroke-width="1.4"/><path d="M68 34v6M76 34v6M84 34v6M136 34v6M144 34v6" stroke="#000" stroke-opacity=".4" stroke-width="1.6"/><path d="M106 66H122L117 92H102Z" fill="#000" fill-opacity=".28"/><path d="M50 78H74M50 90H75" stroke="#000" stroke-opacity=".3" stroke-width="2"/><path d="M228 47v6M232 47v6" stroke="#000" stroke-opacity=".5" stroke-width="1.6"/>' + PAD(14, 46, 33),
  },
  lm: {
    b1: '<path d="M60 42Q60 38 64 38H150V64H60Z"/>',
    b2: '<path d="M8 46Q8 42 12 42H62V60H44L30 76H12Q8 76 8 72Z"/><rect x="146" y="44" width="46" height="16" rx="4"/><path d="M74 62H94L88 92Q87 96 83 96H73Q69 96 70 92Z"/>',
    b3: '<rect x="104" y="62" width="40" height="34" rx="5"/>',
    under: '<path d="M176 60L164 98M184 60L196 98" fill="none" stroke-width="7.6" stroke-linecap="round"/><path d="M110 38V28H140V38" fill="none" stroke-width="7.6" stroke-linejoin="round"/>',
    back: '<rect x="188" y="48" width="48" height="7" rx="2"/><path d="M176 60L164 98M184 60L196 98" fill="none" stroke-width="4" stroke-linecap="round"/><rect x="150" y="38" width="44" height="5" rx="2.5"/>',
    front: '<rect x="226" y="45" width="11" height="13" rx="2.5"/><path d="M110 38V28H140V38" fill="none" stroke-width="4" stroke-linejoin="round"/><rect x="68" y="31" width="10" height="7" rx="1"/><path d="M196 48V34H202V48Z"/><path d="M94 64V72Q94 78 100 78H104" fill="none" stroke-width="3.5"/>',
    extra: '<rect x="110" y="70" width="28" height="8" rx="2" fill="#000" fill-opacity=".3"/><path d="M110 84H138" stroke="#000" stroke-opacity=".3" stroke-width="2"/><g fill="#d9a441"><rect x="112" y="57" width="4" height="7" rx="1"/><rect x="118" y="57" width="4" height="7" rx="1"/><rect x="124" y="57" width="4" height="7" rx="1"/><rect x="130" y="57" width="4" height="7" rx="1"/></g><path d="M152 52h6M162 52h6M172 52h6M182 52h6" stroke="#000" stroke-opacity=".42" stroke-width="4" stroke-linecap="round"/><path d="M62 50H148" stroke="#000" stroke-opacity=".3" stroke-width="1.4"/><path d="M16 50H56" stroke="#000" stroke-opacity=".28" stroke-width="1.8"/><path d="M76 68H92L87 92H72Z" fill="#000" fill-opacity=".28"/><path d="M229 48v7M233 48v7" stroke="#000" stroke-opacity=".5" stroke-width="1.6"/>' + PAD(8, 44, 31),
  },
  sn: {
    b1: '<path fill-rule="evenodd" d="M6 50Q6 44 12 44H66L82 40H150V58H112L104 64H84L60 82H12Q6 82 6 76ZM42 56H72L58 68H42Z"/>',
    b2: '<rect x="146" y="41" width="50" height="16" rx="5"/><rect x="20" y="40" width="40" height="6" rx="3"/>',
    b3: '<path d="M116 56H137V75H119Z"/>',
    back: '<rect x="192" y="46" width="44" height="6" rx="2"/><path d="M160 58L186 67" fill="none" stroke-width="3.5" stroke-linecap="round"/><path d="M168 58L194 65" fill="none" stroke-width="3" stroke-linecap="round"/>',
    front: '<rect x="224" y="42" width="13" height="14" rx="2.5"/><rect x="96" y="21" width="62" height="12" rx="5"/><rect x="150" y="16" width="24" height="22" rx="6"/><rect x="82" y="18" width="18" height="18" rx="6"/><rect x="108" y="32" width="7" height="9" rx="1"/><rect x="138" y="32" width="7" height="9" rx="1"/><rect x="121" y="15" width="10" height="7" rx="1.5"/><path d="M92 64V70Q92 76 98 76H106" fill="none" stroke-width="3.5"/><path d="M124 48L132 58" fill="none" stroke-width="3" stroke-linecap="round"/><circle cx="133" cy="60" r="3.4"/>',
    extra: '<ellipse cx="171" cy="27" rx="3" ry="8" fill="#7fd0ff" fill-opacity=".8"/><ellipse cx="170" cy="24" rx="1" ry="3" fill="#fff" fill-opacity=".85"/><path d="M100 24H154" stroke="#fff" stroke-opacity=".24" stroke-width="1.6" stroke-linecap="round"/><path d="M14 52H60" stroke="#000" stroke-opacity=".28" stroke-width="1.8"/><path d="M154 49h8M168 49h8M182 49h8" stroke="#000" stroke-opacity=".4" stroke-width="4" stroke-linecap="round"/><path d="M228 45v8M232 45v8" stroke="#000" stroke-opacity=".5" stroke-width="1.6"/>' + PAD(6, 46, 34),
  },
  sg: {
    b1: '<path d="M72 46Q72 42 76 42H136V64H72Z"/>',
    b2: '<path d="M8 50Q8 47 11 47H76V62H58L36 84H11Q8 84 8 81Z"/><rect x="148" y="54" width="46" height="15" rx="7"/>',
    back: '<rect x="132" y="44" width="100" height="7" rx="2.5"/><rect x="132" y="56" width="88" height="8" rx="3.5"/>',
    front: '<circle cx="227" cy="42" r="2.8"/><path d="M90 64V72Q90 78 96 78H106Q112 78 112 72V64" fill="none" stroke-width="3.5"/><rect x="210" y="43" width="6" height="22" rx="2"/>',
    extra: '<rect x="80" y="45" width="44" height="12" rx="2" fill="#000" fill-opacity=".38"/><g fill="#d9a441"><rect x="84" y="46" width="6" height="10" rx="2"/><rect x="93" y="46" width="6" height="10" rx="2"/><rect x="102" y="46" width="6" height="10" rx="2"/><rect x="111" y="46" width="6" height="10" rx="2"/></g><g fill="#b3262a"><rect x="84" y="46" width="6" height="5" rx="2"/><rect x="93" y="46" width="6" height="5" rx="2"/><rect x="102" y="46" width="6" height="5" rx="2"/><rect x="111" y="46" width="6" height="5" rx="2"/></g><path d="M156 57v9M163 57v9M170 57v9M177 57v9M184 57v9" stroke="#000" stroke-opacity=".38" stroke-width="2.2"/><path d="M16 54H68" stroke="#000" stroke-opacity=".28" stroke-width="1.8"/>' + PAD(8, 48, 35),
  },
  kn: {
    grad: [98, 40, 230, 80],
    b1: '<path d="M98 45H186Q210 49 230 62Q210 73 188 73H98Z"/>',
    back: '',
    front: '<rect x="89" y="36" width="10" height="46" rx="4"/><rect x="30" y="46" width="62" height="26" rx="8"/><rect x="19" y="48" width="14" height="22" rx="5"/>',
    extra: '<path d="M106 54H180" stroke="#000" stroke-opacity=".3" stroke-width="3.2" stroke-linecap="round"/><path d="M106 56.5H180" stroke="#fff" stroke-opacity=".22" stroke-width="1" stroke-linecap="round"/><path d="M98 66H188Q210 66 230 62Q210 73 188 73H98Z" fill="#fff" fill-opacity=".34"/><path d="M104 45l3 3l3-3l3 3l3-3l3 3l3-3l3 3l3-3" fill="none" stroke="#000" stroke-opacity=".4" stroke-width="1.4"/><rect x="34" y="46" width="6" height="26" fill="{c1}"/><rect x="84" y="46" width="4" height="26" fill="{c1}"/><path d="M48 48v22M56 47v24M64 47v24M72 47v24M80 48v22" stroke="#fff" stroke-opacity=".14" stroke-width="3"/><circle cx="26" cy="59" r="2.6" fill="#000" fill-opacity=".65"/>',
  },
  sb: {
    grad: [62, 90, 232, 8], tilt: 0,
    b1: '<path d="M62 68Q150 60 232 8Q172 86 66 87Z"/>',
    back: '',
    front: '<path d="M50 60Q58 52 66 58L74 96Q66 104 58 96Z"/><circle cx="63" cy="77" r="7.5"/><path d="M20 90L58 70L63 85L26 103Z"/><circle cx="21" cy="97" r="8.5"/>',
    extra: '<path d="M74 75Q150 68 214 27" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="2.2"/><path d="M66 87Q172 86 232 8Q178 80 68 82.5Z" fill="#fff" fill-opacity=".34"/><path d="M30 86l5 12M38 82l5 12M46 78l5 12" stroke="#fff" stroke-opacity=".2" stroke-width="3"/><circle cx="63" cy="77" r="3.4" fill="{c3}"/><circle cx="62" cy="76" r="1.2" fill="#fff" fill-opacity=".85"/><circle cx="21" cy="97" r="3.8" fill="{c3}"/><circle cx="20" cy="96" r="1.3" fill="#fff" fill-opacity=".85"/><path d="M15 104Q7 110 9 118M21 106Q17 112 19 118M26 104Q25 111 28 116" stroke="#c0392b" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  },
  bw: {
    tilt: 0,
    under: '<path d="M20 78Q28 90 44 84Q82 30 120 30Q158 30 196 84Q212 90 220 78" fill="none" stroke-width="12.6" stroke-linecap="round"/>',
    b1: '<path d="M20 78Q28 90 44 84Q82 30 120 30Q158 30 196 84Q212 90 220 78" fill="none" stroke-width="9" stroke-linecap="round"/>',
    back: '',
    front: '<rect x="105" y="23" width="30" height="14" rx="6"/><circle cx="20" cy="78" r="5"/><circle cx="220" cy="78" r="5"/><path d="M60 57l8 6M76 43l7 8M180 57l-8 6M164 43l-7 8" fill="none" stroke-width="3.2" stroke-linecap="round"/>',
    extra: '<path d="M21 79L120 101L219 79" fill="none" stroke="#f1e6c8" stroke-opacity=".9" stroke-width="1.5"/><path d="M120 106V14" stroke="#caa56a" stroke-width="2.8" stroke-linecap="round"/><path d="M119.2 104V16" stroke="#fff" stroke-opacity=".3" stroke-width=".8"/><path d="M120 1L128 19H112Z" fill="#dfe6ee"/><path d="M120 1L124 19H120Z" fill="#000" fill-opacity=".18"/><path d="M120 88L112 97V108L120 101L128 108V97Z" fill="#c0392b"/><path d="M120 88V101" stroke="#000" stroke-opacity=".3" stroke-width="1"/><path d="M111 24v12M117 24v12M123 24v12M129 24v12" stroke="#fff" stroke-opacity=".2" stroke-width="2"/>',
  },
  sp: {
    grad: [154, 42, 238, 78], tilt: -8,
    b1: '<path d="M168 60Q196 38 238 60Q196 82 168 60Z"/><rect x="154" y="53" width="20" height="14" rx="4"/>',
    back: '<rect x="6" y="56.5" width="156" height="7" rx="3.5" fill="#7a5433" stroke="none"/><rect x="3" y="54" width="12" height="12" rx="3"/>',
    front: '',
    extra: '<path d="M10 58H150" stroke="#fff" stroke-opacity=".24" stroke-width="1.2" stroke-linecap="round"/><path d="M176 60H230" stroke="#000" stroke-opacity=".32" stroke-width="2" stroke-linecap="round"/><path d="M168 60Q196 38 238 60Q196 51 168 60Z" fill="#fff" fill-opacity=".26"/><path d="M148 64Q139 82 144 100Q150 94 152 84Q155 94 162 100Q167 82 160 64Z" fill="#b3262a"/><path d="M152 66Q150 80 152 92" stroke="#000" stroke-opacity=".25" stroke-width="1.2" fill="none"/><rect x="146" y="54" width="16" height="11" rx="3" fill="#e9b44c"/><rect x="147" y="55" width="14" height="3" rx="1.5" fill="#fff" fill-opacity=".4"/><path d="M40 56.5v7M80 56.5v7M120 56.5v7" stroke="#e9b44c" stroke-opacity=".85" stroke-width="3"/>',
  },
};

/* bare-metal colours by rarity: steel, and warmer fittings for the two top tiers */
const METALS = [['#8c95a3', '#474c57', '#1b1e25'], ['#8c95a3', '#474c57', '#1b1e25'], ['#8c95a3', '#474c57', '#1b1e25'], ['#aab4c4', '#59606e', '#20242c'], ['#f0b99a', '#a05f48', '#3c1d18'], ['#ffeaa6', '#d9a23a', '#6a4310']];

function weaponSvg(it) {
  const s = SHAPES[it.t], gr = s.grad || [20, 10, 220, 110], mt = METALS[it.tier];
  const C = { a: it.c[0], b: it.c[1], c: it.c[2], hi: shade(it.c[0], 0.55), lo: shade(it.c[1], -0.55) };
  const tilt = s.tilt == null ? -10 : s.tilt;
  const tf = tilt ? ` transform="rotate(${tilt} 120 60) translate(120 60) scale(.93) translate(-120 -60)"` : '';
  const use = (id, fill, more) => `<use href="#${id}" fill="${fill}" stroke="${fill}" stroke-width="0"${more || ''}/>`;
  const extra = s.extra.replace(/\{c([123])\}/g, (m, n) => it.c[n - 1]);
  const lin = (id, x1, y1, x2, y2, stops) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
  const stop = (o, col, op) => `<stop offset="${o}" stop-color="${col}"${op == null ? '' : ` stop-opacity="${op}"`}/>`;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120"><defs>'
    + lin('g', gr[0], gr[1], gr[2], gr[3], stop(0, C.a) + stop(1, C.b))
    + lin('g2', 0, 30, 0, 110, stop(0, shade(C.b, -0.12)) + stop(1, shade(C.b, -0.52)))
    + lin('g3', 0, 50, 0, 115, stop(0, shade(C.c, 0.1)) + stop(1, shade(C.c, -0.45)))
    + lin('m', 0, 14, 0, 112, stop(0, mt[0]) + stop(0.42, mt[1]) + stop(1, mt[2]))
    + lin('s', 0, 22, 0, 104, stop(0, '#fff', 0.3) + stop(0.4, '#fff', 0) + stop(1, '#000', 0.4))
    + lin('l', 92, 0, 150, 120, stop(0.4, '#fff', 0) + stop(0.5, '#fff', 0.3) + stop(0.6, '#fff', 0))
    + '<radialGradient id="d"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>'
    + '<pattern id="n" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><rect width="1.2" height="5" fill="#fff" opacity=".07"/></pattern>'
    + `<pattern id="p" width="240" height="120" patternUnits="userSpaceOnUse">${GFX[it.k](C, prng(seedOf(it.id)))}</pattern>`
    + `<g id="b"><g id="b1">${s.b1}</g>${s.b2 ? `<g id="b2">${s.b2}</g>` : ''}${s.b3 ? `<g id="b3">${s.b3}</g>` : ''}</g><g id="mb">${s.back}</g><g id="mf">${s.front}</g>`
    + '<mask id="hi" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="120"><use href="#b" fill="#fff" stroke="#fff" stroke-width="0"/><use href="#b" fill="#000" stroke="#000" stroke-width="0" transform="translate(0 2.4)"/></mask>'
    + '<mask id="lo" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="120"><use href="#b" fill="#fff" stroke="#fff" stroke-width="0"/><use href="#b" fill="#000" stroke="#000" stroke-width="0" transform="translate(0 -3)"/></mask></defs>'
    + '<ellipse cx="120" cy="111" rx="88" ry="6" fill="url(#d)"/>'
    + `<g${tf}>`
    + `<g fill="#060914" stroke="#060914" stroke-width="3.4" stroke-linejoin="round">${s.under || ''}<use href="#mb"/><use href="#b"/><use href="#mf"/></g>`
    + use('mb', 'url(#m)')
    + use('b1', 'url(#g)') + use('b1', 'url(#p)')
    + (s.b2 ? use('b2', 'url(#g2)') + use('b2', 'url(#p)', ` opacity="${it.tier >= 4 ? '.75' : '.38'}"`) : '')
    + (s.b3 ? use('b3', 'url(#g3)') : '')
    + use('b', 'url(#n)') + use('b', 'url(#s)') + use('b', 'url(#l)')
    + '<rect width="240" height="120" fill="#fff" fill-opacity=".5" mask="url(#hi)"/><rect width="240" height="120" fill="#000" fill-opacity=".4" mask="url(#lo)"/>'
    + use('mf', 'url(#m)')
    + extra + '</g>'
    + (it.tier >= 4 ? `<path d="${star4(202, 20, 9)}${star4(34, 30, 5)}${star4(168, 102, 4)}" fill="#fff" fill-opacity=".92"/>` : '')
    + '</svg>';
}

const MOTIFS = {
  wave: (o) => `<g fill="none" stroke="${o}" stroke-width="3" stroke-linecap="round"><path d="M70 112q7.5-9 15 0t15 0t15 0t15 0"/><path d="M70 124q7.5-9 15 0t15 0t15 0t15 0"/><path d="M70 136q7.5-9 15 0t15 0t15 0t15 0"/></g>`,
  sun: (o) => `<g stroke="${o}" stroke-width="3" stroke-linecap="round" fill="none"><circle cx="100" cy="122" r="8" fill="${o}"/><path d="M100 103v6M100 135v6M81 122h6M113 122h6M86.5 108.5l4.5 4.5M109 131l4.5 4.5M113.5 108.5l-4.5 4.5M91 131l-4.5 4.5"/></g>`,
  bone: (o) => `<g fill="${o}"><rect x="79" y="103" width="17" height="15" rx="6"/><rect x="104" y="103" width="17" height="15" rx="6"/><rect x="79" y="125" width="17" height="15" rx="6"/><rect x="104" y="125" width="17" height="15" rx="6"/></g><g fill="#000" opacity=".28"><rect x="84" y="108" width="7" height="5" rx="2.5"/><rect x="109" y="108" width="7" height="5" rx="2.5"/><rect x="84" y="130" width="7" height="5" rx="2.5"/><rect x="109" y="130" width="7" height="5" rx="2.5"/></g>`,
  cloud: (o) => `<path d="M76 134q-8 0-8-8t9-8q1-10 12-10q8 0 11 7q3-3 8-3q10 0 10 10q9 0 9 7t-8 5Z" fill="${o}"/>`,
  peak: (o) => `<path d="M66 140L89 106L100 121L112 102L134 140Z" fill="${o}"/><path d="M89 106l-7 10.5l6.5-3l4 4.5l1.5-5ZM112 102l-7.5 11.5l7-3.5l6 5.5l1-3.5Z" fill="#fff"/>`,
  gem: (o) => `<g fill="none" stroke="${o}" stroke-width="3" stroke-linejoin="round"><path d="M100 102L121 116L112 140H88L79 116Z"/><path d="M79 116H121M100 102L92 116L100 140L108 116Z"/></g>`,
  seal: (o) => `<g fill="none" stroke="${o}" stroke-width="3.2" stroke-linecap="round"><circle cx="100" cy="109" r="7"/><path d="M85 121q15 13 30 0"/><path d="M100 128v13M90 141h20"/></g>`,
  knot: (o) => `<g fill="none" stroke="${o}" stroke-width="3" stroke-linejoin="round"><rect x="86" y="108" width="28" height="28" rx="2"/><rect x="86" y="108" width="28" height="28" rx="2" transform="rotate(45 100 122)"/></g>`,
  star: (o) => `<path d="M100 100l4.5 15.5L120 120l-15.5 4.5L100 142l-4.5-17.5L80 120l15.5-4.5Z" fill="${o}"/><g fill="${o}"><circle cx="76" cy="106" r="1.8"/><circle cx="126" cy="137" r="1.8"/><circle cx="124" cy="104" r="1.2"/></g>`,
};

/* The chest, seen from the front and a little from above. open = lid thrown back with light pouring out. */
function chestSvg(cs, open) {
  const m = cs.col[0], t = cs.col[1], o = cs.col[2], g = cs.col[3];
  const strapL = 'M56 102V72Q57 50 65 40L78 38Q70 52 70 72V102Z', strapR = 'M164 102V72Q163 50 155 40L142 38Q150 52 150 72V102Z';
  const rivets = [[63, 112], [63, 134], [63, 152], [157, 112], [157, 134], [157, 152]];
  const defs = '<defs>'
    + `<radialGradient id="gl"><stop offset="0" stop-color="${g}" stop-opacity="${open ? '.75' : '.5'}"/><stop offset="1" stop-color="${g}" stop-opacity="0"/></radialGradient>`
    + `<linearGradient id="bd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(m, 0.12)}"/><stop offset=".5" stop-color="${m}"/><stop offset="1" stop-color="${shade(m, -0.42)}"/></linearGradient>`
    + `<linearGradient id="ld" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(m, 0.34)}"/><stop offset=".55" stop-color="${shade(m, 0.06)}"/><stop offset="1" stop-color="${shade(m, -0.22)}"/></linearGradient>`
    + `<linearGradient id="tm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(t, 0.5)}"/><stop offset=".45" stop-color="${t}"/><stop offset="1" stop-color="${shade(t, -0.45)}"/></linearGradient>`
    + `<linearGradient id="tv" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${shade(t, -0.3)}"/><stop offset=".35" stop-color="${shade(t, 0.45)}"/><stop offset="1" stop-color="${shade(t, -0.35)}"/></linearGradient>`
    + `<radialGradient id="gm" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="${shade(g, 0.25)}"/><stop offset="1" stop-color="${shade(g, -0.55)}"/></radialGradient>`
    + `<linearGradient id="bm" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="${shade(g, 0.5)}" stop-opacity=".5"/><stop offset="1" stop-color="${g}" stop-opacity="0"/></linearGradient>`
    + '</defs>';
  const body = '<path d="M30 100H190V160Q190 168 182 168H38Q30 168 30 160Z" fill="url(#bd)"/>'
    + '<path d="M30 122H190M30 143H190" stroke="#000" stroke-opacity=".18" stroke-width="1.6"/><path d="M30 124H190M30 145H190" stroke="#fff" stroke-opacity=".08" stroke-width="1"/>'
    + `<path d="M86 136l6-7l6 7l-6 7ZM104 136l6-7l6 7l-6 7ZM122 136l6-7l6 7l-6 7Z" fill="${o}" fill-opacity=".85"/>`
    + '<rect x="56" y="100" width="14" height="68" fill="url(#tv)"/><rect x="150" y="100" width="14" height="68" fill="url(#tv)"/>'
    + '<rect x="26" y="157" width="168" height="12" rx="4" fill="url(#tm)"/><path d="M30 138V158H52ZM190 138V158H168Z" fill="url(#tm)"/>'
    + '<rect x="20" y="95" width="180" height="11" rx="4" fill="url(#tm)"/><rect x="24" y="96.5" width="172" height="2.5" rx="1.2" fill="#fff" fill-opacity=".45"/>'
    + rivets.map((r) => `<circle cx="${r[0]}" cy="${r[1]}" r="2.3" fill="#1a1216" fill-opacity=".75"/><circle cx="${r[0] - 0.7}" cy="${r[1] - 0.7}" r=".9" fill="#fff" fill-opacity=".7"/>`).join('')
    + '<path d="M96 88H124V110Q124 122 110 127Q96 122 96 110Z" fill="url(#tm)" stroke="#000" stroke-opacity=".3" stroke-width="1"/>'
    + '<circle cx="110" cy="102" r="7" fill="url(#gm)" stroke="#000" stroke-opacity=".35" stroke-width="1"/><path d="M108.6 113.5h2.8l1.2 6h-5.2Z" fill="#1a1216"/><circle cx="110" cy="113" r="2.2" fill="#1a1216"/>';
  const shadow = '<ellipse cx="110" cy="173" rx="88" ry="9" fill="#000" fill-opacity=".5"/>';
  const sparkle = (list) => `<path d="${list.map((p) => star4(p[0], p[1], p[2])).join('')}" fill="#fff" fill-opacity=".95"/>`;
  if (open) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 190">' + defs
      + '<ellipse cx="110" cy="92" rx="110" ry="92" fill="url(#gl)"/>' + shadow
      + `<path d="M36 100V62Q36 30 64 23Q110 13 156 23Q184 30 184 62V100Z" fill="${shade(m, -0.55)}" stroke="url(#tm)" stroke-width="6" stroke-linejoin="round"/>`
      + `<path d="M48 96V64Q48 40 70 34Q110 26 150 34Q172 40 172 64V96Z" fill="${shade(m, -0.38)}"/>`
      + '<path d="M46 100L14 4H206L174 100Z" fill="url(#bm)"/><path d="M92 100L70 6H98L104 100ZM128 100L150 6H122L116 100Z" fill="#fff" fill-opacity=".22"/>'
      + '<ellipse cx="110" cy="99" rx="76" ry="13" fill="#fff"/>'
      + `<g fill="${shade(t, 0.25)}" stroke="${shade(t, -0.4)}" stroke-width="1"><ellipse cx="72" cy="95" rx="11" ry="5"/><ellipse cx="94" cy="92" rx="11" ry="5"/><ellipse cx="146" cy="95" rx="11" ry="5"/><ellipse cx="126" cy="92" rx="11" ry="5"/></g>`
      + `<path d="M104 96L110 84L116 96L110 102Z" fill="url(#gm)" stroke="#000" stroke-opacity=".3" stroke-width="1"/>`
      + body + sparkle([[30, 34, 9], [194, 24, 7], [206, 86, 5], [16, 96, 5], [110, 10, 6], [62, 12, 4], [160, 52, 4]]) + '</svg>';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 190">' + defs
    + '<ellipse cx="110" cy="100" rx="108" ry="88" fill="url(#gl)"/>' + shadow
    + '<path d="M24 102V74Q24 44 56 37Q110 27 164 37Q196 44 196 74V102Z" fill="url(#ld)"/>'
    + '<path d="M40 60Q110 38 180 60" fill="none" stroke="#fff" stroke-opacity=".24" stroke-width="7" stroke-linecap="round"/><path d="M24 84Q110 77 196 84" fill="none" stroke="#000" stroke-opacity=".22" stroke-width="1.6"/>'
    + `<g transform="translate(110 64) scale(.9) translate(-100 -122)">${MOTIFS[cs.motif](o)}</g>`
    + `<path d="${strapL}" fill="url(#tv)"/><path d="${strapR}" fill="url(#tv)"/>`
    + '<path d="M24 76Q24 54 38 44L46 56Q38 62 38 76ZM196 76Q196 54 182 44L174 56Q182 62 182 76Z" fill="url(#tm)"/>'
    + [[63, 56], [63, 78], [157, 56], [157, 78]].map((r) => `<circle cx="${r[0]}" cy="${r[1]}" r="2.3" fill="#1a1216" fill-opacity=".75"/><circle cx="${r[0] - 0.7}" cy="${r[1] - 0.7}" r=".9" fill="#fff" fill-opacity=".7"/>`).join('')
    + body + sparkle([[26, 40, 8], [198, 32, 6], [204, 124, 4]]) + '</svg>';
}

/* compact data: URL (single quotes inside, so it sits in a double-quoted attribute) */
function svgUrl(svg) {
  return 'data:image/svg+xml,' + svg.replace(/"/g, "'").replace(/[<>#%]/g, (ch) => '%' + ch.charCodeAt(0).toString(16).toUpperCase());
}
const artCache = {};
function art(it) { return artCache[it.id] || (artCache[it.id] = svgUrl(weaponSvg(it))); }
function chestArt(cs, open) {
  const key = (open ? 'open-' : 'case-') + cs.id;
  return artCache[key] || (artCache[key] = svgUrl(chestSvg(cs, open)));
}
