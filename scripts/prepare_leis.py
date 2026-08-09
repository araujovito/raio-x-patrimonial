"""Busca os projetos de lei apresentados por cada deputado na Câmara.

A base de patrimônio (``app/data/deputados.json``) usa o identificador do TSE
(``SQ_CANDIDATO``), que não existe na API da Câmara -- e casar pelo nome de
urna falha para muitos deputados (apelidos e nomes de urna diferentes do
nome usado pela Câmara: "Duarte Jr." vs. "Duarte", "Gleisi" vs. o nome
completo, etc.). Em vez disso, os dois lados são cruzados pelo **CPF**: o
candidato de 2022 no TSE e o parlamentar em exercício na Câmara são a mesma
pessoa física. O CPF é usado só durante o processamento, nunca é gravado no
JSON publicado -- a mesma regra que já vale para ``prepare_data.py``.

Gera um arquivo por deputado em ``public/leis/<id do TSE>.json``: ``[ {id,
tipo, numero, ano, ementa, uri}, ... ]``, mais recentes primeiro. Um arquivo
por deputado (em vez de um único JSON com todo mundo) porque o conjunto
completo passa de 20 MB com as ementas -- grande demais para embutir no
carregamento de qualquer página; o site busca só o arquivo do deputado
aberto no momento, como já faz com as fotos em ``public/deputados/``.

Uso:
    python scripts/prepare_leis.py
    python scripts/prepare_leis.py --limit 10   # amostra rápida
"""

from __future__ import annotations

import argparse
import http.client
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from prepare_data import cpf_key, download_sources, read_csv

ROOT = Path(__file__).resolve().parents[1]
DEPUTADOS = ROOT / "app" / "data" / "deputados.json"
OUTPUT_DIR = ROOT / "public" / "leis"

BASE = "https://dadosabertos.camara.leg.br/api/v2"
TIPOS = ("PL", "PLP", "PEC")

UFS = (
    "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR "
    "RS SC SE SP TO"
).split()


def fetch_json(url: str, retries: int = 3, timeout: int = 20) -> dict:
    headers = {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (raio-x-patrimonial)",
    }
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            request = Request(url, headers=headers)
            with urlopen(request, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except (
            HTTPError,
            URLError,
            TimeoutError,
            http.client.IncompleteRead,
            ConnectionError,
        ) as error:
            last_error = error
            time.sleep(0.5 * (attempt + 1))
    raise RuntimeError(f"Falha ao buscar {url}: {last_error}")


def sq_candidato_to_cpf() -> dict[str, str]:
    """SQ_CANDIDATO (o "id" usado em deputados.json) -> CPF normalizado."""
    rows = (
        row
        for row in read_csv(2022, "consulta_cand")
        if row["DS_CARGO"] == "DEPUTADO FEDERAL"
    )
    return {row["SQ_CANDIDATO"]: cpf_key(row) for row in rows}


def fetch_camara_ids() -> list[int]:
    ids: list[int] = []
    for uf in UFS:
        payload = fetch_json(f"{BASE}/deputados?siglaUf={uf}&itens=100")
        ids.extend(item["id"] for item in payload["dados"])
    return ids


def fetch_camara_cpf(camara_id: int) -> tuple[int, str | None]:
    try:
        payload = fetch_json(f"{BASE}/deputados/{camara_id}")
        cpf = payload["dados"].get("cpf")
        return camara_id, cpf_key({"NR_CPF_CANDIDATO": cpf}) if cpf else None
    except RuntimeError:
        return camara_id, None


def match_camara_ids(deputies: list[dict], workers: int) -> dict[str, int]:
    print("Buscando composição atual da Câmara por estado...")
    camara_ids = fetch_camara_ids()

    print(f"Buscando CPF de {len(camara_ids)} parlamentares...")
    cpf_to_camara: dict[str, int] = {}
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(fetch_camara_cpf, cid) for cid in camara_ids]
        for future in as_completed(futures):
            camara_id, cpf = future.result()
            if cpf:
                cpf_to_camara[cpf] = camara_id

    print("Cruzando com o CPF de 2022 do TSE...")
    sq_to_cpf = sq_candidato_to_cpf()

    matched: dict[str, int] = {}
    unmatched: list[dict] = []
    for deputy in deputies:
        cpf = sq_to_cpf.get(deputy["id"])
        camara_id = cpf_to_camara.get(cpf) if cpf else None
        if camara_id is None:
            unmatched.append(deputy)
            continue
        matched[deputy["id"]] = camara_id

    if unmatched:
        print(f"Não encontrados na Câmara ({len(unmatched)}):")
        for deputy in unmatched:
            print(f"  {deputy['name']!r} ({deputy['party']}-{deputy['uf']})")

    return matched


def fetch_proposicoes(camara_id: int) -> list[dict]:
    proposals: list[dict] = []
    url = (
        f"{BASE}/proposicoes?idDeputadoAutor={camara_id}&itens=100"
        f"&ordem=DESC&ordenarPor=id"
        + "".join(f"&siglaTipo={tipo}" for tipo in TIPOS)
    )
    while url:
        payload = fetch_json(url)
        for item in payload["dados"]:
            proposals.append(
                {
                    "id": item["id"],
                    "tipo": item["siglaTipo"],
                    "numero": item["numero"],
                    "ano": item["ano"],
                    "ementa": item["ementa"],
                    "uri": f"https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao={item['id']}",
                }
            )
        next_link = next(
            (link["href"] for link in payload.get("links", []) if link["rel"] == "next"),
            None,
        )
        url = next_link
    return proposals


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--workers", type=int, default=10)
    args = parser.parse_args()

    download_sources()
    deputies = json.loads(DEPUTADOS.read_text(encoding="utf-8"))
    if args.limit:
        deputies = deputies[: args.limit]

    id_map = match_camara_ids(deputies, args.workers)
    print(f"{len(id_map)}/{len(deputies)} casados por CPF.")

    print("Buscando projetos de lei (PL, PLP, PEC) por deputado...")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    total_projects = 0
    done = 0
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(fetch_proposicoes, camara_id): tse_id
            for tse_id, camara_id in id_map.items()
        }
        failed: list[str] = []
        for future in as_completed(futures):
            tse_id = futures[future]
            try:
                proposals = future.result()
            except RuntimeError as error:
                failed.append(tse_id)
                print(f"  falhou {tse_id}: {error}")
                continue
            total_projects += len(proposals)
            (OUTPUT_DIR / f"{tse_id}.json").write_text(
                json.dumps(proposals, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )
            done += 1
            if done % 50 == 0:
                print(f"  {done}/{len(id_map)}")

        if failed:
            print(f"{len(failed)} deputados falharam após as tentativas: {failed}")

    print(f"{total_projects} projetos em {len(id_map)} deputados.")
    print(OUTPUT_DIR)


if __name__ == "__main__":
    main()
