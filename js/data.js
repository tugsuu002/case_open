/* Авдар, эд зүйл, магадлал, үнэ */
'use strict';

/* ---------- game data ---------- */
const TIERS = ['Ган', 'Зэс', 'Оюу', 'Номин', 'Шүр', 'Алт'];

/* condition grades: upper bound of the wear roll, short label, price multiplier */
const GRADES = [
  { n: 'Цоо шинэ', max: 0.10, m: 1.40 },
  { n: 'Шинэвтэр', max: 0.30, m: 1.15 },
  { n: 'Хэрэглэсэн', max: 0.70, m: 1.00 },
  { n: 'Элэгдсэн', max: 0.90, m: 0.88 },
  { n: 'Хуучирсан', max: 1.00, m: 0.78 },
];

const TYPES = {
  pi: 'Гар буу', rv: 'Револьвер', sm: 'Богино автомат', ri: 'Автомат', sn: 'Мэргэн буу',
  sg: 'Үрлэн буу', kn: 'Хутга', sb: 'Илд', bw: 'Нум', sp: 'Жад',
  ps: 'Чимээгүй гар буу', mp: 'Жижиг автомат', bp: 'Буллпап автомат', ca: 'Карабин', lm: 'Пулемёт',
};

/* every paid case has 12 slots: 3 Ган, 3 Зэс, 2 Оюу, 2 Номин, 1 Шүр, 1 Алт */
const SLOT_TIER = [0, 0, 0, 1, 1, 1, 2, 2, 3, 3, 4, 5];

/* mult: price of each slot as a multiple of the case price.
   back: the share of the case price that comes back over many openings; each item's odds follow from it (see solveOdds) */
const PROFILES = {
  std: { tag: '', back: 0.90, mult: [0.45, 0.55, 0.7, 0.9, 1.2, 1.8, 3, 6, 15, 40, 120, 400] },
  calm: { tag: 'Тогтуун', back: 0.90, mult: [0.55, 0.65, 0.75, 0.9, 1.1, 1.5, 2.2, 4, 8, 20, 50, 150] },
  risk: { tag: 'Эрсдэлтэй', back: 0.90, mult: [0.2, 0.3, 0.45, 0.65, 1, 1.8, 3.5, 8, 25, 80, 300, 1000] },
  rich: { tag: 'Өгөөмөр', back: 0.93, mult: [0.5, 0.6, 0.75, 0.95, 1.3, 2, 3.5, 7, 16, 40, 100, 300] },
};

