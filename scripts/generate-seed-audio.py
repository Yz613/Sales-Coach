#!/usr/bin/env python3
"""Generate spoken recordings for the four seeded sales calls."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "recordings"

VOICES = {
    "Marcus": "en-us+m3",
    "Greg": "en-us+m2",
    "David": "en-us+m1",
    "Dr. Thorne": "en-gb+m3",
    "Chloe": "en-us+f3",
    "Rachel": "en-us+f2",
    "Sarah": "en-us+f4",
    "Karen": "en-us+f3",
    "Narrator": "en-us+m7",
}

CALLS = [
    {
        "id": "call_01",
        "turns": [
            ("Marcus", "Hey Greg, this is Marcus with CloudFlow. I know you weren't expecting my call, do you have 30 seconds to tell me if this is a bad time?"),
            ("Greg", "Look, I'm literally walking into a warehouse meeting right now. We already got a quote from FreightPulse last week and we're pretty set."),
            ("Marcus", "Totally get that Greg, FreightPulse is solid. But usually when VP of Ops tell us they're set, they're still dealing with the 4-hour manual customs delay at the border. Is that something you guys have completely eliminated, or is it still a daily headache?"),
            ("Greg", "Well, customs is always messy, honestly. We lose at least 3 hours on paperwork per haul."),
            ("Marcus", "That's exactly why I called. We automate that clearance in 8 minutes flat. I don't want to make you late for your meeting. How about Tuesday at 9:30 AM so I can show you how we saved SwiftTransit 14 hours a week?"),
            ("Greg", "Fine, send the calendar invite to greg at apexlogistics.com. Tuesday 9:30."),
        ],
    },
    {
        "id": "call_02",
        "turns": [
            ("David", "Hi Dr. Thorne, my name is David Kim with LabSync. How are you today?"),
            ("Dr. Thorne", "I'm busy. What is this regarding?"),
            ("David", "I was calling to introduce our state of the art lab automation software that helps biotech labs increase throughput by 40%."),
            ("Dr. Thorne", "We already have a LIMS system and we don't need anything new right now."),
            ("David", "Oh okay, no problem! What system are you currently using if you don't mind me asking?"),
            ("Dr. Thorne", "Benchling. Just send me an email with some brochures and I'll keep it on file."),
            ("David", "Absolutely Dr. Thorne, I'll send that right over to your inbox. Have a great day!"),
            ("Dr. Thorne", "Thanks, bye."),
        ],
    },
    {
        "id": "call_03",
        "turns": [
            ("Chloe", "Hi Rachel, thanks for joining today's discovery call. Excited to show you what we've built."),
            ("Rachel", "Thanks Chloe. We are looking to streamline our supplier procurement tracking. Currently our ERP requires 14 manual approvals per purchase order."),
            ("Chloe", "That sounds terrible! Let me pull up my slides and jump right into the demo to show you how our system eliminates approval bottlenecks..."),
            ("Narrator", "Chloe then walked through a twenty minute product demo."),
            ("Chloe", "So as you can see, our workflow engine handles multi-tier approvals. What do you think?"),
            ("Rachel", "It looks neat. What's the cost?"),
            ("Chloe", "Well, it depends on the number of users and custom modules. Our standard tier starts around $35,000 annually, but we can work on pricing. What budget did you have allocated for this?"),
            ("Rachel", "We don't have a specific budget approved yet for this fiscal quarter. We're just gathering vendor quotes to see what's out there."),
            ("Chloe", "Oh got it! Well, I can put together a formal quote and email it over to you. Then you can show your team?"),
            ("Rachel", "Sure, send the PDF over and I'll review it with my boss if we decide to move forward."),
            ("Chloe", "Great, I'll email that proposal today!"),
        ],
    },
    {
        "id": "call_04",
        "turns": [
            ("Sarah", "Karen, good to connect again. On our last call, you mentioned HIPAA audit logging was the primary risk keeping you awake ahead of your November HHS review. Today our goal is to align on security verification and map out the procurement timeline so you are protected by October 15. Fair agenda?"),
            ("Karen", "That's fair, Sarah. We reviewed your SOC 2 Type II report and InfoSec has a couple questions on data encryption at rest."),
            ("Sarah", "Understood. Let's resolve the encryption specifics right now."),
            ("Narrator", "Sarah addressed AES 256 protocols and KMS integration."),
            ("Sarah", "Does that satisfy InfoSec's requirement?"),
            ("Karen", "Yes, that clears the hurdle."),
            ("Sarah", "Excellent. Regarding commercial terms, our annual enterprise agreement is $72,000 billed upfront. Who else on the executive team or in legal needs to review the M S A for us to hit your October 15 go-live?"),
            ("Karen", "Our General Counsel, Dan Vance, and CFO, Elena Rostova."),
            ("Sarah", "Perfect. Let's schedule a 20-minute executive briefing with Dan and Elena this Thursday. I'll provide redline-free standard clauses. Thursday 2 PM work for your team?"),
            ("Karen", "Put it on our calendars. I'll bring Dan and Elena."),
        ],
    },
]


def run(cmd: list[str]) -> None:
    result = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if result.returncode != 0:
        err = result.stderr.decode("utf-8", errors="replace")
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(cmd)}\n{err}")


def probe_duration(path: Path) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip() or "0")


def format_clock(seconds: float) -> str:
    total = max(0, int(round(seconds)))
    minutes, secs = divmod(total, 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def synthesize_turn(text: str, voice: str, dest: Path, rate: int = 148) -> None:
    raw = dest.with_name(dest.stem + "_raw.wav")
    run(["espeak-ng", "-v", voice, "-s", str(rate), "-w", str(raw), text])
    run(["ffmpeg", "-y", "-i", str(raw), "-ar", "22050", "-ac", "1", "-c:a", "pcm_s16le", str(dest)])
    raw.unlink(missing_ok=True)


def make_silence(dest: Path, seconds: float = 0.35) -> None:
    run([
        "ffmpeg", "-y", "-f", "lavfi",
        "-i", "anullsrc=r=22050:cl=mono",
        "-t", f"{seconds:.2f}",
        "-c:a", "pcm_s16le",
        str(dest),
    ])


def concat_wavs(paths: list[Path], dest: Path) -> None:
    listing = dest.with_suffix(".txt")
    listing.write_text("".join(f"file '{p}'\n" for p in paths))
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(dest)])
    listing.unlink(missing_ok=True)


def encode_mp3(wav: Path, dest: Path) -> None:
    run(["ffmpeg", "-y", "-i", str(wav), "-codec:a", "libmp3lame", "-qscale:a", "5", str(dest)])


def generate_call(call: dict, tmp: Path) -> dict:
    clips: list[Path] = []
    stamped_lines: list[str] = []
    cursor = 0.0
    silence = tmp / f"{call['id']}_silence.wav"
    make_silence(silence, 0.32)

    for index, (speaker, text) in enumerate(call["turns"]):
        clip = tmp / f"{call['id']}_{index}.wav"
        voice = VOICES.get(speaker, "en-us")
        rate = 132 if speaker == "Narrator" else 148
        synthesize_turn(text, voice, clip, rate=rate)
        duration = probe_duration(clip)
        stamped_lines.append(f"[{format_clock(cursor)}] {speaker}: {text}")
        clips.append(clip)
        clips.append(silence)
        cursor += duration + 0.32

    combined = tmp / f"{call['id']}_combined.wav"
    concat_wavs(clips[:-1], combined)  # drop trailing silence
    mp3 = OUT_DIR / f"{call['id']}.mp3"
    encode_mp3(combined, mp3)
    duration = round(probe_duration(mp3))
    return {
        "id": call["id"],
        "audioUrl": f"/recordings/{call['id']}.mp3",
        "durationSeconds": duration,
        "transcriptText": "\n".join(stamped_lines),
        "bytes": mp3.stat().st_size,
    }


def main() -> None:
    if not shutil.which("espeak-ng") or not shutil.which("ffmpeg"):
        raise SystemExit("espeak-ng and ffmpeg are required")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    records = []
    with tempfile.TemporaryDirectory() as raw:
        tmp = Path(raw)
        for call in CALLS:
            print(f"Generating {call['id']}...")
            records.append(generate_call(call, tmp))
    (OUT_DIR / "manifest.json").write_text(json.dumps(records, indent=2) + "\n")
    for rec in records:
        print(f"{rec['id']}: {rec['durationSeconds']}s, {rec['bytes']} bytes")


if __name__ == "__main__":
    main()
