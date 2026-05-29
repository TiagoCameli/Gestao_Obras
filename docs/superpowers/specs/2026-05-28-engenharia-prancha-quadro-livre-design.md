# Design — Módulo Engenharia: Prancha (quadro livre)

- **Data:** 2026-05-28
- **Status:** Aprovado no brainstorm, aguardando revisão da spec
- **Autor:** Leo (agente) + Tiago
- **Contexto no módulo:** sucede a Onda 6a. Substitui o plano antigo de 6b/6c/6d (spinner, caixa de texto, mini-grid no bloco linha-por-linha).

## 1. Motivação

O bloco de Cálculo atual é linha-por-linha (estilo Soulver): cada expressão numa linha fixa, empilhada. O usuário (Tiago) não quer esse formato rígido. Quer um **quadro livre** tipo Excalidraw/bloco-de-notas: clicar em qualquer ponto pra escrever texto ou cálculo, com uma **paleta de ferramentas na lateral**. Clica na ferramenta, o ponteiro "pega" ela, e aplica onde clicar no quadro. Texto, cálculo e desenho convivem no mesmo espaço.

## 2. Decisões de produto

- **Novo tipo de bloco "Prancha"**, ao lado de Nota e Cálculo dentro da pasta. O bloco de Cálculo linha-por-linha **continua existindo** (congelado na Onda 6a) pra conta rápida. Sem migração.
- **Fundação técnica: DIY open-source** (sem tldraw — exige licença comercial paga pra uso interno; Excalidraw é fraco pra widgets vivos de cálculo). Reaproveita motor de cálculo, lock e versionamento já prontos.

## 3. Arquitetura

### 3.1 Banco de dados
Espelha o padrão de `engenharia_notas` / `engenharia_calculos`:
- `engenharia_pranchas` — `id`, `pasta_id` (FK), `nome`, `documento_json` (jsonb, default `{}`), `criado_por`, `deleted_at`, timestamps, `versao` (int).
- `engenharia_pranchas_versoes` — histórico (snapshot por versão), cap de 50 (D-9).
- RLS per-command via `private.current_has_action(...)`, soft-delete `deleted_at`, padrões idênticos aos blocos existentes.
- Função SECDEF `engenharia_salvar_prancha_com_versao(uuid, text, jsonb, int)` — atomiza snapshot + UPDATE com optimistic concurrency (`p_versao_atual` → `conflito_versao`). GRANT só authenticated; REVOKE anon/public.
- Migrations em pares `_fix`/`_rollback`.

### 3.2 Permissões
Chaves novas no grupo Engenharia em `src/utils/permissions.ts`:
- `criar_engenharia_prancha`, `editar_engenharia_prancha`, `excluir_engenharia_prancha`.
- Distribuição por cargo em `TEMPLATES_ACOES_POR_CARGO` (mesmo perfil das chaves de cálculo).
- **Migration de backfill obrigatória** por cargo (lição aprendida em 2026-05-28: adicionar chave de ação sem backfill deixa todos sem acesso). Ver `docs/modulos/engenharia/CHANGELOG.md`.

### 3.3 Stack do quadro (tudo MIT)
- Pan/zoom: container com `transform: translate()/scale()` em CSS, controlado por estado (viewport).
- `react-moveable` (MIT): alças de mover/redimensionar/rotacionar de qualquer elemento.
- Camada SVG: formas vetoriais (linha, retângulo, quadrado, círculo, cota).
- Elementos ricos (texto, cálculo, planilha): componentes React posicionados em absoluto. A caixa de cálculo **reusa `recalcularDocumento` / `calcEngine`**.
- Lock pessimista: reusa `useLockRecurso('prancha', id)`. Versões: espelha `HistoricoVersoesDrawer`.

### 3.4 Modelo de dados do elemento
`documento_json` da prancha contém `{ viewport: {x,y,zoom}, elementos: ElementoPrancha[] }`.
```
ElementoPrancha = {
  id: string,
  tipo: 'texto' | 'calculo' | 'planilha' | 'forma' | 'cota'
        | (futuro) 'conversor' | 'secao_pavimento' | 'regua_km',
  x, y, largura, altura: number,
  rotacao: number,   // graus
  z: number,         // ordem de empilhamento
  props: object,     // específico por tipo
}
```
- `forma`: `props.formaTipo ∈ linha|retangulo|quadrado|circulo`, cor, espessura, preenchimento.
- `texto`: `props.conteudo` (rich text JSON do Tiptap, ou texto simples na v1).
- `calculo`: `props.linhas` (mesmo formato `LinhaCalculo` do bloco atual) + `props.alertaAtivo`.

