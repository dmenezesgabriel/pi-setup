#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Stratify skill-eval prompts into train and validation splits.

Usage:
  uv run scripts/skill-evals/split_queries.py --input skills/dataviz/evals/evals.json
  uv run scripts/skill-evals/split_queries.py --input evals.json --output evals.split.json --validation-ratio 0.4
"""

from __future__ import annotations

import argparse
import json
import random
from collections import defaultdict
from pathlib import Path


def load_payload(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def get_cases(payload: dict) -> list[dict]:
    if isinstance(payload, list):
        return payload
    if "evals" in payload and isinstance(payload["evals"], list):
        return payload["evals"]
    raise ValueError("Input JSON must be a list or an object with an 'evals' array")


def set_cases(payload: dict, cases: list[dict]) -> dict:
    if isinstance(payload, list):
        return cases
    new_payload = dict(payload)
    new_payload["evals"] = cases
    return new_payload


def split_cases(cases: list[dict], validation_ratio: float, seed: int) -> list[dict]:
    rng = random.Random(seed)
    buckets: dict[bool, list[dict]] = defaultdict(list)
    for case in cases:
        buckets[bool(case.get("should_trigger", False))].append(dict(case))

    split_cases: list[dict] = []
    for label, bucket in sorted(buckets.items(), key=lambda item: item[0], reverse=True):
        rng.shuffle(bucket)
        if not bucket:
            continue
        validation_count = int(round(len(bucket) * validation_ratio))
        validation_count = max(0, min(validation_count, len(bucket)))
        for index, case in enumerate(bucket):
            case["split"] = "validation" if index < validation_count else "train"
            split_cases.append(case)
    rng.shuffle(split_cases)
    return split_cases


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="Input JSON file")
    parser.add_argument("--output", type=Path, help="Write the split JSON here")
    parser.add_argument("--validation-ratio", type=float, default=0.4, help="Fraction of each label bucket to send to validation")
    parser.add_argument("--seed", type=int, default=7, help="Shuffle seed")
    args = parser.parse_args()

    payload = load_payload(args.input)
    cases = get_cases(payload)
    split = split_cases(cases, args.validation_ratio, args.seed)
    result = set_cases(payload, split)

    out = json.dumps(result, indent=2, sort_keys=True)
    if args.output:
        args.output.write_text(out + "\n", encoding="utf-8")
    else:
        print(out)

    counts = defaultdict(int)
    for case in split:
        counts[f"{case.get('split')}:{bool(case.get('should_trigger', False))}"] += 1
    print(json.dumps({"counts": dict(counts), "total": len(split)}, indent=2, sort_keys=True), file=__import__("sys").stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
