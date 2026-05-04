# Lote 3 — Cat antigas/legacy

Continuação do Lote 2. Mesmo formato resumido, com **intervalHours** (não usa km).

## Conteúdo

### 5 modelos novos (`equipment-models/`)

| ID | Fabricante | Modelo | Família | Equipamento da frota |
|---|---|---|---|---|
| `cat-cb10` | Caterpillar | CB10 | Rolo Compactador Tandem (Chapa) | **RC-001 (2019) ⭐ horímetro 833,7h** |
| `cat-315cl` | Caterpillar | 315CL | Escavadeira (1996-2005) | EH-004 (1997) — INATIVA |
| `cat-d6m` | Caterpillar | D6M | Trator de Esteira (1996-2003) | TRE-002 (2004) — INATIVA |
| `cat-d6g` | Caterpillar | D6G | Trator de Esteira (1985-1996) | TRE-003 — INATIVA |
| `cat-140k` | Caterpillar | 140K | Motoniveladora | Motoniveladora 140 Colorado (×2) |

⭐ **CB10 é prioridade alta**: tem horímetro funcional (833,7h) e está ativa em uso.

### 25 tarefas (`equipment-tasks/`)

5 tarefas por modelo (mesmo template do Lote 2):
1. Diária pré-turno (`-diaria`) — `intervalDays: 1, intervalHours: 10`
2. 250h (`-250h`) — lubrificação + amostra S.O.S.
3. 500h (`-500h`) — óleo motor + filtros combustível
4. 1000h (`-1000h`) — anual: hidráulico + filtros completos
5. 2000h (`-2000h`) — bienal: refrigerante + correias + revisão geral

## Avisos importantes

### Equipamentos INATIVOS (315CL, D6M, D6G)
Os modelos foram cadastrados para fins de histórico/inventário e para o caso de retomada operacional. Os campos `problemas_conhecidos` documentam os pontos críticos para retorno (drenar fluidos antigos, substituir vedações, calibrar bicos, etc.).

### Cat 140K — assumido pela mais comum no Brasil
A motoniveladora "140 Colorado" não tem o ano/sub-modelo identificado no relatório. Modelei como **140K** (geração 2008-2018, motor C7.1 ACERT), que é a mais comum em frotas brasileiras. Se for **140G/H/M** (mais antiga, motor 3306 ou C7) ou **140M3/140-13** (mais nova, motor C13 com SCR), specs e PNs precisam ajuste.

### Peças Cat antigas
Para 315CL, D6M, D6G: alguns part numbers Cat originais (9N-7898, 7W-5495, 9T-9054, 9Y-4509) ainda existem mas estão caros e com prazo longo. Considerar equivalentes Donaldson ou Wix Heavy Duty para uso operacional comum.

### Cat CB10 (RC-001) — pode usar fluido cat
Já tem entradas no catálogo de fluidos do Lote 1 (cat-deo, cat-hydo, cat-tdto, cat-fdao, cat-elc, cat-prime). Sem fluidos genéricos faltantes.
