// chop 시험 모드 봇 비교. 실행: node tests/chop-bench.js [min=250] [over=90] [chainMax=3] [seeds=30]
// 봇 결과는 규칙이 어떤 손을 보상하는지 보는 자동 측정일 뿐, 사람 플레이 검증이 아니다.
const A = require("../arena/game.js");
const { CFG } = A;
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split("=")).map(([k, v]) => [k, +v]));
if (args.min != null) CFG.chop.min = args.min;
if (args.over != null) CFG.chop.over = args.over;
if (args.chainMax != null) CFG.chainMax = args.chainMax;
const SEEDS = Array.from({ length: args.seeds || 30 }, (_, i) => 101 + i * 7);
const DIRS = 48;

function prng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
const live = (e) => e.alive && e.dying <= 0;

// 조준 봇의 선택: 방향 48 × 커서 거리(가까움/중간/벽). chop=false면 거리와 상관없이 벽까지라 한 거리만 본다
function bestLine(s) {
  const dists = s.chop ? [10, 250, 99999] : [100];
  let best = null;
  for (let i = 0; i < DIRS; i++) {
    const a = i / DIRS * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
    for (const r of dists) {
      const tx = s.p.x + c * r, ty = s.p.y + sn * r, pl = A.plan(s, tx, ty);
      if (!pl || pl.red.length) continue;
      if (!best || pl.cut.length > best.n) best = { n: pl.cut.length, tx, ty };
    }
  }
  return best;
}

const BOTS = {
  // 잔디깎기: 0.12초마다, 가장 가까운 적 쪽으로 짧게(현재 위치+방향*100). 조준·붉은 것 확인 없이 연타
  mower: { every: 0.12, waitDash: false, pick(s, r) {
    let e0 = null, d0 = Infinity;
    for (const e of s.enemies) if (live(e)) { const d = Math.hypot(e.x - s.p.x, e.y - s.p.y); if (d < d0) { d0 = d; e0 = e; } }
    const a = e0 ? Math.atan2(e0.y - s.p.y, e0.x - s.p.x) : r() * Math.PI * 2;
    return { tx: s.p.x + Math.cos(a) * 100, ty: s.p.y + Math.sin(a) * 100 };
  } },
  // 참고용: 잔디깎기와 같되 그 짧은 선에 붉은 것이 보이면 누르지 않는다("조금씩 연타로 다 썰기" 우려를 붉은 것 사망과 떼어 본다)
  mowerSafe: { every: 0.12, waitDash: false, pick(s, r) { const c = BOTS.mower.pick(s, r), pl = A.plan(s, c.tx, c.ty); return pl && pl.red.length ? null : c; } },
  fastAim: { every: 0.3, waitDash: true, pick: (s) => bestLine(s) },
  slowAim: { every: 1.0, waitDash: true, pick: (s) => bestLine(s) },
  // 아무 데나: 판 위 무작위 지점을 0.15초마다
  random: { every: 0.15, waitDash: false, pick(s, r) { const b = A.bounds(s); return { tx: b.x0 + r() * b.w, ty: b.y0 + r() * b.h }; } },
};

function play(seed, bot, chop) {
  const s = A.createGame(seed); s.chop = chop;
  const r = prng(seed * 31 + 7), dt = 1 / 60;
  let think = 0, last = null, hurts = 0;
  const travel = [];
  const seen = () => { if (s.dash && s.dash !== last) { last = s.dash; travel.push(s.dash.segs[0].L * s.zoom); } };
  while (s.state === "play" && s.t < 25) {
    think -= dt;
    if (think <= 0 && !(bot.waitDash && s.dash)) {
      think = bot.every;
      const c = bot.pick(s, r);
      if (c) { A.slash(s, c.tx, c.ty); seen(); }
    }
    A.update(s, dt); seen();
    for (const ev of s.events) if (ev.type === "hurt") hurts++;
    s.events.length = 0;
  }
  return { score: s.score, red: s.result && s.result.kind === "red", hurts, kills: s.kills, travel };
}

const q = (xs, p) => { const a = [...xs].sort((x, y) => x - y), i = (a.length - 1) * p, lo = Math.floor(i); return a[lo] + (a[Math.ceil(i)] - a[lo]) * (i - lo); };
console.log(`chop.min=${CFG.chop.min} chop.over=${CFG.chop.over} chainMax=${CFG.chainMax} seeds=${SEEDS.length} (봇 측정, 사람 아님)`);
console.log("mode bot      score_med [Q1-Q3]       red%  hurts  kills  dashes  px/dash  >500px%");
const med = {};
for (const chop of [false, true]) {
  for (const [name, bot] of Object.entries(BOTS)) {
    const rs = SEEDS.map((sd) => play(sd, bot, chop)), all = rs.flatMap((x) => x.travel);
    const sc = rs.map((x) => x.score), m = q(sc, 0.5);
    med[(chop ? "on." : "off.") + name] = m;
    const avg = (f) => rs.reduce((a, x) => a + f(x), 0) / rs.length;
    console.log(`${chop ? "on " : "off"}  ${name.padEnd(8)} ${String(Math.round(m)).padStart(6)} [${Math.round(q(sc, 0.25))}-${Math.round(q(sc, 0.75))}]`.padEnd(38)
      + `${(100 * rs.filter((x) => x.red).length / rs.length).toFixed(0).padStart(4)}  ${avg((x) => x.hurts).toFixed(1).padStart(5)}  ${Math.round(avg((x) => x.kills)).toString().padStart(5)}  ${avg((x) => x.travel.length).toFixed(0).padStart(6)}  ${(all.reduce((a, b) => a + b, 0) / Math.max(1, all.length)).toFixed(0).padStart(7)}  ${(100 * all.filter((v) => v > 500).length / Math.max(1, all.length)).toFixed(0).padStart(6)}`);
  }
}
const on = (k) => med["on." + k];
const r1 = on("fastAim") / Math.max(on("mower"), on("random")), r2 = on("fastAim") / on("slowAim");
console.log(`chop on: 빠른조준 / max(잔디깎기, 아무데나) = ${r1.toFixed(2)} (기준 >= 2), 빠른조준 / 느린조준 = ${r2.toFixed(2)} (기준 > 1) → ${r1 >= 2 && r2 > 1 ? "통과" : "실패"}`);
