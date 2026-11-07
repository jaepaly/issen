import sys, subprocess, re, os
# 효과음 합치기: Kenney "Impact Sounds"(CC0) 원본과 arena/sfx 의 RPG Audio 조각을 겹치고 피치를 바꿔 arena/sfx/*.mp3 로 만든다.
# 원본 묶음은 저장소에 넣지 않는다(kenney.nl/assets/impact-sounds 에서 받아 압축을 푼 Audio 폴더를 넘긴다).
# 각 결과는 최고점 -1dBFS 로 맞춘 64kbps 모노 mp3. 재생 배율 r 은 asetrate 로 바꾸므로 음높이와 길이가 함께 바뀐다(r>1 높고 짧게).
# 실행: python tools/build-sfx.py <Impact Sounds의 Audio 폴더> arena/sfx <임시폴더> [이름...]
IMP, SFX, TMP = sys.argv[1], sys.argv[2], sys.argv[3]
I = lambda n: os.path.join(IMP, n + ".ogg")
S = lambda n: os.path.join(SFX, n + ".mp3") if os.path.exists(os.path.join(SFX, n + ".mp3")) else os.path.join(SFX, "_unused", n + ".mp3")
# 이름: (겹칠 소리 [(파일, 재생배율, 지연ms, 음량)], 전체 길이 s, 끝 페이드 s, 추가 필터)
R = {
 "levelup":  ([(I("impactBell_heavy_003"),1.5,0,0.8),(I("impactBell_heavy_003"),2.0,90,1.0),(I("impactWood_light_000"),1.4,0,0.6)], 0.55, 0.3, ""),
 "banner":   ([(I("impactBell_heavy_002"),2.4,0,0.9),(I("impactPlank_medium_001"),1.4,0,0.7)], 0.32, 0.18, ""),
 "multi":    ([(I("impactPlank_medium_002"),1.3,0,1.0),(I("impactPlank_medium_001"),1.05,28,0.8),(I("impactBell_heavy_003"),2.6,28,0.35)], 0.36, 0.2, ""),
 "elite_down":([(I("impactPunch_heavy_002"),1.0,0,1.0),(I("impactPlate_heavy_001"),0.9,0,0.55)], 0.36, 0.18, ""),
 "boss_warn":([(I("impactBell_heavy_001"),0.55,0,0.8),(I("impactSoft_heavy_003"),0.6,0,1.0),(I("impactSoft_heavy_001"),0.62,400,0.9)], 1.4, 0.7, ""),
 "boss_down":([(I("impactPunch_heavy_000"),0.9,0,1.0),(I("impactBell_heavy_000"),0.8,0,0.7),(S("knifeSlice2"),0.95,0,0.8)], 1.3, 0.8, ""),
 "red_death":([(I("impactSoft_heavy_003"),0.6,0,1.0),(I("impactBell_heavy_004"),0.45,0,0.8),(I("impactPunch_heavy_001"),0.7,20,0.8)], 0.75, 0.4, ",lowpass=f=2400"),
 "hurt":     ([(I("impactPunch_medium_001"),0.95,0,1.0)], 0.26, 0.12, ""),
 "gong_end": ([(I("impactBell_heavy_001"),0.42,0,0.9),(I("impactSoft_heavy_002"),0.5,0,0.9)], 2.2, 1.3, ""),
 "allcut":   ([(S("knifeSlice2"),1.0,0,0.8),(S("cut_b"),1.15,12,0.7),(S("knifeSlice"),1.05,25,0.7),(S("cut_a"),0.9,50,0.7),(S("swish"),0.9,0,0.5),(I("impactPunch_heavy_003"),0.9,30,0.6)], 0.62, 0.3, ""),
 "tick":     ([(I("impactWood_light_002"),1.7,0,1.0)], 0.08, 0.04, ""),
 # 2026-11-07 반사 일섬·능력 도장·보스 발도
 "ricochet": ([(I("impactMetal_light_001"),1.35,0,1.0),(I("impactMetal_medium_002"),1.6,0,0.5),(S("drawKnife2"),1.7,0,0.35)], 0.18, 0.1, ",highpass=f=900"),
 "perk":     ([(I("impactWood_heavy_002"),0.75,0,1.0),(I("impactPlate_heavy_001"),0.7,0,0.6),(I("impactMetal_light_002"),1.25,150,0.45),(I("impactMetal_light_002"),1.6,240,0.55)], 0.48, 0.2, ""),
 "boss_iai_hold":([(S("drawKnife1"),0.8,0,0.9),(S("cloth4"),0.7,0,0.4)], 0.3, 0.15, ",lowpass=f=5000"),
 "boss_iai": ([(S("knifeSlice2"),0.95,0,0.9),(S("cut_b"),1.05,10,0.8),(S("knifeSlice"),0.9,22,0.8),(S("cut_a"),0.85,40,0.8),(S("swish"),0.8,0,0.6),(I("impactPunch_heavy_000"),0.8,15,0.9),(I("impactSoft_heavy_003"),0.55,20,1.0),(I("impactBell_heavy_001"),0.5,30,0.6)], 1.05, 0.6, ""),
}
only = sys.argv[4:] or list(R)
for name in only:
    layers, length, fade, extra = R[name]
    args = ["ffmpeg","-v","error","-y"]
    fc = []
    for k,(f,r,d,v) in enumerate(layers):
        args += ["-i", f]
        fc.append(f"[{k}:a]aformat=channel_layouts=mono,aresample=44100,asetrate={int(44100*r)},aresample=44100,adelay={d},volume={v}[l{k}]")
    mix = "".join(f"[l{k}]" for k in range(len(layers)))
    fc.append(f"{mix}amix=inputs={len(layers)}:normalize=0:duration=longest,atrim=0:{length},afade=t=out:st={length-fade}:d={fade}{extra}[m]")
    tmp = os.path.join(TMP, name + ".wav")
    subprocess.run(args + ["-filter_complex", ";".join(fc), "-map","[m]","-c:a","pcm_f32le", tmp], check=True)
    vd = subprocess.run(["ffmpeg","-i",tmp,"-af","astats","-f","null","-"],capture_output=True,text=True).stderr
    mx = float(re.findall(r"Peak level dB: (-?[\d.]+)", vd)[-1])
    out = os.path.join(SFX, name + ".mp3")
    subprocess.run(["ffmpeg","-v","error","-y","-i",tmp,"-af",f"volume={-1.0-mx}dB","-ac","1","-c:a","libmp3lame","-b:a","64k",out], check=True)
    print(name, "peak before norm", mx, "->", os.path.getsize(out), "bytes")
