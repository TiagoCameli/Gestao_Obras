# Design — Scanner de QR mobile in-app

**Data:** 2026-05-21
**Autor:** Tiago Cameli (brainstorm com Claude)
**Escopo:** rota mobile `/m`, adicionar scanner de QR que extrai ID do equipamento e navega in-app
**Relacionado:** fix de URL de QR (commit `10253b3`); 57 etiquetas físicas já impressas codificando `http://localhost:5175/m/eq/<id>`

## Problema

Em 2026-05-13, foram impressas 57 etiquetas QR pra frota. As etiquetas codificam URLs apontando pra `http://localhost:5175/m/eq/<id>` (bug: `equipamentoQrExport.ts` usava `window.location.origin` no momento da exportação, que estava em dev local). Quando o operador escaneia com a câmera nativa do iPhone/Android, o navegador tenta abrir `localhost:5175` no próprio aparelho — falha com erro "Não foi possível conectar".

**Restrição fundamental:** `localhost` é loopback do dispositivo. O pedido nunca sai do telefone, então `emtconstrutora.com` não pode interceptar. Não dá pra "redirecionar" remotamente.

**Decisão (brainstorm):** em vez de tentar interceptar URLs localhost (impossível), construir um scanner de QR dentro do próprio app. O scanner lê o QR físico, extrai apenas o ID do equipamento (ignora host) e navega in-app. Operadores são treinados a abrir o app antes de escanear.

## Solução

### Arquitetura

1. Botão "📷 Escanear QR do equipamento" prominente na home mobile (`/m`)
2. Botão abre rota nova `/m/scan` com câmera fullscreen
3. Decoder JS (`html5-qrcode`) lê QR em tempo real
4. Função pura `extractEquipamentoId(text)` extrai ID via regex
5. React Router navega in-app pra `/m/eq/<id>` → `MEquipamentoHubPage` abre normalmente

### Componentes / arquivos

**Novos:**
- `src/pages/mobile/MScanPage.tsx` (~120 LOC) — página fullscreen com câmera + decoder
- `src/utils/parseFreteQrUrl.ts` (~30 LOC) — função pura `extractEquipamentoId(text: string): string | null`
- `src/utils/parseFreteQrUrl.test.ts` — testes vitest (6 casos)

**Modificados:**
- `src/pages/mobile/MEquipamentosPage.tsx` — adicionar botão "📷 Escanear QR" no topo
- `src/App.tsx` — adicionar rota `<Route path="/m/scan" element={<MScanPage />} />` (autenticada, layout mobile)

**Dependência nova:** `html5-qrcode` (~50KB gzip).

**Carregamento lazy:** importar via `React.lazy(() => import('./MScanPage'))` no `App.tsx` pra não inflar bundle inicial — só carrega quando operador clica "Escanear".

### Função pura: extração do ID

```typescript
const PATH_REGEX = /\/m\/eq\/([a-z0-9-]{4,32})(?:[/?#]|$)/i;

export function extractEquipamentoId(text: string): string | null {
  if (!text || text.length > 500) return null;  // sanity guard
  const trimmed = text.trim();
  const match = trimmed.match(PATH_REGEX);
  if (match) return match[1];
  // Fallback: se o texto inteiro for um ID válido (raro, mas safety net)
  if (/^[a-z0-9-]{4,32}$/i.test(trimmed)) return trimmed;
  return null;
}
```

Aceita:
- `http://localhost:5175/m/eq/eh-001` → `eh-001`
- `http://localhost:5175/m/eq/moul02cymgzg1` → `moul02cymgzg1`
- `https://emtconstrutora.com/m/eq/eh-001` → `eh-001`
- `/m/eq/eh-001` (relativo) → `eh-001`
- `eh-001` (ID puro) → `eh-001`
- `https://phishing.example.com/m/eq/eh-001?token=xyz` → `eh-001`

> **Nota sobre host arbitrário:** o regex captura o path `/m/eq/<id>` independente do host. Não é vulnerabilidade — a navegação é interna (`react-router` `navigate()`), nunca usa o host do QR. Se o ID extraído não corresponder a um equipamento real, `MEquipamentoHubPage` mostra "não encontrado" (gated por RLS e perm do usuário).

Rejeita:
- `BEGIN:VCARD\nN:Tiago\nEND:VCARD` → `null`
- `Pix copia e cola...` → `null`
- `/m/eq/abc` (ID < 4 chars) → `null`
- string vazia, lixo → `null`

### UX do `/m/scan`

```
┌──────────────────────────────────────┐
│  ← Voltar              EMT Construtora │
├──────────────────────────────────────┤
│                                       │
│       ┌─────────────────────┐         │
│       │   [câmera traseira  │         │
│       │    viewfinder com   │         │
│       │    quadrado central │         │
│       │    + mira animada]  │         │
│       └─────────────────────┘         │
│                                       │
│   Aponte pro QR do equipamento        │
│                                       │
│   [💡 Lanterna]    [📷 Trocar câmera] │
└──────────────────────────────────────┘
```

### Estados da página

| Estado | Comportamento |
|---|---|
| Carregando câmera | Spinner + "Preparando câmera…" |
| Permissão negada | Mensagem clara + botão "Tentar novamente" + link "Como permitir câmera" |
| Pronto | Preview ao vivo + viewfinder quadrado overlay |
| QR detectado **e válido** | Vibração curta (`navigator.vibrate(100)` se disponível) + flash verde + `navigate('/m/eq/' + id)` |
| QR detectado **mas inválido** | Toast vermelho "QR não reconhecido" + scanner continua |
| Timeout (30s sem QR) | Mensagem "Aproxime mais ou melhore a iluminação" + scanner continua |

