/* Дэлгэц, товч, эргэлтийн хөдөлгөөн, дуу */
'use strict';

/* ---------- ui ---------- */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const viewEl = $('#view');
const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const ALL_ITEMS = Object.keys(ITEMS).map((k) => ITEMS[k]).sort((a, b) => a.base - b.base);
const VIEWS = ['cases', 'case', 'inv', 'bt', 'up', 'log'];
const BOTS = ['Чоно', 'Бүргэд', 'Ирвэс'];
const ui = {
  view: 'cases', caseId: CASES[0].id, ready: false, known: false,
  busy: false, run: 0, skip: false, drops: null, dropsCost: 0,
  invTier: -1, invSort: 'new', invShow: 60, sel: new Set(),
  upSel: new Set(), upTarget: null, upLast: null,
  bt: { cases: [], bots: 1, low: false, live: null, shown: 0, done: false }, invShown: null,
};

function fmtN(n) {
  n = Math.round(n);
  const s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '−' : '') + s;
}
const CUR = '<span class="cur">₮</span>';
const money = (n) => fmtN(n) + CUR;
const plain = (n) => fmtN(n) + '₮';
/* odds are whole units of 0.001%, so three decimals show them exactly; pass d to round other percentages */
function pct(p, d) {
  return (p * 100).toFixed(d == null ? 3 : d).replace(/\.?0+$/, '') + '%';
}
function clock(ms) {
  const sec = Math.ceil(ms / 1000), z = (x) => String(x).padStart(2, '0');
  return z(Math.floor(sec / 3600)) + ':' + z(Math.floor(sec / 60) % 60) + ':' + z(sec % 60);
}
function dailyText() {
  const left = dailyLeft();
  return left ? 'Дараагийн боломж ' + clock(left) : 'Нээхэд бэлэн';
}
function fmtTime(sec) {
  const d = new Date(sec * 1000), z = (x) => String(x).padStart(2, '0');
  return z(d.getMonth() + 1) + '.' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
}

/* ---------- sound (starts only after a click) ---------- */
let audio = null, lastTick = 0;
function ac() {
  if (S.set.mute) return null;
  try {
    if (!audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audio = new Ctx();
    }
    if (audio.state === 'suspended') audio.resume();
    return audio;
  } catch (e) { return null; }
}
function tone(freq, dur, type, vol, at, slideTo) {
  const a = ac();
  if (!a) return;
  try {
    const t = a.currentTime + (at || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  } catch (e) { /* audio is optional */ }
}
function tick() {
  const n = performance.now();
  if (n - lastTick < 38) return;
  lastTick = n;
  tone(1150, 0.035, 'triangle', 0.05);
}
const sStop = () => tone(196, 0.1, 'sine', 0.09);
const sRumble = () => { tone(70, 0.5, 'sawtooth', 0.05, 0, 115); tone(92, 0.5, 'square', 0.02, 0.05, 150); };
const sChest = () => { tone(392, 0.25, 'triangle', 0.06); tone(587, 0.3, 'triangle', 0.05, 0.06); tone(880, 0.42, 'sine', 0.05, 0.12); };
const sCoin = () => { tone(880, 0.07, 'square', 0.03); tone(1320, 0.12, 'square', 0.03, 0.07); };
const sFail = () => tone(220, 0.4, 'sawtooth', 0.05, 0, 82);
const sClick = () => tone(520, 0.045, 'triangle', 0.04);
function sWin(tier) {
  const base = [330, 370, 440, 494, 587, 659][tier], steps = [1, 1.25, 1.5, 2, 2.5, 3];
  for (let i = 0; i < 2 + tier; i++) tone(base * steps[Math.min(i, 5)], 0.2 + tier * 0.05, tier >= 4 ? 'sawtooth' : 'triangle', tier >= 4 ? 0.045 : 0.06, i * 0.085);
}

/* ---------- small pieces ---------- */
function toast(msg, kind) {
  const box = $('#toasts'), t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : '');
  t.textContent = msg;
  box.appendChild(t);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => t.remove(), 3400);
}
function guard() {
  if (ui.ready) return true;
  toast('Хадгалсан явцыг ачаалж байна. Хэдхэн секунд хүлээгээд дахин дар.');
  return false;
}
function openDlg(d) {
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
}
function closeDlg(d, value) {
  if (typeof d.close === 'function') d.close(value || ''); else d.removeAttribute('open');
}
function ask(title, text, okLabel) {
  const d = $('#dlg-ask');
  $('#ask-t').textContent = title;
  $('#ask-p').textContent = text;
  $('#ask-ok').textContent = okLabel;
  return new Promise((resolve) => {
    const onClose = () => { d.removeEventListener('close', onClose); resolve(d.returnValue === 'ok'); };
    d.addEventListener('close', onClose);
    d.returnValue = '';
    openDlg(d);
  });
}
/* colours and widths that come from data are applied through the style object */
function paint(root) {
  $$('[data-cc]', root).forEach((el) => el.style.setProperty('--cc', el.dataset.cc));
  $$('[data-cols]', root).forEach((el) => el.style.setProperty('--n', el.dataset.cols));
  $$('[data-w]', root).forEach((el) => { el.style.width = el.dataset.w + '%'; });
}
function itemCard(it, o) {
  o = o || {};
  const hasW = o.w != null;
  const right = o.odds != null ? pct(o.odds, o.dec) : hasW ? GRADES[gradeIdx(o.w)].n : '';
  const lo = nice(it.base * 0.78), hi = nice(it.base * 1.4);
  const price = hasW ? money(priceOf(it.id, o.w)) : o.flat || lo === hi ? money(o.flat ? it.base : hi) : fmtN(lo) + '–' + money(hi);
  const inner = '<span class="it-top"><span class="it-tier">' + TIERS[it.tier] + '</span><span class="num">' + right + '</span></span>'
    + '<span class="it-art"><img src="' + art(it) + '" alt="" draggable="false"></span>'
    + '<span class="it-type">' + TYPES[it.t] + '</span><span class="it-name">' + it.n + '</span>'
    + '<span class="it-price num">' + price + '</span>' + (o.foot || '');
  if (o.act) return '<button type="button" class="it t' + it.tier + '" data-act="' + o.act + '" data-key="' + o.key + '" aria-pressed="' + (o.on ? 'true' : 'false') + '">' + inner + '</button>';
  return '<div class="it t' + it.tier + '">' + inner + '</div>';
}
const invRows = () => S.inv.map((e) => ({ seq: e[0], it: ITEMS[e[1]], w: e[2], val: priceOf(e[1], e[2]) }));
function prune(set) {
  const have = new Set(S.inv.map((e) => e[0]));
  set.forEach((k) => { if (!have.has(k)) set.delete(k); });
}
function sumOf(set) {
  let v = 0;
  S.inv.forEach((e) => { if (set.has(e[0])) v += priceOf(e[1], e[2]); });
  return v;
}

/* ---------- views ---------- */
function viewCases() {
  const recent = S.hist.filter((h) => h[1] === 'o').slice(0, 8);
  return '<section class="hero"><p class="eyebrow">Виртуал мөнгөөр тоглоно</p><h1>Авдраа сонгоод азаа үз</h1>'
    + '<p class="lede">Найман авдар, өдөр бүрийн үнэгүй авдар, зуу гаруй эд зүйл. Эд зүйл бүрийн магадлал, үнэ ил байгаа. Дансаа өөрөө цэнэглээд тоглоно, бодит мөнгө оролцохгүй.</p></section>'
    + '<section class="sec"><div class="daily" data-cc="' + DAILY.col[3] + '"><img src="' + chestArt(DAILY) + '" alt="">'
    + '<div class="daily-t"><h2>' + DAILY.n + '</h2><p>Өдөрт нэг удаа үнэгүй нээнэ. Ихэнхдээ хямд эд зүйл унана, үнэтэй нь маш ховор.</p></div>'
    + '<div class="daily-a"><p class="daily-s num" data-daily>' + dailyText() + '</p><button type="button" class="btn pri" data-act="case" data-id="' + DAILY.id + '">Авдрыг үзэх</button></div></div></section>'
    + (recent.length ? '<section class="sec"><div class="sec-h"><h2>Сүүлийн уналт</h2><span>Таны нээсэн авдраас</span></div><div class="recent">'
      + recent.map((h) => { const it = ITEMS[h[3]]; return '<div class="mini t' + it.tier + '"><img src="' + art(it) + '" alt=""><b>' + it.n + '</b><span class="num">' + money(priceOf(h[3], h[4])) + '</span></div>'; }).join('')
      + '</div></section>' : '')
    + '<section class="sec"><div class="sec-h"><h2>Авдрууд</h2><span>Хямдаас үнэтэй рүү</span></div><div class="cases">'
    + CASES.map((cs) => '<button type="button" class="ccard" data-act="case" data-id="' + cs.id + '" data-cc="' + cs.col[3] + '">'
      + (cs.tag ? '<span class="ccard-tag">' + cs.tag + '</span>' : '')
      + '<span class="chest"><img class="cl" src="' + chestArt(cs) + '" alt="" draggable="false"><img class="op" src="' + chestArt(cs, true) + '" alt="" draggable="false"></span><span class="ccard-n">' + cs.n + '</span>'
      + '<span class="ccard-row"><span class="ccard-p num">' + money(cs.p) + '</span><span class="ccard-top num">дээд тал нь ' + money(nice(cs.top.base * 1.4)) + '</span></span></button>').join('')
    + '</div></section>';
}

