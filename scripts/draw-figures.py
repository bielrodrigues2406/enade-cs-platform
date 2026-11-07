"""Desenha as figuras exatas das questões geradas em SVG (apps/web/public/figures/).

Uso: python3 scripts/draw-figures.py

Cada figura sai dos dados do próprio enunciado; nada aqui pode mostrar a resposta.
Cores do caderno: tinta #151e2f, azul #1649ae, papel por trás (fundo transparente).
"""
from pathlib import Path

OUT = Path("apps/web/public/figures")
INK, BLUE, MUTED, PAPER = "#151e2f", "#1649ae", "#5b6475", "#f4f3ef"
FONT = "font-family='system-ui, -apple-system, Segoe UI, Roboto, sans-serif'"


def svg(name: str, width: int, height: int, body: str, title: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.svg").write_text(
        f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {width} {height}' width='{width}' height='{height}' "
        f"role='img' {FONT}><title>{title}</title>"
        f"<defs><marker id='seta' viewBox='0 0 10 10' refX='9' refY='5' markerWidth='7' markerHeight='7' orient='auto-start-reverse'>"
        f"<path d='M0 0L10 5L0 10z' fill='{INK}'/></marker></defs>{body}</svg>\n"
    )


def text(x, y, value, size=15, color=INK, anchor="middle", weight=400):
    return f"<text x='{x}' y='{y}' font-size='{size}' fill='{color}' text-anchor='{anchor}' font-weight='{weight}' dominant-baseline='middle'>{value}</text>"


def circle(x, y, label, r=20, fill="#fff"):
    return f"<circle cx='{x}' cy='{y}' r='{r}' fill='{fill}' stroke='{INK}' stroke-width='2'/>" + text(x, y, label, 16, weight=600)


def arrow(x1, y1, x2, y2, label=None, r=22, dx=0, dy=-12):
    """Seta entre dois círculos de raio r, com rótulo (peso) no meio."""
    from math import hypot
    length = hypot(x2 - x1, y2 - y1)
    ux, uy = (x2 - x1) / length, (y2 - y1) / length
    sx, sy, ex, ey = x1 + ux * r, y1 + uy * r, x2 - ux * r, y2 - uy * r
    line = f"<line x1='{sx:.1f}' y1='{sy:.1f}' x2='{ex:.1f}' y2='{ey:.1f}' stroke='{INK}' stroke-width='2' marker-end='url(#seta)'/>"
    if label is None:
        return line
    mx, my = (sx + ex) / 2 + dx, (sy + ey) / 2 + dy
    return line + f"<rect x='{mx - 11}' y='{my - 11}' width='22' height='22' rx='4' fill='{PAPER}'/>" + text(mx, my, label, 15, BLUE, weight=700)


def dijkstra():
    pos = {"A": (60, 160), "B": (220, 60), "C": (220, 260), "D": (380, 160), "E": (540, 160)}
    edges = [("A", "B", 4, 0, -12), ("A", "C", 1, -12, 0), ("C", "B", 2, 14, 0), ("B", "D", 1, 12, -6),
             ("C", "D", 5, 12, 8), ("D", "E", 3, 0, -14), ("B", "E", 6, 0, -14)]
    body = "".join(arrow(*pos[a], *pos[b], str(w), dx=dx, dy=dy) for a, b, w, dx, dy in edges)
    body += "".join(circle(x, y, n) for n, (x, y) in pos.items())
    svg("gen-alg-dijkstra-ordem", 600, 320, body, "Grafo dirigido com pesos em minutos")


def heap():
    values = [50, 30, 40, 10, 20, 35]
    cells = "".join(
        f"<rect x='{40 + i * 60}' y='30' width='60' height='40' fill='#fff' stroke='{INK}' stroke-width='2'/>"
        + text(70 + i * 60, 50, v, 17, weight=600) + text(70 + i * 60, 86, i, 13, MUTED)
        for i, v in enumerate(values))
    pos = [(250, 140), (150, 210), (350, 210), (100, 280), (200, 280), (300, 280)]
    lines = "".join(f"<line x1='{pos[(i - 1) // 2][0]}' y1='{pos[(i - 1) // 2][1]}' x2='{x}' y2='{y}' stroke='{INK}' stroke-width='2'/>"
                    for i, (x, y) in enumerate(pos) if i)
    nodes = "".join(circle(x, y, values[i]) for i, (x, y) in enumerate(pos))
    caption = text(470, 50, "vetor", 14, MUTED, "start") + text(470, 86, "índice", 13, MUTED, "start") + text(470, 210, "árvore", 14, MUTED, "start")
    svg("gen-alg-heap-insercao", 560, 310, cells + lines + nodes + caption, "Heap de máximo como vetor e como árvore")


def abb():
    keys = ["1", "2", "3", "4", "…", "n"]
    pos = [(60 + i * 80, 40 + i * 50) for i in range(len(keys))]
    body = "".join(arrow(*pos[i], *pos[i + 1], r=20) for i in range(len(keys) - 1))
    body += "".join(circle(x, y, k) for k, (x, y) in zip(keys, pos))
    svg("gen-alg-abb-degenerada", 520, 330, body, "Árvore após inserir 1, 2, 3, …, n em ordem")


