// v2 재설계(보충 공급·줌 고정·선형 점수·보스 광란·즉시 일섬) 봇 측정. 실행: node tests/v2-bench.js [seeds=60] [only=이름,...] [키=값 ...]
// 키=값은 CFG 덮어쓰기(점 경로): 예) refill.acts.2.n=30 chainStep=0.2 boss.at=13
// 봇 결과는 규칙이 어떤 손을 보상하는지 보는 자동 측정일 뿐, 사람 플레이 검증이 아니다.
const A = require("../arena/game.js");
const { CFG } = A;
const args = {}; const over = [];
for (const a of process.argv.slice(2)) { const [k, v] = a.split("="); if (k === "seeds" || k === "only") args[k] = v; else over.push([k, v]); }
for (const [k, v] of over) { const ks = k.split("."), last = ks.pop(); let o = CFG; for (const x of ks) o = o[x]; o[last] = v === "true" ? true : v === "false" ? false : +v; }
const SEEDS = Array.from({ length: +(args.seeds || 60) }, (_, i) => 1001 + i * 7);
const DIRS = 48;
function prng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
const live = (e) => e.alive && e.dying <= 0;

// 조준 봇의 선택: 방향 48 × 커서 거리(가까움/중간/벽). 붉은 것이 걸리는 길은 버린다. accept로 후보를 거른다
function bestLine(s, accept = () => true) {
  let best = null;
  for (let i = 0; i < DIRS; i++) {
    const a = i / DIRS * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
    for (const r of [10, 250, 99999]) {
      const tx = s.p.x + c * r, ty = s.p.y + sn * r, pl = A.plan(s, tx, ty);
      if (!pl || pl.red.length || !accept(pl)) continue;
      if (!best || pl.cut.length > best.n) best = { n: pl.cut.length, tx, ty };
    }
  }
  return best && best.n >= 1 ? best : null;
}
const boss1 = (s) => s.enemies.find((e) => e.type === "boss" && live(e) && e.hp === 1);
const aim = (every) => ({ every, waitDash: true, pick: (s) => bestLine(s) });
const BOTS = {
  "aim0.1": aim(0.1), "aim0.15": aim(0.15), "aim0.3": aim(0.3), "aim0.5": aim(0.5), "aim1.0": aim(1.0),
  // 빨강 피하는 잔디깎기: 0.12초마다 가장 가까운 적 쪽으로 짧게(+100). 그 짧은 길에 붉은 것이 보이면 누르지 않는다
  mowerSafe: { every: 0.12, waitDash: false, pick(s, r) {
    let e0 = null, d0 = Infinity;
    for (const e of s.enemies) if (live(e)) { const d = Math.hypot(e.x - s.p.x, e.y - s.p.y); if (d < d0) { d0 = d; e0 = e; } }
    const a = e0 ? Math.atan2(e0.y - s.p.y, e0.x - s.p.x) : r() * Math.PI * 2, c = { tx: s.p.x + Math.cos(a) * 100, ty: s.p.y + Math.sin(a) * 100 };
    const pl = A.plan(s, c.tx, c.ty); return pl && pl.red.length ? null : c; } },
  // 아무 데나: 판 위 무작위 지점을 0.15초마다(붉은 것 확인 없음)
  random: { every: 0.15, waitDash: false, pick(s, r) { const b = A.bounds(s); return { tx: b.x0 + r() * b.w, ty: b.y0 + r() * b.h }; } },
  // 보스: 빈사(체력 1)가 되면 바로 끊기 vs 19초까지 살려 두고 다른 적만 베기. 둘 다 0.15초 조준
  bossNow: { every: 0.15, waitDash: true, pick(s) { const b = boss1(s); return (b && bestLine(s, (pl) => pl.cut.includes(b))) || bestLine(s); } },
  bossWait: { every: 0.15, waitDash: true, pick(s) { const b = boss1(s);
    if (b && s.t >= 19) return bestLine(s, (pl) => pl.cut.includes(b)) || bestLine(s);
    return b ? bestLine(s, (pl) => !pl.cut.includes(b)) : bestLine(s); } },
};

function play(seed, bot, instant) {
  const s = A.createGame(seed, { chop: true, instant });
  const r = prng(seed * 31 + 7), dt = 1 / 60;
  let think = 0, fr = 0, sum = 0, mx = 0, hurts = 0, bossT = null, lv3 = null, frenzyPts = 0, clicks = 0, last = null;
  while (s.state === "play" && s.t < 25) {
    think -= dt;
    if (think <= 0 && !(bot.waitDash && s.dash)) { think = bot.every; const c = bot.pick(s, r); if (c) A.slash(s, c.tx, c.ty); }
    if (s.dash && s.dash !== last) { last = s.dash; clicks++; }
    A.update(s, dt);
    if (s.started) { const n = s.enemies.filter(live).length; fr++; sum += n; mx = Math.max(mx, n); }
    for (const ev of s.events) {
      if (ev.type === "hurt") hurts++;
      if (ev.type === "bossdown") bossT = s.t;
      if (ev.type === "multi" && ev.frenzy) frenzyPts += ev.pts / 2;
      if (ev.type === "level" && ev.lv === 3 && lv3 == null) lv3 = s.t;
    }
    s.events.length = 0;
  }
  return { score: s.score, kills: s.kills, red: s.result && s.result.kind === "red", avg: sum / Math.max(1, fr), mx, hurts, bossT, lv3, maxLv: s.maxLv, frenzyPts, cps: clicks / Math.max(1, Math.min(20, s.t)) };
}
const med = (xs) => { const a = [...xs].sort((x, y) => x - y), n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : NaN; };
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

