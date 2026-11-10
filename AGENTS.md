# 20초 게임잼 소품에서 작업할 때

본 게임(`C:\Game1`, 구미호 동행 액션)과 **별개 프로젝트**다. 기록·파일을 본 게임 폴더나 본 게임 `portfolio.md`에 섞지 않는다.

- 사용자 응답과 기획 기록은 한국어로 쓴다.
- 작업할 때마다 이 폴더의 `portfolio.md`에 남길 판단·사용자 수정·테스트·실패가 있는지 검토하고 기록한다. 사용자 결정, AI 제안, 구현, 자동 검사, 사용자 직접 플레이를 구분하고, 봇 결과를 사람 기록으로 쓰지 않는다. 회사명·타사 IP는 넣지 않는다.
- 잼 규칙: 플레이 20초 이하, 웹 빌드 필수, 마감 2026-11-24 00:59:00(2026-11-10 확인: 11-17에서 1주 연장, 시간대 미확인). 생성형 AI 사용(코드·그림)은 itch 페이지에 밝힌다.
- 특정 기존 게임을 재현하지 않는다(장르·메커니즘 차용은 가능).
- GitHub push·공개는 별도 허락 전에는 하지 않는다. 커밋에 AI 꼬리말을 넣지 않는다.

## 현재 구조

- `arena/` 현재 판(한 화면, 사방에서 몰려오는 적을 일섬으로 베는 20초 점수 공격). 로컬 실행: 이 폴더에서 `python -m http.server`로 띄우고 `/arena/` 열기.
- `tests/arena-sim.js` 규칙 테스트와 봇 검사(`node tests/arena-sim.js`).
- `art/asset-spec.md` 그림 요청서. 그림은 Codex CLI 이미지 생성으로 만든다. 원본은 `art/*_src.png`, 게임용은 `arena/img/`.
- `slash/`(진군형), `game/`(배 속의 세 사람) 은 폐기한 이전 판, 보관용.
- `research/` 출품작 조사와 브레인스토밍.
- `itch/` itch 페이지 초안·촬영 계획. `tools/build.py`로 출품 zip(`dist/issen-web.zip`)을 만들고 참조 경로를 검사한다. `tools/build-sfx.py` 효과음 재생성, `tools/optimize-ground.py` 바닥 용량 줄이기(`prep-art.py` 뒤에 다시 실행).
- 제목은 ISSEN(2026-11-07 사용자 결정). 잼 규칙상 사람이 지휘·직접 플레이테스트해야 하고 번쩍임 경고를 표시해야 한다.
- GitHub: https://github.com/jaepaly/issen (공개, 2026-11-07 사용자 결정). `research/`(다른 출품작 분석)와 `dist/`는 .gitignore로 제외. push는 사용자가 요청할 때만.
- GitHub Pages: https://jaepaly.github.io/issen/ (루트 index.html이 arena/로 넘긴다). git 작성자는 jaepaly(noreply 이메일).
