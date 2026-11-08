// 일섬 아레나 규칙 테스트와 자동 조작 검사. 실행: node tests/arena-sim.js
// 자동 조작 결과는 규칙이 돌아간다는 확인일 뿐 사람의 점수가 아니다.
const A = require("../arena/game.js");
const { CFG } = A;
let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const run = (s, sec) => { for (let i = 0; i < sec * 60; i++) A.update(s, 1 / 60); };
function blank() { const s = A.createGame(1); s.enemies.length = 0; s.reds.length = 0; s.redT = 99; s.firstRedPending = false; s.started = true; s.spawnT = 99; return s; }

// 1. 화면 끝까지 간다
{
  const s = blank(); A.slash(s, 900, 270); run(s, 0.5);
  ok(Math.abs(s.p.x - (A.W - CFG.pad)) < 0.5 && Math.abs(s.p.y - 270) < 0.5, "일섬은 화면 끝 벽까지 간다");
  ok(s.chain === 0 && !s.dash && A.slash(s, 100, 270), "허공이어도 경직 없이 바로 다음 일섬, 연쇄만 끊김");
}
// 2. 벤 뒤엔 짧은 회복만, 연쇄 증가
{
  const s = blank(); A.add(s, "soldier", 700, 270); A.slash(s, 900, 270); run(s, 0.3);
  ok(s.kills === 1 && s.chain === 1, "베면 연쇄 1");
}
// 3. 한 줄에 여럿 + 레벨업
{
  const s = blank(); for (let i = 0; i < 5; i++) A.add(s, "soldier", 560 + i * 60, 270);
  A.slash(s, 900, 270); run(s, 0.8);
  ok(s.kills === 5 && s.xp === 15 && s.score === 25, `다섯 명을 한 번에 꿰면 경험치 15, 점수 25(레벨 ${s.lv})`);
}
// 4. 맞으면 한 레벨 내려간다
{
  const s = blank(); s.xp = CFG.levels[3]; s.lv = 4; A.add(s, "soldier", s.p.x + 20, s.p.y); run(s, 0.1);
  ok(s.lv === 3 && s.chain === 0, "몸에 닿으면 레벨 하나 잃음");
}
// 5. 클릭 미리 입력: 일섬 중 클릭은 끝나자마자 나간다
{
  const s = blank(); A.add(s, "soldier", 700, 270); A.add(s, "soldier", 800, 100);
  A.slash(s, 900, 270); A.update(s, 1 / 60); A.slash(s, 800, 100); run(s, 0.6);
  ok(s.kills === 2, "일섬 도중 누른 클릭이 이어서 나감");
}
// 6. 산개병: 조준선이 오래 머물면 비킨다
{
  const s = blank(); const d = A.add(s, "dodger", 750, 270); A.setAim(s, 900, 270); run(s, 0.4);
  const p = A.plan(s, 900, 270);
  ok(!p.cut.includes(d), "산개병은 조준선이 머물면 옆으로 비킨다");
}
// 7. 반사 일섬(2026-11-07 사용자 결정): LV3·6·9부터 벽에서 1·2·3번 거울 반사
{
  ok([1, 2, 3, 5, 6, 8, 9, 11].map(A.bouncesOf).join() === "0,0,1,1,2,2,3,3", "반사 횟수: LV1·2=0, 3~5=1, 6~8=2, 9+=3");
  const s = blank(), segs = A.tracePath(s, 480, 270, Math.SQRT1_2, Math.SQRT1_2, 1), [a, b] = segs;
  ok(segs.length === 2 && Math.abs(a.y2 - (A.H - CFG.pad)) < 1e-6 && a.x2 === b.x1 && a.y2 === b.y1 && Math.abs(b.ux - a.ux) < 1e-9 && Math.abs(b.uy + a.uy) < 1e-9,
    `아래 벽에 닿으면 법선(y) 성분만 뒤집힌다(${a.x2.toFixed(0)},${a.y2.toFixed(0)}에서 반사)`);
  const c = A.tracePath(s, 480, 270, 1, 0, 1);
  ok(Math.abs(c[0].x2 - (A.W - CFG.pad)) < 1e-6 && c[1].ux === -1 && Math.abs(c[1].x2 - CFG.pad) < 1e-6, "정면으로 벽에 닿으면 그대로 되돌아온다");
  const shape = [];
  for (const lv of [1, 3, 6, 9]) { s.lv = lv; const pl = A.plan(s, 700, 400); shape.push(pl.segs.length);
    ok(pl.segs.every((g, i) => ["x1", "y1", "x2", "y2", "safe"].every((k) => k in g) && g.safe === (i > 0)) && pl.L === pl.segs[0].L, `plan(LV${lv}).segs: ${pl.segs.length}구간, 첫 구간만 safe:false`); }
  ok(shape.join() === "1,2,3,4", "구간 수 LV1/3/6/9 = " + shape.join("/"));
}
// 7b. 튕긴 구간은 붉은 것을 통과하고, 거기서 벤 적도 같은 일섬의 꿴 수(점수 = 꿴 수² × 연쇄)
{
  const s = blank(); s.xp = CFG.levels[2]; s.lv = 3;
  A.add(s, "soldier", 700, 270); A.add(s, "soldier", 200, 270); // 첫 구간(→오른쪽)에 하나, 튕긴 구간(←왼쪽)에 하나
  s.reds.push({ x: 300, y: 270, vx: 0, vy: 0, r: CFG.red.r, life: 99 });
  const pl = A.plan(s, 900, 270);
  ok(pl.cut.length === 2 && pl.red.length === 0, "미리보기: 튕긴 구간의 적은 cut에, 튕긴 구간의 붉은 것은 red에 없다");
  const evs = []; A.slash(s, 900, 270); let stopX = null; for (let i = 0; i < 60 && (s.dash || s.waves.length); i++) { A.update(s, 1 / 60); evs.push(...s.events); s.events.length = 0; if (!s.dash && stopX === null) stopX = s.p.x; }
  ok(Math.abs(s.p.x - (A.W - CFG.pad)) < 1 && Math.abs(stopX - s.p.x) < 1e-6, `몸은 조준한 벽에서 멈추고 검기만 튕긴다(멈춘 x ${s.p.x.toFixed(0)})`);
  const m = evs.find((e) => e.type === "multi"), bo = evs.filter((e) => e.type === "bounce");
  ok(s.state === "play" && m && m.hits === 2 && m.pts === 4 && s.score === 4, `튕긴 구간은 붉은 것을 통과, 두 구간 처치가 한 일섬 2꿰기 = ${m && m.pts}점`);
  ok(bo.length === 1 && bo[0].n === 1 && Math.abs(bo[0].x - (A.W - CFG.pad)) < 1 && evs.filter((e) => e.type === "dashEnd").length === 1, "벽에서 bounce 이벤트(n=1) 한 번, multi·dashEnd는 일섬 끝에 한 번");
  ok(s.slashes.filter((q) => q.kind === "main").map((q) => q.bounce).join() === "0,1", "s.slashes에 구간마다 하나(bounce 0, 1)");
  const s2 = blank(); s2.xp = CFG.levels[2]; s2.lv = 3; s2.reds.push({ x: 700, y: 270, vx: 0, vy: 0, r: CFG.red.r, life: 99 });
  A.slash(s2, 900, 270); run(s2, 0.5);
  ok(s2.state === "end" && s2.result.kind === "red", "첫 구간의 붉은 것은 LV3에서도 즉사");
  const s3 = blank(); s3.xp = CFG.levels[2] - 1; s3.lv = 2; A.add(s3, "soldier", 700, 270); A.slash(s3, 900, 270);
  const lvEv = []; for (let i = 0; i < 30; i++) { A.update(s3, 1 / 60); lvEv.push(...s3.events.filter((e) => e.type === "level")); s3.events.length = 0; }
  ok(lvEv.length && lvEv[0].lv === 3 && lvEv[0].perk && lvEv[0].perk.name === "BOUNCE" && lvEv[0].perk.n === 1, "LV3이 되면 level 이벤트에 perk BOUNCE 1");
}
// 7c. 한 번 긋는 최대 시간: 가장 넓은 판(줌 0.55) 모서리에서 대각선, 3번 반사여도 0.45초 이하
{
  let worst = 0;
  for (const [tx, ty] of [[1, 1], [1, 0.5], [1, 0.2], [0.3, 1]]) {
    const s = blank(); s.lv = s.maxLv = 11; s.xp = CFG.levels[10]; s.zoomTarget = s.zoom = 0.55; const b = A.bounds(s);
    s.p.x = b.x0 + CFG.pad + 1; s.p.y = b.y0 + CFG.pad + 1; A.slash(s, s.p.x + tx * 100, s.p.y + ty * 100);
    let t = 0; while ((s.dash || s.waves.length) && t < 2) { A.update(s, 1 / 240); t += 1 / 240; } worst = Math.max(worst, t);
  }
  ok(worst <= 0.45, `LV11·최대 판 3번 반사 일섬 최장 ${worst.toFixed(3)}초 <= 0.45`);
}
// 8. 대열이 매번 다르게 섞인다
{
  const s = A.createGame(3); s.t = 10; const kinds = new Set();
  for (let i = 0; i < 40; i++) { s.enemies.length = 0; kinds.add(A.spawnWave(s)); }
  ok(kinds.size >= 5, "대열 종류 " + [...kinds].join(","));
}

