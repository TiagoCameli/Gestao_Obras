-- Marco 1 / Seed — Especificações técnicas preliminares da frota própria.
--
-- Specs pesquisadas via fontes públicas (sites de fabricantes, fichas técnicas,
-- catálogos de revendedores) para os 47 equipamentos próprios com marca+modelo
-- definidos. Mecânico/manual valida e ajusta no app via UI.
--
-- Coberto:
--   - 6 Caminhões Basculantes Mercedes (2423 K/36 e 2425/48)
--   - 1 Ford Cargo 2628 (betoneira), 1 Ford 2626 (pipa), 1 Ford 1517 (meloza)
--   - 1 Mercedes Atego (espargidor), 1 Mercedes L 1620 (munck), 1 L 1318/50 (pipa)
--   - 4 DAF XF 530 FTT, 1 Mercedes 2644 S/33 (cavalos mecânicos)
--   - 5 Toyota Hilux 2.8, 1 Chevrolet Tracker, 3 VW Saveiro
--   - 3 Cat 320C, 1 Komatsu PC200-8, 1 Volvo EC55B PRO (escavadeiras)
--   - 2 Cat 12H (motoniveladoras)
--   - 1 Cat 924K, 1 Case W20 (pás carregadeiras)
--   - 2 Cat 416E (retroescavadeiras)
--   - 1 Volvo MC110C, 1 Bobcat S450 (minicarregadeiras)
--   - 1 Cat CB10 (rolo chapa), 1 Cat CW34 (rolo pneu)
--   - 2 Cat CP-56, 1 Dynapac CA260 (rolos pé de carneiro)
--   - 1 JCB 540-170 (telescópio), 1 Cat D6N XL (trator esteira)
--   - 1 Ciber AF4500 (vibroacabadora)
--
-- NÃO coberto (sem marca/modelo ou implemento sem motor):
--   - Caminhão Caçamba Colorado - 35 (sem marca)
--   - Prancha Colorado, Caminhão Apoio Jorgean, Assoprador, Pulverizador,
--     Laboratório (sem dados)
--   - 3 Semi-Reboques (não tem motor próprio, FK marca FORD/NOMA é só do
--     fabricante do reboque)
--
-- Filtros OEM: só Komatsu PC200-8 tem códigos preenchidos (pesquisa confirmou).
-- Demais: mecânico cadastra no app conforme nota fiscal de compra.
--
-- IDEMPOTENTE via ON CONFLICT (equipamento_id) DO UPDATE.