### Controles

- **💡 Lanterna**: `track.applyConstraints({ advanced: [{ torch: true }] })` — só funciona onde device + browser suportam (Android Chrome sim, iOS Safari não). Botão fica escondido se não disponível.
- **📷 Trocar câmera**: alterna entre `facingMode: 'environment'` (traseira, padrão) e `'user'` (frontal).

### Botão no `/m`

```
┌──────────────────────────────────────┐
│  EMT Construtora                      │
├──────────────────────────────────────┤
│                                       │
│  [📷 Escanear QR do equipamento]      │   ← grande, accent verde EMT
│                                       │
│  ─────────────────────────────────    │
│  🔍 Buscar equipamento…               │
│  [lista de equipamentos…]             │
└──────────────────────────────────────┘
```

## Compatibilidade

| Plataforma | Suporte câmera | Suporte torch |
|---|---|---|
| Safari iOS 15+ | ✅ via `getUserMedia` (HTTPS obrigatório) | ❌ |
| Chrome Android | ✅ | ✅ |
| Chrome Desktop | ✅ | ⚠️ depende de hardware |
| Safari iOS < 15 | ❌ — mostra mensagem "Atualize seu iOS" | — |

**HTTPS:** `getUserMedia` exige contexto seguro. Produção (`emtconstrutora.com`) é HTTPS ✓. Localhost dev é exceção permitida pelo browser.

## Testes

| Tipo | Cobertura |
|---|---|
| Vitest unit | `extractEquipamentoId` — 6 casos: full URL com host, URL com query string, path relativo, ID puro, vCard, string vazia |
| Playwright E2E | **Não** — câmera real em headless é inviável. Skip explicitamente |
| Manual | iPhone (Safari) + Android (Chrome) — permissão, lanterna, troca câmera, scan QR válido (incluindo um QR com `localhost`), scan QR inválido (vCard, URL aleatória), iOS sem permissão |

## Security review

`/security-review` antes do commit. Esperado: `NO_FINDINGS`.
- Câmera é client-side, dado não sai do dispositivo (a menos que envie pra storage — não envia)
- `extractEquipamentoId` valida via regex e tem cap de 500 chars (sanity guard contra DoS de regex)
- Navegação é dentro do SPA (`react-router-dom`), não `window.location.href = ...` — então URLs externas no QR não conseguem redirecionar pro fora do app
- Não há nova policy de banco, nova RPC, novo bucket

## Rollout

1. Branch `feat/qr-scanner-mobile`
2. Implementar (estimativa: 1 dia):
   - `parseFreteQrUrl.ts` + testes (TDD)
   - `MScanPage.tsx` com `html5-qrcode`
   - Botão em `MEquipamentosPage`
   - Rota em `App.tsx` (lazy)
3. `npm run build && npm test`
4. `/security-review`
5. Preview deploy → testar em iPhone real + Android real
6. Promover prod → push
7. **Treinamento dos operadores:**
   - Cartaz visual no canteiro de obra explicando o fluxo: "Abra o app EMT → toque em 📷 Escanear → aponte pra etiqueta"
   - Reunião de 15min com cada equipe

## Riscos

| Risco | Mitigação |
|---|---|
| Operador esquece de abrir o app primeiro e usa câmera nativa → erro localhost | Treinamento + cartaz visual. Em médio prazo, substituir etiquetas físicas (escopo separado) |
| iOS < 15 não suporta `getUserMedia` | Detectar e mostrar mensagem clara. Improvável em uso típico (operadores em 2026 já têm iOS 16+) |
| Câmera não foca em QR pequeno ou em movimento | Operador chega mais perto. Treinamento. `html5-qrcode` faz auto-foco contínuo. |
| `html5-qrcode` 50KB extra | Lazy via `React.lazy` — só carrega quando entrar em `/m/scan`. Não impacta build inicial nem outras rotas |
| QR de phishing scaneado contém path `/m/eq/X` válido | Cap de 500 chars no input + regex estrita. Navegação só pra rota interna conhecida; servidor faz auth + RLS |

## Out of scope (não vou fazer)

- ❌ Auto-correção de URLs estranhas além do regex `/m/eq/<id>`
- ❌ Histórico de QR scaneados
- ❌ Scan de QR pra outros recursos (fornecedor, obra, frete) — só equipamento
- ❌ Substituir etiquetas físicas (escopo separado, fora deste design)
- ❌ Compatibilidade com câmeras de outros apps (Telegram, WhatsApp scanner) — só Safari/Chrome nativos
- ❌ Decoder própria sem `html5-qrcode` (manter código mínimo)

## Critérios de aceitação

- ✅ Botão "📷 Escanear QR" visível em `/m` no topo
- ✅ Rota `/m/scan` abre câmera fullscreen
- ✅ Permissão de câmera solicitada na primeira vez; gravada após
- ✅ QR válido (qualquer formato listado em "Aceita") → navega pra `/m/eq/<id>`
- ✅ QR inválido (vCard, URL externa sem path conhecido) → toast erro, scanner continua
- ✅ Botão de lanterna aparece só onde suportado
- ✅ Botão de trocar câmera funciona
- ✅ Funciona em iPhone Safari (iOS 15+) e Android Chrome
- ✅ `extractEquipamentoId` tem 6 testes vitest verdes
- ✅ `/security-review` retorna `NO_FINDINGS`