/* col: chest paint, fittings, ornament, glow.  item: type, name, main colour, second colour, graphic colour, graphic (see GFX in art.js) */
const CASE_DATA = [
  { id: 'a', n: 'Хээр тал', p: 500, prof: 'std', motif: 'wave', col: ['#3f7d46', '#d9b25a', '#f1e6b8', '#5fae62'],
    d: 'Салхи, агь, өвсний үнэр. Эхлэхэд тохирсон хамгийн хямд авдар.',
    items: [
      ['pi', 'Агь', '#8a9a72', '#4f5c43', '#c9d6b0', 'two'],
      ['sg', 'Хялгана', '#c9bd82', '#7d7448', '#f3ecc0', 'reed'],
      ['sm', 'Тоос', '#a89c86', '#6b6253', '#4a4338', 'camo'],
      ['ri', 'Тал салхи', '#6fb45a', '#2f6b3a', '#d8f2a8', 'wave'],
      ['rv', 'Хээр морь', '#a05a2c', '#5a2f18', '#f0b070', 'two'],
      ['sn', 'Өвсөн далай', '#3fa56a', '#14553f', '#a8f0b8', 'reed'],
      ['ps', 'Болжмор', '#d9aa48', '#7a5522', '#fff0c0', 'scale'],
      ['ca', 'Зэрэглээ', '#ffc66a', '#e0603a', '#fff3d0', 'haze'],
      ['sn', 'Үдшийн тал', '#ff7a3c', '#5b2a8e', '#ffd85c', 'sun'],
      ['mp', 'Хулан', '#e0aa62', '#8a5a2e', '#3a2414', 'tiger'],
      ['kn', 'Аянга', '#2b3a7a', '#0e1640', '#ffe45c', 'bolt'],
      ['bw', 'Талын эзэн', '#2f9a52', '#e0b040', '#fff2b0', 'ornament'],
    ] },
  { id: 'b', n: 'Говийн шуурга', p: 1500, prof: 'calm', motif: 'sun', col: ['#c9703a', '#ecc76a', '#fff0c9', '#e58a4a'],
    d: 'Элсэн манхан, улаан хад, заг. Үнийн зөрүү багатай авдар.',
    items: [
      ['pi', 'Элс', '#dcc096', '#a88a5e', '#f6e6c8', 'wave'],
      ['mp', 'Заг', '#94825e', '#5c4f3a', '#3d3324', 'camo'],
      ['sg', 'Хайрга', '#a39a90', '#6a625a', '#ddd5ca', 'dots'],
      ['bp', 'Манхан', '#eab672', '#b07a3c', '#fff0c8', 'wave'],
      ['rv', 'Ботго', '#d0a068', '#8a6238', '#f8e4c4', 'two'],
      ['sn', 'Халуун салхи', '#f08a3c', '#b8402a', '#ffe0a0', 'stripe'],
      ['lm', 'Улаан хад', '#e0603a', '#7a1f14', '#ffc08a', 'mount'],
      ['ps', 'Баянбүрд', '#e8c88a', '#c09a58', '#2fb59a', 'drip'],
      ['sn', 'Шуурга', '#c98a40', '#4a2e1a', '#ffe6b0', 'cloud'],
      ['sg', 'Үлэг гүрвэл', '#5fa04e', '#24481f', '#e0f5a0', 'scale'],
      ['kn', 'Хилэнцэт', '#2a1c12', '#8a4a1a', '#ff9a3c', 'shard'],
      ['sp', 'Говийн нар', '#ffb02e', '#e0452a', '#fff3b0', 'rays'],
    ] },
  { id: 'c', n: 'Дөрвөн бэрх', p: 3000, prof: 'risk', motif: 'bone', col: ['#8f1f2e', '#e8dcc0', '#ffd27a', '#d0354a'],
    d: 'Шагай хаяхтай адил. Ихэнхдээ бага унана, буувал их унана.',
    items: [
      ['pi', 'Ямаа', '#beb7ab', '#8a8378', '#efe9dc', 'dots'],
      ['sm', 'Хонь', '#ece6d6', '#b8b0a0', '#ffffff', 'cloud'],
      ['sg', 'Шагай', '#dccfb0', '#a09070', '#7d6c4c', 'grid'],
      ['rv', 'Тэмээ', '#c9a060', '#8a6a3a', '#f4dcae', 'wave'],
      ['ca', 'Морь', '#8f4426', '#3a1a10', '#1e0e08', 'tiger'],
      ['ps', 'Няслах', '#e0cfa6', '#8f1f2e', '#fff3d6', 'two'],
      ['sn', 'Уралдаан', '#2a78d0', '#12357a', '#ffe45c', 'stripe'],
      ['bp', 'Алаг мэлхий', '#2fa56e', '#c8452a', '#ffe680', 'shard'],
      ['rv', 'Хийморь', '#2a5fd0', '#f4f4f4', '#ffd040', 'rainbow'],
      ['sn', 'Бэрх', '#a01f30', '#2a0a10', '#ffd27a', 'ornament'],
      ['kn', 'Мөрий', '#30303a', '#8f1f2e', '#ffd27a', 'chevron'],
      ['sb', 'Дөрвөн бэрх', '#f0e6d0', '#c8a25a', '#a01f30', 'ornament'],
    ] },
  { id: 'd', n: 'Хөх тэнгэр', p: 5000, prof: 'std', motif: 'cloud', col: ['#2f6fd0', '#dfe8f4', '#ffd866', '#4a90f0'],
    d: 'Үүл, бороо, солонго, бүргэд. Тэнгэрийн өнгөтэй авдар.',
    items: [
      ['pi', 'Үүл', '#cfdbe8', '#93a4b8', '#ffffff', 'cloud'],
      ['mp', 'Шиврээ', '#8fa6bd', '#56697e', '#d6e8f8', 'rain'],
      ['sg', 'Манан', '#b8c0c8', '#7c858e', '#eef3f6', 'two'],
      ['ca', 'Цэлмэг', '#6ab8ff', '#2a6fd0', '#e0f4ff', 'haze'],
      ['rv', 'Хур бороо', '#4f80b4', '#24446c', '#b0d8f8', 'rain'],
      ['sn', 'Салхи', '#7cc6ee', '#347cb6', '#ffffff', 'wave'],
      ['lm', 'Бүргэд', '#7a5530', '#2a1a0a', '#f0c060', 'scale'],
      ['ps', 'Солонго', '#f4f6fa', '#b8c4d4', '#ff5a7d', 'rainbow'],
      ['sn', 'Аадар', '#2a3a7a', '#0c1430', '#9ac4ff', 'bolt'],
      ['sm', 'Үүрийн гэгээ', '#ff9a6a', '#6a4ad0', '#ffe8a0', 'sun'],
      ['kn', 'Тэнгэрийн хаяа', '#3a8af0', '#ff8a4a', '#fff0d0', 'haze'],
      ['bw', 'Мөнх тэнгэр', '#2a6fe0', '#f0f6ff', '#ffd866', 'cloud'],
    ] },
  { id: 'e', n: 'Цасан ирвэс', p: 10000, prof: 'calm', motif: 'peak', col: ['#6fa6ba', '#f4f8fa', '#17323f', '#9fd4e6'],
    d: 'Алтайн оргил, мөс, хяруу. Үнийн зөрүү багатай авдар.',
    items: [
      ['pi', 'Хяруу', '#e4edf3', '#a8b8c4', '#ffffff', 'shard'],
      ['mp', 'Цас', '#f6f9fb', '#c0ccd4', '#ffffff', 'dots'],
      ['sg', 'Мөс', '#bce6f6', '#6fa8c2', '#ffffff', 'shard'],
      ['bp', 'Алтайн оргил', '#8fa8c4', '#33455e', '#ffffff', 'mount'],
      ['rv', 'Аргаль', '#c0a07a', '#6a543c', '#f4e4cc', 'scale'],
      ['sn', 'Цасан шуурга', '#eef4f8', '#8a9aa8', '#ffffff', 'wave'],
      ['ca', 'Мөсөн гол', '#5ad8ea', '#147a9a', '#e4ffff', 'wave'],
      ['ps', 'Янгир', '#a8947c', '#4a4038', '#2e2620', 'tiger'],
      ['sn', 'Ирвэсийн мөр', '#efeae0', '#b0a898', '#26262a', 'leopard'],
      ['sg', 'Хойд гэрэл', '#16204a', '#0a102c', '#3af0b0', 'aurora'],
      ['kn', 'Мөсөн соёо', '#c8f4ff', '#4aa8d8', '#ffffff', 'shard'],
      ['sb', 'Цасан ирвэс', '#f6f2ea', '#c8c0b0', '#1c1c20', 'leopard'],
    ] },
  { id: 'f', n: 'Есөн эрдэнэ', p: 25000, prof: 'std', motif: 'gem', col: ['#5a2a8a', '#f0c040', '#3ae0c0', '#9a5ae0'],
    d: 'Алт, мөнгө, шүр, сувд, оюу, номин. Есөн эрдэнийн өнгөтэй авдар.',
    items: [
      ['pi', 'Хар ган', '#3e444e', '#181c22', '#8a94a2', 'carbon'],
      ['sm', 'Зэс утас', '#3a2a22', '#1c1210', '#ff9a52', 'circuit'],
      ['sg', 'Гууль', '#e0b84e', '#8a6a1a', '#fff2b0', 'two'],
      ['lm', 'Мөнгөн хээ', '#d8dce4', '#8a909c', '#5a6272', 'ornament'],
      ['rv', 'Хүрэл', '#b47c3c', '#5a3a1a', '#f0c890', 'scale'],
      ['sn', 'Тана', '#f4ecf6', '#b8a8cc', '#ffffff', 'wave'],
      ['bp', 'Оюу', '#2ad0b8', '#0a7a78', '#0a4a50', 'vein'],
      ['ps', 'Сувд', '#fbf4ec', '#d6c4cc', '#ffffff', 'dots'],
      ['sn', 'Номин', '#2848d8', '#0a1870', '#ffd24a', 'galaxy'],
      ['rv', 'Шүр', '#ff5a48', '#b0182a', '#ffd0c0', 'vein'],
      ['kn', 'Очир', '#eefaff', '#8ad0f0', '#ffffff', 'shard'],
      ['sp', 'Есөн эрдэнэ', '#f0c040', '#d0452a', '#2ac8b0', 'shard'],
    ] },
  { id: 'g', n: 'Их хаадын сан', p: 50000, prof: 'rich', motif: 'seal', col: ['#a81f1f', '#f0c040', '#ffe9a0', '#e0453a'],
    d: 'Гэрэгэ, тамга, сүлд. Дээд зэрэглэл арай олон унадаг авдар.',
    items: [
      ['pi', 'Өртөө', '#927f5c', '#5a4e38', '#d0c098', 'stripe'],
      ['mp', 'Тамга', '#b03a2a', '#5a1a10', '#f4d0a8', 'ornament'],
      ['sg', 'Хуяг', '#737c88', '#3a4048', '#c0c8d4', 'scale'],
      ['ca', 'Гэрэгэ', '#d4b24e', '#7a5f1a', '#fff4b8', 'ornament'],
      ['rv', 'Хар сүлд', '#40404a', '#141418', '#9a9aa6', 'reed'],
      ['sn', 'Хархорум', '#c0a880', '#6a583a', '#4a3c26', 'grid'],
      ['lm', 'Цагаан сүлд', '#f4f0e4', '#b8b0a0', '#c8a84a', 'reed'],
      ['pi', 'Хишигтэн', '#1c3e9a', '#0a1a48', '#f0c040', 'chevron'],
      ['sn', 'Алтан ураг', '#f0c040', '#a81f1f', '#fff4b8', 'ornament'],
      ['sg', 'Их засаг', '#5a1a1a', '#1a0808', '#f0c040', 'ornament'],
      ['kn', 'Хааны тамга', '#b01f1f', '#f0c040', '#fff0b0', 'ornament'],
      ['sb', 'Их хаан', '#f6c63c', '#b81f1f', '#fff6d0', 'flame'],
    ] },
  { id: 'h', n: 'Алтан гадас', p: 100000, prof: 'std', motif: 'star', col: ['#1d2670', '#f0c040', '#ffffff', '#f0c040'],
    d: 'Шөнийн тэнгэрийн одод. Хамгийн үнэтэй авдар.',
    items: [
      ['pi', 'Харанхуй шөнө', '#262b5a', '#0c0e22', '#aab4ff', 'stars'],
      ['mp', 'Сүүлт од', '#27386e', '#0e1632', '#a8dcff', 'comet'],
      ['sg', 'Саран гэрэл', '#2a3260', '#10142e', '#f0f0e0', 'moon'],
      ['bp', 'Мичид', '#2a2a78', '#0c0c30', '#c0ccff', 'stars'],
      ['rv', 'Үүрийн цолмон', '#ff9a8a', '#3a3a9a', '#fff0c0', 'sun'],
      ['sn', 'Долоон бурхан', '#1a2a64', '#080e28', '#ffe680', 'constellation'],
      ['ca', 'Тэнгэрийн заадас', '#3a2a8a', '#0c1648', '#e8d8ff', 'galaxy'],
      ['ps', 'Хиртэлт', '#1c1c22', '#0a0a0e', '#ff8a2a', 'eclipse'],
      ['sn', 'Сансар', '#6a2ae0', '#0a1a6a', '#ff7ad8', 'galaxy'],
      ['sm', 'Одны бороо', '#1a1a56', '#2a6ac0', '#ffffff', 'comet'],
      ['kn', 'Сарны хэлтэрхий', '#e4ecff', '#8a9ad6', '#ffffff', 'shard'],
      ['bw', 'Алтан гадас', '#f4c63c', '#1a2a84', '#ffffff', 'constellation'],
    ] },
];