INSERT INTO public.especificacoes_equipamento (
  equipamento_id, capacidade_tanque_l, capacidade_oleo_motor_l, tipo_oleo_motor,
  capacidade_oleo_hidraulico_l, tipo_oleo_hidraulico,
  capacidade_oleo_transmissao_l, tipo_oleo_transmissao,
  capacidade_oleo_diferencial_l, capacidade_arrefecedor_l,
  pneu_medida, pneu_qtd, bateria_especificacao, bateria_qtd,
  filtros, consumo_esperado_l_h, consumo_esperado_km_l,
  observacoes_tecnicas, created_by, updated_by
) VALUES
  -- Caminhões Basculantes Mercedes 2423 K/36
  ('cb-001', 275, 29, '15W40 CI-4',  NULL, NULL,  13, 'SAE 90 GL-5',   28, 35, '11R22.5', 10, '12V 150Ah', 2, '{}'::jsonb, NULL, 1.8,
   'Specs preliminares pesquisadas (Mercedes Atron 2423). Motor OM-457 LA. Confirmar com manual.', 'sistema', 'sistema'),
  ('cb-002', 275, 29, '15W40 CI-4',  NULL, NULL,  13, 'SAE 90 GL-5',   28, 35, '11R22.5', 10, '12V 150Ah', 2, '{}'::jsonb, NULL, 1.8,
   'Specs preliminares pesquisadas (Mercedes Atron 2423). Motor OM-457 LA. Confirmar com manual.', 'sistema', 'sistema'),
  ('cb-003', 275, 29, '15W40 CI-4',  NULL, NULL,  13, 'SAE 90 GL-5',   28, 35, '11R22.5', 10, '12V 150Ah', 2, '{}'::jsonb, NULL, 1.8,
   'Specs preliminares pesquisadas (Mercedes Atron 2423). Motor OM-457 LA. Confirmar com manual.', 'sistema', 'sistema'),
  -- Mercedes 2425/48
  ('cb-004', 275, 29, '15W40 CI-4',  NULL, NULL,  13, 'SAE 90 GL-5',   28, 35, '275/80R22.5', 10, '12V 150Ah', 2, '{}'::jsonb, NULL, 1.7,
   'Specs preliminares (Mercedes Atron 2425/48). Motor OM-457 LA. Confirmar com manual.', 'sistema', 'sistema'),
  ('cb-005', 275, 29, '15W40 CI-4',  NULL, NULL,  13, 'SAE 90 GL-5',   28, 35, '275/80R22.5', 10, '12V 150Ah', 2, '{}'::jsonb, NULL, 1.7,
   'Specs preliminares (Mercedes Atron 2425/48). Motor OM-457 LA. Confirmar com manual.', 'sistema', 'sistema'),
  ('cb-006', 275, 29, '15W40 CI-4',  NULL, NULL,  13, 'SAE 90 GL-5',   28, 35, '275/80R22.5', 10, '12V 150Ah', 2, '{}'::jsonb, NULL, 1.7,
   'Specs preliminares (Mercedes Atron 2425/48). Motor OM-457 LA. Confirmar com manual.', 'sistema', 'sistema'),
  -- Ford Cargo 2628 (betoneira)
  ('cbt-001', 275, 19.5, '15W40 CI-4', NULL, NULL, 13, 'SAE 90 GL-5', 28, 30, '275/80R22.5', 10, '12V 150Ah', 2, '{}'::jsonb, NULL, 1.5,
   'Specs Ford Cargo 2628 6x4. Motor Cummins ISC 8.3 ou similar. Confirmar com manual.', 'sistema', 'sistema'),
  -- Mercedes Atego (espargidor)
  ('ce-001', 200, 18, '15W40 CI-4', NULL, NULL, 10, 'SAE 90 GL-5', 14, 25, '275/80R22.5', 6, '12V 150Ah', 2, '{}'::jsonb, NULL, 2.5,
   'Specs Mercedes Atego. Motor OM 924 LA. Confirmar com manual.', 'sistema', 'sistema'),
  -- Mercedes L 1620 (munck)
  ('cm-001', 175, 22, '15W40 CI-4', NULL, NULL, 10, 'SAE 90 GL-5', 14, 28, '275/80R22.5', 6, '12V 150Ah', 2, '{}'::jsonb, NULL, 2.8,
   'Specs Mercedes L 1620. Motor OM-366 6L. Confirmar com manual.', 'sistema', 'sistema'),
  -- Ford 2626 (pipa)
  ('cp-001', 275, 19.5, '15W40 CI-4', NULL, NULL, 13, 'SAE 90 GL-5', 28, 30, '275/80R22.5', 10, '12V 150Ah', 2, '{}'::jsonb, NULL, 1.7,
   'Specs Ford Cargo 2626 6x4. Motor Cummins. Confirmar com manual.', 'sistema', 'sistema'),
  -- Mercedes L 1318/50 (pipa)
  ('cp-002', 150, 18, '15W40 CI-4', NULL, NULL, 8, 'SAE 90 GL-5', 11, 22, '900-20', 6, '12V 100Ah', 2, '{}'::jsonb, NULL, 2.8,
   'Specs Mercedes L 1318/50. Motor OM-924 4.8L. Confirmar com manual.', 'sistema', 'sistema'),
  -- Chevrolet Tracker
  ('vl-003', 44, 4, '0W20 Dexos1 Gen3', NULL, NULL, 1.7, 'GM Auto Trans Fluid', NULL, 5.5, '215/55R17', 5, '12V 60Ah', 1, '{}'::jsonb, NULL, 11,
   'Specs Chevrolet Tracker 1.2T flex. Confirmar com manual.', 'sistema', 'sistema'),
  -- Toyota Hilux 2.8 (5 unidades)
  ('vl-001', 80, 7.5, '5W30 API SN/CF', NULL, NULL, 4, 'SAE 75W-85', 3, 9, '265/65R17', 5, '12V 80Ah', 1, '{}'::jsonb, NULL, 9,
   'Specs Toyota Hilux 2.8 diesel. Motor 1GD-FTV. Confirmar com manual.', 'sistema', 'sistema'),
  ('vl-004', 80, 7.5, '5W30 API SN/CF', NULL, NULL, 4, 'SAE 75W-85', 3, 9, '265/65R17', 5, '12V 80Ah', 1, '{}'::jsonb, NULL, 9,
   'Specs Toyota Hilux 2.8 diesel. Motor 1GD-FTV. Confirmar com manual.', 'sistema', 'sistema'),
  ('vl-005', 80, 7.5, '5W30 API SN/CF', NULL, NULL, 4, 'SAE 75W-85', 3, 9, '265/65R17', 5, '12V 80Ah', 1, '{}'::jsonb, NULL, 9,
   'Specs Toyota Hilux 2.8 diesel. Motor 1GD-FTV. Confirmar com manual.', 'sistema', 'sistema'),
  ('vl-006', 80, 7.5, '5W30 API SN/CF', NULL, NULL, 4, 'SAE 75W-85', 3, 9, '265/65R17', 5, '12V 80Ah', 1, '{}'::jsonb, NULL, 9,
   'Specs Toyota Hilux 2.8 diesel. Motor 1GD-FTV. Confirmar com manual.', 'sistema', 'sistema'),
  ('vl-007', 80, 7.5, '5W30 API SN/CF', NULL, NULL, 4, 'SAE 75W-85', 3, 9, '265/65R17', 5, '12V 80Ah', 1, '{}'::jsonb, NULL, 9,
   'Specs Toyota Hilux 2.8 diesel. Motor 1GD-FTV. Confirmar com manual.', 'sistema', 'sistema'),
  -- VW Saveiro
  ('vl-002', 55, 4.2, '5W30 VW 502 00', NULL, NULL, 2.0, 'VW G 052 171', NULL, 5, '195/55R16', 5, '12V 60Ah', 1, '{}'::jsonb, NULL, 12,
   'Specs VW Saveiro 1.6 MSI. Confirmar com manual.', 'sistema', 'sistema'),
  ('vl-008', 55, 4.2, '5W30 VW 502 00', NULL, NULL, 2.0, 'VW G 052 171', NULL, 5, '195/55R16', 5, '12V 60Ah', 1, '{}'::jsonb, NULL, 12,
   'Specs VW Saveiro CS 1.6 MSI 2026. Confirmar com manual.', 'sistema', 'sistema'),
  ('vl-009', 55, 4.2, '5W30 VW 502 00', NULL, NULL, 2.0, 'VW G 052 171', NULL, 5, '195/55R16', 5, '12V 60Ah', 1, '{}'::jsonb, NULL, 12,
   'Specs VW Saveiro CS 1.6 MSI 2026. Confirmar com manual.', 'sistema', 'sistema'),
  -- Caterpillar 320C
  ('eh-001', 400, 30, '15W40 CH-4', 200, 'ISO 68 HVLP', NULL, NULL, NULL, 30, NULL, NULL, '12V 100Ah', 2, '{}'::jsonb, 18, NULL,
   'Specs Cat 320C. Motor 3066T 6.4L 138hp. Hidr tank 120L. Final drive 10L cada. Swing drive 8L. Confirmar com manual.', 'sistema', 'sistema'),
  ('eh-002', 400, 30, '15W40 CH-4', 200, 'ISO 68 HVLP', NULL, NULL, NULL, 30, NULL, NULL, '12V 100Ah', 2, '{}'::jsonb, 18, NULL,
   'Specs Cat 320C. Motor 3066T 6.4L 138hp. Hidr tank 120L. Final drive 10L cada. Swing drive 8L. Confirmar com manual.', 'sistema', 'sistema'),
  ('eh-003', 400, 30, '15W40 CH-4', 200, 'ISO 68 HVLP', NULL, NULL, NULL, 30, NULL, NULL, '12V 100Ah', 2, '{}'::jsonb, 18, NULL,
   'Specs Cat 320C. Motor 3066T 6.4L 138hp. Hidr tank 120L. Final drive 10L cada. Swing drive 8L. Confirmar com manual.', 'sistema', 'sistema'),
  -- Komatsu PC200-8
  ('eh-005', 400, 24, '15W40 CI-4', 237, 'ISO 46 HVLP', NULL, NULL, NULL, 22.4, NULL, NULL, '12V 100Ah', 2,
   '{"oleo":"ST10724","ar":"ST40640A","combustivel":"ST20798","hidraulico":"30860","separador":"ST28061"}'::jsonb, 17, NULL,
   'Specs Komatsu PC200-8. Motor SAA6D107E-1 6.7L 155hp. Final drive 4.5L cada. Swing 6.6L. Filtros OEM confirmados.', 'sistema', 'sistema'),
  -- Volvo EC55B PRO
  ('eh-006', 80, 7, '15W40 CI-4', 72, 'ISO 46 HVLP', NULL, NULL, NULL, 12, NULL, NULL, '12V 80Ah', 1, '{}'::jsonb, 5, NULL,
   'Specs Volvo EC55B PRO mini-escavadeira ~5.5t. Confirmar com manual.', 'sistema', 'sistema'),
  -- Caterpillar 12H
  ('mn-001', 305, 18, '15W40 CH-4', 56, 'ISO 68 HVLP', 60, 'Cat TDTO SAE 30', NULL, 40, '14.00-24', 6, '12V 100Ah', 2, '{}'::jsonb, 16, NULL,
   'Specs Cat 12H. Motor 3306T 10.4L. Tandem (cada) 64L. Confirmar com manual.', 'sistema', 'sistema'),
  ('mn-002', 305, 18, '15W40 CH-4', 56, 'ISO 68 HVLP', 60, 'Cat TDTO SAE 30', NULL, 40, '14.00-24', 6, '12V 100Ah', 2, '{}'::jsonb, 16, NULL,
   'Specs Cat 12H. Motor 3306T 10.4L. Tandem (cada) 64L. Confirmar com manual.', 'sistema', 'sistema'),
  -- Caterpillar 924K
  ('pc-001', 174, 16, '15W40 CH-4', 99, 'ISO 68 HVLP', 30, 'Cat TDTO SAE 30', NULL, 24, '17.5R25', 4, '12V 100Ah', 2, '{}'::jsonb, 12, NULL,
   'Specs Cat 924K. Motor Cat C6.6 ACERT. Confirmar com manual.', 'sistema', 'sistema'),
  -- Case W20
  ('pc-002', 200, 18, '15W40 CH-4', 95, 'ISO 68 HVLP', NULL, NULL, NULL, 25, '17.5R25', 4, '12V 100Ah', 2, '{}'::jsonb, 14, NULL,
   'Specs Case W20 antiga ~9t. Motor 6 cilindros. Confirmar com manual.', 'sistema', 'sistema'),
  -- Caterpillar 416E
  ('rt-001', 144, 10, '15W40 CH-4', 95, 'ISO 68 HVLP', NULL, NULL, NULL, 15, '19.5L-24', 2, '12V 100Ah', 1, '{}'::jsonb, 7, NULL,
   'Specs Cat 416E. Motor C4.4 DITA 4.4L 87hp. Pneus dianteiros 12.5/80-18 / traseiros 19.5L-24. Confirmar com manual.', 'sistema', 'sistema'),
  ('rt-002', 144, 10, '15W40 CH-4', 95, 'ISO 68 HVLP', NULL, NULL, NULL, 15, '19.5L-24', 2, '12V 100Ah', 1, '{}'::jsonb, 7, NULL,
   'Specs Cat 416E. Motor C4.4 DITA 4.4L 87hp. Pneus dianteiros 12.5/80-18 / traseiros 19.5L-24. Confirmar com manual.', 'sistema', 'sistema'),
  -- Volvo MC110C
  ('mc-001', 95, 9, '15W40 CI-4', 60, 'ISO 46 HVLP', NULL, NULL, NULL, 12, '12-16.5', 4, '12V 80Ah', 1, '{}'::jsonb, 7, NULL,
   'Specs Volvo MC110C minicarregadeira ~3t. Confirmar com manual.', 'sistema', 'sistema'),
  -- Bobcat S450 (id customizado)
  ('moul02cymgzg1', 52, 4.5, '15W40 CI-4', 27, 'ISO 46 HVLP', NULL, NULL, NULL, 6, '10-16.5', 4, '12V 50Ah', 1, '{}'::jsonb, 4, NULL,
   'Specs Bobcat S450 minicarregadeira ~1.5t. Motor Kubota D1305 24.8hp. Confirmar com manual.', 'sistema', 'sistema'),
  -- Caterpillar CB10
  ('rc-001', 200, 9, '15W40 CI-4', 32, 'ISO 46 HVLP', NULL, NULL, NULL, 15, NULL, NULL, '12V 80Ah', 1, '{}'::jsonb, 6, NULL,
   'Specs Cat CB10 rolo chapa 10t. Motor 3.4L ~100hp. Confirmar com manual.', 'sistema', 'sistema'),
  -- Caterpillar CW34
  ('rp-001', 215, 11, '15W40 CI-4', 50, 'ISO 46 HVLP', NULL, NULL, NULL, 20, '11.00-20', 9, '12V 80Ah', 1, '{}'::jsonb, 8, NULL,
   'Specs Cat CW34 rolo pneumático. Motor 4.4L. 9 pneus. Confirmar com manual.', 'sistema', 'sistema'),
  -- Caterpillar CP-56
  ('rpc-001', 244, 11, '15W40 CI-4', 45, 'ISO 46 HVLP', NULL, NULL, NULL, 18, NULL, NULL, '12V 100Ah', 1, '{}'::jsonb, 8, NULL,
   'Specs Cat CP-56 rolo pé de carneiro 11t. Confirmar com manual.', 'sistema', 'sistema'),
  ('rpc-002', 244, 11, '15W40 CI-4', 45, 'ISO 46 HVLP', NULL, NULL, NULL, 18, NULL, NULL, '12V 100Ah', 1, '{}'::jsonb, 8, NULL,
   'Specs Cat CP-56 rolo pé de carneiro 11t. Confirmar com manual.', 'sistema', 'sistema'),
  -- Dynapac CA260
  ('rpc-003', 230, 11, '15W40 CI-4', 45, 'ISO 46 HVLP', NULL, NULL, NULL, 18, NULL, NULL, '12V 100Ah', 1, '{}'::jsonb, 9, NULL,
   'Specs Dynapac CA260 ~12t. Motor Cummins 4.5L. Confirmar com manual.', 'sistema', 'sistema'),
  -- DAF XF 530 FTT
  ('cs-002', 570, 36, '10W40 ACEA E7', NULL, NULL, 16, 'SAE 75W-90 GL-5', 40, 45, '295/80R22.5', 10, '12V 175Ah', 2, '{}'::jsonb, NULL, 1.8,
   'Specs DAF XF 530 FTT 6x4. Motor PACCAR MX13 12.9L 530cv. Tanques 370+200L. Confirmar com manual.', 'sistema', 'sistema'),
  ('cs-003', 570, 36, '10W40 ACEA E7', NULL, NULL, 16, 'SAE 75W-90 GL-5', 40, 45, '295/80R22.5', 10, '12V 175Ah', 2, '{}'::jsonb, NULL, 1.8,
   'Specs DAF XF 530 FTT 6x4. Motor PACCAR MX13 12.9L 530cv. Tanques 370+200L. Confirmar com manual.', 'sistema', 'sistema'),
  ('cs-004', 570, 36, '10W40 ACEA E7', NULL, NULL, 16, 'SAE 75W-90 GL-5', 40, 45, '295/80R22.5', 10, '12V 175Ah', 2, '{}'::jsonb, NULL, 1.8,
   'Specs DAF XF 530 FTT 6x4. Motor PACCAR MX13 12.9L 530cv. Tanques 370+200L. Confirmar com manual.', 'sistema', 'sistema'),
  ('cs-005', 570, 36, '10W40 ACEA E7', NULL, NULL, 16, 'SAE 75W-90 GL-5', 40, 45, '295/80R22.5', 10, '12V 175Ah', 2, '{}'::jsonb, NULL, 1.8,
   'Specs DAF XF 530 FTT 6x4. Motor PACCAR MX13 12.9L 530cv. Tanques 370+200L. Confirmar com manual.', 'sistema', 'sistema'),
  -- Mercedes 2644 S/33
  ('cs-001', 380, 35, '15W40 CI-4', NULL, NULL, 16, 'SAE 90 GL-5', 32, 50, '295/80R22.5', 10, '12V 150Ah', 2, '{}'::jsonb, NULL, 1.8,
   'Specs Mercedes 2644 S/33. Motor OM-460 LA 12L 428cv. Confirmar com manual.', 'sistema', 'sistema'),
  -- JCB 540-170
  ('te-001', 130, 9.5, '15W40 CH-4', 95, 'ISO 46 HVLP', NULL, NULL, NULL, 18, '460/70-24', 4, '12V 100Ah', 1, '{}'::jsonb, 7, NULL,
   'Specs JCB 540-170 telescópio ~17m. Motor JCB 4.4L 125hp. Confirmar com manual.', 'sistema', 'sistema'),
  -- Caterpillar D6N XL
  ('tre-001', 410, 18, '15W40 CH-4', 95, 'ISO 68 HVLP', NULL, NULL, 17, 24, NULL, NULL, '12V 100Ah', 2, '{}'::jsonb, 22, NULL,
   'Specs Cat D6N XL ~18t. Motor Cat C6.6 ACERT 150hp. Sapata 560mm. Final drive 17L cada. Confirmar com manual.', 'sistema', 'sistema'),
  -- Ciber AF4500
  ('vb-001', 300, 17, '15W40 CI-4', 200, 'ISO 46 HVLP', NULL, NULL, NULL, 25, NULL, NULL, '12V 100Ah', 2, '{}'::jsonb, 14, NULL,
   'Specs Ciber AF4500. Motor Cummins QSB 6.7L. Pavimentação até 13t/h. Confirmar com manual.', 'sistema', 'sistema'),
  -- Ford 1517 (Meloza)
  ('mz-001', 150, 14, '15W40 CI-4', NULL, NULL, 8, 'SAE 90 GL-5', 9, 20, '900-20', 6, '12V 100Ah', 2, '{}'::jsonb, NULL, 3.5,
   'Specs Ford Cargo 1517. Motor Cummins ISBe 4.5L 170cv. Confirmar com manual.', 'sistema', 'sistema')
