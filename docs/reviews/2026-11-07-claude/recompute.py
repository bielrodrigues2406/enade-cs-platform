#!/usr/bin/env python3
"""Recomputações dirigidas; não representa revisão integral das 163 questões.

Entradas numéricas abaixo foram transcritas dos enunciados dos IDs nomeados.
As fórmulas são executadas aqui e comparadas ao texto da alternativa marcada
no JSON do repositório. Não usa banco, rede ou dados de estudantes.
"""
from pathlib import Path
import hashlib
import json
import math
import platform
import re
import struct
import subprocess

ROOT = Path(__file__).resolve().parents[3]
QUESTIONS = ROOT / "data/generated-questions"
by_id = {}
sources = []
for source in sorted(QUESTIONS.glob("*.json")):
    raw = source.read_bytes()
    sources.append({"file": str(source.relative_to(ROOT)), "sha256": hashlib.sha256(raw).hexdigest()})
    for question in json.loads(raw)["questions"]:
        assert question["id"] not in by_id, question["id"]
        by_id[question["id"]] = question

results = []


def verify(question_id, inputs, computation, value, formatted_option):
    question = by_id[question_id]
    answer = question["answer"]
    marked_option = question["options"]["ABCDE".index(answer)]
    passed = formatted_option == marked_option
    results.append({
        "id": question_id,
        "inputs_from_prompt": inputs,
        "computation": computation,
        "result": value,
        "formatted_result": formatted_option,
        "marked_letter": answer,
        "marked_option": marked_option,
        "matches_marked_option": passed,
    })
    assert passed, (question_id, formatted_option, marked_option)


def comma(value, places):
    return f"{value:.{places}f}".replace(".", ",")


