import whisper
import os

model = whisper.load_model("small")

files = [
    "백주연 디글루.m4a",
]

def format_time(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    if h > 0:
        return f"{h:02d}:{m:02d}:{s:05.2f}"
    return f"{m:02d}:{s:05.2f}"

for fname in files:
    if not os.path.exists(fname):
        print(f"파일 없음: {fname}", flush=True)
        continue

    print(f"\n=== {fname} 처리 중... ===", flush=True)
    result = model.transcribe(
        fname,
        language="ko",
        verbose=False,
        word_timestamps=False,
        condition_on_previous_text=False,
        no_speech_threshold=0.6,
        logprob_threshold=-1.0,
    )

    out_name = os.path.splitext(fname)[0] + "_녹취록.md"
    with open(out_name, "w", encoding="utf-8") as f:
        f.write(f"# {os.path.splitext(fname)[0]} 녹취록\n\n")
        for seg in result["segments"]:
            start = format_time(seg["start"])
            end = format_time(seg["end"])
            text = seg["text"].strip()
            f.write(f"**[{start} → {end}]** {text}\n\n")

    print(f"  → {out_name} 저장 완료", flush=True)

print("\n모든 녹취록 생성 완료!")
