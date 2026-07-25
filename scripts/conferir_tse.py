"""Confere a base local contra a API pública do TSE.

Para cada deputado em ``app/data/deputados.json`` consulta a ficha oficial no
sistema de Divulgação de Candidaturas do TSE (Eleição Geral Federal de 2022) e
compara:

- ``value2022``  vs  ``totalDeBens``      (patrimônio total declarado)
- ``items2022``  vs  número de bens (``bens``)
- trajetória eleitoral (``history``)  vs  ``eleicoesAnteriores``

A conferência de trajetória compara apenas a **janela de anos em comum** entre
as duas fontes. Isso é necessário porque:
- o TSE lista também eleições posteriores a 2022 (o site roda no contexto da
  eleição vigente), que estão fora do recorte de 2022 da nossa base;
- a nossa base vai mais fundo no passado (desde 2000) do que o campo
  ``eleicoesAnteriores`` costuma retornar.
Dentro da janela sobreposta, o conjunto de candidaturas (ano + cargo) deve
coincidir.

Gera um relatório em ``outputs/conferencia-513-tse.md`` com o resumo e a lista
de divergências. Não altera nenhum dado.

Uso:
    python scripts/conferir_tse.py            # confere todos os 513
    python scripts/conferir_tse.py --limit 10 # amostra rápida (smoke test)
    python scripts/conferir_tse.py --workers 8 --delay 0.1
"""

from __future__ import annotations

import argparse
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "app" / "data" / "deputados.json"
OUTPUT = ROOT / "outputs" / "conferencia-513-tse.md"

# Eleição Geral Federal de 2022 no sistema de Divulgação do TSE.
ID_ELEICAO_2022 = "2040602022"
BASE = "https://divulgacandcontas.tse.jus.br/divulga/rest/v1"

# Tolerância para comparar valores em reais (evita ruído de ponto flutuante).
TOL = 0.01


def api_url(uf: str, cand_id: str) -> str:
    return f"{BASE}/candidatura/buscar/2022/{uf}/{ID_ELEICAO_2022}/candidato/{cand_id}"


def fetch_json(url: str, retries: int = 3, timeout: int = 20) -> dict:
    """GET com cabeçalhos de navegador e algumas tentativas em caso de falha."""
    headers = {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (conferencia-raio-x-patrimonial)",
    }
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = Request(url, headers=headers)
            with urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as err:
            last_err = err
            time.sleep(0.5 * (attempt + 1))
    raise RuntimeError(f"falhou após {retries} tentativas: {last_err}")


# Recorte da base: os dados vão até a eleição de 2022.
ANO_RECORTE = 2022


def comparar_historico(history: list[dict], eleicoes_anteriores: list[dict]) -> dict:
    """Compara a trajetória na janela de anos em comum entre base e TSE.

    Retorna as candidaturas (ano, cargo) presentes só em uma das fontes dentro
    da janela sobreposta. Fora dessa janela as fontes têm coberturas diferentes
    por construção (ver docstring do módulo), então não contam como divergência.
    """
    def cargo(nome: str | None) -> str:
        # Comparação tolerante a maiúsculas/espaços (ex.: "Vice-Prefeito"
        # vs "Vice-prefeito" não é divergência real).
        return (nome or "").strip().lower()

    nossos = {(h.get("year"), cargo(h.get("office"))) for h in history if h.get("year")}
    tse = {
        (e.get("nrAno"), cargo(e.get("cargo")))
        for e in eleicoes_anteriores
        if e.get("nrAno") and e.get("nrAno") <= ANO_RECORTE
    }
    nossos = {(a, c) for (a, c) in nossos if a <= ANO_RECORTE}

    if not nossos or not tse:
        return {"ok": True, "so_base": [], "so_tse": []}

    inicio = max(min(a for a, _ in nossos), min(a for a, _ in tse))
    janela_nossos = {(a, c) for (a, c) in nossos if a >= inicio}
    janela_tse = {(a, c) for (a, c) in tse if a >= inicio}

    so_base = sorted(janela_nossos - janela_tse)
    so_tse = sorted(janela_tse - janela_nossos)
    return {"ok": not so_base and not so_tse, "so_base": so_base, "so_tse": so_tse}


def conferir_um(dep: dict, delay: float) -> dict:
    """Confere um deputado e devolve o resultado da comparação."""
    if delay:
        time.sleep(delay)
    nome = dep.get("name", "?")
    uf = dep.get("uf", "?")
    cand_id = str(dep.get("id", ""))
    our_val = dep.get("value2022") or 0
    our_items = dep.get("items2022") or 0
    try:
        j = fetch_json(api_url(uf, cand_id))
    except Exception as err:  # noqa: BLE001 - registramos e seguimos
        return {"nome": nome, "uf": uf, "id": cand_id, "status": "erro", "erro": str(err)}

    tse_val = j.get("totalDeBens") or 0
    tse_items = len(j.get("bens") or [])
    val_ok = abs(float(tse_val) - float(our_val)) < TOL
    items_ok = int(tse_items) == int(our_items)
    hist = comparar_historico(dep.get("history") or [], j.get("eleicoesAnteriores") or [])

    ok = val_ok and items_ok and hist["ok"]
    return {
        "nome": nome,
        "uf": uf,
        "id": cand_id,
        "status": "ok" if ok else "divergente",
        "our_val": our_val,
        "tse_val": tse_val,
        "val_ok": val_ok,
        "our_items": our_items,
        "tse_items": tse_items,
        "items_ok": items_ok,
        "hist_ok": hist["ok"],
        "hist_so_base": hist["so_base"],
        "hist_so_tse": hist["so_tse"],
        "nome_urna_tse": j.get("nomeUrna"),
    }


