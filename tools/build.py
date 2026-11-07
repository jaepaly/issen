# 출품용 웹 빌드: arena/ 에서 필요한 파일만 골라 dist/<ZIP_NAME> 을 만든다.
# - index.html 이 zip 최상위에 온다(itch 요구).
# - 빌드 뒤 zip 안에서 index.html 이 부르는 경로, main.js 가 부르는 img/*.png, sfx/*.mp3 가
#   실제 있는지 검사하고, 빠지면 실패(종료 코드 1)한다.
# 실행: python tools/build.py
import fnmatch, glob, os, re, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "arena")
DIST = os.path.join(ROOT, "dist")
ZIP_NAME = "issen-web.zip"  # 임시 제목. 최종 제목이 정해지면 바꾼다

INCLUDE = ["index.html", "game.js", "main.js", "img/*.png", "img/meta.js", "sfx/*.mp3", "sfx/LICENSE*"]
EXCLUDE = ["sfx-test.html", "sfx/_unused/*", "*_src.png", "*.psd", "img/meta.json"]


def collect():
    files = set()
    for pat in INCLUDE:
        for p in glob.glob(os.path.join(SRC, pat)):
            if os.path.isfile(p):
                files.add(os.path.relpath(p, SRC).replace("\\", "/"))
    return sorted(f for f in files if not any(fnmatch.fnmatch(f, e) for e in EXCLUDE))


def js_strings(arr_src):
    return re.findall(r"""["']([^"']+)["']""", arr_src)


def required(z):
    """zip 안 소스에서 불러오는 경로를 뽑는다. 패턴을 못 찾으면 그것도 실패로 본다(코드가 바뀌었다는 신호)."""
    need, errors = set(), []
    html = z.read("index.html").decode("utf-8")
    for m in re.finditer(r"""(?:src|href)\s*=\s*["']([^"'#?]+)["']""", html):
        u = m.group(1)
        if not re.match(r"^(https?:|data:|//)", u):
            need.add(u.lstrip("./"))
    main = z.read("main.js").decode("utf-8")
    # 그림: META(img/meta.js 의 ART_META) 키 + main.js 에서 concat 으로 더하는 이름 + "img/x.png" 같은 직접 경로
    if "img/meta.js" in z.namelist():
        meta = z.read("img/meta.js").decode("utf-8")
        mm = re.search(r"ART_META\s*=\s*(\{.*?\})", meta, re.S)
        if mm:
            need.update("img/%s.png" % k for k in re.findall(r'"([^"]+)"\s*:', mm.group(1)))
        else:
            errors.append("img/meta.js 에서 ART_META 를 못 찾음")
    img_line = re.search(r'["\']img/["\']\s*\+\s*\w+\s*\+\s*["\']\.png["\']', main)
    if img_line:
        line = main[main.rfind("\n", 0, img_line.start()) + 1: main.find("\n", img_line.end())]
        for arr in re.findall(r"\[([^\[\]]*)\]", line):
            need.update("img/%s.png" % s for s in js_strings(arr))
    else:
        errors.append('main.js 에서 "img/" + k + ".png" 로딩 패턴을 못 찾음(검사 규칙을 고칠 것)')
    sm = re.search(r"SFX_NAMES\s*=\s*\[([^\]]*)\]", main)
    if sm:
        need.update("sfx/%s.mp3" % s for s in js_strings(sm.group(1)))
    else:
        errors.append("main.js 에서 SFX_NAMES 를 못 찾음(검사 규칙을 고칠 것)")
    for src in ("main.js", "game.js"):
        if src in z.namelist():
            code = z.read(src).decode("utf-8")
            need.update(re.findall(r"""["']((?:img|sfx)/[\w\-./]+\.(?:png|mp3|ogg|wav|json|js))["']""", code))
    return need, errors


def main():
    files = collect()
    if "index.html" not in files:
        sys.exit("arena/index.html 이 없음")
    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, ZIP_NAME)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in files:
            z.write(os.path.join(SRC, f), f)  # arena/ 를 뺀 상대 경로 → index.html 이 최상위
    raw = sum(os.path.getsize(os.path.join(SRC, f)) for f in files)
    print(f"{out}\n  파일 {len(files)}개, 원본 합계 {raw/1024:.0f} KB, zip {os.path.getsize(out)/1024:.0f} KB")
    for f in files:
        print(f"    {os.path.getsize(os.path.join(SRC, f))/1024:8.1f} KB  {f}")

    with zipfile.ZipFile(out) as z:
        names = set(z.namelist())
        need, errors = required(z)
        bad = [n for n in names if "\\" in n or n.startswith("/") or len(n) > 240]
        missing = sorted(need - names)
        unused = sorted(n for n in names - need if n.endswith((".png", ".mp3")))
    print(f"  참조 검사: {len(need)}개 경로 확인")
    if unused:
        print("  (참고) 참조를 못 찾은 파일 — 안 쓰면 빼도 됨:", ", ".join(unused))
    if bad:
        errors.append("잘못된 zip 경로: " + ", ".join(bad))
    if missing:
        errors.append("zip 에 없는 참조: " + ", ".join(missing))
    if len(names) > 1000:
        errors.append("파일 수 1000개 초과(itch 제한)")
    if errors:
        print("빌드 검사 실패:\n  - " + "\n  - ".join(errors))
        sys.exit(1)
    print("빌드 검사 통과")


if __name__ == "__main__":
    main()
