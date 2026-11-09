// 일섬 아레나 회색 박스: 화면·입력·소리. 그림은 임시. 레벨이 오를수록 일섬 이펙트가 화려해진다.
(() => {
  const { W, H, CFG, createGame, plan, slash, setAim, update, widthOf } = Arena;
  const cv = document.getElementById("c");
  const ctx = cv.getContext("2d");
  // 선명도(W3): 내부 해상도만 기기 배율(최대 2)로 올리고, 그리는 좌표는 960×540 논리 좌표 그대로 쓴다(draw 첫머리에서 setTransform)
  const DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  const INK = "#1d1a17", PAPER = "#efe7d6", RED = "#c8241b", ACC = "#2f5d8a", GOLD = "#e0a412", FAINT = "rgba(29,26,23,0.18)";

  // ---------- 기록·시드(W2) ----------
  const TITLE = "ISSEN"; // 최종 제목(2026-11-07 사용자 결정)
  // 등급 기준: tests/arena-sim.js 봇 수치 참고(2026-11-07 W1 시간 수정 뒤: 대충 긋는 봇 131~704, 조준 1초 봇 553~1,161, 0.12~0.6초 봇 1,105~2,631). 사람 기록을 보고 다시 맞춘다
  // 2026-11-09 등급(S~D) 제거(사용자 제안·승인). 결과 화면 목표는 "최고 기록까지 남은 점수"
  const SHARE_URL = "https://jaepaly.github.io/issen/"; // 공유 문구 끝 주소. itch 주소가 생기면 여기만 바꾼다
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} },
  };
  const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  let mode = store.get("arena-mode") === "random" ? "random" : "daily";
  let seed = 0, firstRun = !store.get("arena-played"), titleOn = true, copied = 0, resultAt = 0, heldAtEnd = false, pointerHeld = false;
  // 이동 방식: 2026-11-08 SHORT(커서 근처에서 멈춤, game.js 의 s.chop)와 WALL(벽까지 돌진)을 M 키로 골랐다.
  // 2026-11-09 사용자 승인으로 WALL 은 플레이어 쪽에서 걷어 내고 항상 SHORT. 기록 키는 SHORT 가 쓰던 -chop 접미사 그대로(기존 SHORT 기록 보존).
  // 옛 WALL 기록(접미사 없는 키)은 읽지 않는다. game.js 의 chop=false 경로는 테스트용으로 남아 있다
  const CK = () => "-chop";
  function newGame() { seed = mode === "daily" ? today() : (Math.random() * 1e9) | 0; const g = createGame(seed); g.chop = true; return g; }
  const dailyKey = () => "arena-daily-" + (mode === "daily" && seed ? seed : today()) + CK();
  const bestKey = () => "arena-best-score" + CK();
  let s = newGame();
  let mouse = { x: W / 2 + 120, y: H / 2 - 80 };
  // 그림: Codex CLI 이미지 생성(art/*_src.png) → tools/prep-art.py 가 arena/img 로 정리. 못 불러오면 도형으로 그린다
  const META = window.ART_META || {}; // 이름 → 그림 반폭 대비 몸통 반지름
  const IMG = {};
  for (const k of Object.keys(META).concat(["ground", "splat1", "splat2", "splat3"])) { const im = new Image(); im.src = "img/" + k + ".png"; IMG[k] = im; }
  const ok = (k) => IMG[k] && IMG[k].complete && IMG[k].naturalWidth > 0;
  function sprite(k, x, y, ang, bodyR, alpha = 1) {
    const half = bodyR / (META[k] || 0.35);
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(ang); ctx.drawImage(IMG[k], -half, -half, half * 2, half * 2); ctx.restore();
  }
  const SIZE = { soldier: 1.25, runner: 1.3, dodger: 1.3, elite: 1.2, boss: 1.15, banner: 1.25 }; // 판정 반지름 대비 그림 몸통 크기
  let decals = [], groundPat = null, bossWarn = null, aimDanger = false;
  let vk = 1, last = 0, endAt = 0, particles = [], halves = [], pops = [], flash = 0, lvPop = null;
  let best = +store.get(bestKey()) || 0, dayBest = +store.get(dailyKey()) || 0;
  // 페이스 비교: 판의 점수 곡선(0.5초 간격 41칸)을 저장해 두고, 판 도중 같은 시각의 점수와 비교한다
  // 비교 대상(2026-11-09): 오늘 최고(일일 모드) → 전체 최고 → 직전 판. 무엇과 비교 중인지 왼쪽 위에 작게 쓴다
  const PACE_STEP = 0.5, PACE_POP_MS = 700;
  const dayCurveKey = () => dailyKey() + "-curve", bestCurveKey = () => "arena-best-curve" + CK(), lastCurveKey = () => "arena-last-curve" + CK();
  const readCurve = (k) => { try { const c = JSON.parse(store.get(k) || "null"); return Array.isArray(c) && c.length ? c : null; } catch (e) { return null; } };
  function loadCurve() {
    const order = (mode === "daily" ? [[dayCurveKey(), "vs today"]] : []).concat([[bestCurveKey(), "vs best"], [lastCurveKey(), "vs last"]]);
    for (const [k, label] of order) { const c = readCurve(k); if (c) return { c, label }; }
    return null;
  }
  let run = [], ghost = loadCurve(), paceSplit = 0, pacePop = null;

  // ---------- 소리 ----------
  let ac = null;
  function audio() { if (!ac) try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} return ac; }
  // 첫 입력에서 생성 + suspended면 깨운다(자동재생 정책으로 멈춘 채 만들어지는 경우)
  function wakeAudio() { const a = audio(); if (a && a.state === "suspended") try { a.resume().catch(() => {}); } catch (e) {} return a; }
  function noise(dur, freq, gain) {
    const a = audio(); if (!a) return;
    const b = a.createBuffer(1, Math.max(1, a.sampleRate * dur), a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = a.createBufferSource(); src.buffer = b;
    const f = a.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 1.2;
    const g = a.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(a.destination); src.start();
  }
  // ---- 칼 소리(합성) ----
  // 바람 가르는 소리: 잡음의 대역을 높은 데서 낮은 데로 쓸어내린다
  function whoosh(dur = 0.16, hi = 5200, lo = 900, gain = 0.32) {
    const a = audio(); if (!a) return;
    const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(); src.buffer = b;
    const f = a.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 2.5;
    f.frequency.setValueAtTime(hi, a.currentTime); f.frequency.exponentialRampToValueAtTime(lo, a.currentTime + dur);
    const g = a.createGain(), t = a.currentTime;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.025); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(a.destination); src.start();
  }
  // "촥!": 음정 없는 잡음만. 순간적으로 터지고 빠르게 사라지며, 2ms 단위로 거칠게 끊긴 결이 베어지는 질감을 낸다
  function chwak(gain = 0.55, bright = 3400, dur = 0.13) {
    const a = audio(); if (!a) return;
    const sr = a.sampleRate, n = Math.floor(sr * dur), b = a.createBuffer(1, n, sr), d = b.getChannelData(0);
    const grain = Math.floor(sr * 0.002); let gk = 1;
    for (let i = 0; i < n; i++) {
      if (i % grain === 0) gk = 0.45 + Math.random() * 0.55;
      const att = Math.min(1, i / (sr * 0.003)), env = Math.exp(-i / (sr * 0.032));
      d[i] = (Math.random() * 2 - 1) * att * env * gk;
    }
    const t = a.currentTime;
    const src = a.createBufferSource(); src.buffer = b;
    const hp = a.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900;
    const pk = a.createBiquadFilter(); pk.type = "peaking"; pk.frequency.value = bright; pk.Q.value = 0.9; pk.gain.value = 9;
    const g = a.createGain(); g.gain.value = gain;
    src.connect(hp).connect(pk).connect(g).connect(a.destination); src.start(t);
    // 아래쪽 무게: 같은 결을 낮게 걸러 아주 짧게
    const src2 = a.createBufferSource(); src2.buffer = b;
    const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 650;
    const g2 = a.createGain(); g2.gain.setValueAtTime(gain * 0.9, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    src2.connect(lp).connect(g2).connect(a.destination); src2.start(t);
  }
  // 녹음 효과음: Kenney "RPG Audio"(CC0, arena/sfx/LICENSE-kenney-rpg-audio.txt). 못 불러오면 합성음으로 대신한다
  const SFX = {}, SFX_NAMES = ["cut_a", "cut_b", "swish", "chop_short", "cloth2", "cloth4", "levelup", "banner", "multi", "elite_down", "boss_warn", "boss_down", "red_death", "hurt", "gong_end", "allcut", "tick", "ricochet", "perk", "boss_iai_hold", "boss_iai"]; // 앞 6개: RPG Audio 앞부분만 잘라 짧게(0.11~0.13초). 나머지: Impact Sounds(CC0)를 겹치고 피치를 바꿔 만든 것(tools/build-sfx.py)
  let sfxLoaded = false;
  function loadSfx() {
    const a = audio(); if (!a || sfxLoaded) return; sfxLoaded = true;
    for (const n of SFX_NAMES) fetch("sfx/" + n + ".mp3").then((r) => r.arrayBuffer()).then((b) => a.decodeAudioData(b)).then((buf) => { SFX[n] = buf; }).catch(() => {});
  }
  function play(names, gain = 0.6, rate = 1) {
    const a = audio(); if (!a) return false;
    const n = names[Math.floor(Math.random() * names.length)], buf = SFX[n];
    if (!buf) return false;
    const src = a.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
    const g = a.createGain(); g.gain.value = gain;
    src.connect(g).connect(a.destination); src.start();
    return true;
  }
  let lastCut = 0;
  const BOSS_IAI_SFX_MS = 350; // 대장군 발도: 쓰러진 순간 boss_iai_hold, 이 시간 뒤 boss_iai(R2의 갈라짐 지연과 맞출 것)
  let bossIaiSfxAt = -1;
  function tone(freq, dur, type = "triangle", gain = 0.1) {
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
    e.preventDefault(); mouse = toCanvas(e); wakeAudio(); loadSfx();
    pointerHeld = true;
    if (titleOn) { titleOn = false; return; } // 시작 화면: 첫 클릭은 닫기만(일섬 안 나감)
    if (s.state === "end") {
      const b = COPY_BTN;
      if (mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h) { copyResult(); return; }
      if (!heldAtEnd && resultAt && performance.now() - resultAt > 1200) restart(); // 막 누르던 손이 결과를 건너뛰지 않게
      return;
    }
    const m = world(); slash(s, m.x, m.y);
  });
  addEventListener("pointerup", () => { pointerHeld = false; heldAtEnd = false; });
  const COPY_BTN = { x: W / 2 - 110, y: 382, w: 220, h: 32 };
  function shareLine() {
    const r = s.result;
    return `${TITLE} ${r.score} · best cut ${r.bestCut} · LV${r.maxLv} · ${r.mode === "daily" ? "daily" : "seed"} ${r.seed ?? r.seedUsed} · ${SHARE_URL}`;
  }
  function copyResult() {
    const t = shareLine();
    try { navigator.clipboard.writeText(t).then(() => { copied = performance.now(); }, () => { copied = -performance.now(); }); } catch (e) { copied = -performance.now(); }
  }
  // 판 끝: 전체 최고점과 (일일 모드면) 오늘 최고점을 따로 저장. 첫 판 안내 꼬리표는 한 판 끝나면 끈다
  function recordResult(r) {
    r.prevBest = best; r.prevDay = dayBest; r.mode = mode; r.seedUsed = seed;
    run.push(r.score); // 마지막 칸은 최종 점수
    const curve = JSON.stringify(run);
    store.set(lastCurveKey(), curve); // 직전 판: 최고 곡선이 없을 때의 비교 대상
    if (r.score > best) store.set(bestCurveKey(), curve); // 전체 최고: 일일·랜덤 어느 쪽에서 세웠든
    if (mode === "daily" && r.score > dayBest) store.set(dayCurveKey(), curve);
    if (r.score > best) { best = r.score; r.newBest = best > 0; store.set(bestKey(), best); }
    if (mode === "daily" && r.score > dayBest) { dayBest = r.score; r.newDay = dayBest > 0; store.set(dailyKey(), dayBest); }
    store.set("arena-played", 1); firstRun = false;
  }
  function toggleMode() { mode = mode === "daily" ? "random" : "daily"; store.set("arena-mode", mode); }
  cv.addEventListener("contextmenu", (e) => e.preventDefault());
  addEventListener("keydown", (e) => {
    wakeAudio(); loadSfx();
    const atEnd = s.state === "end", fresh = s.state === "play" && !s.started;
    if (e.code === "KeyT" && (titleOn || atEnd || fresh)) { toggleMode(); if (!atEnd) restart(); return; } // 시작 전·결과 화면에서만 시드 전환
    if (e.code === "KeyC" && atEnd) { copyResult(); return; }
    if (e.code === "KeyR" || e.code === "Space") {
      e.preventDefault();
      if (e.repeat) return; // 누르고 있던 키로 결과를 건너뛰지 않게
      if (atEnd && performance.now() - endAt < 300) return;
      if (atEnd || e.code === "KeyR") { titleOn = false; restart(); }
      else if (titleOn) titleOn = false;
    }
  });
  // 화면 좌표 → 싸움판 좌표(배율이 낮아지면 같은 화면에 더 넓은 판이 보인다)
  function world() { const z = s.zoom; return { x: (mouse.x - W / 2) / z + W / 2, y: (mouse.y - H / 2) / z + H / 2 }; }
  function restart() { decals = []; bossWarn = null; s = newGame(); best = +store.get(bestKey()) || 0; dayBest = +store.get(dailyKey()) || 0; particles = []; halves = []; pops = []; lvPop = null; strokes = []; endFx = null; bossFx = null; perkPop = null; run = []; ghost = loadCurve(); paceSplit = 0; pacePop = null; }

  // 레벨별 이펙트 단계(옛 주석 "붉은 심 → 붉은 빛"은 실제 색과 달랐다. 빨강은 붉은 유닛 전용이라 이펙트에 쓰지 않는다)
  // tier: 0 먹(LV1~2) → 1 검사 기운(LV3~4) → 2 짙은 먹 기운(LV5~6) → 3 금빛(LV7+). HUD 색 등에 쓴다
  const tier = (lv) => (lv >= 7 ? 3 : lv >= 5 ? 2 : lv >= 3 ? 1 : 0);
  // 붓 획 단계(W3): 0 LV1~4 한 획 / 1 LV5~8 굵은 획 + 잔상 한 줄 / 2 LV9+ 더 굵은 획 + 잔상 두 줄 + 금빛 심
  const stage = (lv) => (lv >= 9 ? 2 : lv >= 5 ? 1 : 0);

  // ---------- 연출(W3) ----------
  // 적중 순간 흰 실루엣: 그림마다 오프스크린 캔버스에 source-in 으로 칠해 한 번만 만든다
  const WHITE = {};
  function whiteOf(k) {
    if (WHITE[k] || !ok(k)) return WHITE[k] || null;
    const im = IMG[k], c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext("2d"); g.drawImage(im, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = "#fffaf0"; g.fillRect(0, 0, c.width, c.height);
    return (WHITE[k] = c);
  }
  const HIT_HOLD = 70; // ms: 갈라진 두 쪽이 하얗게 붙어 있는 시간(히트스톱과 같은 순간)
  // 먹 방울: 크기가 제각각인 먹 점이 튀었다가 종이에 떨어져 멈춘다
  function inkBurst(x, y, n, spMax, ang, spread, col) {
    for (let i = 0; i < n; i++) {
      const a = ang == null ? Math.random() * Math.PI * 2 : ang + (Math.random() - 0.5) * spread, sp = 40 + Math.random() * spMax;
      const big = Math.random() < 0.18;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + Math.random() * 0.35, r: big ? 3 + Math.random() * 3.5 : 0.8 + Math.random() * 2.2, col });
    }
  }
  // 적중한 적: 맞은 프레임에 바로 두 쪽 + 먹 방울(소리와 같은 프레임). game.js 의 split 사건은 그림에는 쓰지 않는다
  const cutSeen = new WeakSet();
  // 발도 연출(2026-11-07, 멈칫 대신): 일섬 도중 벤 적은 칼빛만 남긴 채 그 자리에 서 있다가, 일섬이 끝난 뒤 한 박자에 일제히 갈라진다
  const IAI_BEAT = 90; // ms: 벽에 닿은 뒤 갈라지기까지
  let iaiAt = 0;
  function splitNow(e, now, extra) {
    cutSeen.add(e);
    const kind = e.type;
    const h = { x: e.x, y: e.y, cut: e.cut, r: e.r || CFG.radius[kind] || 13, kind, face: e.face || 0, born: now, ...extra };
    halves.push(h);
    if (!extra && (s.dash || (s.waves && s.waves.length)) && s.state === "play") { h.hold = 1e9; h.deferred = true; return; } // 일섬이 끝날 때까지 붙어 서 있다
    if (h.boss) return; // 대장군 발도: 먹 튐은 일제히 갈라질 때(bossIaiRelease)
    splatAt(h);
  }
  function splatAt(e) {
    const st = stage(s.lv);
    inkBurst(e.x, e.y, 7 + st * 5, 180 + st * 90, null, 0, st >= 2 && Math.random() < 0.35 ? GOLD : null);
    inkBurst(e.x, e.y, 5 + st * 2, 300 + st * 80, e.cut, 0.5, null); inkBurst(e.x, e.y, 5 + st * 2, 300 + st * 80, e.cut + Math.PI, 0.5, null); // 칼 방향으로 길게
    const sk = "splat" + (1 + Math.floor(Math.random() * 3));
    if (ok(sk)) { const dc = { k: sk, x: e.x, y: e.y, ang: Math.random() * 6.28, size: (e.r || 13) * (1.1 + st * 0.15), a: Math.max(0.12, 0.32 - decals.length * 0.002) }; decals.push(dc); bgNew.push(dc); if (decals.length > 140) decals.shift(); } // 쌓일수록 옅게(정리 2026-11-07)
  }
  function iaiRelease(now, all) { // 묶어 둔 적을 한꺼번에 가른다(all이 아니면 끝난 일섬의 몫만)
    let n = 0;
    for (const h of halves) if (h.deferred && (all || h.ready)) { h.deferred = false; h.hold = now - h.born; h.whiteEnd = h.hold + 60; splatAt(h); n++; }
    if (!n) return;
    s.shake = Math.max(s.shake, Math.min(6, 2 + n * 0.4)); // 2026-11-07 사용자: 후반에 화면이 너무 흔들림 → 평소 흔들림은 6 이하, 큰 흔들림은 보스·빨간 유닛·끝맺음만 if (n >= 3) flash = Math.max(flash, Math.min(0.12, 0.02 * n));
    if (n >= 4) { if (!play(["allcut"], Math.min(0.9, 0.45 + n * 0.05), 1.08)) chwak(0.8, 2600, 0.2); }
    else if (play(["cut_a", "cut_b"], 0.85, 1.0)) play(["chop_short"], 0.3, 1.2); else chwak(0.7, 2800);
  }
  // 대장군 발도(2026-11-07 사용자 결정): 대장군을 쓰러뜨리면 판 위 모든 적이 하얗게 번쩍 → 칼빛만 남긴 채 서 있다가 BOSS_HOLD 뒤 일제히 갈라진다. 세계는 멈추지 않는다
  const BOSS_HOLD = BOSS_IAI_SFX_MS; // 소리(R3)와 같은 상수: 갈라짐과 '촥'이 같은 순간
  let bossFx = null, perkPop = null;
  const bossExtra = () => ({ hold: BOSS_HOLD, life: 900 + Math.random() * 300, boss: true });
  function bossIaiStart(ev, now) {
    bossFx = { born: now, at: now + BOSS_HOLD, x: ev.x, y: ev.y, hits: ev.hits || 0, pts: ev.pts || 0, mult: ev.mult || 1, done: false };
    const ids = new Set(ev.ids || []);
    for (const e of s.enemies) {
      if (cutSeen.has(e) || !(ids.has(e.id) || (e.type === "boss" && e.dying > 0))) continue;
      if (e.type !== "boss") e.cut = Math.atan2(ev.y - e.y, ev.x - e.x) + (Math.random() - 0.5) * 0.5; // 칼빛: 대장군 쪽을 향한다
      splitNow(e, now, bossExtra());
    }
  }
  function bossIaiRelease(now) {
    bossFx.done = true;
    for (const h of halves) if (h.boss && !h.released) { h.released = true; h.whiteEnd = h.hold + 60; splatAt(h); }
    inkBurst(bossFx.x, bossFx.y, 40, 520, null, 0, GOLD); inkBurst(bossFx.x, bossFx.y, 30, 380, null, 0, null);
    s.shake = Math.max(s.shake, 26); flash = Math.max(flash, 0.18);
  }
  function scanCuts(now) { for (const e of s.enemies) if (e.alive && e.dying > 0 && !cutSeen.has(e)) splitNow(e, now); }
  // 그 판에서 그은 본 일섬을 기억해 둔다(20초 끝맺음 때 남은 적이 이 선들을 따라 갈라진다)
  let strokes = [], endFx = null;
  const strokeSeen = new WeakSet();
  function noteStrokes() { for (const sl of s.slashes) if (sl.kind === "main" && !strokeSeen.has(sl)) { strokeSeen.add(sl); strokes.push(sl); if (strokes.length > 60) strokes.shift(); } }
  // 끝맺음: time = 0.3초 멈칫 → 남은 적이 일제히 갈라짐 → 결과가 0.9~1.3초에 떠오른다 / red = 붉은 유닛이 갈라지며 화면이 붉게 멈칫 → 결과
  const END_CUT = 300, END_IN = [900, 1300], RED_IN = [700, 1100];
  function startEndFx(now) {
    endFx = { born: now, kind: (s.result && s.result.kind) || "time", done: false };
  }
  function endCut(now) { // time 끝맺음의 '촥': 남은 적 전부를 가장 가까운 선(없으면 무작위 사선) 방향으로 가른다
    endFx.done = true; s.shake = Math.max(s.shake, 14); flash = Math.max(flash, 0.12); if (!play(["allcut"], 0.9)) chwak(0.8, 2600, 0.2);
    for (const e of s.enemies) {
      if (!e.alive || cutSeen.has(e)) continue;
      let ang = Math.PI / 4 * (Math.random() < 0.5 ? 1 : 3), bd = 1e9;
      for (const sl of strokes) { const d = segD(sl.x1, sl.y1, sl.x2, sl.y2, e.x, e.y); if (d < bd) { bd = d; ang = Math.atan2(sl.y2 - sl.y1, sl.x2 - sl.x1); } }
      e.cut = ang; splitNow(e, now, { life: 1100 + Math.random() * 300, hold: 40 });
    }
  }
  function segD(x1, y1, x2, y2, px, py) { const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy, k = l2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2)) : 0; return Math.hypot(x1 + dx * k - px, y1 + dy * k - py); }
  // 결과 화면 알파: 끝맺음 연출 동안 0에서 1로(W2 결과 그리기에 곱한다)
  function resultAlpha(now) {
    if (!endFx) return 1;
    const [a, b] = endFx.kind === "red" ? RED_IN : END_IN, t = now - endFx.born;
    return Math.max(0, Math.min(1, (t - a) / (b - a)));
  }

  // ---------- 사건 ----------
  function handleEvents(now) {
    for (const ev of s.events) {
      if (ev.type === "dash") { if (!play(["swish"], 0.55, 1.15)) whoosh(0.12, 3800, 1200, 0.14); }
      else if (ev.type === "hit") {
        // 한 프레임에 여럿을 베도 소리는 겹겹이 쌓이지 않게 30ms 간격을 둔다. 연쇄가 길수록 칼 울림이 조금씩 높아진다
        // 발도: 지나가며 베는 순간은 가볍게 '슥', 진짜 '촥'은 일섬이 끝난 뒤 한꺼번에(iaiRelease)
        if (now - lastCut > 30) { lastCut = now; if (!play(["cut_a", "cut_b"], 0.3, 1.5 + Math.min(s.chain, 20) * 0.012)) chwak(0.25, 4200); }
      } else if (ev.type === "split") {
        // 그림은 적중 프레임에 scanCuts 가 이미 시작했다. 한 프레임 안에 베이고 사라진 경우만 여기서 대신 가른다
        if (!halves.some((h) => h.x === ev.x && h.y === ev.y)) splitNow({ type: ev.kind, x: ev.x, y: ev.y, cut: ev.cut, face: ev.face, r: ev.r }, now, bossFx && bossFx.born === now ? bossExtra(ev) : undefined);
      } else if (ev.type === "bounce") { // 벽 반사: 벽 쪽에서 안쪽으로 먹이 튀고 살짝 흔들린다(소리 자리: R3)
        const b = Arena.bounds(s), P = CFG.pad, dl = [ev.x - (b.x0 + P), (b.x1 - P) - ev.x, ev.y - (b.y0 + P), (b.y1 - P) - ev.y], wi = dl.indexOf(Math.min(...dl));
        const nA = [0, Math.PI, Math.PI / 2, -Math.PI / 2][wi];
        inkBurst(ev.x, ev.y, 10 + stage(s.lv) * 4, 240, nA, 1.5, null); inkBurst(ev.x, ev.y, 4, 120, nA, 2.6, stage(s.lv) >= 2 ? GOLD : null);
        s.shake = Math.max(s.shake, 2);
        play(["ricochet"], 0.6, 1 + Math.min((ev.n || 1) - 1, 3) * 0.08); // 반사할수록 조금 높게
      } else if (ev.type === "bossIai") { bossIaiStart(ev, now);
        bossIaiSfxAt = now; play(["boss_iai_hold"], 0.5, 1); setTimeout(() => { if (!play(["boss_iai"], 1.0, 1)) chwak(0.9, 2200, 0.3); }, BOSS_IAI_SFX_MS); // 대장군 발도: 판 위 모든 적이 서 있다가 한꺼번에 갈라진다(소리 자리: R3)
      } else if (ev.type === "dashEnd") { if (ev.hits) { for (const h of halves) if (h.deferred) h.ready = true; iaiAt = now + IAI_BEAT; } }
      else if (ev.type === "miss") { if (!play(["cloth2", "cloth4"], 0.4, 1.1)) whoosh(0.22, 1500, 300, 0.12); }
      else if (ev.type === "hurt") { if (!play(["hurt"], 0.55)) tone(110, 0.3, "sawtooth", 0.12); pops.push({ str: "LV↓ " + ev.lv, x: s.p.x, y: s.p.y - 30, born: now, col: RED, size: 20 }); }
      else if (ev.type === "multi" && ev.hits > 1) {
        // 2026-11-07 정리: 3명 이상일 때만, 한 번에 하나만(새 글자가 이전 글자를 지운다), 크기 상한 낮춤
        if (ev.hits >= 3) { pops = pops.filter((q) => !q.cut); pops.push({ cut: true, str: ev.hits + " CUT  +" + ev.pts + (ev.mult > 1.001 ? "  ×" + ev.mult.toFixed(1) : ""), x: ev.x, y: ev.y - 30, born: now, col: ev.hits >= 5 ? GOLD : ACC, size: ev.hits >= 5 ? Math.min(32, 18 + ev.hits) : 16 }); }
        if (ev.hits >= 5 && !play(["multi"], 0.5 + Math.min(ev.hits - 5, 5) * 0.04, 1 + Math.min(ev.hits - 5, 5) * 0.03)) { tone(659, 0.12); setTimeout(() => tone(988, 0.2), 60); }
      }
      else if (ev.type === "banner") { pops.push({ str: "+" + ev.xp + " XP", x: ev.x, y: ev.y - 30, born: now, col: GOLD }); if (!play(["banner"], 0.7)) { tone(784, 0.12); setTimeout(() => tone(1047, 0.2), 60); } }
      else if (ev.type === "widen") { noise(0.5, 200, 0.25); tone(196, 0.5, "sine", 0.12); }
      else if (ev.type === "strike") { if (!play(["chop_short"], 0.85, 0.95)) chwak(0.6, 1800, 0.16); inkBurst(ev.x, ev.y, 8, 260, ev.ang, 1.2, null); }
      else if (ev.type === "elite") { pops.push({ str: "+" + ev.score, x: ev.x, y: ev.y - 40, born: now, col: INK, size: 26 }); if (!play(["elite_down"], 0.6)) tone(392, 0.2, "square", 0.08); }
      else if (ev.type === "bossWarn") { bossWarn = { side: ev.side, born: now }; if (!play(["boss_warn"], 0.8)) { tone(110, 1.0, "sawtooth", 0.1); setTimeout(() => tone(147, 0.9, "sawtooth", 0.1), 350); } }
      else if (ev.type === "bossdown") { if (bossFx && bossFx.born === now) bossFx.pts = ev.score; else pops.push({ str: "+" + fmt(ev.score), x: ev.x, y: ev.y - 70, born: now, col: GOLD, size: 54 }); flash = 0.3; /* 발도가 있으면 처치 총점을 화면 가운데 ISSEN 점수로(bossFx) */ if (bossIaiSfxAt === now) {} /* 발도 소리가 대신한다 */ else if (!play(["boss_down"], 0.9)) { tone(523, 0.3); setTimeout(() => tone(659, 0.3), 90); setTimeout(() => tone(784, 0.3), 180); setTimeout(() => tone(1047, 0.6), 270); noise(0.6, 400, 0.4); } }
      else if (ev.type === "red") { if (!play(["red_death"], 0.9)) { tone(90, 0.6, "sawtooth", 0.18); noise(0.4, 300, 0.4); } flash = 0.2; }
      else if (ev.type === "dodge") { noise(0.05, 4000, 0.06); }
      else if (ev.type === "level") {
        if (ev.perk ? play(["perk"], 0.85, 1) : play(["levelup"], 0.8, 1 + Math.min(ev.lv, 8) * 0.015)) {} /* 새 능력이면 도장 소리가 레벨업 소리를 대신한다 */ else { tone(523, 0.15); setTimeout(() => tone(659, 0.15), 70); setTimeout(() => tone(784, 0.25), 140); }
        if (ev.perk) perkPop = { name: ev.perk.name, n: ev.perk.n, lv: ev.lv, born: now }; // 새 능력: 화면 가운데 먹 도장(이때는 LV 글자 대신)
        else lvPop = { lv: ev.lv, born: now };
        flash = 0.25;
      } else if (ev.type === "bufferCancel") { // 예약해 둔 일섬이 붉은 것 때문에 취소됨
        pops.push({ str: "CANCEL", x: s.p.x, y: s.p.y - 26, born: now, col: RED, size: 13 }); play(["tick"], 0.35);
      } else if (ev.type === "end") {
        iaiRelease(now, true); iaiAt = 0; endAt = now; resultAt = 0; heldAtEnd = pointerHeld; copied = 0; startEndFx(now); if (ev.kind !== "red") play(["gong_end"], 0.9, 1.06); // 붉은 죽음은 red_death 가 이미 울렸다
        recordResult(s.result);
      }
    }
    s.events.length = 0;
  }

  // ---------- 그리기 ----------
  function circle(x, y, r, fill, stroke, lw = 2) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function text(str, x, y, size, color = INK, align = "center") {
    ctx.font = `${size}px serif`; ctx.textAlign = align;
    // 종이색 외곽선(W3): 먹 획·먹 자국 위에서도 읽히게. 글자색이 반투명이면 외곽선도 같은 비율로 옅게
    const m = /rgba\([^)]*,\s*([\d.]+)\)/.exec(color), al = m ? +m[1] : 1;
    if (al > 0.02 && color !== PAPER) { ctx.lineJoin = "round"; ctx.lineWidth = Math.max(2, size * 0.16); ctx.strokeStyle = `rgba(239,231,214,${0.9 * al})`; ctx.strokeText(str, x, y); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  function line(x1, y1, x2, y2, col, w) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

  function drawEnemy(e) {
    const fx = Math.cos(e.face), fy = Math.sin(e.face);
    if (e.type === "runner" && e.state === 0) { ctx.setLineDash([4, 6]); line(e.x, e.y, e.x + fx * 260, e.y + fy * 260, "rgba(29,26,23,0.35)", 2); ctx.setLineDash([]); }
    if (ok(e.type)) {
      const jit = e.flinch > 0 ? (Math.random() - 0.5) * 6 : 0;
      const k = e.type === "banner" ? vk : 1;
      sprite(e.type, e.x + jit, e.y + jit, e.face || 0, e.r * SIZE[e.type] * k);
      if (e.flinch > 0.11 && whiteOf(e.type)) { const half = e.r * SIZE[e.type] * k / (META[e.type] || 0.35); ctx.save(); ctx.translate(e.x + jit, e.y + jit); ctx.rotate(e.face || 0); ctx.drawImage(WHITE[e.type], -half, -half, half * 2, half * 2); ctx.restore(); } // 맞은 순간 하얗게
      if (e.type === "elite") for (let i = 0; i < e.hp; i++) circle(e.x - 10 + i * 10, e.y - e.r - 12, 3.5, INK);
      if (e.type === "dodger" && e.watch > 0) circle(e.x, e.y, e.r + 4 + e.watch * 20, null, ACC, 1.5);
      return;
    }
    if (e.type === "elite" || e.type === "boss") { circle(e.x, e.y, e.r, e.flinch > 0 ? "#555" : INK); return; }
    if (e.type === "runner") {
      ctx.beginPath(); ctx.moveTo(e.x + fx * 18, e.y + fy * 18); ctx.lineTo(e.x - fx * 10 - fy * 11, e.y - fy * 10 + fx * 11); ctx.lineTo(e.x - fx * 10 + fy * 11, e.y - fy * 10 - fx * 11); ctx.closePath();
      ctx.fillStyle = INK; ctx.fill();
      return;
    }
    if (e.type === "banner") { // 금빛 기수: 깃대와 깃발
      const k = vk;
      line(e.x + 10 * k, e.y + 6 * k, e.x + 10 * k, e.y - 42 * k, INK, 3 * k);
      ctx.fillStyle = GOLD; ctx.fillRect(e.x + 10 * k, e.y - 42 * k, 26 * k, 16 * k);
      circle(e.x, e.y, e.r * k, GOLD, INK, 2 * k);
      return;
    }
    circle(e.x, e.y, e.r, INK);
    if (e.type === "dodger") { // 양옆 발: 비켜서는 놈
      line(e.x - fy * 18, e.y + fx * 18, e.x - fy * 11, e.y + fx * 11, INK, 3);
      line(e.x + fy * 18, e.y - fx * 18, e.x + fy * 11, e.y - fx * 11, INK, 3);
      if (e.watch > 0) circle(e.x, e.y, e.r + 4 + e.watch * 20, null, ACC, 1.5);
    }
  }

  // 일섬 자국: 붓으로 확 그은 거친 먹 획
  // - 시작은 빠르게 굵어지고 끝은 칼끝처럼 가늘게 빠진다
  // - 가장자리가 들쭉날쭉하고, 획 안에 종이색 마른 붓 결(갈라진 줄)이 지나간다
  // - 획 바깥으로 먹 방울이 튄다. 처음 0.1초는 칼날 섬광이 가운데를 지나간다
  // 모양은 시작점 좌표로 정한 난수라 진행 중 획과 끝난 획이 같은 모양을 유지한다
  function srand(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function drawSlash(sl) {
    // 2026-11-07 사용자: 후반에 검기 반사 때문에 내 위치를 잃는다 → 검기(bounce≥1) 획은 가늘고 옅게, 빨리 걷힌다. 눈은 몸이 그은 첫 획에 남게
    const life = (sl.bounce || 0) > 0 ? 0.22 : 0.45, age = sl.age, a = Math.max(0, 1 - age / life) * ((sl.bounce || 0) > 0 ? 0.5 : 1), st = stage(sl.lv), z = s.zoom || 1;
    const minor = sl.kind !== "main" || (sl.bounce || 0) > 0;
    // 반사 일섬(2026-11-07): 튕긴 구간(bounce≥1)은 조금 더 가늘고 날렵하게, 칼끝 섬광이 금빛. 꺾이는 지점은 굵기를 이어 준다
    const bn = sl.bounce || 0, joinIn = bn > 0, joinOut = !!sl.joinOut;
    const dx = sl.x2 - sl.x1, dy = sl.y2 - sl.y1, L = Math.hypot(dx, dy);
    if (L < 2) return;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const seed = (Math.floor(sl.x1 * 7 + sl.y1 * 13) % 2147483646 + 2147483646) % 2147483646 + 1, r = srand(seed);
    const N = Math.max(8, Math.min(40, Math.floor(L * z / 18)));
    // 굵기 = 실제 판정 폭(판 좌표). 2026-11-07 사용자: 화면은 넓어지는데 획만 굵어져 과했다(화면 기준 16→48px, 잔상까지 100px 넘게 덮음)
    // → 적과 같은 비율로 줄어들게 판 좌표로 그리고, 너무 가늘어지지 않게 화면 10px만 바닥으로 둔다. 단계 차이는 색·잔상·먹 방울로
    const Wd = (minor ? 0.55 : bn ? 0.8 : 1) * Math.max(10 / z, Arena.widthOf(sl.lv) * 1.9) * Math.pow(a, 0.6);
    const t0 = Math.min(0.92, Math.pow(Math.min(1, age / 0.35), 1.6)); // 꼬리가 끝 쪽으로 걷혀 간다
    const s0w = joinIn ? 0.8 : 0.35, tip = joinOut ? 0.55 : 1; // 꺾임: 들어오는 쪽은 굵게 시작, 다음 구간이 있으면 끝을 덜 뾰족하게
    const prof = (u) => (u < 0.12 ? s0w + u / 0.12 * (1 - s0w) : 1) * (1 - tip * Math.pow(u, 5)); // 시작 굵고 끝은 칼끝
    const P = (t, off) => ({ x: sl.x1 + dx * t + nx * off, y: sl.y1 + dy * t + ny * off });
    // 들쭉날쭉한 붓 획 다각형 하나(shadowBlur 없이 칠만 한다: 큰 획이 많아도 가볍게)
    function poly(w, tStart, off, sd, fill) {
      const rr = srand(sd), jag = 0.3 + 0.4 * Math.min(1, 18 / (w * z + 1)); // 굵은 획일수록 톱니를 줄인다
      ctx.beginPath();
      const right = [];
      for (let k = 0; k <= N; k++) {
        const t = tStart + (1 - tStart) * (k / N), hw = w / 2 * prof(t), jl = 1 + (rr() - 0.5) * jag, jr = 1 + (rr() - 0.5) * jag;
        const q = P(t, off + hw * jl); if (k) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
        right.push(P(t, off - hw * jr));
      }
      for (let k = right.length - 1; k >= 0; k--) ctx.lineTo(right[k].x, right[k].y);
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    }
    if (!minor) {
      // 금빛 번짐(LV9+): 그림자 흐림 대신 넓은 반투명 획을 한 겹 깐다
      if (st >= 2) poly(Wd * 1.2, t0 * 0.9, 0, seed + 3, `rgba(224,164,18,${0.28 * a})`);
      // 잔상: LV5~8 한 줄, LV9+ 양쪽 두 줄. 본 획보다 늦게 걷히고 옆으로 비껴 있다
      if (st >= 1) poly(Wd * 0.35, t0 * 0.75, Wd * 0.62, seed + 1, `rgba(29,26,23,${0.32 * a})`);
      if (st >= 2) poly(Wd * 0.3, t0 * 0.6, -Wd * 0.66, seed + 2, `rgba(29,26,23,${0.26 * a})`);
    }
    poly(Wd, t0, 0, seed, `rgba(29,26,23,${(minor ? 0.6 : 0.92) * a})`);
    if (joinIn && t0 < 0.05) circle(sl.x1, sl.y1, Wd * 0.42, `rgba(29,26,23,${0.92 * a})`); // 꺾인 자리: 먹이 고여 획이 이어진다
    // 마른 붓 결: 획 안을 종이색 가는 줄이 끊기며 지나간다
    const streaks = minor ? 2 : 4 + st;
    ctx.lineWidth = Math.max(1 / z, Wd * 0.06); ctx.strokeStyle = `rgba(239,231,214,${0.85 * a})`;
    ctx.beginPath();
    for (let k2 = 0; k2 < streaks; k2++) {
      const off = (r() - 0.5) * 0.7, s0 = t0 + r() * 0.25 * (1 - t0);
      let t = s0, on = true;
      while (t < 0.97) {
        const seg = (0.05 + r() * 0.2) * (on ? 1 : 0.5), t2 = Math.min(0.97, t + seg);
        if (on) { const A = P(t, off * Wd * prof(t)), B = P(t2, off * Wd * prof(t2)); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); }
        t = t2; on = !on;
      }
    }
    ctx.stroke();
    // 먹 방울: 단계가 오를수록 많고 멀리 튄다
    if (!minor) {
      ctx.fillStyle = `rgba(29,26,23,${0.8 * a})`;
      ctx.beginPath();
      for (let k3 = 0, n3 = 10 + st * 8; k3 < n3; k3++) {
        const t = t0 + r() * (1 - t0), side = r() < 0.5 ? 1 : -1, d = Wd * (0.55 + r() * (0.9 + st * 0.5)), rr = (1 + r() * 3) / Math.sqrt(z);
        const q = P(t, side * d); ctx.moveTo(q.x + rr, q.y); ctx.arc(q.x, q.y, rr * Math.sqrt(a), 0, 6.283);
      }
      ctx.fill();
    }
    // 칼날 섬광: 처음 잠깐, 가운데를 가늘게(LV9+ 는 금빛으로 조금 더 오래)
    const fl = st >= 2 || bn ? 0.16 : 0.1;
    if (age < fl) {
      const fa = 1 - age / fl, core = st >= 2 || bn ? `rgba(255,236,170,${fa})` : `rgba(255,255,255,${fa})`;
      const A = P(t0, 0), B = P(1, 0);
      line(A.x, A.y, B.x, B.y, core, Math.max(1.5 / z, Wd * (0.12 + st * 0.03)));
    }
    if (bn && !minor) { const A = P(Math.max(t0, 0.72), 0), B = P(0.99, 0); line(A.x, A.y, B.x, B.y, `rgba(224,164,18,${0.75 * a})`, Math.max(1.5 / z, Wd * 0.14)); } // 튕긴 구간: 칼끝 쪽이 금빛
  }

  // 바닥 층 캐시(W3 성능): 배율이 바뀔 때만 다시 굽고, 새 먹 자국은 생길 때 한 번만 덧그린다
  const BGM = 24; // 흔들림 여백
  let bg = null, bgNew = [];
  function bakeDecal(g, d) { const half = d.size / (META[d.k] || 0.35); g.save(); g.globalAlpha = d.a; g.translate(d.x, d.y); g.rotate(d.ang); g.drawImage(IMG[d.k], -half, -half, half * 2, half * 2); g.restore(); }
  function bgLayer(zRaw) {
    const z = Math.round(zRaw * 2000) / 2000, gr = ok("ground");
    if (!bg || bg.z !== z || bg.s !== s || bg.gr !== gr) {
      if (!bg) { const c = document.createElement("canvas"); c.width = Math.round((W + BGM * 2) * DPR); c.height = Math.round((H + BGM * 2) * DPR); bg = { c, g: c.getContext("2d") }; }
      const g = bg.g; bg.z = z; bg.s = s; bg.gr = gr;
      g.setTransform(DPR, 0, 0, DPR, 0, 0); g.globalAlpha = 1; g.fillStyle = PAPER; g.fillRect(0, 0, W + BGM * 2, H + BGM * 2);
      g.translate(BGM + W / 2, BGM + H / 2); g.scale(z, z); g.translate(-W / 2, -H / 2);
      if (gr) {
        if (!groundPat) { groundPat = g.createPattern(IMG.ground, "repeat"); if (groundPat.setTransform) groundPat.setTransform(new DOMMatrix().scale(512 / IMG.ground.naturalWidth)); }
        const hw = (W / 2 + BGM) / z, hh = (H / 2 + BGM) / z;
        g.fillStyle = groundPat; g.fillRect(W / 2 - hw, H / 2 - hh, hw * 2, hh * 2);
      }
      bgNew = decals.slice();
    }
    for (const d of bgNew) if (ok(d.k)) bakeDecal(bg.g, d);
    bgNew.length = 0;
    return bg.c;
  }

  function draw(now, dt) {
    const p = s.p, tr = tier(s.lv);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1;
    noteStrokes(); scanCuts(now); if (iaiAt && now >= iaiAt) { iaiAt = 0; iaiRelease(now); }
    if (bossFx && !bossFx.done && now >= bossFx.at) bossIaiRelease(now);
    // 끝맺음 진행: time 은 0.3초 멈칫(살짝 당겨 들어감) 뒤 일제히 가른다
    const ef = endFx, et = ef ? now - ef.born : 0;
    if (ef && ef.kind !== "red" && !ef.done && et >= END_CUT) endCut(now);
    const punch = ef ? (ef.kind === "red" ? 1 + 0.04 * Math.min(1, et / 120) : et < END_CUT ? 1 + 0.035 * (et / END_CUT) : 1 + 0.035 * Math.max(0, 1 - (et - END_CUT) / 250)) : 1;
    ctx.save();
    const sh = s.shake, z = s.zoom * punch, shx = (Math.random() - 0.5) * sh, shy = (Math.random() - 0.5) * sh; vk = Math.max(1, 0.85 / s.zoom);
    // 바닥 + 먹 자국은 미리 구운 한 장을 붙인다(매 프레임 큰 무늬 채우기·자국 수십 장 그리기를 없앤다)
    ctx.drawImage(bgLayer(z), shx - BGM, shy - BGM, W + BGM * 2, H + BGM * 2);
    ctx.translate(shx + W / 2, shy + H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
    const b = Arena.bounds(s);
    ctx.strokeStyle = FAINT; ctx.lineWidth = 2 / z; ctx.strokeRect(b.x0 + CFG.pad - 10, b.y0 + CFG.pad - 10, b.w - 2 * CFG.pad + 20, b.h - 2 * CFG.pad + 20);

    // 조준 계산(그리기는 유닛 위에서 한다: 적에 가려지지 않게)
    let aimPl = null;
    if (s.state === "play") { const m = world(); setAim(s, m.x, m.y); aimPl = plan(s, m.x, m.y); }
    // 솟아날 자리 예고: 먹물이 번진다
    for (const q of s.pending) { const k = 1 - q.t / q.max; for (const pt of q.pts) circle(pt.x, pt.y, 4 + k * 12, `rgba(29,26,23,${0.08 + k * 0.25})`); }
    for (const e of s.enemies) if (e.alive && e.dying <= 0 && !cutSeen.has(e)) drawEnemy(e);
    // 베인 적(dying)은 halves 가 대신 그린다
    for (const q of s.reds) {
      if (s.redHit && Math.hypot(q.x - s.redHit.x, q.y - s.redHit.y) < 2) continue; // 벤 붉은 유닛은 아래에서 두 쪽으로 그린다
      const pulse = 1 + 0.08 * Math.sin(now / 120);
      if (ok("red")) { sprite("red", q.x, q.y, now / 900, q.r * pulse * vk * 1.1); circle(q.x, q.y, q.r * vk * 1.25, null, "rgba(200,36,27,0.5)", 2 * vk); }
      else { circle(q.x, q.y, q.r * pulse * vk, "rgba(200,36,27,0.25)", RED, 4 * vk); circle(q.x, q.y, 5 * vk, RED); }
      if (firstRun && s.state === "play") text("DON'T CUT", q.x, q.y - q.r * vk * 1.25 - 8 / z, 13 / z, RED); // 첫 판 안내
    }
    if (s.redHit) { // 베어 버린 붉은 것: 갈라진 채 멈춰 있다
      const h = s.redHit, nx = -Math.sin(h.ang), ny = Math.cos(h.ang);
      // 끝맺음(red): 처음엔 붙어 있다가 0.35초에 걸쳐 벌어진다. 붉은 먹이 칼 방향으로 한 번 튄다
      const rk = ef && ef.kind === "red" ? 1 - Math.pow(1 - Math.min(1, et / 350), 3) : 1, sep = 2 + rk * 20;
      if (ef && ef.kind === "red" && !ef.done) { ef.done = true; inkBurst(h.x, h.y, 16, 260, null, 0, RED); inkBurst(h.x, h.y, 10, 420, h.ang, 0.4, RED); inkBurst(h.x, h.y, 10, 420, h.ang + Math.PI, 0.4, RED); }
      for (const sg of [1, -1]) {
        ctx.beginPath(); ctx.arc(h.x + nx * sep * sg, h.y + ny * sep * sg, CFG.red.r * vk * 1.1, h.ang + (sg > 0 ? 0 : Math.PI), h.ang + (sg > 0 ? Math.PI : 2 * Math.PI)); ctx.closePath();
        ctx.fillStyle = RED; ctx.fill();
      }
    }
    // 갈라진 두 쪽: 처음 HIT_HOLD 동안 붙은 채 하얗게(맞은 프레임), 그 뒤 벤 선을 따라 벌어지며 옅어진다
    halves = halves.filter((h) => now - h.born < (h.life || 600) + (h.hold ?? HIT_HOLD));
    for (const h of halves) {
      const hold = h.hold ?? HIT_HOLD, el = now - h.born, life = h.life || 600, k = Math.max(0, el - hold) / life, nx = -Math.sin(h.cut), ny = Math.cos(h.cut);
      const ek = 1 - Math.pow(1 - Math.min(1, k * 1.6), 3), off = (el < hold ? 0 : 3) + ek * 26, white = el < Math.min(hold, HIT_HOLD) || (h.whiteEnd && el > hold && el < h.whiteEnd);
      const fade = Math.max(0, 1 - Math.pow(k, 1.5));
      for (const sg of [1, -1]) {
        if (ok(h.kind)) { // 그림을 벤 선을 따라 반으로 잘라 양쪽으로 벌린다
          const big = h.r * 6;
          ctx.save(); ctx.translate(h.x + nx * off * sg, h.y + ny * off * sg); ctx.rotate(h.cut);
          ctx.beginPath(); ctx.rect(-big, sg > 0 ? 0 : -big, big * 2, big); ctx.clip(); ctx.rotate(-h.cut + sg * ek * 0.45);
          ctx.globalAlpha = fade;
          const half = h.r * (SIZE[h.kind] || 1.2) * (h.kind === "banner" ? vk : 1) / (META[h.kind] || 0.35);
          ctx.rotate(h.face); ctx.drawImage(white && whiteOf(h.kind) ? WHITE[h.kind] : IMG[h.kind], -half, -half, half * 2, half * 2); ctx.restore();
          continue;
        }
        ctx.globalAlpha = fade;
        ctx.beginPath(); ctx.arc(h.x + nx * off * sg, h.y + ny * off * sg, h.r, h.cut + (sg > 0 ? 0 : Math.PI), h.cut + (sg > 0 ? Math.PI : 2 * Math.PI)); ctx.closePath();
        ctx.fillStyle = white ? "#fffaf0" : INK; ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (el < hold + 90) line(h.x - Math.cos(h.cut) * h.r * 2.2, h.y - Math.sin(h.cut) * h.r * 2.2, h.x + Math.cos(h.cut) * h.r * 2.2, h.y + Math.sin(h.cut) * h.r * 2.2, `rgba(255,250,240,${1 - el / (hold + 90)})`, 2.5 / z); // 벤 자리의 가는 칼빛
    }
    // 먹 방울: 크기 제각각, 튀다가 멈추며 마른다(금빛은 LV9+ 에서만 섞인다)
    particles = particles.filter((q) => (q.life -= dt) > 0);
    for (const q of particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.88; q.vy *= 0.88; circle(q.x, q.y, (q.r || 2) * Math.min(1, q.life * 4), q.col || (q.gold ? GOLD : INK)); }
    // 반사 일섬은 구간마다 한 획. 다음 구간이 이어지는 획은 끝을 덜 뾰족하게(joinOut)
    const near = (a, b) => Math.abs(a - b) < 1.5;
    for (const sl of s.slashes) {
      if (sl.kind === "main" && sl.joinOut === undefined) sl.joinOut = s.slashes.some((o) => o !== sl && o.kind === "main" && (o.bounce || 0) === (sl.bounce || 0) + 1 && near(o.x1, sl.x2) && near(o.y1, sl.y2));
      drawSlash(sl);
    }
    // 이동 중인 일섬: 지나온 길을 바로 긋는다(반사 일섬이면 지나온 구간까지)
    if (s.dash) {
      const d = s.dash, sg = d.segs && d.segs.length ? d.segs : null, i = sg ? Math.min(d.seg | 0, sg.length - 1) : 0;
      if (sg) for (let j = 0; j < i; j++) { const q = sg[j]; if (!s.slashes.some((o) => o.kind === "main" && near(o.x1, q.x1) && near(o.y1, q.y1))) drawSlash({ x1: q.x1, y1: q.y1, x2: q.x2, y2: q.y2, age: 0, lv: d.lv, kind: "main", bounce: j, joinOut: true }); }
      const x1 = sg ? sg[i].x1 : d.sx, y1 = sg ? sg[i].y1 : d.sy;
      drawSlash({ x1, y1, x2: p.x, y2: p.y, age: 0, lv: d.lv, kind: "main", bounce: i, joinOut: false });
    }
    // 검기(2026-11-07): 몸은 벽에서 멈추고 칼에서 떨어진 검기가 혼자 튕겨 날아간다. 지나온 자리는 획, 머리는 초승달 칼빛
    for (const d of s.waves || []) {
      drawSlash({ x1: d.sx, y1: d.sy, x2: d.wx, y2: d.wy, age: 0, lv: d.lv, kind: "main", bounce: d.seg, joinOut: false });
      const ang = Math.atan2(d.uy, d.ux), R = Math.max(9 / (s.zoom || 1), Arena.widthOf(d.lv) * 1.0);
      ctx.save(); ctx.translate(d.wx, d.wy); ctx.rotate(ang);
      ctx.beginPath(); ctx.arc(-R * 0.35, 0, R, -1.1, 1.1); ctx.arc(-R * 0.75, 0, R * 0.9, 1.0, -1.0, true); ctx.closePath();
      ctx.fillStyle = stage(d.lv) >= 2 ? "rgba(224,164,18,0.55)" : "rgba(29,26,23,0.45)"; ctx.fill();
      ctx.restore();
    }
    // 끝맺음(time): 그 판에 그은 모든 일섬이 먹선으로 잠깐 되살아난다(남은 적이 이 선을 따라 갈라진다)
    if (ef && ef.kind !== "red" && et >= END_CUT - 60) {
      const ga = Math.max(0, Math.min(1, (et - END_CUT + 60) / 60)) * Math.max(0, 1 - (et - END_CUT) / 900);
      ctx.lineCap = "round";
      for (const sl of strokes) line(sl.x1, sl.y1, sl.x2, sl.y2, `rgba(29,26,23,${0.45 * ga})`, Math.max(1.5, 5 * (1 - (et - END_CUT) / 900)) / z);
      ctx.lineCap = "butt";
    }

    // 검사: 레벨이 오르면 기운이 둘린다(그림자 흐림 대신 옅은 먹/금빛 번짐 한 겹)
    if (stage(s.lv) >= 1) circle(p.x, p.y, 24 * vk, stage(s.lv) >= 2 ? "rgba(224,164,18,0.28)" : "rgba(29,26,23,0.13)");
    // 내 위치 표시(정리 2026-11-07, 2026-11-08 반전): 종이색 원판은 바탕과 같아 안 보였다 → 화면 크기가 일정한 진한 먹 원판 + 바깥 ACC 고리.
    // 화면에서 '반전된 원'은 검사 하나뿐이게 한다. 검사 그림은 그 위에 흰 실루엣 테두리를 받쳐 그린다
    const disc = s.state === "play";
    if (disc) { const zz = s.zoom || 1; circle(p.x, p.y, 21 / zz, "rgba(29,26,23,0.85)"); circle(p.x, p.y, 22 / zz, null, ACC, 2 / zz); }
    const blink = p.invuln > 0 && Math.floor(now / 70) % 2;
    if (!blink) {
      if (ok("hero")) {
        const m = world(), ang = s.dash ? Math.atan2(s.dash.uy, s.dash.ux) : Math.atan2(m.y - p.y, m.x - p.x);
        if (disc && whiteOf("hero")) { const half = 19 * vk / (META.hero || 0.35), o = 1.6 / (s.zoom || 1); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang); for (const [dx, dy] of [[o, 0], [-o, 0], [0, o], [0, -o]]) ctx.drawImage(WHITE.hero, -half + dx, -half + dy, half * 2, half * 2); ctx.restore(); }
        sprite("hero", p.x, p.y, ang, 19 * vk);
      } else circle(p.x, p.y, 12 * vk, "#fff", tr >= 3 ? GOLD : INK, 3 * vk);
    }
    ctx.shadowBlur = 0;
    // 조준선: 유닛 위에, 화면 배율과 상관없이 같은 굵기. 종이색 테두리로 먹 위에서도 보이게
    if (aimPl) {
      const pl = aimPl, rdy = !s.dash, danger = pl.red.length > 0;
      // 반사 일섬: segs 가 있으면 구간마다. 위험(빨강)은 처음 조준한 첫 구간만, 튕긴 구간은 옅고 가는 점선(빨간 유닛을 통과해도 안전)
      const sg = pl.segs && pl.segs.length ? pl.segs : [{ x1: p.x, y1: p.y, x2: p.x + pl.ux * pl.L, y2: p.y + pl.uy * pl.L, safe: false }];
      ctx.lineCap = "round";
      for (const q of sg) {
        if (q.safe) continue; // 검기 길은 그리지 않는다(정리 2026-11-07): 첫 반사 표시와 걸릴 적의 옅은 고리만
        line(q.x1, q.y1, q.x2, q.y2, "rgba(239,231,214,0.85)", 6 / z);
        ctx.setLineDash(danger ? [] : [10 / z, 7 / z]);
        line(q.x1, q.y1, q.x2, q.y2, danger ? RED : rdy ? "rgba(29,26,23,0.8)" : "rgba(29,26,23,0.35)", (danger ? 3.5 : 2.5) / z);
        ctx.setLineDash([]);
      }
      ctx.lineCap = "butt";
      for (let i = 1; i < Math.min(2, sg.length); i++) { const q = sg[i], c = i === 1 && danger ? RED : INK; ctx.save(); ctx.translate(q.x1, q.y1); ctx.rotate(Math.PI / 4); ctx.strokeStyle = "rgba(239,231,214,0.85)"; ctx.lineWidth = 4 / z; ctx.strokeRect(-4.5 / z, -4.5 / z, 9 / z, 9 / z); ctx.strokeStyle = c; ctx.lineWidth = 1.8 / z; ctx.strokeRect(-4.5 / z, -4.5 / z, 9 / z, 9 / z); ctx.restore(); } // 반사 지점: 작은 마름모
      if (sg.length === 1) { const c = danger ? RED : INK; circle(sg[0].x2, sg[0].y2, 8 / z, null, "rgba(239,231,214,0.85)", 5 / z); circle(sg[0].x2, sg[0].y2, 8 / z, null, c, 2.2 / z); circle(sg[0].x2, sg[0].y2, 2 / z, c); } // 몸이 멈출 자리: 작은 먹 고리(벽에 닿아 반사가 있으면 마름모가 대신)
      const g0 = sg[0], wB = Arena.widthOf(s.lv);
      if (rdy) for (const e of pl.cut) { const own = segD(g0.x1, g0.y1, g0.x2, g0.y2, e.x, e.y) <= e.r + wB; circle(e.x, e.y, e.r * (e.type === "banner" ? vk : 1) + 6 / z, null, own ? ACC : "rgba(47,93,138,0.35)", (own ? 3 : 1.5) / z); } // 검기에 걸릴 적은 옅게
      for (const q of pl.red) circle(q.x, q.y, q.r * vk * 1.3 + 6 / z, null, RED, 4 / z);
      aimDanger = danger;
    } else aimDanger = false;
    if (s.chain > 1 && s.state === "play") { // 연쇄 배율: 이어 벨 수 있는 시간이 지나면 흐려진다
      const mult = Math.min(CFG.chainMax, 1 + CFG.chainStep * (s.chain - 1)), w = 1 - (s.t - (s.lastHitT ?? s.t)) / CFG.chainWindow;
      if (w > 0) { ctx.globalAlpha = 0.35 + 0.65 * w; text("×" + mult.toFixed(1), p.x, p.y - 24 * vk, 18 / z, ACC); ctx.globalAlpha = 1; }
    }
    pops = pops.filter((q) => now - q.born < 700);
    for (const q of pops) { // 화면 가장자리에서 글자가 잘리지 않게 보이는 범위 안으로 당긴다
      const sz = (q.size || 16) / z, hw = sz * 0.3 * q.str.length + 8 / z, vx0 = W / 2 - W / 2 / z + hw, vx1 = W / 2 + W / 2 / z - hw, vy0 = H / 2 - H / 2 / z + sz, vy1 = H / 2 + H / 2 / z - 8 / z;
      text(q.str, Math.max(vx0, Math.min(vx1, q.x)), Math.max(vy0, Math.min(vy1, q.y - (now - q.born) / 20 / z)), sz, q.col);
    }
    ctx.restore();

    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 2})`; ctx.fillRect(0, 0, W, H); flash -= dt; }
    if (ef && ef.kind === "red") { const ra = et < 90 ? 0.3 : 0.3 - 0.2 * Math.min(1, (et - 90) / 400); ctx.fillStyle = `rgba(200,36,27,${ra})`; ctx.fillRect(0, 0, W, H); } // 붉은 유닛을 벤 순간 화면이 붉게 멈칫

    // HUD
    const boss = s.enemies.find((e) => e.type === "boss" && e.alive);
    if (boss) {
      const k = boss.dying > 0 ? 0 : boss.hp / boss.maxHp;
      // 대장군 체력: 타이머와 헷갈리지 않게 아래로 내리고 얼굴 그림을 붙인다
      if (ok("boss")) { ctx.save(); ctx.translate(W / 2 - 222, 44); ctx.drawImage(IMG.boss, -18, -18, 36, 36); ctx.restore(); }
      ctx.fillStyle = "rgba(29,26,23,0.18)"; ctx.fillRect(W / 2 - 200, 40, 400, 8);
      ctx.fillStyle = INK; ctx.fillRect(W / 2 - 200, 40, 400 * k, 8);
    }
    if (bossWarn && now - bossWarn.born < 1300) {
      const a = 0.5 + 0.5 * Math.sin((now - bossWarn.born) / 60), sd = bossWarn.side;
      const x = sd === 1 ? W - 50 : sd === 3 ? 50 : W / 2, y = sd === 0 ? 70 : sd === 2 ? H - 50 : H / 2;
      text("!", x, y, 64, `rgba(29,26,23,${a})`);
    }
    const left = Math.max(0, CFG.limit - s.t);
    ctx.fillStyle = "rgba(29,26,23,0.15)"; ctx.fillRect(20, 10, W - 40, 5);
    ctx.fillStyle = left < 5 ? ACC : INK; ctx.fillRect(20, 10, (W - 40) * left / CFG.limit, 5);
    if (s.started && s.state === "play" && left > 0 && left <= 3) { // 마지막 3초: 화면 가운데 옅게
      const n = Math.ceil(left), f = n - left;
      ctx.globalAlpha = 0.16 * (1 - f * 0.6); text(String(n), W / 2, H / 2 + 80, 240 - f * 30, left <= 1 ? RED : INK); ctx.globalAlpha = 1;
    }
    text(fmt(s.score), 26, 50, 30, INK, "left");
    const hb = mode === "daily" ? dayBest : best;
    if (hb > 0) text((mode === "daily" ? "TODAY BEST " : "BEST ") + fmt(hb), 28, 68, 12, s.score > hb ? GOLD : "rgba(29,26,23,0.55)", "left");
    const pd = paceDelta();
    if (pd !== null && s.started) { // 같은 시각의 비교 곡선보다 앞서면 금색, 뒤지면 회색. 무엇과 비교 중인지 옆에 작게
      const ps = (pd >= 0 ? "+" : "−") + fmt(Math.abs(pd));
      text(ps, 28, 90, 15, pd >= 0 ? GOLD : "rgba(29,26,23,0.5)", "left");
      ctx.font = "15px serif"; text(ghost.label, 28 + ctx.measureText(ps).width + 8, 90, 11, "rgba(29,26,23,0.4)", "left");
    }
    if (pacePop && s.state === "play" && now - pacePop.born < PACE_POP_MS) { // 5·10·15초: 화면 가운데 옅게 크게(마지막 3초 카운트다운과 같은 방식). 빨강은 쓰지 않는다
      const q = (now - pacePop.born) / PACE_POP_MS, inK = Math.min(1, (now - pacePop.born) / 90), up = pacePop.d >= 0;
      ctx.globalAlpha = (up ? 0.42 : 0.2) * inK * (q < 0.55 ? 1 : 1 - (q - 0.55) / 0.45);
      text((up ? "+" : "−") + fmt(Math.abs(pacePop.d)), W / 2, H / 2 + 40, 120 * (1.12 - 0.12 * inK), up ? GOLD : INK);
      text(pacePop.at + "s  " + pacePop.label, W / 2, H / 2 + 76, 20, up ? GOLD : INK);
      ctx.globalAlpha = 1;
    }
    text(left.toFixed(1), W - 26, 44, 18, INK, "right");
    text(mode === "daily" ? "DAILY" : "RANDOM", W - 26, 60, 11, "rgba(29,26,23,0.45)", "right");
    const L = CFG.levels, lo = L[s.lv - 1], hi = L[s.lv] ?? lo, k = hi > lo ? (s.xp - lo) / (hi - lo) : 1;
    ctx.fillStyle = "rgba(29,26,23,0.12)"; ctx.fillRect(20, H - 14, W - 40, 5);
    ctx.fillStyle = tr >= 3 ? GOLD : ACC; ctx.fillRect(20, H - 14, (W - 40) * k, 5);
    text("LV " + s.lv, 26, H - 22, 16, INK, "left");
    if (lvPop && now - lvPop.born < 800) {
      const q = (now - lvPop.born) / 800;
      ctx.globalAlpha = 1 - q; text("LV " + lvPop.lv, W / 2, H / 2 - 60 - q * 30, 40 + q * 20, lvPop.lv >= 7 ? GOLD : ACC); ctx.globalAlpha = 1;
    }
    if (perkPop && now - perkPop.born < 900) { // 새 능력 알림: 먹 도장이 찍히듯 커졌다 줄며 앉고, 반투명이라 아래 싸움이 비친다
      const el = now - perkPop.born, inK = Math.min(1, el / 110), q = el / 900, al = 0.62 * inK * (q < 0.6 ? 1 : 1 - (q - 0.6) / 0.4), sc = 1.35 - 0.35 * inK;
      ctx.save(); ctx.globalAlpha = al; ctx.translate(W / 2, H / 2 - 70); ctx.rotate(-0.05); ctx.scale(sc, sc);
      ctx.fillStyle = tier(perkPop.lv) >= 3 ? "#7a5a0c" : INK; ctx.fillRect(-170, -48, 340, 96);
      ctx.strokeStyle = PAPER; ctx.lineWidth = 2; ctx.strokeRect(-163, -41, 326, 82);
      text(perkPop.name + (perkPop.n > 1 ? " ×" + perkPop.n : ""), 0, 12, 48, PAPER); text("hit a wall to bounce", 0, 34, 15, PAPER); // 2026-11-09: 반사는 LV3 한 번, SHORT 이동은 벽에 닿을 때만 반사
      ctx.restore();
    }
    if (bossFx && now >= bossFx.at && now - bossFx.at < 1700) { // 대장군 발도 점수: 갈라지는 순간 화면 가운데 크게
      const t = now - bossFx.at, sc = 1 + 0.45 * Math.max(0, 1 - t / 160), al = t < 1250 ? 1 : 1 - (t - 1250) / 450;
      ctx.globalAlpha = al;
      text("ISSEN  +" + fmt(bossFx.pts), W / 2, H / 2 - 4, 66 * sc, GOLD);
      text(bossFx.hits + " CUT" + (bossFx.mult > 1.001 ? "   ×" + bossFx.mult.toFixed(1) : ""), W / 2, H / 2 + 34, 26, INK);
      ctx.globalAlpha = 1;
    }
    if (!s.started) { const a = 0.5 + 0.5 * Math.sin(now / 250); text("click", p.x, p.y + 44, 16, `rgba(29,26,23,${a})`); }

    // 커서: 시스템 커서 대신 크게 그린다
    if (s.state === "play") {
      const cx = mouse.x, cy = mouse.y, col = aimDanger ? RED : INK;
      circle(cx, cy, 13, null, "rgba(239,231,214,0.9)", 6);
      circle(cx, cy, 13, null, col, 2.5);
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { line(cx + ax * 7, cy + ay * 7, cx + ax * 19, cy + ay * 19, "rgba(239,231,214,0.9)", 5); line(cx + ax * 7, cy + ay * 7, cx + ax * 19, cy + ay * 19, col, 2.5); }
      circle(cx, cy, 2.5, col);
    }
    if (s.state === "end") drawResult(now);
    else if (titleOn) drawTitle(now);
  }

  // ---------- 시작 화면·결과 화면(W2) ----------
  function drawTitle(now) {
    ctx.fillStyle = "rgba(239,231,214,0.9)"; ctx.fillRect(0, 0, W, H);
    text(TITLE, W / 2, 150, 92, INK);
    text("Don't cut red.", W / 2, 198, 26, RED);
    text("Click to slash. Cut fast. Never cut RED.", W / 2, 268, 19, INK); // 2026-11-09 AI 초안, 사용자 승인("ㄱ")
    // 빨간 유닛 그림
    const rx = W / 2, ry = 336, pulse = 1 + 0.06 * Math.sin(now / 120);
    if (ok("red")) sprite("red", rx, ry, now / 900, 24 * pulse); else circle(rx, ry, 22 * pulse, "rgba(200,36,27,0.25)", RED, 4);
    circle(rx, ry, 31, null, "rgba(200,36,27,0.5)", 2);
    line(rx - 44, ry + 44, rx + 44, ry - 44, RED, 4); // 금지 사선
    const hb = mode === "daily" ? dayBest : best;
    text((mode === "daily" ? "DAILY " + seed : "RANDOM") + "   ·   T to switch" + (hb > 0 ? "   ·   best " + fmt(hb) : ""), W / 2, 418, 14, "rgba(29,26,23,0.6)");
    const a = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now / 260));
    text("Click to start", W / 2, 470, 22, `rgba(29,26,23,${a})`);
    text("Contains flashing lights.", W / 2, H - 18, 13, "rgba(29,26,23,0.55)"); // 잼 필수 번쩍임 경고. 2026-11-09 AI 초안, 문구는 사용자 확정 전
  }

  function drawResult(now) {
    const r = s.result;
    const fade = resultAlpha(now); // W3 끝맺음 연출이 끝나 갈 때 덮는다
    if (fade <= 0) return;
    if (!resultAt) resultAt = now;
    const t = (now - resultAt) / 1000; // 결과가 뜬 뒤 흐른 시간
    ctx.save(); ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(239,231,214,0.9)"; ctx.fillRect(0, 0, W, H);
    const dead = r.kind === "red";
    // 끝난 이유
    if (dead) {
      ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(W / 2 - 152, 86, 11, Math.PI / 2, Math.PI * 1.5); ctx.fill();
      ctx.beginPath(); ctx.arc(W / 2 - 146, 86, 11, -Math.PI / 2, Math.PI / 2); ctx.fill();
      text("You cut the red one.", W / 2 + 12, 96, 28, RED);
      text("at " + r.time.toFixed(1) + "s", W / 2, 122, 14, "rgba(200,36,27,0.75)");
    } else text("Time!", W / 2, 98, 32, INK);
    // 점수(2026-11-09 등급 도장 제거, 가운데 정렬)
    text(fmt(r.score), W / 2, 214, 88, dead ? INK : ACC);
    // 최고점
    const isDay = r.mode === "daily";
    if (r.newBest) { const p = 0.7 + 0.3 * Math.sin(now / 140); text("NEW BEST!", W / 2, 254, 28 * p + 6, GOLD); }
    else if (isDay && r.newDay) { const p = 0.7 + 0.3 * Math.sin(now / 140); text("NEW TODAY BEST!", W / 2, 254, 24 * p + 5, GOLD); }
    else text((isDay ? "today best " + fmt(dayBest) + "   ·   " : "") + "best " + fmt(best), W / 2, 252, 17, "rgba(29,26,23,0.7)");
    // 목표 줄: 판 전 기록 기준(일일 모드는 오늘 최고 → 넘었으면 전체 최고). 기록이 없던 첫 판은 생략
    const goal = isDay && !r.newDay && r.prevDay > 0 ? [r.prevDay, "today's best"] : !r.newBest && r.prevBest > 0 ? [r.prevBest, "your best"] : null;
    if (goal) text(goal[0] === r.score ? "Tied " + goal[1] + "." : fmt(goal[0] - r.score) + " to beat " + goal[1], W / 2, 284, 18, ACC);
    // 세부
    text(`best cut ${r.bestCut}   ·   kills ${r.kills}   ·   max chain ${r.maxChain ?? 0}   ·   LV ${r.maxLv}`, W / 2, 328, 16, INK);
    text((isDay ? "DAILY " : "RANDOM seed ") + (r.seed ?? r.seedUsed) + (isDay ? "   ·   same board for everyone today" : ""), W / 2, 356, 13, "rgba(29,26,23,0.55)");
    // 공유 버튼
    const b = COPY_BTN, hov = mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h;
    ctx.fillStyle = hov ? "rgba(29,26,23,0.12)" : "rgba(29,26,23,0.05)"; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = "rgba(29,26,23,0.5)"; ctx.lineWidth = 1.5; ctx.strokeRect(b.x, b.y, b.w, b.h);
    const cAge = (now - Math.abs(copied)) / 1000, cMsg = copied && cAge < 1.6 ? (copied > 0 ? "Copied!" : "Copy failed") : "Copy result  (C)";
    text(cMsg, W / 2, b.y + 22, 15, copied < 0 && cAge < 1.6 ? RED : INK);
    // 재시작 안내: 클릭은 1.2초 뒤부터
    const clickOk = t > 1.2 && !heldAtEnd;
    text("R / Space  retry" + (clickOk ? "   ·   click  retry" : "") + "   ·   T  next run: " + (mode === "daily" ? "DAILY" : "RANDOM"), W / 2, 456, 15, "rgba(29,26,23,0.6)");
    ctx.restore();
    // 결과 화면에서는 시스템 커서 대신 작은 점
    circle(mouse.x, mouse.y, 4, INK);
  }

  // 판 도중 점수 곡선 기록과 구간(5·10·15초) 알림
  function trackPace(now) {
    if (!s.started || s.state !== "play") return;
    const i = Math.min(Math.round(CFG.limit / PACE_STEP), Math.floor(s.t / PACE_STEP));
    while (run.length <= i) run.push(s.score);
    run[i] = s.score;
    const sp = Math.floor(s.t / 5) * 5;
    if (sp > paceSplit && sp < CFG.limit) { paceSplit = sp; const d = paceDelta(); if (d !== null) { pacePop = { born: now, at: sp, d, label: ghost.label }; paceSfx(d >= 0); } }
  }
  function paceDelta() {
    if (!ghost || !s.started) return null;
    const c = ghost.c, i = Math.min(c.length - 1, Math.floor(s.t / PACE_STEP));
    return s.score - c[i];
  }
  // 구간 알림음(2026-11-09): tick(취소음)과 구별되게 합성. 앞서면 맑은 두 음(사인, 높게), 뒤지면 낮게 걸러진 둔탁한 '퉁'
  function paceSfx(ahead) {
    if (ahead) { tone(1568, 0.22, "sine", 0.07); setTimeout(() => tone(2093, 0.3, "sine", 0.05), 55); }
    else { tone(98, 0.16, "triangle", 0.14); noise(0.09, 180, 0.22); }
  }
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    update(s, dt);
    trackPace(now);
    handleEvents(now);
    draw(now, dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
