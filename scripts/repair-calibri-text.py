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

Requer pypdf==6.10.0 (ambiente isolado):
  python3 -m venv .local/venv
  .local/venv/bin/pip install --require-hashes -r scripts/requirements-pdf.txt
Uso:
  .local/venv/bin/python -I scripts/repair-calibri-text.py build-map \
      --output .local/new-calibri-map.json enade-pdfs/2021/*-exam.pdf
  .local/venv/bin/python -I scripts/repair-calibri-text.py repair \
      --map data/calibri-cid-unicode.json \
      enade-pdfs/2014/enade-2014-bacharelado-exam.pdf .local/repaired/enade-2014-bacharelado-exam.pdf
"""

import argparse
import hashlib
import io
import json
import re
import sys
from pathlib import Path

import pypdf
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject

ROOT = Path(__file__).resolve().parent.parent
MAP_SHA256 = "f20d49d5a2c2f9a768d8139f7b37d36a13118744158433c3afce42a1bb5f8f05"
MAX_PDF_BYTES = 10 * 1024 * 1024


def new_output(path):
    path = Path(path)
    if path.exists() or path.is_symlink():
        raise ValueError("A saída já existe; escolha um caminho novo. Nenhum arquivo foi sobrescrito.")
    return path


def catalog_pdf(path, years, kinds):
    if not Path(path).is_file() or Path(path).stat().st_size > MAX_PDF_BYTES:
        raise ValueError("PDF ausente, irregular ou acima de 10 MiB.")
    data = Path(path).read_bytes()
    if not 5 <= len(data) <= MAX_PDF_BYTES or not data.startswith(b"%PDF-"):
        raise ValueError("PDF ausente, inválido ou acima de 10 MiB.")
    sha = hashlib.sha256(data).hexdigest()
    catalog = json.loads((ROOT / "data/official-sources.json").read_text())
    document = next((d for d in catalog["documents"] if d.get("sha256") == sha
                     and d["year"] in years and d["kind"] in kinds
                     and d.get("family", "ENADE") == "ENADE"), None)
    if document is None:
        raise ValueError("O PDF não corresponde às edições catalogadas permitidas.")
    return data, sha


def sha256(path):
    if not Path(path).is_file() or Path(path).stat().st_size > MAX_PDF_BYTES:
        raise ValueError("Arquivo ausente, irregular ou acima do limite.")
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def is_calibri_cid(font):
    name = str(font.get("/BaseFont", "")).lstrip("/").split("+")[-1]
    return (font.get("/Subtype") == "/Type0"
            and str(font.get("/Encoding")) == "/Identity-H"
            and re.fullmatch(r"Calibri(?:-(?:Bold|Italic|BoldItalic))?(?:-Identity-H)?", name))


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
    def put(code, text):
        if not 0 <= code <= 65535 or not text or len(text) > 16:
            raise ValueError("Entrada CMap inválida.")
        if code in mapping and expand(mapping[code]) != expand(text):
            raise ValueError("Mapeamentos contraditórios no CMap.")
        mapping[code] = text
    for block in re.findall(rb"beginbfchar(.*?)endbfchar", data, re.S):
        for code, text in re.findall(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block):
            put(int(code, 16), bytes.fromhex(text.decode()).decode("utf-16-be"))
    for block in re.findall(rb"beginbfrange(.*?)endbfrange", data, re.S):
        for start, end, target in re.findall(
            rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]+>|\[[^\]]*\])", block
        ):
            first, last = int(start, 16), int(end, 16)
            if not 0 <= first <= last <= 65535:
                raise ValueError("Intervalo CMap inválido.")
            if target.startswith(b"<"):
                base = int(target[1:-1], 16)
                for code in range(first, last + 1):
                    put(code, chr(base + code - first))
            else:
                values = re.findall(rb"<([0-9A-Fa-f]+)>", target)
                if len(values) != last - first + 1:
                    raise ValueError("Array CMap incompleto.")
                for code, value in zip(range(first, last + 1), values):
                    put(code, bytes.fromhex(value.decode()).decode("utf-16-be"))
    return mapping


def build_map(args):
    output = new_output(args.output)
    mapping, sources = {}, []
    for path in args.pdfs:
        data, original_sha = catalog_pdf(path, [2021], ["EXAM", "RESPONSE_STANDARD"])
        seen = set()
        for page in PdfReader(io.BytesIO(data)).pages:
            for font in fonts_in(page.get("/Resources"), seen):
                if not is_calibri_cid(font) or "/ToUnicode" not in font:
                    continue
                for code, text in parse_to_unicode(font["/ToUnicode"].get_object().get_data()).items():
                    text = expand(text)
                    if code in mapping and mapping[code] != text:
                        sys.exit(f"Conflito no CID {code}: {mapping[code]!r} x {text!r} ({path}).")
                    mapping[code] = text
        sources.append({"file": Path(path).name, "sha256": original_sha})
    if not mapping:
        raise ValueError("Nenhum glifo encontrado nas referências.")
    with output.open("x") as stream:
        stream.write(
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
    output, receipt_path = new_output(args.output), new_output(args.output + ".json")
    if output.resolve() == receipt_path.resolve():
        raise ValueError("Saída e recibo precisam de caminhos distintos.")
    if sha256(args.map) != MAP_SHA256:
        raise ValueError("O mapa Unicode não corresponde à versão fixada.")
    original, original_sha = catalog_pdf(args.input, [2014, 2017], ["EXAM"])
    data = json.loads(Path(args.map).read_text())
    mapping = {int(code): text for code, text in data["map"].items()}
    writer = PdfWriter(clone_from=PdfReader(io.BytesIO(original)))
    stream = writer._add_object(to_unicode_stream(mapping))
    fixed, seen = set(), set()
    for page in writer.pages:
        for font in fonts_in(page.get("/Resources"), seen):
            if is_calibri_cid(font) and "/ToUnicode" not in font:
                font[NameObject("/ToUnicode")] = stream
                fixed.add(str(font.get("/BaseFont")).lstrip("/"))
    if not fixed:
        sys.exit("Nenhuma fonte Calibri sem mapa encontrada; cópia não gerada.")
    buffer = io.BytesIO()
    writer.write(buffer)
    generated = buffer.getvalue()
    if sha256(args.input) != original_sha:
        raise ValueError("O original mudou durante a geração; cópia descartada.")
    receipt = {
        "schemaVersion": 1,
        "algorithm": "CALIBRI_TOUNICODE_V1",
        "generatorSha256": sha256(__file__),
        "pypdfVersion": pypdf.__version__,
        "derivedFrom": {"file": Path(args.input).name, "sha256": original_sha},
        "map": {"file": Path(args.map).name, "sha256": sha256(args.map)},
        "fixedFonts": sorted(fixed),
        "output": {"file": output.name, "sha256": hashlib.sha256(generated).hexdigest()},
        "tool": f"scripts/repair-calibri-text.py com pypdf {pypdf.__version__}",
        "purpose": "Somente extração de texto; imagem e procedência vêm do PDF original.",
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation also rejects paths occupied after the preliminary check.
    with output.open("xb") as stream:
        stream.write(generated)
    try:
        with receipt_path.open("x") as stream:
            stream.write(json.dumps(receipt, ensure_ascii=False, indent=1) + "\n")
    except Exception:
        output.unlink()
        raise
    print(f"Cópia derivada: {args.output} ({', '.join(sorted(fixed))}).")


def main():
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
    try:
        if pypdf.__version__ != "6.10.0":
            raise ValueError("Exige pypdf==6.10.0; use scripts/requirements-pdf.txt.")
        args.run(args)
    except (ValueError, OSError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
