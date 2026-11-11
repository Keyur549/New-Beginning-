// ધ સંગમ — The Sangam (real-time quiz game, same style as The Beginning)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 20000, pingTimeout: 40000, maxHttpBufferSize: 4e6, perMessageDeflate: false });
process.on('uncaughtException', e => console.error('uncaughtException:', e && e.stack || e));
process.on('unhandledRejection', e => console.error('unhandledRejection:', e));

const HOST_ID = process.env.HOST_ID || 'admin';
const HOST_PW = process.env.HOST_PW || 'gyan2026';
const FAST = !!process.env.SG_FAST; // test mode: short timers

// ---------- static files (public/ or flat project root, like The Beginning) ----------
app.get('/health', (req, res) => res.type('text').send('ok'));
const EXT = ['.html','.png','.jpg','.jpeg','.gif','.webp','.svg','.json'];
function findFile(rel){
  if (rel.includes('..')) return null;
  const base = path.basename(rel);
  if (['config.json','package.json','package-lock.json','server.js'].includes(base)) return null;
  if (!EXT.includes(path.extname(base).toLowerCase())) return null;
  if (base === 'chitra.svg' || /^chitra\.(jpg|jpeg|png|webp)$/i.test(base)) return null; // the hidden picture is served only at the end
  for (const f of [path.join(__dirname,'public',rel), path.join(__dirname,base)]) { try { if (fs.statSync(f).isFile()) return f; } catch(e){} }
  return null;
}
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  let rel; try { rel = decodeURIComponent(req.path); } catch(e){ return next(); }
  const f = findFile(rel); if (f) return res.sendFile(f);
  next();
});
app.get('/', (req, res) => res.redirect('/player.html' + (req.query.code ? '?code=' + encodeURIComponent(req.query.code) : '')));
app.get(['/host','/admin'], (req, res) => res.redirect('/host.html'));
app.get('/api/default-questions', (req, res) => {
  let t = ''; try { t = fs.readFileSync(path.join(__dirname,'questions.txt'),'utf8'); } catch(e){}
  res.type('text/plain; charset=utf-8').send(t);
});
app.get('/api/room/:code', (req, res) => { const r = rooms[String(req.params.code||'').toUpperCase()]; if (!r) return res.json({ ok:false }); res.json({ ok:true, zones:r.zones, status:r.status, canJoin:(r.status==='lobby'||r.status==='pick'), n:Object.keys(r.players).length }); });
function chitraFile(){
  for (const n of ['chitra.jpg','chitra.jpeg','chitra.png','chitra.webp','chitra.svg']) {
    for (const f of [path.join(__dirname,'public',n), path.join(__dirname,n)]) { try { if (fs.statSync(f).isFile()) return f; } catch(e){} }
  }
  return null;
}
// the hidden picture: only sent when this room has reached the final reveal
app.get('/chitra/:code', (req, res) => {
  const r = rooms[String(req.params.code||'').toUpperCase()];
  if (!r || r.status !== 'reveal') return res.status(403).type('text').send('not yet');
  const f = chitraFile(); if (!f) return res.status(404).type('text').send('no picture');
  res.sendFile(f);
});

// ---------- settings ----------
const PHASES = 4, PER = 9, NQ = PHASES * PER; // 36 questions
const DEF = {
  phaseNames: ['ફેઝ 1','ફેઝ 2','ફેઝ 3','ફેઝ 4'],
  zones: ['A','B','C','D','E'],
  qSec: 30, pickSec: FAST ? 4 : 60, yuddhSec: FAST ? 3 : 15, revealMs: FAST ? 200 : 1600
};
const FAST_FRAC = 1/3;            // marked in the first third of the time = colourful tile
const PTS = { C: 1.5, B: 1, F: 0.5, line: 3, lineMax: 3, shubh: 10, chinh: 5, full: 5, duelWin: 2, duelTie: 1, baan: 1, dhal: 1, mitra: 1, mitraMax: 5 };
const LINES = (() => { const L = []; for (let r=0;r<5;r++) L.push([0,1,2,3,4].map(c=>r*5+c)); for (let c=0;c<5;c++) L.push([0,1,2,3,4].map(r=>r*5+c)); L.push([0,6,12,18,24]); L.push([4,8,12,16,20]); return L; })();
const LINE_NAMES = ['આડી 1','આડી 2','આડી 3','આડી 4','આડી 5','ઊભી 1','ઊભી 2','ઊભી 3','ઊભી 4','ઊભી 5','તિરછી 1','તિરછી 2'];
const STEPS = ['tiles','yuddh','z3','z2','z1','p3','p2','p1','chinh','jodi','pratham','shiromani','chitra'];

