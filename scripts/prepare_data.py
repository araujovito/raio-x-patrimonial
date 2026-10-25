"""Baixa e transforma dados públicos do TSE para o site.

O arquivo final não expõe CPF nem qualquer outro identificador pessoal usado
apenas para relacionar candidaturas entre eleições.
"""

from __future__ import annotations

import csv
import json
import re
import unicodedata
from collections import Counter, defaultdict
from decimal import Decimal
from pathlib import Path
from urllib.request import Request, urlopen
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "work" / "data"
DATA_DIR = ROOT / "app" / "data"

# Eleições gerais cujos eleitos para Deputado Federal o site exibe. Cada uma
# vira um par de arquivos: deputados-<ano>.json e diversidade-<ano>.json.
LEGISLATURE_YEARS = (2022, 2026)

# Cadeiras por estado, fixadas por lei (LC 78/1993, atualizada pela LC 161/2018)
# e iguais em 2022 e 2026. Serve como conferência independente do resultado:
# se um arquivo do TSE vier com um estado sem resultado apurado (como o
# Maranhão em 2022), a contagem por UF não fecha.
SEATS_BY_UF = {
    "AC": 8, "AL": 9, "AM": 8, "AP": 8, "BA": 39, "CE": 22, "DF": 8, "ES": 10,
    "GO": 17, "MA": 18, "MG": 53, "MS": 8, "MT": 8, "PA": 17, "PB": 12,
    "PE": 25, "PI": 10, "PR": 30, "RJ": 46, "RN": 8, "RO": 8, "RR": 8,
    "RS": 31, "SC": 16, "SE": 8, "SP": 70, "TO": 8,
}

# IBGE/TSE tratam "negro" como a soma de pretos e pardos, categoria
# amplamente usada em análises de representatividade racial no Brasil.
NEGRO_RACES = {"PRETA", "PARDA"}

CANDIDATE_YEARS = tuple(range(2000, 2027, 2))
ASSET_YEARS = tuple(range(2006, 2027, 2))
PENDING_RESULT_LABEL = "Candidatura Registrada (Aguardando Eleição)"

# No arquivo do TSE, as candidaturas a cargo proporcional (Deputado Federal e
# Estadual) no Maranhão em 2022 estão marcadas como "#NULO" -- sem resultado
# apurado -- enquanto cargos majoritários do mesmo estado (Senador,
# Governador) aparecem normalmente. A distribuição de cadeiras proporcionais
# do MA em 2022 teve disputa judicial sobre o rateio entre coligações, e esse
# arquivo nunca recebeu a situação final. Sem correção, os 18 deputados
# federais do Maranhão desaparecem inteiros da base -- foi o que causava a
# maior parte da diferença de 513 para 495 eleitos.
#
# A composição atual da Câmara (fonte independente do TSE) permite identificar
# quem ocupa essas 18 cadeiras; o cruzamento com a candidatura de 2022 (que tem
# o CPF) é feito pelo nome de urna. Dois nomes têm grafia diferente entre as
# fontes.
MARANHAO_CAMARA_NAME_OVERRIDES = {
    "duarte jr.": "duarte",
    "rubens pereira junior": "rubens pereira jr",
}
RECONCILED_RESULT_LABEL = "Eleito (Fonte: Composição Atual Da Câmara Dos Deputados)"

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
    value = "".join(char for char in value if not unicodedata.combining(char)).lower()
    return re.sub(r"\s+", " ", value).strip()


def fetch_camara_uf_deputies(uf: str) -> list[str]:
    url = f"https://dadosabertos.camara.leg.br/api/v2/deputados?siglaUf={uf}&itens=100"
    request = Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    with urlopen(request, timeout=60) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return [item["nome"] for item in payload["dados"]]


def reconcile_maranhao(rows_2022: list[dict]) -> set[str]:
    """CPFs dos deputados federais do MA cuja candidatura de 2022 não tem
    resultado apurado no TSE (ver comentário de MARANHAO_CAMARA_NAME_OVERRIDES).
    """
    by_name = {
        normalize(row["NM_URNA_CANDIDATO"]): row
        for row in rows_2022
        if row["DS_CARGO"] == "DEPUTADO FEDERAL" and row["SG_UF"] == "MA"
    }

    cpfs = set()
    for camara_name in fetch_camara_uf_deputies("MA"):
        key = normalize(camara_name)
        key = MARANHAO_CAMARA_NAME_OVERRIDES.get(key, key)
        row = by_name.get(key)
        if row is None:
            raise RuntimeError(
                f"Não encontrei a candidatura de 2022 no TSE para "
                f"{camara_name!r} (MA) -- confira MARANHAO_CAMARA_NAME_OVERRIDES."
            )
        cpfs.add(cpf_key(row))
    return cpfs


