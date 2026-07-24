"""Baixa e transforma dados públicos do TSE para o MVP do site.

O arquivo final não expõe CPF nem qualquer outro identificador pessoal usado
apenas para relacionar candidaturas entre eleições.
"""

from __future__ import annotations

import csv
import json
import re
import unicodedata
from collections import defaultdict
from decimal import Decimal
from pathlib import Path
from urllib.request import Request, urlopen
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "work" / "data"
OUTPUT = ROOT / "app" / "data" / "deputados.json"

URLS = {
    "consulta_cand_2018.zip": "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2018.zip",
    "bem_candidato_2018.zip": "https://cdn.tse.jus.br/estatistica/sead/odsele/bem_candidato/bem_candidato_2018.zip",
    "consulta_cand_2022.zip": "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2022.zip",
    "bem_candidato_2022.zip": "https://cdn.tse.jus.br/estatistica/sead/odsele/bem_candidato/bem_candidato_2022.zip",
}


def download_sources() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    for filename, url in URLS.items():
        destination = CACHE / filename
        if destination.exists():
            continue
        request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(request, timeout=120) as response, destination.open("wb") as file:
            while chunk := response.read(1024 * 1024):
                file.write(chunk)


def read_csv(year: int, dataset: str):
    archive = CACHE / f"{dataset}_{year}.zip"
    member = f"{dataset}_{year}_BRASIL.csv"
    with ZipFile(archive) as zipped, zipped.open(member) as binary:
        lines = (line.decode("latin-1") for line in binary)
        yield from csv.DictReader(lines, delimiter=";")


def money(value: str) -> Decimal:
    return Decimal(value.replace(".", "").replace(",", ".") or "0")


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    return "".join(char for char in value if not unicodedata.combining(char)).lower()


def category(description: str) -> str:
    text = normalize(description)
    rules = (
        ("Imóveis", r"apartamento|casa|terreno|predio|sala|imovel|fazenda|gleba|benfeitoria|construcao"),
        ("Veículos", r"veiculo|automovel|caminhao|motocicleta|aeronave|embarcacao"),
        ("Aplicações", r"deposito|aplicacao|poupanca|fundo|acao|credito|dinheiro|moeda|cdb|rdb"),
        ("Empresas", r"quota|quinhao|capital social|participacao societaria|empresa"),
    )
    for label, pattern in rules:
        if re.search(pattern, text):
            return label
    return "Outros"


def asset_totals(year: int):
    totals: dict[str, Decimal] = defaultdict(Decimal)
    counts: dict[str, int] = defaultdict(int)
    categories: dict[str, dict[str, Decimal]] = defaultdict(lambda: defaultdict(Decimal))

    for row in read_csv(year, "bem_candidato"):
        candidate_id = row["SQ_CANDIDATO"]
        value = money(row["VR_BEM_CANDIDATO"])
        totals[candidate_id] += value
        counts[candidate_id] += 1
        categories[candidate_id][category(row["DS_TIPO_BEM_CANDIDATO"])] += value

    return totals, counts, categories


def rounded(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01")))


def build_dataset() -> list[dict]:
    candidates_2018 = {
        row["NR_CPF_CANDIDATO"]: row
        for row in read_csv(2018, "consulta_cand")
        if row["DS_CARGO"] == "DEPUTADO FEDERAL"
    }
    elected_2022 = [
        row
        for row in read_csv(2022, "consulta_cand")
        if row["DS_CARGO"] == "DEPUTADO FEDERAL"
        and row["DS_SIT_TOT_TURNO"].startswith("ELEITO")
    ]

    totals_2018, counts_2018, categories_2018 = asset_totals(2018)
    totals_2022, counts_2022, categories_2022 = asset_totals(2022)

    result = []
    for current in elected_2022:
        previous = candidates_2018.get(current["NR_CPF_CANDIDATO"])
        current_id = current["SQ_CANDIDATO"]
        previous_id = previous["SQ_CANDIDATO"] if previous else None
        value_2022 = totals_2022[current_id]
        value_2018 = totals_2018[previous_id] if previous_id else None

        result.append(
            {
                "id": current_id,
                "name": current["NM_URNA_CANDIDATO"].title(),
                "fullName": current["NM_CANDIDATO"].title(),
                "uf": current["SG_UF"],
                "party": current["SG_PARTIDO"],
                "status": current["DS_SIT_TOT_TURNO"].title(),
                "value2022": rounded(value_2022),
                "value2018": rounded(value_2018) if value_2018 is not None else None,
                "items2022": counts_2022[current_id],
                "items2018": counts_2018[previous_id] if previous_id else None,
                "categories2022": {
                    key: rounded(value)
                    for key, value in sorted(categories_2022[current_id].items())
                },
                "categories2018": (
                    {
                        key: rounded(value)
                        for key, value in sorted(categories_2018[previous_id].items())
                    }
                    if previous_id
                    else None
                ),
            }
        )

    return sorted(result, key=lambda item: item["name"])


def main() -> None:
    download_sources()
    data = build_dataset()
    if len(data) != 513:
        raise RuntimeError(f"Esperados 513 eleitos; encontrados {len(data)}")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    comparable = sum(item["value2018"] is not None for item in data)
    print(f"{len(data)} deputados; {comparable} com candidatura correspondente em 2018")
    print(OUTPUT)


if __name__ == "__main__":
    main()
