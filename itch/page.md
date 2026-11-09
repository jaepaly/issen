# itch 페이지 초안 (2026-11-07, AI 초안)

상태: AI가 쓴 초안이다. 제목, 첫 문장, 본문 문구는 사용자가 고르고 고친다. 아직 업로드하지 않았다.
제목 `ISSEN`은 2026-11-07 사용자가 정했다. "Don't cut red."는 제목에 붙이지 않고 본문 첫 줄 태그라인으로만 쓴다(사용자 결정). 제목을 다시 바꿀 때 고칠 곳: 이 파일, `arena/index.html`의 `<title>`, `tools/build.py`의 `ZIP_NAME`, 게임 안 시작 화면 글자(main.js, 다른 워커 담당).

---

## 영어 본문 (붙여 넣을 부분)

**ISSEN**

*Don't cut red.*

Click to slash. Cut fast. Cut everything — except red.

You are a lone swordsman in an ink-wash battlefield, and you have 20 seconds. Every click is a single draw-cut (*issen*) that dashes from where you stand toward your cursor and a little past it, slicing through everything on the line.

**How to play**
- Aim with the mouse. Click to cut. There is no cooldown.
- Each cut carries you just past your cursor. Reach a wall and your sword wave bounces off it.
- Touch a red soldier with your blade and it's over. Instantly.
- Line them up. One cut through many is worth far more than many cuts through one.

**Score**
`cut² × chain` — the number of enemies in one cut, squared, times your chain.
<!-- 점수 공식은 W3/W4 작업 결과에 맞춰 최종 확인. 지금 게임 안 규칙과 다르면 이 줄을 고친다 -->

**Coming soon** <!-- 기능이 들어가면 'Coming soon'을 빼고 설명으로 바꾼다. 안 들어가면 이 절을 지운다 -->
- DAILY: one shared seed per day, so everyone faces the same battlefield.
- Share line: copy your result as a one-line text to brag (or confess).

**Controls**
Mouse only. A mouse or trackpad with hover is required (no touch).

**Content note**
Stylized ink-splatter violence. Brief screen flashes and screen shake on big cuts.
<!-- 잼 FAQ: 발작을 일으킬 수 있는 번쩍임은 알리라고 함. 최종 연출의 섬광 세기를 보고 문구 확정 -->

**Credits & AI disclosure**
- Direction, design decisions and playtesting: <사용자 이름/닉네임>
- Art: generated with Codex CLI image generation (OpenAI image model), directed and selected by a human, then cropped and adjusted in code.
- Code: written together with AI coding assistants (Claude, Codex), directed, reviewed and playtested by a human.
- Sound effects: Kenney — "RPG Audio" and "Impact Sounds" (CC0), trimmed, layered and edited.
- This game includes output of generative AI (art and code). Text on this page: <사람이 썼으면 그렇게, AI 초안을 고쳤으면 그렇게 적는다>

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
- 제출 기간: 2026-10-23 00:00:01 ~ 2026-11-17 00:59:59. 페이지 상단은 "Oct 23 to Nov 16"로 보여 시간대가 명시돼 있지 않다. **11/16 저녁(한국 시간) 안에 제출**하는 것이 안전하다.
- 심사·순위·상품은 없다("There are no judges, rankings or prizes").

주의할 점: 규칙은 "사람이 전적으로 지휘하고 직접 플레이테스트하며 책임질 것"을 요구하고, 주최 측은 AI보다 사람이 만든 게임을 보고 싶다고 밝혔다. 금지는 아니지만, 크레딧에 사람의 역할(방향 결정·선별·플레이테스트)을 분명히 쓰고, 출품 전에 사용자가 직접 여러 판 플레이하는 것이 규칙상 필요하다. 생성형 AI 공개 문구를 흐리게 쓰지 않는다.

### itch 설정 체크리스트
출처: itch HTML5 문서 https://itch.io/docs/creators/html5 (2026-11-07 확인), 표지 규격은 공식 문서에서 찾지 못해 업로드 화면 안내와 커뮤니티 글 기준.

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
- 첫 문장(태그라인 "Don't cut red." 다음 줄). 제목 ISSEN은 결정됨.
- 크레딧에 쓸 이름. 코드 도구 이름을 어디까지 적을지(Claude/Codex).
- 점수 줄 표기(`cut² × chain`)가 최종 규칙과 맞는지.
- DAILY·공유 문구를 'Coming soon'으로 미리 알릴지, 들어간 뒤에만 적을지.
- 자동 시작 여부, 성인 콘텐츠 표시 여부.