function shuffle(a){ const x=a.slice(); for(let i=x.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [x[i],x[j]]=[x[j],x[i]]; } return x; }
function randCode(){ const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s='SNGM'; for(let i=0;i<4;i++) s+=c[Math.floor(Math.random()*c.length)]; return s; }
function tok(){ return 't'+Date.now().toString(36)+Math.random().toString(36).slice(2,10)+Math.random().toString(36).slice(2,10); }
const phaseOf = qi => Math.floor(qi / PER);

// ---------- questions: "Question::Answer" (optional [img:file]); 36 lines, optional "Phase N" headers ----------
function parseLine(l){
  let img = '';
  l = l.replace(/\[img:\s*(\S+?)\s*\]/i, (m,u)=>{ img=u; return ''; }).trim();
  if (img && !/^(https?:|data:|\/)/i.test(img)) img = '/' + encodeURIComponent(img.replace(/^\/+/,''));
  let parts = null;
  if (l.includes('::')) parts = [l.split('::')[0], l.split('::').slice(1).join('::')];
  else if (l.includes(' - ')) parts = [l.split(' - ')[0], l.split(' - ').slice(1).join(' - ')];
  if (parts && parts[0].trim() && parts[1] && parts[1].trim()) { const o={q:parts[0].trim(), a:parts[1].trim()}; if(img) o.img=img; return o; }
  return null;
}
function parseQuestions(text){
  const lines = (text||'').split('\n').map(l=>l.trim()).filter(Boolean);
  const qs = [], errors = [], bad = [];
  for (const l of lines){
    if (/^(?:phase|ફેઝ|round|રાઉન્ડ)\s*[-:]?\s*\d+/i.test(l) || l.startsWith('#') || l.startsWith('//')) continue;
    const qa = parseLine(l); if (!qa) bad.push(l); else qs.push(qa);
  }
  if (bad.length) errors.push(bad.length+' લાઇન સમજાઈ નહિ (Question::Answer): '+bad.slice(0,3).join(' | '));
  if (qs.length !== NQ) errors.push('કુલ '+NQ+' પ્રશ્ન જોઈએ, '+qs.length+' મળ્યા.');
  const seen = {}; qs.forEach((q,i)=>{ const k=q.a.toLowerCase(); if (seen[k]!==undefined) errors.push('જવાબ "'+q.a+'" બે વાર છે (પ્રશ્ન '+(seen[k]+1)+' અને '+(i+1)+').'); else seen[k]=i; });
  return { ok: errors.length===0, errors, questions: qs };
}
const makeCard = qs => shuffle(shuffle(qs.map(q=>q.a)).slice(0,25));

const rooms = {};
const hostSockets = new Set();

