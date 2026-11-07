// 일섬 규칙 테스트와 자동 조작 검사. 실행: node tests/slash-sim.js
// 자동 조작 결과는 "풀 수 있다"는 확인일 뿐 사람의 플레이 시간이 아니다.
const S = require("../slash/game.js");
let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

function blank() {
  const s = S.createGame(1);
  s.enemies.length = 0;
  return s;
}
function put(s, type, x, y, face) {
  const e = { id: s.enemies.length, type, x, y, r: S.CFG.radius[type], hp: S.CFG.hp[type], alive: true, dying: 0, face: face ?? Math.PI / 2, cd: 9, flinch: 0, cut: 0 };
  s.enemies.push(e); return e;
}

// 1. 베면 경직 없이 바로 다음 일섬 가능, 허공이면 경직
{
  const s = blank(); s.p.x = 480; s.p.y = 1000;
  put(s, "soldier", 480, 850);
  S.slash(s, 480, 800);
  ok(s.p.stagger === 0 && s.chain === 1, "적을 베면 경직 없음, 연쇄 1");
  S.slash(s, 480, 600);
  ok(s.p.stagger > 0 && s.chain === 0, "허공을 가르면 경직, 연쇄 끊김");
}
// 2. 사거리 제한
{
  const s = blank(); s.p.x = 480; s.p.y = 1000;
  S.slash(s, 480, 100);
  ok(Math.abs(1000 - s.p.y - S.CFG.maxRange) < 0.01, "최대 사거리에서 멈춤");
}
// 5. 한 줄에 여러 명
{
  const s = blank(); s.p.x = 200; s.p.y = 1000;
  put(s, "soldier", 280, 1000); put(s, "soldier", 360, 1000); put(s, "soldier", 440, 1000);
  S.slash(s, 480, 1000);
  ok(s.kills === 3, "한 번에 세 명");
}

// 6. 자동 조작으로 대장까지 갈 수 있는가
function bot(seed, aim = 0.12) {
  const s = S.createGame(seed);
  const dt = 1 / 60;
  let think = 0;
  while (s.state === "play" && s.t < 25) {
    think -= dt;
    if (s.p.stagger <= 0 && think <= 0) {
      think = aim; // 조준에 드는 시간(가정값, 사람 측정 아님)
      let best = null;
      for (const e of s.enemies) {
        if (!e.alive || e.dying > 0) continue;
        const dx = e.x - s.p.x, dy = e.y - s.p.y, d = Math.hypot(dx, dy);
        if (d > S.CFG.maxRange + e.r) continue;
        const tx = s.p.x + dx / d * Math.min(S.CFG.maxRange, d + 25), ty = s.p.y + dy / d * Math.min(S.CFG.maxRange, d + 25);
        const pl = S.plan(s, tx, ty);
        if (!pl || !pl.cut.length) continue;
        const score = pl.cut.length * 40 - (s.p.y + pl.uy * pl.endL) * 0.5 + (e.type === "general" ? 1e4 : 0);
        if (!best || score > best.score) best = { score, tx, ty };
      }
      if (best) S.slash(s, best.tx, best.ty);
      else S.slash(s, s.p.x + (Math.random() - 0.5) * 120, s.p.y - S.CFG.maxRange);
    }
    S.update(s, dt);
  }
  return s;
}
const runs = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => bot(k));
const wins = runs.filter((s) => s.result && s.result.kind === "win");
runs.forEach((s, i) => console.log(`  seed ${i + 1}: ${s.result ? s.result.kind : "?"} t=${s.t.toFixed(2)} kills=${s.kills} maxChain=${s.maxChain} progress=${(s.result ? s.result.progress * 100 : 0).toFixed(0)}%`));
ok(wins.length >= 4, `빠른 자동 조작(조준 0.12초)이 8판 중 ${wins.length}판 대장 격파: 풀 수 있는 맵인지 확인`);
const slow = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => bot(k, 0.4));
console.log("  참고(조준 0.4초 가정, 사람 시간 아님): " + slow.map((s) => (s.result ? s.result.kind : "?") + " " + s.t.toFixed(1)).join(" / "));
console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
