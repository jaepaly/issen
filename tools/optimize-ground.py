# arena/img/ground.png 용량 줄이기 (PNG 유지: main.js 가 "img/ground.png" 를 부른다).
# 종이 바닥은 실제 색이 2천 개 남짓이라 32색 팔레트(MAXCOVERAGE + 디더링)로 바꿔도
# 채널당 최대 차이 4/255 정도다. 크기 1024px 는 그대로 둔다(게임은 512 월드px로 깔지만 DPR 2 화면에서 쓰인다).
# 주의: tools/prep-art.py 를 다시 돌리면 ground.png 가 원본 크기로 돌아오므로 이 스크립트를 다시 돌린다.
# 실행: python tools/optimize-ground.py [색 수=32]
import os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, "arena", "img", "ground.png")
colors = int(sys.argv[1]) if len(sys.argv) > 1 else 32
before = os.path.getsize(P)
im = Image.open(P).convert("RGB")
if Image.open(P).mode == "P":
    print("이미 팔레트 PNG입니다. 원본에서 다시 하려면 tools/prep-art.py 를 먼저 돌리세요."); sys.exit(0)
q = im.quantize(colors=colors, method=Image.Quantize.MAXCOVERAGE, dither=Image.Dither.FLOYDSTEINBERG)
a, b = np.asarray(im, float), np.asarray(q.convert("RGB"), float)
psnr = 10 * np.log10(255 ** 2 / ((a - b) ** 2).mean())
q.save(P, optimize=True)
print(f"ground.png {before:,} -> {os.path.getsize(P):,} bytes, {colors}색, PSNR {psnr:.1f}dB, 최대차 {int(abs(a-b).max())}/255")
