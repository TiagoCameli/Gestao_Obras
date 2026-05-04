# Lote 4 — Caminhões Mercedes-Benz EMT

Lote dedicado a caminhões. **Atenção: esquema de tarefas usa `intervalKm`** (km) em vez de `intervalHours` (horas), porque caminhões medem por odômetro.

## Conteúdo

### 5 modelos novos (`equipment-models/`)

| ID | Modelo MB | Função | Equipamentos da frota | Qtd |
|---|---|---|---|---|
| `mb-2423-k36` | 2423 K/36 | Basculante 6x4 | CB-001, CB-002, CB-003 | 3 |
| `mb-2425-48` | 2425/48 | Basculante 6x4 | CB-004, CB-005, CB-006 | 3 |
| `mb-2644-s33` | 2644 S/33 | Cavalo Mecânico 6x4 | CS-001 | 1 |
| `mb-l1620` | L 1620 | Médio-Pesado 4x2 (Munck) | CM-001 | 1 |
| `mb-l1318-50` | L 1318/50 | Médio 4x2 (Pipa) | CP-002 | 1 |

**Total: 9 caminhões da frota EMT** podem ser associados a estes 5 modelos.

### 25 tarefas (`equipment-tasks/`)

5 tarefas por modelo (template **km-based** para caminhões):

| Suffix | Intervalo | Prioridade | O que faz |
|---|---|---|---|
| `-semanal` | 7 dias | alta | Inspeção pré-viagem (níveis, freios, pneus, luzes, drenagem AR) |
| `-10000km` | 10.000 km / 6 meses | alta | Óleo motor + filtro |
| `-30000km` | 30.000 km / 12 meses | alta | Filtros completos (óleo + comb + ar) + secador AR + freios |
| `-60000km` | 60.000 km / 24 meses | alta | Transmissão + diferenciais + direção + hidráulico (se houver) |
| `-120000km` | 120.000 km / 48 meses | crítica | Refrigerante + embreagem + revisão geral |

## ⚠️ Atenção crítica — esquema de banco

As tarefas do Lote 4 usam o campo **`intervalKm`** (não `intervalHours`). Os Lotes 1, 2 e 3 só usaram `intervalHours` e `intervalDays`.

**Antes de seedar o Lote 4**, o Claude Code (ou você) precisa confirmar que:

1. A coluna `intervalKm` (ou equivalente, ex: `interval_km`) existe na tabela de tarefas do banco
2. A UI consulta e exibe esse campo corretamente nos cards de tarefa e cálculo de próximo vencimento
3. A logica de cálculo de "próximo vencimento" sabe lidar com 3 critérios concorrentes (horas / km / dias) e usa o que ocorrer primeiro

Se o schema atual **só tem** `intervalHours` e `intervalDays`, é necessário antes:
- Criar migration adicionando `intervalKm INTEGER NULL` na tabela de tarefas
- Atualizar a UI para exibir e a lógica de cálculo para considerar km

Como alternativa rápida, **converter km em horas equivalentes** (ex: 1 hora ≈ 60 km de média) é incorreto e não recomendado — odômetro é a unidade natural de caminhão.

## Particularidades dos caminhões

### Quais têm hidráulico operacional?
- **2423 K/36, 2425/48** — sim, sistema da caçamba basculante (50 L, ISO VG 46)
- **L 1620** — sim, sistema do Munck (80 L, ISO VG 46)
- **2644 S/33** — não (cavalo mecânico, sem implemento operacional)
- **L 1318/50** — sim, mas é a bomba de pipa (acionada por PTO da transmissão; manutenção separada)

### Pipa MB L 1318/50 — manutenção SEPARADA
A bomba de pipa e o tanque/canalização são equipamentos auxiliares com manutenção própria, não no escopo do chassi. As tarefas do `mb-l1318-50` cobrem apenas o caminhão (motor, transmissão, eixos, freios). A bomba de pipa precisa de plano separado se for cadastrada na frota.

### Munck MB L 1620 — manutenção SEPARADA + NR-12
O implemento Munck (Hyva/Madal/PH) deve ter cadastro próprio na frota com seu próprio plano de manutenção. **Atenção segurança: NR-12 exige laudo anual por engenheiro mecânico para Munck/guincho** — tarefa crítica que não está incluída neste lote (depende de profissional certificado externo).

## Fluidos genéricos do Lote 4

Os caminhões MB usam especificações Mercedes-Benz oficiais (228.5, 235.0, 235.4, 325.5, 345.0). No catálogo de fluidos, criar entradas:

- `mb-228.5-15w40-acea-e7` — óleo motor MB 228.5 ACEA E7 (Texaco Ursa, Selenia Heavy Duty, Ipiranga F1 Truck)
- `mb-235.0-sae85w90-gl5` — óleo de eixo diferencial MB 235.0
- `mb-235.4-sae80w90-gl4` — óleo de transmissão manual MB 235.4
- `mb-325.5-coolant-organico` — refrigerante orgânico MB 325.5
- `mb-345.0-atf-dexron-iii` — fluido de direção hidráulica MB 345.0
- `generico-iso-vg-46` — óleo hidráulico ISO 46 (basculante/munck)
- `generico-graxa-ep2-litio` — graxa EP-2 lítio (universal)

Se o catálogo do projeto exige todos esses, o Claude Code deve listar quais faltam no log final.

## Equipamentos sem modelo após este lote

Olhando os caminhões da frota EMT:

**Faltam ainda (Lote 5+ futuro):**
- **Ford 2626** (CP-001, pipa) — Cargo 2626
- **Ford Cargo Betoneira** (CBT-001) — chassis Cargo, motor Cummins ISB
- **Ford Cargo 1517** (MZ-001, meloza) — Cargo 1517
- **MB Espargidor** (CE-001, 2019) — chassis MB Atron, possivelmente mesma família 2425/2429
- DAFs (CS-002 a CS-005) — você pediu para não fazer

**Da Construtora Colorado (sem placa/série identificada na frota):**
- Vibroacabadora Leeboy
- Usina de Asfalto Ciber 80 ton/hr
- Caminhões basculantes Colorado (vários, sem identificação MB ou Ford)
- Caminhão Espargidor Colorado, Caminhão Pintura, Caminhão Transporte Jorgean, Rolo Chapa Mirla

**Da Amazônia Agroindústria (fazenda — depende se você quer cadastrar):**
- Tratores Agrale BX6180, Massey 235/299, Walmet 128, John Deere 6110E (7 unidades)