### 3.5 Escopo de variável
Na v1, **cada caixa de cálculo é autossuficiente** (linhas e escopo próprios, igual ao bloco atual, via `recalcularDocumento`). Variável compartilhada por toda a prancha (chip nomeado visível a qualquer caixa) fica para a Fase P2.

## 4. Interação "pega a ferramenta"

- Paleta vertical na esquerda. Estado global da prancha: `ferramentaAtiva` (default `selecionar`).
- Clicar numa ferramenta ativa o modo correspondente; o cursor muda (crosshair pra formas, I-beam pra texto, etc.).
- **Texto / Cálculo / Planilha:** um clique no quadro cria o elemento naquele ponto e entra em edição. Volta pra `selecionar`.
- **Formas / Cota:** clique-e-arraste define o retângulo delimitador (ou os 2 pontos da linha/cota). Volta pra `selecionar` (segurar a tecla da ferramenta ou um "modo fixar" mantém pra criar várias — refinamento).
- **Selecionar:** clica num elemento → alças do `react-moveable` (mover/redimensionar/rotacionar). `Delete` apaga. Arrastar no vazio = seleção múltipla (refinamento) / pan com a ferramenta Mão.
- Snap à grade pontilhada opcional.

## 5. Escopo da v1 (MVP — uma onda entregável de ponta a ponta)

1. DB completa (tabelas, RLS, lock, SECDEF salvar-com-versão, permissões + backfill).
2. Canvas: pan/zoom, paleta, interação de pega-ferramenta, selecionar/mover/redimensionar (react-moveable), apagar, snap opcional.
3. Persistência: auto-save 5s + Cmd/Ctrl+S, banner de lock, histórico de versões (reusa padrões da Onda 4/5), tratamento de `conflito_versao`.
4. Elementos v1: **caixa de texto**, **caixa de cálculo** (reusa motor + alerta de erro), **formas básicas** (linha, retângulo, quadrado, círculo).
5. Rota `/engenharia/prancha/:id` (lazy, `ProtectedRoute acao="ver_engenharia"`) + item "Novo > Prancha" na `PastaPage` (gate `criar_engenharia_prancha`).
6. Testes: Vitest (modelo de elemento, reuso do motor, serialização do documento) + Playwright (criar prancha; soltar texto; soltar cálculo `2*5=11` → alerta; desenhar retângulo; mover elemento; salvar e reabrir mantendo posições).

## 6. Faseamento pós-MVP

- **P2 — Cálculo avançado:** mini-planilha Excel (`=SUM`, `=A1*B1`, referências), conversor de unidades (t CBUQ, m³, km), templates de cálculo salvos (área CBUQ = comprimento×largura×espessura×densidade, BDI, volume TS), variável compartilhada da prancha.
- **P3 — CAD-lite:** cota linear com medida real, escala do desenho (1 cm = X m), linha nomeada + comprimento.
- **P4 — Rodoviário:** seção transversal de pavimento (capa/base/sub-base), régua de estacas/km.
- **P5 — Audacioso (futuro):** carimbos de serviço (RP/TS/DRENO/CBUQ), tabela de medição puxando quantidade das formas (m²/m³/t), anexar foto do operacional e DANFE/ticket num ponto, exportar prancha em PDF pra fiscalização do DNIT.

## 7. Riscos

- **Polimento do canvas DIY** (seleção, alças, pan/zoom, snap, undo/redo) é a parte mais trabalhosa e fácil de ficar "janky". Mitigação: `react-moveable` cobre as alças; manter v1 enxuta; testar interação com Playwright.
- **Undo/redo** não está na v1 (entra como refinamento). Sinalizar ao usuário.
- **Reuso do motor de cálculo** dentro de um elemento livre: garantir que `recalcularDocumento` opere sobre `props.linhas` sem acoplar à UI antiga.

## 8. Fora de escopo (YAGNI)

- Colaboração em tempo real / CRDT (mantém lock pessimista).
- Camadas (layers), agrupar/desagrupar — só se pedido depois.
- Tudo da fase P5 antes das P2-P4.
- Não mexer no bloco de Cálculo linha-por-linha (congelado).
