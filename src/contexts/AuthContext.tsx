import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { AcaoPermissao, ModuloPermissao, PermissoesFuncionario, SessaoUsuario } from '../types';
import { supabase } from '../lib/supabase';
import { dbToFuncionario, dbToPerfilPermissao } from '../lib/mappers';
import { perfilPadraoPorCargo, acoesPadraoDoCargo } from '../utils/permissions';
import { adicionarAuditLogAsync } from '../hooks/useAuditLog';

interface AuthContextValue {
  usuario: SessaoUsuario | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, senha: string, lembrarMe: boolean) => Promise<{ ok: boolean; erro?: string; bloqueadoAte?: number }>;
  logout: () => Promise<void>;
  temPermissao: (modulo: ModuloPermissao, acao: AcaoPermissao) => boolean;
  temAlgumaPermissao: (modulo: ModuloPermissao) => boolean;
  temAcao: (chave: string) => boolean;
  atualizarSessao: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function buildSessao(authUserId: string, lembrarMe: boolean): Promise<SessaoUsuario | null> {
  const { data: funcRow, error: funcError } = await supabase
    .from('funcionarios')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single();

  if (funcError || !funcRow) return null;

  const func = dbToFuncionario(funcRow);

  const { data: permRow } = await supabase
    .from('perfis_permissao')
    .select('*')
    .eq('funcionario_id', func.id)
    .single();

  let permissoes: PermissoesFuncionario;
  if (permRow) {
    permissoes = dbToPerfilPermissao(permRow).permissoes;
  } else {
    permissoes = perfilPadraoPorCargo(func.cargo);
  }

  // Fallback: se o usuário não tem `acoesPermitidas` salvas (null ou
  // array vazio), aplica o template padrão do cargo. Sem isso, com o
  // fail-CLOSED do `temAcao`, o usuário fica sem acesso a nada.
  //
  // Importante: NÃO mesclamos o template com o que está salvo. Se o
  // admin desmarcou alguma chave do próprio usuário (ou de outro
  // qualquer), essa decisão É respeitada. O template só entra quando
  // o array está totalmente vazio (usuário novo nunca configurado).
  //
  // O risco de Admin se trancar fora é mitigado por:
  //   1. Validação no FuncionarioForm — não deixa salvar Admin sem
  //      `ver_funcionarios`, `editar_funcionarios`, `gerenciar_permissoes`.
  //   2. Esta lógica de fallback — Admin com banco vazio recebe TUDO.
  let acoesPermitidas = func.acoesPermitidas;
  if (!acoesPermitidas || acoesPermitidas.length === 0) {
    acoesPermitidas = acoesPadraoDoCargo(func.cargo);
  }

  const now = Date.now();
  return {
    funcionarioId: func.id,
    nome: func.nome,
    email: func.email,
    cargo: func.cargo,
    permissoes,
    loginAt: now,
    expiresAt: lembrarMe ? now + 7 * 24 * 60 * 60 * 1000 : now + 8 * 60 * 60 * 1000,
    lembrarMe,
    acoesPermitidas,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<SessaoUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  const loginHandledRef = useRef(false);

  // Limpa flag obsoleta do modo de teste de permissões (rodada anterior).
  useEffect(() => {
    try {
      localStorage.removeItem('emt-modo-teste-permissoes');
    } catch {
      // silencia
    }
  }, []);

  // Bootstrap: check if there's an existing Supabase session
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && !loginHandledRef.current) {
          const sessao = await buildSessao(session.user.id, true);
          if (mounted) setUsuario(sessao);
        }
      } catch {
        // Session expired or corrupt — ignore and show login
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    // Listen only for sign-out events.
    // SIGNED_IN is NOT handled here to avoid race conditions with the login() function
    // (the onAuthStateChange closure captures a stale `usuario` value).
    // Session restoration on page refresh is handled by init() above.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        if (mounted) {
          loginHandledRef.current = false;
          setUsuario(null);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, senha: string, lembrarMe: boolean) => {
    const emailLower = email.toLowerCase();

    // Check lockout via RPC (login_attempts não é mais acessível direto)
    const { data: lockData } = await supabase.rpc('is_login_locked', { p_email: emailLower });
    if (lockData?.locked) {
      return { ok: false, erro: 'bloqueado', bloqueadoAte: lockData.bloqueado_ate };
    }

    // Attempt Supabase Auth sign-in
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: senha });

    if (authError) {
      // Register failed attempt via RPC (anon-callable, SECURITY DEFINER)
      const { data: attempt } = await supabase.rpc('register_failed_login', { p_email: emailLower });
      if (attempt?.bloqueado_ate && attempt.bloqueado_ate > 0) {
        return { ok: false, erro: 'bloqueado', bloqueadoAte: attempt.bloqueado_ate };
      }
      const restantes = attempt?.restantes ?? 4;
      return { ok: false, erro: `Credenciais inválidas. ${restantes} tentativa(s) restante(s).` };
    }

    // Get the user from the session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, erro: 'Erro ao obter usuário.' };

    // Check funcionario status
    const { data: funcRow } = await supabase
      .from('funcionarios')
      .select('status')
      .eq('auth_user_id', user.id)
      .single();

    if (!funcRow) return { ok: false, erro: 'Funcionário não encontrado no sistema.' };
    if (funcRow.status === 'inativo') {
      await supabase.auth.signOut();
      return { ok: false, erro: 'Funcionário inativo. Contate o administrador.' };
    }

    // Clear login attempts via RPC (authenticated)
    await supabase.rpc('clear_login_attempts', { p_email: emailLower });

    // Build session
    const sessao = await buildSessao(user.id, lembrarMe);
    if (!sessao) {
      await supabase.auth.signOut();
      return { ok: false, erro: 'Erro ao carregar dados do funcionário.' };
    }

    loginHandledRef.current = true;
    setUsuario(sessao);

    adicionarAuditLogAsync({
      tipo: 'login',
      funcionarioId: sessao.funcionarioId,
      detalhes: `Login realizado por ${sessao.nome}`,
    });

    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    if (usuario) {
      adicionarAuditLogAsync({
        tipo: 'logout',
        funcionarioId: usuario.funcionarioId,
        detalhes: `Logout realizado por ${usuario.nome}`,
      });
    }
    await supabase.auth.signOut();
    setUsuario(null);
  }, [usuario]);

  const temPermissao = useCallback((modulo: ModuloPermissao, acao: AcaoPermissao): boolean => {
    if (!usuario) return false;
    const acoesDoModulo = usuario.permissoes?.[modulo];
    if (!acoesDoModulo || acoesDoModulo.length === 0) return false;
    return acoesDoModulo.includes(acao);
  }, [usuario]);

  const temAlgumaPermissao = useCallback((modulo: ModuloPermissao): boolean => {
    if (!usuario) return false;
    const acoesDoModulo = usuario.permissoes?.[modulo];
    return !!acoesDoModulo && acoesDoModulo.length > 0;
  }, [usuario]);

  const temAcao = useCallback((chave: string): boolean => {
    if (!usuario) return false;
    // Sem bypass de Administrador: TODOS respeitam `acoesPermitidas`.
    // O cargo Administrador recebe naturalmente todas as 238 chaves no
    // template (`PERFIL_ADMINISTRADOR` em permissions.ts), então em
    // operação normal continua tendo acesso a tudo. Mas se o admin
    // desmarcar uma chave do próprio usuário, isso passa a valer.
    //
    // Fail-CLOSED: se o array não foi carregado (null/undefined/vazio),
    // ninguém tem acesso. Isso evita que um usuário recém-criado sem
    // permissões configuradas acabe com acesso total.
    if (!usuario.acoesPermitidas || usuario.acoesPermitidas.length === 0) return false;
    return usuario.acoesPermitidas.includes(chave);
  }, [usuario]);

  const atualizarSessao = useCallback(async () => {
    if (!usuario) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const novaSessao = await buildSessao(user.id, usuario.lembrarMe);
    if (novaSessao) setUsuario(novaSessao);
  }, [usuario]);

  return (
    <AuthContext.Provider
      value={{
        usuario,
        isAuthenticated: !!usuario,
        loading,
        login,
        logout,
        temPermissao,
        temAlgumaPermissao,
        temAcao,
        atualizarSessao,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
