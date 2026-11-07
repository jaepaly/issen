// 게임 규칙(화면과 분리). 브라우저와 node 테스트가 같은 코드를 쓴다.
(function (root) {
  const TILE = 32;
  const LIMIT = 20; // 플레이 제한 시간(초)
  const STOMACH = 3; // 배 칸 수
  const PHYS = {
    g: 2200, maxFall: 950,
    speed: 260, heavySpeed: 210,
    jump: 760, heavyJump: 720,
    coyote: 0.08, buffer: 0.12, shieldTime: 2.0, // 무거운 상태(210px/s)로도 가시 길 10칸을 지나는 시간
  };
  // 음식 글자 → 사람, 사람 → 성질
  const FOOD = { k: "wife", h: "father", j: "friend", s: "mother" };
  const POWER = { wife: "key", father: "heavy", friend: "double", mother: "shield" };

  function createGame(rows) {
    const grid = rows.map((r) => r.split(""));
    const foods = [];
    let start = { x: 0, y: 0 };
    grid.forEach((row, ty) => row.forEach((c, tx) => {
      if (c === "P") { start = { x: tx, y: ty }; row[tx] = "."; }
      else if (FOOD[c]) { foods.push({ id: FOOD[c], x: tx * TILE + 4, y: ty * TILE + 4, w: 24, h: 24, eaten: false }); row[tx] = "."; }
    }));
    return {
      grid, foods, w: grid[0].length, h: grid.length,
      p: { x: start.x * TILE + 5, y: start.y * TILE + 2, w: 22, h: 30, vx: 0, vy: 0, onGround: false, jumps: 0, coyote: 0, buffer: 0, face: 1 },
      stomach: [], forgotten: [], t: 0, state: "play", ending: null, invuln: 0, events: [],
    };
  }

  const has = (s, power) => s.stomach.some((e) => POWER[e.id] === power && !e.spent);

  function eat(s, food) {
    food.eaten = true;
    const i = s.stomach.findIndex((e) => e.id === food.id);
    if (i >= 0) s.stomach.splice(i, 1); // 같은 사람은 다시 가장 최근으로
    s.stomach.push({ id: food.id, spent: false });
    s.events.push({ type: "eat", id: food.id, t: s.t });
    if (s.stomach.length > STOMACH) {
      const old = s.stomach.shift();
      s.forgotten.push(old.id);
      s.events.push({ type: "forget", id: old.id, t: s.t });
    }
  }

  function tileAt(s, tx, ty) {
    if (tx < 0 || tx >= s.w || ty < 0) return "#";
    if (ty >= s.h) return ".";
    return s.grid[ty][tx];
  }
  const isSolid = (c) => c === "#" || c === "W" || c === "D";

  function breakWall(s, tx, ty) {
    const stack = [[tx, ty]];
    while (stack.length) {
      const [x, y] = stack.pop();
      if (tileAt(s, x, y) !== "W") continue;
      s.grid[y][x] = ".";
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    s.events.push({ type: "break", t: s.t });
  }

  function overlapTiles(p, fn) {
    const x0 = Math.floor(p.x / TILE), x1 = Math.floor((p.x + p.w - 0.01) / TILE);
    const y0 = Math.floor(p.y / TILE), y1 = Math.floor((p.y + p.h - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) fn(tx, ty);
  }

  function finish(s, kind) {
    s.state = "end";
    if (kind === "door") {
      const f = [...new Set(s.forgotten)];
      s.ending = f.length ? "forgot_" + f.sort().join("_") : "none";
    } else s.ending = kind;
    s.events.push({ type: "end", ending: s.ending, t: s.t });
  }

  // input: { left, right, jump(이번 프레임에 눌림), jumpHeld, eat(이번 프레임에 눌림) }
  function step(s, input, dt) {
    if (s.state !== "play") return;
    const p = s.p;
    s.t += dt;
    if (s.t >= LIMIT) return finish(s, "fail_time");
    if (s.invuln > 0) s.invuln -= dt;

    const heavy = has(s, "heavy");
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir) p.face = dir;
    p.vx = dir * (heavy ? PHYS.heavySpeed : PHYS.speed);

    if (input.eat) {
      const target = s.foods.find((f) => !f.eaten && f.x < p.x + p.w + 8 && f.x + f.w > p.x - 8 && f.y < p.y + p.h + 8 && f.y + f.h > p.y - 8);
      if (target) eat(s, target);
    }

    p.buffer = input.jump ? PHYS.buffer : Math.max(0, p.buffer - dt);
    p.coyote = p.onGround ? PHYS.coyote : Math.max(0, p.coyote - dt);
    if (p.buffer > 0) {
      const jv = heavy ? PHYS.heavyJump : PHYS.jump;
      if (p.coyote > 0) { p.vy = -jv; p.jumps = 1; p.coyote = 0; p.buffer = 0; }
      else if (input.jump && has(s, "double") && p.jumps < 2) { p.vy = -jv; p.jumps = 2; p.buffer = 0; s.events.push({ type: "double", t: s.t }); }
    }
    if (!input.jumpHeld && p.vy < -320) p.vy = -320; // 짧게 누르면 낮게
    p.vy = Math.min(PHYS.maxFall, p.vy + PHYS.g * dt);

    // 가로 이동과 충돌
    let door = false;
    p.x += p.vx * dt;
    overlapTiles(p, (tx, ty) => {
      const c = tileAt(s, tx, ty);
      if (!isSolid(c)) return;
      if (c === "W" && heavy) { breakWall(s, tx, ty); return; }
      if (c === "D") door = true;
      if (p.vx > 0) p.x = tx * TILE - p.w; else if (p.vx < 0) p.x = (tx + 1) * TILE;
    });
    // 세로 이동과 충돌
    p.y += p.vy * dt;
    p.onGround = false;
    overlapTiles(p, (tx, ty) => {
      const c = tileAt(s, tx, ty);
      if (!isSolid(c)) return;
      if (c === "D") door = true;
      if (p.vy > 0) { p.y = ty * TILE - p.h; p.vy = 0; p.onGround = true; p.jumps = 0; }
      else if (p.vy < 0) { p.y = (ty + 1) * TILE; p.vy = 0; }
    });

    if (door) return finish(s, has(s, "key") ? "door" : "fail_door");

    // 가시: 타일 아래쪽 절반만 판정
    let hurt = false;
    overlapTiles(p, (tx, ty) => {
      if (tileAt(s, tx, ty) === "^" && p.y + p.h > ty * TILE + TILE / 2) hurt = true;
    });
    if (hurt && s.invuln <= 0) {
      const shield = s.stomach.find((e) => POWER[e.id] === "shield" && !e.spent);
      if (shield) { shield.spent = true; s.invuln = PHYS.shieldTime; s.events.push({ type: "shield", t: s.t }); }
      else return finish(s, "fail_fall");
    }
    if (p.y > s.h * TILE) return finish(s, "fail_fall");
  }

  const api = { TILE, LIMIT, STOMACH, PHYS, FOOD, POWER, createGame, step, eat, has };
  if (typeof module !== "undefined") module.exports = api; else root.Game = api;
})(this);
