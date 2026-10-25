"""Gera um resumo agregado dos projetos de lei, para a página /leis.

Lê todos os arquivos de public/leis/ (que juntos passam de 20 MB, grandes
demais para carregar no navegador de uma vez -- ver o comentário em
DeputyProfile.tsx) e produz um único JSON pequeno, sem ementas, com:

- totais nacionais (projetos, por status);
- contagem por ano;
- ranking dos deputados com mais projetos (id, nome, uf, partido, total),
  para linkar direto à página de cada um.

Uso:
    python scripts/resumir_leis.py
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEIS_DIR = ROOT / "public" / "leis"
DEPUTADOS = ROOT / "app" / "data" / "deputados-2022.json"
OUTPUT = ROOT / "app" / "data" / "leis-resumo.json"

TOP_N = 20


def main() -> None:
    deputies = {d["id"]: d for d in json.loads(DEPUTADOS.read_text(encoding="utf-8"))}

    total_projetos = 0
    por_status: Counter[str] = Counter()
    por_ano: Counter[int] = Counter()
    por_deputado: list[dict] = []

    for file in sorted(LEIS_DIR.glob("*.json")):
        tse_id = file.stem
        proposals = json.loads(file.read_text(encoding="utf-8"))
        if not proposals:
            continue

        total_projetos += len(proposals)
        for item in proposals:
            por_status[item.get("status", "tramitando")] += 1
            por_ano[item["ano"]] += 1

        deputy = deputies.get(tse_id)
        if deputy:
            por_deputado.append(
                {
                    "id": tse_id,
                    "name": deputy["name"],
                    "uf": deputy["uf"],
                    "party": deputy["party"],
                    "total": len(proposals),
                }
            )

    por_deputado.sort(key=lambda item: item["total"], reverse=True)

    resumo = {
        "totalProjetos": total_projetos,
        "deputadosComDados": sum(1 for v in por_deputado if v["total"] > 0),
        "porStatus": {
            "aprovada": por_status.get("aprovada", 0),
            "tramitando": por_status.get("tramitando", 0),
            "arquivada": por_status.get("arquivada", 0),
        },
        "porAno": sorted(por_ano.items(), key=lambda item: item[0], reverse=True),
        "topAutores": por_deputado[:TOP_N],
    }

    OUTPUT.write_text(
        json.dumps(resumo, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(
        f"{total_projetos} projetos, {resumo['deputadosComDados']} deputados com dados."
    )
    print(OUTPUT)


if __name__ == "__main__":
    main()