// ---------- results (computed once, when the final reveal starts) ----------
function tilesOf(r, p){
  const t = Array(25).fill('E');
  for (const k of Object.keys(p.marks)) {
    const ci = +k, qi = p.marks[k], q = r.questions[qi]; if (!q) continue;
    const ok = q.a === p.card[ci], fast = (p.markTs[qi] ?? 1e9) <= r.qSec*1000*FAST_FRAC;
    t[ci] = ok ? (fast ? 'C' : 'B') : (ci === p.kavach ? 'F' : 'X');
  }
  return t;
}
const isOk = s => s === 'C' || s === 'B';
function computeResults(r){
  const P = Object.values(r.players);
  const zoneN = {}; P.forEach(p => zoneN[p.zone] = (zoneN[p.zone]||0)+1);
  const R = {}; // key -> result
  for (const p of P) {
    const tiles = tilesOf(r, p);
    const corrQ = new Set(); for (const k of Object.keys(p.marks)) if (isOk(tiles[+k])) corrQ.add(p.marks[k]);
    const phaseCorr = [0,0,0,0]; corrQ.forEach(qi => phaseCorr[phaseOf(qi)]++);
    const full = tiles.every(isOk);
    R[p.key] = { key:p.key, name:p.name, zone:p.zone, avatar:p.avatar, tiles, corrQ, phaseCorr, bd:{}, total:0, open: tiles.filter(s=>s!=='E'&&s!=='X').length,
      shubh:p.shubh, kavach:p.kavach, full, speedSum:0, speedN:0, dhal:0, baanLanded:0, duels:[], mitra:null };
    for (const k of Object.keys(p.markTs)) { R[p.key].speedSum += p.markTs[k]; R[p.key].speedN++; }
  }
  // yuddh
  const loss = {}; Object.keys(zoneN).forEach(z => loss[z] = 0);
  const yTable = [];
  for (let ph=0; ph<PHASES; ph++) {
    const ch = r.yuddh[ph] || {}, arrows = {}, shields = {}, byFrom = {};
    Object.keys(zoneN).forEach(z => { arrows[z]=0; shields[z]=0; byFrom[z]={}; });
    for (const key of Object.keys(ch)) {
      const c = ch[key], p = r.players[key]; if (!p) continue;
      if (c.t === 'dhal') shields[p.zone]++;
      else if (c.t === 'baan' && arrows[c.z] !== undefined) { arrows[c.z]++; byFrom[c.z][p.zone] = (byFrom[c.z][p.zone]||0)+1; }
    }
    const row = {};
    for (const z of Object.keys(zoneN)) {
      const net = Math.max(0, arrows[z]-shields[z]);
      loss[z] += net / zoneN[z] * 20;
      row[z] = { arrows:arrows[z], shields:shields[z], net, from:byFrom[z] };
      for (const key of Object.keys(ch)) {
        const c = ch[key], p = r.players[key]; if (!p) continue;
        if (c.t === 'baan' && c.z === z && net > 0) { R[key].baanLanded++; R[key].bd.baan = (R[key].bd.baan||0) + PTS.baan; }
        if (c.t === 'dhal' && p.zone === z && arrows[z] > 0 && net === 0) { R[key].dhal++; R[key].bd.dhal = (R[key].bd.dhal||0) + PTS.dhal; }
      }
    }
    yTable.push(row);
  }
  for (const z of Object.keys(loss)) loss[z] = Math.min(20, loss[z]);
  // tiles, lines, chinh, full
  for (const p of P) {
    const o = R[p.key]; let s = 0;
    o.tiles.forEach(t => { s += t==='C'?PTS.C : t==='B'?PTS.B : t==='F'?PTS.F : 0; });
    o.bd.tiles = s;
    const done = LINES.map(l => l.every(ci => isOk(o.tiles[ci])));
    o.shubhDone = p.shubh!=null && done[p.shubh];
    let others = 0; done.forEach((d,i) => { if (d && i !== p.shubh) others++; });
    o.lines = Math.min(PTS.lineMax, others);
    if (o.lines) o.bd.lines = o.lines * PTS.line;
    if (o.shubhDone) o.bd.shubh = PTS.shubh;
    o.chinh = isOk(o.tiles[r.chinh]);
    if (o.chinh) o.bd.chinh = PTS.chinh;
    if (o.full) o.bd.full = PTS.full;
    if (o.shubhDone) { // when did the shubh line become complete? (question order, then speed of that last tile)
      let ord = -1, ts = 0;
      for (const ci of LINES[p.shubh]) { const qi = p.marks[ci], oi = r.usedIdx.indexOf(qi); if (oi > ord || (oi === ord && p.markTs[qi] > ts)) { ord = oi; ts = p.markTs[qi]; } }
      o.shubhOrd = ord; o.shubhTs = ts;
    }
  }
  // duels
  for (let ph=0; ph<PHASES; ph++) {
    const d = r.duel[ph] || {};
    for (const key of Object.keys(d)) {
      const a = R[key], b = R[d[key]]; if (!a || !b) continue;
      const res = a.phaseCorr[ph] > b.phaseCorr[ph] ? 'win' : a.phaseCorr[ph] < b.phaseCorr[ph] ? 'loss' : 'tie';
      a.duels.push({ ph, opp:b.name, res, me:a.phaseCorr[ph], they:b.phaseCorr[ph] });
      if (res === 'win') a.bd.duel = (a.bd.duel||0) + PTS.duelWin; else if (res === 'tie') a.bd.duel = (a.bd.duel||0) + PTS.duelTie;
    }
  }
  // mitra
  let bestPair = null;
  for (const p of P) {
    const m = r.players[p.mitra]; if (!m) continue;
    const a = R[p.key], b = R[m.key]; let n = 0; a.corrQ.forEach(q => { if (b.corrQ.has(q)) n++; });
    a.mitra = { name:m.name, matches:n };
    if (n) a.bd.mitra = Math.min(PTS.mitraMax, n) * PTS.mitra;
    if (n && (!bestPair || n > bestPair.n)) bestPair = { a:p.key, b:m.key, n };
  }
  for (const k of Object.keys(R)) { const o = R[k]; o.total = Object.values(o.bd).reduce((x,y)=>x+y,0); }
  // birud
  const list = Object.values(R);
  const best = (f, min) => { let b=null; for (const o of list) { const v=f(o); if (v!=null && (b==null || v>b.v) && (min==null || v>=min)) b={o,v}; } return b && b.o; };
  const taken = new Set(), birud = {};
  const give = (o, t) => { if (o && !taken.has(o.key)) { taken.add(o.key); birud[o.key] = t; } };
  give(best(o => o.speedN>=5 ? -o.speedSum/o.speedN : null), 'સૌથી ઝડપી');
  give(best(o => o.dhal, 1), 'સાચો સેવક');
  give(best(o => o.baanLanded, 1), 'વીર');
  give(best(o => o.mitra ? o.mitra.matches : null, 1), 'જોડીનો રાજા');
  give(best(o => o.speedN, 20), 'છેલ્લે સુધી સાથી');
  for (const o of list) o.birud = birud[o.key] || 'સંગમ સાથી';
  // zones
  const zs = Object.keys(zoneN).map(z => {
    const m = list.filter(o => o.zone === z), avg = m.reduce((s,o)=>s+o.total,0) / m.length;
    return { zone:z, n:m.length, avg:+avg.toFixed(2), loss:+loss[z].toFixed(1), score:+(avg*(1-loss[z]/100)).toFixed(2) };
  }).sort((a,b)=>b.score-a.score);
  const pl = list.slice().sort((a,b)=>b.total-a.total || b.open-a.open || a.name.localeCompare(b.name));
  const sh = list.filter(o => o.shubhDone);
  const pratham = sh.slice().sort((a,b)=>a.shubhOrd-b.shubhOrd || a.shubhTs-b.shubhTs)[0] || null;
  const shiromani = sh.slice().sort((a,b)=>b.total-a.total)[0] || null;
  const brief = o => o ? { name:o.name, zone:o.zone, avatar:o.avatar, total:+o.total.toFixed(1) } : null;
  const win = {
    z3: zs[2] ? { ...zs[2] } : null, z2: zs[1] ? { ...zs[1] } : null, z1: zs[0] ? { ...zs[0] } : null,
    p3: brief(pl[2]), p2: brief(pl[1]), p1: brief(pl[0]),
    chinh: list.filter(o=>o.chinh).map(brief),
    jodi: bestPair ? { a:brief(R[bestPair.a]), b:brief(R[bestPair.b]), n:bestPair.n } : null,
    pratham: pratham ? { ...brief(pratham), line:LINE_NAMES[pratham.shubh] } : null,
    shiromani: shiromani ? brief(shiromani) : null,
    shubhAll: sh.map(brief)
  };
  r.res = { R, zones: zs, win, yTable, loss, chinhCi: r.chinh, mosaic: list.map(o=>o.open).sort((a,b)=>b-a), nShubh: sh.length };
}