function idleHtml(cs) {
  return '<div class="idle"><img src="' + chestArt(cs) + '" alt=""><p>' + cs.entries.length + ' эд зүйлийн нэг нь унана</p></div>';
}
function viewCase() {
  const cs = CASE_BY[ui.caseId], back = cs.p ? cs.ev / cs.p * 100 : 0;
  return '<button type="button" class="back" data-act="nav" data-view="cases"><span aria-hidden="true">←</span> Бүх авдар</button>'
    + '<div class="case-h"><h1>' + cs.n + '</h1><p>' + cs.d + '</p></div>'
    + '<div class="stage" data-cc="' + cs.col[3] + '"><i class="br tl"></i><i class="br tr"></i><i class="br bl"></i><i class="br rb"></i><div class="stage-in" id="stage-in">' + idleHtml(cs) + '</div></div>'
    + '<div class="ctl">' + (cs.free ? '' : '<div class="qty" role="group" aria-label="Нэг дор нээх тоо">'
      + [1, 2, 3, 4, 5].map((n) => '<button type="button" data-act="qty" data-n="' + n + '" aria-pressed="false">' + n + '</button>').join('') + '</div>')
    + '<button type="button" class="switch" data-act="fast" aria-pressed="false"><i aria-hidden="true"></i>Хурдан нээх</button>'
    + '<button type="button" class="btn pri open-btn" id="open-btn" data-act="open"></button></div>'
    + '<div id="res" aria-live="polite"></div>'
    + '<section class="sec"><div class="sec-h"><h2>Авдрын агуулга</h2><span>' + (cs.free ? 'Нэг нээлтийн дундаж үнэ ' + plain(cs.ev) : 'Дундаж буцаалт ' + back.toFixed(1) + '%') + '</span></div>'
    + '<div class="items twelve">' + cs.entries.map((e) => itemCard(e.it, { odds: e.u / UNIT })).join('') + '</div>'
    + '<p class="note">' + (cs.free ? 'Үнэгүй авдрыг 24 цагт нэг удаа нээнэ. ' : '')
    + 'Нээх бүрд 0–100 хооронд санамсаргүй тоо унаж, дээрх магадлалаар эд зүйл сонгогдоно. Эд зүйл үнэтэй байх тусам унах магадлал нь бага. Чанар нь мөн санамсаргүй унах бөгөөд үнийг 22% хүртэл бууруулж, 40% хүртэл өсгөнө.'
    + (cs.free ? '' : ' Олон удаа нээхэд авдрын үнийн ' + back.toFixed(0) + ' орчим хувь нь эд зүйлийн үнээр буцаж ирдэг.') + '</p></section>';
}
function setCtl() {
  $$('.switch[data-act="fast"]').forEach((sw) => sw.setAttribute('aria-pressed', S.set.fast ? 'true' : 'false'));
  const go1 = $('#bt-go');
  if (go1) go1.disabled = !ui.ready || ui.busy || !ui.bt.cases.length;
  const b = $('#open-btn');
  if (!b) return;
  const cs = CASE_BY[ui.caseId];
  const left = cs.free ? dailyLeft() : 0;
  const label = !ui.ready ? 'Явцыг ачаалж байна…' : ui.busy ? 'Нээж байна…'
    : cs.free ? (left ? 'Дараагийн боломж ' + clock(left) : 'Үнэгүй нээх') : 'Нээх · ' + money(cs.p * S.set.qty);
  b.disabled = ui.busy || !ui.ready || left > 0;
  if (b.dataset.label !== label) { b.dataset.label = label; b.innerHTML = '<span class="num">' + label + '</span>'; }
  $$('.qty button').forEach((q) => {
    q.disabled = ui.busy;
    q.setAttribute('aria-pressed', Number(q.dataset.n) === S.set.qty ? 'true' : 'false');
  });
}
function renderRes(fresh) {
  const box = $('#res');
  if (!box) return;
  const d = ui.drops;
  if (!d) { box.innerHTML = ''; return; }
  const have = new Set(S.inv.map((e) => e[0]));
  const total = d.reduce((a, x) => a + x.val, 0), diff = total - ui.dropsCost;
  const left = d.filter((x) => have.has(x.seq)), leftSum = left.reduce((a, x) => a + x.val, 0);
  box.innerHTML = '<div class="res' + (fresh ? ' fresh' : '') + '"><div class="res-h"><h2>Таны уналт</h2><p class="num">Нийт ' + money(total)
    + '<span class="res-diff ' + (diff >= 0 ? 'gain' : 'loss') + '">' + (diff >= 0 ? '+' : '') + money(diff) + '</span></p></div><div class="items">'
    + d.map((x) => itemCard(x.it, { w: x.w, foot: have.has(x.seq)
      ? '<button type="button" class="btn sm" data-act="sellOne" data-key="' + x.seq + '">Зарах</button>'
      : '<span class="sold">Зарагдсан</span>' })).join('')
    + '</div><div class="res-a">'
    + (left.length > 1 ? '<button type="button" class="btn" data-act="sellDrops"><span>Бүгдийг зарах · ' + money(leftSum) + '</span></button>' : '')
    + '<button type="button" class="btn ghost" data-act="nav" data-view="inv">Агуулах үзэх</button></div></div>';
}

