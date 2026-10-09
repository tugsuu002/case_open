/* Тоглоомын төлөв, хадгалалт, дүрэм */
'use strict';

/* ---------- state ---------- */
const START_BAL = 20000;
const INV_MAX = 1000;
const HIST_MAX = 150;
const LS_KEY = 'avdar.save.1';
const TOP_MIN = 1000, TOP_MAX = 10000000, BAL_MAX = 1e12;
const UP_EDGE = 0.92, UP_CAP = 0.90, UP_STEP = 1.1, UP_PICKS = 10;
const DAY_MS = 86400000;
const BT_ROUNDS = 6, BT_BOTS = 3;

/* inv rows: [serial, itemId, wear 0..9999]
   hist rows: [unix seconds, 'o' | 'u', caseId, itemId, wear, roll 0..999999, a, b]
     'o' = opened a case (a = price paid);  'u' = upgrade (a = 1 won / 0 lost, b = chance in 1/10000)
     'b' = battle (itemId = your best drop, roll = entry paid, a = 1 won / 0 lost, b = value of all drops)
   dl: when the free daily case was last opened (ms) */
function fresh() {
  return {
    v: 1, t: 0, bal: START_BAL, seq: 1, dl: 0, inv: [], hist: [],
    st: { o: 0, sp: 0, won: 0, sold: 0, sv: 0, top: 0, ut: 0, uw: 0, ui: 0, uo: 0, bt: 0, bw: 0, bs: 0, bv: 0, best: null, tc: [0, 0, 0, 0, 0, 0] },
    set: { mute: false, fast: false, qty: 1 },
  };
}
let S = fresh();
let bootT = 0;

function toInt(x, dflt, max) {
  x = Number(x);
  return Number.isFinite(x) ? Math.min(max, Math.max(0, Math.floor(x))) : dflt;
}

/* stored form: flat strings instead of nested arrays, so any JSON document store accepts it */
function pack(s) {
  return {
    v: 1, t: s.t, bal: s.bal, seq: s.seq, dl: s.dl,
    inv: s.inv.map((e) => e.join('|')),
    hist: s.hist.map((h) => h.join('|')),
    st: {
      o: s.st.o, sp: s.st.sp, won: s.st.won, sold: s.st.sold, sv: s.st.sv, top: s.st.top,
      ut: s.st.ut, uw: s.st.uw, ui: s.st.ui, uo: s.st.uo, bt: s.st.bt, bw: s.st.bw, bs: s.st.bs, bv: s.st.bv,
      best: s.st.best ? s.st.best.join('|') : '', tc: s.st.tc.slice(),
    },
    set: { mute: s.set.mute, fast: s.set.fast, qty: s.set.qty },
  };
}
function unpack(o) {
  if (!o || typeof o !== 'object' || o.v !== 1) return null;
  const s = fresh();
  const BIG = 9e15;
  s.t = toInt(o.t, 0, BIG);
  s.bal = toInt(o.bal, START_BAL, BAL_MAX);
  s.dl = toInt(o.dl, 0, BIG);
  let top = 0;
  if (Array.isArray(o.inv)) {
    o.inv.forEach((row) => {
      if (typeof row !== 'string' || s.inv.length >= INV_MAX) return;
      const p = row.split('|');
      const seq = toInt(p[0], 0, BIG);
      if (!seq || !ITEMS[p[1]]) return;
      s.inv.push([seq, p[1], toInt(p[2], 5000, 9999)]);
      if (seq > top) top = seq;
    });
  }
  s.seq = Math.max(toInt(o.seq, 1, BIG), top + 1, 1);
  if (Array.isArray(o.hist)) {
    o.hist.slice(0, HIST_MAX).forEach((row) => {
      if (typeof row !== 'string') return;
      const p = row.split('|');
      if ((p[1] !== 'o' && p[1] !== 'u' && p[1] !== 'b') || !ITEMS[p[3]]) return;
      s.hist.push([toInt(p[0], 0, BIG), p[1], CASE_BY[p[2]] ? p[2] : '', p[3], toInt(p[4], 5000, 9999), toInt(p[5], 0, 999999), toInt(p[6], 0, BIG), toInt(p[7], 0, BIG)]);
    });
  }
  const st = o.st && typeof o.st === 'object' ? o.st : {};
  ['o', 'sp', 'won', 'sold', 'sv', 'top', 'ut', 'uw', 'ui', 'uo', 'bt', 'bw', 'bs', 'bv'].forEach((k) => { s.st[k] = toInt(st[k], 0, BIG); });
  if (typeof st.best === 'string' && st.best) {
    const p = st.best.split('|');
    if (ITEMS[p[0]]) s.st.best = [p[0], toInt(p[1], 5000, 9999), toInt(p[2], 0, BIG)];
  }
  if (Array.isArray(st.tc)) s.st.tc = s.st.tc.map((_, i) => toInt(st.tc[i], 0, BIG));
  const set = o.set && typeof o.set === 'object' ? o.set : {};
  s.set.mute = !!set.mute;
  s.set.fast = !!set.fast;
  s.set.qty = Math.min(5, Math.max(1, toInt(set.qty, 1, 5)));
  return s;
}

