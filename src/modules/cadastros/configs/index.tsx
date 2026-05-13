import type { AnyEntityConfig, EntityConfig } from '../types';
import { obrasConfig } from './obras.config';
import { localidadesConfig } from './localidades.config';
import { empresasConfig } from './empresas.config';
import { colaboradoresConfig } from './colaboradores.config';
import { insumosConfig } from './insumos.config';
import { tiposInsumoConfig } from './tiposInsumo.config';
import { categoriasMaterialConfig } from './categoriasMaterial.config';
import { unidadesConfig } from './unidades.config';
import { depositosMaterialConfig } from './depositosMaterial.config';
import { fornecedoresConfig } from './fornecedores.config';
import { tiposEquipamentoConfig } from './tiposEquipamento.config';
import { equipamentosConfig } from './equipamentos.config';
import { tanquesConfig } from './tanques.config';

export const ENTITY_CONFIGS: AnyEntityConfig[] = [
  // Obra & Estrutura
  obrasConfig as unknown as AnyEntityConfig,
  localidadesConfig as unknown as AnyEntityConfig,
  // Pessoas
  empresasConfig as unknown as AnyEntityConfig,
  colaboradoresConfig as unknown as AnyEntityConfig,
  // Materiais & Insumos
  insumosConfig as unknown as AnyEntityConfig,
  tiposInsumoConfig as unknown as AnyEntityConfig,
  categoriasMaterialConfig as unknown as AnyEntityConfig,
  unidadesConfig as unknown as AnyEntityConfig,
  depositosMaterialConfig as unknown as AnyEntityConfig,
  fornecedoresConfig as unknown as AnyEntityConfig,
  // Frota & Combustível
  tiposEquipamentoConfig as unknown as AnyEntityConfig,
  equipamentosConfig as unknown as AnyEntityConfig,
  tanquesConfig as unknown as AnyEntityConfig,
];

export function getEntityConfig(slug: string): AnyEntityConfig | undefined {
  return ENTITY_CONFIGS.find((c) => c.slug === slug);
}

/** External entry-points: cadastros that have their own dedicated page (kept outside the generic engine for now). */
export interface ExternalEntity {
  slug: string;
  singular: string;
  plural: string;
  description: string;
  category: 'obra' | 'pessoas' | 'materiais' | 'frota';
  accent?: 'green' | 'amber' | 'blue' | 'purple' | 'rose';
  icon: React.ReactNode;
  href: string;
  permission?: string;
  badge?: string;
}

export const EXTERNAL_ENTITIES: ExternalEntity[] = [
  {
    slug: 'etapas',
    singular: 'Etapa de obra',
    plural: 'Etapas de obra',
    description: 'Itens contratados por obra (mesmos dados da Medição de Contrato).',
    category: 'obra',
    accent: 'green',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
    href: '/cadastros/etapas',
    permission: 'ver_cadastros',
  },
  {
    slug: 'usuarios',
    singular: 'Usuário',
    plural: 'Usuários',
    description: 'Cadastro de usuários, perfis e permissões.',
    category: 'pessoas',
    accent: 'purple',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    href: '/cadastros/usuarios',
    permission: 'ver_funcionarios',
  },
];

export type { EntityConfig };
