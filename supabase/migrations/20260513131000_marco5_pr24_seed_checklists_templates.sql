-- Marco 5 / PR24 seed: 4 templates prontos com perguntas reais de mercado.

-- === Template 1: Escavadeira Hidráulica ===
insert into checklists_template (id, nome, tipo_equipamento, versao, ativo, observacoes, created_by)
values ('tpl-escav-hidr', 'Inspeção pré-uso — Escavadeira Hidráulica', 'Escavadeira Hidráulica', 1, true,
  'Checklist diário antes de iniciar operação. Resposta esperada é Sim em todos os itens.', 'sistema');

insert into checklist_perguntas (id, template_id, ordem, categoria, pergunta, descricao, obrigatoria, critica) values
  ('q-eh-1', 'tpl-escav-hidr', 10, 'motor', 'Nível do óleo do motor está adequado?', 'Verificar pela vareta; deve estar entre o mínimo e máximo.', true, true),
  ('q-eh-2', 'tpl-escav-hidr', 20, 'motor', 'Nível do líquido de arrefecimento está adequado?', 'Reservatório do radiador; nunca abrir com motor quente.', true, true),
  ('q-eh-3', 'tpl-escav-hidr', 30, 'hidraulico', 'Nível do óleo hidráulico está dentro do mínimo?', 'Visor do tanque hidráulico.', true, true),
  ('q-eh-4', 'tpl-escav-hidr', 40, 'hidraulico', 'Não há vazamento visível de óleo hidráulico?', 'Verificar mangueiras, cilindros da lança/braço/caçamba.', true, true),
  ('q-eh-5', 'tpl-escav-hidr', 50, 'mecanica', 'Esteiras e roletes estão em bom estado?', 'Tensão da esteira, ausência de elos quebrados.', true, false),
  ('q-eh-6', 'tpl-escav-hidr', 60, 'mecanica', 'Dentes da caçamba estão íntegros?', 'Verificar travas e desgaste.', true, false),
  ('q-eh-7', 'tpl-escav-hidr', 70, 'eletrica', 'Bateria conectada e sem corrosão?', 'Terminais limpos e firmes.', true, false),
  ('q-eh-8', 'tpl-escav-hidr', 80, 'eletrica', 'Faróis, sinaleiras e buzina funcionando?', 'Testar antes de mover o equipamento.', true, false),
  ('q-eh-9', 'tpl-escav-hidr', 90, 'geral', 'Cabine limpa e sem obstrução nos controles?', 'Joysticks, pedais e alavancas livres.', true, false),
  ('q-eh-10','tpl-escav-hidr', 100, 'geral', 'Extintor de incêndio presente e válido?', 'Verificar carga e validade.', true, true);

-- === Template 2: Caminhão Basculante ===
insert into checklists_template (id, nome, tipo_equipamento, versao, ativo, observacoes, created_by)
values ('tpl-cam-basc', 'Inspeção pré-uso — Caminhão Basculante', 'Caminhão Basculante', 1, true,
  'Checklist diário antes de iniciar operação no caminhão.', 'sistema');

insert into checklist_perguntas (id, template_id, ordem, categoria, pergunta, descricao, obrigatoria, critica) values
  ('q-cb-1', 'tpl-cam-basc', 10, 'motor', 'Nível do óleo do motor está adequado?', 'Vareta de óleo; motor frio ou desligado há 5min.', true, true),
  ('q-cb-2', 'tpl-cam-basc', 20, 'motor', 'Água do radiador está no nível?', 'Reservatório de expansão.', true, true),
  ('q-cb-3', 'tpl-cam-basc', 30, 'freios', 'Freio de serviço e estacionamento funcionando?', 'Teste com motor ligado.', true, true),
  ('q-cb-4', 'tpl-cam-basc', 40, 'freios', 'Reservatório de ar do freio está pressurizando?', 'Manômetro deve atingir pressão de trabalho em <2min.', true, true),
  ('q-cb-5', 'tpl-cam-basc', 50, 'pneus', 'Pneus em bom estado (sem cortes profundos, sulcos visíveis)?', 'Inspeção visual em todos.', true, false),
  ('q-cb-6', 'tpl-cam-basc', 60, 'pneus', 'Calibragem dos pneus está correta?', 'Pressão recomendada pelo fabricante.', true, false),
  ('q-cb-7', 'tpl-cam-basc', 70, 'eletrica', 'Faróis, lanternas, setas e luz de freio funcionando?', 'Verificar todas as luzes.', true, true),
  ('q-cb-8', 'tpl-cam-basc', 80, 'eletrica', 'Buzina e alarme de ré funcionando?', '', true, true),
  ('q-cb-9', 'tpl-cam-basc', 90, 'mecanica', 'Caçamba sem rachaduras visíveis e travas operando?', 'Verificar pino travesseiro e ganchos.', true, false),
  ('q-cb-10','tpl-cam-basc', 100, 'mecanica', 'Pneu estepe e ferramentas básicas disponíveis?', 'Chave de roda, macaco hidráulico, triângulo.', true, false),
  ('q-cb-11','tpl-cam-basc', 110, 'geral', 'Documentação do veículo em dia (CRLV, CNH motorista)?', '', true, true),
  ('q-cb-12','tpl-cam-basc', 120, 'geral', 'Cinto de segurança funcionando?', '', true, true);

