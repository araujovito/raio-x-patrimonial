# Roteiro de próximos passos

Estado em 25/10/2026: eleitos de 2022 e de 2026 no ar no código (seletor,
`/eleicao/2022`, `/diversidade/<ano>`, `/comparacao`), 54 testes passando.
Commits `d3c726d` e `4e872ba` ainda não foram enviados ao GitHub.

Esforço: P (menos de 1 h), M (algumas horas), G (um dia ou mais).

## 1. Fechar o que já está feito

| # | Passo | Esforço | Depende de |
|---|---|---|---|
| 1 | Enviar os 2 commits (`git push origin main`) | P | confirmação do Vitor |
| 2 | Rodar `pnpm dev` e olhar `/`, `/eleicao/2022`, `/diversidade`, `/comparacao` no celular e no desktop (seletor de eleição e tabelas só foram checados pelo HTML) | P | — |
| 3 | Publicar na Cloudflare (`pnpm deploy`) e conferir o endereço público | P | passos 1 e 2; credencial da Cloudflare |

## 2. Fechar as lacunas dos eleitos de 2026

| # | Passo | Esforço | Depende de |
|---|---|---|---|
| 4 | Descobrir o código da eleição de 2026 no sistema Divulgação do TSE (abrir uma ficha de candidato no navegador e ler a rota, como foi feito para 2022) | P | acesso ao site do TSE por navegador; a API recusa consulta daqui |
| 5 | Preencher `TSE_ID_ELEICAO[2026]` em `app/lib/deputados.ts`. Isso liga o botão "Ficha no TSE" e o teste que hoje exige `null` precisa ser trocado | P | passo 4 |
| 6 | Parametrizar `scripts/conferir_tse.py` por ano e rodar para 2026; atualizar os selos do README | M | passos 4 e 5; API acessível |
| 7 | Baixar as fotos oficiais de 2026 para `public/deputados/` (ids de 2026 não repetem os de 2022) | M | passo 4; ver `docs/COMO-CAPTURAR.md` |
| 8 | Entender os 7 eleitos de 2026 sem bens no arquivo `bem_candidato_2026` (ausência real ou arquivo incompleto) e, se for do arquivo, rerodar mais tarde | P | — |
| 9 | Conferir os maiores saltos da `/comparacao` (ex.: Neto Carletto, de R$ 591,7 mil para R$ 34,3 mi) contra a ficha oficial. Se algum for erro de digitação do candidato, documentar na página | M | passos 4 e 6 |

## 3. Qualidade e manutenção

| # | Passo | Esforço | Depende de |
|---|---|---|---|
| 10 | CI no GitHub Actions: lint, testes e build a cada push (`npm run lint`, `npm run test`) | P | passo 11 |
| 11 | Resolver o erro de lint em `ProjetosDeLei.tsx` (setState em efeito) e os 5 avisos, para a CI não nascer vermelha | P | — |
| 12 | Resolver os 3 erros de `tsc` (`db/index.ts`, `worker/index.ts`, tipos do Cloudflare) ou excluí-los do tsconfig, com justificativa | P | — |
| 13 | Teste de ponta a ponta do pipeline com um recorte pequeno de CSV (hoje o `prepare_data.py` só é validado pela contagem de cadeiras e pelos testes sobre o JSON final) | M | — |

## 4. Novas análises

| # | Passo | Esforço | Depende de |
|---|---|---|---|
| 14 | Correção pelo IPCA nas variações (2022 → 2026 e as anteriores), mostrando nominal e real lado a lado. Hoje o texto da página só avisa que é nominal | M | fonte oficial do IPCA (IBGE/BCB) e data-base de cada declaração |
| 15 | Perfil de quem entrou: novos eleitos de 2026 por partido, gênero e raça, em comparação com os reeleitos (reaproveita `diversidade-2026.json` e `lib/comparacao.ts`) | M | — |
| 16 | Quem saiu: dos eleitos de 2022 que não voltaram, quantos não concorreram e quantos concorreram e perderam | M | `consulta_cand_2026` com o cruzamento por CPF no pipeline |

## 5. Depois da posse (fevereiro de 2027)

| # | Passo | Esforço | Depende de |
|---|---|---|---|
| 17 | Rerodar o pipeline e conferir as cadeiras por estado; suplentes que assumirem mudam a lista | M | posse; atualização do TSE |
| 18 | Estender `/leis` aos eleitos de 2026 depois que tiverem mandato na API da Câmara | G | passo 17 |

## Ordem sugerida

1 → 2 → 11 → 12 → 10 → 3 (publicar com CI) → 4 → 5 → 6 → 7 → 9 → 8 → 14 → 15 → 16.
Os passos 17 e 18 ficam para depois da posse.

## Fatos que o roteiro assume

- A API `divulgacandcontas.tse.jus.br/divulga/rest` respondeu 403 do ambiente
  de desenvolvimento. Por isso os passos 4 a 6 e 9 precisam de um navegador
  ou de outra rede.
- Os arquivos de `cdn.tse.jus.br` foram atualizados em 25/10/2026; o pipeline
  rerodado depois pode trazer números diferentes.
