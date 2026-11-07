"""Formata data/generated-questions/*.json: 2 espaços e listas curtas numa linha só."""
import json
import re
import sys
from pathlib import Path

INNER = re.compile(r"\[\s*\n\s*((?:\"(?:[^\"\\]|\\.)*\"|[-\d.]+|true|false)(?:,\s*\n\s*(?:\"(?:[^\"\\]|\\.)*\"|[-\d.]+|true|false))*)\s*\n\s*\]")


def short(joined: str, original: str) -> str:
    """Só junta listas que cabem numa linha curta; alternativas longas ficam uma por linha."""
    return joined if len(joined) <= 110 else original


def compact(text: str) -> str:
    """Junta numa linha as listas sem objetos dentro (conceitos, combinações)."""
    while True:
        joined = INNER.sub(lambda m: short("[" + re.sub(r",\s*\n\s*", ", ", m.group(1)) + "]", m.group(0)), text)
        joined = re.sub(r"\[\s*\n\s*((?:\[[^\[\]\n]*\](?:,\s*\n\s*)?)+)\s*\n\s*\]",
                        lambda m: short("[" + re.sub(r",\s*\n\s*", ", ", m.group(1)) + "]", m.group(0)), joined)
        if joined == text:
            return text
        text = joined


for path in sys.argv[1:] or sorted(Path("data/generated-questions").glob("*.json")):
    path = Path(path)
    data = json.loads(path.read_text())
    path.write_text(compact(json.dumps(data, ensure_ascii=False, indent=2)) + "\n")
