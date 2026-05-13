#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Inventory skills and derive a coarse eval priority.

Usage:
  uv run scripts/skill-evals/inventory.py --skills-dir skills
  uv run scripts/skill-evals/inventory.py --skills-dir skills --format table
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable


SKILL_TYPE_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("browser", ("playwright", "browser automation", "browser interactions", "snapshot", "trace", "route")),
    ("dataviz", ("dataviz", "chart", "dashboard", "visualization", "graph", "plot", "visual encoding")),
    ("planning", ("feature planning", "plan new features", "acceptance criteria", "non-goals", "dependency direction")),
    ("implementation", ("test-driven development", "red-green-refactor", "tdd")),
    ("audit", ("audit", "findings", "risk", "vulnerability", "coverage", "reconciliation")),
    ("design", ("frontend", "ui", "layout", "visual consistency", "accessibility", "component-driven")),
    ("exploration", ("explore codebase", "codebase recon", "module dependencies")),
    ("tooling", ("pre-commit", "workflow", "setup", "tooling")),
]

OUTPUT_TYPE_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("browser_action", ("playwright", "browser automation", "browser interactions", "snapshot", "route")),
    ("code", ("script", "bash", "python", "command")),
    ("mixed", ("dashboard", "chart", "plan", "audit", "test")),
]

PRIORITY_RULES: dict[str, int] = {
    "dataviz": 95,
    "planning": 90,
    "implementation": 88,
    "audit": 87,
    "browser": 86,
    "design": 80,
    "exploration": 75,
    "tooling": 72,
}


@dataclass(frozen=True)
class InventoryRow:
    name: str
    path: str
    description: str
    skill_type: str
    output_type: str
    eval_priority: int


FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)


def parse_frontmatter(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8")
    match = FRONTMATTER_RE.match(text)
    if not match:
        raise ValueError(f"{path}: missing YAML frontmatter")
    frontmatter: dict[str, str] = {}
    for raw_line in match.group(1).splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        key, value = line.split(":", 1)
        frontmatter[key.strip()] = value.strip().strip('"').strip("'")
    return frontmatter


def infer_from_text(text: str, rules: Iterable[tuple[str, tuple[str, ...]]], default: str) -> str:
    lowered = text.lower()
    for label, keywords in rules:
        if any(keyword in lowered for keyword in keywords):
            return label
    return default


def infer_skill_type(name: str, description: str, body: str) -> str:
    lowered_name = name.lower()
    if lowered_name == "dataviz":
        return "dataviz"
    if "playwright" in lowered_name:
        return "browser"
    if lowered_name == "tdd":
        return "implementation"
    if lowered_name.endswith("-audit"):
        return "audit"
    if "feature-planning" in lowered_name:
        return "planning"
    if "design" in lowered_name:
        return "design"
    if lowered_name == "explore-codebase":
        return "exploration"
    if lowered_name == "setup-pre-commit":
        return "tooling"
    if lowered_name == "grill-me":
        return "interview"
    text = f"{description}\n{body}"
    return infer_from_text(text, SKILL_TYPE_RULES, "general")


def infer_output_type(name: str, description: str, body: str) -> str:
    lowered_name = name.lower()
    if "playwright" in lowered_name:
        return "browser_action"
    if lowered_name in {"dataviz", "software-feature-planning", "tdd", "software-design-audit"}:
        return "mixed"
    if lowered_name.endswith("-audit") or lowered_name in {"explore-codebase", "grill-me", "setup-pre-commit"}:
        return "text"
    text = f"{description}\n{body}"
    return infer_from_text(text, OUTPUT_TYPE_RULES, "text")


def infer_priority(skill_type: str, description: str) -> int:
    base = PRIORITY_RULES.get(skill_type, 60)
    if any(word in description.lower() for word in ("evaluation", "eval", "trigger", "output quality")):
        base += 2
    return min(base, 100)


def load_inventory(skills_dir: Path) -> list[InventoryRow]:
    rows: list[InventoryRow] = []
    for skill_md in sorted(skills_dir.glob("*/SKILL.md")):
        frontmatter = parse_frontmatter(skill_md)
        body = skill_md.read_text(encoding="utf-8").split("---", 2)[-1]
        name = frontmatter.get("name", skill_md.parent.name)
        description = frontmatter.get("description", "")
        skill_type = infer_skill_type(name, description, body)
        output_type = infer_output_type(name, description, body)
        rows.append(
            InventoryRow(
                name=name,
                path=str(skill_md.parent),
                description=description,
                skill_type=skill_type,
                output_type=output_type,
                eval_priority=infer_priority(skill_type, description),
            )
        )
    return rows


def print_table(rows: list[InventoryRow]) -> None:
    headers = ["name", "skill_type", "output_type", "eval_priority", "description"]
    widths = {h: len(h) for h in headers}
    for row in rows:
        payload = asdict(row)
        for key in headers:
            widths[key] = max(widths[key], len(str(payload[key])))
    print(" | ".join(key.ljust(widths[key]) for key in headers))
    print("-+-".join("-" * widths[key] for key in headers))
    for row in rows:
        payload = asdict(row)
        print(" | ".join(str(payload[key]).ljust(widths[key]) for key in headers))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skills-dir", type=Path, default=Path("skills"), help="Skills root directory")
    parser.add_argument("--format", choices=("json", "table"), default="json", help="Output format")
    args = parser.parse_args()

    rows = load_inventory(args.skills_dir)
    rows.sort(key=lambda row: (-row.eval_priority, row.name))

    if args.format == "table":
        print_table(rows)
        return 0

    print(json.dumps([asdict(row) for row in rows], indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
