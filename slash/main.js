// 일섬 회색 박스: 화면·입력·소리. 그림은 임시(종이색 바탕, 먹색 도형, 붉은 선).
(() => {
  const { W, H, CFG, createGame, plan, slash, update } = Slash;
  const cv = document.getElementById("c");
  const ctx = cv.getContext("2d");
  const INK = "#1d1a17", PAPER = "#efe7d6", RED = "#b3261e", FAINT = "rgba(29,26,23,0.18)";

  let s = createGame(7);
  let mouse = { x: W / 2, y: H * 0.3 };
  let camY = 0, last = 0, endAt = 0, particles = [], halves = [];
  let best = null;
  try { best = JSON.parse(localStorage.getItem("slash-best") || "null"); } catch (e) {}

  // ---------- 소리 (첫 클릭 뒤에 만든다) ----------
  let ac = null;
  function audio() { if (!ac) try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} return ac; }
  function noise(dur, freq, gain) {
    const a = audio(); if (!a) return;
    const b = a.createBuffer(1, a.sampleRate * dur, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = a.createBufferSource(); src.buffer = b;
    const f = a.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 1.2;
    const g = a.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(a.destination); src.start();
  }
  function tone(freq, dur, type = "triangle", gain = 0.12) {
    const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur);
  }

  // ---------- 입력 ----------
  function toCanvas(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }
  addEventListener("pointermove", (e) => { mouse = toCanvas(e); });
  cv.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    mouse = toCanvas(e);
    audio();
    if (s.state === "end") { if (performance.now() - endAt > 500) restart(); return; }
    slash(s, mouse.x, mouse.y + camY);
  });
  cv.addEventListener("contextmenu", (e) => e.preventDefault());
  addEventListener("keydown", (e) => { if (e.code === "KeyR" || (e.code === "Space" && s.state === "end")) { e.preventDefault(); restart(); } });
  function restart() { s = createGame(7); particles = []; halves = []; }

  // ---------- 사건 처리 ----------
  function handleEvents(now) {
    for (const ev of s.events) {
      if (ev.type === "hit") {
        noise(0.12, 2400, 0.35);
        tone(320 * Math.pow(1.06, Math.min(ev.chain, 20)), 0.12, "triangle", 0.1);
      } else if (ev.type === "split") {
        noise(0.08, 900, 0.25);
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 220;
          particles.push({ x: ev.x, y: ev.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.3 });
        }
      } else if (ev.type === "miss") { noise(0.1, 500, 0.15); }
      else if (ev.type === "hurt") { tone(110, 0.25, "sawtooth", 0.12); }
      else if (ev.type === "end") {
        endAt = now;
        if (s.result.kind === "win") {
          tone(523, 0.3); setTimeout(() => tone(784, 0.4), 120);
          if (!best || s.result.time < best) { best = s.result.time; try { localStorage.setItem("slash-best", JSON.stringify(best)); } catch (e) {} }
        }
      }
    }
    s.events.length = 0;
    // 갈라지는 연출: 막 죽기 시작한 적을 두 조각으로
    for (const e of s.enemies) if (e.dying > 0 && !e._split) {
      e._split = true;
      halves.push({ e, born: now });
    }
  }

  // ---------- 그리기 ----------
  function circle(x, y, r, fill, stroke, lw = 2) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function text(str, x, y, size, color = INK, align = "center") {
    ctx.font = `${size}px serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(str, x, y);
  }

  function drawEnemy(e) {
    const flash = e.flinch > 0 && Math.floor(e.flinch * 30) % 2;
    const col = flash ? RED : INK;
    if (e.type === "general") {
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(e.x + 30, e.y + 10); ctx.lineTo(e.x + 30, e.y - 70); ctx.stroke();
      ctx.fillStyle = RED; ctx.fillRect(e.x + 30, e.y - 70, 34, 22);
      circle(e.x, e.y, e.r, col);
      for (let i = 0; i < e.hp; i++) circle(e.x - 14 + i * 14, e.y - e.r - 10, 4, RED);
      return;
    }
    circle(e.x, e.y, e.r, col);
    const fx = Math.cos(e.face), fy = Math.sin(e.face);
    if (e.type === "archer") {
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x + fx * 4, e.y + fy * 4, e.r + 5, e.face - 1.2, e.face + 1.2); ctx.stroke();
    }
  }

  function draw(now, dt) {
    const p = s.p;
    const target = Math.max(0, Math.min(CFG.worldH - H, p.y - H * 0.68));
    camY = s.started ? camY + (target - camY) * Math.min(1, dt * 8) : target; // 시작 전에는 검사에 바로 맞춤
    const sh = s.shake;
    ctx.save();
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh - camY);

    // 바닥 결(진행감)
    ctx.strokeStyle = "rgba(29,26,23,0.06)"; ctx.lineWidth = 1;
    for (let y = Math.floor(camY / 120) * 120; y < camY + H; y += 120) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // 조준선(미리보기): 벨 수 있는 적에 붉은 표시
    if (s.state === "play") {
      const pl = plan(s, mouse.x, mouse.y + camY);
      if (pl) {
        const ready = p.stagger <= 0;
        ctx.setLineDash([6, 6]); ctx.strokeStyle = ready ? "rgba(29,26,23,0.45)" : FAINT; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + pl.ux * pl.L, p.y + pl.uy * pl.L); ctx.stroke(); ctx.setLineDash([]);
        circle(p.x, p.y, CFG.maxRange, null, "rgba(29,26,23,0.07)", 1);
        if (ready) {
          for (const e of pl.cut) circle(e.x, e.y, e.r + 5, null, RED, 2);
        }
      }
    }

    for (const e of s.enemies) if (e.alive && e.dying <= 0 && Math.abs(e.y - camY - H / 2) < H) drawEnemy(e);
    // 죽기 직전(갈라지기 전) 적: 그대로 멈춰 있다가
    for (const e of s.enemies) if (e.alive && e.dying > 0) circle(e.x, e.y, e.r, INK);
    // 갈라진 두 조각
    halves = halves.filter((h) => now - h.born < 700);
    for (const h of halves) {
      const e = h.e; if (e.alive) continue;
      const k = (now - h.born - CFG.splitDelay * 1000) / 600;
      if (k < 0) continue;
      const nx = -Math.sin(e.cut), ny = Math.cos(e.cut), off = 4 + k * 26;
      ctx.globalAlpha = Math.max(0, 1 - k);
      for (const sgn of [1, -1]) {
        ctx.beginPath(); ctx.arc(e.x + nx * off * sgn, e.y + ny * off * sgn, e.r, e.cut + (sgn > 0 ? 0 : Math.PI), e.cut + (sgn > 0 ? Math.PI : 2 * Math.PI)); ctx.closePath();
        ctx.fillStyle = INK; ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // 핏방울
    particles = particles.filter((q) => (q.life -= dt) > 0);
    for (const q of particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.9; q.vy *= 0.9; circle(q.x, q.y, 2.5, RED); }
    // 화살
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    for (const a of s.arrows) { const l = Math.hypot(a.vx, a.vy); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x - a.vx / l * 16, a.y - a.vy / l * 16); ctx.stroke(); }
    // 일섬 잔상: 굵은 먹 획 + 붉은 심
    for (const sl of s.slashes) {
      const a = 1 - sl.age / 0.4;
      ctx.lineCap = "round";
      ctx.strokeStyle = `rgba(29,26,23,${0.85 * a})`; ctx.lineWidth = 10 * a + 2;
      ctx.beginPath(); ctx.moveTo(sl.x1, sl.y1); ctx.lineTo(sl.x2, sl.y2); ctx.stroke();
      ctx.strokeStyle = `rgba(179,38,30,${a})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sl.x1, sl.y1); ctx.lineTo(sl.x2, sl.y2); ctx.stroke();
      ctx.lineCap = "butt";
    }
    // 검사
    const blink = p.invuln > 0 && Math.floor(now / 70) % 2;
    if (!blink) {
      circle(p.x, p.y, 12, p.stagger > 0 ? "#bbb" : "#fff", INK, 3);
      ctx.fillStyle = RED; ctx.fillRect(p.x - 12, p.y + 2, 24, 4);
    }
    if (s.chain > 1) text("×" + s.chain, p.x, p.y - 22, 18, RED);
    ctx.restore();

    // HUD: 남은 시간, 진행
    const left = Math.max(0, CFG.limit - s.t);
    ctx.fillStyle = "rgba(29,26,23,0.15)"; ctx.fillRect(20, 16, W - 40, 6);
    ctx.fillStyle = left < 5 ? RED : INK; ctx.fillRect(20, 16, (W - 40) * left / CFG.limit, 6);
    text(left.toFixed(1), W - 20, 44, 18, INK, "right");
    const prog = 1 - (p.y - 260) / (CFG.worldH - 150 - 260);
    ctx.fillStyle = "rgba(29,26,23,0.12)"; ctx.fillRect(W - 14, 60, 4, H - 90);
    ctx.fillStyle = RED; ctx.fillRect(W - 16, 60 + (H - 90) * (1 - Math.max(0, Math.min(1, prog))) - 3, 8, 6);
    ctx.fillRect(W - 18, 52, 12, 8);
    if (!s.started) {
      const a = 0.5 + 0.5 * Math.sin(now / 250);
      text("click", p.x, p.y + 42 - camY, 16, `rgba(29,26,23,${a})`);
    }

    if (s.state === "end") {
      ctx.fillStyle = "rgba(239,231,214,0.85)"; ctx.fillRect(0, 0, W, H);
      const r = s.result;
      if (r.kind === "win") {
        text(r.time.toFixed(2) + "s", W / 2, H / 2 - 20, 56, RED);
        text(best ? "best " + best.toFixed(2) + "s" : "", W / 2, H / 2 + 20, 18);
      } else {
        text(Math.round(r.progress * 100) + "%", W / 2, H / 2 - 20, 56, INK);
      }
      text(`kills ${r.kills}   max chain ×${r.maxChain}`, W / 2, H / 2 + 50, 16);
      text("click / R", W / 2, H / 2 + 90, 14, "rgba(29,26,23,0.5)");
    }
  }

  function frame(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000 || 0);
    last = now;
    update(s, dt);
    handleEvents(now);
    draw(now, dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