function invList() {
  let list = invRows();
  if (ui.invTier >= 0) list = list.filter((x) => x.it.tier === ui.invTier);
  if (ui.invSort === 'hi') list.sort((a, b) => b.val - a.val || b.seq - a.seq);
  else if (ui.invSort === 'lo') list.sort((a, b) => a.val - b.val || b.seq - a.seq);
  else list.sort((a, b) => b.seq - a.seq);
  return list;
}
function selbarInner() {
  return '<p class="num"><b>' + ui.sel.size + '</b> сонгосон, ' + money(sumOf(ui.sel)) + '</p><div class="selbar-a">'
    + '<button type="button" class="btn sm ghost" data-act="selClear">Болих</button>'
    + '<button type="button" class="btn sm" data-act="selUp">Ахиулалтад тавих</button>'
    + '<button type="button" class="btn sm pri" data-act="selSell">Зарах</button></div>';
}
function viewInv() {
  prune(ui.sel);
  const all = S.inv.length;
  let h = '<div class="page-h"><h1>Агуулах</h1><p class="num">' + all + ' эд зүйл, нийт ' + money(invValue()) + '</p></div>';
  if (!all) {
    return h + '<div class="empty"><p>Агуулах хоосон байна. Авдар нээхэд унасан эд зүйл энд хадгалагдана.</p>'
      + '<button type="button" class="btn pri" data-act="nav" data-view="cases">Авдар сонгох</button></div>';
  }
  const count = [0, 0, 0, 0, 0, 0];
  S.inv.forEach((e) => { count[ITEMS[e[1]].tier]++; });
  const list = invList(), shown = list.slice(0, ui.invShow);
  h += '<div class="toolbar"><div class="chips" role="group" aria-label="Зэрэглэлээр шүүх">'
    + '<button type="button" class="chip" data-act="tier" data-t="-1" aria-pressed="' + (ui.invTier < 0) + '">Бүгд</button>'
    + TIERS.map((n, i) => '<button type="button" class="chip gem t' + i + '" data-act="tier" data-t="' + i + '" aria-pressed="' + (ui.invTier === i) + '"' + (count[i] ? '' : ' disabled') + '>' + n + ' <small class="num">' + count[i] + '</small></button>').join('')
    + '</div><label class="field" for="inv-sort">Эрэмбэ <select id="inv-sort">'
    + [['new', 'Шинэ нь эхэндээ'], ['hi', 'Үнэтэй нь эхэндээ'], ['lo', 'Хямд нь эхэндээ']].map((o) => '<option value="' + o[0] + '"' + (ui.invSort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('')
    + '</select></label><button type="button" class="btn sm" data-act="sellAll">' + (ui.invTier >= 0 ? 'Эдгээрийг бүгдийг зарах' : 'Бүгдийг зарах') + '</button></div>';
  h += list.length
    ? '<div class="items">' + shown.map((x) => itemCard(x.it, { w: x.w, act: 'pick', key: x.seq, on: ui.sel.has(x.seq) })).join('') + '</div>'
    : '<p class="empty-s">Энэ зэрэглэлийн эд зүйл алга.</p>';
  if (list.length > shown.length) h += '<div class="more"><button type="button" class="btn" data-act="more">Цааш үзэх (' + (list.length - shown.length) + ')</button></div>';
  return h + '<div class="selbar" id="selbar"' + (ui.sel.size ? '' : ' hidden') + '>' + (ui.sel.size ? selbarInner() : '') + '</div>';
}

const btCost = () => ui.bt.cases.reduce((a, id) => a + CASE_BY[id].p, 0);
const btName = (p) => (p ? BOTS[p - 1] : 'Та');
/* seven digits and more get a smaller size where the column is narrow */
const btLong = (v) => (v >= 10000000 ? ' long xl' : v >= 1000000 ? ' long' : '');
function btMsg() {
  const b = ui.bt, L = b.live;
  if (!b.done) {
    const cur = Math.min(b.shown, L.cases.length - 1);
    return '<div class="up-note bt-note"><span class="bt-prog" aria-hidden="true">'
      + L.cases.map((id, r) => '<img' + (r < cur ? ' class="past"' : r === cur ? ' class="now"' : '') + ' src="' + chestArt(CASE_BY[id]) + '" alt="">').join('')
      + '</span><span>' + (cur + 1) + '-р тойрог, нийт ' + L.rounds.length + '. ' + CASE_BY[L.cases[cur]].n + '</span></div>';
  }
  const tie = L.tied ? ' Нийт үнэ тэнцсэн тул хожигчийг шодож тодруулсан.' : '';
  return L.winner === 0
    ? '<p class="up-note gain">Та хожлоо. ' + L.rounds.length * L.players + ' эд зүйл, нийт ' + plain(L.pot) + ' таны агуулахад орлоо.' + tie + '</p>'
    : '<p class="up-note loss">' + btName(L.winner) + ' хожлоо. Таны ' + plain(L.totals[0]) + '-ийн уналт түүнд очлоо.' + tie + '</p>';
}
function btBoard() {
  const b = ui.bt, L = b.live;
  const tot = L.totals.map((t, p) => L.rounds.slice(0, b.shown).reduce((a, row) => a + row[p].val, 0));
  const mark = b.shown ? (L.low ? Math.min.apply(null, tot) : Math.max.apply(null, tot)) : -1;
  return tot.map((t, p) => '<div class="bt-col pl' + p + (b.done ? (L.winner === p ? ' won' : ' lost') : '') + '"><div class="bt-head' + (!b.done && t === mark ? ' lead' : '') + '">'
    + '<i class="bt-av" aria-hidden="true">' + btName(p).charAt(0) + '</i><b>' + btName(p) + '</b><span class="num' + btLong(t) + '">' + money(t) + '</span></div><div class="bt-list">'
    /* every tile has the same three parts, so a round sits on the same line in every column and nothing jumps when it is revealed */
    + L.rounds.map((row, r) => (r < b.shown
      ? '<div class="bt-item t' + row[p].it.tier + (!b.done && r === b.shown - 1 ? ' new' : '') + '"><img src="' + art(row[p].it) + '" alt=""><b>' + row[p].it.n + '</b><span class="num' + btLong(row[p].val) + '">' + money(row[p].val) + '</span></div>'
      : '<div class="bt-item wait"><img src="' + chestArt(CASE_BY[L.cases[r]]) + '" alt=""><b>' + CASE_BY[L.cases[r]].n + '</b><span>' + (r + 1) + '-р тойрог</span></div>')).join('')
    + '</div></div>').join('');
}
/* what is still in the inventory out of the drops a won battle brought */
function btKept() {
  const won = new Set(ui.bt.live && ui.bt.live.seqs || []);
  return S.inv.filter((e) => won.has(e[0]));
}
function btActs() {
  const kept = btKept(), sum = kept.reduce((a, e) => a + priceOf(e[1], e[2]), 0);
  return '<button type="button" class="btn pri" data-act="btAgain"><span class="num">Дахин тулалдах · ' + money(ui.bt.live.cost) + '</span></button>'
    + (kept.length ? '<button type="button" class="btn" data-act="btSell"><span class="num">Хожлыг зарах · ' + money(sum) + '</span></button>' : '')
    + '<button type="button" class="btn ghost" data-act="btNew">Шинэ тулаан</button><button type="button" class="btn ghost" data-act="nav" data-view="inv">Агуулах үзэх</button>';
}
function viewBattle() {
  const b = ui.bt, L = b.live;
  let h = '<div class="page-h"><h1>Тулаан</h1><p>Та болон ботууд ижил авдруудыг нээнэ. Унасан эд зүйлсийн нийт үнэ нь ' + (b.low && !L || L && L.low ? 'хамгийн бага' : 'хамгийн их') + ' гарсан нь бүх уналтыг авна.</p></div>';
  if (L) {
    return h + '<div id="bt-msg">' + btMsg() + '</div>'
      + (b.done ? '' : '<div class="stage sec" data-cc="' + CASE_BY[L.cases[0]].col[3] + '"><i class="br tl"></i><i class="br tr"></i><i class="br bl"></i><i class="br rb"></i><div class="stage-in" id="bt-stage"></div></div>')
      + '<div class="bt-board" id="bt-board" data-cols="' + L.players + '">' + btBoard() + '</div>'
      + '<div class="res-a" id="bt-acts">' + (b.done ? btActs() : '') + '</div>';
  }
  h += '<section class="sec"><div class="sec-h"><h2>Авдрын дараалал</h2><span>' + b.cases.length + ' / ' + BT_ROUNDS + ' тойрог</span></div><div class="bt-line">'
    + (b.cases.length ? b.cases.map((id, i) => '<button type="button" class="bt-slot" data-act="btDel" data-i="' + i + '" aria-label="' + CASE_BY[id].n + ', дарааллаас хасах"><img src="' + chestArt(CASE_BY[id]) + '" alt=""><span class="num">' + money(CASE_BY[id].p) + '</span><i aria-hidden="true">×</i></button>').join('')
      : '<p class="empty-s">Доороос авдар дарж дараалалд нэм. Нэг авдрыг хэдэн ч удаа нэмж болно.</p>')
    + '</div><div class="bt-cases">'
    + CASES.map((cs) => '<button type="button" class="bt-pick" data-act="btAdd" data-id="' + cs.id + '"' + (b.cases.length >= BT_ROUNDS ? ' disabled' : '') + '><img src="' + chestArt(cs) + '" alt=""><b>' + cs.n + '</b><span class="num">' + money(cs.p) + '</span></button>').join('')
    + '</div></section><div class="ctl"><div class="bt-opt"><span class="bt-l">Өрсөлдөгч бот</span><div class="qty" role="group" aria-label="Ботын тоо">'
    + [1, 2, 3].map((n) => '<button type="button" data-act="btBots" data-bots="' + n + '" aria-pressed="' + (b.bots === n) + '">' + n + '</button>').join('')
    + '</div></div><button type="button" class="switch" data-act="btLow" aria-pressed="' + b.low + '"><i aria-hidden="true"></i>Бага нь хожно</button>'
    + '<button type="button" class="switch" data-act="fast" aria-pressed="false"><i aria-hidden="true"></i>Хурдан нээх</button>'
    + '<button type="button" class="btn pri open-btn" id="bt-go" data-act="btGo"><span class="num">' + (b.cases.length ? 'Тулаан эхлүүлэх · ' + money(btCost()) : 'Эхлээд авдар нэм') + '</span></button></div>'
    + '<p class="note">Оролцогч бүр ижил авдруудыг нээнэ, бүгд адил магадлалтай. Нийт үнэ тэнцвэл хожигчийг шодож тодруулна. Хожвол бүх оролцогчийн уналт таны агуулахад орно, хожигдвол таны уналт хожигчид очно.</p>';
  return h;
}

const GAUGE_C = 2 * Math.PI * 86;
function viewUp() {
  prune(ui.upSel);
  const v = sumOf(ui.upSel);
  if (ui.upTarget && !upChance(v, ITEMS[ui.upTarget].base)) ui.upTarget = null;
  const tgt = ui.upTarget ? ITEMS[ui.upTarget] : null, p = tgt ? upChance(v, tgt.base) : 0;
  const inv = invRows().sort((a, b) => b.val - a.val || b.seq - a.seq);
  const targets = v ? ALL_ITEMS.filter((it) => it.base >= v * UP_STEP).slice(0, 24) : [];
  const last = ui.upLast;
  let h = '<div class="page-h"><h1>Ахиулах</h1><p>Эд зүйлээ дэнчинд тавьж, илүү үнэтэйг авах оролдлого хийнэ. Амжилтгүй бол тавьсан эд зүйл алга болно.</p></div>';
  if (last) {
    h += last.win
      ? '<p class="up-note gain">Амжилттай. ' + TYPES[last.tgt.t] + ' · ' + last.tgt.n + ' (' + plain(last.tgt.base) + ') агуулахад орлоо.</p>'
      : '<p class="up-note loss">Амжилтгүй. ' + plain(last.v) + '-ийн дэнчин алга боллоо.</p>';
  }
  h += '<div class="up-top"><div class="slot"><p class="slot-l">Дэнчин</p>'
    + (v ? '<p class="slot-v num">' + money(v) + '</p><p class="slot-s">' + ui.upSel.size + ' эд зүйл</p>' : '<p class="slot-e">Доорх агуулахаас эд зүйлээ сонго.</p>')
    + '</div><div class="gauge-wrap"><div class="gauge-box"><svg class="gauge" viewBox="0 0 200 200" role="img" aria-label="Амжилтын магадлал">'
    + '<circle class="g-track" cx="100" cy="100" r="86"/><circle class="g-arc" cx="100" cy="100" r="86" stroke-dasharray="' + (p * GAUGE_C).toFixed(1) + ' ' + GAUGE_C.toFixed(1) + '" transform="rotate(-90 100 100)"/>'
    + '<g id="g-ptr"><path class="g-ptr" d="M100 27L90 5H110Z"/></g></svg>'
    + '<div class="gauge-c"><b class="num">' + (p ? pct(p, 1) : '—') + '</b><span>' + (tgt ? '×' + (tgt.base / v).toFixed(2) + ' үнэ' : 'амжих магадлал') + '</span></div></div>'
    + '<button type="button" class="btn pri" id="up-btn" data-act="upGo"' + (p ? '' : ' disabled') + '>Ахиулах</button>'
    + '<button type="button" class="switch" data-act="fast" aria-pressed="false"><i aria-hidden="true"></i>Хурдан эргүүлэх</button></div>'
    + '<div class="slot"><p class="slot-l">Зорилт</p>'
    + (tgt ? '<img src="' + art(tgt) + '" alt=""><p class="slot-n">' + TYPES[tgt.t] + ' · ' + tgt.n + '</p><p class="slot-s num">' + money(tgt.base) + '</p>' : '<p class="slot-e">Жагсаалтаас зорилтоо сонго.</p>')
    + '</div></div><div class="up-cols" id="up-cols"><section class="sec"><div class="sec-h"><h2>Таны агуулах</h2><span>Нэг удаад ' + UP_PICKS + ' хүртэл</span></div>';
  h += inv.length
    ? '<div class="items">' + inv.slice(0, 48).map((x) => itemCard(x.it, { w: x.w, act: 'upPick', key: x.seq, on: ui.upSel.has(x.seq) })).join('') + '</div>'
      + (inv.length > 48 ? '<p class="note">Хамгийн үнэтэй 48-ыг харуулж байна.</p>' : '')
    : '<div class="empty"><p>Дэнчинд тавих эд зүйл алга. Эхлээд авдар нээ.</p><button type="button" class="btn pri" data-act="nav" data-view="cases">Авдар сонгох</button></div>';
  h += '</section><section class="sec"><div class="sec-h"><h2>Зорилтот эд зүйл</h2><div class="chips" role="group" aria-label="Үнийн үржвэрээр сонгох">'
    + [1.5, 2, 3, 5, 10].map((m) => '<button type="button" class="chip num" data-act="upMult" data-m="' + m + '"' + (v ? '' : ' disabled') + '>×' + m + '</button>').join('') + '</div></div>';
  h += !v ? '<p class="empty-s">Эхлээд дэнчингээ сонго. Тэгвэл түүнээс үнэтэй эд зүйлс энд гарна.</p>'
    : targets.length ? '<div class="items">' + targets.map((it) => itemCard(it, { odds: upChance(v, it.base), dec: 1, flat: true, act: 'upTarget', key: it.id, on: it.id === ui.upTarget })).join('') + '</div>'
      : '<p class="empty-s">Үүнээс үнэтэй эд зүйл байхгүй. Арай бага дэнчин тавь.</p>';
  return h + '</section></div>';
}

function logRow(h) {
  const it = ITEMS[h[3]], name = '<span class="dot t' + it.tier + '"></span>' + TYPES[it.t] + ' · ' + it.n;
  if (h[1] === 'b') {
    const won = h[6] === 1;
    return '<tr><td class="num dim">' + fmtTime(h[0]) + '</td><td>Тулаан</td><td>' + name + '</td><td class="' + (won ? 'gain' : 'loss') + '">' + (won ? 'Хожсон' : 'Хожигдсон')
      + '</td><td class="r num">' + (won ? '+' + money(h[7]) : '−' + money(h[5])) + '</td><td class="r num dim">—</td></tr>';
  }
  const roll = (h[5] / 10000).toFixed(4);
  if (h[1] === 'o') {
    const cs = CASE_BY[h[2]];
    return '<tr><td class="num dim">' + fmtTime(h[0]) + '</td><td>' + (cs ? cs.n : 'Авдар') + '</td><td>' + name + '</td><td>' + GRADES[gradeIdx(h[4])].n
      + '</td><td class="r num">' + money(priceOf(h[3], h[4])) + '</td><td class="r num dim">' + roll + '</td></tr>';
  }
  const win = h[6] === 1;
  return '<tr><td class="num dim">' + fmtTime(h[0]) + '</td><td>Ахиулалт, ' + (h[7] / 100).toFixed(1) + '%</td><td' + (win ? '' : ' class="lost"') + '>' + name
    + '</td><td class="' + (win ? 'gain' : 'loss') + '">' + (win ? 'Амжилттай' : 'Амжилтгүй') + '</td><td class="r num">' + (win ? money(it.base) : '—') + '</td><td class="r num dim">' + roll + '</td></tr>';
}
function cloudText() {
  return cloud.mode === 'on' ? 'Явц таны бүртгэлд хадгалагдаж байгаа. Өөр төхөөрөмж дээр нээхэд эндээс үргэлжилнэ.'
    : cloud.mode === 'full' ? 'Хадгалах зай дүүрсэн тул явц одоогоор зөвхөн энэ хөтөч дээр хадгалагдана.'
      : cloud.mode === 'wait' ? 'Хадгалсан явцыг шалгаж байна…'
        : 'Явц зөвхөн энэ хөтөч дээр хадгалагдаж байгаа.';
}
function viewLog() {
  const st = S.st, worth = S.bal + invValue(), net = worth - START_BAL - st.top;
  const drops = st.tc.reduce((a, b) => a + b, 0);
  const tiles = [
    ['Нээсэн авдар', fmtN(st.o), ''],
    ['Авдарт зарцуулсан', money(st.sp), ''],
    ['Унасан эд зүйлийн үнэ', money(st.won), ''],
    ['Буцаалт', st.sp ? (st.won / st.sp * 100).toFixed(1) + '%' : '—', ''],
    ['Ахиулалт, амжилттай / нийт', st.ut ? st.uw + ' / ' + st.ut : '—', ''],
    ['Тулаан, хожсон / нийт', st.bt ? st.bw + ' / ' + st.bt : '—', ''],
    ['Тулаанд зарцуулсан', money(st.bs), ''],
    ['Нийт цэнэглэсэн', money(st.top), ''],
    ['Данс ба агуулах', money(worth), ''],
    ['Ашиг, алдагдал', (net > 0 ? '+' : '') + money(net), net > 0 ? 'gain' : net < 0 ? 'loss' : ''],
  ];
  let h = '<div class="page-h"><h1>Түүх ба тоо</h1><p>Эхлэлийн ' + plain(START_BAL) + ' болон өөрийн цэнэглэснийг тооцсон дүн.</p></div><div class="stats">'
    + tiles.map((t) => '<div class="stat"><span>' + t[0] + '</span><b class="num ' + t[2] + '">' + t[1] + '</b></div>').join('') + '</div>';
  if (drops) {
    const best = st.best;
    h += '<section class="sec"><div class="sec-h"><h2>Уналтын тархалт</h2><span>Нийт ' + fmtN(drops) + ' уналт</span></div><div class="two">'
      + (best ? '<div>' + itemCard(ITEMS[best[0]], { w: best[1], foot: '<span class="sold">Хамгийн үнэтэй уналт</span>' }) + '</div>' : '')
      + '<div class="dist">' + TIERS.map((n, i) => '<div class="dist-r t' + i + '"><b>' + n + '</b><i><u data-w="' + (st.tc[i] / drops * 100).toFixed(1) + '"></u></i><span class="num">' + fmtN(st.tc[i]) + ' · ' + pct(st.tc[i] / drops, 1) + '</span></div>').join('')
      + '</div></div></section>';
  }
  h += '<section class="sec"><div class="sec-h"><h2>Сүүлийн үйлдлүүд</h2><span>Сүүлийн ' + HIST_MAX + ' хүртэл</span></div>';
  h += S.hist.length
    ? '<div class="scroll-x"><table class="log"><thead><tr><th>Цаг</th><th>Хаанаас</th><th>Эд зүйл</th><th>Чанар, үр дүн</th><th class="r">Үнэ</th><th class="r">Шоо</th></tr></thead><tbody>'
      + S.hist.map(logRow).join('') + '</tbody></table></div><p class="note">Шоо бол 0–100 хооронд унасан санамсаргүй тоо. Авдарт тоо бага байх тусам ховор эд зүйл унана, ахиулалтад тоо нь магадлалаас бага байвал амжина.</p>'
    : '<div class="empty"><p>Одоогоор үйлдэл алга. Нээсэн авдар, тулаан, ахиулалт бүр энд бичигдэнэ.</p><button type="button" class="btn pri" data-act="nav" data-view="cases">Авдар сонгох</button></div>';
  return h + '</section><section class="sec"><div class="sec-h"><h2>Хадгалалт</h2></div><div class="setrow"><p id="cloud-l">' + cloudText()
    + '</p><button type="button" class="btn sm ghost" data-act="reset">Явцыг эхнээс нь эхлүүлэх</button></div></section>';
}

function renderWallet() {
  $('#bal').innerHTML = ui.ready || ui.known ? money(S.bal) : '…';
  const invN = ui.invShown == null ? S.inv.length : ui.invShown;
  $$('[data-inv-n]').forEach((b) => { b.textContent = String(invN); b.hidden = !invN; });
  const m = $('#mute-btn');
  m.setAttribute('aria-pressed', S.set.mute ? 'true' : 'false');
  m.setAttribute('aria-label', S.set.mute ? 'Дууг нээх' : 'Дууг хаах');
}
function render() {
  const v = ui.view;
  viewEl.innerHTML = v === 'case' ? viewCase() : v === 'inv' ? viewInv() : v === 'bt' ? viewBattle() : v === 'up' ? viewUp() : v === 'log' ? viewLog() : viewCases();
  paint(viewEl);
  const tab = v === 'case' ? 'cases' : v;
  $$('.tabs button, .dock button').forEach((b) => { if (b.dataset.view === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  renderWallet();
  setCtl();
  if (v === 'case') renderRes();
}
function go(v, id) {
  if (ui.busy) { ui.run++; ui.busy = false; }   /* leaving mid-spin: the result is already saved */
  if (ui.bt.live && !ui.bt.done) { ui.bt.shown = ui.bt.live.rounds.length; ui.bt.done = true; }
  ui.invShown = null;
  if (v === 'case' && CASE_BY[id]) ui.caseId = id;
  ui.view = v;
  ui.drops = null;
  ui.upLast = null;
  if (v === 'inv') ui.invShow = 60;
  render();
  window.scrollTo(0, 0);
}
function afterChange() {
  renderWallet();
  setCtl();
  if (ui.view === 'log' || ui.view === 'inv') render();
}

/* ---------- opening a case: the chest, then the reels drawn on one canvas ---------- */
const picCache = {};
function loadArt(it) {
  return picCache[it.id] || (picCache[it.id] = new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = art(it);
  }));
}
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function rrect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
/* one card, painted once and then stamped onto the reel every frame */
function cardSprite(it, im, g) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(g.cw * g.dpr);
  cv.height = Math.round(g.ch * g.dpr);
  const x = cv.getContext('2d'), tc = g.tiers[it.tier];
  x.scale(g.dpr, g.dpr);
  rrect(x, 0.5, 0.5, g.cw - 1, g.ch - 1, 5);
  x.fillStyle = g.panel;
  x.fill();
  x.save();
  x.clip();
  let gr = x.createLinearGradient(0, g.ch, 0, g.ch * 0.15);
  gr.addColorStop(0, rgba(tc, 0.5));
  gr.addColorStop(1, rgba(tc, 0));
  x.fillStyle = gr;
  x.fillRect(0, 0, g.cw, g.ch);
  const iw = g.cw * 0.94, ih = iw / 2, iy = g.labeled ? g.ch * 0.08 : (g.ch - ih) / 2 - 1, cx = g.cw / 2, cy = iy + ih / 2;
  gr = x.createRadialGradient(cx, cy, 2, cx, cy, g.cw * 0.5);
  gr.addColorStop(0, rgba(tc, 0.3));
  gr.addColorStop(1, rgba(tc, 0));
  x.fillStyle = gr;
  x.fillRect(0, 0, g.cw, g.ch);
  const k = ih * 0.36;
  x.strokeStyle = rgba(tc, 0.24);
  x.lineWidth = 1.6;
  x.strokeRect(cx - k, cy - k, 2 * k, 2 * k);
  x.save();
  x.translate(cx, cy);
  x.rotate(Math.PI / 4);
  x.strokeRect(-k, -k, 2 * k, 2 * k);
  x.restore();
  if (im) x.drawImage(im, cx - iw / 2, iy, iw, ih);
  if (g.labeled) {
    x.textAlign = 'center';
    x.fillStyle = g.paper;
    x.font = '600 12px ' + g.font;
    x.fillText(it.n, cx, g.ch - 27, g.cw - 12);
    x.fillStyle = g.paper2;
    x.font = '400 10.5px ' + g.font;
    x.fillText(TYPES[it.t], cx, g.ch - 12, g.cw - 12);
  }
  x.fillStyle = tc;
  x.fillRect(0, g.ch - 3.5, g.cw, 3.5);
  x.restore();
  rrect(x, 0.5, 0.5, g.cw - 1, g.ch - 1, 5);
  x.strokeStyle = g.rule;
  x.lineWidth = 1;
  x.stroke();
  return cv;
}
/* the chest shakes, then bursts open; skipped in fast mode */
async function openAnim(cs, run) {
  const box = $('#stage-in');
  if (!box) return false;
  if (S.set.fast || reduceMotion) return ui.run === run;
  box.innerHTML = idleHtml(cs);
  const wrap = $('.idle', box), img = $('img', wrap);
  wrap.classList.add('shaking');
  sRumble();
  await sleep(560);
  if (ui.run !== run || !img.isConnected) return false;
  img.src = chestArt(cs, true);
  wrap.classList.remove('shaking');
  wrap.classList.add('opened');
  sChest();
  await sleep(640);
  return ui.run === run && img.isConnected;
}
function spinReels(box, cs, drops, run, pics, opts) {
  opts = opts || {};
  const fast = S.set.fast, rowsN = drops.length, sm = rowsN > 1;
  const START = 5, K = START + (fast ? 20 : 46), n = K + 9;
  box.innerHTML = '<canvas class="reel-cv" aria-hidden="true"></canvas>' + (reduceMotion ? '' : '<button type="button" class="skip" data-act="skip">Алгасах</button>');
  const cv = $('canvas', box), c = cv.getContext('2d');
  const narrow = box.clientWidth < 520;
  const cw = sm ? (narrow ? 84 : 100) : (narrow ? 118 : 142), ch = sm ? (narrow ? 70 : 84) : (narrow ? 150 : 166);
  const gap = 6, pitch = cw + gap, rowGap = 8, padY = sm ? 22 : 28, H = rowsN * ch + (rowsN - 1) * rowGap + padY * 2;
  const tiers = [0, 1, 2, 3, 4, 5].map((i) => cssVar('--t' + i)), brass = cssVar('--brass');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const geo = { cw, ch, dpr, labeled: !sm, tiers, panel: cssVar('--panel'), rule: cssVar('--rule'), paper: cssVar('--paper'), paper2: cssVar('--paper-2'), font: '"Onest","Segoe UI",system-ui,sans-serif' };
  const sprites = {}, smears = {};
  /* three ready-made smears per card for the fast part of the roll; picking one costs a single draw per card */
  const SPANS = [14, 34, 72];
  const smear = (sp, span) => {
    const b = document.createElement('canvas'), bx = b.getContext('2d'), steps = Math.max(4, Math.round(span / 2.2));
    b.width = cw + span;
    b.height = ch;
    bx.globalCompositeOperation = 'lighter';
    bx.globalAlpha = 1 / steps;
    for (let k = 0; k < steps; k++) bx.drawImage(sp, span * k / (steps - 1), 0, cw, ch);
    return b;
  };
  cs.entries.forEach((e, i) => {
    sprites[e.it.id] = cardSprite(e.it, pics[i], geo);
    smears[e.it.id] = reduceMotion ? null : SPANS.map((span) => smear(sprites[e.it.id], span));
  });
  let W = 0;
  const fit = () => {
    W = box.clientWidth;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.height = H + 'px';
  };
  fit();
  const center = K * pitch + cw / 2;
  const rows = drops.map((d, i) => {
    const cards = [];
    for (let j = 0; j < n; j++) cards.push(j === K ? d.it : pickFrom(cs.fill, Math.random()));
    const from = START * pitch + cw / 2;
    return {
      cards, win: d.it, from, to: center + (Math.random() * 2 - 1) * 0.36 * cw, pos: from, v: 0, last: -1, state: 'spin', at: 0, stop: 0,
      delay: i * (fast ? 70 : 170), dur: reduceMotion ? 1 : (fast ? 1250 : opts.dur || 5200) + i * (fast ? 130 : opts.step || 430),
    };
  });
  const parts = [], rings = [];
  let flash = null, resolved = false, live = true, t0 = 0, lastNow = 0, popAt = 0;
  cv.dataset.state = 'spin';
  cv.dataset.rows = String(rowsN);
  cv.dataset.win = drops.map((d) => d.it.id).join(',');
  const rowY = (i) => padY + i * (ch + rowGap);
  const ended = (r) => r.state === 'pop' || r.state === 'done';
  (opts.tags || []).forEach((name, i) => {
    const tag = document.createElement('span');
    tag.className = 'row-tag pl' + i;
    tag.textContent = name;
    tag.style.top = (rowY(i) + 4) + 'px';
    box.appendChild(tag);
  });

  function burst(r, i) {
    if (reduceMotion) return;
    const tier = r.win.tier, col = tiers[tier], x = W / 2, y = rowY(i) + ch / 2;
    rings.push({ x, y, age: 0, max: tier >= 3 ? 46 : 28, col, r0: cw * 0.42 });
    if (tier >= 3) flash = { x, y, a: [0, 0, 0, 0.2, 0.32, 0.46][tier], col };
    const count = Math.round([8, 10, 14, 22, 36, 56][tier] * (sm ? 0.6 : 1));
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, sp = (2 + Math.random() * 5.5) * (tier >= 4 ? 1.3 : 1);
      parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.4, age: 0, max: 34 + Math.random() * 42, size: 2 + Math.random() * 3.6,
        col: Math.random() < 0.28 ? '#ffffff' : col, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
      });
    }
  }
  function step(dt) {
    if (flash) { flash.a *= Math.pow(0.9, dt); if (flash.a < 0.01) flash = null; }
    for (let k = rings.length - 1; k >= 0; k--) { rings[k].age += dt; if (rings[k].age >= rings[k].max) rings.splice(k, 1); }
    for (let k = parts.length - 1; k >= 0; k--) {
      const p = parts[k];
      p.age += dt;
      if (p.age >= p.max) { parts.splice(k, 1); continue; }
      const drag = Math.pow(0.975, dt);
      p.vx *= drag;
      p.vy = p.vy * drag + 0.12 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }
  function stamp(sp, x, y, sc, alpha) {
    c.globalAlpha = alpha;
    c.drawImage(sp, x + cw / 2 - cw * sc / 2, y + ch / 2 - ch * sc / 2, cw * sc, ch * sc);
    c.globalAlpha = 1;
  }
  const backOut = (q) => { const s = 2.6; return 1 + (s + 1) * Math.pow(q - 1, 3) + s * Math.pow(q - 1, 2); };
  function draw(now) {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    rows.forEach((r, i) => {
      const y = rowY(i), over = ended(r);
      const pt = r.state === 'pop' ? Math.min(1, (now - r.at) / 900) : r.state === 'done' ? 1 : 0;
      const lg = c.createLinearGradient(W / 2 - pitch, 0, W / 2 + pitch, 0);
      lg.addColorStop(0, rgba(brass, 0));
      lg.addColorStop(0.5, rgba(brass, over ? 0.05 : 0.13));
      lg.addColorStop(1, rgba(brass, 0));
      c.fillStyle = lg;
      c.fillRect(W / 2 - pitch, y - 8, pitch * 2, ch + 16);
      const run1 = r.state === 'spin' ? Math.abs(r.v) : 0;   /* px the strip moved during this frame */
      const first = Math.max(0, Math.floor((r.pos - W / 2) / pitch) - 1), last = Math.min(n - 1, Math.ceil((r.pos + W / 2) / pitch) + 1);
      for (let j = first; j <= last; j++) {
        if (over && j === K) continue;
        const x = W / 2 + j * pitch - r.pos, sp = sprites[r.cards[j].id];
        if (run1 > 7 && smears[r.cards[j].id]) {
          /* motion blur: a smear stretched over the path the card covered during this frame */
          c.drawImage(smears[r.cards[j].id][run1 < 22 ? 0 : run1 < 50 ? 1 : 2], x, y, cw + run1, ch);
        } else {
          const lift = Math.max(0, 1 - Math.abs(x + cw / 2 - W / 2) / pitch);
          stamp(sp, x, y, over ? 1 : 1 + 0.06 * lift, over ? 1 - 0.7 * Math.min(1, pt * 3) : 1);
        }
      }
      if (over) {
        const x = W / 2 + K * pitch - r.pos, sc = 1 + 0.09 * backOut(Math.min(1, pt * 2.4));
        c.save();
        c.shadowColor = tiers[r.win.tier];
        c.shadowBlur = 18 + 14 * Math.sin(pt * Math.PI);
        stamp(sprites[r.win.id], x, y, sc, 1);
        c.restore();
        if (pt > 0.05 && pt < 0.75) {
          /* one sweep of light across the winning card */
          const q = (pt - 0.05) / 0.7, w = cw * sc, h = ch * sc;
          c.save();
          rrect(c, x + cw / 2 - w / 2, y + ch / 2 - h / 2, w, h, 5);
          c.clip();
          c.translate(x + cw / 2, y + ch / 2);
          c.rotate(0.38);
          const bx = (q * 2 - 1) * w * 0.95, bw = w * 0.42, sg = c.createLinearGradient(bx - bw / 2, 0, bx + bw / 2, 0);
          sg.addColorStop(0, 'rgba(255,255,255,0)');
          sg.addColorStop(0.5, 'rgba(255,255,255,0.36)');
          sg.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = sg;
          c.fillRect(bx - bw / 2, -h, bw, h * 2);
          c.restore();
        }
      }
    });
    /* the marker: a brass needle while anything still moves, its two gems always */
    const top = rowY(0), bottom = rowY(rowsN - 1) + ch, moving = !rows.every(ended);
    c.save();
    c.fillStyle = brass;
    c.shadowColor = brass;
    c.shadowBlur = moving ? 12 : 6;
    if (moving) c.fillRect(W / 2 - 1, top - 9, 2, bottom - top + 18);
    [top - 11, bottom + 11].forEach((my) => {
      c.beginPath();
      c.moveTo(W / 2, my - 7);
      c.lineTo(W / 2 + 6, my);
      c.lineTo(W / 2, my + 7);
      c.lineTo(W / 2 - 6, my);
      c.closePath();
      c.fill();
    });
    c.restore();
    if (flash) {
      const fg = c.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, Math.max(W * 0.5, H));
      fg.addColorStop(0, rgba(flash.col, flash.a));
      fg.addColorStop(1, rgba(flash.col, 0));
      c.fillStyle = fg;
      c.fillRect(0, 0, W, H);
    }
    rings.forEach((g) => {
      const q = g.age / g.max;
      c.strokeStyle = rgba(g.col, 0.7 * (1 - q));
      c.lineWidth = 3 * (1 - q) + 0.5;
      c.beginPath();
      c.arc(g.x, g.y, g.r0 + q * cw * 1.5, 0, Math.PI * 2);
      c.stroke();
    });
    c.globalCompositeOperation = 'lighter';
    parts.forEach((p) => {
      const q = p.age / p.max, s = p.size * (1 - q * 0.6);
      c.globalAlpha = 1 - q;
      c.fillStyle = p.col;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.fillRect(-s / 2, -s / 2, s, s);
      c.restore();
    });
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }
  return new Promise((resolve) => {
    const finish = (v) => { if (!resolved) { resolved = true; resolve(v); } };
    const onResize = () => {
      if (!cv.isConnected) { window.removeEventListener('resize', onResize); return; }
      if (!live) { fit(); draw(performance.now()); }
    };
    window.addEventListener('resize', onResize);
    function frame(now) {
      if (ui.run !== run || !cv.isConnected) { live = false; finish(false); return; }
      if (!t0) { t0 = now; lastNow = now; }
      const dt = Math.min(3, (now - lastNow) / 16.667);
      lastNow = now;
      if (box.clientWidth !== W) fit();
      let busy = 0;
      rows.forEach((r, i) => {
        const prev = r.pos;
        if (r.state === 'spin') {
          let p = ui.skip ? 1 : (now - t0 - r.delay) / r.dur;
          p = p < 0 ? 0 : p > 1 ? 1 : p;
          r.pos = r.from + (r.to - r.from) * (1 - Math.pow(1 - p, 4));
          const idx = Math.floor(r.pos / pitch);
          if (idx !== r.last) { r.last = idx; if (p > 0 && p < 1) tick(); }
          if (p === 1) { r.state = 'settle'; r.at = now; r.stop = r.pos; sStop(); }
          busy++;
        } else if (r.state === 'settle') {
          /* glide the last few pixels so the winning card sits dead centre */
          const q = reduceMotion ? 1 : Math.min(1, (now - r.at) / 280), e = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
          r.pos = r.stop + (center - r.stop) * e;
          if (q === 1) { r.state = 'pop'; r.at = now; popAt = now; burst(r, i); }
          busy++;
        } else if (r.state === 'pop') {
          if (now - r.at >= 900) r.state = 'done'; else busy++;
        }
        r.v = r.pos - prev;
      });
      step(dt);
      draw(now);
      if (!resolved && rows.every(ended) && now - popAt >= (reduceMotion ? 0 : 420)) {
        cv.dataset.state = 'done';
        const s = $('.skip', box);
        if (s) s.remove();
        finish(true);
      }
      if (busy || parts.length || rings.length || flash || !resolved) requestAnimationFrame(frame); else live = false;
    }
    requestAnimationFrame(frame);
  });
}
function spinGauge(r, run) {
  const ptr = $('#g-ptr'), fast = S.set.fast;
  const end = 360 * (fast ? 2 : 5) + r * 360, dur = reduceMotion ? 1 : fast ? 1100 : 4200;
  return new Promise((resolve) => {
    const t0 = performance.now();
    let last = -1;
    function frame(now) {
      if (ui.run !== run || !ptr || !ptr.isConnected) { resolve(); return; }
      const p = Math.min(1, Math.max(0, (now - t0) / dur)), a = end * (1 - Math.pow(1 - p, 4));
      ptr.setAttribute('transform', 'rotate(' + a.toFixed(2) + ' 100 100)');
      const k = Math.floor(a / 30);
      if (k !== last) { last = k; if (p > 0 && p < 1) tick(); }
      if (p < 1) requestAnimationFrame(frame); else setTimeout(resolve, reduceMotion ? 0 : 450);
    }
    requestAnimationFrame(frame);
  });
}