// ---------- state (what each screen is allowed to see) ----------
function remainingNums(r){ const a=[]; for (let i=r.phase*PER;i<(r.phase+1)*PER;i++) if(!r.usedIdx.includes(i)) a.push(i+1); return a; }
function publicState(r){
  const P = Object.values(r.players), byZone = {};
  r.zones.forEach(z => byZone[z] = { n:0, marked:0, picked:0 });
  const idx = r.curIdx;
  P.forEach(p => { const z = byZone[p.zone]; if (!z) return; z.n++; if (idx != null && p.markTs[idx] != null) z.marked++; if (r.status==='yuddh' && (r.yuddh[r.phase]||{})[p.key]) z.picked++; });
  const S = {
    code:r.code, status:r.status, phase:r.phase, phaseNames:r.phaseNames, zones:r.zones, qSec:r.qSec, nQ:NQ, per:PER,
    now:Date.now(), timerEnd:r.timerEnd, paused:!!r.paused, pausedMs:r.pausedMs||0,
    qNo: idx!=null ? idx+1 : null, used:r.usedIdx.length, wheelNums:r.wheelNums||null, spinAt:r.spinAt||0,
    nPlayers:P.length, byZone, pickEnd:r.pickEnd, yuddhEnd:r.yuddhEnd, step:r.step,
    pickIn: r.status==='pick' ? P.filter(p=>p.pickedAt).length : 0,
    yIn: r.status==='yuddh' ? Object.keys(r.yuddh[r.phase]||{}).length : 0
  };
  if (r.status==='question' || r.status==='locked') { const q=r.questions[idx]; S.q = q.q; if (q.img) S.qImg = q.img; S.markedNow = P.filter(p=>p.markTs[idx]!=null).length; }
  if (r.status==='reveal' && r.res) S.reveal = revealView(r);
  return S;
}
function revealView(r){
  const s = r.step, R = r.res, v = { step:s, steps:STEPS, win:{}, chitra:null };
  STEPS.forEach((k,i) => { if (i > s) return; if (k==='tiles') return; if (k==='yuddh') v.yuddh = { table:R.yTable, loss:R.loss, zones:r.zones }; else if (k==='chitra') { v.mosaic = R.mosaic; v.nShubh=R.nShubh; v.shubhAll=R.win.shubhAll; } else v.win[k] = R.win[k]; });
  return v;
}
function hostState(r){
  const S = publicState(r);
  S.hostName = r.hostName; S.chinh = r.chinh;
  S.players = Object.values(r.players).map(p => ({ key:p.key, name:p.name, zone:p.zone, avatar:p.avatar, online:p.online!==false, marks:Object.keys(p.marks).length, bot:!!p.bot }));
  S.questions = r.questions.map(q => ({ q:q.q, a:q.a, img:q.img }));
  S.botsPlay = !!r.botsPlay;
  return S;
}
function playerState(r, p){
  const S = publicState(r);
  S.me = { key:p.key, name:p.name, zone:p.zone, avatar:p.avatar, card:p.card, marks:p.marks, shubh:p.shubh, kavach:p.kavach,
           yChoice: (r.yuddh[r.phase]||{})[p.key] || null, pickedAt: !!p.pickedAt };
  S.lineNames = LINE_NAMES;
  if (r.status==='reveal' && r.res && r.res.R[p.key]) {
    const o = r.res.R[p.key];
    S.me.result = { tiles:o.tiles, bd:o.bd, total:+o.total.toFixed(1), birud:o.birud, mitra:o.mitra, duels:o.duels, shubhDone:o.shubhDone, chinhCi:r.chinh, lines:o.lines, full:o.full, shubh:o.shubh, kavach:o.kavach };
    S.picture = '/chitra/' + r.code;
  }
  return S;
}
let pending = {};
function broadcast(code, now){
  if (now) return doBroadcast(code);
  if (pending[code]) return; pending[code] = setTimeout(() => { delete pending[code]; doBroadcast(code); }, 120);
}
function doBroadcast(code, onlyHost){
  const r = rooms[code]; if (!r) return;
  try {
    const H = hostState(r);
    io.to(code+':h').emit('state', H);
    const pub = publicState(r); if (r.status==='lobby') pub.players = Object.values(r.players).map(p=>({name:p.name,zone:p.zone,avatar:p.avatar}));
    io.to(code+':pj').emit('state', pub);
    if (onlyHost) return;
    for (const p of Object.values(r.players)) if (p.sid && !p.bot) io.to(p.sid).emit('state', playerState(r, p));
  } catch(e){ console.error('broadcast', e && e.stack || e); }
}