/* The free daily case. own: its six cheap items (same columns as above, plus a price).
   mix: valuable items borrowed from the paid cases. Odds are in units of 0.001%.
   The twelve mixed odds are the ones a real site's daily case showed for its first twelve items;
   the six cheap ones share out the remaining 98.084%. */
const DAILY_DATA = {
  id: 'z', n: 'Өдрийн авдар', motif: 'knot', col: ['#1f8a8a', '#f0c040', '#fff3c4', '#3fd0c0'],
  d: 'Өдөрт нэг удаа үнэгүй нээнэ. Ихэнхдээ хямд эд зүйл унана, үнэтэй нь зуун мянгад нэг удаа.',
  own: [
    ['pi', 'Шороо', '#8a7f6e', '#5e564a', '#b3a892', 'two', 10, 40000],
    ['sg', 'Зэв', '#9a6040', '#5a3a26', '#d49a66', 'dots', 20, 30000],
    ['sm', 'Утаа', '#868c94', '#4c5056', '#bcc2ca', 'cloud', 30, 15000],
    ['rv', 'Үнс', '#a2a29e', '#63635f', '#d6d6d0', 'grid', 50, 8000],
    ['ri', 'Шавар', '#a67c5c', '#6b4e3a', '#4a3426', 'camo', 80, 3184],
    ['sn', 'Сүүдэр', '#4f5564', '#2a2d36', '#8a93ac', 'stripe', 120, 1900],
  ],
  mix: [['a0', 730], ['a1', 729], ['a2', 430], ['b7', 7], ['a8', 7], ['b8', 4], ['a9', 3], ['b9', 2], ['a10', 1], ['b10', 1], ['a11', 1], ['b11', 1]],
};

