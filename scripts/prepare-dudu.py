"""Gera os WebPs do Dudu (poses e camadas articuladas) a partir dos PNGs originais.

Uso: python3 scripts/prepare-dudu.py <pasta-dos-pngs>

Os 24 PNGs de 1024x1536 (base, 9 camadas, 14 poses) ficam fora do Git; o
SHA-256 de cada um vai para design/mascot/v2/provenance.json. Ver docs/MASCOT.md.
"""
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

OUT = Path("apps/web/public/mascot")
# Palco das camadas no canvas de origem (x0, y0, x1, y1): 3:4, com folga para as asas.
STAGE = (40, 160, 984, 1418)
STAGE_SIZE = (384, 512)
# Olhos gerados separadamente: deslocamento medido contra os olhos abertos da base.
EYE_SHIFT = {"camada-olhos-fechados": (-11, -40), "camada-olhos-felizes": (-5, 0)}
LAYERS = {
    "camada-pe-esquerdo": "foot-left", "camada-pe-direito": "foot-right",
    "camada-asa-esquerda": "wing-left", "camada-asa-direita": "wing-right",
    "camada-corpo": "body", "camada-cabeca": "head",
    "camada-olhos-abertos": "eyes-open", "camada-olhos-fechados": "eyes-closed",
    "camada-olhos-felizes": "eyes-happy",
}
POSE_HEIGHT = 480


def load(path: Path) -> Image.Image:
    """Zera o alfa residual (<24) que o gerador deixa espalhado pela tela."""
    image = Image.open(path).convert("RGBA")
    image.putalpha(image.getchannel("A").point(lambda v: 0 if v < 24 else v))
    return image


def shifted(image: Image.Image, dx: int, dy: int) -> Image.Image:
    canvas = Image.new("RGBA", image.size, (0, 0, 0, 0))
    canvas.paste(image, (dx, dy), image)
    return canvas


def stage(image: Image.Image) -> Image.Image:
    return image.crop(STAGE).resize(STAGE_SIZE, Image.LANCZOS)


def save(image: Image.Image, name: str, quality: int = 88) -> None:
    image.save(OUT / name, "WEBP", quality=quality, alpha_quality=90, method=6)


def layers(src: Path) -> None:
    (OUT / "articulated").mkdir(parents=True, exist_ok=True)
    parts = {}
    for source, name in LAYERS.items():
        image = load(src / f"{source}.png")
        image = shifted(image, *EYE_SHIFT.get(source, (0, 0)))
        parts[name] = image
        save(stage(image), f"articulated/{name}.webp")
    # Repouso pré-montado: mesma imagem do primeiro quadro, para a troca não aparecer.
    for eyes in ("open", "happy"):
        rest = Image.new("RGBA", parts["body"].size, (0, 0, 0, 0))
        for name in ("foot-left", "foot-right", "wing-left", "wing-right", "body", "head", f"eyes-{eyes}"):
            rest = Image.alpha_composite(rest, parts[name])
        save(stage(rest), f"articulated/rest-{eyes}.webp")


def poses(src: Path) -> None:
    for path in sorted(src.glob("pose-*.png")):
        image = load(path)
        image = image.crop(image.getchannel("A").getbbox())
        pad = round(image.height * 0.025)
        canvas = Image.new("RGBA", (image.width + 2 * pad, image.height + 2 * pad), (0, 0, 0, 0))
        canvas.paste(image, (pad, pad), image)
        width = round(canvas.width * POSE_HEIGHT / canvas.height)
        save(canvas.resize((width, POSE_HEIGHT), Image.LANCZOS), path.stem.removeprefix("pose-") + ".webp", 86)


def provenance(src: Path) -> None:
    files = sorted(src.glob("*.png"))
    record = {
        "received": "DUDU-01-BASE-E-CAMADAS.zip e DUDU-02-POSES.zip, enviados por Gabriel em 07/11/2026",
        "generator": "GPT Image, prompts de docs/DUDU-REQUESTS.md",
        "stage": {"crop": STAGE, "size": STAGE_SIZE},
        "eyeShift": EYE_SHIFT,
        "sources": {f.name: hashlib.sha256(f.read_bytes()).hexdigest() for f in files},
    }
    target = Path("design/mascot/v2/provenance.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(record, ensure_ascii=False, indent=1) + "\n")


if __name__ == "__main__":
    source = Path(sys.argv[1])
    layers(source)
    poses(source)
    provenance(source)
