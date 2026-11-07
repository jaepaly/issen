// 화면에 나오는 모든 글. 이름·대사·엔딩 문장은 사용자가 쓴다.
// 지금 들어 있는 글은 전부 자리표시(PLACEHOLDER)다.
const TEXTS = {
  title: "Three in My Belly (working title)",
  howto: "← → move   Z / Space jump   X eat   R retry",
  start: "click or press any key",
  people: {
    wife:   { name: "[Wife]",   food: "lunchbox", power: "key",          forget: "[PLACEHOLDER: wife's line]" },
    father: { name: "[Father]", food: "soup",     power: "heavy",        forget: "[PLACEHOLDER: father's line]" },
    friend: { name: "[Friend]", food: "candy",    power: "double jump",  forget: "[PLACEHOLDER: friend's line]" },
    mother: { name: "[Mother]", food: "porridge", power: "endure 1 hit", forget: "[PLACEHOLDER: mother's line]" },
  },
  // 대문에 도착했을 때: 잊은 사람 조합(알파벳순, _로 연결)으로 고른다. 없으면 win_default.
  endings: {
    none:               "[PLACEHOLDER: home, forgetting no one]",
    forgot_father:      "[PLACEHOLDER: home, father forgotten]",
    forgot_friend:      "[PLACEHOLDER: home, friend forgotten]",
    forgot_mother:      "[PLACEHOLDER: home, mother forgotten]",
    win_default:        "[PLACEHOLDER: home]",
    fail_door:          "[PLACEHOLDER: at the gate, the key is gone]",
    fail_time:          "[PLACEHOLDER: the evening ran out]",
    fail_fall:          "[PLACEHOLDER: fell]",
  },
};
if (typeof module !== "undefined") module.exports = TEXTS;