-- === Template 3: Veículo Leve (carro, caminhonete) ===
insert into checklists_template (id, nome, tipo_equipamento, versao, ativo, observacoes, created_by)
values ('tpl-veic-leve', 'Inspeção pré-uso — Veículo Leve', 'Veículo Leve', 1, true,
  'Checklist diário para carros e caminhonetes.', 'sistema');

insert into checklist_perguntas (id, template_id, ordem, categoria, pergunta, descricao, obrigatoria, critica) values
  ('q-vl-1', 'tpl-veic-leve', 10, 'motor', 'Nível do óleo do motor adequado?', '', true, true),
  ('q-vl-2', 'tpl-veic-leve', 20, 'motor', 'Nível da água do radiador adequado?', '', true, true),
  ('q-vl-3', 'tpl-veic-leve', 30, 'freios', 'Pedal do freio firme (sem afundar)?', '', true, true),
  ('q-vl-4', 'tpl-veic-leve', 40, 'pneus', 'Pneus calibrados e sem desgaste excessivo?', 'Incluindo estepe.', true, false),
  ('q-vl-5', 'tpl-veic-leve', 50, 'eletrica', 'Faróis, lanternas, setas e freio funcionando?', '', true, false),
  ('q-vl-6', 'tpl-veic-leve', 60, 'geral', 'Documentação em dia (CRLV, CNH)?', '', true, true),
  ('q-vl-7', 'tpl-veic-leve', 70, 'geral', 'Cinto de segurança funcionando?', '', true, true),
  ('q-vl-8', 'tpl-veic-leve', 80, 'geral', 'Sem barulho ou vibração anormal ao dar partida?', '', true, false);

-- === Template 4: Retroescavadeira ===
insert into checklists_template (id, nome, tipo_equipamento, versao, ativo, observacoes, created_by)
values ('tpl-retro', 'Inspeção pré-uso — Retroescavadeira', 'Retroescavadeira', 1, true,
  'Checklist diário para retroescavadeiras.', 'sistema');

insert into checklist_perguntas (id, template_id, ordem, categoria, pergunta, descricao, obrigatoria, critica) values
  ('q-rt-1', 'tpl-retro', 10, 'motor', 'Nível do óleo do motor adequado?', '', true, true),
  ('q-rt-2', 'tpl-retro', 20, 'motor', 'Nível da água do radiador adequado?', '', true, true),
  ('q-rt-3', 'tpl-retro', 30, 'hidraulico', 'Nível do óleo hidráulico adequado?', '', true, true),
  ('q-rt-4', 'tpl-retro', 40, 'hidraulico', 'Sem vazamento de óleo (mangueiras, cilindros)?', '', true, true),
  ('q-rt-5', 'tpl-retro', 50, 'mecanica', 'Pneus calibrados e sem cortes profundos?', '', true, false),
  ('q-rt-6', 'tpl-retro', 60, 'mecanica', 'Caçamba dianteira e retro-pá em bom estado?', '', true, false),
  ('q-rt-7', 'tpl-retro', 70, 'eletrica', 'Faróis, sinaleiras e buzina funcionando?', '', true, false),
  ('q-rt-8', 'tpl-retro', 80, 'eletrica', 'Alarme de ré e luz giratória funcionando?', '', true, true),
  ('q-rt-9', 'tpl-retro', 90, 'geral', 'Estabilizadores travando e descendo normalmente?', '', true, false),
  ('q-rt-10','tpl-retro', 100, 'geral', 'Cinto de segurança e extintor presentes?', '', true, true);