def mux():
    body = f"<path d='M200 40 L320 80 L320 240 L200 280 Z' fill='#fff' stroke='{INK}' stroke-width='2'/>"
    body += text(260, 160, "MUX 4×1", 16, weight=700)
    for i in range(4):
        y = 80 + i * 53
        body += f"<line x1='110' y1='{y}' x2='200' y2='{y}' stroke='{INK}' stroke-width='2'/>" + text(100, y, f"I{i} = ?", 15, BLUE, "end", 700)
        body += text(214, y, f"I{i}", 12, MUTED, "start")
    body += f"<line x1='320' y1='160' x2='420' y2='160' stroke='{INK}' stroke-width='2' marker-end='url(#seta)'/>" + text(440, 160, "F", 17, weight=700)
    for x, s, v in [(228, "S1", "A"), (302, "S0", "B")]:
        # A borda inferior do trapézio desce de (320, 240) a (200, 280).
        top = 280 - (x - 200) / 3
        body += f"<line x1='{x}' y1='310' x2='{x}' y2='{top:.0f}' stroke='{INK}' stroke-width='2'/>" + text(x, 326, f"{s} = {v}", 14, weight=600)
    svg("gen-arq-mux-xor", 480, 340, body, "Multiplexador 4×1 com A em S1 e B em S0")


def pipeline():
    stages = ["IF", "ID", "EX", "MEM", "WB"]
    rows = ["ADD R1, R2, R3", "SUB R4, R1, R5", "BEQ R4, R0, fim"]
    body = "".join(text(200 + c * 56, 24, c + 1, 13, MUTED) for c in range(7)) + text(20, 24, "ciclo", 13, MUTED, "start")
    for r, name in enumerate(rows):
        y = 60 + r * 46
        body += text(20, y, name, 14, INK, "start", 600)
        for s, stage in enumerate(stages):
            x = 172 + (r + s) * 56
            body += f"<rect x='{x}' y='{y - 16}' width='54' height='32' rx='4' fill='#fff' stroke='{INK}' stroke-width='1.5'/>" + text(x + 27, y, stage, 13)
    svg("gen-arq-pipeline-conflitos", 600, 190, body, "Pipeline ideal de 5 estágios com três instruções")


def broadcast():
    body = f"<rect x='250' y='130' width='100' height='40' rx='6' fill='#fff' stroke='{INK}' stroke-width='2'/>" + text(300, 150, "switch", 15, weight=600)
    groups = [("laboratório (40)", 80), ("secretaria", 520)]
    for label, cx in groups:
        for k in range(3):
            x, y = cx - 50 + k * 50, 260
            body += f"<line x1='{x}' y1='{y - 18}' x2='300' y2='170' stroke='{MUTED}' stroke-width='1.5'/>"
            body += f"<rect x='{x - 18}' y='{y - 18}' width='36' height='28' rx='3' fill='#fff' stroke='{INK}' stroke-width='2'/>"
        body += text(cx, 300, label, 14)
    body += f"<path d='M120 100 Q300 50 480 100' fill='none' stroke='{BLUE}' stroke-width='2.5' stroke-dasharray='6 5' marker-end='url(#seta)'/>"
    body += text(300, 30, "broadcast do laboratório chega à secretaria", 14, BLUE, weight=600)
    svg("gen-red-dominio-broadcast", 600, 320, body, "Laboratório e secretaria ligados ao mesmo switch")


def parity():
    body = f"<line x1='40' y1='130' x2='108' y2='130' stroke='{INK}' stroke-width='2' marker-end='url(#seta)'/>" + text(40, 112, "início", 12, MUTED, "start")
    body += circle(150, 130, "par", 40) + f"<circle cx='150' cy='130' r='34' fill='none' stroke='{INK}' stroke-width='2'/>"
    body += circle(390, 130, "ímpar", 40)
    body += f"<path d='M188 112 Q270 60 352 112' fill='none' stroke='{INK}' stroke-width='2' marker-end='url(#seta)'/>" + text(270, 72, "1", 16, BLUE, weight=700)
    body += f"<path d='M352 148 Q270 200 188 148' fill='none' stroke='{INK}' stroke-width='2' marker-end='url(#seta)'/>" + text(270, 190, "1", 16, BLUE, weight=700)
    body += f"<path d='M130 94 C110 40 190 40 170 94' fill='none' stroke='{INK}' stroke-width='2' marker-end='url(#seta)'/>" + text(150, 36, "0", 16, BLUE, weight=700)
    body += f"<path d='M370 94 C350 40 430 40 410 94' fill='none' stroke='{INK}' stroke-width='2' marker-end='url(#seta)'/>" + text(390, 36, "0", 16, BLUE, weight=700)
    svg("gen-tc-paridade-uns", 480, 230, body, "Autômato de dois estados, par e ímpar")


