#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = ["rapidfuzz>=3.9,<4", "spacy>=3.8,<4"]
# ///
"""Grade output-quality eval assertions against captured outputs.

Input format:
  outputs.json = {"eval-id": {"text": "...", "files": ["artifact.png"]}}

Supported assertions:
  - {"type": "contains", "text": "..."}
  - {"type": "not_contains", "text": "..."}
  - {"type": "min_count", "text": "...", "count": 3}
  - {"type": "entity_present", "text": "..."}
  - {"type": "file_exists", "path": "artifact.png"}

Usage:
  uv run scripts/skill-evals/score_outputs.py --manifest skills/dataviz/evals/evals.json --outputs runs/outputs.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

import spacy
from rapidfuzz import fuzz, utils
from spacy.pipeline import EntityRuler


@dataclass(frozen=True)
class AssertionResult:
    text: str
    passed: bool
    evidence: str


FRONTMATTER_PREFIX = "---\n"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


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


def get_cases(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("evals"), list):
        return payload["evals"]
    raise ValueError("Manifest must be a list or an object with an 'evals' array")


def load_outputs(path: Path) -> dict[str, dict[str, Any]]:
    payload = read_json(path)
    if not isinstance(payload, dict):
        raise ValueError("outputs.json must be a JSON object keyed by eval id")
    normalized: dict[str, dict[str, Any]] = {}
    for key, value in payload.items():
        if isinstance(value, str):
            normalized[str(key)] = {"text": value, "files": []}
        elif isinstance(value, dict):
            normalized[str(key)] = {
                "text": str(value.get("text", "")),
                "files": list(value.get("files", [])),
            }
        else:
            raise ValueError(f"outputs entry for {key!r} must be a string or object")
    return normalized


def normalized(text: str) -> str:
    return utils.default_process(text or "") or ""


def count_occurrences(text: str, needle: str) -> int:
    return len(re.findall(re.escape(needle), text, flags=re.IGNORECASE))


def build_ruler(phrases: list[str]) -> tuple[spacy.language.Language, EntityRuler]:
    nlp = spacy.blank("en")
    ruler = nlp.add_pipe("entity_ruler")
    patterns = [{"label": "ASSERTION", "pattern": phrase} for phrase in phrases if phrase]
    ruler.add_patterns(patterns)
    return nlp, ruler


def evaluate_assertion(output_text: str, output_files: list[str], assertion: dict[str, Any], artifact_root: Path, nlp: spacy.language.Language | None = None) -> AssertionResult:
    assertion_type = assertion.get("type", "contains")
    target = str(assertion.get("text", assertion.get("path", ""))).strip()
    normalized_output = normalized(output_text)
    normalized_target = normalized(target)

    if assertion_type == "contains":
        score = fuzz.partial_ratio(normalized_target, normalized_output, processor=None)
        passed = score >= 85
        evidence = f"fuzzy={score} target={target!r}"
        return AssertionResult(text=target, passed=passed, evidence=evidence)

    if assertion_type == "not_contains":
        score = fuzz.partial_ratio(normalized_target, normalized_output, processor=None)
        passed = score < 85
        evidence = f"fuzzy={score} target={target!r}"
        return AssertionResult(text=target, passed=passed, evidence=evidence)

    if assertion_type == "min_count":
        expected = int(assertion.get("count", 1))
        actual = count_occurrences(output_text, target)
        passed = actual >= expected
        evidence = f"count={actual} expected>={expected} target={target!r}"
        return AssertionResult(text=target, passed=passed, evidence=evidence)

    if assertion_type == "entity_present":
        if nlp is None:
            nlp, _ = build_ruler([target])
        doc = nlp(output_text)
        passed = any(ent.text.lower() == target.lower() for ent in doc.ents)
        evidence = f"entities={[ent.text for ent in doc.ents]!r} target={target!r}"
        return AssertionResult(text=target, passed=passed, evidence=evidence)

    if assertion_type == "file_exists":
        candidate = target
        passed = candidate in output_files or (artifact_root / candidate).exists()
        evidence = f"files={output_files!r} target={candidate!r} root={artifact_root!s}"
        return AssertionResult(text=candidate, passed=passed, evidence=evidence)

    raise ValueError(f"Unknown assertion type: {assertion_type}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True, help="Skill eval manifest")
    parser.add_argument("--outputs", type=Path, required=True, help="JSON file of outputs keyed by eval id")
    parser.add_argument("--artifact-root", type=Path, help="Root directory for file assertions; defaults to outputs file parent")
    parser.add_argument("--output", type=Path, help="Write the graded report here")
    args = parser.parse_args()

    manifest = read_json(args.manifest)
    cases = get_cases(manifest)
    outputs = load_outputs(args.outputs)
    artifact_root = args.artifact_root or args.outputs.parent

    all_phrase_assertions = [str(assertion.get("text", "")) for case in cases for assertion in case.get("assertions", []) if isinstance(assertion, dict) and assertion.get("type") in {"contains", "not_contains", "entity_present"}]
    nlp = None
    if all_phrase_assertions:
        nlp, _ = build_ruler(all_phrase_assertions)

    graded_cases = []
    total_passed = 0
    total_assertions = 0

    for case in cases:
        eval_id = str(case.get("id"))
        output = outputs.get(eval_id, {"text": "", "files": []})
        output_text = str(output.get("text", ""))
        output_files = [str(item) for item in output.get("files", [])]
        results: list[AssertionResult] = []
        for assertion in case.get("assertions", []):
            if not isinstance(assertion, dict):
                assertion = {"type": "contains", "text": str(assertion)}
            result = evaluate_assertion(output_text, output_files, assertion, artifact_root, nlp)
            results.append(result)
            total_assertions += 1
            total_passed += int(result.passed)

        graded_cases.append(
            {
                "id": eval_id,
                "prompt": case.get("prompt", ""),
                "summary": {
                    "passed": sum(1 for item in results if item.passed),
                    "failed": sum(1 for item in results if not item.passed),
                    "total": len(results),
                    "pass_rate": (sum(1 for item in results if item.passed) / len(results)) if results else 0.0,
                },
                "assertion_results": [asdict(result) for result in results],
            }
        )

    summary = {
        "passed": total_passed,
        "failed": total_assertions - total_passed,
        "total": total_assertions,
        "pass_rate": (total_passed / total_assertions) if total_assertions else 0.0,
    }
    report = {"summary": summary, "cases": graded_cases}

    rendered = json.dumps(report, indent=2, sort_keys=True)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)

    print(json.dumps(summary, indent=2, sort_keys=True), file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