/* ---------- actions ---------- */
function openTopup(need) {
  const inp = $('#top-amt');
  if (need) {
    const pre = [10000, 50000, 100000, 500000, 1000000].filter((x) => x >= need)[0] || Math.min(TOP_MAX, Math.ceil(need / 100000) * 100000);
    inp.value = fmtN(pre);
  }
  $('#top-err').hidden = true;
  openDlg($('#dlg-top'));
  inp.focus();
  inp.select();
}
function topErr(msg) {
  const e = $('#top-err');
  e.textContent = msg;
  e.hidden = false;
}
const ACT = {
  nav: (el) => go(el.dataset.view),
  case: (el) => go('case', el.dataset.id),
  qty: (el) => { if (ui.busy) return; S.set.qty = Number(el.dataset.n); saveSoft(); setCtl(); },
  fast: () => { S.set.fast = !S.set.fast; saveSoft(); setCtl(); },
  mute: () => { S.set.mute = !S.set.mute; saveSoft(); renderWallet(); sClick(); },
  skip: () => { ui.skip = true; },
  topup: () => openTopup(0),
  preset: (el) => { $('#top-amt').value = fmtN(Number(el.dataset.a)); $('#top-err').hidden = true; },
  dlgClose: (el) => closeDlg(el.closest('dialog'), ''),
  askOk: (el) => closeDlg(el.closest('dialog'), 'ok'),

  open: async () => {
    if (ui.busy || !guard()) return;
    const cs = CASE_BY[ui.caseId], res = openCases(cs, cs.free ? 1 : S.set.qty);
    if (res.err === 'wait') { toast('Өдрийн авдрыг 24 цагт нэг удаа нээнэ.'); setCtl(); return; }
    if (res.err === 'funds') { toast('Данс хүрэлцэхгүй байна. ' + plain(res.need) + ' дутуу.', 'bad'); openTopup(res.need); return; }
    if (res.err === 'full') { toast('Агуулах дүүрсэн. Хэдэн эд зүйл зарж зай гарга.', 'bad'); return; }
    ac();
    const run = ++ui.run;
    ui.skip = false;
    ui.busy = true;
    ui.drops = null;
    renderRes();
    renderWallet();
    setCtl();
    let ok = false;
    try {
      const pics = Promise.all(cs.entries.map((e) => loadArt(e.it)));
      ok = await openAnim(cs, run);
      if (ok) ok = await spinReels($('#stage-in'), cs, res.drops, run, await pics);
    } catch (e) {
      /* the drop is saved either way: put the chest back and show the result */
      ok = ui.run === run && ui.view === 'case';
      if (ok && $('#stage-in')) $('#stage-in').innerHTML = idleHtml(cs);
    }
    if (!ok) return;
    ui.busy = false;
    ui.drops = res.drops;
    ui.dropsCost = res.cost;
    renderRes(true);
    setCtl();
    sWin(Math.max.apply(null, res.drops.map((d) => d.it.tier)));
  },
  sellOne: (el) => {
    if (!guard()) return;
    const got = sellItems([Number(el.dataset.key)]);
    if (got) { toast('Зарлаа. Дансанд ' + plain(got) + ' нэмэгдлээ.', 'good'); sCoin(); }
    renderRes();
    renderWallet();
  },
  sellDrops: () => {
    if (!guard() || !ui.drops) return;
    const got = sellItems(ui.drops.map((d) => d.seq));
    if (got) { toast('Зарлаа. Дансанд ' + plain(got) + ' нэмэгдлээ.', 'good'); sCoin(); }
    renderRes();
    renderWallet();
  },

  tier: (el) => { ui.invTier = Number(el.dataset.t); ui.invShow = 60; render(); },
  more: () => { ui.invShow += 60; render(); },
  pick: (el) => {
    const k = Number(el.dataset.key);
    if (ui.sel.has(k)) ui.sel.delete(k); else ui.sel.add(k);
    el.setAttribute('aria-pressed', ui.sel.has(k) ? 'true' : 'false');
    const bar = $('#selbar');
    bar.innerHTML = ui.sel.size ? selbarInner() : '';
    bar.hidden = !ui.sel.size;
  },
  selClear: () => { ui.sel.clear(); render(); },
  selSell: () => {
    if (!guard()) return;
    const got = sellItems(Array.from(ui.sel));
    ui.sel.clear();
    if (got) { toast('Зарлаа. Дансанд ' + plain(got) + ' нэмэгдлээ.', 'good'); sCoin(); }
    render();
  },
  selUp: () => {
    const picks = Array.from(ui.sel);
    if (picks.length > UP_PICKS) toast('Нэг удаад ' + UP_PICKS + ' хүртэл эд зүйл тавина. Эхний ' + UP_PICKS + '-ыг авлаа.');
    ui.upSel = new Set(picks.slice(0, UP_PICKS));
    ui.upTarget = null;
    ui.sel.clear();
    go('up');
  },
  sellAll: async () => {
    if (!guard()) return;
    const list = invList();
    if (!list.length) return;
    const sum = list.reduce((a, x) => a + x.val, 0);
    const what = ui.invTier >= 0 ? TIERS[ui.invTier] + ' зэрэглэлийн ' + list.length + ' эд зүйлийг' : 'Агуулахын бүх ' + list.length + ' эд зүйлийг';
    if (!(await ask('Бүгдийг зарах уу?', what + ' ' + plain(sum) + '-өөр зарна. Буцаах боломжгүй.', 'Зарах'))) return;
    const got = sellItems(list.map((x) => x.seq));
    ui.sel.clear();
    if (got) { toast('Зарлаа. Дансанд ' + plain(got) + ' нэмэгдлээ.', 'good'); sCoin(); }
    if (ui.view === 'inv') { ui.invTier = -1; render(); } else renderWallet();
  },

  upPick: (el) => {
    if (ui.busy) return;
    const k = Number(el.dataset.key);
    if (ui.upSel.has(k)) ui.upSel.delete(k);
    else if (ui.upSel.size >= UP_PICKS) { toast('Нэг удаад ' + UP_PICKS + ' хүртэл эд зүйл тавина.'); return; } else ui.upSel.add(k);
    ui.upLast = null;
    render();
  },
  upTarget: (el) => {
    if (ui.busy) return;
    ui.upTarget = ui.upTarget === el.dataset.key ? null : el.dataset.key;
    render();
  },
  upMult: (el) => {
    if (ui.busy) return;
    const v = sumOf(ui.upSel), want = v * Number(el.dataset.m);
    let best = null;
    ALL_ITEMS.forEach((it) => { if (it.base >= v * UP_STEP && (!best || Math.abs(it.base - want) < Math.abs(best.base - want))) best = it; });
    if (!best) { toast('Үүнээс үнэтэй эд зүйл байхгүй.'); return; }
    ui.upTarget = best.id;
    render();
  },
  upGo: async () => {
    if (ui.busy || !guard() || !ui.upTarget) return;
    const res = upgrade(Array.from(ui.upSel), ui.upTarget);
    if (!res) { render(); return; }
    ac();
    ui.busy = true;
    renderWallet();
    $('#up-btn').disabled = true;
    $('#up-cols').classList.add('locked');
    const run = ++ui.run;
    try { await spinGauge(res.r, run); } catch (e) { /* the result is saved either way */ }
    if (ui.run !== run) return;
    ui.busy = false;
    ui.upSel.clear();
    ui.upTarget = null;
    ui.upLast = res;
    if (res.win) sWin(res.tgt.tier); else sFail();
    render();
  },

  btAdd: (el) => { if (ui.bt.cases.length < BT_ROUNDS) { ui.bt.cases.push(el.dataset.id); render(); } },
  btDel: (el) => { ui.bt.cases.splice(Number(el.dataset.i), 1); render(); },
  btBots: (el) => { ui.bt.bots = Number(el.dataset.bots); render(); },
  btLow: () => { ui.bt.low = !ui.bt.low; render(); },
  btNew: () => { ui.bt.live = null; ui.bt.done = false; render(); },
  btAgain: () => { ui.bt.live = null; ui.bt.done = false; ACT.btGo(); },
  btSell: () => {
    if (!guard() || !ui.bt.live) return;
    const got = sellItems(btKept().map((e) => e[0]));
    if (got) { toast('Зарлаа. Дансанд ' + plain(got) + ' нэмэгдлээ.', 'good'); sCoin(); }
    if ($('#bt-acts')) $('#bt-acts').innerHTML = btActs();
    renderWallet();
  },
  btGo: async () => {
    if (ui.busy || !guard()) return;
    const b = ui.bt, held = S.inv.length, res = battleStart(b.cases, b.bots, b.low);
    if (res.err === 'funds') { toast('Данс хүрэлцэхгүй байна. ' + plain(res.need) + ' дутуу.', 'bad'); if (ui.view !== 'bt' || !$('#bt-go')) render(); openTopup(res.need); return; }
    if (res.err === 'full') { toast('Агуулахад зай хүрэлцэхгүй. Хэдэн эд зүйл зарж зай гарга.', 'bad'); if (!$('#bt-go')) render(); return; }
    if (res.err) { render(); return; }
    ac();
    const run = ++ui.run;
    ui.skip = false;
    ui.busy = true;
    ui.invShown = held;
    b.live = res;
    b.shown = 0;
    b.done = false;
    render();
    const tags = res.totals.map((t, p) => btName(p));
    for (let r = 0; r < res.rounds.length; r++) {
      const cs = CASE_BY[res.cases[r]], msg = $('#bt-msg'), stage = $('#bt-stage');
      if (msg) msg.innerHTML = btMsg();
      if (stage) stage.parentNode.style.setProperty('--cc', cs.col[3]);
      let ok = false;
      try {
        const pics = await Promise.all(cs.entries.map((e) => loadArt(e.it)));
        if (ui.run !== run) return;
        ok = await spinReels($('#bt-stage'), cs, res.rounds[r], run, pics, { tags, dur: 3300, step: 260 });
      } catch (e) { ok = ui.run === run && ui.view === 'bt'; }   /* the battle is saved either way */
      if (!ok) return;
      b.shown = r + 1;
      const board = $('#bt-board');
      if (board) board.innerHTML = btBoard();
      await sleep(S.set.fast || reduceMotion ? 260 : 800);
      if (ui.run !== run) return;
    }
    ui.busy = false;
    ui.invShown = null;
    b.done = true;
    if ($('#bt-msg')) $('#bt-msg').innerHTML = btMsg();
    if ($('#bt-board')) $('#bt-board').innerHTML = btBoard();
    if ($('#bt-acts')) $('#bt-acts').innerHTML = btActs();
    renderWallet();
    if (res.winner === 0) sWin(4); else sFail();
  },

  reset: async () => {
    if (!guard()) return;
    if (!(await ask('Явцыг эхнээс нь эхлүүлэх үү?', 'Данс, агуулах, түүх бүгд арилж, данс ' + plain(START_BAL) + '-өөс дахин эхэлнэ. Буцаах боломжгүй.', 'Арилгах'))) return;
    resetAll();
    ui.bt.live = null;
    ui.bt.done = false;
    ui.invShown = null;
    ui.sel.clear();
    ui.upSel.clear();
    ui.upTarget = null;
    toast('Явц эхнээсээ эхэллээ.');
    go('cases');
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest ? e.target.closest('[data-act]') : null;
  if (el && !el.disabled && ACT[el.dataset.act]) { ACT[el.dataset.act](el); return; }
  if (e.target.tagName === 'DIALOG') closeDlg(e.target, '');   /* click on the backdrop */
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'inv-sort') { ui.invSort = e.target.value; ui.invShow = 60; render(); }
});
$('#top-amt').addEventListener('input', (e) => {
  const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
  e.target.value = digits ? fmtN(parseInt(digits, 10)) : '';
  $('#top-err').hidden = true;
});
$('#top-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!ui.ready) { topErr('Хадгалсан явцыг ачаалж байна. Хэдхэн секунд хүлээгээд дахин дар.'); return; }
  const a = parseInt($('#top-amt').value.replace(/\D/g, ''), 10);
  if (!(a >= TOP_MIN && a <= TOP_MAX)) { topErr(fmtN(TOP_MIN) + '-аас ' + fmtN(TOP_MAX) + ' хүртэлх дүн оруул.'); return; }
  if (S.bal + a > BAL_MAX) { topErr('Данс дээд хязгаартаа хүрсэн.'); return; }
  topUp(a);
  closeDlg($('#dlg-top'), '');
  toast('Данс ' + plain(a) + '-өөр цэнэглэгдлээ.', 'good');
  sCoin();
  afterChange();
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
setInterval(() => {
  if (document.hidden) return;
  const t = dailyText();
  $$('[data-daily]').forEach((el) => { if (el.textContent !== t) el.textContent = t; });
  if (ui.view === 'case' && CASE_BY[ui.caseId].free && !ui.busy) setCtl();
}, 1000);
cloud.onMode = () => { const el = $('#cloud-l'); if (el) el.textContent = cloudText(); };

/* ---------- start ---------- */
function start(hot) {
  const local = lsLoad();
  if (local) { S = local; ui.known = true; }
  bootT = S.t;
  if (hot && typeof hot === 'object') {
    if (VIEWS.indexOf(hot.view) >= 0) ui.view = hot.view;
    if (CASE_BY[hot.caseId]) ui.caseId = hot.caseId;
  }
  render();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    ui.ready = true;
    renderWallet();
    setCtl();
  };
  initCloud(() => {
    ui.known = true;
    ui.bt.live = null;
    ui.bt.done = false;
    ui.sel.clear();
    ui.upSel.clear();
    ui.upTarget = null;
    ui.drops = null;
    if (ui.busy) renderWallet(); else render();
  }).then(finish, finish);
  setTimeout(finish, 6000);
}
try { window.claude?.hot?.snapshot(() => ({ view: ui.view, caseId: ui.caseId })); } catch (e) { /* optional hook */ }
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
