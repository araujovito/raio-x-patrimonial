# Raio-X Patrimonial

Aplicação interativa para explorar os bens declarados ao TSE pelos 513
deputados federais eleitos em 2022 e, quando existe candidatura correspondente,
comparar as declarações de 2018 e 2022.

## O que o projeto demonstra

- ingestão e limpeza de dados públicos;
- relacionamento de registros entre eleições;
- agregação e categorização de bens;
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

O script baixa os conjuntos `consulta_cand` e `bem_candidato` de 2018 e 2022,
seleciona os candidatos a deputado federal eleitos em 2022 e gera
`app/data/deputados.json`.

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
- Ausência de comparação significa que não foi localizada candidatura
  equivalente a deputado federal em 2018.
- Crescimento ou redução não deve ser interpretado isoladamente como renda,
  irregularidade ou avaliação atual de mercado.
