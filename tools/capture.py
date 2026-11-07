# 촬영 스크립트(초안): headless Chrome 으로 tools/capture.html 의 강제 장면을 PNG 로 뽑는다.
# 게임 파일은 고치지 않는다. 결과: dist/capture/<장면>.png (960x540) 와 cover-630x500.png(썸네일 시안, 가운데 자르기)
# 실행: python tools/capture.py [장면 ...]   (기본: title aim cut wide end)
# 최종 촬영은 연출 작업이 끝난 뒤 다시 한다. 시간은 Chrome 가상 시간(--virtual-time-budget)이라 실제 재생과 다를 수 있다.
import functools, http.server, os, shutil, subprocess, sys, threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "dist", "capture")
CHROME = [r"C:\Program Files\Google\Chrome\Application\chrome.exe",
          r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe", shutil.which("chrome") or "", shutil.which("google-chrome") or ""]
SCENES = {"title": 1500, "aim": 2500, "cut": 2500, "wide": 5000, "end": 4000}  # 장면별 가상 시간(ms)


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h = functools.partial(Quiet, directory=ROOT)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def main():
    chrome = next((c for c in CHROME if c and os.path.exists(c)), None)
    if not chrome:
        sys.exit("Chrome 을 찾지 못함")
    os.makedirs(OUT, exist_ok=True)
    srv = serve(); port = srv.server_address[1]
    names = sys.argv[1:] or list(SCENES)
    for name in names:
        out = os.path.join(OUT, name + ".png")
        url = f"http://127.0.0.1:{port}/tools/capture.html?scene={name}"
        cmd = [chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
               "--force-device-scale-factor=1", "--window-size=960,540",
               f"--virtual-time-budget={SCENES.get(name, 3000)}", f"--screenshot={out}", url]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
        print(("ok   " if os.path.exists(out) else "FAIL ") + out)
    srv.shutdown()
    try:  # 썸네일 시안: 630x500 비율로 가운데를 잘라 늘린다(최종 표지는 사람이 고른다)
        from PIL import Image
        src = os.path.join(OUT, "cut.png" if os.path.exists(os.path.join(OUT, "cut.png")) else names[0] + ".png")
        im = Image.open(src); w = round(540 * 630 / 500); x0 = (960 - w) // 2
        im.crop((x0, 0, x0 + w, 540)).resize((630, 500), Image.LANCZOS).save(os.path.join(OUT, "cover-630x500.png"))
        print("ok   " + os.path.join(OUT, "cover-630x500.png"))
    except Exception as e:
        print("cover 생략:", e)


if __name__ == "__main__":
    main()
