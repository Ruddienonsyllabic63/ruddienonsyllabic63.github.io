# -*- coding: utf-8 -*-
"""
강의시간표 PDF 묶음 → data/teaching.json 변환 (누적 강의 이력)

쓰는 법
  1) 학교 포털에서 받은 학기별 강의시간표 PDF 를
     "제공 자료/박주현 강의계획서나 시간표/" 폴더에 넣습니다.
     파일 이름에 연도와 학기가 들어 있으면 됩니다.
       예) 박주현 2026년 2학기 강의시간표.pdf
           박주현 2025학년도 1학기 강의시간표.pdf
  2) 아래 명령을 실행합니다.

     python tools/import-timetable.py

새 학기 시간표를 한 장 더 넣고 다시 실행하면 이력에 그대로 쌓입니다.
"""

import json
import re
import sys
from datetime import date
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
PDF_DIR = ROOT / "제공 자료" / "박주현 강의계획서나 시간표"

DAYS = ["월", "화", "수", "목", "금", "토"]

# 전남대 교시 시간 (요일에 따라 다릅니다)
PERIODS_MWFS = {
    1: ("09:00", "09:50"), 2: ("10:00", "10:50"), 3: ("11:00", "11:50"),
    4: ("12:00", "12:50"), 5: ("13:00", "13:50"), 6: ("14:00", "14:50"),
    7: ("15:00", "15:50"), 8: ("16:00", "16:50"), 9: ("17:00", "17:50"),
    10: ("18:00", "18:50"), 11: ("19:00", "19:50"), 12: ("20:00", "20:50"),
    13: ("21:00", "21:50"), 14: ("22:00", "22:50"), 15: ("23:00", "23:50"),
}
PERIODS_TT = {
    1: ("09:00", "10:15"), 2: ("10:30", "11:45"), 3: ("12:00", "13:15"),
    4: ("13:30", "14:45"), 5: ("15:00", "16:15"), 6: ("16:30", "17:45"),
    7: ("18:00", "19:15"), 8: ("19:30", "20:45"), 9: ("21:00", "22:15"),
    10: ("22:30", "23:45"),
}

BLOCK_RE = re.compile(r"\[\s*(\d+)\s*교시\s*\]")
HEADER = ["시간", "월", "화", "수", "목", "금", "토"]


def semester_of(name: str):
    """파일 이름에서 연도와 학기를 읽습니다."""
    m = re.search(r"(20\d{2})\s*(?:년도|학년도|년)?\s*(\d)\s*학기", name)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2))


def parse_cell(text: str, day: str):
    """한 칸 안의 수업 덩어리들을 뽑습니다. 한 칸에 둘 이상 들어 있기도 합니다."""
    if not text:
        return []
    parts = BLOCK_RE.split(text)
    # parts = ['', '1', '본문', '2', '본문', ...]
    out = []
    for i in range(1, len(parts), 2):
        period = int(parts[i])
        body = parts[i + 1] if i + 1 < len(parts) else ""
        lines = [ln.strip() for ln in body.split("\n") if ln.strip()]

        title_parts, fields, key = [], {}, None
        for ln in lines:
            m = re.match(r"(교과목|강의실|제한인원|수강인원|수업운영구분)\s*:\s*(.*)$", ln)
            if m:
                key = m.group(1)
                fields[key] = m.group(2).strip()
            elif key:
                fields[key] += ln.strip()      # 줄바꿈으로 잘린 값 이어 붙이기
            else:
                title_parts.append(ln)

        title = "".join(title_parts).strip()   # 과목명도 줄바꿈으로 잘립니다
        if not title:
            continue

        code_raw = fields.get("교과목", "")
        code, _, section = code_raw.partition("-")
        out.append({
            "title": title,
            "code": code.strip(),
            "section": section.strip(),
            "room": fields.get("강의실", ""),
            "capacity": to_int(fields.get("제한인원")),
            "enrolled": to_int(fields.get("수강인원")),
            "mode": norm_mode(fields.get("수업운영구분", "")),
            "day": day,
            "period": period,
        })
    return out


def to_int(v):
    if not v:
        return None
    m = re.search(r"\d+", str(v))
    return int(m.group()) if m else None


def norm_mode(v: str) -> str:
    """'수업운영구분:대면수 / 업' 처럼 줄이 잘려 들어오는 값을 바로잡습니다."""
    s = (v or "").replace(" ", "")
    if s.endswith("수"):
        s += "업"
    return s


def level_of(code: str) -> str:
    """교과목 코드 앞자리로 과정을 나눕니다. GR=대학원, UNV=교양, 그 밖=학부 전공."""
    c = (code or "").upper()
    if c.startswith("GR"):
        return "대학원"
    if c.startswith("UNV"):
        return "교양"
    return "학부"


def time_range(day: str, period: int):
    table = PERIODS_TT if day in ("화", "목") else PERIODS_MWFS
    return table.get(period)


def read_pdf(path: Path):
    """한 학기 PDF 에서 수업 덩어리를 모두 모읍니다."""
    blocks = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables() or []:
                if not table or [c or "" for c in table[0]][:7] != HEADER:
                    continue                    # 아래쪽 '시간표모듈' 표는 건너뜁니다
                for row in table[1:]:
                    for col in range(1, min(7, len(row))):
                        blocks.extend(parse_cell(row[col], DAYS[col - 1]))
    return blocks


