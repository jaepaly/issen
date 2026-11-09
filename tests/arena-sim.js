// 일섬 아레나 규칙 테스트와 자동 조작 검사. 실행: node tests/arena-sim.js
// 자동 조작 결과는 규칙이 돌아간다는 확인일 뿐 사람의 점수가 아니다.
const A = require("../arena/game.js");
const { CFG } = A;
let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const run = (s, sec) => { for (let i = 0; i < sec * 60; i++) A.update(s, 1 / 60); };
// 빈 판: 보충·대장군·붉은 것 없음. instant는 기본 true(게임 기본값). 돌진 도중을 봐야 하는 옛 테스트는 blank(false)
function blank(instant = true) { const s = A.createGame(1, { instant }); s.enemies.length = 0; s.reds.length = 0; s.redT = 99; s.firstRedPending = false; s.started = true; s.spawnT = 99; s.refill = false; s.bossState = 2; return s; }
const B = CFG.scoreBase;

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
  ok(s.kills === 5 && s.xp === 15 && s.score === 5 * B, `다섯 명을 한 번에 꿰면 경험치 15, 점수 5×${B}=${s.score}(선형, 레벨 ${s.lv})`);
}
// 4. 맞으면 한 레벨 내려간다
{
  const s = blank(); s.xp = CFG.levels[3]; s.lv = 4; A.add(s, "soldier", s.p.x + 20, s.p.y); run(s, 0.1);
  ok(s.lv === 3 && s.chain === 0, "몸에 닿으면 레벨 하나 잃음");
}
// 5. 클릭 미리 입력: 일섬 중 클릭은 끝나자마자 나간다
{
  const s = blank(false); A.add(s, "soldier", 700, 270); A.add(s, "soldier", 800, 100);
  A.slash(s, 900, 270); A.update(s, 1 / 60); const buffered = !!s.buffer; A.slash(s, 800, 100); run(s, 0.6);
  ok(!buffered && s.kills === 2, "일섬 도중 누른 클릭이 이어서 나감(instant off)");
}
// 6. 산개병: 조준선이 오래 머물면 비킨다
{
  const s = blank(); const d = A.add(s, "dodger", 750, 270); A.setAim(s, 900, 270); run(s, 0.4);
  const p = A.plan(s, 900, 270);
  ok(!p.cut.includes(d), "산개병은 조준선이 머물면 옆으로 비킨다");
}
// 7. 반사 일섬(2026-11-07 사용자 결정, 2026-11-09 LV3 1번만으로 축소): LV3부터 벽에서 1번 거울 반사
{
  ok([1, 2, 3, 5, 6, 8, 9, 11].map(A.bouncesOf).join() === "0,0,1,1,1,1,1,1", "반사 횟수: LV1·2=0, LV3부터 1(LV6·9에서 늘지 않음)");
  const s = blank(), segs = A.tracePath(s, 480, 270, Math.SQRT1_2, Math.SQRT1_2, 1), [a, b] = segs;
  ok(segs.length === 2 && Math.abs(a.y2 - (A.H - CFG.pad)) < 1e-6 && a.x2 === b.x1 && a.y2 === b.y1 && Math.abs(b.ux - a.ux) < 1e-9 && Math.abs(b.uy + a.uy) < 1e-9,
    `아래 벽에 닿으면 법선(y) 성분만 뒤집힌다(${a.x2.toFixed(0)},${a.y2.toFixed(0)}에서 반사)`);
  const c = A.tracePath(s, 480, 270, 1, 0, 1);
  ok(Math.abs(c[0].x2 - (A.W - CFG.pad)) < 1e-6 && c[1].ux === -1 && Math.abs(c[1].x2 - CFG.pad) < 1e-6, "정면으로 벽에 닿으면 그대로 되돌아온다");
  const shape = [];
  for (const lv of [1, 3, 6, 9]) { s.lv = lv; const pl = A.plan(s, 700, 400); shape.push(pl.segs.length);
    ok(pl.segs.every((g, i) => ["x1", "y1", "x2", "y2", "safe"].every((k) => k in g) && g.safe === (i > 0)) && pl.L === pl.segs[0].L, `plan(LV${lv}).segs: ${pl.segs.length}구간, 첫 구간만 safe:false`); }
  ok(shape.join() === "1,2,2,2", "구간 수 LV1/3/6/9 = " + shape.join("/"));
}
// 7b. 튕긴 구간은 붉은 것을 통과하고, 거기서 벤 적도 같은 일섬의 꿴 수(점수 = 꿴 수² × 연쇄)
{
  const s = blank(false); s.xp = CFG.levels[2]; s.lv = 3;
  A.add(s, "soldier", 700, 270); A.add(s, "soldier", 200, 270); // 첫 구간(→오른쪽)에 하나, 튕긴 구간(←왼쪽)에 하나
  s.reds.push({ x: 300, y: 270, vx: 0, vy: 0, r: CFG.red.r, life: 99 });
  const pl = A.plan(s, 900, 270);
  ok(pl.cut.length === 2 && pl.red.length === 0, "미리보기: 튕긴 구간의 적은 cut에, 튕긴 구간의 붉은 것은 red에 없다");
  const evs = []; A.slash(s, 900, 270); let stopX = null; for (let i = 0; i < 60 && (s.dash || s.waves.length); i++) { A.update(s, 1 / 60); evs.push(...s.events); s.events.length = 0; if (!s.dash && stopX === null) stopX = s.p.x; }
  ok(Math.abs(s.p.x - (A.W - CFG.pad)) < 1 && Math.abs(stopX - s.p.x) < 1e-6, `몸은 조준한 벽에서 멈추고 검기만 튕긴다(멈춘 x ${s.p.x.toFixed(0)})`);
  const m = evs.find((e) => e.type === "multi"), bo = evs.filter((e) => e.type === "bounce");
  ok(s.state === "play" && m && m.hits === 2 && m.pts === 2 * B && s.score === 2 * B, `튕긴 구간은 붉은 것을 통과, 두 구간 처치가 한 일섬 2꿰기 = ${m && m.pts}점`);
  ok(bo.length === 1 && bo[0].n === 1 && Math.abs(bo[0].x - (A.W - CFG.pad)) < 1 && evs.filter((e) => e.type === "dashEnd").length === 1, "벽에서 bounce 이벤트(n=1) 한 번, multi·dashEnd는 일섬 끝에 한 번");
  ok(s.slashes.filter((q) => q.kind === "main").map((q) => q.bounce).join() === "0,1", "s.slashes에 구간마다 하나(bounce 0, 1)");
  const s2 = blank(); s2.xp = CFG.levels[2]; s2.lv = 3; s2.reds.push({ x: 700, y: 270, vx: 0, vy: 0, r: CFG.red.r, life: 99 });
  A.slash(s2, 900, 270); run(s2, 0.5);
  ok(s2.state === "end" && s2.result.kind === "red", "첫 구간의 붉은 것은 LV3에서도 즉사");
  const s3 = blank(); s3.xp = CFG.levels[2] - 1; s3.lv = 2; A.add(s3, "soldier", 700, 270); A.slash(s3, 900, 270);
  const lvEv = []; for (let i = 0; i < 30; i++) { A.update(s3, 1 / 60); lvEv.push(...s3.events.filter((e) => e.type === "level")); s3.events.length = 0; }
  ok(lvEv.length && lvEv[0].lv === 3 && lvEv[0].perk && lvEv[0].perk.name === "BOUNCE" && lvEv[0].perk.n === 1, "LV3이 되면 level 이벤트에 perk BOUNCE 1");
  // 2026-11-09: LV1→11을 차례로 올려도 perk는 LV3 한 번뿐
  const s4 = blank(), lvs = [];
  for (let lv = 2; lv <= CFG.levels.length; lv++) { s4.events.length = 0; s4.xp = CFG.levels[lv - 1] - 1; s4.lv = lv - 1; A.add(s4, "soldier", s4.p.x + 200, s4.p.y); A.slash(s4, s4.p.x + 400, s4.p.y);
    for (let i = 0; i < 40 && (s4.dash || s4.waves.length); i++) { A.update(s4, 1 / 60); lvs.push(...s4.events.filter((e) => e.type === "level")); s4.events.length = 0; } s4.p.x = 300; s4.p.y = 270; }
  const perks = lvs.filter((e) => e.perk);
  ok(lvs.length >= 9 && perks.length === 1 && perks[0].lv === 3 && !lvs.some((e) => (e.lv === 6 || e.lv === 9) && e.perk), `레벨업 ${lvs.length}번 중 perk는 LV${perks.map((e) => e.lv).join(",")}만(LV6·9 없음)`);
}
// 7c. 한 번 긋는 최대 시간: 판 모서리에서 대각선, LV11 반사 1번. instant off(옛 속도)여도 0.45초 이하. 줌은 고정 1
{
  let worst = 0;
  for (const [tx, ty] of [[1, 1], [1, 0.5], [1, 0.2], [0.3, 1]]) {
    const s = blank(false); s.lv = s.maxLv = 11; s.xp = CFG.levels[10];
    s.p.x = CFG.pad + 1; s.p.y = CFG.pad + 1; A.slash(s, s.p.x + tx * 100, s.p.y + ty * 100);
    let t = 0; while ((s.dash || s.waves.length) && t < 2) { A.update(s, 1 / 240); t += 1 / 240; } worst = Math.max(worst, t);
  }
  ok(worst <= 0.45, `LV11 반사 일섬(instant off) 최장 ${worst.toFixed(3)}초 <= 0.45`);
}
// 7e. 줌 고정(2026-11-09 v2): 레벨이 올라도 판이 넓어지지 않고 widen 이벤트가 없다
{
  const s = blank(), evs = [];
  ok(CFG.zoomByLv.every((z) => z === 1), "zoomByLv 전부 1");
  for (let lv = 2; lv <= CFG.levels.length; lv++) { s.xp = CFG.levels[lv - 1] - 1; s.lv = lv - 1; A.add(s, "soldier", s.p.x + 200, s.p.y); A.slash(s, s.p.x + 300, s.p.y);
    for (let i = 0; i < 30 && (s.dash || s.waves.length); i++) { A.update(s, 1 / 60); evs.push(...s.events); s.events.length = 0; } s.p.x = 300; s.p.y = 270; }
  const b = A.bounds(s);
  ok(s.maxLv === CFG.levels.length && !evs.some((e) => e.type === "widen") && b.w === A.W && b.h === A.H && s.zoomTarget === 1, `LV${s.maxLv}까지 올려도 판 ${b.w}x${b.h}, widen 없음`);
}
// 7d. 연쇄 배율(2026-11-09 사용자 승인): 단계 0.25, 상한 6(연쇄 21번째에 도달), 창 0.8초
{
  ok(CFG.chainMax === 6 && CFG.chainStep === 0.25 && CFG.chainWindow === 0.8, "연쇄 상한 6, 단계 0.25, 창 0.8초");
  const s = blank(), mults = []; s.chop = true; // 짧게 멈춰야 벽 반사 검기 없이 한 번씩 셈이 끝난다
  for (let i = 0; i < 24; i++) { // 매번 한 명씩 이어 벤다(창 0.8초 안)
    s.p.x = 100; s.p.y = 270; A.add(s, "soldier", 300, 270); A.slash(s, 400, 270);
    for (let f = 0; f < 30 && s.dash; f++) { A.update(s, 1 / 60); for (const e of s.events) if (e.type === "multi") mults.push(e.mult); s.events.length = 0; }
  }
  ok(mults.length === 24 && mults[0] === 1 && mults[3] === 1.75 && mults[19] === 5.75 && mults[20] === 6 && mults[23] === 6, `연쇄 배율 1→${mults[3]}(4번째)→${mults[19]}(20번째)→${mults[20]}(21번째)→${mults[23]}(24번째, 상한)`);
  ok(s.score === mults.reduce((a, m) => a + Math.round(m * B), 0) && s.chain === 24, `한 명씩 24번 이어 베기 = ${s.score}점(한 번 = ${B} × 배율)`);
}
// 8. 보충 공급(2026-11-09 v2): 판 위(+예고 중) 적 수를 막마다 목표 n으로 유지. 시간표 대열 없음
{
  const acts = CFG.refill.acts;
  ok(acts.map((a) => a.t + ":" + a.n).join() === "0:14,7:20,14:26", "목표 밀도 3막 " + acts.map((a) => `${a.t}초~ ${a.n}명`).join(", "));
  // 빠르게 베는 봇으로 한 판: 매 프레임 끝에서 판 위 수가 목표보다 모자라지 않다(주자가 화면을 빠져나간 프레임만 1명 차이 허용)
  const s = A.createGame(21, { chop: true }); s.firstRedPending = false; s.redT = 1e9;
  let think = 0, worst = 0, seenN = new Set(), kills0 = 0;
  A.slash(s, s.p.x + 200, s.p.y);
  while (s.state === "play") {
    think -= 1 / 60;
    if (think <= 0 && !s.dash) { think = 0.15; let best = null;
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, pl = A.plan(s, s.p.x + Math.cos(a) * 300, s.p.y + Math.sin(a) * 300); if (pl && (!best || pl.cut.length > best.n)) best = { n: pl.cut.length, a }; }
      if (best) A.slash(s, s.p.x + Math.cos(best.a) * 300, s.p.y + Math.sin(best.a) * 300); }
    A.update(s, 1 / 60); s.events.length = 0;
    if (s.state === "play") { worst = Math.min(worst, A.boardCount(s) - s.targetN); seenN.add(s.targetN); }
  }
  ok(worst >= -1 && [...seenN].join() === "14,20,26" && s.kills > 150, `한 판 내내 판 위 적 수 >= 목표-1(최저 차 ${worst}), 목표 ${[...seenN].join("→")}, 처치 ${s.kills}`);
  // 처치하면 바로 채운다: 줄 하나를 베면 같은 프레임 안에 목표 수로 돌아온다
  const s2 = A.createGame(5, { chop: true }); s2.enemies.length = 0; s2.started = true; s2.firstRedPending = false; s2.redT = 1e9;
  A.update(s2, 1 / 60); const n0 = A.boardCount(s2);
  for (let i = 0; i < 5; i++) A.add(s2, "soldier", 560 + i * 60, 270); // 목표 위에 5명 더(줄)
  s2.p.x = 480; s2.p.y = 270; A.slash(s2, 900, 270); A.update(s2, 1 / 60);
  ok(n0 === CFG.refill.acts[0].n && A.boardCount(s2) >= CFG.refill.acts[0].n && s2.kills >= 5, `빈 판 첫 프레임에 ${n0}명 채움, 5명 벤 프레임 뒤에도 ${A.boardCount(s2)}명`);
  // 플레이어에게서 먼 곳: 기록된 보충 자리는 모두 minDist 이상
  const far = s.refillLog.map((l) => l.dist), kinds = new Set(s.refillLog.map((l) => l.at));
  ok(far.every((d) => d >= CFG.refill.minDist - 1e-6) && kinds.has("edge") && kinds.has("drop"), `보충 ${s.refillLog.length}무리 모두 플레이어에게서 ${CFG.refill.minDist}px 이상(최소 ${Math.min(...far).toFixed(0)}), 가장자리·먹물 예고 둘 다 사용`);
  // 1막은 졸병만, 2막부터 정예·주자·산개병이 섞일 수 있다
  const a0 = s.refillLog.filter((l) => l.act === 0), a12 = s.refillLog.filter((l) => l.act > 0);
  ok(a0.every((l) => l.kind === "soldier" && !l.elite) && a12.some((l) => l.elite), `1막 보충은 졸병만(${a0.length}무리), 2막 이후 정예 섞임(${a12.filter((l) => l.elite).length}/${a12.length}무리)`);
  // 붉은 것 목표 수도 막마다
  const s3 = A.createGame(8, { chop: true }); s3.p.invuln = 1e9; A.slash(s3, s3.p.x + 200, s3.p.y); const mx = [0, 0, 0];
  while (s3.state === "play") { A.update(s3, 1 / 60); s3.p.invuln = 1e9; const i = s3.t < 7 ? 0 : s3.t < 14 ? 1 : 2; mx[i] = Math.max(mx[i], s3.reds.length); }
  ok(mx.join() === CFG.refill.acts.map((a) => a.red).join(), `붉은 것 막별 최대 ${mx.join("/")} (목표 ${CFG.refill.acts.map((a) => a.red).join("/")})`);
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
// 12. 대장군: 정해진 때 한 번 나오고, 체력만 많다(기믹 없음). 처치 보너스 = bonus × 기본점 × 그 일섬의 연쇄 배율
{
  const s = A.createGame(5); s.started = true; s.reds.length = 0; s.redT = 999; s.firstRedPending = false; s.p.invuln = 99;
  run(s, CFG.boss.at + 0.1);
  const boss = s.enemies.find((e) => e.type === "boss");
  ok(CFG.boss.at > 7 && CFG.boss.at < 14 && boss && boss.hp === CFG.boss.hp && CFG.boss.hp === 6 && s.enemies.filter((e) => e.type === "boss").length === 1, `대장군 ${CFG.boss.at}초(2막 끝)에 한 번 등장(체력 ${boss && boss.hp})`);
  const s1 = blank(); const b1 = A.add(s1, "boss", 600, 270); b1.hp = 1; s1.p.x = 450; s1.p.y = 270; s1.p.invuln = 9;
  const sc = s1.score; A.slash(s1, 900, 270); const ev1 = []; for (let i = 0; i < 30; i++) { A.update(s1, 1 / 60); ev1.push(...s1.events); s1.events.length = 0; }
  const bd = ev1.find((e) => e.type === "bossdown");
  ok(!b1.alive && bd && bd.base === CFG.boss.bonus * B && bd.score === bd.base && bd.mult === 1 && bd.iai === 0 && s1.score - sc === bd.score + B, `대장군 처치 보너스 ${bd && bd.score}(=${CFG.boss.bonus}×${B}, 배율 1) + 지나간 1타 ${B}`);
  // 연쇄 3번째 일섬에서 처치: 보너스와 1타 모두 그 일섬의 배율
  const s2 = blank(); const b2 = A.add(s2, "boss", 600, 270); b2.hp = 1; s2.p.x = 450; s2.p.y = 270; s2.p.invuln = 9; s2.chain = 2; s2.lastHitT = s2.t;
  const sc2 = s2.score; A.slash(s2, 900, 270); const ev2 = []; for (let i = 0; i < 30; i++) { A.update(s2, 1 / 60); ev2.push(...s2.events); s2.events.length = 0; }
  const bd2 = ev2.find((e) => e.type === "bossdown"), m3 = Math.min(CFG.chainMax, 1 + CFG.chainStep * 2);
  ok(bd2 && bd2.mult === m3 && bd2.score === Math.round(CFG.boss.bonus * B * m3) && s2.score - sc2 === bd2.score + Math.round(B * m3), `연쇄 3번째 일섬의 보스 처치 = ${bd2 && bd2.score} + ${Math.round(B * m3)}점(배율 ${m3})`);
  // 정예 처치 보너스도 같은 틀
  const s3 = blank(); const e3 = A.add(s3, "elite", 700, 270); e3.hp = 1; s3.chain = 4; s3.lastHitT = s3.t; A.slash(s3, 900, 270);
  const ev3 = []; for (let i = 0; i < 30; i++) { A.update(s3, 1 / 60); ev3.push(...s3.events); s3.events.length = 0; }
  const el = ev3.find((e) => e.type === "elite"), m5 = Math.min(CFG.chainMax, 1 + CFG.chainStep * 4);
  ok(el && el.score === Math.round(CFG.elite.bonus * B * m5) && s3.score === el.score + Math.round(B * m5), `정예 처치 보너스 ${el && el.score}(=${CFG.elite.bonus}×${B}×${m5}) + 1타 ${Math.round(B * m5)}`);
}
// 12b. 보스 처치는 판을 비우지 않는다(2026-11-09 v2: 발도 삭제). 대신 bossdown과 같은 프레임에 frenzy 이벤트, s.frenzyT = 4
{
  const s = blank(); s.p.invuln = 9;
  const b = A.add(s, "boss", 600, 270); b.hp = 1; const others = [];
  for (let i = 0; i < 10; i++) others.push(A.add(s, "soldier", 100 + i * 70, 80));
  others.push(A.add(s, "elite", 800, 460)); others.push(A.add(s, "banner", 150, 460));
  let frame = -1, fz = null, bdF = -1, fzT = null; const evs = []; A.slash(s, 900, 270);
  for (let i = 0; i < 40; i++) { A.update(s, 1 / 60);
    for (const e of s.events) { if (e.type === "bossdown") { bdF = i; fzT = s.frenzyT; } if (e.type === "frenzy") { frame = i; fz = e; } }
    evs.push(...s.events); s.events.length = 0; }
  ok(others.every((o) => o.alive && o.dying <= 0) && !evs.some((e) => e.type === "bossIai") && s.kills === 1, `보스 처치 뒤 다른 적 ${others.length}명 그대로, bossIai 이벤트 없음`);
  ok(fz && fz.dur === CFG.boss.frenzy && CFG.boss.frenzy === 4 && frame === bdF && fzT === 4, `frenzy 이벤트(dur ${fz && fz.dur})가 bossdown과 같은 프레임, 그 순간 s.frenzyT = ${fzT}`);
}
// 12c. 광란: 4초 동안 모든 점수 ×2, 그 뒤 원래대로(실제 시간으로 만료)
{
  const s = blank(); s.p.invuln = 99; s.frenzyT = CFG.boss.frenzy; // 보스를 막 쓰러뜨린 상태
  const cut = () => { s.p.x = 200; s.p.y = 270; A.add(s, "soldier", 400, 270); A.slash(s, 500, 270); let m = null;
    for (let i = 0; i < 20 && !m; i++) { A.update(s, 1 / 60); m = s.events.find((e) => e.type === "multi"); s.events.length = 0; } return m; };
  const wait = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) A.update(s, 1 / 60); };
  const a = cut(); wait(1.0); const b = cut(); wait(s.frenzyT - 0.1); const fz1 = s.frenzyT;
  const c = cut(); wait(1.0); const d = cut();
  ok(a && a.pts === 2 * B && a.frenzy && b && b.pts === 2 * B, `광란 중 1명 = ${a && a.pts}점(평소 ${B}), 1초 뒤에도 ${b && b.pts}점`);
  ok(fz1 > 0 && c && c.pts === 2 * B && s.frenzyT === 0 && d && d.pts === B && !d.frenzy, `만료 직전(남은 ${fz1.toFixed(2)}초) ${c && c.pts}점 → 4초 지나면 frenzyT 0, ${d && d.pts}점`);
  const s2 = blank(); s2.frenzyT = 4; let t = 0; while (s2.frenzyT > 0 && t < 10) { A.update(s2, 1 / 60); t += 1 / 60; }
  ok(Math.abs(t - 4) < 0.02, `광란은 실제 ${t.toFixed(2)}초 뒤 끝난다`);
}
// 12d. 선형 점수: 같은 연쇄 배율이면 5명 꿰기 = 1명 × 5 (n² 아님)
{
  const one = blank(); A.add(one, "soldier", 700, 270); one.chain = 3; one.lastHitT = 0; A.slash(one, 900, 270); run(one, 0.3);
  const five = blank(); for (let i = 0; i < 5; i++) A.add(five, "soldier", 560 + i * 60, 270); five.chain = 3; five.lastHitT = 0; A.slash(five, 900, 270); run(five, 0.3);
  const m4 = Math.min(CFG.chainMax, 1 + CFG.chainStep * 3);
  ok(one.score === Math.round(B * m4) && five.score === Math.round(5 * B * m4), `연쇄 4번째: 1명 ${one.score}점, 5명 ${five.score}점(= ${B}×꿴 수×${m4})`);
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
  const s = blank(false); A.slash(s, 900, 270); A.update(s, 1 / 60);
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
    for (const ev of s.events) { if (ev.type === "hurt") s.hurts++; if (ev.type === "bossdown") s.bossPts += ev.score; if (ev.type === "multi" && ev.frenzy) s.bossPts += ev.pts / 2; } // 보스 몫 = 처치 보너스 + 광란으로 더 받은 점수
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
{ // DAILY 공정성(v2): 같은 시드면 플레이가 달라도 n번째 보충 무리의 패(종류·인원·정예·먹물 여부·자리 후보)가 같다. sub(s, 9) 전용 난수
  const playLog = (seed, every, burn, aimed) => { const s = A.createGame(seed, { chop: true }); for (let i = 0; i < burn; i++) s.rand(); let th = 0, k = 0;
    while (s.state === "play") { th -= 1 / 60; s.p.invuln = 1e9; s.reds.length = 0;
      if (th <= 0 && !s.dash) { th = every; k++; let a = k * 2.399;
        if (aimed) { let n = -1; for (let i = 0; i < 24; i++) { const q = i / 24 * Math.PI * 2, pl = A.plan(s, s.p.x + Math.cos(q) * 300, s.p.y + Math.sin(q) * 300); if (pl && pl.cut.length > n) { n = pl.cut.length; a = q; } } }
        A.slash(s, s.p.x + Math.cos(a) * 300, s.p.y + Math.sin(a) * 300); }
      A.update(s, 1 / 60); s.events.length = 0; }
    return s; };
  const a = playLog(20261109, 0.12, 0, true), b = playLog(20261109, 0.7, 50, false); // 손 빠르기·방향·잡난수 소비가 다른 두 판
  const raw = (l) => [l.draw, l.size, l.cands].join("|"), read = (l) => [l.kind, l.elite, l.drop].join("|");
  let cmp = 0, cmpAct = 0, same = true;
  for (const lb of b.refillLog) { const la = a.refillLog.find((x) => x.n === lb.n); if (!la) continue; cmp++; if (raw(la) !== raw(lb)) same = false;
    if (la.act === lb.act) { cmpAct++; if (read(la) !== read(lb)) same = false; } }
  ok(same && cmp === b.refillLog.length && cmp >= 30 && a.kills !== b.kills, `같은 시드, 다른 입력(처치 ${a.kills}/${b.kills}, 무리 ${a.refillLog.length}/${b.refillLog.length}): n번째 무리 난수 패 ${cmp}개 모두 같고, 같은 막에 나온 ${cmpAct}개는 종류까지 같다`);
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
  const go = (tx, ty, lv = 1, px = 480) => { const s = blank(false); s.chop = true; s.lv = lv; s.p.x = px; s.p.y = 270;
    const pl = A.plan(s, tx, ty); let wv = 0; A.slash(s, tx, ty); for (let i = 0; i < 60 && (s.dash || s.waves.length); i++) { A.update(s, 1 / 60); wv = Math.max(wv, s.waves.length); } return { s, pl, wv }; };
  const near = go(500, 270);
  ok(Math.abs(near.s.p.x - (480 + C.min)) < 0.5 && near.pl.L === C.min, `가까운 커서(20) → 최소 ${C.min} 이동(x ${near.s.p.x.toFixed(1)})`);
  const mid = go(780, 270);
  ok(Math.abs(mid.s.p.x - (780 + C.over)) < 0.5 && !mid.pl.atWall, `중간 커서(300) → 커서+${C.over}에서 멈춤(x ${mid.s.p.x.toFixed(1)})`);
  const far = go(900, 270);
  ok(Math.abs(far.s.p.x - (A.W - CFG.pad)) < 0.5 && far.pl.atWall, `먼 커서 → 벽에서 멈춤(x ${far.s.p.x.toFixed(1)})`);
  const lvMid = go(780, 270, 6), lvFar = go(900, 270, 6);
  ok(lvMid.pl.segs.length === 1 && lvMid.wv === 0 && lvFar.pl.segs.length === 2 && lvFar.wv === 1, `LV6: 벽 미도달이면 segs 1개·검기 없음, 벽 도달이면 segs ${lvFar.pl.segs.length}개·검기 있음`);
  const g = lvMid.pl.segs[0];
  ok(["x1", "y1", "x2", "y2", "safe", "ux", "uy", "L"].every((k) => k in g) && g.safe === false && Math.abs(g.x2 - 870) < 1e-6 && g.L === lvMid.pl.L, "잘린 첫 구간도 같은 구조(x2·L이 멈출 곳)");
  const short = go(810, 270, 3, 800);
  ok(Math.abs(short.s.p.x - (A.W - CFG.pad)) < 0.5 && short.pl.atWall && short.wv === 1, `벽이 min보다 가까우면 벽까지 가고 반사(L ${short.pl.L.toFixed(0)})`);
  const off = blank(); off.lv = 6; const plOff = A.plan(off, 500, 270);
  ok(plOff.L === A.W - CFG.pad - 480 && plOff.segs.length === 2 && plOff.atWall, "chop=false면 가까운 커서여도 벽까지(기존 규칙)");
  const opt = A.createGame(1, { chop: true }), dflt = A.createGame(1);
  ok(opt.chop === true && dflt.chop === false, "createGame(seed, {chop:true}) 와 기본값 false");
  // 예약 입력: 돌진이 끝난 새 위치에서 커서까지 거리를 다시 잰다
  const b = blank(false); b.chop = true; A.slash(b, 600, 270); A.update(b, 1 / 60); A.slash(b, 600, 270);
  run(b, 0.6);
  ok(Math.abs(b.p.x - 480) < 0.5, `예약 클릭은 새 위치(730)에서 다시 계산: (600) 쪽으로 ${C.min} → x ${b.p.x.toFixed(1)}`);
  // 붉은 것: 커서 너머 멈출 곳 뒤에 있으면 걸리지 않는다
  const r = blank(); r.chop = true; r.reds.push({ x: 900, y: 270, vx: 0, vy: 0, r: CFG.red.r, life: 99 });
  const rp = A.plan(r, 600, 270); A.slash(r, 600, 270); run(r, 0.4);
  ok(rp.red.length === 0 && r.state === "play", "멈출 곳 너머의 붉은 것은 미리보기에도 실제로도 걸리지 않는다");
  const rb = blank(false); rb.chop = true; A.slash(rb, 600, 270); A.update(rb, 1 / 60); A.slash(rb, 730, 200); // 끝(730,270)에서 위로
  rb.reds.push({ x: 730, y: 170, vx: 0, vy: 0, r: CFG.red.r, life: 99 }); rb.events.length = 0;
  const rbe = []; for (let i = 0; i < 40; i++) { A.update(rb, 1 / 60); rbe.push(...rb.events); rb.events.length = 0; }
  ok(rb.state === "play" && rbe.some((e) => e.type === "bufferCancel"), "chop 예약 입력도 새 경로에 붉은 것이 있으면 취소");
}
// 20. 즉시 일섬(2026-11-09 v2): s.instant면 몸 구간이 사실상 즉시. 판정·반사는 그대로. 기본 true, opts.instant로 끔
{
  ok(A.createGame(1).instant === true && A.createGame(1, { instant: false }).instant === false && A.createGame(1, { chop: true, instant: true }).chop === true, "createGame 기본 instant true, opts.instant false 허용");
  // 가장 긴 첫 구간(모서리→맞은편 모서리)도 0.04초 안
  const time = (instant) => { const s = blank(instant); s.p.x = CFG.pad + 1; s.p.y = CFG.pad + 1; A.slash(s, A.W, A.H); let t = 0; while (s.dash && t < 2) { A.update(s, 1 / 240); t += 1 / 240; } return { t, L: Math.hypot(s.p.x - CFG.pad - 1, s.p.y - CFG.pad - 1) }; };
  const on = time(true), off = time(false);
  ok(on.t <= 0.04 && off.t > 0.2, `대각선 ${on.L.toFixed(0)}px 첫 구간: instant ${on.t.toFixed(3)}초 <= 0.04 (off ${off.t.toFixed(3)}초)`);
  // 같은 배치에서 instant on/off 결과(벤 적·멈춘 곳·반사)가 같다
  const same = (instant) => { const s = blank(instant); s.xp = CFG.levels[2]; s.lv = 3; for (let i = 0; i < 4; i++) A.add(s, "soldier", 600 + i * 70, 270 + i * 4); A.add(s, "soldier", 300, 270);
    const pl = A.plan(s, 900, 270), evs = []; A.slash(s, 900, 270); for (let i = 0; i < 60 && (s.dash || s.waves.length); i++) { A.update(s, 1 / 60); evs.push(...s.events); s.events.length = 0; }
    return { k: s.kills, x: s.p.x.toFixed(2), bo: evs.filter((e) => e.type === "bounce").length, segs: pl.segs.length, pts: s.score }; };
  const a = same(true), b = same(false);
  ok(JSON.stringify(a) === JSON.stringify(b) && a.k === 5 && a.bo === 1, `LV3 반사 포함 같은 결과: instant ${JSON.stringify(a)} / off ${JSON.stringify(b)}`);
  // 붉은 것 즉사도 그대로
  const r = blank(true); r.reds.push({ x: 700, y: 270, vx: 0, vy: 0, r: CFG.red.r, life: 99 }); A.slash(r, 900, 270); A.update(r, 1 / 60);
  ok(r.state === "end" && r.result.kind === "red", "instant에서도 첫 구간의 붉은 것은 즉사");
  // instantGrace: 도착점에서 원래 돌진 시간만큼 몸 부딪힘 무시, 그 뒤엔 맞는다
  const g = blank(true); g.chop = true; g.p.x = 200; g.p.y = 270; A.slash(g, 400, 270); A.update(g, 1 / 60); const grace = g.p.grace, x = g.p.x;
  A.add(g, "soldier", x + 15, 270); A.update(g, 1 / 60); const hurtEarly = g.p.invuln > 0;
  for (let i = 0; i < 20; i++) { g.enemies[0].x = g.p.x + 15; g.enemies[0].y = g.p.y; A.update(g, 1 / 60); }
  ok(!g.dash && Math.abs(grace - (x - 200) / CFG.dashSpeed) < 1e-9 && !hurtEarly && g.p.invuln > 0, `instant 도착 뒤 ${grace.toFixed(3)}초(=${(x - 200).toFixed(0)}px/원래 속도) 무피격, 그 뒤엔 피격`);
}
console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
