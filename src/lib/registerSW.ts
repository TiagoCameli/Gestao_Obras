// Marco 5 / PR23 — Registro do Service Worker.
//
// Registra apenas em produção (vite-dev usa HMR e não combina com SW).
// Faz polling de update a cada 30 minutos e quando o app volta do background.
// Em caso de novo SW, dispara um console.info; UI de "atualizar" pode vir
// em PR posterior se virar incômodo.

export function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return; // dev: sem SW

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.info('[SW] registrado', reg.scope);

        // Polling de update
        setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);

        // Check ao voltar do background
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) reg.update().catch(() => {});
        });

        // Quando um novo SW é instalado, force skip-waiting pra ativar logo
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              console.info('[SW] novo disponível — ativando');
              nw.postMessage('SKIP_WAITING');
            }
          });
        });

        // Quando o SW novo assume controle, recarrega pra pegar a versão nova
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      })
      .catch((err) => {
        console.error('[SW] falha ao registrar:', err);
      });
  });
}
