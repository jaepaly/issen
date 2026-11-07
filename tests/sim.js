// 규칙 테스트와 자동 조작 완주 검사. 실행: node tests/sim.js
// 자동 조작 결과는 맵이 풀린다는 확인일 뿐, 사람 플레이 시간이 아니다.
const G = require("../game/game.js");
const LEVEL = require("../game/level.js");
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS " : "FAIL ") + msg); if (!cond) fails++; };

// 1. 배 3칸: 넷째를 먹으면 가장 오래된 사람을 잊는다
{
  const s = G.createGame(LEVEL);
  ["wife", "father", "friend", "mother"].forEach((id) => G.eat(s, { id }));
  ok(s.stomach.map((e) => e.id).join() === "father,friend,mother" && s.forgotten.join() === "wife", "넷째를 먹으면 가장 오래된 칸(wife)을 잊음");
}
// 2. 같은 사람을 다시 먹으면 가장 최근으로 옮겨지고 칸이 늘지 않음
{
  const s = G.createGame(LEVEL);
  ["wife", "father", "wife"].forEach((id) => G.eat(s, { id }));
  ok(s.stomach.map((e) => e.id).join() === "father,wife" && s.forgotten.length === 0, "같은 사람 재섭취는 순서만 갱신");
}

// 자동 조작: order 순서로 음식을 먹은 뒤 오른쪽으로 달린다
function bot(order) {
  const s = G.createGame(LEVEL);
  const dt = 1 / 60;
  let lastX = s.p.x, stuck = 0, i = 0, jumpHeld = false;
  while (s.state === "play" && s.t < 25) {
    const p = s.p, input = { left: false, right: false, jump: false, jumpHeld: false, eat: false };
    const target = i < order.length ? s.foods.find((f) => f.id === order[i] && !f.eaten) : null;
    if (target) {
      const cx = target.x + target.w / 2, px = p.x + p.w / 2;
      if (Math.abs(cx - px) < 10) { input.eat = true; i++; }
      else if (cx > px) input.right = true; else input.left = true;
    } else input.right = true;
    // 막히면 점프, 떨어지기 시작하면 2단 점프
    stuck = Math.abs(p.x - lastX) < 0.5 && (input.right || input.left) ? stuck + 1 : 0;
    if (p.onGround && stuck > 2) { input.jump = true; jumpHeld = true; }
    else if (!p.onGround && p.vy > 0 && p.jumps < 2 && jumpHeld) input.jump = true;
    if (p.onGround && !input.jump) jumpHeld = false;
    input.jumpHeld = jumpHeld;
    lastX = p.x;
    G.step(s, input, dt);
  }
  return s;
}

// 3. 의도한 풀이: 국밥 → 도시락 → 사탕 → 죽. 아버지를 잊고 대문이 열림
{
  const s = bot(["father", "wife", "friend", "mother"]);
  ok(s.ending === "forgot_father", `풀이 순서로 완주, 엔딩 ${s.ending}, ${s.t.toFixed(2)}초(자동 조작)`);
  ok(s.t < G.LIMIT, "자동 조작 완주가 20초 안");
}
// 4. 도시락을 먼저 먹으면 대문 앞에서 열쇠를 잊은 상태
{
  const s = bot(["wife", "father", "friend", "mother"]);
  ok(s.ending === "fail_door", `도시락을 먼저 먹으면 대문 실패 (${s.ending}, 잊음: ${s.forgotten})`);
}
// 5. 국밥 없이는 담장을 못 지남 → 시간 초과
{
  const s = bot(["wife", "friend", "mother"]);
  ok(s.ending === "fail_time" && s.p.x < 12 * G.TILE, `국밥 없이 담장 통과 불가 (${s.ending})`);
}
// 6. 죽 없이 가시 길에 들어가면 실패
{
  const s = bot(["father", "wife", "friend"]);
  ok(s.ending === "fail_fall", `죽 없이 가시 길 실패 (${s.ending})`);
}
// 7. 사탕 없이 높은 턱을 못 오름
{
  const s = bot(["father", "wife", "mother"]);
  ok(s.ending === "fail_time" && s.p.x < 25 * G.TILE, `사탕 없이 높은 턱 통과 불가 (${s.ending})`);
}
console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
