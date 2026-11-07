// 화면 그리기와 입력. 회색 박스 단계.
(() => {
  const { TILE, LIMIT, STOMACH, createGame, step } = Game;
  const cv = document.getElementById("c");
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  const COLOR = { wife: "#e58fb0", father: "#8a6a4a", friend: "#f2c94c", mother: "#7fc8a9" };
  const keys = new Set(), pressed = new Set();
  const GAME_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyZ", "KeyX", "KeyA", "KeyD", "KeyW", "KeyR", "KeyE"];

  let mode = "title"; // title | play | end
  let s = null, popups = [], last = 0, endAt = 0;

  function reset() { s = createGame(LEVEL); popups = []; mode = "play"; }

  addEventListener("keydown", (e) => {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    if (mode === "title") reset();
    else if (e.code === "KeyR") reset();
    else if (mode === "end" && performance.now() - endAt > 600 && (e.code === "Space" || e.code === "KeyZ")) reset();
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  cv.addEventListener("pointerdown", () => { cv.focus(); if (mode === "title") reset(); });

  const any = (...c) => c.some((k) => keys.has(k));
  const hit = (...c) => c.some((k) => pressed.has(k));

  function frame(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000 || 0);
    last = now;
    if (mode === "play") {
      step(s, {
        left: any("ArrowLeft", "KeyA"), right: any("ArrowRight", "KeyD"),
        jump: hit("Space", "KeyZ", "ArrowUp", "KeyW"), jumpHeld: any("Space", "KeyZ", "ArrowUp", "KeyW"),
        eat: hit("KeyX", "KeyE", "ArrowDown"),
      }, dt);
      for (const ev of s.events) if (ev.type === "forget") popups.push({ id: ev.id, born: now });
      s.events.length = 0;
      if (s.state === "end") { mode = "end"; endAt = now; }
    }
    pressed.clear();
    draw(now);
    requestAnimationFrame(frame);
  }

  function text(str, x, y, size = 18, color = "#eee", align = "center") {
    ctx.font = `${size}px sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(str, x, y);
  }

  function draw(now) {
    ctx.fillStyle = "#1b1d24"; ctx.fillRect(0, 0, W, H);
    if (mode === "title") {
      text(TEXTS.title, W / 2, H / 2 - 30, 34);
      text(TEXTS.howto, W / 2, H / 2 + 20, 18, "#aaa");
      text(TEXTS.start, W / 2, H / 2 + 60, 16, "#777");
      return;
    }
    const p = s.p;
    const camX = Math.max(0, Math.min(s.w * TILE - W, p.x + p.w / 2 - W / 2));
    ctx.save(); ctx.translate(-Math.round(camX), 0);
    const tx0 = Math.floor(camX / TILE), tx1 = tx0 + Math.ceil(W / TILE) + 1;
    for (let ty = 0; ty < s.h; ty++) for (let tx = tx0; tx <= tx1 && tx < s.w; tx++) {
      const c = s.grid[ty][tx], x = tx * TILE, y = ty * TILE;
      if (c === "#") { ctx.fillStyle = "#3a3f4b"; ctx.fillRect(x, y, TILE, TILE); }
      else if (c === "W") { ctx.fillStyle = "#6b5a48"; ctx.fillRect(x, y, TILE, TILE); ctx.strokeStyle = "#2b241c"; ctx.beginPath(); ctx.moveTo(x + 6, y + 4); ctx.lineTo(x + 18, y + 16); ctx.lineTo(x + 10, y + 28); ctx.stroke(); }
      else if (c === "D") { ctx.fillStyle = "#b5813f"; ctx.fillRect(x, y, TILE, TILE); }
      else if (c === "^") { ctx.fillStyle = "#c94c4c"; ctx.beginPath(); ctx.moveTo(x, y + TILE); ctx.lineTo(x + TILE / 2, y + TILE / 2); ctx.lineTo(x + TILE, y + TILE); ctx.fill(); }
    }
    for (const f of s.foods) if (!f.eaten) {
      ctx.fillStyle = COLOR[f.id]; ctx.fillRect(f.x, f.y + Math.sin(now / 300 + f.x) * 2, f.w, f.h);
      text(TEXTS.people[f.id].name, f.x + f.w / 2, f.y - 6, 12, "#ccc");
    }
    // 플레이어: 가장 최근에 먹은 사람 색을 띤다
    const top = s.stomach[s.stomach.length - 1];
    const blink = s.invuln > 0 && Math.floor(now / 80) % 2;
    if (!blink) { ctx.fillStyle = top ? COLOR[top.id] : "#d8d8d8"; ctx.fillRect(p.x, p.y, p.w, p.h); }
    ctx.fillStyle = "#111"; ctx.fillRect(p.x + (p.face > 0 ? 14 : 4), p.y + 8, 4, 4);
    ctx.restore();

    // 배 칸 HUD
    for (let i = 0; i < STOMACH; i++) {
      const e = s.stomach[i], x = 16 + i * 150, y = 14;
      ctx.strokeStyle = "#666"; ctx.strokeRect(x, y, 140, 44);
      if (e) {
        ctx.globalAlpha = e.spent ? 0.35 : 1;
        ctx.fillStyle = COLOR[e.id]; ctx.fillRect(x + 4, y + 4, 36, 36);
        text(TEXTS.people[e.id].name, x + 48, y + 20, 14, "#eee", "left");
        text(TEXTS.people[e.id].power, x + 48, y + 37, 12, "#aaa", "left");
        ctx.globalAlpha = 1;
      }
    }
    text(i18nOldest(), 16, 74, 11, "#777", "left");
    // 남은 시간
    const left = Math.max(0, LIMIT - s.t);
    ctx.fillStyle = "#333"; ctx.fillRect(W - 216, 20, 200, 12);
    ctx.fillStyle = left < 5 ? "#d65a5a" : "#cfcfcf"; ctx.fillRect(W - 216, 20, 200 * left / LIMIT, 12);
    text(left.toFixed(1), W - 16, 52, 16, "#ccc", "right");

    // 잊힘 연출
    popups = popups.filter((q) => now - q.born < 2200);
    popups.forEach((q, i) => {
      const a = Math.min(1, (2200 - (now - q.born)) / 900);
      ctx.globalAlpha = a;
      text(TEXTS.people[q.id].name, W / 2, 140 + i * 56, 24, COLOR[q.id]);
      text(TEXTS.people[q.id].forget, W / 2, 166 + i * 56, 16, "#ddd");
      ctx.globalAlpha = 1;
    });

    if (mode === "end") {
      ctx.fillStyle = "rgba(0,0,0,0.72)"; ctx.fillRect(0, 0, W, H);
      const msg = TEXTS.endings[s.ending] || (s.ending.startsWith("forgot_") || s.ending === "none" ? TEXTS.endings.win_default : s.ending);
      text(msg, W / 2, H / 2 - 10, 24);
      const kept = s.stomach.map((e) => TEXTS.people[e.id].name).join("  ");
      text("kept: " + (kept || "-"), W / 2, H / 2 + 30, 14, "#aaa");
      text("R / Space: again", W / 2, H / 2 + 70, 14, "#777");
    }
  }
  const i18nOldest = () => "← oldest is forgotten first";

  // 점검용: ?play 로 열면 제목 화면을 건너뛴다
  if (location.search.includes("play")) reset();
  requestAnimationFrame(frame);
})();
