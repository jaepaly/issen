# itch 페이지 초안 (2026-11-07, AI 초안)

상태: AI가 쓴 초안이다. 제목, 첫 문장, 본문 문구는 사용자가 고르고 고친다. 아직 업로드하지 않았다.
제목 `ISSEN`은 2026-11-07 사용자가 정했다. "Don't cut red."는 제목에 붙이지 않고 본문 첫 줄 태그라인으로만 쓴다(사용자 결정). 제목을 다시 바꿀 때 고칠 곳: 이 파일, `arena/index.html`의 `<title>`, `tools/build.py`의 `ZIP_NAME`, 게임 안 시작 화면 글자(main.js, 다른 워커 담당).

---

## 영어 본문 (붙여 넣을 부분)

<!-- 아래 영문 문구는 전부 AI 초안이다(2026-11-10 v2 규칙으로 갱신). 사용자가 고르고 고친 뒤 올린다. -->

**ISSEN**

20-second ink-wash sword slasher. Cut fast. Never cut red.

<!-- GIF 자리: 페이지 상단 3~5초 반복 GIF (itch/capture-plan.md 7번). 사람이 직접 플레이한 녹화로 만든다 -->
[GIF HERE]

**Photosensitivity warning: full-screen white flashes.**
<!-- 확정 문구는 사용자 몫. 최종 섬광 세기를 보고 정한다. 게임 안에도 경고 한 줄이 있다 -->

You have 20 seconds. Every click is a single draw-cut (*issen*): you flash in a straight line toward your cursor and stop a little past it, slicing everything on the way. Click past a wall and you stop at the wall.

**How to play**
- Aim with the mouse. Click to cut. There is no cooldown — your hand sets the pace.
- Touch a red soldier with your blade and the run ends. Instantly.
- Keep cutting: land another cut within 0.8 s to grow your chain (up to ×6). A cut that hits nothing breaks it.
- Cut down soldiers and more pour in. The faster you cut, the more there are to cut.

**Score**
Every enemy you cut is worth 10 × your chain multiplier. Armored soldiers are worth extra.
At 12 seconds the general arrives. Cut the general down for 4 seconds of FRENZY: every point doubled.

**Growing stronger**
- Level up and your blade gets faster and wider.
- From LV3, your cut bounces off the wall once.

**Features**
- Your best score, and live pace against it at 5, 10 and 15 seconds.
- DAILY: same day, same battlefield for everyone. Press T for a RANDOM run.
- Press V on the title or result screen to switch the cut between INSTANT and DASH.
- R or Space to restart instantly. C copies your result line with the game link.

<!-- 2026-11-10: 테마(Double or Quits) 한 줄은 뺐다. v2에서 점수가 cut²(한 줄 더 베면 제곱)가 아니라 처치 수 × 연쇄라서 문장이 더 이상 맞지 않는다. 넣으려면 새 문장이 필요 — 사용자 결정 -->

**Controls**
Mouse only. A mouse or trackpad with hover is required (no touch). R / Space: restart. T: DAILY / RANDOM. V: INSTANT / DASH. C: copy result.

**Content note**
Stylized ink-splatter violence. Screen flashes and screen shake on big cuts.

**Credits & AI disclosure**
<!-- TODO(사용자): 이름/닉네임 칸을 채운다. 비워 둔 채 올리지 않는다 -->
- Made by: **jaepaly** <!-- 2026-11-10 itch 사용자명으로 채움. 다른 이름을 쓰려면 바꾼다 -->
- Human (me): set the direction and the core rules, chose which features went in and rejected others (several AI proposals were turned down), played the game myself throughout and gave the feedback that drove the changes, and has final say on all text.
- AI (Claude, Codex): wrote the code, proposed designs and alternatives, measured balance with bots (bot scores, not human play), and drafted documents including this page.
- Art: generated with Codex CLI image generation (OpenAI image model), directed and selected by a human, then cropped and adjusted in code.
- Sound effects: Kenney — "RPG Audio" and "Impact Sounds" (CC0), trimmed, layered and edited.
- This game includes output of generative AI (code and art). Page text: AI draft, edited by a human. <!-- TODO(사용자): 실제로 고쳤는지에 맞게 고친다 -->

Made for the 20 Second Game Jam 2026. Play time is 20 seconds or less.

---

## 한국어 메모 (페이지에 넣지 않음)

### 잼 규칙 확인 (2026-11-07, 잼 페이지에서 직접 확인)
출처: https://itch.io/jam/20-second-game-jam-2026 (research/ 폴더에는 규칙 원문이 없어 웹에서 다시 확인했다)