def reconciled_result(row: dict, year: int, reconciled_cpfs: set[str]) -> str | None:
    # A reconciliação do Maranhão vale só para a eleição de 2022.
    if (
        year == 2022
        and row["DS_SIT_TOT_TURNO"] == "#NULO"
        and cpf_key(row) in reconciled_cpfs
    ):
        return RECONCILED_RESULT_LABEL
    return None


def category(description: str) -> str:
    text = normalize(description)
    # Os tipos oficiais do TSE (DS_TIPO_BEM_CANDIDATO) vêm muitas vezes no
    # plural ("Ações", "Outros bens imóveis", "Outras aplicações",
    # "participações societárias"). Por isso usamos radicais (ex.: "imove",
    # "aplicac", "participac") que casam singular e plural, evitando que grandes
    # montantes caiam indevidamente em "Outros". Empresas é avaliado antes de
    # Aplicações porque "participacoes" contém "acoes".
    rules = (
        ("Imóveis", r"apartament|casa|terreno|predio|sala|imove|fazenda|gleba|benfeitoria|construc|terra nua|loja|galpao|sitio|chacara|rural|garagem"),
        ("Veículos", r"veiculo|automove|caminha|motocicleta|aeronave|embarca|barco|lancha"),
        ("Empresas", r"quota|quinha|capital social|participac|empresa|firma|estabeleciment"),
        ("Aplicações", r"deposito|aplicac|poupanca|fundo|acoes|credito|dinheiro|moeda|cdb|rdb|vgbl|pgbl|previdencia|capitalizac|ouro|investiment|tesouro|renda fixa"),
    )
    for label, pattern in rules:
        if re.search(pattern, text):
            return label
    return "Outros"


