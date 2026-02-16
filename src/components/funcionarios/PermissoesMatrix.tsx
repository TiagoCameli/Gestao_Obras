import { useState } from 'react';
import type { AcaoPermissao, CargoFuncionario, Funcionario, ModuloPermissao, PermissoesFuncionario, PerfilPermissao } from '../../types';
import { MODULOS, ACOES, PERFIS_PADRAO, CARGOS } from '../../utils/permissions';
import { useSalvarPerfilPermissao } from '../../hooks/useFuncionarios';
import Button from '../ui/Button';

interface PermissoesMatrixProps {
  funcionario: Funcionario;
  perfilPermissao?: PerfilPermissao | null;
  onClose: () => void;
  onSaved: () => void;
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function PermissoesMatrix({ funcionario, perfilPermissao, onClose, onSaved }: PermissoesMatrixProps) {
  const salvarPerfilMutation = useSalvarPerfilPermissao();

  const [permissoes, setPermissoes] = useState<PermissoesFuncionario>(() => {
    return perfilPermissao ? { ...perfilPermissao.permissoes } : PERFIS_PADRAO[funcionario.cargo];
  });

  function toggle(modulo: ModuloPermissao, acao: AcaoPermissao) {
    setPermissoes((prev) => {
      const atual = [...prev[modulo]];
      const idx = atual.indexOf(acao);
      if (idx >= 0) {
        atual.splice(idx, 1);
      } else {
        atual.push(acao);
      }
      return { ...prev, [modulo]: atual };
    });
  }

  function aplicarPerfil(cargo: CargoFuncionario) {
    setPermissoes({ ...PERFIS_PADRAO[cargo] });
  }

  async function handleSalvar() {
    await salvarPerfilMutation.mutateAsync({
      id: perfilPermissao?.id || gerarId(),
      funcionarioId: funcionario.id,
      permissoes,
    });
    onSaved();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{funcionario.nome}</h3>
          <p className="text-sm text-gray-500">Cargo: {funcionario.cargo}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Aplicar perfil:</span>
          <select
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
            value=""
            onChange={(e) => {
              if (e.target.value) aplicarPerfil(e.target.value as CargoFuncionario);
            }}
          >
            <option value="">Selecione...</option>
            {CARGOS.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Modulo</th>
              {ACOES.map((a) => (
                <th key={a.valor} className="text-center px-3 py-2.5 font-medium text-gray-600">
                  {a.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {MODULOS.map((m) => (
              <tr key={m.valor} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-700">{m.label}</td>
                {ACOES.map((a) => {
                  // Dashboard: only visualizar and ajustar_filtros
                  if (m.valor === 'dashboard' && a.valor !== 'visualizar' && a.valor !== 'ajustar_filtros') {
                    return <td key={a.valor} className="text-center px-3 py-2.5"><span className="text-gray-300">-</span></td>;
                  }
                  // Ajustar filtros only for dashboard
                  if (a.valor === 'ajustar_filtros' && m.valor !== 'dashboard') {
                    return <td key={a.valor} className="text-center px-3 py-2.5"><span className="text-gray-300">-</span></td>;
                  }
                  // Exportar only for combustivel and insumos
                  if (a.valor === 'exportar' && m.valor !== 'combustivel' && m.valor !== 'insumos') {
                    return <td key={a.valor} className="text-center px-3 py-2.5"><span className="text-gray-300">-</span></td>;
                  }
                  const checked = permissoes[m.valor]?.includes(a.valor) || false;
                  return (
                    <td key={a.valor} className="text-center px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(m.valor, a.valor)}
                        className="w-4 h-4 text-emt-verde border-gray-300 rounded focus:ring-emt-verde"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSalvar}>Salvar Permissoes</Button>
      </div>
    </div>
  );
}
