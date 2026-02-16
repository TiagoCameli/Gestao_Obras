import { useState } from 'react';
import { migrarParaSupabase, type MigrationProgress } from '../utils/migrateToSupabase';
import Button from '../components/ui/Button';

export default function MigrarDados() {
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [senha, setSenha] = useState('Admin@123');

  async function iniciar() {
    setRunning(true);
    setLogs([]);
    setDone(false);
    setError('');

    try {
      await migrarParaSupabase((p: MigrationProgress) => {
        setLogs((prev) => [...prev, p.step]);
        if (p.done) {
          setDone(true);
          if (p.error) setError(p.error);
        }
      }, senha);
    } catch {
      // error already set via callback
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Migrar Dados para Supabase
      </h1>

      <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <p className="text-sm text-gray-600 mb-4">
          Esta ferramenta migra todos os dados do localStorage para o Supabase.
          IDs existentes serao preservados. Registros ja existentes no Supabase
          serao atualizados (upsert).
        </p>

        <div className="mb-4">
          <label htmlFor="senhaDefault" className="block text-sm font-medium text-gray-700 mb-1">
            Senha padrao para usuarios Auth
          </label>
          <input
            id="senhaDefault"
            type="text"
            className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            disabled={running}
          />
          <p className="text-xs text-gray-400 mt-1">
            Todos os funcionarios serao criados com esta senha no Supabase Auth.
          </p>
        </div>

        <Button onClick={iniciar} disabled={running || !senha}>
          {running ? 'Migrando...' : 'Iniciar Migracao'}
        </Button>

        {logs.length > 0 && (
          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Log</h3>
            <div className="space-y-1">
              {logs.map((msg, i) => (
                <p key={i} className="text-xs text-gray-600 font-mono">
                  {msg}
                </p>
              ))}
            </div>
          </div>
        )}

        {done && !error && (
          <div className="mt-4 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">
            Migracao concluida com sucesso! Voce pode remover esta pagina apos
            verificar os dados no Supabase Dashboard.
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            Erro na migracao: {error}
          </div>
        )}
      </div>
    </div>
  );
}
