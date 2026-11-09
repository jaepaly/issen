// 일섬 아레나 회색 박스: 규칙(화면과 분리). 브라우저와 node 테스트가 같은 코드를 쓴다.
// 한 화면, 사방에서 적이 몰려온다. 클릭한 방향으로 화면 끝까지 일섬. 20초 동안 최대한 많이 벤다.
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
    elite: { hp: 3, speed: 45, xp: 10, score: 30, from: 6 },
    boss: { hp: 6, speed: 30, at: 11, warn: 1.2, xp: 40, score: 150, // 처치 점수에 그 순간 연쇄 배율을 곱한다(2026-11-07). 기본점 300→150: 몫을 발도로 옮김
      // 2026-11-07 사용자 결정: 체력 14→6, 쓰러뜨린 순간 "화면 전체 발도" — 판 위 살아 있는 적 전부를 한 일섬으로 친다
      // 점수 = round(iaiK × min(처치 수, iaiCap)² × 그 순간 연쇄 배율). 계수는 봇으로 맞춘 값(11-07 상한 40일 때 보스 발도가 잘한 판 점수의 25~40%)
      // 2026-11-09 사용자 승인: iaiCap 40→15. 보스를 빈사로 두고 적이 모이길 기다리는 쪽이 이기던 것을 줄인다(봇 측정)
      iaiK: 0.5, iaiCap: 15 },
    // 2026-11-06 사용자 결정: 엘리트·보스는 체력·크기·그림만 다르고 별도 기믹 없음(호위 소환·처치 시 전멸 연출 제거)
    soldierSpeed: 60, soldierSpeedPerSec: 4,
    runnerAim: 0.6, runnerSpeed: 430,
    dodgerSpeed: 50, dodgeWatch: 0.22, dodgeSpeed: 600, dodgeTime: 0.12, dodgeCd: 1.0,
    // 2026-11-06 궁병 제거(경직이 없고 일섬이 벽까지 가니 의미가 사라짐). 대신 노릴 가치가 있는 금빛 기수
    banner: { xp: 12, every: 4, first: 2.5, escort: 0.6, gap: 50, speed: 40 },
    enemyMax: 120, dropWarn: 0.7,
    chainWindow: 0.8, chainStep: 0.25, chainMax: 6, // 2026-11-07 0.1→0.25: 빗나감(연쇄 끊김)의 대가를 키움(AI 시험값, 봇 측정 근거)
    // 2026-11-09 사용자 승인: chainMax 3→6. 쉬지 않고 이어 베는 손(빠른 클릭)이 긴 한 줄보다 더 보상받게(연쇄 21번째에 상한)
    // 연쇄 배율: 벤 뒤 이 시간 안에 다시 베어야 이어진다. 기다리며 무리가 모이길 노리는 것보다 빠른 손이 이득이게
    // 레벨업 체감(사용자 제안 2026-11-06): 최고 레벨에 따라 화면 배율을 낮춰 싸움판이 넓어진다. 맞아서 레벨이 내려가도 넓어진 판은 유지
    zoomByLv: [1, 1, 0.85, 0.85, 0.72, 0.72, 0.62, 0.62, 0.55, 0.55, 0.55], zoomRate: 3,
    // 붉은 것(사용자 제안 2026-11-06): 적 사이를 직선으로 가로지른다. 내 일섬이 베면 즉시 끝. 막누르기를 경직 없이 막는다
    red: { r: 18, hitScale: 0.6, speedMin: 70, speedMax: 105, maxCount: 3, everySec: 7, respawn: 0.6,
      areaCap: false,   // 2026-11-07 true면 줌아웃 넓이만큼 상한이 늘던 옛 방식. 지금은 상한 3 고정(AI 시험)
      firstDelay: 1.5 }, // 첫 붉은 것: 첫 클릭 뒤 이 시간 또는 첫 처치 중 이른 쪽(시작부터 깔려 있던 것을 늦춤)
    maxStep: 1 / 60,    // update는 큰 dt를 이 크기 이하로 나눠 처리한다(저fps에서 판정이 건너뛰지 않게)
    spawnStart: 1.0, spawnMin: 0.4, spawnRamp: 0.035, // 대열이 나오는 간격(초): 빠른 손이 더 벨 수 있게 공급이 넉넉해야 한다
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
  const widthOf = (lv) => CFG.width + CFG.widthPerLv * (lv - 1);

  function createGame(seed = 7, opts = {}) {
    const s = {
      // chop: 생성 뒤 s.chop = true/false 대입해도 된다(plan이 매번 읽는다)
      W, H, CFG, seed, chop: !!(opts && opts.chop), rand: rng(seed), ctr: {}, t: 0, started: false, state: "play", result: null,
      enemies: [], slashes: [], echoes: [], bursts: [], waves: [], nextId: 0, // echoes·bursts는 2026-11-07부터 늘 비어 있다(화면 코드 호환용)
      p: { x: W / 2, y: H / 2, invuln: 0 }, zoom: 1, zoomTarget: 1,
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

  // 대열: 매번 다른 형태로 몰려오게 시간에 따라 섞는다
  function spawnWave(s) {
    const r = sub(s, 1), t = s.t, side = Math.floor(r() * 4);
    const pool = [["pack", 3], ["line", 3]];
    if (t > 3) pool.push(["runners", 2]);
    if (t > 4) pool.push(["dodgers", 2]);
    if (t > 5) pool.push(["ring", 2]);
    if (t > 1.5) pool.push(["drop", 3]);
    if (t > 4) pool.push(["pincer", 2]);
    if (t > CFG.elite.from) pool.push(["elite", 1.5]);
    let sum = pool.reduce((a, b) => a + b[1], 0), pick = r() * sum, kind = pool[0][0];
    for (const [k, w] of pool) { if ((pick -= w) < 0) { kind = k; break; } }
    const extra = Math.floor(t / 5), K = areaK(s); // 갈수록, 판이 넓을수록 수가 는다
    if (kind === "pack") {
      const c = edgePoint(s, side, 0.15 + r() * 0.7, 50), n = Math.round((3 + extra + Math.floor(r() * 3)) * K);
      for (let i = 0; i < n; i++) add(s, "soldier", c.x + (r() - 0.5) * 70, c.y + (r() - 0.5) * 70);
    } else if (kind === "line") {
      const n = Math.round((5 + extra + Math.floor(r() * 3)) * K);
      // 줄의 길이·위치·기울기를 매번 다르게: 변을 따라 비스듬히 들어온다
      const f0 = r() * 0.5, span = 0.25 + r() * (0.95 - f0 - 0.25), tilt = (r() - 0.5) * 160;
      for (let i = 0; i < n; i++) { const k = i / (n - 1), q = edgePoint(s, side, f0 + span * k, 30 + tilt * (k - 0.5) + 80); add(s, "soldier", q.x, q.y); }
    } else if (kind === "drop") {
      // 싸움판 안쪽에 먹물이 번진 뒤(예고) 무리가 솟아난다. 내 곁에는 안 나온다
      const b = bounds(s);
      let x = 0, y = 0;
      for (let k = 0; k < 12; k++) { x = b.x0 + 80 + r() * (b.w - 160); y = b.y0 + 70 + r() * (b.h - 140); if (Math.hypot(x - s.p.x, y - s.p.y) > 240) break; }
      const n = Math.round((4 + Math.floor(r() * 3) + extra) * K), shape = r() < 0.5;
      const pts = [];
      for (let i = 0; i < n; i++) pts.push(shape ? { x: x + (r() - 0.5) * 90, y: y + (r() - 0.5) * 90 } : { x: x + (i - (n - 1) / 2) * 34 * Math.cos(r() * 0.3 + side), y: y + (i - (n - 1) / 2) * 34 * Math.sin(r() * 0.3 + side) });
      s.pending.push({ x, y, pts, t: CFG.dropWarn, max: CFG.dropWarn });
    } else if (kind === "elite") {
      const c = edgePoint(s, side, 0.2 + r() * 0.6, 60);
      add(s, "elite", c.x, c.y);
      for (let i = 0; i < Math.round(3 * K); i++) add(s, "soldier", c.x + (r() - 0.5) * 90, c.y + (r() - 0.5) * 90);
    } else if (kind === "pincer") {
      for (const sd of [side, (side + 2) % 4]) {
        const c = edgePoint(s, sd, 0.2 + r() * 0.6, 50), n = Math.round((3 + Math.floor(r() * 2)) * K);
        for (let i = 0; i < n; i++) add(s, "soldier", c.x + (r() - 0.5) * 60, c.y + (r() - 0.5) * 60);
      }
    } else if (kind === "ring") {
      const n = Math.round((8 + extra * 2) * K), R = 520 * K;
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; add(s, "soldier", s.p.x + Math.cos(a) * R, s.p.y + Math.sin(a) * R * 0.75); }
    } else if (kind === "runners") {
      const n = 2 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) { const q = edgePoint(s, side, 0.2 + 0.6 * r(), -10); add(s, "runner", q.x, q.y); }
    } else if (kind === "dodgers") {
      const n = 3 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) { const q = edgePoint(s, side, 0.15 + 0.7 * r(), 40); add(s, "dodger", q.x, q.y); }
    }
    return kind;
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
  const redTarget = (s) => Math.min(CFG.red.areaCap ? Math.round(CFG.red.maxCount * areaK(s)) : CFG.red.maxCount, 1 + Math.floor(s.t / CFG.red.everySec * areaK(s)));

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
    s.dash = { ux: pl.ux, uy: pl.uy, left: pl.L, sx: s.p.x, sy: s.p.y, hits: 0, lv: s.lv, hitIds: new Set(), segs: pl.segs, seg: 0, vb: bounceSpeed(s.lv, pl.segs) };
    s.events.push({ type: "dash", lv: s.lv });
    return true;
  }

  // 한 번 지나갈 때 1씩. 체력이 남으면 움찔하고, 다하면 벤다
  function strike(s, e, ang) {
    if (e.hp > 1) {
      e.hp--; e.flinch = 0.18;
      s.events.push({ type: "strike", x: e.x, y: e.y, hp: e.hp, kind: e.type, ang });
      return;
    }
    kill(s, e, ang);
  }

  function kill(s, e, ang) {
    e.dying = CFG.splitDelay; e.cut = ang;
    s.kills++;
    if (s.firstRedPending) s.redT = Math.min(s.redT, 0); // 첫 처치 때 첫 붉은 것(첫 클릭 뒤 firstDelay보다 이르면)
    if (e.type === "elite") { gainXp(s, CFG.elite.xp); s.score += CFG.elite.score; s.events.push({ type: "elite", x: e.x, y: e.y, score: CFG.elite.score }); }
    if (e.type === "boss") {
      // 그 순간 연쇄 배율: 일섬 도중이면 이 일섬이 받을 배율(연쇄+1), 아니면 현재 연쇄의 배율
      const c = s.dash ? (s.t - (s.lastHitT ?? -9) > CFG.chainWindow ? 0 : s.chain) + 1 : Math.max(1, s.chain);
      const B = CFG.boss, mult = chainMult(c), sc0 = s.score, pts = Math.round(B.score * mult);
      gainXp(s, B.xp); s.score += pts;
      e.dying = 0.35; s.shake = 20; // 2026-11-07: 보스 처치도 세계를 멈추지 않는다(발도 연출이 0.35초 서 있다가 갈라짐을 맡음)
      // 화면 전체 발도: 살아 있는 적 전부(붉은 것 제외)를 체력과 상관없이 같은 프레임에 벤다. 각자 기존 처치 경로(경험치·엘리트/기수 보상)를 탄다
      const vic = s.enemies.filter((o) => o !== e && live(o));
      for (const o of vic) { o.hp = 1; kill(s, o, Math.atan2(o.y - e.y, o.x - e.x) + Math.PI / 2); }
      const n = vic.length, iai = Math.round(B.iaiK * Math.min(n, B.iaiCap) ** 2 * mult);
      s.score += iai;
      s.events.push({ type: "bossIai", x: e.x, y: e.y, hits: n, pts: iai, mult, ids: vic.map((o) => o.id) });
      // score는 이 처치로 실제 들어온 점수 합(보스 기본점 + 발도 + 발도에 걸린 엘리트 보상)
      s.events.push({ type: "bossdown", x: e.x, y: e.y, score: s.score - sc0, base: pts, iai, mult });
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
    s.dash = null;
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
    if (s.t - (s.lastHitT ?? -9) > CFG.chainWindow) s.chain = 0;
    s.chain++; s.maxChain = Math.max(s.maxChain, s.chain); s.lastHitT = s.t;
    // 한 번에 여럿을 꿸수록 경험치 보너스: n명이면 총 n(n+1)/2 (1→1, 3→6, 5→15). 막 긋기보다 노려 꿰기가 레벨을 올린다
    // 점수(사용자 결정 2026-11-06): 일섬 한 번에 꿴 수의 제곱. 막 그어 한두 명씩보다 노려 한 줄로 꿰는 쪽이 크게 앞선다
    const mult = chainMult(s.chain);
    const pts = Math.round(d.hits * d.hits * mult);
    s.score += pts; s.bestCut = Math.max(s.bestCut, d.hits);
    if (d.hits > 1) { const bonus = d.hits * (d.hits + 1) / 2 - d.hits; gainXp(s, bonus); }
    s.events.push({ type: "multi", hits: d.hits, pts, mult, x: p.x, y: p.y });
    s.shake = Math.max(s.shake, Math.min(5, 2 + d.hits * 0.3));
    s.events.push({ type: "dashEnd", hits: d.hits, chain: s.chain });
  }
  // 구간별 속도: 첫 구간은 레벨 속도, 튕긴 구간은 bounceSpeed(일섬 시작 때 한 번 정한다)
  function nextSeg(s, d) { // 벽에서 반사: 다음 구간으로
    const ng = d.segs[++d.seg];
    d.wx = ng.x1; d.wy = ng.y1; d.sx = ng.x1; d.sy = ng.y1; d.ux = ng.ux; d.uy = ng.uy; d.left = ng.L;
    s.events.push({ type: "bounce", x: ng.x1, y: ng.y1, n: d.seg });
  }
  const segSpeed = (d) => d.seg === 0 ? dashSpeed(d.lv) : d.vb;
  function bounceSpeed(lv, segs) {
    const B = CFG.bounce, v = dashSpeed(lv), rest = segs.slice(1).reduce((a, g) => a + g.L, 0);
    return Math.max(v * B.speedMul, rest / Math.max(B.minTime, B.totalMax - segs[0].L / v));
  }

  const chainMult = (c) => Math.min(CFG.chainMax, 1 + CFG.chainStep * (c - 1));

  function hurt(s, fx, fy) {
    const p = s.p;
    if (p.invuln > 0 || s.dash) return;
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
    if (s.hitstop > 0) { s.hitstop -= dt; return; } // 연출(세계 움직임)만 멈춘다
    const p = s.p;
    p.invuln = Math.max(0, p.invuln - dt);

    // 일섬 이동: 한 프레임 이동 구간을 선분으로 보고 걸린 적을 벤다
    // 한 step 안에서 벽에 닿으면 남은 시간으로 다음 구간을 이어 간다
    let budget = dt;
    while (s.dash && budget > 1e-9) {
      const d = s.dash, sp = segSpeed(d), step = Math.min(d.left, sp * budget), g = d.segs[d.seg];
      budget -= step / sp;
      const x1 = p.x, y1 = p.y, x2 = p.x + d.ux * step, y2 = p.y + d.uy * step;
      const w = widthOf(d.lv), ang = Math.atan2(d.uy, d.ux);
      let n = 0;
      for (const e of s.enemies) if (live(e) && !d.hitIds.has(e.id) && segDist(x1, y1, x2, y2, e.x, e.y) <= e.r + w) { d.hitIds.add(e.id); strike(s, e, ang); n++; }
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
        s.dash = null; s.events.push({ type: "bodyStop", x: p.x, y: p.y });
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
        for (const e of s.enemies) if (live(e) && !d.hitIds.has(e.id) && segDist(x1, y1, x2, y2, e.x, e.y) <= e.r + w) { d.hitIds.add(e.id); strike(s, e, ang); n++; }
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
    s.bannerT -= dt;
    if (s.bannerT <= 0) { spawnBanner(s); s.bannerT = CFG.banner.every; }
    s.spawnT -= dt;
    if (s.spawnT <= 0) { spawnWave(s); s.spawnT = Math.max(CFG.spawnMin, CFG.spawnStart - s.t * CFG.spawnRamp); }

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

  const api = { W, H, CFG, bounds, createGame, plan, slash, setAim, update, spawnWave, spawnBanner, levelOf, widthOf, add, bouncesOf, tracePath, bodyLen };
  if (typeof module !== "undefined") module.exports = api; else root.Arena = api;
})(this);
