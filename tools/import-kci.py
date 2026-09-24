# -*- coding: utf-8 -*-
"""
KCI 저자 실적 엑셀 → data/publications.json, data/books.json 변환

쓰는 법
  1) KCI 저자 상세 페이지에서 '엑셀' 단추를 눌러 파일을 받습니다.
  2) 그 파일을 "제공 자료/" 폴더에 넣습니다.
  3) 아래 명령을 실행합니다.

     python tools/import-kci.py

  파일 이름을 직접 지정하려면:
     python tools/import-kci.py "제공 자료/박주현 저자_실적_상세-20260924.xlsx"

주제(theme) 는 아래 THEME_RULES 의 낱말로 자동 분류하고,
어긋나는 논문만 THEME_OVERRIDE 에 제목으로 적어 바로잡습니다.
분류하지 못한 논문은 실행 결과에 경고로 표시되니 그때 규칙을 보태면 됩니다.
"""

import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

THEMES = {
    "reading": {"label": "독서·독서태도", "color": "reading"},
    "mil":     {"label": "정보미디어 리터러시", "color": "mil"},
    "school":  {"label": "학교도서관·사서교사", "color": "school"},
    "policy":  {"label": "정책·법령", "color": "policy"},
    "library": {"label": "도서관·국제협력", "color": "library"},
}

# 앞에 있는 규칙이 먼저 적용됩니다.
THEME_RULES = [
    ("policy",  ["진흥법", "법령 분석", "초중등교육법", "정책적 현안"]),
    ("reading", ["독서태도", "책 읽어주기", "독서치료", "REBT", "독서 리터러시",
                 "독서행태", "독서방법"]),
    ("mil",     ["리터러시", "MIL", "UNESCO", "Big6", "정보활용교육", "미디어 개념",
                 "Digital Literacy"]),
    ("school",  ["사서교사", "학교도서관"]),
    ("library", ["도서관 불안", "빅카인즈", "복합문화도서관", "대학도서관",
                 "ODA", "몽골", "공적개발원조"]),
]

# 낱말 규칙으로는 어긋나는 논문 (제목 앞부분으로 찾습니다)
THEME_OVERRIDE = {
    "PISA 2009에서 도서관방문": "reading",
    "PISA 2009 학업성취도": "school",
    "디지털 독서 및 정보 리터러시 평가 문항": "reading",
    "PISA 2018 독서 리터러시": "reading",
    "디지털 협력수업이 독서 리터러시": "reading",
    "학교도서관 운영 인력이 학생들의 독서행태": "school",
    "학교도서관컨설팅": "school",
    "미국 학교도서관": "school",
    "학교도서관 서비스에 대한 교원들의 인식": "school",
    "국내 도서관 불안": "library",
    "공공도서관의 복합문화도서관": "library",
    "대학도서관 공간별": "library",
    "몽골 디지털 문화자원관리시스템": "library",
    "빅카인즈를 활용한": "library",
    "학교도서관 업무 및 사서교사": "policy",
    "개정 학교도서관진흥법": "policy",
    "교원의 사서교사 직무 인식": "school",
    "예비 사서교사의 교육실습": "school",
    "사서교사가 인식하는 직무": "school",
}


def pick_theme(title_ko: str) -> str | None:
    for prefix, theme in THEME_OVERRIDE.items():
        if title_ko.startswith(prefix):
            return theme
    for theme, words in THEME_RULES:
        if any(w in title_ko for w in words):
            return theme
    return None


def tidy(text) -> str:
    """제목 안의 군더더기 공백과 특수 하이픈을 정리합니다."""
    if text is None:
        return ""
    s = str(text).replace("\n", " ")
    s = s.replace("․", "·").replace("･", "·")
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\s*-\s*$", "", s)          # 끝에 매달린 하이픈
    return s


def split_ym(ym) -> tuple[int | None, int | None]:
    s = str(ym).strip() if ym is not None else ""
    s = re.sub(r"\D", "", s)
    if len(s) >= 6:
        return int(s[:4]), int(s[4:6])
    if len(s) == 4:
        return int(s), None
    return None, None


def as_int(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def find_excel() -> Path:
    if len(sys.argv) > 1:
        p = Path(sys.argv[1])
        if not p.is_absolute():
            p = ROOT / p
        return p
    candidates = sorted((ROOT / "제공 자료").glob("*실적*.xlsx"))
    if not candidates:
        candidates = sorted((ROOT / "제공 자료").glob("*.xlsx"))
    if not candidates:
        sys.exit('엑셀 파일을 찾지 못했습니다. "제공 자료/" 폴더에 넣어 주세요.')
    return candidates[-1]


def main() -> None:
    path = find_excel()
    print(f"읽는 파일: {path.name}")
    wb = openpyxl.load_workbook(path, data_only=True)

    # ── 논문 ────────────────────────────────────────────────
    items, unknown = [], []
    ws = wb["KCI"]
    for row in ws.iter_rows(min_row=2, values_only=True):
        if row[0] is None:
            continue
        title = tidy(row[2])
        if not title:
            continue
        year, month = split_ym(row[1])
        theme = pick_theme(title)
        if theme is None:
            theme = "mil"
            unknown.append(title)

        pages = ""
        if row[8] is not None and row[9] is not None:
            pages = f"{as_int(row[8])}–{as_int(row[9])}"

        items.append({
            "title": title,
            "titleEn": tidy(row[3]),
            "authors": tidy(row[11]).replace(";", ", "),
            "journal": tidy(row[4]),
            "volume": as_int(row[6]),
            "issue": as_int(row[7]),
            "pages": pages,
            "year": year,
            "month": month,
            "citations": as_int(row[17]) or 0,
            "theme": theme,
        })

    items.sort(key=lambda x: (x["year"] or 0, x["month"] or 0), reverse=True)

    pubs = {
        "_안내": "tools/import-kci.py 가 KCI 엑셀에서 자동으로 만든 파일입니다. 직접 고치면 다음 실행 때 덮어써집니다.",
        "출처": f"KCI 저자 실적 상세 ({path.name})",
        "themes": THEMES,
        "items": items,
    }
    (DATA / "publications.json").write_text(
        json.dumps(pubs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # ── 저역서 ──────────────────────────────────────────────
    books = []
    if "BOOK" in wb.sheetnames:
        for row in wb["BOOK"].iter_rows(min_row=2, values_only=True):
            if row[0] is None:
                continue
            year, month = split_ym(row[1])
            books.append({
                "title": tidy(row[2]),
                "publisher": tidy(row[3]),
                "authors": tidy(row[4]),
                "year": year,
                "month": month,
            })
        books.sort(key=lambda x: (x["year"] or 0, x["month"] or 0), reverse=True)

    (DATA / "books.json").write_text(
        json.dumps({
            "_안내": "tools/import-kci.py 가 KCI 엑셀에서 자동으로 만든 파일입니다.",
            "items": books,
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # ── 결과 ────────────────────────────────────────────────
    counts = {}
    for it in items:
        counts[it["theme"]] = counts.get(it["theme"], 0) + 1
    print(f"논문 {len(items)}편, 저역서 {len(books)}권을 넣었습니다.")
    for key, meta in THEMES.items():
        print(f"  - {meta['label']}: {counts.get(key, 0)}편")
    if unknown:
        print("\n주제를 정하지 못해 '정보미디어 리터러시'로 넣은 논문입니다.")
        print("이 스크립트의 THEME_OVERRIDE 에 제목을 적어 주세요.")
        for t in unknown:
            print("  ·", t)


if __name__ == "__main__":
    main()