# 1: número de múltiplos de i não maiores que n, somado para i=1..n.
n = 12
count = sum(n // i for i in range(1, n + 1))
verify("gen-alg-laco-harmonico", {"n": n}, "sum(n // i for i in range(1,n+1))", count, str(count))

# 2: altura em arestas; N(0)=1 e N(1)=2, como explicitado no enunciado.
nodes = 20
minimum_nodes = [1, 2]
while minimum_nodes[-1] <= nodes:
    minimum_nodes.append(minimum_nodes[-1] + minimum_nodes[-2] + 1)
height = max(h for h, size in enumerate(minimum_nodes) if size <= nodes)
verify("gen-alg-avl-altura-maxima", {"nodes": nodes, "N0": 1, "N1": 2}, "N(h)=N(h-1)+N(h-2)+1; max h with N(h)<=20", height, str(height))

# 3: cache direta; tamanho informado é capacidade de dados.
address_bits, cache_bytes, block_bytes = 32, 64 * 1024, 64
offset = int(math.log2(block_bytes))
index = int(math.log2(cache_bytes // block_bytes))
tag = address_bits - offset - index
verify("gen-arq-cache-endereco", {"address_bits": address_bits, "cache_bytes": cache_bytes, "block_bytes": block_bytes}, "offset=log2(block); index=log2(cache/block); tag=address-index-offset", [tag, index, offset], f"Tag de {tag} bits, índice de {index} bits e deslocamento de {offset} bits.")

# 4: mesma mistura, número de instruções e frequência de relógio.
frequencies = [0.4, 0.2, 0.3, 0.1]
before_cpi = [1, 2, 3, 4]
after_cpi = [1, 2, 2, 4]
before = sum(f * c for f, c in zip(frequencies, before_cpi))
after = sum(f * c for f, c in zip(frequencies, after_cpi))
speedup = before / after
verify("gen-arq-cpi-medio", {"frequencies": frequencies, "before_cpi": before_cpi, "after_cpi": after_cpi}, "weighted CPI before / weighted CPI after", {"before": before, "after": after, "speedup": speedup}, f"CPI de {comma(before, 1)} e ganho de cerca de {comma(speedup, 2)} vez")

# 5: empacotamento IEEE754 binary32 em ordem de rede para leitura hexadecimal.
temperature = -6.25
representation = struct.pack(">f", temperature).hex().upper()
verify("gen-arq-ieee754", {"temperature": temperature}, "struct.pack('>f', -6.25).hex().upper()", representation, representation)

# 6: classes equilibradas antes; dois grupos de mesmo tamanho e p=.75/.25.
p = 0.75
entropy_after = -p * math.log2(p) - (1 - p) * math.log2(1 - p)
gain = 1 - entropy_after
verify("gen-ia-ganho-informacao", {"before_classes": [8, 8], "groups": [[6, 2], [2, 6]]}, "H(.5)-[.5*H(.75)+.5*H(.25)]", gain, comma(gain, 3))

# 7: teto janela/RTT, sob o modelo simplificado sem perdas do enunciado.
window_bytes, rtt_seconds = 64 * 1024, 0.1
mbps = window_bytes * 8 / rtt_seconds / 1_000_000
verify("gen-red-janela-vazao", {"window_bytes": window_bytes, "rtt_seconds": rtt_seconds}, "window_bytes*8/rtt_seconds/1e6", mbps, f"{comma(mbps, 1)} Mbit/s")

# 8: RGB de24bits, sem alfa, dois quadros sem outra memória gráfica.
width, screen_height, bytes_per_pixel, buffers = 1920, 1080, 3, 2
mib = width * screen_height * bytes_per_pixel * buffers / 2**20
verify("gen-cg-framebuffer", {"width": width, "height": screen_height, "bytes_per_pixel": bytes_per_pixel, "buffers": buffers}, "width*height*bytes_per_pixel*buffers/2**20", mib, f"{comma(mib, 2)} MiB")

# 9: total menos códigos compostos só de letras.
codes = 36**4 - 26**4
verify("gen-mat-senhas-digito", {"letters": 26, "digits": 10, "length": 4, "repetition": True}, "36**4 - 26**4", codes, f"{codes:,}".replace(",", " "))

# 10: exatamente um erro entre quatro bits independentes.
probability = math.comb(4, 1) * 0.1 * 0.9**3
verify("gen-mat-binomial", {"n": 4, "p_error": 0.1, "errors": 1}, "comb(4,1)*.1*.9**3", probability, comma(probability, 4))

# 11: consulta sequencial à TLB, custo explícito do enunciado.
access_ns = 0.8 * (20 + 100) + 0.2 * (20 + 100 + 100)
verify("gen-so-tlb", {"tlb_ns": 20, "memory_ns": 100, "hit_rate": 0.8}, ".8*(20+100)+.2*(20+100+100)", access_ns, f"{access_ns:g} ns")

# 12: dados alcançados por12 ponteiros diretos +1024 do indireto simples.
block, pointer_bytes, direct_pointers = 4096, 4, 12
file_kib = (direct_pointers + block // pointer_bytes) * block // 1024
verify("gen-so-inode", {"block_bytes": block, "pointer_bytes": pointer_bytes, "direct_pointers": direct_pointers}, "(12+4096//4)*4096//1024", file_kib, f"{file_kib} KiB")

# 13: condicionado a aprovação;90 usuários da plataforma entre130 aprovados.
conditional = 90 / (90 + 40)
verify("gen-mat-condicional", {"approved_used": 90, "approved_not_used": 40}, "90/(90+40)", conditional, f"{conditional * 100:.0f}%")

# Contraexemplo da engine usada pelo campo check: $ aceita antes de LF final.
cep_question = by_id["gen-tc-regex-cep"]
cep_pattern = cep_question["options"]["ABCDE".index(cep_question["answer"])]
cep_input = "12345-678\n"
cep_match = re.search(cep_pattern, cep_input)
assert cep_match is not None
assert cep_match.end() < len(cep_input)

report = {
    "runtime": {"python": platform.python_version(), "system": platform.system()},
    "scope": "13 recomputations from prompt inputs; not an exhaustive or blind review of the163-item bank",
    "git_head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
    "checks": results,
    "passed": sum(item["matches_marked_option"] for item in results),
    "total": len(results),
    "regex_counterexample": {
        "id": cep_question["id"],
        "engine": "Python3 re.search",
        "pattern": cep_pattern,
        "input_repr": repr(cep_input),
        "accepted": cep_match is not None,
        "matched_span": list(cep_match.span()),
        "input_length": len(cep_input),
        "problem": "A quebra de linha final fica fora da correspondência, mas re.search aceita o texto.",
    },
    "sources": sources,
}
assert report["total"] == 13 and report["passed"] == 13
print(json.dumps(report, ensure_ascii=False, indent=2))
