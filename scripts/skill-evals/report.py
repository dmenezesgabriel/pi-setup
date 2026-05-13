#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Aggregate trigger and output eval reports into one benchmark summary.

Usage:
  uv run scripts/skill-evals/report.py --inputs trigger-report.json output-report.json
"""

from __future__ import annotations

import argparse
import json
import statistics
from pathlib import Path


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inputs", type=Path, nargs="+", required=True, help="One or more report JSON files")
    parser.add_argument("--output", type=Path, help="Write the benchmark summary here")
    args = parser.parse_args()

    reports = [read_json(path) for path in args.inputs]
    pass_rates = []
    totals = []
    counts = {"passed": 0, "failed": 0, "total": 0}
    metric_series: dict[str, list[float]] = {}

    for report in reports:
        summary = report.get("summary", {})
        if not isinstance(summary, dict):
            continue

        report_passed = summary.get("passed")
        report_failed = summary.get("failed")
        report_total = summary.get("total")
        tp = summary.get("true_positives")
        fp = summary.get("false_positives")
        tn = summary.get("true_negatives")
        fn = summary.get("false_negatives")

        if isinstance(report_passed, (int, float)) and isinstance(report_failed, (int, float)):
            counts["passed"] += int(report_passed)
            counts["failed"] += int(report_failed)
            counts["total"] += int(report_passed) + int(report_failed)
            if isinstance(report_total, (int, float)) and report_total:
                pass_rates.append(float(report_passed) / float(report_total))
        elif all(isinstance(value, (int, float)) for value in (tp, fp, tn, fn)):
            correct = int(tp) + int(tn)
            incorrect = int(fp) + int(fn)
            total = correct + incorrect
            counts["passed"] += correct
            counts["failed"] += incorrect
            counts["total"] += total
            if total:
                pass_rates.append(correct / total)

        if isinstance(report_total, (int, float)):
            totals.append(int(report_total))
        elif all(isinstance(value, (int, float)) for value in (tp, fp, tn, fn)):
            totals.append(int(tp) + int(fp) + int(tn) + int(fn))

        for key, value in summary.items():
            if key in {"passed", "failed", "total"}:
                continue
            if isinstance(value, (int, float)):
                metric_series.setdefault(key, []).append(float(value))

    benchmark = {
        "reports": [path.name for path in args.inputs],
        "aggregate": {
            "passed": counts["passed"],
            "failed": counts["failed"],
            "total": counts["total"],
            "pass_rate": (counts["passed"] / counts["total"]) if counts["total"] else 0.0,
        },
        "pass_rate": {
            "mean": statistics.mean(pass_rates) if pass_rates else 0.0,
            "stddev": statistics.pstdev(pass_rates) if len(pass_rates) > 1 else 0.0,
        },
        "total_assertions": {
            "mean": statistics.mean(totals) if totals else 0.0,
            "stddev": statistics.pstdev(totals) if len(totals) > 1 else 0.0,
        },
        "metrics": {
            key: {
                "mean": statistics.mean(values) if values else 0.0,
                "stddev": statistics.pstdev(values) if len(values) > 1 else 0.0,
            }
            for key, values in sorted(metric_series.items())
        },
    }

    rendered = json.dumps(benchmark, indent=2, sort_keys=True)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