// ---------- game flow ----------
function pairDuels(r, ph){
  const P = shuffle(Object.values(r.players)), left = new Set(P.map(p=>p.key)), d = {};
  for (const a of P) {
    if (!left.has(a.key)) continue; left.delete(a.key);
    const cand = P.filter(b => left.has(b.key) && b.zone !== a.zone);
    if (!cand.length) continue;
    const b = cand[Math.floor(Math.random()*cand.length)]; left.delete(b.key); d[a.key]=b.key; d[b.key]=a.key;
  }
  r.duel[ph] = d;
}
function pairMitras(r){
  const byZ = {}; Object.values(r.players).forEach(p => (byZ[p.zone] = byZ[p.zone] || []).push(p));
  for (const z of Object.keys(byZ)) {
    const a = shuffle(byZ[z]);
    for (let i=0;i+1<a.length;i+=2) { a[i].mitra=a[i+1].key; a[i+1].mitra=a[i].key; }
    if (a.length%2===1 && a.length>1) { a[a.length-1].mitra = a[0].key; } // odd one out: borrows a friend (one-way)
  }
}
function finishPick(r){
  if (r.status !== 'pick') return;
  for (const p of Object.values(r.players)) {
    if (p.shubh == null) p.shubh = Math.floor(Math.random()*12);
    if (p.kavach == null) p.kavach = Math.floor(Math.random()*25);
  }
  pairMitras(r); pairDuels(r, 0);
  r.status = 'active'; r.phase = 0; r.pickEnd = null; broadcast(r.code, true);
}
function startReveal(r, idx){
  r.status = 'revealing'; r.curIdx = idx; broadcast(r.code, true);
  setTimeout(() => {
    if (r.status !== 'revealing' || r.curIdx !== idx) return;
    r.status = 'question'; r.qOpenAt = Date.now(); r.timerEnd = Date.now() + r.qSec*1000; r.paused = false; r.pausedMs = null;
    broadcast(r.code, true); botsAnswer(r, idx);
  }, DEF.revealMs);
}
function lockQ(r){
  if (r.status !== 'question') return;
  r.status = 'locked'; r.timerEnd = null; r.paused = false; r.pausedMs = null; broadcast(r.code, true);
}
function botsAnswer(r, idx){
  if (!r.botsPlay) return;
  for (const p of Object.values(r.players)) {
    if (!p.bot) continue;
    setTimeout(() => {
      if (r.status !== 'question' || r.curIdx !== idx) return;
      const used = new Set(Object.keys(p.marks).map(Number));
      let ci = p.card.indexOf(r.questions[idx].a); if (ci < 0 || used.has(ci) || Math.random() < 0.25) { const f=[...Array(25).keys()].filter(i=>!used.has(i)); ci = f[Math.floor(Math.random()*f.length)]; }
      if (ci == null) return; p.marks[ci] = idx; p.markTs[idx] = Date.now() - r.qOpenAt; hostPing(r.code);
    }, (FAST?50:1500) + Math.random()*(FAST?100:(r.qSec*600)));
  }
}
function botsYuddh(r){
  if (!r.botsPlay) return;
  const ch = r.yuddh[r.phase] = r.yuddh[r.phase] || {};
  for (const p of Object.values(r.players)) if (p.bot) { const o = r.zones.filter(z=>z!==p.zone); ch[p.key] = Math.random()<0.5 || !o.length ? { t:'dhal' } : { t:'baan', z:o[Math.floor(Math.random()*o.length)] }; }
}
function startYuddh(r){
  if (r.status !== 'locked' || remainingNums(r).length) return;
  r.status = 'yuddh'; r.yuddhEnd = Date.now() + DEF.yuddhSec*1000; r.yuddh[r.phase] = r.yuddh[r.phase] || {};
  botsYuddh(r); broadcast(r.code, true);
}
let _hp = {}; function hostPing(code){ if (_hp[code]) return; _hp[code] = setTimeout(()=>{ delete _hp[code]; const r=rooms[code]; if(!r) return; io.to(code+':h').emit('state', hostState(r)); const pub=publicState(r); io.to(code+':pj').emit('state', pub); }, 400); }