- 규칙 1: "Submitted games must last for 20 seconds or less, start to finish." FAQ: 타이틀·메뉴·컷신은 빼고 플레이 20초. 기본 모드가 20초 판이면 더 긴 모드도 허용. 판마다 독립(아이템·업그레이드 이월 없음).
- 규칙 2: "you must include a free version that runs in web browsers, hosted on itch.io." 외부 링크 불가. 작동하지 않는 게임 제출 금지.
- 규칙 4: "Mark mature content on your game page and in the game itself, and disclose any generative AI."
- 규칙 4: "All entries should be fully directed and playtested by a human who takes full responsibility for game."
- 규칙 4: "AI agents (...) should not join this jam and will have their entries removed."
- FAQ(AI): "We want to see games made by our fellow humans rather than AI." 공개 위치: "In your game's project page under "AI generation disclosure", indicate if your game does or does not include the output of Generative AI." → 페이지 편집 화면의 **AI generation disclosure** 항목에서 '포함함'을 고르고, 본문 크레딧에도 적는다(위 초안).
- FAQ: 번쩍임 등 발작 유발 가능 효과는 알릴 것.
- 제출 기간: 2026-10-23 00:00:01 ~ 2026-11-24 00:59:00 (2026-11-10 잼 페이지 재확인: 원래 11-17이던 마감이 1주 연장됨). 시간대가 명시돼 있지 않으므로 **11/23 저녁(한국 시간) 안에 제출**하는 것이 안전하다.
- 심사·순위·상품은 없다("There are no judges, rankings or prizes").

주의할 점: 규칙은 "사람이 전적으로 지휘하고 직접 플레이테스트하며 책임질 것"을 요구하고, 주최 측은 AI보다 사람이 만든 게임을 보고 싶다고 밝혔다. 금지는 아니지만, 크레딧에 사람의 역할(방향 결정·선별·플레이테스트)을 분명히 쓰고, 출품 전에 사용자가 직접 여러 판 플레이하는 것이 규칙상 필요하다. 생성형 AI 공개 문구를 흐리게 쓰지 않는다.

### itch 설정 체크리스트
출처: itch HTML5 문서 https://itch.io/docs/creators/html5 (2026-11-07 확인), 표지 규격은 공식 문서에서 찾지 못해 업로드 화면 안내와 커뮤니티 글 기준.

- [ ] 프로젝트 주소(Project URL): **https://jaepaly.itch.io/issen** 로 만든다 — 게임 안 결과 복사(C) 링크가 이 주소를 가리킨다.
- [ ] Kind of project: HTML. 업로드: `dist/issen-web.zip` → "This file will be played in the browser" 체크.
  - zip 요구: 최상위에 `index.html`, 파일 1,000개 이하, 풀었을 때 합계 500MB 이하, 파일 하나 200MB 이하, 경로 240자 이하, 파일명 대소문자 구분. (현재 빌드 40개, 약 1.1MB)
- [ ] Embed options: **Embed in page**, Viewport **960 × 540**.
- [ ] **Fullscreen button** 켜기(itch가 오른쪽 아래에 만들어 줌). index.html이 창 크기에 맞춰 16:9로 늘고 줄어든다.
- [ ] **Mobile friendly 끄기** — 마우스 호버로 조준하는 게임이라 터치로는 성립하지 않는다.
- [ ] Scrollbars: 끔(기본값).
- [ ] Automatically start on page load: 끔 권장(소리 정책상 클릭으로 시작하는 편이 안전). 사용자 결정.
- [ ] **AI generation disclosure**: 생성형 AI 산출물 포함으로 표시.
- [ ] Content/maturity: 잔혹 표현 수준 확인(먹물 자국, 반으로 갈리는 실루엣). 성인 콘텐츠로 볼 수준은 아니라고 AI는 판단하지만 사용자 결정. 번쩍임 문구는 본문에.
- [ ] Pricing: No payments / 무료(잼 규칙).
- [ ] Cover image(표지): 권장 **630 × 500**, 최소 315 × 250, 3MB 이하(업로드 화면 안내로 최종 확인). 목록에서는 315 × 250으로 가운데가 잘려 보인다는 사용자 보고가 있어 핵심 장면을 가운데에 둔다.
- [ ] Screenshots 3~5장(권장 960×540 그대로), GIF 1개. → `itch/capture-plan.md`
- [ ] Genre: Action. Tags 후보(itch는 최대 10개): `20-second`(잼 관례 확인), `arcade`, `score-attack`, `top-down`, `ink`, `samurai`, `minimalist`, `one-button`(마우스 원클릭), `short`, `high-score`. 사무라이·일본풍 태그는 수묵 동아시아 톤에 맞는지 사용자 판단.
- [ ] Community: 댓글 켜기. Release status: Released.
- [ ] 잼 제출 페이지에서 이 프로젝트 선택 → 제출 후 잼 출품 목록에서 직접 실행해 확인.
- [ ] 페이지 색: 배경 먹색(#1c1916)·글자 종이색(#f6ebd6), 강조색은 빨간 유닛 전용 붉은색만.

### 사용자가 정할 것
- 첫 줄 소개(초안: "20-second ink-wash sword slasher. Cut fast. Never cut red."). 제목 ISSEN은 결정됨.
- 크레딧에 쓸 이름. 코드 도구 이름을 어디까지 적을지(Claude/Codex).
- 점수 설명이 최종 빌드와 맞는지(2026-11-10 v2 기준으로 고침: 10 × 연쇄 배율, 장군 처치 시 4초 광란 ×2).
- 테마 한 줄: v2에서 옛 문장(cut²)이 맞지 않아 뺐다. 넣을지, 넣는다면 어떤 문장일지.
- 깜빡임 경고 확정 문구, 크레딧의 사람·AI 역할 문장.
- 자동 시작 여부, 성인 콘텐츠 표시 여부.
