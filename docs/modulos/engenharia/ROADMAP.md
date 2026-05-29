# Engenharia — Plano do módulo (roadmap)

Workspace de engenharia da EMT dentro do app Gestão de Obras: pastas hierárquicas + três tipos de bloco (Nota, Cálculo, Prancha) + arquivos, com permissões, lock pessimista e versionamento.

Specs/planos detalhados:
- Spec da Prancha: `docs/superpowers/specs/2026-05-28-engenharia-prancha-quadro-livre-design.md`
- Plano v1 da Prancha: `docs/superpowers/plans/2026-05-28-engenharia-prancha-v1.md`
- Histórico de entregas: `docs/modulos/engenharia/CHANGELOG.md`

## Estado atual (entregue, em produção)

- **Ondas 1–5 + 6a:** schema/RLS/locks, storage de arquivos, UI de pastas, bloco de Nota (Tiptap), bloco de Cálculo linha-por-linha (parser + variáveis num/string + aliases + palavras reservadas).
- **Prancha v1:** quadro livre (canvas) ao lado de Nota e Cálculo. Paleta lateral (selecionar, mão, texto, cálculo, linha, retângulo, quadrado, círculo), pega-ferramenta e clica pra aplicar, mover/redimensionar/rotacionar (react-moveable), tecla Delete, auto-save, lock, conflito de versão. Caixa de cálculo reusa o motor (`recalcularDocumento`).
- **Escopo compartilhado da prancha:** variável definida em qualquer caixa é usável em todas (`recalcularPrancha`, define-anywhere/use-anywhere, conflito = topo/esquerda vence). Alerta de erro empilhado (não tapa o input).

## Princípios de execução

- Uma fase por vez, cada uma entregável e testada (Vitest no que é puro, Playwright no fluxo). Migrations sempre em par `_fix`/`_rollback` + backfill de chave de permissão nova. Ao adicionar tipo de recurso (lock), lembrar da constraint de `engenharia_locks`.
- Reusar o que existe (motor de cálculo, lock, versionamento, RLS per-command) em vez de duplicar.

## Próximas fases da Prancha

### P2 — Cálculo avançado
- **Mini-planilha tipo Excel** embutida (elemento `planilha`): grade redimensionável, células com número/texto/fórmula (`=A1+B1`, `=SUM(A1:A3)`, `=AVERAGE`), refs por coluna-letra/linha-número. Lib candidata: `react-data-grid` (MIT). Escopo da grid é separado das variáveis da prancha (documentar); exportar resultado da grid pra variável via comando.
- **Conversor de unidades** (elemento ou função no motor): toneladas de CBUQ, m³, km↔m, t↔kg. Aproveitar unidades do math.js.
- **Templates de cálculo salvos:** memórias reutilizáveis (ex.: área de CBUQ = comprimento × largura × espessura × densidade; volume de TS; BDI). Inserir template pré-preenchido na prancha.
- ~~Variável compartilhada da prancha~~ — **já entregue** (antecipada da P2).

### P3 — CAD-lite (cotas e escala)
- **Cota linear:** medir distância real entre dois pontos, exibindo o valor conforme a escala.
- **Escala do desenho:** definir 1 cm = X m pra prancha; cotas e linhas nomeadas passam a refletir medida real.
- **Linha nomeada + comprimento:** linha recebe rótulo (L1) e comprimento, usável em cálculo.

### P4 — Templates rodoviários
- **Seção transversal de pavimento:** template paramétrico (capa/binder, base, sub-base, subleito) com espessuras, pra croqui de estrutura de pavimento.
- **Régua de estacas / km:** estaqueamento do trecho da BR-364, marcar km/estaca na prancha.

### P5 — Diferenciais (audacioso)
- **Carimbos de serviço:** RP, TS, DRENO, CBUQ como símbolos posicionáveis.
- **Tabela de medição:** puxa quantidade das formas desenhadas (m², m³, toneladas) pra fechar medição.
- **Anexos no ponto:** foto do operacional e DANFE/ticket de pesagem ancorados num ponto da prancha.
- **Exportar prancha:** PDF/imagem pra fiscalização do DNIT (usar a marca EMT).

## Refinamentos transversais (qualquer fase)
- Pan/zoom interativo no canvas, undo/redo, snap à grade.
- Histórico de versões da prancha na UI (drawer, espelhando o da Nota/Cálculo; o snapshot por versão já é gravado no banco).
- Lixeira/restauração de prancha na UI.
- E2E 2-usuários do lock (depende de fixture de 2 contas).

## Fora de escopo
- Colaboração em tempo real / CRDT (mantém lock pessimista).
- Camadas/agrupamento, a menos que pedido.