// 9. 붉은 것: 일섬이 베면 즉시 끝, 미리보기에 표시
{
  const s = blank(); s.reds.push({ x: 700, y: 270, vx: 0, vy: 0, r: CFG.red.r, life: 99 });
  ok(A.plan(s, 900, 270).red.length === 1, "조준선에 붉은 것이 걸리면 미리보기에 표시");
  A.slash(s, 900, 270); run(s, 0.5);
  ok(s.state === "end" && s.result.kind === "red", "붉은 것을 베면 즉시 끝");
}
// 10. 금빛 기수: 베면 경험치 크게, 붉은 것 곁을 따라가기도 한다
{
  const s = blank(); A.add(s, "banner", 700, 270); A.slash(s, 900, 270); run(s, 0.5);
  ok(s.xp === 1 + CFG.banner.xp, "기수를 베면 경험치 " + s.xp);
  const s2 = blank(); s2.reds.push({ x: 100, y: 270, vx: 90, vy: 0, r: CFG.red.r, life: 9 });
  let b = null; for (let i = 0; i < 30 && !(b && (b.vx || b.vy)); i++) { s2.enemies.length = 0; b = A.spawnBanner(s2); }
  const gap0 = Math.hypot(b.x - s2.reds[0].x, b.y - s2.reds[0].y); run(s2, 1);
  ok(Math.abs(Math.hypot(b.x - s2.reds[0].x, b.y - s2.reds[0].y) - gap0) < 1, "호위 기수는 붉은 것 곁을 나란히 간다");
}
// 11. 엘리트: 세 번 지나가야 쓰러진다. 큰 몸도 일섬 한 번에 1만 깎인다
{
  const s = blank(); const e = A.add(s, "elite", 700, 270);
  A.slash(s, 900, 270); run(s, 0.4);
  ok(e.hp === 2 && e.alive, "엘리트는 한 번 지나가면 1만 깎임");
  A.slash(s, 100, 270); run(s, 0.6); A.slash(s, 900, 270); run(s, 0.6);
  ok(!e.alive || e.dying > 0, "엘리트 세 번째에 쓰러짐, 점수 " + s.score);
}
// 12. 대장군: 정해진 때 한 번 나오고, 체력만 많다(기믹 없음)
{
  const s = A.createGame(5); s.started = true; s.reds.length = 0; s.redT = 999; s.firstRedPending = false;
  run(s, CFG.boss.at + 0.1);
  const boss = s.enemies.find((e) => e.type === "boss");
  ok(boss && boss.hp === CFG.boss.hp && s.enemies.filter((e) => e.type === "boss").length === 1, "대장군 한 번 등장(체력 " + (boss && boss.hp) + ")");
  boss.hp = 1; boss.x = 600; boss.y = 270; s.p.x = 450; s.p.y = 270; s.p.invuln = 9; s.chain = 0; s.events.length = 0;
  const sc = s.score; A.slash(s, 900, 270); run(s, 1.2);
  const bd = s.events.find((e) => e.type === "bossdown");
  ok(!boss.alive && bd && bd.base === CFG.boss.score && bd.mult === 1, `대장군 처치 기본점 ${bd && bd.base}(연쇄 없음: 배율 1), 발도 포함 +${bd && bd.score}`);
  // 연쇄 중 처치하면 그 순간 배율을 곱한 값이 이벤트 점수이자 실제 지급값
  const s2 = A.createGame(5); s2.started = true; s2.reds.length = 0; s2.redT = 999; s2.firstRedPending = false; s2.enemies.length = 0; s2.spawnT = 99; s2.bannerT = 99; s2.bossState = 2;
  const b2 = A.add(s2, "boss", 600, 270); b2.hp = 1; s2.p.x = 450; s2.p.y = 270; s2.p.invuln = 9; s2.chain = 2; s2.lastHitT = s2.t;
  const sc2 = s2.score; A.slash(s2, 900, 270); run(s2, 0.8);
  const bd2 = s2.events.find((e) => e.type === "bossdown"), m3 = Math.min(CFG.chainMax, 1 + CFG.chainStep * 2);
  ok(bd2 && bd2.score === Math.round(CFG.boss.score * m3) && s2.score - sc2 === bd2.score + Math.round(m3), `연쇄 3번째 일섬의 보스 처치 = ${bd2 && bd2.score}점(배율 ${m3})`);
}
// 12b. 보스 발도: 쓰러뜨린 순간 판 위 살아 있는 적 전부(붉은 것 제외)를 같은 프레임에 처치, 점수 = iaiK × min(n, cap)² × 연쇄 배율
{
  const s = blank(); s.bossState = 2; s.bannerT = 99; s.p.invuln = 9;
  const b = A.add(s, "boss", 600, 270); ok(b.hp === 6 && CFG.boss.hp === 6, "대장군 체력 6");
  b.hp = 1; const others = [];
  for (let i = 0; i < 10; i++) others.push(A.add(s, "soldier", 100 + i * 70, 80));
  others.push(A.add(s, "elite", 800, 460)); others.push(A.add(s, "banner", 150, 460));
  s.reds.push({ x: 480, y: 470, vx: 0, vy: 0, r: CFG.red.r, life: 99 });
  const sc = s.score, evs = []; A.slash(s, 900, 270);
  let frame = -1; for (let i = 0; i < 40; i++) { A.update(s, 1 / 60); if (s.events.some((e) => e.type === "bossIai")) frame = i; evs.push(...s.events); s.events.length = 0; }
  const iai = evs.find((e) => e.type === "bossIai"), bd = evs.find((e) => e.type === "bossdown"), n = others.length;
  const want = Math.round(CFG.boss.iaiK * Math.min(n, CFG.boss.iaiCap) ** 2 * 1);
  ok(iai && iai.hits === n && iai.ids.length === n && others.every((o) => iai.ids.includes(o.id)) && iai.pts === want && iai.mult === 1, `발도 ${iai && iai.hits}명 처치(엘리트 체력 무시), ${iai && iai.pts}점`);
  ok(others.every((o) => !o.alive) && evs.filter((e) => e.type === "split").length >= n && s.reds.length === 1 && s.state === "play", "발도 처치는 기존 갈라짐(split) 경로, 붉은 것은 그대로");
  ok(bd && bd.score === CFG.boss.score + want + CFG.elite.score && s.score - sc === bd.score + 1, `bossdown.score = 기본 ${CFG.boss.score} + 발도 ${want} + 엘리트 ${CFG.elite.score} (일섬 1꿰기 1점 별도)`);
  ok(s.xp >= CFG.boss.xp + n + CFG.elite.xp + CFG.banner.xp, "발도 처치에도 경험치 지급(xp " + s.xp + ")");
}
// 14. 20초는 실제 20초: 적중이 잦아 히트스톱·레벨스톱이 많이 걸려도 남은 시간은 흐른다
for (const fdt of [1 / 60, 1 / 144, 0.1]) {
  const s = A.createGame(2); let real = 0, stops = 0, think = 0;
  s.firstRedPending = false; s.redT = 1e9; // 붉은 것 없이 끝까지
  A.slash(s, s.p.x + 200, s.p.y);
  while (s.state === "play" && real < 30) {
    think -= fdt;
    if (think <= 0 && !s.dash) { think = 0.05; let best = null;
      for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, pl = A.plan(s, s.p.x + Math.cos(a) * 100, s.p.y + Math.sin(a) * 100); if (pl && (!best || pl.cut.length > best.n)) best = { n: pl.cut.length, a }; }
      if (best) A.slash(s, s.p.x + Math.cos(best.a) * 100, s.p.y + Math.sin(best.a) * 100); }
    A.update(s, fdt); real += fdt;
    stops += s.events.filter((e) => e.type === "hit" || e.type === "level").length; s.events.length = 0;
  }
  ok(s.state === "end" && s.result.kind === "time" && Math.abs(real - CFG.limit) <= 0.05 && stops > 50,
    `프레임 ${fdt.toFixed(4)}초: 누적 dt ${real.toFixed(3)}초에 종료(적중·레벨업 ${stops}회)`);
}
// 15. 예약 입력이 새 위치에서 붉은 것을 향하게 되면 버리고 알린다
{
  const s = blank(); A.slash(s, 900, 270); A.update(s, 1 / 60);
  A.slash(s, 900, 100); // 끝(938,270)에서 보면 위쪽: 그 길에 붉은 것을 둔다
  s.reds.push({ x: 925, y: 150, vx: 0, vy: 0, r: CFG.red.r, life: 99 }); s.events.length = 0;
  const evs = []; for (let i = 0; i < 40; i++) { A.update(s, 1 / 60); evs.push(...s.events); s.events.length = 0; }
  ok(s.state === "play" && evs.some((e) => e.type === "bufferCancel") && evs.filter((e) => e.type === "dash").length === 0, "예약 일섬이 붉은 것으로 향하면 취소(bufferCancel)");
}
// 16. 첫 붉은 것: 시작엔 없고, 첫 클릭 뒤 firstDelay 또는 첫 처치 중 이른 쪽에 화면 안에 나온다
{
  const s = A.createGame(4); s.enemies.length = 0;
  ok(s.reds.length === 0, "시작 화면에는 붉은 것이 없다");
  A.slash(s, 100, 270); let t = 0; while (!s.reds.length && t < 5) { A.update(s, 1 / 60); t += 1 / 60; }
  const q = s.reds[0];
  ok(q && Math.abs(t - CFG.red.firstDelay) < 0.05 && q.x >= 60 && q.x <= A.W - 60 && q.y >= 60 && q.y <= A.H - 60 && Math.hypot(q.x - s.p.x, q.y - s.p.y) >= 220,
    `처치 없으면 첫 클릭 ${t.toFixed(2)}초 뒤, 화면 안(${q && q.x.toFixed(0)},${q && q.y.toFixed(0)})`);
  const s2 = A.createGame(4); s2.enemies.length = 0; A.add(s2, "soldier", 600, 270); A.slash(s2, 900, 270);
  let t2 = 0; while (!s2.reds.length && t2 < 5) { A.update(s2, 1 / 60); t2 += 1 / 60; }
  ok(s2.reds.length && t2 < 0.5 && s2.state === "play", `첫 처치가 먼저면 그때 나온다(${t2.toFixed(2)}초), 일섬 길은 피함`);
}
// 17. 결과에 seed, 같은 seed + 같은 입력이면 같은 결과
{
  const play = (seed) => { const s = A.createGame(seed); let f = 0;
    while (s.state === "play" && f < 60 * 30) { if (f % 17 === 0) { const a = (f * 0.37) % (Math.PI * 2); A.slash(s, s.p.x + Math.cos(a) * 100, s.p.y + Math.sin(a) * 100); } A.update(s, 1 / 60); f++; }
    return s.result; };
  const r1 = play(11), r2 = play(11), r3 = play(12);
  ok(r1.seed === 11 && JSON.stringify(r1) === JSON.stringify(r2), `같은 seed·입력이면 같은 결과(${r1.score}점/${r1.kind}), seed ${r1.seed} 기록`);
  ok(JSON.stringify(r1) !== JSON.stringify(r3), "다른 seed면 다른 판");
}
// 18. 시간 종료: 살아 있는 적은 남겨 두고, end 이벤트에 kind
{
  const s = A.createGame(3); s.firstRedPending = false; s.redT = 1e9; A.slash(s, s.p.x + 200, s.p.y);
  let endEv = null; while (s.state === "play") { A.update(s, 1 / 60); endEv = s.events.find((e) => e.type === "end") || endEv; s.events.length = 0; }
  const n = s.enemies.filter((e) => e.alive && e.dying <= 0).length, sc = s.score; A.update(s, 0.1);
  ok(endEv && endEv.kind === "time" && n > 0 && endEv.remaining === n && s.score === sc && s.result.score === sc, `시간 종료 때 적 ${n}명 남김(점수 미반영), end.kind=${endEv && endEv.kind}`);
}
// 13. 자동 조작: 사방 48방향 중 가장 많이 꿰는 쪽으로
function bot(seed, aim, careless = false) {
  const s = A.createGame(seed); s.hurts = 0; s.bossPts = 0; s.maxDash = 0; const dt = 1 / 60; let think = 0, dashT = 0;
  while (s.state === "play" && s.t < 25) {
    think -= dt;
    if (think <= 0 && !s.dash) {
      think = aim; let best = null;
      for (let i = 0; i < 48; i++) {
        const a = i / 48 * Math.PI * 2, tx = s.p.x + Math.cos(a) * 100, ty = s.p.y + Math.sin(a) * 100;
        const pl = A.plan(s, tx, ty); if (!pl) continue;
        if (pl.red.length) continue; // 붉은 것은 피한다
        const val = pl.cut.length + pl.cut.filter((e) => e.type === "banner").length * 5 + pl.cut.filter((e) => e.type === "boss" || e.type === "elite").length * 3;
        if (!best || val > best.n) best = { n: val, tx, ty };
      }
      if (careless) { const a = Math.random() * Math.PI * 2; A.slash(s, s.p.x + Math.cos(a) * 100, s.p.y + Math.sin(a) * 100); }
      else if (best) A.slash(s, best.tx, best.ty);
    }
    const wasDash = !!s.dash; A.update(s, dt);
    if (s.dash || wasDash) { if (s.hitstop <= 0) dashT += dt; } if (!s.dash) { s.maxDash = Math.max(s.maxDash, dashT); dashT = 0; } // 보스 처치 멈춤은 빼고 잰다
    for (const ev of s.events) { if (ev.type === "hurt") s.hurts++; if (ev.type === "bossdown") s.bossPts = ev.score; }
    s.events.length = 0;
  }
  return s;
}
for (const aim of [0.12, 0.3, 0.6, 1.0]) {
  const rs = [1, 2, 3, 4, 5, 6].map((k) => bot(k, aim));
  console.log(`  조준 ${aim}초 가정(사람 아님): ` + rs.map((s) => `${s.score}점/${s.kills}처치/LV${s.maxLv}/보스${Math.round(100 * s.bossPts / Math.max(1, s.score))}%/${s.result && s.result.kind === "red" ? "붉은것 " + s.t.toFixed(1) + "s" : "완주"}`).join("  ")
    + `  최장 일섬 ${Math.max(...rs.map((s) => s.maxDash)).toFixed(3)}s`);
}
{ const rs = [1, 2, 3, 4, 5, 6].map((k) => bot(k, 0.3, true));
  console.log("  아무 방향 0.3초 간격(대충 긋기 가정): " + rs.map((s) => `${s.score}점/${s.kills}처치/LV${s.maxLv}/${s.result && s.result.kind === "red" ? "붉은것 " + s.t.toFixed(1) + "s" : "완주"}`).join("  ")); }
{ // DAILY 공정성: 같은 시드면 플레이가 달라도 n번째 대열은 같은 종류·같은 쪽
  const a = A.createGame(20261107), b = A.createGame(20261107);
  for (let i = 0; i < 50; i++) b.rand(); // b는 다른 플레이로 잡난수를 더 썼다고 가정
  a.t = b.t = 8; let same = true;
  for (let i = 0; i < 10; i++) { if (A.spawnWave(a) !== A.spawnWave(b)) same = false; }
  ok(same, "같은 시드: 잡난수 소비와 무관하게 대열 순서가 같다");
}
{ // 여럿 꿸 때 끊김: 한 일섬 동안 멈춘 시간 합이 작아야 한다(적중마다 멈추면 렉처럼 보였다)
  const s = A.createGame(3); s.enemies = []; s.reds = []; s.redT = Infinity; s.started = true;
  for (let i = 0; i < 8; i++) A.add(s, "soldier", 200 + i * 70, 270);
  s.p.x = 100; s.p.y = 270; A.slash(s, 900, 270);
  let stopped = 0; for (let i = 0; i < 120 && (s.dash || s.hitstop > 0); i++) { if (s.hitstop > 0) stopped += 1 / 60; A.update(s, 1 / 60); }
  ok(stopped < 0.2, `8명 관통 시 멈춘 시간 합 ${stopped.toFixed(3)}s < 0.2s`);
}
// 19. chop 시험 모드(2026-11-08): 몸은 커서 너머 over에서 멈춘다. 최소 min, 최대 벽. 벽에 못 닿으면 검기 반사 없음
{
  const C = CFG.chop;
  const go = (tx, ty, lv = 1, px = 480) => { const s = blank(); s.chop = true; s.lv = lv; s.p.x = px; s.p.y = 270;
    const pl = A.plan(s, tx, ty); let wv = 0; A.slash(s, tx, ty); for (let i = 0; i < 60 && (s.dash || s.waves.length); i++) { A.update(s, 1 / 60); wv = Math.max(wv, s.waves.length); } return { s, pl, wv }; };
  const near = go(500, 270);
  ok(Math.abs(near.s.p.x - (480 + C.min)) < 0.5 && near.pl.L === C.min, `가까운 커서(20) → 최소 ${C.min} 이동(x ${near.s.p.x.toFixed(1)})`);
  const mid = go(780, 270);
  ok(Math.abs(mid.s.p.x - (780 + C.over)) < 0.5 && !mid.pl.atWall, `중간 커서(300) → 커서+${C.over}에서 멈춤(x ${mid.s.p.x.toFixed(1)})`);
  const far = go(900, 270);
  ok(Math.abs(far.s.p.x - (A.W - CFG.pad)) < 0.5 && far.pl.atWall, `먼 커서 → 벽에서 멈춤(x ${far.s.p.x.toFixed(1)})`);
  const lvMid = go(780, 270, 6), lvFar = go(900, 270, 6);
  ok(lvMid.pl.segs.length === 1 && lvMid.wv === 0 && lvFar.pl.segs.length === 3 && lvFar.wv === 1, `LV6: 벽 미도달이면 segs 1개·검기 없음, 벽 도달이면 segs ${lvFar.pl.segs.length}개·검기 있음`);
  const g = lvMid.pl.segs[0];
  ok(["x1", "y1", "x2", "y2", "safe", "ux", "uy", "L"].every((k) => k in g) && g.safe === false && Math.abs(g.x2 - 870) < 1e-6 && g.L === lvMid.pl.L, "잘린 첫 구간도 같은 구조(x2·L이 멈출 곳)");
  const short = go(810, 270, 3, 800);
  ok(Math.abs(short.s.p.x - (A.W - CFG.pad)) < 0.5 && short.pl.atWall && short.wv === 1, `벽이 min보다 가까우면 벽까지 가고 반사(L ${short.pl.L.toFixed(0)})`);
  const off = blank(); off.lv = 6; const plOff = A.plan(off, 500, 270);
  ok(plOff.L === A.W - CFG.pad - 480 && plOff.segs.length === 3 && plOff.atWall, "chop=false면 가까운 커서여도 벽까지(기존 규칙)");
  const opt = A.createGame(1, { chop: true }), dflt = A.createGame(1);
  ok(opt.chop === true && dflt.chop === false, "createGame(seed, {chop:true}) 와 기본값 false");
  // 예약 입력: 돌진이 끝난 새 위치에서 커서까지 거리를 다시 잰다
  const b = blank(); b.chop = true; A.slash(b, 600, 270); A.update(b, 1 / 60); A.slash(b, 600, 270);
  run(b, 0.6);
  ok(Math.abs(b.p.x - 480) < 0.5, `예약 클릭은 새 위치(730)에서 다시 계산: (600) 쪽으로 ${C.min} → x ${b.p.x.toFixed(1)}`);
  // 붉은 것: 커서 너머 멈출 곳 뒤에 있으면 걸리지 않는다
  const r = blank(); r.chop = true; r.reds.push({ x: 900, y: 270, vx: 0, vy: 0, r: CFG.red.r, life: 99 });
  const rp = A.plan(r, 600, 270); A.slash(r, 600, 270); run(r, 0.4);
  ok(rp.red.length === 0 && r.state === "play", "멈출 곳 너머의 붉은 것은 미리보기에도 실제로도 걸리지 않는다");
  const rb = blank(); rb.chop = true; A.slash(rb, 600, 270); A.update(rb, 1 / 60); A.slash(rb, 730, 200); // 끝(730,270)에서 위로
  rb.reds.push({ x: 730, y: 170, vx: 0, vy: 0, r: CFG.red.r, life: 99 }); rb.events.length = 0;
  const rbe = []; for (let i = 0; i < 40; i++) { A.update(rb, 1 / 60); rbe.push(...rb.events); rb.events.length = 0; }
  ok(rb.state === "play" && rbe.some((e) => e.type === "bufferCancel"), "chop 예약 입력도 새 경로에 붉은 것이 있으면 취소");
}
console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
