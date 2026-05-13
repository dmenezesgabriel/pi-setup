#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = ["rapidfuzz>=3.9,<4", "scikit-learn>=1.5,<2"]
# ///
"""Score trigger evals and generate local diagnostics.

Input run format: JSON array or JSONL, with objects like:
  {"id": "trigger-01", "prompt": "...", "should_trigger": true, "triggered": false}

Usage:
  uv run scripts/skill-evals/score_triggers.py --manifest skills/dataviz/evals/evals.json --runs runs.json
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

from rapidfuzz import fuzz, utils
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


@dataclass(frozen=True)
class CaseScore:
    id: str
    prompt: str
    should_trigger: bool
    triggered: bool
    fuzzy_score: float
    tfidf_score: float
    passed: bool


FRONTMATTER_PREFIX = "---\n"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def read_json_lines(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return []
    if text.lstrip().startswith("["):
        payload = json.loads(text)
        if not isinstance(payload, list):
            raise ValueError("JSON input must be a list of run objects")
        return payload
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def parse_frontmatter(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith(FRONTMATTER_PREFIX):
        raise ValueError(f"{path}: missing YAML frontmatter")
    end = text.find("\n---\n", len(FRONTMATTER_PREFIX))
    if end == -1:
        raise ValueError(f"{path}: unterminated YAML frontmatter")
    block = text[len(FRONTMATTER_PREFIX):end]
    frontmatter: dict[str, str] = {}
    for raw_line in block.splitlines():
        if ":" not in raw_line:
            continue
        key, value = raw_line.split(":", 1)
        frontmatter[key.strip()] = value.strip().strip('"').strip("'")
    return frontmatter


def load_skill_description(manifest_path: Path, skill_dir: Path | None) -> str:
    if skill_dir is None:
        skill_dir = manifest_path.parent.parent
    skill_md = skill_dir / "SKILL.md"
    frontmatter = parse_frontmatter(skill_md)
    return frontmatter.get("description", "")


def get_cases(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        cases = payload
    elif isinstance(payload, dict) and isinstance(payload.get("evals"), list):
        cases = payload["evals"]
    else:
        raise ValueError("Manifest must be a list or an object with an 'evals' array")
    trigger_cases = [case for case in cases if case.get("kind") == "trigger" or "should_trigger" in case]
    return trigger_cases


def pair_runs(cases: list[dict[str, Any]], runs: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    if runs is None:
        return [dict(case) for case in cases]
    run_map: dict[str, dict[str, Any]] = {}
    for run in runs:
        run_id = str(run.get("id"))
        if not run_id or run_id == "None":
            raise ValueError("Each run must include a non-empty 'id'")
        if run_id in run_map:
            raise ValueError(f"Duplicate run id: {run_id}")
        run_map[run_id] = run

    case_ids = {str(case.get("id")) for case in cases}
    missing = [case_id for case_id in case_ids if case_id not in run_map]
    extra = [run_id for run_id in run_map if run_id not in case_ids]
    if missing:
        raise ValueError(f"Missing runs for case ids: {missing}")
    if extra:
        raise ValueError(f"Unexpected run ids: {extra}")

    paired: list[dict[str, Any]] = []
    for case in cases:
        run = run_map[str(case.get("id"))]
        merged = dict(case)
        merged.update({k: v for k, v in run.items() if k not in {"id"}})
        paired.append(merged)
    return paired


def compute_scores(description: str, prompts: list[str]) -> tuple[list[float], list[float]]:
    if not prompts:
        return [], []
    docs = [description] + prompts
    vectorizer = TfidfVectorizer(lowercase=True, stop_words="english", ngram_range=(1, 2))
    matrix = vectorizer.fit_transform(docs)
    cosine = cosine_similarity(matrix[0:1], matrix[1:]).ravel().tolist()
    fuzzy = [fuzz.token_set_ratio(description, prompt, processor=utils.default_process) / 100.0 for prompt in prompts]
    return fuzzy, cosine


def summarize(case_scores: list[CaseScore]) -> dict[str, Any]:
    tp = sum(1 for score in case_scores if score.should_trigger and score.triggered)
    fp = sum(1 for score in case_scores if not score.should_trigger and score.triggered)
    tn = sum(1 for score in case_scores if not score.should_trigger and not score.triggered)
    fn = sum(1 for score in case_scores if score.should_trigger and not score.triggered)
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    accuracy = (tp + tn) / len(case_scores) if case_scores else 0.0
    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "accuracy": accuracy,
        "true_positives": tp,
        "false_positives": fp,
        "true_negatives": tn,
        "false_negatives": fn,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True, help="Skill eval manifest")
    parser.add_argument("--runs", type=Path, required=True, help="JSON or JSONL file of actual trigger results")
    parser.add_argument("--skill-dir", type=Path, help="Skill directory; defaults to manifest parent")
    parser.add_argument("--output", type=Path, help="Write a JSON report here")
    args = parser.parse_args()

    payload = read_json(args.manifest)
    cases = get_cases(payload)
    runs = read_json_lines(args.runs) if args.runs else None
    paired = pair_runs(cases, runs)
    description = load_skill_description(args.manifest, args.skill_dir)

    prompts = [str(case.get("prompt", "")) for case in paired]
    fuzzy_scores, tfidf_scores = compute_scores(description, prompts)

    scored_cases: list[CaseScore] = []
    for index, case in enumerate(paired):
        triggered = bool(case.get("triggered", False))
        should_trigger = bool(case.get("should_trigger", False))
        passed = triggered == should_trigger
        scored_cases.append(
            CaseScore(
                id=str(case.get("id", index)),
                prompt=str(case.get("prompt", "")),
                should_trigger=should_trigger,
                triggered=triggered,
                fuzzy_score=round(fuzzy_scores[index], 4) if index < len(fuzzy_scores) else 0.0,
                tfidf_score=round(tfidf_scores[index], 4) if index < len(tfidf_scores) else 0.0,
                passed=passed,
            )
        )

    summary = summarize(scored_cases)
    false_positives = [asdict(score) for score in scored_cases if not score.should_trigger and score.triggered]
    false_negatives = [asdict(score) for score in scored_cases if score.should_trigger and not score.triggered]
    hard_cases = sorted(scored_cases, key=lambda item: (item.fuzzy_score + item.tfidf_score) / 2, reverse=True)

    report = {
        "skill_description": description,
        "summary": summary,
        "cases": [asdict(score) for score in scored_cases],
        "false_positives": false_positives,
        "false_negatives": false_negatives,
        "top_semantic_matches": [asdict(score) for score in hard_cases[: min(10, len(hard_cases))]],
    }

    rendered = json.dumps(report, indent=2, sort_keys=True)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)

    print(
        json.dumps(
            {"f1": summary["f1"], "precision": summary["precision"], "recall": summary["recall"]},
            indent=2,
            sort_keys=True,
        ),
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