def median():
    grid = [[10, 12, 11], [255, 13, 0], [12, 11, 10]]
    body = ""
    for r, row in enumerate(grid):
        for c, v in enumerate(row):
            shade = 255 - int(v * 0.85)
            fill = f"rgb({shade},{shade},{shade})"
            color = "#fff" if v > 150 else INK
            body += f"<rect x='{40 + c * 70}' y='{30 + r * 70}' width='70' height='70' fill='{fill}' stroke='{INK}' stroke-width='{3 if (r, c) == (1, 1) else 1.5}'/>"
            body += text(75 + c * 70, 65 + r * 70, v, 18, color, weight=600)
    body += text(145, 262, "o pixel central aparece com borda mais grossa", 13, MUTED)
    svg("gen-cg-mediana", 290, 280, body, "Vizinhança 3 × 3 em tons de cinza")


def contrast():
    gray = "#777777"
    body = "<rect x='0' y='0' width='520' height='170' fill='#ffffff'/>"
    body += text(30, 46, "Texto de corpo do portal, 16 px", 16, gray, "start")
    body += text(30, 100, "Título da página, 24 px", 24, gray, "start", 700)
    body += text(30, 148, "as duas amostras usam #777777 sobre #FFFFFF", 12, MUTED, "start")
    svg("gen-ihc-contraste-wcag", 520, 170, body, "Duas amostras de texto cinza sobre branco")


def bars(name, title, series, maximum, unit="%"):
    body, x = "", 70
    body += f"<line x1='50' y1='250' x2='560' y2='250' stroke='{INK}' stroke-width='1.5'/>"
    for group, values in series:
        for k, (label, value) in enumerate(values):
            h = value / maximum * 190
            fill = BLUE if k else "#9fb3dc"
            body += f"<rect x='{x}' y='{250 - h:.1f}' width='54' height='{h:.1f}' fill='{fill}'/>" + text(x + 27, 238 - h, f"{value}{unit}", 14, weight=600)
            body += text(x + 27, 266, label, 12, MUTED)
            x += 62
        body += text(x - 93, 290, group, 14, weight=600)
        x += 60
    svg(name, 600, 310, body, title)


def pyramid():
    body = ""
    data = [("hoje", [("60 anos ou mais", 15), ("15 a 59", 60), ("0 a 14", 25)], 150),
            ("projeção", [("60 anos ou mais", 30), ("15 a 59", 55), ("0 a 14", 15)], 440)]
    for title, groups, cx in data:
        body += text(cx, 26, title, 15, weight=700)
        for i, (label, share) in enumerate(groups):
            w = share * 3.4
            y = 50 + i * 62
            body += f"<rect x='{cx - w / 2:.1f}' y='{y}' width='{w:.1f}' height='48' fill='{BLUE if i == 0 else '#9fb3dc'}'/>"
            body += text(cx, y + 24, f"{share}%", 15, "#fff" if i == 0 else INK, weight=700)
            body += text(cx, y + 58, label, 11, MUTED) if False else ""
    for i, label in enumerate(["60 anos ou mais", "15 a 59 anos", "0 a 14 anos"]):
        body += text(295, 74 + i * 62, label, 12, MUTED)
    body += text(295, 250, "dados ilustrativos", 12, MUTED)
    svg("gen-fg-envelhecimento", 590, 265, body, "Distribuição por idade hoje e projetada")


def income():
    body = ""
    rows = [("população", [("40% mais pobres", 40, "#9fb3dc"), ("50% do meio", 50, "#d9dee8"), ("10% mais ricos", 10, BLUE)]),
            ("renda", [("40% mais pobres", 10, "#9fb3dc"), ("50% do meio", 50, "#d9dee8"), ("10% mais ricos", 40, BLUE)])]
    for r, (label, parts) in enumerate(rows):
        y, x = 50 + r * 90, 120
        body += text(110, y + 22, label, 14, INK, "end", 700)
        for name, share, fill in parts:
            w = share * 4.4
            body += f"<rect x='{x}' y='{y}' width='{w}' height='44' fill='{fill}' stroke='#fff' stroke-width='2'/>"
            body += text(x + w / 2, y + 22, f"{share}%", 14, "#fff" if fill == BLUE else INK, weight=700)
            x += w
    legend = [("40% mais pobres", "#9fb3dc"), ("50% do meio", "#d9dee8"), ("10% mais ricos", BLUE)]
    for i, (name, fill) in enumerate(legend):
        body += f"<rect x='{120 + i * 150}' y='240' width='14' height='14' fill='{fill}'/>" + text(140 + i * 150, 247, name, 12, MUTED, "start")
    body += text(330, 280, "dados ilustrativos", 12, MUTED)
    svg("gen-fg-concentracao-renda", 600, 295, body, "Fatias da população e da renda")


if __name__ == "__main__":
    dijkstra(); heap(); abb(); mux(); pipeline(); broadcast(); parity(); median(); contrast(); pyramid(); income()
    bars("gen-fg-pontos-percentuais", "Domicílios com acesso à internet, 2019 e 2025",
         [("Região A", [("2019", 60), ("2025", 75)]), ("Região B", [("2019", 40), ("2025", 58)])], 100)
