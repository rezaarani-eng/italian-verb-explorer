#!/usr/bin/env python3
"""
Build site/data/verbs.json from a Google Sheets "Publish to web" CSV URL.

Expected sheet layout:
- Row 1: header/title row
- Row 2: pronouns in columns B:M
- Each verb uses four rows:
  Row N:   Column A = "1- abbracciare", B:G = presente examples, H:M = futuro examples
  Row N+1: Column A = English meaning, B:G = presente translations, H:M = futuro translations
  Row N+2: Column A = optional note, B:G = condizionale examples, H:M = congiuntivo examples
  Row N+3: Column A blank, B:G = condizionale translations, H:M = congiuntivo translations
"""

from __future__ import annotations

import csv
import datetime as dt
import io
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

PRONOUNS = ["io", "tu", "lui/lei", "noi", "voi", "loro"]

WORD_RE = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ']+", re.UNICODE)
SUBJECT_WORDS = {"io", "tu", "lui", "lei", "noi", "voi", "loro"}
CLITIC_WORDS = {"mi", "ti", "si", "ci", "vi", "ne", "lo", "la", "li", "le", "gli"}


def extract_focus_form(sentence: str, tense: str) -> str:
    """Return the visible conjugated phrase to display on the card.

    This is intentionally conservative: it does not try to be a full Italian parser.
    It extracts the first conjugated-looking phrase for direct tenses, and the word
    after "che" for many subjunctive examples such as "Spero che abbracci...".
    """
    tokens = WORD_RE.findall(sentence or "")
    if not tokens:
        return ""

    lower = [token.lower() for token in tokens]
    start = 0

    if "Congiuntivo" in tense and "che" in lower:
        start = lower.index("che") + 1
        if start < len(tokens) and lower[start] in SUBJECT_WORDS:
            start += 1
    elif lower[0] == "non" and len(tokens) > 1:
        start = 1

    if start >= len(tokens):
        start = 0

    if lower[start] in CLITIC_WORDS and start + 1 < len(tokens):
        return f"{tokens[start]} {tokens[start + 1]}"

    return tokens[start]

# The first two blocks are fixed by the starter sheet layout.
# The third and fourth blocks can be relabeled with GitHub Actions variables
# if you later replace Condizionale with Futuro anteriore in your Google Sheet.
THIRD_BLOCK_MOOD = os.environ.get("THIRD_BLOCK_MOOD") or "Condizionale"
THIRD_BLOCK_TENSE = os.environ.get("THIRD_BLOCK_TENSE") or "Condizionale semplice"
FOURTH_BLOCK_MOOD = os.environ.get("FOURTH_BLOCK_MOOD") or "Congiuntivo"
FOURTH_BLOCK_TENSE = os.environ.get("FOURTH_BLOCK_TENSE") or "Congiuntivo presente"

TENSE_BLOCKS = [
    ("Indicativo", "Presente", 0, 1, 6),
    ("Indicativo", "Futuro semplice", 0, 7, 12),
    (THIRD_BLOCK_MOOD, THIRD_BLOCK_TENSE, 2, 1, 6),
    (FOURTH_BLOCK_MOOD, FOURTH_BLOCK_TENSE, 2, 7, 12),
]

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "site" / "data" / "verbs.json"


def fetch_csv(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "italian-verb-site-builder/1.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read()
    return raw.decode("utf-8-sig")


def get_cell(rows: list[list[str]], row_idx: int, col_idx: int) -> str:
    if row_idx < 0 or row_idx >= len(rows):
        return ""
    row = rows[row_idx]
    if col_idx < 0 or col_idx >= len(row):
        return ""
    return row[col_idx].strip()


def clean_lemma(raw_title: str) -> str:
    text = raw_title.replace("\n", " ").strip()
    text = re.sub(r"^\s*\d+\s*[-–]\s*", "", text)
    text = re.sub(r"\s*Part\.\s*pass\.:.*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*\(p\.p\.[^)]+\)", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*\([^)]*part[^)]*\)", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*\([^)]*\)", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_rows(rows: list[list[str]]) -> dict:
    verbs = []

    for row_idx, row in enumerate(rows):
        title = get_cell(rows, row_idx, 0)
        match = re.match(r"^\s*(\d+)\s*[-–]\s*", title)
        if not match:
            continue

        verb_index = int(match.group(1))
        lemma = clean_lemma(title)
        meaning = get_cell(rows, row_idx + 1, 0)
        possible_note = get_cell(rows, row_idx + 2, 0)
        note = possible_note if possible_note.lower().startswith("answer") else ""

        forms = []
        for mood, tense, relative_row, start_col, end_col in TENSE_BLOCKS:
            italian_row = row_idx + relative_row
            translation_row = italian_row + 1

            for person_index, col_idx in enumerate(range(start_col, end_col + 1)):
                italian = get_cell(rows, italian_row, col_idx)
                forms.append({
                    "mood": mood,
                    "tense": tense,
                    "person": PRONOUNS[person_index],
                    "focus": extract_focus_form(italian, tense),
                    "italian": italian,
                    "english": get_cell(rows, translation_row, col_idx),
                })

        verbs.append({
            "index": verb_index,
            "lemma": lemma,
            "title": title,
            "meaning": meaning,
            "note": note,
            "forms": forms,
        })

    if not verbs:
        raise ValueError("No verb rows found. Check the CSV URL and sheet layout.")

    verbs.sort(key=lambda item: item["index"])

    return {
        "name": "Italian Verb Conjugation Explorer",
        "description": "Search Italian verbs and study 24 example conjugations with English translations.",
        "generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "source": "Google Sheets published CSV",
        "pronouns": PRONOUNS,
        "tenses": [block[1] for block in TENSE_BLOCKS],
        "verbs": verbs,
    }


def main() -> int:
    url = os.environ.get("SHEET_CSV_URL")
    if len(sys.argv) > 1:
        url = sys.argv[1]

    if not url:
        print("No SHEET_CSV_URL provided. Keeping the existing starter data.")
        return 0

    print("Fetching published Google Sheet CSV…")
    csv_text = fetch_csv(url)
    rows = list(csv.reader(io.StringIO(csv_text)))

    print(f"Parsing {len(rows)} CSV rows…")
    data = parse_rows(rows)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote {len(data['verbs'])} verbs to {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
