"""Baixa e transforma dados públicos do TSE para o site.

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

CANDIDATE_YEARS = tuple(range(2000, 2023, 2))
ASSET_YEARS = tuple(range(2006, 2023, 2))

URLS = {
    **{
        f"consulta_cand_{year}.zip": (
            "https://cdn.tse.jus.br/estatistica/sead/odsele/"
            f"consulta_cand/consulta_cand_{year}.zip"
        )
        for year in CANDIDATE_YEARS
    },
    **{
        f"bem_candidato_{year}.zip": (
            "https://cdn.tse.jus.br/estatistica/sead/odsele/"
            f"bem_candidato/bem_candidato_{year}.zip"
        )
        for year in ASSET_YEARS
    },
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


def cpf_key(row: dict) -> str:
    """CPF normalizado para relacionar candidaturas entre eleições.

    Alguns arquivos do TSE (por exemplo os de 2012 e 2014) gravam o
    ``NR_CPF_CANDIDATO`` sem os zeros à esquerda (10, 9 ou menos dígitos). Sem
    normalizar, o casamento por igualdade de string falha para todo candidato
    cujo CPF começa com zero, descartando candidaturas antigas legítimas.
    Preencher com zeros à esquerda até 11 dígitos reconstrói a chave correta.

    Observação: candidaturas a presidente/vice em alguns anos (ex.: 2014) têm o
    CPF ocultado como ``-1``. Essas não têm como ser relacionadas por CPF e ficam
    de fora do histórico — é uma limitação da fonte, não deste script.
    """
    return (row.get("NR_CPF_CANDIDATO") or "").strip().zfill(11)


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


def rounded(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01")))


def build_dataset() -> list[dict]:
    elected_2022 = [
        row
        for row in read_csv(2022, "consulta_cand")
        if row["DS_CARGO"] == "DEPUTADO FEDERAL"
        and row["DS_SIT_TOT_TURNO"].startswith("ELEITO")
    ]
    elected_by_cpf = {
        cpf_key(row): row
        for row in elected_2022
    }
    elected_cpfs = set(elected_by_cpf)

    histories: dict[str, list[dict]] = defaultdict(list)
    candidate_owner: dict[tuple[int, str], str] = {}

    for year in CANDIDATE_YEARS:
        for row in read_csv(year, "consulta_cand"):
            cpf = cpf_key(row)
            if cpf not in elected_cpfs:
                continue
            event = {
                "year": year,
                "candidateId": row["SQ_CANDIDATO"],
                "office": row["DS_CARGO"].title(),
                "party": row["SG_PARTIDO"],
                "uf": row["SG_UF"],
                "result": row["DS_SIT_TOT_TURNO"].title(),
                "elected": row["DS_SIT_TOT_TURNO"].startswith("ELEITO"),
            }
            histories[cpf].append(event)
            candidate_owner[(year, row["SQ_CANDIDATO"])] = cpf

    totals: dict[tuple[int, str], Decimal] = defaultdict(Decimal)
    counts: dict[tuple[int, str], int] = defaultdict(int)
    categories: dict[tuple[int, str], dict[str, Decimal]] = defaultdict(
        lambda: defaultdict(Decimal)
    )

    for year in ASSET_YEARS:
        for row in read_csv(year, "bem_candidato"):
            key = (year, row["SQ_CANDIDATO"])
            if key not in candidate_owner:
                continue
            value = money(row["VR_BEM_CANDIDATO"])
            totals[key] += value
            counts[key] += 1
            categories[key][category(row["DS_TIPO_BEM_CANDIDATO"])] += value

    for events in histories.values():
        for event in events:
            key = (event["year"], event["candidateId"])
            if event["year"] in ASSET_YEARS:
                event["assetsTotal"] = rounded(totals[key])
                event["assetItems"] = counts[key]
                event["assetCategories"] = {
                    label: rounded(value)
                    for label, value in sorted(categories[key].items())
                }
            else:
                event["assetsTotal"] = None
                event["assetItems"] = None
                event["assetCategories"] = None

    result = []
    for cpf, current in elected_by_cpf.items():
        current_id = current["SQ_CANDIDATO"]
        events = sorted(
            histories[cpf],
            key=lambda event: (event["year"], event["office"]),
            reverse=True,
        )
        prior_events = [event for event in events if event["year"] < 2022]
        prior_asset_events = [
            event
            for event in prior_events
            if event["assetsTotal"] is not None
        ]
        previous = prior_asset_events[0] if prior_asset_events else None
        federal_2018 = next(
            (
                event
                for event in events
                if event["year"] == 2018
                and event["office"] == "Deputado Federal"
            ),
            None,
        )
        current_event = next(
            event
            for event in events
            if event["year"] == 2022
            and event["candidateId"] == current_id
        )

        public_history = []
        for event in events:
            public_history.append(
                {
                    key: value
                    for key, value in event.items()
                    if key != "candidateId"
                }
            )

        result.append(
            {
                "id": current_id,
                "name": current["NM_URNA_CANDIDATO"].title(),
                "fullName": current["NM_CANDIDATO"].title(),
                "uf": current["SG_UF"],
                "party": current["SG_PARTIDO"],
                "status": current["DS_SIT_TOT_TURNO"].title(),
                "value2022": current_event["assetsTotal"],
                "items2022": current_event["assetItems"],
                "categories2022": current_event["assetCategories"],
                "value2018": federal_2018["assetsTotal"] if federal_2018 else None,
                "items2018": federal_2018["assetItems"] if federal_2018 else None,
                "categories2018": (
                    federal_2018["assetCategories"] if federal_2018 else None
                ),
                "previousYear": previous["year"] if previous else None,
                "previousOffice": previous["office"] if previous else None,
                "previousParty": previous["party"] if previous else None,
                "previousValue": previous["assetsTotal"] if previous else None,
                "previousItems": previous["assetItems"] if previous else None,
                "previousCategories": (
                    previous["assetCategories"] if previous else None
                ),
                "priorCandidacies": len(prior_events),
                "priorVictories": sum(
                    1 for event in prior_events if event["elected"]
                ),
                "history": public_history,
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
    comparable_2018 = sum(item["value2018"] is not None for item in data)
    comparable_previous = sum(item["previousValue"] is not None for item in data)
    with_history = sum(item["priorCandidacies"] > 0 for item in data)
    print(
        f"{len(data)} deputados; {comparable_2018} comparáveis com 2018; "
        f"{comparable_previous} com declaração anterior; "
        f"{with_history} com candidatura anterior"
    )
    print(OUTPUT)


if __name__ == "__main__":
    main()
