#!/usr/bin/env python3
"""
LTM CLI — Long-Term Memory operations for ComicCanvas Studio.

Commands:
  selftest       Verify directory structure and exit 0 on success.
  capture-turn   Append a turn event to ltm/store/events.jsonl.
"""

import json
import sys
import os
from datetime import datetime, timezone
from pathlib import Path

# Resolve ltm/ root relative to this script (ltm/bin/ltm.py → ltm/)
LTM_ROOT = Path(__file__).resolve().parent.parent

REQUIRED_FILES = [
    LTM_ROOT / "store" / "events.jsonl",
    LTM_ROOT / "store" / "checkpoints.jsonl",
    LTM_ROOT / "store" / "sessions.jsonl",
    LTM_ROOT / "store" / "open_threads.jsonl",
    LTM_ROOT / "runtime" / "active-context.json",
    LTM_ROOT / "runtime" / "last-recall.md",
    LTM_ROOT / "runtime" / "current-session.json",
    LTM_ROOT / "runtime" / "health.json",
]


def cmd_selftest() -> int:
    missing = [str(f) for f in REQUIRED_FILES if not f.exists()]
    if missing:
        print("FAIL — missing files:", file=sys.stderr)
        for m in missing:
            print(f"  {m}", file=sys.stderr)
        return 1
    print("OK — LTM structure intact")
    return 0


def cmd_capture_turn(args: list[str]) -> int:
    """
    Usage: ltm.py capture-turn --role <role> --content <content> [--session <id>]
    Appends a JSON line to ltm/store/events.jsonl.
    Secrets must NOT be passed via --content.
    """
    role = None
    content = None
    session_id = None

    i = 0
    while i < len(args):
        if args[i] == "--role" and i + 1 < len(args):
            role = args[i + 1]; i += 2
        elif args[i] == "--content" and i + 1 < len(args):
            content = args[i + 1]; i += 2
        elif args[i] == "--session" and i + 1 < len(args):
            session_id = args[i + 1]; i += 2
        else:
            i += 1

    if not role or not content:
        print("Usage: ltm.py capture-turn --role <role> --content <content>", file=sys.stderr)
        return 1

    event = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "type": "turn",
        "role": role,
        "content": content,
        **({"sessionId": session_id} if session_id else {}),
    }

    events_path = LTM_ROOT / "store" / "events.jsonl"
    with events_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event, ensure_ascii=False) + "\n")

    return 0


def main() -> None:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(0)

    command = args[0]
    rest = args[1:]

    if command == "selftest":
        sys.exit(cmd_selftest())
    elif command == "capture-turn":
        sys.exit(cmd_capture_turn(rest))
    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
