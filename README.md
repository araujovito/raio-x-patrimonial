# Raio-X Patrimonial

![Patrimônio conferido](https://img.shields.io/badge/patrim%C3%B4nio%20conferido-511%2F513-154e3b)
![Trajetória conferida](https://img.shields.io/badge/trajet%C3%B3ria%20conferida-511%2F513-154e3b)
![Testes](https://img.shields.io/badge/testes-38%20passando-154e3b)
![Fonte](https://img.shields.io/badge/fonte-TSE-154e3b)

> **Dados verificados contra o TSE.** Patrimônio e número de bens conferem em
> 511/513 e a trajetória eleitoral em 511/513 dos deputados. Qualquer pessoa pode
> reproduzir a verificação com `python scripts/conferir_tse.py`.

Aplicação interativa para explorar a trajetória eleitoral, os bens declarados
e a representatividade de gênero e raça dos 513 deputados federais eleitos em
2022, com dados públicos do Tribunal Superior Eleitoral e da Câmara dos
Deputados. O histórico cobre candidaturas desde 2000, e a comparação
patrimonial usa a declaração anterior mais recente disponível. Quem já
registrou candidatura para 2026 tem essa candidatura listada na trajetória,
com o patrimônio declarado agora — a eleição ainda não ocorreu, então aparece
sem resultado.

## Demonstração

**Versão publicada:** [raio-x-patrimonial.baraujovi.workers.dev](https://raio-x-patrimonial.baraujovi.workers.dev)

Três blocos: o **explorador**, com busca, filtros e ordenação sobre os 513
eleitos; a seção de **diversidade**, com o recorte de gênero e raça entre quem
concorreu e quem se elegeu, nacional e por estado; e a **página individual de
cada deputado** (`/deputado/<id>`), que pode ser compartilhada e traz título e
descrição próprios no link — útil para apontar uma trajetória específica sem
mandar a pessoa procurar na lista.

Para rodar localmente, veja [Rodar o site](#rodar-o-site).

## Tecnologias

**Interface**
- React 19 e Next.js (App Router), servidos por [vinext](https://www.npmjs.com/package/vinext) sobre Vite
- TypeScript
- CSS autoral (design editorial, responsivo), com Tailwind disponível
- Gráfico de evolução patrimonial em **SVG escrito à mão**, sem biblioteca de
  charts: as escalas e a conversão de dados em coordenadas são próprias

**Dados**
- Python (biblioteca padrão) para baixar, limpar e cruzar os microdados do TSE
  e a API de Dados Abertos da Câmara dos Deputados
- Saída em JSON estático — o volume (513 registros, somente leitura) não
  justifica um banco de dados

**Qualidade**
- 38 testes com o runner nativo do Node (`node:test`), sem dependências extras
- ESLint
- Script próprio de verificação contra a API pública do TSE

## Desafios técnicos

Cinco problemas reais encontrados durante o desenvolvimento, com a investigação
e a solução de cada um.

### 1. Candidaturas antigas desapareciam do histórico

**Sintoma:** a verificação automatizada acusou 24 deputados com candidaturas
presentes no TSE mas ausentes na base — quase todas de 2012.

**Investigação:** ao comparar os microdados, o CPF de 2022 aparecia com 11
dígitos (`03215292785`) e o de 2012 com 10 (`3215292785`). Os arquivos antigos
do TSE gravam o campo **sem os zeros à esquerda**, e o cruzamento por igualdade
de string falhava para todo candidato cujo CPF começa com zero — 118 mil
registros só no arquivo de 2012.

**Solução:** normalizar o CPF com preenchimento à esquerda antes do cruzamento.

**Resultado:** 36 candidaturas de 2012 recuperadas; divergências de trajetória
caíram de 24 para 2 (as duas restantes são uma limitação da fonte, documentada
em Limitações).

### 2. Um terço do patrimônio caía em "Outros"

**Sintoma:** 31,8% de todo o patrimônio (R$ 501 milhões) era classificado como
"Outros", e em 99 dos 513 deputados essa era a maior categoria.

**Investigação:** as regras de categorização usavam termos no singular
(`acao`, `imovel`, `aplicacao`), mas o TSE nomeia os tipos no plural: "Ações",
"Outros bens imóveis", "Outras aplicações", "participações societárias". Nenhum
casava, e bilhões escorriam para a categoria genérica.

**Solução:** usar radicais que cobrem singular e plural, além de tipos que
faltavam (VGBL, terra nua, ouro). A ordem das regras também importa —
"participações" contém "ações".

**Resultado:** "Outros" caiu de 31,8% para 5,7%, com o patrimônio total
**idêntico** ao anterior: os bens foram reclassificados, não alterados.

### 3. Os links para o TSE estavam quebrados

**Sintoma:** todos os links para a ficha do candidato levavam a "ERRO AO
CARREGAR A PÁGINA".

**Investigação:** o sistema de Divulgação do TSE mudou de versão e trocou o
formato da rota. O formato antigo — que o próprio TSE ainda expõe no campo
`txLink` dos seus dados — deixou de funcionar. Navegando pela interface atual e
inspecionando as chamadas de rede, identifiquei a rota válida e descobri que
Bens, Eleições e Prestação de Contas são abas de uma mesma ficha, sem link
direto separado.

**Solução:** reconstruir a URL no formato atual e consolidar os dois links
antigos em um único "Ficha no TSE". Há um teste que falha caso o formato antigo
reapareça.

### 4. Confiar nos dados não basta: é preciso poder provar

**Problema:** um projeto sobre transparência não pode pedir que o leitor confie
na palavra do autor.

**Solução:** `scripts/conferir_tse.py` consulta a API pública do TSE para os
513 deputados e compara patrimônio, número de bens e trajetória eleitoral,
gerando um relatório de divergências. A comparação de trajetória usa apenas a
janela de anos em comum entre as duas fontes, já que os recortes são diferentes.

**Resultado:** a verificação roda em ~30 segundos e foi ela que revelou os
problemas 1 e 2 acima. Os números dos selos no topo deste README saem dela.

### 5. Um estado inteiro tinha sumido da base

**Sintoma:** a contagem de eleitos caiu de 513 para 495 depois de uma
atualização de rotina dos dados, e nenhum deputado aparecia com UF "MA".

**Investigação:** no arquivo `consulta_cand_2022` que o TSE serve hoje, toda
candidatura a cargo **proporcional** (Deputado Federal e Estadual) no
Maranhão está marcada como `#NULO` — sem resultado apurado —, enquanto os
cargos majoritários do mesmo estado (Senador, Governador) aparecem normais.
A distribuição de cadeiras proporcionais do MA em 2022 teve disputa judicial
sobre o rateio entre coligações, e esse arquivo nunca recebeu a situação
final. É exatamente 18 candidaturas — o número de cadeiras do MA na Câmara —,
o que bate com a diferença de 513 para 495.

**Solução:** usar a composição atual da Câmara dos Deputados (API própria,
independente do TSE) para identificar quem ocupa essas 18 cadeiras, e cruzar
com a candidatura de 2022 no TSE (que tem o CPF) pelo nome de urna. O status
desses 18 deputados no site mostra "Eleito (Fonte: Composição Atual da Câmara
dos Deputados)" em vez do resultado padrão do TSE, para não esconder que a
fonte da situação eleitoral, nesse caso específico, não é o próprio TSE.

**Resultado:** os 18 deputados do Maranhão voltaram para a base; o patrimônio
e o histórico deles vêm normalmente do TSE (só o campo de resultado
eleitoral de 2022 precisou da fonte alternativa). A verificação contra a API
do TSE confirma que patrimônio e bens desses 18 batem normalmente — a falha
estava isolada à totalização, não ao registro da candidatura em si.

## O que o projeto demonstra

- ingestão e limpeza de dados públicos;
- relacionamento de registros entre eleições, cargos e partidos;
- agregação e categorização de bens;
- construção de linhas do tempo eleitorais;
- cruzamento entre fontes independentes (TSE e Câmara dos Deputados) para
  cobrir uma falha isolada de uma delas;
- recorte de representatividade (gênero e raça), nacional e por estado;
- interface responsiva com busca, filtros e ordenação;
- páginas por deputado renderizadas no servidor, com metadados próprios;
- cuidado com toque e leitura em telas pequenas;
- documentação explícita das limitações da análise.

## Fonte dos dados

Os arquivos de candidatura e bens são baixados diretamente do
[Portal de Dados Abertos do TSE](https://dadosabertos.tse.jus.br/group/candidatos).
O script usa o CPF exclusivamente para relacionar as candidaturas durante o
processamento. O arquivo publicado não contém CPF.

A composição atual da Câmara vem da
[API de Dados Abertos da Câmara dos Deputados](https://dadosabertos.camara.leg.br/),
usada apenas para os 18 deputados do Maranhão cuja situação eleitoral de 2022
não está resolvida no arquivo do TSE (ver Desafios técnicos, item 5).

## Reproduzir os dados

```bash
python scripts/prepare_data.py
```

O script baixa os conjuntos `consulta_cand` e `bem_candidato` do TSE (o
primeiro desde 2000, o segundo desde 2006), seleciona os candidatos a deputado
federal eleitos em 2022 e gera `app/data/deputados.json` e
`app/data/diversidade.json` (gênero e raça, candidatos e eleitos, por estado).
Quando uma candidatura para 2026 já está registrada, ela entra na trajetória
do deputado com o patrimônio declarado e sem resultado (a eleição ainda não
ocorreu).

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

Na última verificação, patrimônio e número de bens conferiram em **511/513** e a
trajetória eleitoral em **511/513** (as duas exceções são candidaturas
presidenciais de 2014 com CPF ocultado pelo TSE — ver Limitações).

## Rodar o site

```bash
pnpm install
pnpm dev
```

Para validar uma versão de produção:

```bash
pnpm build
pnpm test
```

`pnpm test` roda o build e as 38 verificações: as regras de dados
(`tests/deputados.test.mjs`), a renderização do explorador
(`tests/rendered-html.test.mjs`) e as páginas individuais
(`tests/deputy-page.test.mjs`).

## Limitações

- Os valores foram declarados pelos próprios candidatos.
- A variação exibida é nominal e não desconta a inflação.
- Ausência de comparação significa que não foi localizada declaração anterior
  nas bases analisadas.
- Candidatura anterior não significa exercício do cargo; o resultado eleitoral
  é exibido separadamente.
- Crescimento ou redução não deve ser interpretado isoladamente como renda,
  irregularidade ou avaliação atual de mercado.
- A escala vertical do gráfico é individual: usa a maior declaração de cada
  deputado como referência, então a inclinação não é comparável entre perfis.
- Candidaturas a presidente e vice em alguns anos (por exemplo 2014) têm o CPF
  ocultado como `-1` nos arquivos do TSE e não podem ser relacionadas ao
  histórico. Na verificação atual, apenas duas trajetórias ficam incompletas por
  esse motivo. O patrimônio de 2022 não é afetado.
- Gênero e raça são autodeclarados pelo próprio candidato no ato da
  candidatura ao TSE, não uma classificação externa.
- Para os 18 deputados do Maranhão, o resultado eleitoral de 2022 exibido no
  site não vem do arquivo de candidaturas do TSE (que está sem essa
  informação para o estado), e sim da composição atual da Câmara dos
  Deputados — ver Desafios técnicos, item 5. Patrimônio e histórico desses 18
  seguem vindo do TSE normalmente.

---

Dados e desenvolvimento por **Vitor Barbosa**.
