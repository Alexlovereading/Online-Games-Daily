#!/usr/bin/env python3
"""Pull one game's keyword block out of the Semrush-style keyword workbook.

Usage:
    python3 extract_keywords.py <path-to-xlsx> "<Game Name As Written In Col A>"
    python3 extract_keywords.py <path-to-xlsx> --list   # show every game name found

The source sheet ("SEO关键词推荐") is laid out as merged blocks: the game's
English/Chinese name and seed term only appear on the block's first row, and
every following row (until the next named row) belongs to that same game.
This script re-groups those rows and filters out anything the project's
established rule excludes: 优先级 == "低" (low priority — see
memory `project_seo_geo.md` for why only 高/中 get used).
"""
import argparse
import json
import sys

try:
    import openpyxl
except ImportError:
    sys.exit("Missing dependency: pip install openpyxl")

SHEET_NAME = "SEO关键词推荐"
COLUMNS = ["game_en", "game_cn", "seed", "keyword", "volume", "kd", "cpc", "intent", "priority", "note"]


def load_rows(xlsx_path: str):
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb[SHEET_NAME]
    rows = []
    current = {}
    for raw in ws.iter_rows(min_row=2, values_only=True):
        if raw[0]:
            current = {"game_en": raw[0], "game_cn": raw[1]}
        row = dict(zip(COLUMNS, [current.get("game_en"), current.get("game_cn"), *raw[2:]]))
        if row["keyword"]:
            rows.append(row)
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("xlsx_path")
    parser.add_argument("game_name", nargs="?", help='Exact "game_en" value, e.g. "Daily Sudoku"')
    parser.add_argument("--list", action="store_true", help="list every distinct game name and exit")
    parser.add_argument("--include-low", action="store_true", help="also include 优先级=低 rows (off by default)")
    args = parser.parse_args()

    rows = load_rows(args.xlsx_path)

    if args.list:
        seen = []
        for r in rows:
            if r["game_en"] not in seen:
                seen.append(r["game_en"])
        print("\n".join(seen))
        return

    if not args.game_name:
        parser.error("game_name is required unless --list is passed")

    matched = [r for r in rows if r["game_en"] == args.game_name]
    if not matched:
        sys.exit(f"No rows found for {args.game_name!r}. Run with --list to see valid names.")

    kept = [r for r in matched if args.include_low or r["priority"] != "低"]
    dropped = [r for r in matched if r not in kept]

    print(json.dumps({
        "game": args.game_name,
        "kept_count": len(kept),
        "dropped_low_priority_count": len(dropped),
        "kept": kept,
        "dropped": dropped,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