/* round a price to a tidy figure */
function nice(x) {
  const s = x < 1000 ? 10 : x < 10000 ? 50 : x < 100000 ? 100 : x < 1000000 ? 1000 : 10000;
  return Math.max(10, Math.round(x / s) * s);
}
/* what an item is worth on average, over the five condition grades */
function avgValue(base) {
  let lo = 0, v = 0;
  GRADES.forEach((g) => { v += (g.max - lo) * nice(base * g.m); lo = g.max; });
  return v;
}

const UNIT = 100000;   /* odds are whole units of 0.001%, so what a card shows is exactly what is rolled */

/* Odds fall with price: weight = price^-a. The exponent a is found so that the average drop is back x case price. */
function solveOdds(bases, price, back) {
  const avg = bases.map(avgValue);
  const ret = (a) => {
    let sw = 0, sv = 0;
    bases.forEach((b, i) => { const w = Math.pow(b / price, -a); sw += w; sv += w * avg[i]; });
    return sv / sw / price;
  };
  let lo = 0, hi = 6;
  for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (ret(mid) > back) lo = mid; else hi = mid; }
  const a = (lo + hi) / 2;
  let sw = 0;
  const w = bases.map((b) => { const x = Math.pow(b / price, -a); sw += x; return x; });
  /* to whole units: two decimals of a percent from 1% up, three below; the rounding remainder goes to the commonest item */
  const u = w.map((x) => { let n = Math.round(x / sw * UNIT); if (n >= 1000) n = Math.round(n / 10) * 10; return Math.max(1, n); });
  let rest = UNIT - u.reduce((x, y) => x + y, 0);
  const big = u.indexOf(Math.max.apply(null, u));
  let small = -1;
  u.forEach((n, i) => { if (n < 1000 && (small < 0 || n > u[small])) small = i; });
  const fine = ((rest % 10) + 10) % 10;
  if (fine && small >= 0) { u[small] += fine; rest -= fine; }
  u[big] += rest;
  return u;
}

