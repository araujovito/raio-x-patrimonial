"""Busca a situação atual de cada projeto de lei já salvo em public/leis/.

``prepare_leis.py`` grava id/tipo/numero/ano/ementa/uri de cada proposição,
mas a lista da API não inclui a situação de tramitação -- só o detalhe de
cada proposição (``/proposicoes/{id}``) tem isso. Este script lê os
arquivos já gerados, descobre o conjunto de proposições únicas (a mesma
proposição aparece em vários deputados quando há coautoria) e busca a
situação de cada uma, gravando de volta em cada arquivo.

Categoriza ``codSituacao`` em três grupos simplificados -- aprovada,
arquivada ou em tramitação -- porque a lista oficial tem quase 100 códigos
específicos de cada etapa interna. É uma simplificação: "arquivada" aqui
também cobre retirada pelo autor, rejeitada e vetada, e "aprovada" cobre só
quem virou norma jurídica (uma PEC aprovada mas ainda aguardando
promulgação, por exemplo, continua contando como "em tramitação").

Uso:
    python scripts/enrich_status.py
    python scripts/enrich_status.py --limit 200   # amostra rápida
"""

from __future__ import annotations

import argparse
import glob
import http.client
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
LEIS_DIR = ROOT / "public" / "leis"

BASE = "https://dadosabertos.camara.leg.br/api/v2"

APROVADA = {"1140"}  # Transformado em Norma Jurídica
ARQUIVADA = {
    "923",  # Arquivada
    "930",  # Enviada ao Arquivo
    "937",  # Vetado totalmente
    "941",  # Recusado
    "950",  # Retirado pelo(a) Autor(a)
    "1120",  # Devolvida ao(à) Autor(a)
    "1230",  # Transformado em nova proposição
    "1292",  # Perdeu a Eficácia
}


def categorize(cod_situacao: str | None) -> str:
    if cod_situacao in APROVADA:
        return "aprovada"
    if cod_situacao in ARQUIVADA:
        return "arquivada"
    return "tramitando"


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


def fetch_status(proposicao_id: int) -> tuple[int, str, str | None]:
    payload = fetch_json(f"{BASE}/proposicoes/{proposicao_id}")
    status = payload["dados"].get("statusProposicao") or {}
    cod = status.get("codSituacao")
    descricao = status.get("descricaoSituacao")
    return proposicao_id, categorize(str(cod) if cod is not None else None), descricao


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--workers", type=int, default=15)
    args = parser.parse_args()

    files = sorted(Path(f) for f in glob.glob(str(LEIS_DIR / "*.json")))
    print(f"{len(files)} arquivos de deputados.")

    proposals_by_file: dict[Path, list[dict]] = {
        f: json.loads(f.read_text(encoding="utf-8")) for f in files
    }
    unique_ids = sorted({item["id"] for items in proposals_by_file.values() for item in items})
    if args.limit:
        unique_ids = unique_ids[: args.limit]
    print(f"{len(unique_ids)} proposições únicas. Buscando situação...")

    status_by_id: dict[int, tuple[str, str | None]] = {}
    done = 0
    failed = 0
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(fetch_status, pid): pid for pid in unique_ids}
        for future in as_completed(futures):
            try:
                pid, status, descricao = future.result()
                status_by_id[pid] = (status, descricao)
            except RuntimeError:
                failed += 1
            done += 1
            if done % 1000 == 0:
                print(f"  {done}/{len(unique_ids)} ({failed} falhas)")

    print(f"Concluído: {len(status_by_id)} situações, {failed} falhas.")
    print("Gravando de volta nos arquivos dos deputados...")

    for file, proposals in proposals_by_file.items():
        changed = False
        for item in proposals:
            found = status_by_id.get(item["id"])
            if found is None:
                continue
            status, descricao = found
            item["status"] = status
            item["situacao"] = descricao
            changed = True
        if changed:
            file.write_text(
                json.dumps(proposals, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )

    print("Pronto.")


if __name__ == "__main__":
    main()