/* ---------- saving: this browser first, the account store when the viewer offers one ---------- */
function lsLoad() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? unpack(JSON.parse(raw)) : null;
  } catch (e) { return null; }
}
function lsSave() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(pack(S))); } catch (e) { /* blocked or private storage: keep playing */ }
}

const cloud = { ref: null, mode: 'wait', writing: false, dirty: false, timer: 0, retried: false, wait: 0, onMode: null };
function setCloud(mode) {
  if (cloud.mode === mode) return;
  cloud.mode = mode;
  if (cloud.onMode) cloud.onMode(mode);
}
function queueFlush(ms) {
  clearTimeout(cloud.timer);
  cloud.timer = setTimeout(flush, ms);
}
/* one write at a time, only after a real change, bursts folded into one */
function flush() {
  if (!cloud.ref || cloud.writing || !cloud.dirty) return;
  cloud.writing = true;
  cloud.dirty = false;
  clearTimeout(cloud.timer);
  let write;
  try { write = cloud.ref.set(pack(S)); } catch (e) { write = Promise.reject(e); }
  write.then(() => {
    cloud.retried = false;
    setCloud('on');
  }, (e) => {
    const code = e && e.code;
    if (code === 'quota_exceeded') { cloud.ref = null; setCloud('full'); return; }
    if (code === 'resource_exhausted') { cloud.dirty = true; cloud.wait = 30000; return; }
    if (code === 'invalid_argument' || code === 'transform_error' || code === 'revoked' || code === 'not_granted'
      || code === 'capability_disabled' || code === 'capability_removed') { cloud.ref = null; setCloud('local'); return; }
    /* unavailable or unknown: one retry after a short random pause, then wait for the next change */
    if (!cloud.retried) { cloud.retried = true; cloud.dirty = true; cloud.wait = 1500 + Math.random() * 2500; } else { cloud.retried = false; }
  }).then(() => {
    cloud.writing = false;
    if (cloud.dirty && cloud.ref) queueFlush(cloud.wait || 1200);
    cloud.wait = 0;
  });
}
function saveSoft() {
  lsSave();
  if (cloud.ref) { cloud.dirty = true; queueFlush(1200); }
}
/* every change to the game itself goes through here */
function stamp() {
  S.t = Math.max(Date.now(), S.t + 1);
  saveSoft();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function initCloud(onAdopt) {
  const c = window.claude;
  if (!c || typeof c.use !== 'function') { setCloud('local'); return; }
  let db = null, user = null;
  try {
    const got = await Promise.all([c.use('db'), c.use('user')]);
    db = got[0]; user = got[1];
  } catch (e) { /* same as absent */ }
  if (!db || !user) { setCloud('local'); return; }
  let uid = null;
  try { uid = await user.id(); } catch (e) { uid = null; }
  if (!uid) { setCloud('local'); return; }
  let ref = null, snap = null;
  try {
    ref = db.doc('data/users/' + uid + '/save');
    try { snap = await ref.get(); } catch (e) {
      if (e && e.code && e.code !== 'unavailable') throw e;
      await sleep(500 + Math.random() * 900);
      snap = await ref.get();
    }
  } catch (e) { setCloud('local'); return; }
  cloud.ref = ref;
  const remote = snap && snap.exists ? unpack(snap.data()) : null;
  if (remote && S.t === bootT && remote.t > S.t) {
    S = remote;
    lsSave();
    setCloud('on');
    onAdopt();
    return;
  }
  setCloud('on');
  if (S.t > 0 && (!remote || remote.t < S.t)) { cloud.dirty = true; queueFlush(400); }
}

/* ---------- rules ---------- */
function rnd() {
  const u = new Uint32Array(2);
  crypto.getRandomValues(u);
  return (u[0] * 2097152 + (u[1] >>> 11)) / 9007199254740992;
}
const nowSec = () => Math.floor(Date.now() / 1000);
function invValue() {
  let v = 0;
  S.inv.forEach((e) => { v += priceOf(e[1], e[2]); });
  return v;
}
function trimHist() { if (S.hist.length > HIST_MAX) S.hist.length = HIST_MAX; }

/* time left until the free daily case can be opened again */
function dailyLeft() {
  return Math.min(DAY_MS, Math.max(0, S.dl + DAY_MS - Date.now()));
}
function openCases(cs, qty) {
  if (cs.free) {
    if (dailyLeft() > 0) return { err: 'wait' };
    qty = 1;
  }
  const cost = cs.p * qty;
  if (S.bal < cost) return { err: 'funds', need: cost - S.bal };
  if (S.inv.length + qty > INV_MAX) return { err: 'full' };
  const now = nowSec(), drops = [];
  S.bal -= cost;
  S.st.o += qty;
  S.st.sp += cost;
  if (cs.free) S.dl = Date.now();
  for (let i = 0; i < qty; i++) {
    const r = rnd();
    const it = pickFrom(cs.table, r);
    const w = Math.floor(rnd() * 10000);
    const seq = S.seq++;
    const val = priceOf(it.id, w);
    S.inv.push([seq, it.id, w]);
    S.st.won += val;
    S.st.tc[it.tier]++;
    if (!S.st.best || val > priceOf(S.st.best[0], S.st.best[1])) S.st.best = [it.id, w, now];
    S.hist.unshift([now, 'o', cs.id, it.id, w, Math.floor(r * 1e6), cs.p, 0]);
    drops.push({ seq, it, w, val });
  }
  trimHist();
  stamp();
  return { drops, cost };
}
function sellItems(seqs) {
  const set = new Set(seqs);
  let sum = 0, n = 0;
  S.inv = S.inv.filter((e) => {
    if (!set.has(e[0])) return true;
    sum += priceOf(e[1], e[2]);
    n++;
    return false;
  });
  if (!n) return 0;
  S.bal = Math.min(BAL_MAX, S.bal + sum);
  S.st.sold += n;
  S.st.sv += sum;
  stamp();
  return sum;
}
function topUp(a) {
  S.bal += a;
  S.st.top += a;
  stamp();
}
function upChance(v, target) {
  return v > 0 && target >= v * UP_STEP ? Math.min(UP_CAP, UP_EDGE * v / target) : 0;
}
function upgrade(seqs, targetId) {
  const set = new Set(seqs), tgt = ITEMS[targetId];
  let v = 0;
  S.inv.forEach((e) => { if (set.has(e[0])) v += priceOf(e[1], e[2]); });
  const p = tgt ? upChance(v, tgt.base) : 0;
  if (!p) return null;
  const r = rnd(), win = r < p;
  S.inv = S.inv.filter((e) => !set.has(e[0]));
  if (win) {
    S.inv.push([S.seq++, tgt.id, 5000]);
    S.st.uw++;
    S.st.uo += tgt.base;
  }
  S.st.ut++;
  S.st.ui += v;
  S.hist.unshift([nowSec(), 'u', '', tgt.id, 5000, Math.floor(r * 1e6), win ? 1 : 0, Math.round(p * 10000)]);
  trimHist();
  stamp();
  return { win, r, p, v, tgt };
}
/* A battle: every player opens the same cases, and the highest total (the lowest, in reverse mode) takes every drop.
   All of it is rolled and saved here, before the reels turn, so leaving half-way changes nothing. Player 0 is you. */
function battleStart(caseIds, bots, low) {
  const list = caseIds.map((id) => CASE_BY[id]).filter((c) => c && !c.free).slice(0, BT_ROUNDS);
  if (!list.length) return { err: 'empty' };
  const players = Math.min(BT_BOTS, Math.max(1, Math.floor(bots) || 1)) + 1;
  const cost = list.reduce((a, c) => a + c.p, 0);
  if (S.bal < cost) return { err: 'funds', need: cost - S.bal };
  if (S.inv.length + list.length * players > INV_MAX) return { err: 'full' };
  const totals = [];
  for (let p = 0; p < players; p++) totals.push(0);
  const rounds = list.map((cs) => totals.map((t, p) => {
    const it = pickFrom(cs.table, rnd()), w = Math.floor(rnd() * 10000), val = priceOf(it.id, w);
    totals[p] += val;
    return { it, w, val };
  }));
  const mark = low ? Math.min.apply(null, totals) : Math.max.apply(null, totals);
  const tied = [];
  totals.forEach((t, p) => { if (t === mark) tied.push(p); });
  const winner = tied[Math.floor(rnd() * tied.length)];   /* equal totals are settled by a draw */
  const pot = totals.reduce((a, b) => a + b, 0);
  S.bal -= cost;
  S.st.bt++;
  S.st.bs += cost;
  const seqs = [];
  if (winner === 0) {
    rounds.forEach((row) => row.forEach((d) => { seqs.push(S.seq); S.inv.push([S.seq++, d.it.id, d.w]); }));
    S.st.bw++;
    S.st.bv += pot;
  }
  let best = rounds[0][0];
  rounds.forEach((row) => { if (row[0].val > best.val) best = row[0]; });
  S.hist.unshift([nowSec(), 'b', list[0].id, best.it.id, best.w, Math.min(999999, cost), winner === 0 ? 1 : 0, pot]);
  trimHist();
  stamp();
  return { cases: list.map((c) => c.id), rounds, totals, winner, tied: tied.length > 1, cost, pot, players, low: !!low, seqs };
}
function resetAll() {
  const set = S.set;
  S = fresh();
  S.set = set;
  stamp();
}