setInterval(() => {
  const now = Date.now();
  for (const r of Object.values(rooms)) {
    if (r.status==='question' && !r.paused && r.timerEnd && now >= r.timerEnd) lockQ(r);
    else if (r.status==='pick' && r.pickEnd && now >= r.pickEnd) finishPick(r);
    else if (r.status==='yuddh' && r.yuddhEnd && now >= r.yuddhEnd) { r.status='yuddhwait'; r.yuddhEnd=null; broadcast(r.code, true); }
  }
}, 250);
setInterval(() => { const cut = Date.now()-48*3600*1000; for (const c of Object.keys(rooms)) if (rooms[c].createdAt < cut) delete rooms[c]; }, 3600*1000);

// ---------- sockets ----------
io.on('connection', socket => {
  socket.on('time:sync', (x, cb) => { if (typeof cb === 'function') cb(Date.now()); });
  let _n = 0, _t = Date.now();
  const rate = () => { const n = Date.now(); if (n-_t > 1000) { _t=n; _n=0; } return ++_n > 40; };
  const roomOf = code => rooms[String(code||'').toUpperCase()];
  const hostRoom = code => (socket.data.host ? roomOf(code) : null);

  socket.on('host:login', ({ id, pw } = {}, cb) => { const ok = id === HOST_ID && pw === HOST_PW; socket.data.host = ok; cb && cb({ ok }); });
  socket.on('host:create', (o = {}, cb) => {
    if (!socket.data.host) return cb && cb({ ok:false, error:'Login કરો' });
    const parsed = parseQuestions(o.qaText);
    if (!parsed.ok) return cb && cb({ ok:false, error:parsed.errors.join('\n') });
    const zones = Array.from(new Set(String(o.zones||'').split(',').map(s=>s.trim().slice(0,14)).filter(Boolean))).slice(0,8);
    let code; do { code = randCode(); } while (rooms[code]);
    const pn = Array.from({length:PHASES}, (_,i) => String((o.phaseNames||[])[i]||'').trim().slice(0,30) || DEF.phaseNames[i]);
    const r = rooms[code] = {
      code, hostName:String(o.hostName||'Host').slice(0,40), status:'lobby', phase:0, questions:parsed.questions,
      zones: zones.length>=2 ? zones : DEF.zones, phaseNames:pn, qSec: Math.max(10, Math.min(120, +o.qSec || DEF.qSec)),
      maxPlayers: +o.maxPlayers > 0 ? +o.maxPlayers : 1000,
      players:{}, usedIdx:[], curIdx:null, timerEnd:null, step:0, yuddh:[{},{},{},{}], duel:[{},{},{},{}], chinh:Math.floor(Math.random()*25), createdAt:Date.now()
    };
    socket.join(code+':h'); socket.data.code = code; broadcast(code, true);
    cb && cb({ ok:true, code, zones:r.zones });
  });
  socket.on('host:restore', ({ code } = {}, cb) => { const r = hostRoom(code); if (!r) return cb && cb({ ok:false }); socket.join(r.code+':h'); cb && cb({ ok:true, code:r.code }); doBroadcast(r.code, true); });
  socket.on('pj:join', ({ code } = {}, cb) => { const r = roomOf(code); if (!r) return cb && cb({ ok:false }); socket.join(r.code+':pj'); cb && cb({ ok:true }); const pub=publicState(r); if(r.status==='lobby') pub.players=Object.values(r.players).map(p=>({name:p.name,zone:p.zone,avatar:p.avatar})); socket.emit('state', pub); });

  const H = (name, fn) => socket.on(name, (a = {}, cb) => { const r = hostRoom(a.code); if (!r) return cb && cb({ ok:false }); try { const res = fn(r, a); broadcast(r.code, true); cb && cb(Object.assign({ ok:true }, res||{})); } catch(e){ console.error(name, e); cb && cb({ ok:false }); } });
  H('host:start', r => { if (r.status !== 'lobby') return; if (Object.keys(r.players).length < 1) throw new Error('no players'); r.status = 'pick'; r.pickEnd = Date.now() + DEF.pickSec*1000;
    for (const p of Object.values(r.players)) if (p.bot) { p.shubh = Math.floor(Math.random()*12); p.kavach = Math.floor(Math.random()*25); } });
  H('host:skipPick', r => finishPick(r));
  H('host:spin', r => {
    if (r.status !== 'active' && r.status !== 'locked') return;
    const avail = remainingNums(r); if (!avail.length) return;
    const idx = avail[Math.floor(Math.random()*avail.length)] - 1;
    r.wheelNums = avail; r.spinAt = Date.now(); r.status = 'spinning'; r.curIdx = idx; r.usedIdx.push(idx); r.timerEnd = null;
    setTimeout(() => { if (r.status === 'spinning' && r.curIdx === idx) startReveal(r, idx); }, FAST ? 300 : 9000);
  });
  H('host:spinComplete', r => { if (r.status === 'spinning') startReveal(r, r.curIdx); });
  H('host:skipTimer', r => lockQ(r));
  H('host:adj', (r, a) => { if (r.status==='question' && r.timerEnd) r.timerEnd = Math.max(Date.now()+2000, r.timerEnd + (+a.delta||0)*1000); });
  H('host:pause', r => { if (r.status==='question' && !r.paused) { r.paused = true; r.pausedMs = Math.max(0, r.timerEnd - Date.now()); r.timerEnd = null; } });
  H('host:resume', r => { if (r.status==='question' && r.paused) { r.paused = false; r.timerEnd = Date.now() + (r.pausedMs||0); r.pausedMs = null; } });
  H('host:startYuddh', r => startYuddh(r));
  H('host:skipYuddh', r => { if (r.status==='yuddh') { r.status='yuddhwait'; r.yuddhEnd=null; } });
  H('host:nextPhase', r => {
    if (r.status !== 'yuddhwait') return;
    if (r.phase < PHASES-1) { r.phase++; pairDuels(r, r.phase); r.status = 'active'; r.wheelNums = null; }
    else r.status = 'final';
  });
  H('host:final', r => { if (r.status !== 'final') return; computeResults(r); r.status = 'reveal'; r.step = 0; });
  H('host:next', r => { if (r.status === 'reveal' && r.step < STEPS.length-1) r.step++; });
  H('host:prev', r => { if (r.status === 'reveal' && r.step > 0) r.step--; });
  H('host:setQSec', (r, a) => { r.qSec = Math.max(10, Math.min(120, +a.sec||30)); });
  H('host:setNames', (r, a) => { r.phaseNames = r.phaseNames.map((n,i)=>String((a.names||[])[i]||'').trim().slice(0,30)||n); });
  H('host:kick', (r, a) => { const p = r.players[a.key]; if (p) { if (p.sid) io.to(p.sid).emit('kicked'); delete r.players[a.key]; } });
  H('host:addBots', (r, a) => { const n = Math.max(1, Math.min(600, +a.n||10)); for (let i=0;i<n;i++) { const key = 'b'+tok(); const z = r.zones[Math.floor(Math.random()*r.zones.length)];
      r.players[key] = { key, token:key, name:'Bot '+(Object.keys(r.players).length+1), zone:z, avatar:'🤖', card:makeCard(r.questions), marks:{}, markTs:{}, shubh:null, kavach:null, bot:true, online:true, joinedAt:Date.now() }; } r.botsPlay = true; });
  H('host:end', r => { delete rooms[r.code]; });

  // ----- players -----
  function attach(r, p){ p.sid = socket.id; p.online = true; socket.join(r.code); socket.data.pcode = r.code; socket.data.pkey = p.key; }
  socket.on('player:join', (a = {}, cb) => {
    const r = roomOf(a.code); if (!r) return cb && cb({ ok:false, error:'Room code ખોટો છે' });
    if (a.token) { const p = Object.values(r.players).find(x => x.token === a.token); if (p) { attach(r, p); cb && cb({ ok:true, token:p.token }); return doBroadcast(r.code); } }
    if (r.status !== 'lobby' && r.status !== 'pick') return cb && cb({ ok:false, error:'ગેમ શરૂ થઈ ગઈ છે' });
    if (Object.keys(r.players).length >= r.maxPlayers) return cb && cb({ ok:false, error:'Room ભરાઈ ગયો છે' });
    let name = String(a.name||'').trim().slice(0,24); if (!name) return cb && cb({ ok:false, error:'નામ લખો' });
    const zone = r.zones.includes(a.zone) ? a.zone : null; if (!zone) return cb && cb({ ok:false, error:'Zone પસંદ કરો' });
    const names = new Set(Object.values(r.players).map(p=>p.name.toLowerCase())); let nm = name, k = 2; while (names.has(nm.toLowerCase())) nm = name+' '+(k++);
    const key = tok();
    const p = r.players[key] = { key, token:key, name:nm, zone, avatar:String(a.avatar||'🦁').slice(0,4), card:makeCard(r.questions), marks:{}, markTs:{}, shubh:null, kavach:null, joinedAt:Date.now() };
    attach(r, p); cb && cb({ ok:true, token:key }); broadcast(r.code);
  });
  const mine = a => { const r = roomOf(a && a.code); const p = r && r.players[socket.data.pkey]; return (r && p) ? [r, p] : [null, null]; };
  socket.on('player:pick', (a = {}, cb) => {
    const [r, p] = mine(a); if (!r || r.status !== 'pick') return cb && cb({ ok:false });
    if (Number.isInteger(a.shubh) && a.shubh>=0 && a.shubh<12) p.shubh = a.shubh;
    if (Number.isInteger(a.kavach) && a.kavach>=0 && a.kavach<25) p.kavach = a.kavach;
    p.pickedAt = p.shubh!=null && p.kavach!=null ? Date.now() : 0;
    cb && cb({ ok:true, shubh:p.shubh, kavach:p.kavach }); hostPing(r.code);
  });
  socket.on('player:mark', (a = {}, cb) => {
    if (rate()) return; const [r, p] = mine(a);
    if (!r || r.status !== 'question' || r.paused || (r.timerEnd && Date.now() > r.timerEnd + 400)) return cb && cb({ ok:false, marks:p&&p.marks });
    const ci = a.ci; if (!Number.isInteger(ci) || ci<0 || ci>24) return cb && cb({ ok:false });
    const qi = r.curIdx;
    if (p.marks[ci] !== undefined && p.marks[ci] !== qi) return cb && cb({ ok:false, marks:p.marks });
    if (p.marks[ci] === qi) { delete p.marks[ci]; delete p.markTs[qi]; }
    else { for (const k of Object.keys(p.marks)) if (p.marks[k] === qi) delete p.marks[k]; p.marks[ci] = qi; p.markTs[qi] = Date.now() - r.qOpenAt; }
    cb && cb({ ok:true, marks:p.marks }); hostPing(r.code);
  });
  socket.on('player:yuddh', (a = {}, cb) => {
    const [r, p] = mine(a); if (!r || r.status !== 'yuddh') return cb && cb({ ok:false });
    const ch = r.yuddh[r.phase] = r.yuddh[r.phase] || {};
    if (a.t === 'dhal') ch[p.key] = { t:'dhal' };
    else if (a.t === 'baan' && r.zones.includes(a.z) && a.z !== p.zone) ch[p.key] = { t:'baan', z:a.z };
    else return cb && cb({ ok:false });
    cb && cb({ ok:true, choice:ch[p.key] }); hostPing(r.code);
  });
  socket.on('disconnect', () => { const r = rooms[socket.data.pcode]; const p = r && r.players[socket.data.pkey]; if (p && p.sid === socket.id) { p.online = false; hostPing(r.code); } });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('The Sangam running on port ' + PORT));