def brl(v) -> str:
    try:
        return f"R$ {float(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except (TypeError, ValueError):
        return str(v)


def gerar_relatorio(resultados: list[dict], total: int, dur: float) -> str:
    ok = [r for r in resultados if r["status"] == "ok"]
    div = [r for r in resultados if r["status"] == "divergente"]
    err = [r for r in resultados if r["status"] == "erro"]

    div_bens = [r for r in div if not r["val_ok"] or not r["items_ok"]]
    div_hist = [r for r in div if not r.get("hist_ok", True)]

    linhas = [
        "# Conferência automatizada — base local vs. TSE",
        "",
        f"Deputados conferidos: **{len(resultados)}** de {total}",
        f"Duração: {dur:.0f}s",
        "",
        "Fonte: API pública de Divulgação de Candidaturas do TSE",
        "(`/divulga/rest/v1/candidatura/buscar/2022/{UF}/2040602022/candidato/{id}`),",
        "Eleição Geral Federal de 2022.",
        "",
        "A trajetória eleitoral é comparada apenas na janela de anos em comum",
        "entre as duas fontes (ver cabeçalho do script).",
        "",
        "## Resumo",
        "",
        f"- ✅ Conferem em tudo (patrimônio, nº de bens e trajetória): **{len(ok)}**",
        f"- ⚠️ Divergentes: **{len(div)}** "
        f"(patrimônio/bens: {len(div_bens)}; trajetória: {len(div_hist)})",
        f"- ❌ Erro de consulta: **{len(err)}**",
        "",
    ]

    if div_bens:
        linhas += [
            "## Divergências de patrimônio / nº de bens",
            "",
            "| Deputado | UF | Patrimônio (base) | Patrimônio (TSE) | Nº bens (base/TSE) |",
            "|---|---|---|---|---|",
        ]
        for r in sorted(div_bens, key=lambda x: x["nome"]):
            flag_v = "" if r["val_ok"] else " ⚠️"
            flag_i = "" if r["items_ok"] else " ⚠️"
            linhas.append(
                f"| {r['nome']} | {r['uf']} | {brl(r['our_val'])} | "
                f"{brl(r['tse_val'])}{flag_v} | {r['our_items']}/{r['tse_items']}{flag_i} |"
            )
        linhas.append("")

    if div_hist:
        linhas += [
            "## Divergências de trajetória eleitoral (janela em comum)",
            "",
            "| Deputado | UF | Só na base (ano, cargo) | Só no TSE (ano, cargo) |",
            "|---|---|---|---|",
        ]
        for r in sorted(div_hist, key=lambda x: x["nome"]):
            so_b = "; ".join(f"{a}·{c}" for a, c in r["hist_so_base"]) or "—"
            so_t = "; ".join(f"{a}·{c}" for a, c in r["hist_so_tse"]) or "—"
            linhas.append(f"| {r['nome']} | {r['uf']} | {so_b} | {so_t} |")
        linhas.append("")

    if err:
        linhas += ["## Erros de consulta (rever conexão/ID)", ""]
        for r in sorted(err, key=lambda x: x["nome"]):
            linhas.append(f"- {r['nome']} ({r['uf']}, id {r['id']}): {r['erro']}")
        linhas.append("")

    if not div and not err:
        linhas += ["Nenhuma divergência encontrada. 🎉", ""]

    return "\n".join(linhas)


def main() -> None:
    parser = argparse.ArgumentParser(description="Confere a base local contra o TSE.")
    parser.add_argument("--limit", type=int, default=0, help="confere apenas os N primeiros")
    parser.add_argument("--workers", type=int, default=6, help="consultas simultâneas")
    parser.add_argument("--delay", type=float, default=0.1, help="pausa por consulta (s)")
    args = parser.parse_args()

    deputados = json.loads(DATA.read_text(encoding="utf-8"))
    total = len(deputados)
    alvo = deputados[: args.limit] if args.limit else deputados

    print(f"Conferindo {len(alvo)} de {total} deputados "
          f"(workers={args.workers}, delay={args.delay}s)...")

    inicio = time.time()
    resultados: list[dict] = []
    feitos = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futuros = {pool.submit(conferir_um, dep, args.delay): dep for dep in alvo}
        for fut in as_completed(futuros):
            resultados.append(fut.result())
            feitos += 1
            if feitos % 25 == 0 or feitos == len(alvo):
                print(f"  {feitos}/{len(alvo)}")

    dur = time.time() - inicio
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(gerar_relatorio(resultados, total, dur), encoding="utf-8")

    ok = sum(1 for r in resultados if r["status"] == "ok")
    div = sum(1 for r in resultados if r["status"] == "divergente")
    err = sum(1 for r in resultados if r["status"] == "erro")
    print(f"\nConcluído em {dur:.0f}s: {ok} ok, {div} divergentes, {err} erros.")
    print(f"Relatório: {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
