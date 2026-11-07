// 일섬 회색 박스: 규칙(화면과 분리). 브라우저와 node 테스트가 같은 코드를 쓴다.
// 수치는 전부 AI 초안이며 손으로 해 보고 바꿀 값이다.
(function (root) {
  const W = 960, H = 540;
  const CFG = {
    worldH: 4200,        // 전장 세로 길이(px)
    limit: 20,           // 제한 시간(초), 첫 클릭부터 잰다
    maxRange: 300,       // 일섬 최대 거리
    slashWidth: 14,      // 일섬 판정 두께(반경에 더함)
    splitDelay: 0.12,    // 벤 뒤 적이 갈라지기까지
    hitStop: 0.05,       // 벨 때 멈춤
    missStagger: 0.35,   // 허공을 갈랐을 때 경직
    hurtStagger: 0.4, hurtKnock: 70, hurtInvuln: 0.7,
    // 2026-11-06 창병(정면 막힘)·방패병(2타) 제거: 돌진 일섬의 연속 흐름을 끊는다는 사용자 지적
    speed: { soldier: 70, archer: 0, general: 0 },
    radius: { soldier: 13, archer: 13, general: 34 },
    hp: { soldier: 1, archer: 1, general: 3 },
    archerPeriod: 1.6, arrowSpeed: 260, activeRange: 520,
  };

  function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

  function createGame(seed = 7) {
    const r = rng(seed);
    const enemies = [];
    let id = 0;
    const add = (type, x, y) => enemies.push({
      id: id++, type, x, y, r: CFG.radius[type], hp: CFG.hp[type], alive: true, dying: 0,
      face: Math.PI / 2, cd: 0.5 + r() * 1.2, flinch: 0, cut: 0,
    });
    // 첫 대열은 시작 위치에서 사거리 안(210px 앞)에 둔다: 첫 클릭이 반드시 무언가를 베도록
    for (let y = CFG.worldH - 360, row = 0; y > 520; y -= 240, row++) {
      const t = 1 - y / CFG.worldH;
      const n = 3 + Math.floor(t * 5);
      const pattern = row % 4;
      for (let i = 0; i < n; i++) {
        const x = 120 + (W - 240) * (n === 1 ? 0.5 : i / (n - 1)) + (r() - 0.5) * 40;
        let type = "soldier";
        if (pattern === 2 && i % 3 === 1) type = "archer";
        add(type, x, y + (r() - 0.5) * 50);
      }
    }
    add("general", W / 2, 260);
    return {
      W, H, CFG, t: 0, started: false, state: "play", result: null,
      enemies, arrows: [], slashes: [],
      p: { x: W / 2, y: CFG.worldH - 150, stagger: 0, invuln: 0 },
      chain: 0, maxChain: 0, kills: 0, hitstop: 0, shake: 0, events: [],
    };
  }

  const alive = (e) => e.alive && e.dying <= 0;

  function finish(s, kind) {
    if (s.state !== "play") return;
    s.state = "end";
    const span = CFG.worldH - 150 - 260;
    s.result = { kind, time: s.t, kills: s.kills, maxChain: s.maxChain, progress: Math.max(0, Math.min(1, 1 - (s.p.y - 260) / span)) };
    s.events.push({ type: "end", kind });
  }

  function hurt(s, fromX, fromY) {
    const p = s.p;
    if (p.invuln > 0) return;
    const d = Math.hypot(p.x - fromX, p.y - fromY) || 1;
    p.x += (p.x - fromX) / d * CFG.hurtKnock; p.y += (p.y - fromY) / d * CFG.hurtKnock;
    clampPlayer(s);
    p.stagger = CFG.hurtStagger; p.invuln = CFG.hurtInvuln;
    s.chain = 0; s.shake = 8;
    s.events.push({ type: "hurt" });
  }

  function clampPlayer(s) {
    s.p.x = Math.max(20, Math.min(W - 20, s.p.x));
    s.p.y = Math.max(20, Math.min(CFG.worldH - 20, s.p.y));
  }

  // 일섬 미리보기와 실제 처리가 같은 계산을 쓴다.
  function plan(s, tx, ty) {
    const p = s.p;
    let dx = tx - p.x, dy = ty - p.y, L = Math.hypot(dx, dy);
    if (L < 1) return null;
    if (L > CFG.maxRange) { dx *= CFG.maxRange / L; dy *= CFG.maxRange / L; L = CFG.maxRange; }
    const ux = dx / L, uy = dy / L;
    const hits = [];
    for (const e of s.enemies) {
      if (!alive(e)) continue;
      const t = (e.x - p.x) * ux + (e.y - p.y) * uy;
      if (t < -e.r || t > L + e.r) continue;
      const tc = Math.max(0, Math.min(L, t));
      if (Math.hypot(p.x + ux * tc - e.x, p.y + uy * tc - e.y) <= e.r + CFG.slashWidth) hits.push({ e, t });
    }
    hits.sort((a, b) => a.t - b.t);
    return { ux, uy, L, endL: L, cut: hits.map((h) => h.e) };
  }

  function slash(s, tx, ty) {
    if (s.state !== "play" || s.p.stagger > 0) return false;
    const pl = plan(s, tx, ty);
    if (!pl) return false;
    s.started = true;
    const p = s.p, sx = p.x, sy = p.y;
    let killed = 0;
    for (const e of pl.cut) {
      e.hp--;
      if (e.hp <= 0) { e.dying = CFG.splitDelay; e.cut = Math.atan2(pl.uy, pl.ux); killed++; s.kills++; }
      else e.flinch = 0.3;
    }
    p.x += pl.ux * pl.endL; p.y += pl.uy * pl.endL;
    clampPlayer(s);
    s.slashes.push({ x1: sx, y1: sy, x2: p.x, y2: p.y, age: 0 });
    if (pl.cut.length) {
      s.chain++; s.maxChain = Math.max(s.maxChain, s.chain);
      s.hitstop = CFG.hitStop; s.shake = Math.min(12, 3 + pl.cut.length * 2);
      s.events.push({ type: "hit", count: pl.cut.length, killed, chain: s.chain });
    } else {
      p.stagger = CFG.missStagger; s.chain = 0;
      s.events.push({ type: "miss" });
    }
    return true;
  }

  function update(s, dt) {
    for (const sl of s.slashes) sl.age += dt;
    s.slashes = s.slashes.filter((sl) => sl.age < 0.4);
    s.shake = Math.max(0, s.shake - dt * 40);
    if (s.state !== "play") return;
    if (s.hitstop > 0) { s.hitstop -= dt; return; }
    if (!s.started) return; // 첫 클릭 전에는 전장이 멈춰 있다
    s.t += dt;
    if (s.t >= CFG.limit) return finish(s, "time");
    const p = s.p;
    p.stagger = Math.max(0, p.stagger - dt);
    p.invuln = Math.max(0, p.invuln - dt);

    for (const e of s.enemies) {
      if (!e.alive) continue;
      if (e.dying > 0) {
        e.dying -= dt;
        if (e.dying <= 0) {
          e.alive = false; e.dying = -1;
          s.events.push({ type: "split", x: e.x, y: e.y, kind: e.type });
          if (e.type === "general") return finish(s, "win");
        }
        continue;
      }
      if (Math.abs(e.y - p.y) > CFG.activeRange) continue;
      e.flinch = Math.max(0, e.flinch - dt);
      const want = Math.atan2(p.y - e.y, p.x - e.x);
      e.face = want;
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      const sp = CFG.speed[e.type] * (e.flinch > 0 ? 0 : 1);
      if (sp && d > e.r + 14) { e.x += Math.cos(want) * sp * dt; e.y += Math.sin(want) * sp * dt; }
      if (e.type === "archer") {
        e.cd -= dt;
        if (e.cd <= 0 && d < 480) {
          e.cd = CFG.archerPeriod;
          s.arrows.push({ x: e.x, y: e.y, vx: Math.cos(want) * CFG.arrowSpeed, vy: Math.sin(want) * CFG.arrowSpeed, life: 2.5 });
        }
      } else if (e.type !== "general" && d < e.r + 12) hurt(s, e.x, e.y);
    }
    for (const a of s.arrows) {
      a.x += a.vx * dt; a.y += a.vy * dt; a.life -= dt;
      if (a.life > 0 && Math.hypot(a.x - p.x, a.y - p.y) < 12) { a.life = 0; hurt(s, a.x - a.vx, a.y - a.vy); }
    }
    s.arrows = s.arrows.filter((a) => a.life > 0);
  }

  const api = { W, H, CFG, createGame, plan, slash, update };
  if (typeof module !== "undefined") module.exports = api; else root.Slash = api;
})(this);