ON CONFLICT (equipamento_id) DO UPDATE SET
  capacidade_tanque_l = EXCLUDED.capacidade_tanque_l,
  capacidade_oleo_motor_l = EXCLUDED.capacidade_oleo_motor_l,
  tipo_oleo_motor = EXCLUDED.tipo_oleo_motor,
  capacidade_oleo_hidraulico_l = EXCLUDED.capacidade_oleo_hidraulico_l,
  tipo_oleo_hidraulico = EXCLUDED.tipo_oleo_hidraulico,
  capacidade_oleo_transmissao_l = EXCLUDED.capacidade_oleo_transmissao_l,
  tipo_oleo_transmissao = EXCLUDED.tipo_oleo_transmissao,
  capacidade_oleo_diferencial_l = EXCLUDED.capacidade_oleo_diferencial_l,
  capacidade_arrefecedor_l = EXCLUDED.capacidade_arrefecedor_l,
  pneu_medida = EXCLUDED.pneu_medida,
  pneu_qtd = EXCLUDED.pneu_qtd,
  bateria_especificacao = EXCLUDED.bateria_especificacao,
  bateria_qtd = EXCLUDED.bateria_qtd,
  filtros = EXCLUDED.filtros,
  consumo_esperado_l_h = EXCLUDED.consumo_esperado_l_h,
  consumo_esperado_km_l = EXCLUDED.consumo_esperado_km_l,
  observacoes_tecnicas = EXCLUDED.observacoes_tecnicas,
  updated_by = EXCLUDED.updated_by,
  updated_at = now();