const ITEMS = {};
function addItem(id, cs, row, tier, base) {
  ITEMS[id] = { id, cs, t: row[0], n: row[1], tier, base, c: [row[2], row[3], row[4]], k: row[5] };
  return ITEMS[id];
}
/* entries: [{ it, u }] with u in units of 0.001%.  table: most valuable first, so a low roll is a rare drop.
   fill: the same items with flattened odds, for the cards that only pass by on the reel */
function finishCase(cs, entries) {
  entries.sort((x, y) => y.it.base - x.it.base || x.u - y.u);
  let acc = 0;
  cs.entries = entries;
  cs.table = entries.map((e) => { acc += e.u; return { it: e.it, hi: acc }; });
  let fa = 0;
  cs.fill = entries.map((e) => { fa += Math.pow(e.u / UNIT, 0.55); return { it: e.it, hi: fa }; });
  cs.fill.forEach((f) => { f.hi = f.hi / fa * UNIT; });
  cs.top = entries[0].it;
  cs.ev = entries.reduce((v, e) => v + e.u / UNIT * avgValue(e.it.base), 0);
  return cs;
}
const CASES = CASE_DATA.map((c) => {
  const prof = PROFILES[c.prof];
  const items = c.items.map((r, i) => addItem(c.id + i, c.id, r, SLOT_TIER[i], nice(c.p * prof.mult[i])));
  const u = solveOdds(items.map((it) => it.base), c.p, prof.back);
  return finishCase({ id: c.id, n: c.n, p: c.p, d: c.d, col: c.col, motif: c.motif, tag: prof.tag, free: false }, items.map((it, i) => ({ it, u: u[i] })));
});
const DAILY = finishCase(
  { id: DAILY_DATA.id, n: DAILY_DATA.n, p: 0, d: DAILY_DATA.d, col: DAILY_DATA.col, motif: DAILY_DATA.motif, tag: 'Үнэгүй', free: true },
  DAILY_DATA.own.map((r, i) => ({ it: addItem(DAILY_DATA.id + i, DAILY_DATA.id, r, 0, r[6]), u: r[7] }))
    .concat(DAILY_DATA.mix.map((m) => ({ it: ITEMS[m[0]], u: m[1] })))
);
const CASE_BY = {};
CASES.concat([DAILY]).forEach((c) => { CASE_BY[c.id] = c; });

function gradeIdx(w) {
  const x = w / 10000;
  for (let i = 0; i < GRADES.length; i++) if (x < GRADES[i].max) return i;
  return GRADES.length - 1;
}
function priceOf(id, w) {
  const it = ITEMS[id];
  return it ? nice(it.base * GRADES[gradeIdx(w)].m) : 0;
}
/* r is a roll in [0, 1) */
function pickFrom(table, r) {
  const x = r * UNIT;
  for (let i = 0; i < table.length; i++) if (x < table[i].hi) return table[i].it;
  return table[table.length - 1].it;
}
