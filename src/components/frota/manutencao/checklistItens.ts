export interface ItemChecklistDef {
  numero: string;
  descricao: string;
  categoria: string;
}

export const CHECKLIST_ITENS: ItemChecklistDef[] = [
  // Sistema elétrico
  { numero: '001', descricao: 'Os faróis dianteiros estão funcionando normalmente?', categoria: 'Sistema elétrico' },
  { numero: '002', descricao: 'O sinal luminoso de freio está funcionando normalmente?', categoria: 'Sistema elétrico' },
  { numero: '003', descricao: 'O sinal luminoso de ré está funcionando normalmente?', categoria: 'Sistema elétrico' },
  { numero: '004', descricao: 'O sinal sonoro de ré está funcionando normalmente?', categoria: 'Sistema elétrico' },
  { numero: '005', descricao: 'Os comandos do painel estão funcionando normalmente?', categoria: 'Sistema elétrico' },
  { numero: '006', descricao: 'O funcionamento do giroflex na máquina está interligado com cinto de segurança?', categoria: 'Sistema elétrico' },
  { numero: '007', descricao: 'O sinal sonoro (buzina) está funcionando normalmente?', categoria: 'Sistema elétrico' },

  // Segurança e estrutura
  { numero: '008', descricao: 'Possui proteção do cardã?', categoria: 'Segurança e estrutura' },
  { numero: '009', descricao: 'Correias ou outras partes móveis estão protegidas?', categoria: 'Segurança e estrutura' },
  { numero: '010', descricao: 'Retrovisores estão ok? (Direito e Esquerdo)', categoria: 'Segurança e estrutura' },
  { numero: '011', descricao: 'Suporte de apoio está ok? (Direito e Esquerdo)', categoria: 'Segurança e estrutura' },
  { numero: '012', descricao: 'Para-choque ok? (Direito e Esquerdo)', categoria: 'Segurança e estrutura' },
  { numero: '013', descricao: 'Pneus dianteiros ok? (Direito e Esquerdo)', categoria: 'Segurança e estrutura' },
  { numero: '014', descricao: 'Pneus traseiros ok? (Direito e Esquerdo)', categoria: 'Segurança e estrutura' },
  { numero: '015', descricao: 'Nível de água do radiador ok? (esperar 40 min com o veículo desligado)', categoria: 'Segurança e estrutura' },
  { numero: '016', descricao: 'Quebra-sol está em bom estado?', categoria: 'Segurança e estrutura' },
  { numero: '017', descricao: 'Extintor de incêndio com carga e validade ok?', categoria: 'Segurança e estrutura' },
  { numero: '018', descricao: 'A cabine está limpa?', categoria: 'Segurança e estrutura' },
  { numero: '019', descricao: 'Assoalho da cabine está em bom estado?', categoria: 'Segurança e estrutura' },
  { numero: '020', descricao: 'Condição de limpeza da parte externa ok?', categoria: 'Segurança e estrutura' },
  { numero: '021', descricao: 'Bancos estão em bom estado?', categoria: 'Segurança e estrutura' },
  { numero: '022', descricao: 'Escada de acesso em bom estado de conservação?', categoria: 'Segurança e estrutura' },
  { numero: '023', descricao: 'Faixa reflexiva está limpa?', categoria: 'Segurança e estrutura' },
  { numero: '024', descricao: 'Há danos materiais? (amassado/riscado)', categoria: 'Segurança e estrutura' },
  { numero: '025', descricao: 'Freio estacionário em boas condições?', categoria: 'Segurança e estrutura' },
  { numero: '026', descricao: 'A caixa está ok?', categoria: 'Segurança e estrutura' },
  { numero: '027', descricao: 'Nível de óleo do motor ok?', categoria: 'Segurança e estrutura' },

  // Sistema hidráulico
  { numero: '028', descricao: 'Há válvulas de segurança de bloqueio de retorno de óleo hidráulico?', categoria: 'Sistema hidráulico' },
  { numero: '029', descricao: 'Nível de óleo hidráulico ok?', categoria: 'Sistema hidráulico' },
  { numero: '030', descricao: 'Nível de óleo da embreagem ok?', categoria: 'Sistema hidráulico' },
  { numero: '031', descricao: 'Funcionamento do freio ok?', categoria: 'Sistema hidráulico' },
  { numero: '032', descricao: 'Comandos da lança em bom estado?', categoria: 'Sistema hidráulico' },
  { numero: '033', descricao: 'Há vazamento de óleo?', categoria: 'Sistema hidráulico' },
];

export const CHECKLIST_CATEGORIAS = [...new Set(CHECKLIST_ITENS.map((i) => i.categoria))];