def rounded(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01")))


def reconciled_cpfs_for(election_year: int, rows: list[dict]) -> set[str]:
    """Reconciliação do Maranhão, só enquanto o arquivo do TSE precisar dela.

    Em 2025 o arquivo de 2022 trazia o MA inteiro como "#NULO". O TSE já
    corrigiu isso: se houver qualquer eleito proporcional do MA no arquivo, a
    composição atual da Câmara não entra, porque ela inclui suplentes em
    exercício e deixa de fora quem se elegeu e saiu (ver Hildo Rocha e Roseana
    Sarney), e a contagem passaria de 18 para 19.
    """
    if election_year != 2022:
        return set()
    ma_resolved = any(
        row["DS_CARGO"] == "DEPUTADO FEDERAL"
        and row["SG_UF"] == "MA"
        and row["DS_SIT_TOT_TURNO"].startswith("ELEITO")
        for row in rows
    )
    return set() if ma_resolved else reconcile_maranhao(rows)


def build_dataset(election_year: int) -> list[dict]:
    rows_current = list(read_csv(election_year, "consulta_cand"))
    reconciled_cpfs = reconciled_cpfs_for(election_year, rows_current)

    elected_current = [
        row
        for row in rows_current
        if row["DS_CARGO"] == "DEPUTADO FEDERAL"
        and (
            row["DS_SIT_TOT_TURNO"].startswith("ELEITO")
            or cpf_key(row) in reconciled_cpfs
        )
    ]
    elected_by_cpf = {
        cpf_key(row): row
        for row in elected_current
    }
    elected_cpfs = set(elected_by_cpf)

    histories: dict[str, list[dict]] = defaultdict(list)
    candidate_owner: dict[tuple[int, str], str] = {}

    for year in CANDIDATE_YEARS:
        if year > election_year:
            continue
        for row in read_csv(year, "consulta_cand"):
            cpf = cpf_key(row)
            if cpf not in elected_cpfs:
                continue
            situation = row["DS_SIT_TOT_TURNO"]
            reconciled = reconciled_result(row, year, reconciled_cpfs)
            event = {
                "year": year,
                "candidateId": row["SQ_CANDIDATO"],
                "office": row["DS_CARGO"].title(),
                "party": row["SG_PARTIDO"],
                "uf": row["SG_UF"],
                "result": (
                    reconciled
                    if reconciled
                    else PENDING_RESULT_LABEL
                    if situation == "#NULO"
                    else situation.title()
                ),
                "elected": reconciled is not None or situation.startswith("ELEITO"),
            }
            histories[cpf].append(event)
            candidate_owner[(year, row["SQ_CANDIDATO"])] = cpf

    totals: dict[tuple[int, str], Decimal] = defaultdict(Decimal)
    counts: dict[tuple[int, str], int] = defaultdict(int)
    categories: dict[tuple[int, str], dict[str, Decimal]] = defaultdict(
        lambda: defaultdict(Decimal)
    )

    for year in ASSET_YEARS:
        if year > election_year:
            continue
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
        prior_events = [event for event in events if event["year"] < election_year]
        prior_asset_events = [
            event
            for event in prior_events
            if event["assetsTotal"] is not None
        ]
        previous = prior_asset_events[0] if prior_asset_events else None
        current_event = next(
            event
            for event in events
            if event["year"] == election_year
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
                "status": (
                    reconciled_result(current, election_year, reconciled_cpfs)
                    or current["DS_SIT_TOT_TURNO"].title()
                ),
                "gender": current["DS_GENERO"].title(),
                "race": current["DS_COR_RACA"].title(),
                "electionYear": election_year,
                "value": current_event["assetsTotal"],
                "items": current_event["assetItems"],
                "categories": current_event["assetCategories"],
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


def summarize_diversity(rows: list[dict], reconciled_cpfs: set[str]) -> dict:
    elected = [
        row
        for row in rows
        if row["DS_SIT_TOT_TURNO"].startswith("ELEITO")
        or cpf_key(row) in reconciled_cpfs
    ]

    def women(subset: list[dict]) -> int:
        return sum(1 for row in subset if row["DS_GENERO"] == "FEMININO")

    def negros(subset: list[dict]) -> int:
        return sum(1 for row in subset if row["DS_COR_RACA"] in NEGRO_RACES)

    return {
        "candidates": len(rows),
        "elected": len(elected),
        "womenCandidates": women(rows),
        "womenElected": women(elected),
        "negroCandidates": negros(rows),
        "negroElected": negros(elected),
        "genderCandidates": dict(Counter(row["DS_GENERO"].title() for row in rows)),
        "genderElected": dict(Counter(row["DS_GENERO"].title() for row in elected)),
        "raceCandidates": dict(Counter(row["DS_COR_RACA"].title() for row in rows)),
        "raceElected": dict(Counter(row["DS_COR_RACA"].title() for row in elected)),
    }


def build_diversity(election_year: int) -> dict:
    rows_current = list(read_csv(election_year, "consulta_cand"))
    reconciled_cpfs = reconciled_cpfs_for(election_year, rows_current)
    rows = [row for row in rows_current if row["DS_CARGO"] == "DEPUTADO FEDERAL"]
    by_state: dict[str, list[dict]] = defaultdict(list)
    by_party: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        by_state[row["SG_UF"]].append(row)
        by_party[row["SG_PARTIDO"]].append(row)

    return {
        "national": summarize_diversity(rows, reconciled_cpfs),
        "byState": {
            uf: summarize_diversity(state_rows, reconciled_cpfs)
            for uf, state_rows in sorted(by_state.items())
        },
        "byParty": {
            party: summarize_diversity(party_rows, reconciled_cpfs)
            for party, party_rows in sorted(by_party.items())
        },
    }


def check_seats(data: list[dict]) -> list[str]:
    """Estados cuja contagem de eleitos difere das cadeiras previstas em lei."""
    elected = Counter(item["uf"] for item in data)
    return [
        f"{uf}: {elected.get(uf, 0)} eleitos, {seats} cadeiras"
        for uf, seats in SEATS_BY_UF.items()
        if elected.get(uf, 0) != seats
    ]


def main() -> None:
    download_sources()
    for election_year in LEGISLATURE_YEARS:
        data = build_dataset(election_year)
        mismatches = check_seats(data)
        if len(data) != 513 or mismatches:
            print(
                f"Aviso ({election_year}): {len(data)} deputados na base, não "
                "513. Divergências por estado: "
                + ("; ".join(mismatches) or "nenhuma")
                + ". Outro estado pode ter candidatura proporcional sem "
                "resultado apurado no arquivo do TSE (ver reconcile_maranhao)."
            )
        output = DATA_DIR / f"deputados-{election_year}.json"
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(
            json.dumps(data, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        comparable_previous = sum(item["previousValue"] is not None for item in data)
        with_history = sum(item["priorCandidacies"] > 0 for item in data)
        print(
            f"{election_year}: {len(data)} deputados; {comparable_previous} com "
            f"declaração anterior; {with_history} com candidatura anterior"
        )
        print(output)

        diversity = build_diversity(election_year)
        diversity_output = DATA_DIR / f"diversidade-{election_year}.json"
        diversity_output.write_text(
            json.dumps(diversity, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        national = diversity["national"]
        print(
            f"Diversidade {election_year}: {national['womenElected']}/"
            f"{national['elected']} mulheres eleitas "
            f"({national['womenCandidates']}/{national['candidates']} "
            f"candidatas); {national['negroElected']}/{national['elected']} "
            f"negros eleitos ({national['negroCandidates']}/"
            f"{national['candidates']} candidatos)"
        )
        print(diversity_output)


if __name__ == "__main__":
    main()
