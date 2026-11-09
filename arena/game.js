// 일섬 아레나 회색 박스: 규칙(화면과 분리). 브라우저와 node 테스트가 같은 코드를 쓴다.
// 한 화면, 사방에서 적이 몰려온다. 클릭한 방향으로 일섬. 20초 동안 최대한 많이 벤다.
// 2026-11-09 v2(사용자 승인): 보충 공급(목표 밀도 3막), 줌 고정, 선형 점수, 보스 처치 → 광란, 즉시 일섬(s.instant) A/B
// 벨 때마다 경험치 → 자동 레벨업(선택 메뉴 없음: 20초를 끊지 않도록). 수치는 전부 AI 초안.
(function (root) {
  const W = 960, H = 540;
  const CFG = {
    limit: 20,
    pad: 22,                 // 화면 가장자리 여백(일섬이 멈추는 벽)
    dashSpeed: 2800, dashSpeedPerLv: 260,
    width: 10, widthPerLv: 1.5, // 판정 두께(적 반경에 더함)
    // 2026-11-06 경직 전부 제거(사용자 결정): 연속 일섬이 재미의 핵심. 허공·피격의 대가는 놓친 경험치와 레벨 하락으로 충분
    hurtInvuln: 0.8, hurtKnock: 60,
    splitDelay: 0.03, hitStop: 0, levelStop: 0, cutStop: { from: 3, base: 0, per: 0, max: 0 }, // 2026-11-07 사용자: 멈칫 대신 다른 연출 → 세계를 멈추지 않는다. 손맛은 main.js의 발도 연출(벤 적이 서 있다가 일섬 끝에 일제히 갈라짐)이 맡는다 // 연출(W3 2026-11-07): 갈라짐 그림은 main.js가 적중 순간에 바로 시작한다
    // 누적 처치 수 → 레벨. 인덱스 i가 레벨 i+1의 시작값
    levels: [0, 8, 22, 45, 80, 125, 190, 280, 400, 550, 750], // 2026-11-06 사용자가 LV11 도달 → 상위 기준 상향
    // 2026-11-07 사용자 결정: 레벨 효과(폭발·잔향·십자·큰 폭발)를 지우고 반사 일섬 하나로. 처음엔 LV3·6·9부터 벽에서 1·2·3번 거울 반사(2026-11-09부터 LV3 1번만)
    // 튕긴 구간은 붉은 것을 통과한다(위험은 처음 조준한 첫 구간에만). 튕긴 구간 처치도 같은 일섬의 꿴 수에 들어간다
    // 튕긴 구간 속도: 첫 구간의 speedMul배 이상, 그리고 일섬 전체가 totalMax초 안에 끝나게(첫 구간이 길면 튕긴 구간 전체에 최소 minTime초)
    // 2026-11-09 사용자 승인: 반사는 LV3에서 1번만([3,6,9]→[3]). 긴 반사 줄이 점수를 지배해 "많이 클릭하며 촥촥"을 보상하지 않았다(봇 측정). LV6·9 능력 알림(perk)도 없다
    bounce: { at: [3], speedMul: 2.5, totalMax: 0.42, minTime: 0.06, minLen: 8 },
    radius: { soldier: 13, runner: 12, dodger: 13, banner: 15, elite: 22, boss: 46 },
    // 엘리트·보스(사용자 요청 2026-11-06: 졸병만 있으면 단조롭다). 여러 번 베어야 하지만 일섬을 막지는 않는다(관통하며 한 번에 1씩)
    // 2026-11-09 v2(사용자 승인): 점수는 선형 틀 하나로. 처치 보너스는 '기본점 몇 개분'(bonus)이고 그 순간 연쇄 배율·광란 배율을 곱한다
    elite: { hp: 3, speed: 45, xp: 10, bonus: 2, from: 7, p: 0.12 }, // p: from초 뒤 보충 무리 하나(먹물 예고 무리 제외)의 맨 앞이 정예일 확률
    boss: { hp: 6, speed: 30, at: 12, warn: 1.2, xp: 40, bonus: 20,
      // 2026-11-07 체력 14→6. 2026-11-07~09의 "화면 전체 발도"(처치 순간 판 위 적 전부 처치, iaiK·iaiCap)는 2026-11-09 v2에서 삭제(사용자 승인):
      // 판을 비우면 그 뒤 벨 적이 없어져 보스를 살려 두고 기다리는 쪽이 이겼다(봇 측정). 대신 광란 frenzy초 동안 모든 점수 ×frenzyMul
      frenzy: 4, frenzyMul: 2 },
    // 2026-11-06 사용자 결정: 엘리트·보스는 체력·크기·그림만 다르고 별도 기믹 없음(호위 소환·처치 시 전멸 연출 제거)
    soldierSpeed: 60, soldierSpeedPerSec: 4,
    runnerAim: 0.6, runnerSpeed: 430,
    dodgerSpeed: 50, dodgeWatch: 0.22, dodgeSpeed: 600, dodgeTime: 0.12, dodgeCd: 1.0,
    // 2026-11-06 궁병 제거(경직이 없고 일섬이 벽까지 가니 의미가 사라짐). 대신 노릴 가치가 있는 금빛 기수
    // 2026-11-09 v2: 기수는 점수가 선형이 되면 경험치만 주는 표적이고, 붉은 것 곁을 따라가거나 무리 뒤에서 와 기다림을 요구해 정기 등장을 껐다(on:false, 봇 측정). 규칙은 남김
    banner: { on: false, xp: 12, every: 4, first: 2.5, escort: 0.6, gap: 50, speed: 40 },
    enemyMax: 120, dropWarn: 0.7,
    chainWindow: 0.8, chainStep: 0.25, chainMax: 6, // 2026-11-07 0.1→0.25: 빗나감(연쇄 끊김)의 대가를 키움(AI 시험값, 봇 측정 근거)
    // 2026-11-09 사용자 승인: chainMax 3→6. 쉬지 않고 이어 베는 손(빠른 클릭)이 긴 한 줄보다 더 보상받게(연쇄 21번째에 상한)
    // 연쇄 배율: 벤 뒤 이 시간 안에 다시 베어야 이어진다. 기다리며 무리가 모이길 노리는 것보다 빠른 손이 이득이게
    // 레벨업 체감(사용자 제안 2026-11-06): 최고 레벨에 따라 화면 배율을 낮춰 싸움판이 넓어진다. 맞아서 레벨이 내려가도 넓어진 판은 유지
    // 2026-11-09 v2(사용자 승인): 줌 고정. 판이 넓어지면 적 공급·이동 거리가 같이 변해 밀도 설계가 흔들린다(옛 값 [1,1,.85,.85,.72,.72,.62,.62,.55,.55,.55])
    zoomByLv: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], zoomRate: 3,
    // 붉은 것(사용자 제안 2026-11-06): 적 사이를 직선으로 가로지른다. 내 일섬이 베면 즉시 끝. 막누르기를 경직 없이 막는다
    red: { r: 18, hitScale: 0.6, speedMin: 70, speedMax: 105, maxCount: 3, everySec: 7, respawn: 0.6,
      areaCap: false,   // 2026-11-07 true면 줌아웃 넓이만큼 상한이 늘던 옛 방식. 지금은 상한 3 고정(AI 시험)
      firstDelay: 1.5 }, // 첫 붉은 것: 첫 클릭 뒤 이 시간 또는 첫 처치 중 이른 쪽(시작부터 깔려 있던 것을 늦춤)
    maxStep: 1 / 60,    // update는 큰 dt를 이 크기 이하로 나눠 처리한다(저fps에서 판정이 건너뛰지 않게)
    // 2026-11-09 v2(사용자 승인): 시간표 대열 대신 보충 공급. 판 위(+먹물 예고 중) 적 수를 막(act)마다 목표 n으로 유지한다.
    // 처치 수가 공급 시간표에 묶여 빠른 손이 더 벨 적이 없던 것을 푼다(봇 측정). 한 명이 쓰러지면 플레이어에게서 먼 쪽에서 채운다.
    // red: 그 막의 붉은 것 목표 수. group: 한 번에 채우는 무리 최대 인원. cands: 자리 후보 수(그중 플레이어에게서 가장 먼 곳). drop: 먹물 예고로 판 안쪽에 솟는 비율
    refill: { acts: [{ t: 0, n: 14, red: 1 }, { t: 7, n: 20, red: 2 }, { t: 14, n: 26, red: 3 }],
      group: 4, cands: 3, out: 30, spread: 70, drop: 0.25, minDist: 260, // minDist: 무리 중심이 플레이어에게서 이만큼은 떨어진다
      runner: 0.06, dodger: 0.06 }, // 2막부터 무리 하나가 주자·산개병 무리일 확률. 봇 측정에서 0~0.12 사이 점수 차가 작아(기다림을 요구하지 않음) 다양성용으로 낮게 둠
    // 점수(2026-11-09 v2, 사용자 승인): 일섬 한 번 = 꿴 수 × base × 연쇄 배율 (× 광란). n²는 긴 줄 노리기를 보상해 빠른 손과 어긋났다(봇 측정)
    scoreBase: 10,
    // 일섬 속도 A/B(2026-11-09 v2): s.instant면 첫 구간(몸)이 이 속도로 사실상 즉시 끝난다(판정·반사 규칙은 그대로). 돌진 시간이 클릭 상한이던 것을 푼다
    instantSpeed: 40000,
    // instantGrace: 즉시 일섬은 몸이 원래 속도(dashSpeed)로 달렸을 시간만큼 도착점에서 몸 부딪힘을 무시한다(p.grace).
    // 돌진 중 무적이 사라져 피격이 두 배가 되던 것(봇: 0.15초 조준 피격 5.5→11.1회)을 A/B에서 떼어 보려는 것
    instantGrace: true,
    // 2026-11-08 시험(사용자 결정: 촥촥 연타가 재미 → 벽 끝까지 튀면 위치를 잃는다): s.chop이면 몸은 커서 너머 over에서 멈춘다.
    // 최소 거리 min으로 '아주 조금씩 연타해 다 썰기'를 막는다. 벽이 min보다 가까우면 벽까지(벽에 닿을 때만 검기 반사). 판 좌표
    chop: { min: 250, over: 90 },
  };

  function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  // 출현마다 따로 뽑는 난수: n번째 대열·붉은 것·기수·대장군은 플레이와 상관없이 같은 시드면 같은 패를 받는다(DAILY 공정성)
  function sub(s, tag) {
    const n = (s.ctr[tag] = (s.ctr[tag] || 0) + 1);
    const r = rng((Math.imul(s.seed | 0, 73856093) ^ Math.imul(tag, 19349663) ^ Math.imul(n, 83492791)) >>> 0);
    r(); r(); return r;
  }

  function levelOf(xp) { let lv = 1; while (lv < CFG.levels.length && xp >= CFG.levels[lv]) lv++; return lv; }
  const dashSpeed = (lv) => CFG.dashSpeed + CFG.dashSpeedPerLv * (lv - 1);
  const bodySpeed = (s, lv) => s.instant ? CFG.instantSpeed : dashSpeed(lv); // 몸(첫 구간) 속도
  const widthOf = (lv) => CFG.width + CFG.widthPerLv * (lv - 1);

  function createGame(seed = 7, opts = {}) {
    const s = {
      // chop: 생성 뒤 s.chop = true/false 대입해도 된다(plan이 매번 읽는다). instant도 생성 뒤 대입 가능(startDash가 읽는다), 기본 true
      // refill: 보충 공급 켜짐(테스트가 빈 판을 만들 때 false). frenzyT: 광란 남은 시간(초). targetN: 지금 막의 목표 적 수
      W, H, CFG, seed, chop: !!(opts && opts.chop), instant: opts && opts.instant != null ? !!opts.instant : true, refill: true, frenzyT: 0, targetN: CFG.refill.acts[0].n, refillLog: [],
      rand: rng(seed), ctr: {}, t: 0, started: false, state: "play", result: null,
      enemies: [], slashes: [], echoes: [], bursts: [], waves: [], nextId: 0, // echoes·bursts는 2026-11-07부터 늘 비어 있다(화면 코드 호환용)
      p: { x: W / 2, y: H / 2, invuln: 0, grace: 0 }, zoom: 1, zoomTarget: 1,
      dash: null, buffer: null, aim: null,
      xp: 0, lv: 1, maxLv: 1, kills: 0, score: 0, bestCut: 0, chain: 0, maxChain: 0,
      hitstop: 0, shake: 0, events: [], spawnT: 1.2, pending: [], reds: [], redT: 0, bannerT: CFG.banner.first, bossState: 0,
    };
    // 첫 붉은 것은 시작부터 깔지 않는다: 첫 클릭 뒤 firstDelay 초 또는 첫 처치 때(startDash·kill에서 redT를 당긴다)
    s.firstRedPending = true; s.redT = Infinity; s.redsSpawned = 0;
    // 시작 배치: 판마다 다른 모양(포위·양쪽 무리·사선 줄). 어느 쪽이든 첫 클릭에 무언가 걸리게 가까이 둔다
    const r = s.rand, opening = Math.floor(r() * 3), rot = r() * Math.PI * 2;
    if (opening === 0) {
      const n = 6 + Math.floor(r() * 4), R = 170 + r() * 80;
      for (let i = 0; i < n; i++) { const a = rot + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.4; add(s, "soldier", W / 2 + Math.cos(a) * R * 1.2, H / 2 + Math.sin(a) * R * 0.85); }
    } else if (opening === 1) {
      for (const sg of [1, -1]) {
        const cx = W / 2 + Math.cos(rot) * 220 * sg, cy = H / 2 + Math.sin(rot) * 150 * sg;
        for (let i = 0; i < 4 + Math.floor(r() * 2); i++) add(s, "soldier", cx + (r() - 0.5) * 70, cy + (r() - 0.5) * 70);
      }
    } else {
      const n = 7, ox = Math.cos(rot), oy = Math.sin(rot), nx = -oy, ny = ox, off = 120 + r() * 60;
      for (let i = 0; i < n; i++) { const k = (i - (n - 1) / 2) * 55; add(s, "soldier", W / 2 + nx * off + ox * k, H / 2 + ny * off * 0.8 + oy * k * 0.8); }
    }
    return s;
  }

  function add(s, type, x, y, extra) {
    if (type !== "boss" && s.enemies.filter((e) => e.alive).length >= CFG.enemyMax * areaK(s) * areaK(s)) return null;
    const e = { id: s.nextId++, type, x, y, r: CFG.radius[type], alive: true, dying: 0, face: 0, cut: 0,
      state: 0, timer: 0, vx: 0, vy: 0, watch: 0, cd: 0, ...extra };
    if (type === "runner") { e.timer = CFG.runnerAim; }
    e.hp = e.maxHp = type === "elite" ? CFG.elite.hp : type === "boss" ? CFG.boss.hp : 1;
    s.enemies.push(e);
    return e;
  }

  // 화면 밖 한 점(변 0~3: 위·오른쪽·아래·왼쪽)
  // 현재 싸움판 경계: 화면 중심을 기준으로 배율만큼 넓어진다
  function bounds(s) {
    const z = s.zoomTarget || s.zoom || 1, hw = W / 2 / z, hh = H / 2 / z;
    return { x0: W / 2 - hw, y0: H / 2 - hh, x1: W / 2 + hw, y1: H / 2 + hh, w: hw * 2, h: hh * 2 };
  }
  const zoomOf = (lv) => CFG.zoomByLv[Math.min(lv, CFG.zoomByLv.length) - 1];
  const areaK = (s) => 1 / zoomOf(s.maxLv); // 넓어진 만큼 적도 더

  function edgePoint(s, side, f, out = 30) {
    const b = bounds(s);
    if (side === 0) return { x: b.x0 + f * b.w, y: b.y0 - out };
    if (side === 1) return { x: b.x1 + out, y: b.y0 + f * b.h };
    if (side === 2) return { x: b.x0 + f * b.w, y: b.y1 + out };
    return { x: b.x0 - out, y: b.y0 + f * b.h };
  }

  // 보충 공급(2026-11-09 v2): 지금 막의 목표 수 n과 판 위(+예고 중) 적 수의 차이만큼 무리를 채운다. 대장군은 세지 않는다
  const actIdx = (t) => { const A = CFG.refill.acts; let i = 0; while (i + 1 < A.length && t >= A[i + 1].t) i++; return i; };
  const actOf = (s) => CFG.refill.acts[actIdx(s.t)];
  const boardCount = (s) => s.enemies.filter((e) => live(e) && e.type !== "boss").length + s.pending.reduce((a, q) => a + q.pts.length, 0);
  function refill(s) {
    const act = actOf(s); s.targetN = act.n;
    for (let need = act.n - boardCount(s), k = 0; need > 0 && k < 40; k++) need -= refillGroup(s, need);
  }
  // 무리 하나. n번째 무리의 난수 패(무리 종류·인원·자리 후보·흩어짐)는 sub(s, 9)라 같은 시드면 플레이와 상관없이 같다(DAILY 공정성).
  // 실제 자리는 후보 cands개 가운데 지금 플레이어에게서 가장 먼 곳이라 플레이어 위치를 따른다. 인원은 패의 인원과 지금 모자란 수 중 작은 쪽
  function refillGroup(s, need) {
    const R = CFG.refill, r = sub(s, 9), t = s.t, ai = actIdx(t);
    const uKind = r(), uDrop = r(), size = 1 + Math.floor(r() * R.group), uElite = r();
    const cands = [];
    for (let i = 0; i < R.cands; i++) cands.push({ side: Math.floor(r() * 4), f: 0.1 + 0.8 * r(), ix: r(), iy: r() });
    const jit = []; for (let i = 0; i < R.group; i++) jit.push([r() - 0.5, r() - 0.5]);
    let kind = "soldier"; // 주자·산개병은 2막(actIdx 1)부터
    if (ai >= 1) { if (uKind < R.runner) kind = "runner"; else if (uKind < R.runner + R.dodger) kind = "dodger"; }
    const drop = kind === "soldier" && uDrop < R.drop, elite = !drop && t >= CFG.elite.from && uElite < CFG.elite.p;
    const g = Math.max(1, Math.min(need, size));
    const p = s.p, b = bounds(s), far = (q) => Math.hypot(q.x - p.x, q.y - p.y);
    const pts = cands.map((c) => drop ? { x: b.x0 + 80 + c.ix * (b.w - 160), y: b.y0 + 70 + c.iy * (b.h - 140) } : edgePoint(s, c.side, c.f, R.out));
    let ci = 0; for (let i = 1; i < pts.length; i++) if (far(pts[i]) > far(pts[ci])) ci = i;
    let c = pts[ci], at = drop ? "drop" : "edge";
    if (far(c) < R.minDist) { // 후보가 모두 가까우면(구석에 몰렸을 때) 플레이어에게서 가장 먼 변으로. 난수를 더 쓰지 않는다
      const gap = [p.y - b.y0, b.x1 - p.x, b.y1 - p.y, p.x - b.x0];
      c = edgePoint(s, gap.indexOf(Math.max(...gap)), cands[0].f, R.out); at = "far";
    }
    // 기록(테스트·측정용): draw·size·cands는 n번째 패의 난수 그대로(플레이와 무관), kind·drop·elite는 그 패를 그때 막에 맞춰 읽은 것, at·dist는 실제 자리
    s.refillLog.push({ n: s.ctr[9], t, act: ai, kind, drop, elite, size, draw: [uKind, uDrop, uElite].map((v) => v.toFixed(6)).join(), cands: cands.map((q) => q.side + ":" + q.f.toFixed(4)).join(","), at, dist: far(c) });
    if (at === "drop") { // 먹물 예고 뒤 솟아난다(기존 drop과 같은 s.pending)
      const list = []; for (let i = 0; i < g; i++) list.push({ x: c.x + jit[i][0] * R.spread, y: c.y + jit[i][1] * R.spread });
      s.pending.push({ x: c.x, y: c.y, pts: list, t: CFG.dropWarn, max: CFG.dropWarn });
      return g;
    }
    for (let i = 0; i < g; i++) add(s, i === 0 && elite ? "elite" : kind, c.x + jit[i][0] * R.spread, c.y + jit[i][1] * R.spread);
    return g;
  }

  const live = (e) => e.alive && e.dying <= 0;

  // 붉은 것: 한 변에서 맞은편 변으로 곧게 가로지른다(적·몸통·튕긴 일섬 구간과는 상호작용 없음)
  function spawnRed(s, first) {
    const r = sub(s, 2), R = CFG.red, side = Math.floor(r() * 4);
    const a = edgePoint(s, side, 0.15 + 0.7 * r(), 30);
    let b = edgePoint(s, (side + 2) % 4, 0.15 + 0.7 * r(), 30);
    // 첫 붉은 것은 화면 안쪽 가장자리 가까이에서 시작해 바로 보이게 한다
    if (first) {
      // 첫 판 학습용: 화면 안쪽, 내 곁과 지금 일섬 길에서 떨어진 곳에 보이게 놓는다
      const clamp = (q) => { q.x = Math.max(60, Math.min(W - 60, q.x)); q.y = Math.max(60, Math.min(H - 60, q.y)); };
      clamp(a);
      for (let k = 0; k < 16 && !safeFirstRed(s, a); k++) { const sd = Math.floor(r() * 4); Object.assign(a, edgePoint(s, sd, 0.15 + 0.7 * r(), 30)); clamp(a); b = edgePoint(s, (sd + 2) % 4, 0.15 + 0.7 * r(), 30); }
    }
    const sp0 = 1 + (areaK(s) - 1) * 0.6; // 판이 넓어지면 가로지르는 속도도 조금 빠르게
    const d = Math.hypot(b.x - a.x, b.y - a.y), sp = (R.speedMin + (R.speedMax - R.speedMin) * r()) * sp0;
    s.reds.push({ x: a.x, y: a.y, vx: (b.x - a.x) / d * sp, vy: (b.y - a.y) / d * sp, r: R.r, life: d / sp + 0.5, first: !!first });
    s.redsSpawned = (s.redsSpawned || 0) + 1; s.firstRedPending = false;
    s.events.push({ type: "redSpawn", x: a.x, y: a.y, first: !!first });
  }
  // 첫 붉은 것 자리 검사: 내 곁(220) 밖, 진행 중 일섬의 남은 길과 떨어져 있어야 한다
  function safeFirstRed(s, a) {
    const p = s.p;
    if (Math.hypot(a.x - p.x, a.y - p.y) < 220) return false;
    const d = s.dash;
    if (d && segDist(p.x, p.y, p.x + d.ux * d.left, p.y + d.uy * d.left, a.x, a.y) < CFG.red.r + 60) return false;
    return true;
  }
  // 금빛 기수: 붉은 것 곁에 붙어 가거나(위험한 보상), 적 무리 뒤에서 따라온다(꿰어야 닿는 보상)
  function spawnBanner(s) {
    const r = sub(s, 3), B = CFG.banner;
    const q = s.reds[Math.floor(r() * s.reds.length)];
    if (q && r() < B.escort) {
      const sp = Math.hypot(q.vx, q.vy), nx = -q.vy / sp, ny = q.vx / sp, sg = r() < 0.5 ? 1 : -1;
      return add(s, "banner", q.x + nx * B.gap * sg, q.y + ny * B.gap * sg, { vx: q.vx, vy: q.vy, life: q.life });
    }
    const side = Math.floor(r() * 4), f = 0.2 + 0.6 * r(), c = edgePoint(s, side, f, 40), back = edgePoint(s, side, f, 110);
    for (let i = 0; i < 5; i++) add(s, "soldier", c.x + (r() - 0.5) * 60, c.y + (r() - 0.5) * 60);
    return add(s, "banner", back.x, back.y);
  }
  // 2026-11-09 v2: 붉은 것 목표 수는 막마다(refill.acts[].red). 적이 늘수록 빨강도 늘어 빠른 판단을 계속 요구한다. 상한 maxCount
  const redTarget = (s) => Math.min(CFG.red.maxCount, actOf(s).red);

  // 현재 위치에서 (ux,uy) 방향으로 화면 벽까지의 거리
  function rayToWall(s, x, y, ux, uy) {
    let L = Infinity;
    const P = CFG.pad, b = bounds(s);
    if (ux > 1e-6) L = Math.min(L, (b.x1 - P - x) / ux);
    if (ux < -1e-6) L = Math.min(L, (b.x0 + P - x) / ux);
    if (uy > 1e-6) L = Math.min(L, (b.y1 - P - y) / uy);
    if (uy < -1e-6) L = Math.min(L, (b.y0 + P - y) / uy);
    return Math.max(0, L);
  }

  function segDist(x1, y1, x2, y2, px, py) {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
    const k = l2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2)) : 0;
    return Math.hypot(x1 + dx * k - px, y1 + dy * k - py);
  }

  const bouncesOf = (lv) => CFG.bounce.at.filter((k) => lv >= k).length;
  // 몸이 갈 거리: 기본은 벽까지. s.chop이면 clamp(커서까지 + over, min, 벽까지)
  function bodyLen(s, dist, wall) {
    if (!s.chop) return wall;
    const C = CFG.chop;
    return Math.min(wall, Math.max(C.min, dist + C.over));
  }

  // 반사 경로: (x,y)에서 (ux,uy)로 벽까지, 벽 법선 기준 거울 반사를 nb번. 모서리에 닿으면 두 성분 모두 뒤집는다
  // 구간: {x1,y1,x2,y2,safe, ux,uy,L}. safe=true(튕긴 구간)는 붉은 것을 통과한다
  function tracePath(s, x, y, ux, uy, nb) {
    const P = CFG.pad, b = bounds(s), segs = [];
    for (let i = 0; i <= nb; i++) {
      let tx = Infinity, ty = Infinity;
      if (ux > 1e-6) tx = (b.x1 - P - x) / ux; else if (ux < -1e-6) tx = (b.x0 + P - x) / ux;
      if (uy > 1e-6) ty = (b.y1 - P - y) / uy; else if (uy < -1e-6) ty = (b.y0 + P - y) / uy;
      const L = Math.max(0, Math.min(tx, ty));
      if (i > 0 && L < CFG.bounce.minLen) break;
      const x2 = x + ux * L, y2 = y + uy * L;
      segs.push({ x1: x, y1: y, x2, y2, safe: i > 0, ux, uy, L });
      const eps = 1e-6 * Math.max(1, L);
      if (tx <= ty + eps) ux = -ux;
      if (ty <= tx + eps) uy = -uy;
      x = x2; y = y2;
    }
    return segs;
  }
  const onSeg = (g, px, py, rr) => segDist(g.x1, g.y1, g.x2, g.y2, px, py) <= rr;

  // 미리보기: 이 방향으로 지금 베면 걸리는 적(적이 움직이므로 실제와 조금 다를 수 있다)
  // cut은 모든 구간 합(중복 없음), red는 첫 구간만(튕긴 구간은 붉은 것을 통과)
  function plan(s, tx, ty) {
    const p = s.p;
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d < 1) return null;
    const ux = dx / d, uy = dy / d;
    let segs = tracePath(s, p.x, p.y, ux, uy, bouncesOf(s.lv));
    const wall = segs[0].L, L = bodyLen(s, d, wall), atWall = L >= wall - 1e-6;
    // chop: 벽에 못 닿고 멈추면 첫 구간만 잘라 남긴다(반사 검기 없음). 구조는 그대로라 조준선·startDash가 따로 알 필요가 없다
    if (!atWall) { const g = segs[0]; segs = [{ ...g, x2: g.x1 + ux * L, y2: g.y1 + uy * L, L }]; }
    if (L < 8) return null;
    const w = widthOf(s.lv);
    const cut = s.enemies.filter((e) => live(e) && segs.some((g) => onSeg(g, e.x, e.y, e.r + w)));
    const red = s.reds.filter((q) => onSeg(segs[0], q.x, q.y, q.r + w));
    return { ux, uy, L, cut, red, segs, atWall };
  }

  function setAim(s, tx, ty) { s.aim = { x: tx, y: ty }; }

  const ready = (s) => s.state === "play" && !s.dash;

  // 클릭: 준비가 안 됐으면 잠깐(0.25초) 기억했다가 준비되는 즉시 나간다
  function slash(s, tx, ty) {
    if (s.state !== "play") return false;
    if (!ready(s)) { s.buffer = { x: tx, y: ty, life: 0.25 }; return false; }
    return startDash(s, tx, ty);
  }

  function startDash(s, tx, ty) {
    const pl = plan(s, tx, ty);
    if (!pl) return false;
    if (s.firstRedPending && !s.started) s.redT = CFG.red.firstDelay;
    s.started = true;
    // sx,sy,ux,uy,left는 현재 구간 기준. hitIds는 일섬 전체에서 공유(튕겨 다시 지나가도 같은 적은 한 번만)
    // v0: 몸 속도(s.instant면 instantSpeed). pts: 이 일섬이 번 점수(셈은 일섬 끝에). mult: 첫 적중 때 정하는 연쇄 배율
    const v0 = bodySpeed(s, s.lv);
    s.dash = { ux: pl.ux, uy: pl.uy, left: pl.L, sx: s.p.x, sy: s.p.y, hits: 0, lv: s.lv, hitIds: new Set(), segs: pl.segs, seg: 0, v0, vb: bounceSpeed(v0, pl.segs), pts: 0, mult: 0,
      grace: s.instant && CFG.instantGrace ? pl.L / dashSpeed(s.lv) : 0 };
    s.events.push({ type: "dash", lv: s.lv });
    return true;
  }

  // 이 일섬의 연쇄 배율: 첫 적중 때 한 번 정한다(직전 적중 일섬이 끝난 뒤 chainWindow 안이면 이어짐)
  const cutMult = (s) => chainMult((s.t - (s.lastHitT ?? -9) > CFG.chainWindow ? 0 : s.chain) + 1);
  const frenzyMul = (s) => s.frenzyT > 0 ? CFG.boss.frenzyMul : 1;
  // 한 번 지나갈 때 1씩. 체력이 남으면 움찔하고, 다하면 벤다
  // 점수(v2): 지나갈 때마다(졸병 처치, 정예·대장군 깎기 모두) 기본점 1개분 × 이 일섬의 연쇄 배율 × 그 순간 광란 배율. 셈은 일섬 끝(finishCut)
  function strike(s, e, ang, d) {
    if (!d.mult) { d.mult = cutMult(s); d.firstT = s.t; }
    d.pts += CFG.scoreBase * d.mult * frenzyMul(s);
    if (e.hp > 1) {
      e.hp--; e.flinch = 0.18;
      s.events.push({ type: "strike", x: e.x, y: e.y, hp: e.hp, kind: e.type, ang });
      return;
    }
    kill(s, e, ang, d);
  }

  // 정예·대장군 처치 보너스는 기본점 bonus개분 × 같은 배율로 바로 들어온다
  function kill(s, e, ang, d) {
    e.dying = CFG.splitDelay; e.cut = ang;
    s.kills++;
    if (s.firstRedPending) s.redT = Math.min(s.redT, 0); // 첫 처치 때 첫 붉은 것(첫 클릭 뒤 firstDelay보다 이르면)
    const mult = d.mult || cutMult(s);
    if (e.type === "elite") {
      const pts = Math.round(CFG.elite.bonus * CFG.scoreBase * mult * frenzyMul(s));
      gainXp(s, CFG.elite.xp); s.score += pts; s.events.push({ type: "elite", x: e.x, y: e.y, score: pts });
    }
    if (e.type === "boss") {
      // 2026-11-09 v2: 판 비우기(발도) 삭제 → 광란. 보너스는 광란 전 배율로 셈하고, 이 순간부터 frenzy초 동안 모든 점수 ×frenzyMul
      const B = CFG.boss, pts = Math.round(B.bonus * CFG.scoreBase * mult * frenzyMul(s));
      gainXp(s, B.xp); s.score += pts;
      e.dying = 0.35; s.shake = 20; // 세계를 멈추지 않는다(갈라짐 연출 0.35초)
      s.frenzyT = B.frenzy;
      // iai: 0은 화면 코드 호환용(발도 없음)
      s.events.push({ type: "bossdown", x: e.x, y: e.y, score: pts, base: pts, iai: 0, mult, frenzy: B.frenzy });
      s.events.push({ type: "frenzy", dur: B.frenzy, x: e.x, y: e.y });
    }
    gainXp(s, e.type === "banner" ? 1 + CFG.banner.xp : 1);
    if (e.type === "banner") s.events.push({ type: "banner", x: e.x, y: e.y, xp: CFG.banner.xp });
  }

  function gainXp(s, n) {
    s.xp += n;
    const lv = levelOf(s.xp);
    if (lv > s.lv) {
      s.lv = lv; s.maxLv = Math.max(s.maxLv, lv);
      if (zoomOf(s.maxLv) < s.zoomTarget) { s.zoomTarget = zoomOf(s.maxLv); s.events.push({ type: "widen", zoom: s.zoomTarget }); }
      if (s.dash) s.pendingStop = Math.max(s.pendingStop || 0, CFG.levelStop); // 일섬 도중이면 끝날 때로 미룬다
      else s.hitstop = Math.max(s.hitstop, CFG.levelStop);
      s.shake = Math.max(s.shake, 4);
      const ev = { type: "level", lv }, k = CFG.bounce.at.indexOf(lv);
      if (k >= 0) ev.perk = { name: "BOUNCE", n: k + 1 };
      s.events.push(ev);
    }
  }

  function endDash(s) {
    const d = s.dash, p = s.p;
    s.dash = null; p.grace = Math.max(p.grace, d.grace || 0);
    s.slashes.push({ x1: d.sx, y1: d.sy, x2: p.x, y2: p.y, age: 0, lv: d.lv, kind: "main", bounce: d.seg });
    finishCut(s, d, p.x, p.y);
  }
  // 일섬 한 번(몸 + 검기)의 셈: 검기가 있으면 검기가 다 날아간 뒤에 한다
  function finishCut(s, d, ex, ey) {
    const p = { x: ex, y: ey };
    // 끝맺음 멈칫: 많이 꿸수록 조금 더 길게(벽에 닿은 뒤 한 박자), 미뤄 둔 레벨업 멈칫도 여기서
    const C = CFG.cutStop, cs = d.hits >= C.from ? Math.min(C.max, C.base + C.per * d.hits) : 0;
    s.hitstop = Math.max(s.hitstop, cs, s.pendingStop || 0); s.pendingStop = 0;
    if (!d.hits) {
      s.chain = 0;
      s.events.push({ type: "miss" });
      return;
    }
    // 연쇄: 이 일섬의 첫 적중이 직전 적중 일섬 끝에서 chainWindow 안이면 이어진다(배율은 첫 적중 때 strike가 정해 둔 d.mult)
    if (d.firstT - (s.lastHitT ?? -9) > CFG.chainWindow) s.chain = 0;
    s.chain++; s.maxChain = Math.max(s.maxChain, s.chain); s.lastHitT = s.t;
    // 한 번에 여럿을 꿸수록 경험치 보너스: n명이면 총 n(n+1)/2 (1→1, 3→6, 5→15)
    // 점수: 2026-11-06 꿴 수² → 2026-11-09 v2(사용자 승인) 꿴 수 × scoreBase × 연쇄 배율(× 광란). strike에서 모아 둔 값
    const mult = d.mult;
    const pts = Math.round(d.pts);
    s.score += pts; s.bestCut = Math.max(s.bestCut, d.hits);
    if (d.hits > 1) { const bonus = d.hits * (d.hits + 1) / 2 - d.hits; gainXp(s, bonus); }
    s.events.push({ type: "multi", hits: d.hits, pts, mult, x: p.x, y: p.y, frenzy: s.frenzyT > 0 });
    s.shake = Math.max(s.shake, Math.min(5, 2 + d.hits * 0.3));
    s.events.push({ type: "dashEnd", hits: d.hits, chain: s.chain });
  }
  // 구간별 속도: 첫 구간은 레벨 속도, 튕긴 구간은 bounceSpeed(일섬 시작 때 한 번 정한다)
  function nextSeg(s, d) { // 벽에서 반사: 다음 구간으로
    const ng = d.segs[++d.seg];
    d.wx = ng.x1; d.wy = ng.y1; d.sx = ng.x1; d.sy = ng.y1; d.ux = ng.ux; d.uy = ng.uy; d.left = ng.L;
    s.events.push({ type: "bounce", x: ng.x1, y: ng.y1, n: d.seg });
  }
  const segSpeed = (d) => d.seg === 0 ? d.v0 : d.vb;
  function bounceSpeed(v, segs) {
    const B = CFG.bounce, rest = segs.slice(1).reduce((a, g) => a + g.L, 0);
    return Math.max(v * B.speedMul, rest / Math.max(B.minTime, B.totalMax - segs[0].L / v));
  }

  const chainMult = (c) => Math.min(CFG.chainMax, 1 + CFG.chainStep * (c - 1));

  function hurt(s, fx, fy) {
    const p = s.p;
    if (p.invuln > 0 || p.grace > 0 || s.dash) return;
    const d = Math.hypot(p.x - fx, p.y - fy) || 1;
    const b = bounds(s);
    p.x = Math.max(b.x0 + CFG.pad, Math.min(b.x1 - CFG.pad, p.x + (p.x - fx) / d * CFG.hurtKnock));
    p.y = Math.max(b.y0 + CFG.pad, Math.min(b.y1 - CFG.pad, p.y + (p.y - fy) / d * CFG.hurtKnock));
    p.invuln = CFG.hurtInvuln;
    s.chain = 0; s.shake = 8;
    // 맞으면 한 레벨 내려간다: 무작정 돌진하는 대가
    if (s.lv > 1) { s.lv--; s.xp = CFG.levels[s.lv - 1]; }
    s.events.push({ type: "hurt", lv: s.lv });
  }

  // 큰 dt(저fps·탭 복귀)는 maxStep 이하로 쪼갠다. 상한을 두어 멈췄다 돌아와도 한 번에 몰아치지 않게
  function update(s, dt) {
    dt = Math.max(0, Math.min(dt || 0, 0.25));
    const n = Math.max(1, Math.ceil(dt / CFG.maxStep - 1e-9));
    for (let i = 0; i < n; i++) step(s, dt / n);
  }

  function step(s, dt) {
    for (const sl of s.slashes) sl.age += dt;
    s.slashes = s.slashes.filter((sl) => sl.age < 0.45);
    for (const b of s.bursts) b.age += dt;
    s.bursts = s.bursts.filter((b) => b.age < 0.4);
    s.shake = Math.max(0, s.shake - dt * 60);
    s.zoom += (s.zoomTarget - s.zoom) * Math.min(1, dt * CFG.zoomRate); // 화면이 쭉 물러나는 연출(규칙 경계는 목표값을 바로 쓴다)
    if (s.state !== "play") return;
    if (!s.started) return; // 첫 클릭 전에는 멈춰 있다
    // 남은 시간은 히트스톱·레벨스톱 중에도 흐른다(2026-11-07: 멈추면 실제 플레이가 24~25초가 되어 20초 규칙을 넘었다)
    s.t += dt;
    if (s.t >= CFG.limit) return finish(s);
    if (s.frenzyT > 0) s.frenzyT = Math.max(0, s.frenzyT - dt); // 광란은 실제 시간으로 줄어든다
    if (s.hitstop > 0) { s.hitstop -= dt; return; } // 연출(세계 움직임)만 멈춘다
    const p = s.p;
    p.invuln = Math.max(0, p.invuln - dt); p.grace = Math.max(0, p.grace - dt);

    // 일섬 이동: 한 프레임 이동 구간을 선분으로 보고 걸린 적을 벤다
    // 한 step 안에서 벽에 닿으면 남은 시간으로 다음 구간을 이어 간다
    let budget = dt;
    while (s.dash && budget > 1e-9) {
      const d = s.dash, sp = segSpeed(d), step = Math.min(d.left, sp * budget), g = d.segs[d.seg];
      budget -= step / sp;
      const x1 = p.x, y1 = p.y, x2 = p.x + d.ux * step, y2 = p.y + d.uy * step;
      const w = widthOf(d.lv), ang = Math.atan2(d.uy, d.ux);
      let n = 0;
      for (const e of s.enemies) if (live(e) && !d.hitIds.has(e.id) && segDist(x1, y1, x2, y2, e.x, e.y) <= e.r + w) { d.hitIds.add(e.id); strike(s, e, ang, d); n++; }
      p.x = x2; p.y = y2; d.left -= step;
      // 실제 판정은 미리보기보다 너그럽다(몸 중심부만): 일섬 도중 붉은 것이 조금 움직여도 억울하지 않게. 튕긴 구간은 통과
      const red = g.safe ? null : s.reds.find((q) => segDist(x1, y1, x2, y2, q.x, q.y) <= q.r * CFG.red.hitScale);
      if (red) {
        s.redHit = { x: red.x, y: red.y, ang };
        s.slashes.push({ x1: d.sx, y1: d.sy, x2, y2, age: 0, lv: d.lv, kind: "main", bounce: d.seg });
        s.dash = null; s.shake = 16;
        s.events.push({ type: "red", x: red.x, y: red.y });
        return finish(s, "red");
      }
      if (n) {
        d.hits += n;
        if (d.hits === n) s.hitstop = Math.max(s.hitstop, CFG.hitStop); // 첫 적중만 멈칫, 나머지는 끊김 없이 관통
        s.events.push({ type: "hit", count: n, chain: s.chain + 1, kind: "main" });
      }
      if (d.left > 0.01) break;
      if (d.seg + 1 < d.segs.length) {
        // 2026-11-07 사용자: 강제로 튕기면 원하는 곳으로 못 간다 → 몸은 조준한 벽에서 멈추고, 칼에서 떨어진 검기만 튕겨 날아간다
        s.slashes.push({ x1: d.sx, y1: d.sy, x2: p.x, y2: p.y, age: 0, lv: d.lv, kind: "main", bounce: 0 });
        s.dash = null; p.grace = Math.max(p.grace, d.grace || 0); s.events.push({ type: "bodyStop", x: p.x, y: p.y });
        d.wx = p.x; d.wy = p.y; nextSeg(s, d); s.waves.push(d);
      } else endDash(s);
    }
    // 검기: 튕긴 구간을 혼자 날아가며 벤다(붉은 것은 통과). 다 날면 그 일섬의 셈을 한다
    for (const d of s.waves) {
      let wb = dt;
      while (!d.done && wb > 1e-9) {
        const step = Math.min(d.left, d.vb * wb); wb -= step / d.vb;
        const x1 = d.wx, y1 = d.wy, x2 = x1 + d.ux * step, y2 = y1 + d.uy * step, w = widthOf(d.lv), ang = Math.atan2(d.uy, d.ux);
        let n = 0;
        for (const e of s.enemies) if (live(e) && !d.hitIds.has(e.id) && segDist(x1, y1, x2, y2, e.x, e.y) <= e.r + w) { d.hitIds.add(e.id); strike(s, e, ang, d); n++; }
        d.wx = x2; d.wy = y2; d.left -= step;
        if (n) { d.hits += n; s.events.push({ type: "hit", count: n, chain: s.chain + 1, kind: "wave" }); }
        if (d.left > 0.01) break;
        s.slashes.push({ x1: d.sx, y1: d.sy, x2: d.wx, y2: d.wy, age: 0, lv: d.lv, kind: "main", bounce: d.seg });
        if (d.seg + 1 < d.segs.length) nextSeg(s, d);
        else { d.done = true; finishCut(s, d, d.wx, d.wy); }
      }
    }
    s.waves = s.waves.filter((d) => !d.done);
    if (s.buffer) {
      if (!s.dash) s.buffer.life -= dt; // 일섬 중에는 기다려 준다
      if (s.buffer.life <= 0) s.buffer = null;
      else if (ready(s)) {
        // 예약 입력은 새 위치에서 다시 계산한다. 그 길에 붉은 것이 있으면 내보내지 않는다(누른 순간엔 없던 위험)
        const b = s.buffer; s.buffer = null;
        const pl = plan(s, b.x, b.y);
        if (pl && pl.red.length) s.events.push({ type: "bufferCancel", x: b.x, y: b.y });
        else startDash(s, b.x, b.y);
      }
    }

    for (const q of s.reds) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
    s.reds = s.reds.filter((q) => q.life > 0);
    s.redT -= dt;
    if (s.reds.length < redTarget(s) && s.redT <= 0) { spawnRed(s, !s.redsSpawned); s.redT = CFG.red.respawn; }

    for (const q of s.pending) { q.t -= dt; if (q.t <= 0) for (const pt of q.pts) add(s, "soldier", pt.x, pt.y); }
    s.pending = s.pending.filter((q) => q.t > 0);
    // 대장군: 한 판에 한 번, 예고(뿔나팔) 뒤 등장
    if (s.bossState === 0 && s.t >= CFG.boss.at - CFG.boss.warn) { s.bossState = 1; s.bossSide = Math.floor(sub(s, 4)() * 4); s.events.push({ type: "bossWarn", side: s.bossSide }); }
    if (s.bossState === 1 && s.t >= CFG.boss.at) { s.bossState = 2; const q = edgePoint(s, s.bossSide, 0.5, 60); add(s, "boss", q.x, q.y); }
    if (CFG.banner.on) { s.bannerT -= dt; if (s.bannerT <= 0) { spawnBanner(s); s.bannerT = CFG.banner.every; } }
    if (s.refill) refill(s); // 2026-11-09 v2: 시간표 대열(spawnWave) 대신 목표 밀도 유지

    const aim = s.aim;
    for (const e of s.enemies) {
      if (!e.alive) continue;
      if (e.dying > 0) {
        e.dying -= dt;
        if (e.dying <= 0) { e.alive = false; s.events.push({ type: "split", x: e.x, y: e.y, kind: e.type, cut: e.cut, face: e.face || 0, r: e.r }); }
        continue;
      }
      const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1;
      const want = Math.atan2(dy, dx);
      if (e.type === "soldier") {
        e.face = want;
        const sp = CFG.soldierSpeed + CFG.soldierSpeedPerSec * s.t;
        e.x += dx / dist * sp * dt; e.y += dy / dist * sp * dt;
      } else if (e.type === "runner") {
        if (e.state === 0) { // 조준: 잠깐 멈춰 나를 노린다(붉은 예고선)
          e.face = want; e.timer -= dt;
          if (e.timer <= 0) { e.state = 1; e.vx = Math.cos(e.face) * CFG.runnerSpeed; e.vy = Math.sin(e.face) * CFG.runnerSpeed; }
        } else {
          e.x += e.vx * dt; e.y += e.vy * dt;
          const b = bounds(s);
          if (e.x < b.x0 - 80 || e.x > b.x1 + 80 || e.y < b.y0 - 80 || e.y > b.y1 + 80) e.alive = false; // 지나쳐 나감
        }
      } else if (e.type === "dodger") {
        e.face = want;
        e.cd = Math.max(0, e.cd - dt);
        if (e.timer > 0) { e.timer -= dt; e.x += e.vx * dt; e.y += e.vy * dt; }
        else {
          e.x += dx / dist * CFG.dodgerSpeed * dt; e.y += dy / dist * CFG.dodgerSpeed * dt;
          // 내 조준선이 오래 머물면 옆으로 비킨다: 고르는 사이에 어긋난다
          if (aim && !s.dash) {
            const ad = Math.hypot(aim.x - p.x, aim.y - p.y) || 1, ux = (aim.x - p.x) / ad, uy = (aim.y - p.y) / ad;
            const L = bodyLen(s, ad, rayToWall(s, p.x, p.y, ux, uy)); // chop이면 실제로 갈 몸 길이만 본다
            const on = segDist(p.x, p.y, p.x + ux * L, p.y + uy * L, e.x, e.y) <= e.r + widthOf(s.lv) + 14;
            e.watch = on ? e.watch + dt : 0;
            if (e.watch >= CFG.dodgeWatch && e.cd <= 0) {
              const side = ((e.x - p.x) * -uy + (e.y - p.y) * ux) >= 0 ? 1 : -1;
              e.vx = -uy * side * CFG.dodgeSpeed; e.vy = ux * side * CFG.dodgeSpeed;
              e.timer = CFG.dodgeTime; e.cd = CFG.dodgeCd; e.watch = 0;
              s.events.push({ type: "dodge", x: e.x, y: e.y });
            }
          }
        }
      } else if (e.type === "elite" || e.type === "boss") {
        e.face = want;
        e.flinch = Math.max(0, (e.flinch || 0) - dt); // 맞으면 그림만 움찔(움직임은 그대로)
        const sp = e.type === "elite" ? CFG.elite.speed : CFG.boss.speed;
        if (dist > e.r + 8) { e.x += dx / dist * sp * dt; e.y += dy / dist * sp * dt; }
      } else if (e.type === "banner") {
        if (e.vx || e.vy) { // 붉은 것 곁을 나란히 따라간다
          e.x += e.vx * dt; e.y += e.vy * dt; e.life -= dt;
          if (e.life <= 0) e.alive = false;
        } else { e.x += dx / dist * CFG.banner.speed * dt; e.y += dy / dist * CFG.banner.speed * dt; }
        continue; // 기수는 몸으로 부딪치지 않는다
      }
      if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + 11) hurt(s, e.x, e.y);
    }
    s.enemies = s.enemies.filter((e) => e.alive || e.dying > 0);
  }

  function finish(s, kind = "time") {
    if (s.state !== "play") return;
    s.state = "end";
    // 시간 종료 때 살아 있는 적은 지우지 않는다(화면 연출이 일제히 가르는 데 쓴다. 점수에는 넣지 않음)
    s.result = { kind, seed: s.seed, time: s.t, score: s.score, bestCut: s.bestCut, kills: s.kills, maxChain: s.maxChain, maxLv: s.maxLv, lv: s.lv };
    s.events.push({ type: "end", kind, remaining: s.enemies.filter(live).length });
  }

  const api = { W, H, CFG, bounds, createGame, plan, slash, setAim, update, refill, refillGroup, boardCount, spawnBanner, levelOf, widthOf, add, bouncesOf, tracePath, bodyLen };
  if (typeof module !== "undefined") module.exports = api; else root.Arena = api;
})(this);