def merge(blocks):
    """같은 과목(코드+분반)끼리 묶어 요일·교시를 모읍니다."""
    # 쪽이 넘어가면서 잘린 칸은 과목명만 있고 교과목 코드가 없습니다.
    # 같은 학기 안에서 이름이 같은 온전한 수업을 찾아 코드를 채워 줍니다.
    known = {b["title"]: b for b in blocks if b["code"]}
    for b in blocks:
        if not b["code"] and b["title"] in known:
            full = known[b["title"]]
            for f in ("code", "section", "room", "capacity", "enrolled", "mode"):
                b[f] = full[f]

    courses = {}
    for b in blocks:
        key = (b["code"], b["section"], b["title"])
        c = courses.setdefault(key, {
            "title": b["title"],
            "code": b["code"],
            "section": b["section"],
            "level": level_of(b["code"]),
            "room": b["room"],
            "capacity": b["capacity"],
            "enrolled": b["enrolled"],
            "mode": b["mode"],
            "_slots": set(),
        })
        c["_slots"].add((b["day"], b["period"]))
        # 비어 있던 값은 나중에 나온 값으로 채웁니다
        for f in ("room", "capacity", "enrolled", "mode"):
            if not c[f] and b[f]:
                c[f] = b[f]

    out = []
    for c in courses.values():
        slots = sorted(c.pop("_slots"), key=lambda s: (DAYS.index(s[0]), s[1]))
        by_day = {}
        for day, period in slots:
            by_day.setdefault(day, []).append(period)

        pieces = []
        for day in DAYS:
            if day not in by_day:
                continue
            ps = sorted(by_day[day])
            first, last = time_range(day, ps[0]), time_range(day, ps[-1])
            span = f"{first[0]}–{last[1]}" if first and last else ""
            pieces.append({
                "day": day,
                "periods": ps,
                "time": span,
            })

        c["slots"] = pieces
        c["when"] = " · ".join(
            f"{p['day']} {p['time']}" if p["time"] else p["day"] for p in pieces
        )
        c["hours"] = len(slots)
        out.append(c)

    out.sort(key=lambda c: ({"학부": 0, "교양": 1, "대학원": 2}.get(c["level"], 3), c["title"]))
    return out


def main():
    pdf_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else PDF_DIR
    if not pdf_dir.is_absolute():
        pdf_dir = ROOT / pdf_dir
    files = sorted(pdf_dir.glob("*.pdf"))
    if not files:
        sys.exit(f"시간표 PDF 를 찾지 못했습니다: {pdf_dir}")

    semesters, skipped = [], []
    for f in files:
        ym = semester_of(f.name)
        if not ym:
            skipped.append(f.name)
            continue
        year, term = ym
        courses = merge(read_pdf(f))
        semesters.append({
            "id": f"{year}-{term}",
            "year": year,
            "term": term,
            "label": f"{year}학년도 {term}학기",
            "courseCount": len(courses),
            "students": sum(c["enrolled"] or 0 for c in courses),
            "hours": sum(c["hours"] for c in courses),
            "courses": courses,
            "source": f.name,
        })

    semesters.sort(key=lambda s: (s["year"], s["term"]), reverse=True)

    # ── 과목별 누적 ──────────────────────────────────────────
    by_course = {}
    for s in semesters:
        for c in s["courses"]:
            k = c["title"]
            e = by_course.setdefault(k, {
                "title": c["title"],
                "code": c["code"],
                "level": c["level"],
                "count": 0,
                "students": 0,
                "semesters": [],
            })
            e["count"] += 1
            e["students"] += c["enrolled"] or 0
            e["semesters"].append(s["id"])
    ranked = sorted(by_course.values(), key=lambda e: (-e["count"], -e["students"], e["title"]))

    payload = {
        "_안내": "tools/import-timetable.py 가 강의시간표 PDF 에서 자동으로 만든 파일입니다. 직접 고치면 다음 실행 때 덮어써집니다.",
        "생성일": date.today().isoformat(),
        "summary": {
            "semesterCount": len(semesters),
            "firstSemester": semesters[-1]["label"] if semesters else "",
            "latestSemester": semesters[0]["label"] if semesters else "",
            "openedCount": sum(s["courseCount"] for s in semesters),
            "uniqueCourseCount": len(by_course),
            "totalStudents": sum(s["students"] for s in semesters),
        },
        "byCourse": ranked,
        "semesters": semesters,
    }
    (DATA / "teaching.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    su = payload["summary"]
    print(f"학기 {su['semesterCount']}개 ({su['firstSemester']} ~ {su['latestSemester']})")
    print(f"개설 {su['openedCount']}건 · 서로 다른 과목 {su['uniqueCourseCount']}개 · 누적 수강 {su['totalStudents']}명")
    for s in semesters:
        names = ", ".join(c["title"] for c in s["courses"])
        print(f"  {s['label']}: {s['courseCount']}과목 {s['students']}명 — {names}")
    if skipped:
        print("\n연도·학기를 읽지 못해 건너뛴 파일:")
        for n in skipped:
            print("  ·", n)


if __name__ == "__main__":
    main()
