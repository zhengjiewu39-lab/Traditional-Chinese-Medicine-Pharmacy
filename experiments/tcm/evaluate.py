#!/usr/bin/env python3
"""Summarize experiment JSON results into CSV."""

from __future__ import annotations

import argparse
import csv
import glob
import json
import os


def main():
    p = argparse.ArgumentParser(description="Summarize TCM experiment results")
    p.add_argument("--results", default="experiments/results")
    p.add_argument("--out", default="experiments/results/summary.csv")
    p.add_argument("--project", default="tcm")
    args = p.parse_args()

    rows = []
    for fp in sorted(glob.glob(os.path.join(args.results, "*.json"))):
        if fp.endswith("summary.json"):
            continue
        try:
            r = json.load(open(fp, encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if r.get("project") not in (args.project, None):
            continue
        m = r.get("metrics", {})
        rows.append({
            "exp_id": r.get("exp_id", os.path.basename(fp)),
            "project": r.get("project", args.project),
            "model": r.get("model", ""),
            "n_samples": r.get("n_samples", ""),
            "accuracy": m.get("accuracy_mean", ""),
            "accuracy_std": m.get("accuracy_std", ""),
            "macro_f1": m.get("macro_f1_mean", ""),
            "macro_f1_std": m.get("macro_f1_std", ""),
            "data": r.get("data", ""),
            "created_at": r.get("created_at", ""),
            "file": fp,
        })

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    if not rows:
        print("No result files found.")
        return

    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} rows → {args.out}")


if __name__ == "__main__":
    main()
