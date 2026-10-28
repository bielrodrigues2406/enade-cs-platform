"""Recupera o texto das provas de 2014 e 2017 cuja fonte Calibri não traz mapa Unicode.

Nessas provas a Calibri está embutida como CID (Identity-H) sem /ToUnicode, e a
extração devolve o número do glifo no lugar da letra ("ĂƉĞŶĂƐ" = "apenas"). Os
PDFs de 2021 usam a mesma Calibri com /ToUnicode correto; a numeração de glifos
é a mesma (258 = "a", 393 = "p"). Este script:

  build-map  lê PDFs de referência e grava o mapa CID -> Unicode com a origem;
  repair     grava uma CÓPIA DERIVADA do PDF com esse mapa nas fontes Calibri
             que não o têm, mais um recibo JSON. O PDF original não é alterado.

A cópia derivada serve só para extrair texto. Imagem, página e procedência
continuam vindo do PDF original arquivado. Glifos ausentes do mapa (código em
fonte própria, símbolos) continuam ilegíveis e o extrator os sinaliza.

Requer pypdf==6.1.1 (ambiente isolado):
  python3 -m venv .local/venv && .local/venv/bin/pip install pypdf==6.1.1
Uso:
  .local/venv/bin/python -I scripts/repair-calibri-text.py build-map \
      --output data/calibri-cid-unicode.json enade-pdfs/2021/*-exam.pdf
  .local/venv/bin/python -I scripts/repair-calibri-text.py repair \
      --map data/calibri-cid-unicode.json \
      enade-pdfs/2014/enade-2014-bacharelado-exam.pdf .local/repaired/enade-2014-bacharelado-exam.pdf
"""

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

import pypdf
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def is_calibri_cid(font):
    name = str(font.get("/BaseFont", "")).lstrip("/").split("+")[-1]
    return font.get("/Subtype") == "/Type0" and name.startswith("Calibri")


def fonts_in(resources, seen):
    """Fontes da página e dos formulários (XObject) aninhados."""
    if resources is None:
        return
    resources = resources.get_object()
    if id(resources) in seen:
        return
    seen.add(id(resources))
    for ref in resources.get("/Font", {}).values():
        yield ref.get_object()
    for ref in resources.get("/XObject", {}).values():
        xobject = ref.get_object()
        if xobject.get("/Subtype") == "/Form":
            yield from fonts_in(xobject.get("/Resources"), seen)


LIGATURES = {"\ufb00": "ff", "\ufb01": "fi", "\ufb02": "fl", "\ufb03": "ffi", "\ufb04": "ffl"}


def expand(text):
    """O mesmo glifo aparece como "ﬁ" ou "fi" conforme o PDF; usa a forma expandida."""
    return "".join(LIGATURES.get(char, char) for char in text)


def parse_to_unicode(data):
    mapping = {}
    for block in re.findall(rb"beginbfchar(.*?)endbfchar", data, re.S):
        for code, text in re.findall(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block):
            mapping[int(code, 16)] = bytes.fromhex(text.decode()).decode("utf-16-be")
    for block in re.findall(rb"beginbfrange(.*?)endbfrange", data, re.S):
        for start, end, target in re.findall(
            rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]+>|\[[^\]]*\])", block
        ):
            first, last = int(start, 16), int(end, 16)
            if target.startswith(b"<"):
                base = int(target[1:-1], 16)
                for code in range(first, last + 1):
                    mapping[code] = chr(base + code - first)
            else:
                values = re.findall(rb"<([0-9A-Fa-f]+)>", target)
                for code, value in zip(range(first, last + 1), values):
                    mapping[code] = bytes.fromhex(value.decode()).decode("utf-16-be")
    return mapping


def build_map(args):
    mapping, sources = {}, []
    for path in args.pdfs:
        seen = set()
        for page in PdfReader(path).pages:
            for font in fonts_in(page.get("/Resources"), seen):
                if not is_calibri_cid(font) or "/ToUnicode" not in font:
                    continue
                for code, text in parse_to_unicode(font["/ToUnicode"].get_object().get_data()).items():
                    text = expand(text)
                    if code in mapping and mapping[code] != text:
                        sys.exit(f"Conflito no CID {code}: {mapping[code]!r} x {text!r} ({path}).")
                    mapping[code] = text
        sources.append({"file": Path(path).name, "sha256": sha256(path)})
    Path(args.output).write_text(
        json.dumps(
            {
                "description": "CID da Calibri -> Unicode, extraído do /ToUnicode de PDFs de referência",
                "sources": sources,
                "map": {str(code): mapping[code] for code in sorted(mapping)},
            },
            ensure_ascii=False,
            indent=1,
        )
        + "\n"
    )
    print(f"{len(mapping)} glifos mapeados a partir de {len(sources)} PDFs.")


def to_unicode_stream(mapping):
    lines = [
        "/CIDInit /ProcSet findresource begin", "12 dict begin", "begincmap",
        "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
        "/CMapName /Adobe-Identity-UCS def", "/CMapType 2 def",
        "1 begincodespacerange", "<0000> <FFFF>", "endcodespacerange",
    ]
    items = sorted(mapping.items())
    for i in range(0, len(items), 100):
        chunk = items[i : i + 100]
        lines.append(f"{len(chunk)} beginbfchar")
        lines += [f"<{code:04X}> <{text.encode('utf-16-be').hex().upper()}>" for code, text in chunk]
        lines.append("endbfchar")
    lines += ["endcmap", "CMapName currentdict /CMap defineresource pop", "end", "end"]
    stream = DecodedStreamObject()
    stream.set_data("\n".join(lines).encode())
    return stream


def repair(args):
    data = json.loads(Path(args.map).read_text())
    mapping = {int(code): text for code, text in data["map"].items()}
    writer = PdfWriter(clone_from=PdfReader(args.input))
    stream = writer._add_object(to_unicode_stream(mapping))
    fixed, seen = set(), set()
    for page in writer.pages:
        for font in fonts_in(page.get("/Resources"), seen):
            if is_calibri_cid(font) and "/ToUnicode" not in font:
                font[NameObject("/ToUnicode")] = stream
                fixed.add(str(font.get("/BaseFont")).lstrip("/"))
    if not fixed:
        sys.exit("Nenhuma fonte Calibri sem mapa encontrada; cópia não gerada.")
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    writer.write(args.output)
    receipt = {
        "derivedFrom": {"file": Path(args.input).name, "sha256": sha256(args.input)},
        "map": {"file": Path(args.map).name, "sha256": sha256(args.map)},
        "fixedFonts": sorted(fixed),
        "output": {"file": Path(args.output).name, "sha256": sha256(args.output)},
        "tool": f"scripts/repair-calibri-text.py com pypdf {pypdf.__version__}",
        "purpose": "Somente extração de texto; imagem e procedência vêm do PDF original.",
    }
    Path(args.output + ".json").write_text(json.dumps(receipt, ensure_ascii=False, indent=1) + "\n")
    print(f"Cópia derivada: {args.output} ({', '.join(sorted(fixed))}).")


parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
commands = parser.add_subparsers(dest="command", required=True)
build = commands.add_parser("build-map")
build.add_argument("--output", required=True)
build.add_argument("pdfs", nargs="+")
build.set_defaults(run=build_map)
fix = commands.add_parser("repair")
fix.add_argument("--map", required=True)
fix.add_argument("input")
fix.add_argument("output")
fix.set_defaults(run=repair)
args = parser.parse_args()
args.run(args)
