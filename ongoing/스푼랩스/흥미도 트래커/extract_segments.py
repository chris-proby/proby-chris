import whisper
import os
import json

model = whisper.load_model("small")

fname = "백주연 디글루.m4a"
print(f"=== {fname} 세그먼트 추출 중... ===", flush=True)

result = model.transcribe(
    fname,
    language="ko",
    verbose=False,
    word_timestamps=False,
    condition_on_previous_text=False,
    no_speech_threshold=0.6,
    logprob_threshold=-1.0,
)

# 42초~11분 구간 세그먼트만 출력
print("\n=== 42초 ~ 11분 구간 세그먼트 ===")
for seg in result["segments"]:
    start = seg["start"]
    end = seg["end"]
    text = seg["text"].strip()
    no_speech_prob = seg.get("no_speech_prob", 0)

    if 42 <= start <= 660:  # 42s ~ 11min
        print(f"[{start:.1f}s → {end:.1f}s] prob={no_speech_prob:.2f} | {text}")

# 전체 세그먼트를 JSON으로도 저장
with open("segments_raw.json", "w", encoding="utf-8") as f:
    json.dump(result["segments"], f, ensure_ascii=False, indent=2)

print("\n→ segments_raw.json 저장 완료")
