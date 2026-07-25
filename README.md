# Raio-X Patrimonial

Aplicação interativa para explorar a trajetória eleitoral e os bens declarados
ao TSE pelos 513 deputados federais eleitos em 2022. O histórico cobre
candidaturas desde 2000, e a comparação patrimonial usa a declaração anterior
mais recente disponível.

## O que o projeto demonstra

- ingestão e limpeza de dados públicos;
- relacionamento de registros entre eleições, cargos e partidos;
- agregação e categorização de bens;
- construção de linhas do tempo eleitorais;
- interface responsiva com busca, filtros e ordenação;
- documentação explícita das limitações da análise.

## Fonte dos dados

Os arquivos são baixados diretamente do
[Portal de Dados Abertos do TSE](https://dadosabertos.tse.jus.br/group/candidatos).
O script usa o CPF exclusivamente para relacionar as candidaturas durante o
processamento. O arquivo publicado não contém CPF.

## Reproduzir os dados

```bash
python scripts/prepare_data.py
```

O script baixa os conjuntos `consulta_cand` de 2000 a 2022 e
`bem_candidato` de 2006 a 2022, seleciona os candidatos a deputado federal
eleitos em 2022 e gera `app/data/deputados.json`.

## Verificar os dados contra o TSE

A base pode ser conferida automaticamente contra a API pública do sistema de
Divulgação de Candidaturas do TSE:

```bash
python scripts/conferir_tse.py
```

O script compara, para cada um dos 513 deputados, o **patrimônio total** e o
**número de bens** declarados, além da **trajetória eleitoral** (na janela de
anos em comum entre as duas fontes). Gera um relatório em
`outputs/conferencia-513-tse.md`. Use `--limit N` para uma amostra rápida.

Na última verificação, patrimônio e número de bens conferiram em **513/513**.

## Rodar o site

```bash
pnpm install
pnpm dev
```

Para validar uma versão de produção:

```bash
pnpm build
node --test tests/rendered-html.test.mjs
```

## Limitações

- Os valores foram declarados pelos próprios candidatos.
- A variação exibida é nominal e não desconta a inflação.
- Ausência de comparação significa que não foi localizada declaração anterior
  nas bases analisadas.
- Candidatura anterior não significa exercício do cargo; o resultado eleitoral
  é exibido separadamente.
- Crescimento ou redução não deve ser interpretado isoladamente como renda,
  irregularidade ou avaliação atual de mercado.
- A trajetória eleitoral pode não conter todas as candidaturas mais antigas na
  versão publicada dos dados. A verificação contra o TSE apontou candidaturas
  (sobretudo de 2012) ausentes por causa de CPFs sem zero à esquerda nos
  arquivos antigos do TSE; a correção já está em `scripts/prepare_data.py` e
  regenerar os dados preenche essas lacunas. O patrimônio de 2022 não é afetado.
