# art/*_src.png(Codex 이미지 생성 원본) → arena/img/*.png(게임용) + arena/img/meta.js
# 캐릭터: 알파 무게중심(=몸통)을 회전 중심으로 두고 정사각형으로 잘라 256px로 줄인다.
#         meta 값 = 몸통 추정 반지름 / 그림 반폭 (게임에서 판정 반지름에 맞춰 크기를 정할 때 씀)
# 바닥: 불투명 타일로 1024px. 먹물 자국: 테두리까지 잘라 256px.
# 실행: python tools/prep-art.py
import glob, json, os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, "art"), os.path.join(ROOT, "arena", "img")
os.makedirs(OUT, exist_ok=True)
meta = {}
for path in sorted(glob.glob(os.path.join(SRC, "*_src.png"))):
    name = os.path.basename(path)[:-8]
    im = Image.open(path).convert("RGBA")
    if name == "ground":
        im.convert("RGB").resize((1024, 1024), Image.LANCZOS).save(os.path.join(OUT, "ground.png"))
        print("ground", im.size); continue
    a = np.array(im)[:, :, 3].astype(float) / 255
    if a.min() > 0.9:
        print("SKIP (배경이 투명하지 않음)", name); continue
    ys, xs = np.nonzero(a > 0.08); w = a[ys, xs]
    if name.startswith("splat"):
        box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
        c = im.crop(box); s = max(c.size); sq = Image.new("RGBA", (s, s)); sq.alpha_composite(c, ((s - c.size[0]) // 2, (s - c.size[1]) // 2))
        sq.resize((256, 256), Image.LANCZOS).save(os.path.join(OUT, name + ".png")); print(name, "splat"); continue
    cx, cy = (xs * w).sum() / w.sum(), (ys * w).sum() / w.sum()
    half = max(cx - xs.min(), xs.max() - cx, cy - ys.min(), ys.max() - cy) + 8
    box = tuple(int(v) for v in (cx - half, cy - half, cx + half, cy + half))
    sq = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]))
    sq.paste(im, (-box[0], -box[1]))  # 원본 밖은 투명으로 채움
    size = 512 if name == "boss" else 256
    sq.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name + ".png"))
    meta[name] = round(float((w.sum() / np.pi) ** 0.5 / half), 3)
    print(name, im.size, "body", meta[name])
with open(os.path.join(OUT, "meta.js"), "w", encoding="utf-8") as f:
    f.write("window.ART_META = " + json.dumps(meta) + ";\n")