console.log(`v2 봇 측정(사람 아님). 시드 ${SEEDS.length}개(1001+7k), chop on, 1/60초 프레임. 덮어쓰기: ${over.map((x) => x.join("=")).join(" ") || "없음"}`);
console.log(`acts ${JSON.stringify(CFG.refill.acts)} scoreBase ${CFG.scoreBase} chain ${CFG.chainStep}/${CFG.chainMax}/${CFG.chainWindow}s boss.at ${CFG.boss.at} frenzy ${CFG.boss.frenzy}s×${CFG.boss.frenzyMul}`);
console.log("instant bot        score_med [Q1-Q3]          kills  red%  hurts  avgLive  maxLive(med/max)  clicks/s  maxLv  LV3시각");
const R = {};
const only = args.only ? args.only.split(",") : null;
for (const instant of [true, false]) {
  for (const [name, bot] of Object.entries(BOTS)) {
    if (only && !only.includes(name)) continue;
    if (!instant && (name.startsWith("boss"))) continue;
    const rs = SEEDS.map((sd) => play(sd, bot, instant)); R[(instant ? "on." : "off.") + name] = rs;
    const sc = rs.map((x) => x.score), q = (p) => { const a = [...sc].sort((x, y) => x - y), i = (a.length - 1) * p, lo = Math.floor(i); return a[lo] + (a[Math.ceil(i)] - a[lo]) * (i - lo); };
    const l3 = rs.map((x) => x.lv3).filter((x) => x != null);
    console.log(`${instant ? "on " : "off"}     ${name.padEnd(10)} ${String(Math.round(med(sc))).padStart(6)} [${Math.round(q(0.25))}-${Math.round(q(0.75))}]`.padEnd(47)
      + `${String(med(rs.map((x) => x.kills))).padStart(5)}  ${(100 * rs.filter((x) => x.red).length / rs.length).toFixed(0).padStart(4)}  ${mean(rs.map((x) => x.hurts)).toFixed(1).padStart(5)}  ${mean(rs.map((x) => x.avg)).toFixed(1).padStart(7)}  ${String(med(rs.map((x) => x.mx))).padStart(8)}/${String(Math.max(...rs.map((x) => x.mx))).padEnd(8)}  ${mean(rs.map((x) => x.cps)).toFixed(2).padStart(8)}  ${String(med(rs.map((x) => x.maxLv))).padStart(5)}  ${l3.length ? med(l3).toFixed(1) : "-"}(${l3.length}/${rs.length})`);
  }
}
const m = (k) => med(R[k].map((x) => x.score));
if (R["on.aim0.15"] && R["on.aim0.3"] && R["on.aim0.5"] && R["on.aim1.0"]) {
  const o = ["aim0.1", "aim0.15", "aim0.3", "aim0.5", "aim1.0"].map((b) => m("on." + b));
  console.log(`\n목표1 빠를수록 점수↑(0.15 > 0.3 > 0.5 > 1.0): ${o.map((x) => Math.round(x)).join(" / ")} → ${o[1] > o[2] && o[2] > o[3] && o[3] > o[4] ? "충족" : "미충족"}`);
}
if (R["on.mowerSafe"]) {
  const best = Math.max(...["aim0.1", "aim0.15", "aim0.3"].filter((b) => R["on." + b]).map((b) => m("on." + b)));
  console.log(`목표2 최고 조준 / 빨강 피하는 잔디깎기 = ${(best / m("on.mowerSafe")).toFixed(2)} (기준 >= 3) / 아무 데나 대비 ${(best / m("on.random")).toFixed(2)}`);
}
if (R["on.bossNow"] && R["on.bossWait"]) {
  const a = R["on.bossNow"], b = R["on.bossWait"], wins = b.filter((x, i) => x.score > a[i].score).length;
  const bt = (rs) => { const t = rs.map((x) => x.bossT).filter((x) => x != null); return `${med(t).toFixed(1)}초(${t.length}/${rs.length}판 처치)`; };
  console.log(`목표3 보스 즉시 ${Math.round(m("on.bossNow"))} vs 19초까지 살림 ${Math.round(m("on.bossWait"))}, 살림 쪽이 이긴 판 ${wins}/${a.length}. 처치 시각 중앙값 즉시 ${bt(a)} / 살림 ${bt(b)}. 광란 덕 점수 중앙값(즉시) ${Math.round(med(a.map((x) => x.frenzyPts)))}`);
}
const allAvg = Object.values(R).flat().map((x) => x.avg);
console.log(`목표4 평균 적 수(전 봇·전 판 평균) ${mean(allAvg).toFixed(1)}, 판별 평균의 최대 ${Math.max(...allAvg).toFixed(1)} (기준 <= 30)`);
if (R["off.aim0.15"]) console.log(`instant on/off 점수 중앙값: ` + ["aim0.1", "aim0.15", "aim0.3", "aim0.5", "aim1.0", "mowerSafe", "random"].filter((b) => R["off." + b]).map((b) => `${b} ${Math.round(m("on." + b))}/${Math.round(m("off." + b))}`).join("  "));
