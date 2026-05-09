// F6.A — Error Boundary do módulo Combustível.
//
// Captura erros runtime de qualquer subtab (chart quebrado, mutation
// throw inesperado, NaN exception em compute, etc) que venham a escapar
// do try/catch local. Sem isso, um erro qualquer derruba o módulo inteiro
// pra white screen.
//
// Estratégia minimal:
//   - 1 boundary global no Container (último recurso)
//   - charts/queries específicos podem ter ErrorState inline (já implementado)
//   - "Tentar novamente" reseta o boundary (recria árvore React) — útil
//     pra erros transitórios; bugs persistentes vão re-disparar imediato
//
// Por que classe e não hook? React Error Boundaries só existem como
// classes — useErrorBoundary só vem em React 19+ se a feature for liberada.

import { Component, type ReactNode } from 'react';
import ErrorState from './ErrorState';

interface Props {
  children: ReactNode;
  /** Override do fallback completo. Se ausente, usa ErrorState padrão. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export default class CombustivelErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Sentry/log infra ainda não conectada — console por hora. Quando F7
    // trouxer logging centralizado, plugar aqui (sem mudar UX).
    console.error('[combustivel] error boundary caught:', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-surface-1)] m-4">
        <ErrorState
          title="Algo deu errado neste módulo"
          description="Um erro inesperado interrompeu a renderização. Tente novamente — se persistir, recarregue a página."
          errorMessage={error.message}
          onRetry={this.reset}
        />
      </div>
    );
  }
}
