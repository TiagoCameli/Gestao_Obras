import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Button from "../../../components/ui/Button";
import Select from "../../../components/ui/Select";
import Input from "../../../components/ui/Input";
import Modal from "../../../components/ui/Modal";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { useAuth } from "../../../contexts/AuthContext";
import { useOfflineSync } from "../../../hooks/useOfflineSync";
import { enqueueBatidaPonto } from "../../../lib/offlineQueue";
import { SkeletonCard } from "../../../components/ui/Skeleton";
import {
  useEquipesApont,
  useFuncionarios,
  useObrasApont,
} from "../hooks/useApontamentoData";
import {
  atualizarHoraBatida,
  BatidaRegraError,
  excluirBatida,
  getAprovacaoDia,
  getFotoPontoUrls,
  listPendenciasSaida,
  listRegistrosDoDia,
  listRegistrosPontoRange,
  mensagemErroBatida,
  reabrirPontoDia,
  registrarBatida,
  type RegistroPonto,
  type TipoBatida,
} from "../utils/pontoApi";
import {
  compararFace,
  identifyFace,
  precomputeReferences,
  preloadFaceModels,
} from "../utils/faceRecognition";
import { getFotoUrls } from "../utils/apontamentoApi";
import CapturaFotoModal from "./CapturaFotoModal";
import MarcarFaltaModal from "./MarcarFaltaModal";
import type { Funcionario } from "../types/funcionario";

const TIPO_BATIDA_LABEL: Record<TipoBatida, string> = {
  entrada: "Entrada",
  saida_almoco: "Saída p/ almoço",
  retorno_almoco: "Retorno do almoço",
  saida_final: "Saída final",
};

type StatusFunc =
  | "aguardando"
  | "presente"
  | "em_almoco"
  | "retornou"
  | "saiu"
  | "manual_pendente";

const STATUS_INFO: Record<StatusFunc, { label: string; cor: string; emoji: string }> = {
  aguardando: { label: "Aguardando entrada", cor: "text-blue-400", emoji: "🔵" },
  presente: { label: "Presente", cor: "text-emerald-400", emoji: "🟢" },
  em_almoco: { label: "Em almoço", cor: "text-amber-400", emoji: "🟡" },
  retornou: { label: "Retornou do almoço", cor: "text-orange-400", emoji: "🟠" },
  saiu: { label: "Saiu", cor: "text-zinc-400", emoji: "⚫" },
  manual_pendente: {
    label: "Lançamento manual pendente",
    cor: "text-purple-400",
    emoji: "🟣",
  },
};

function statusDoFuncionario(rs: RegistroPonto[]): StatusFunc {
  const aprov = rs.filter((r) => r.statusAprovacao !== "rejeitado");
  if (aprov.some((r) => r.statusAprovacao === "pendente_aprovacao"))
    return "manual_pendente";
  if (aprov.some((r) => r.tipoBatida === "saida_final")) return "saiu";
  if (aprov.some((r) => r.tipoBatida === "retorno_almoco")) return "retornou";
  if (aprov.some((r) => r.tipoBatida === "saida_almoco")) return "em_almoco";
  if (aprov.some((r) => r.tipoBatida === "entrada")) return "presente";
  return "aguardando";
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function RegistroPontoTab() {
  const qc = useQueryClient();
  const { usuario, temAcao } = useAuth();
  const canRegistrar = temAcao("registrar_ponto");
  const canRegistrarLote = temAcao("registrar_ponto_lote");
  const canLancarManual = temAcao("lancar_ponto_manual");
  const canEditarBatida = temAcao("editar_batida_ponto");
  const canExcluirBatida = temAcao("excluir_batida_ponto");
  const canReabrirPonto = temAcao("reabrir_periodo");
  const canSincOffline = temAcao("sincronizar_fila_offline");
  const canMarcarFalta = temAcao("lancar_ausencia");
  const sync = useOfflineSync();
  const { data: obras = [] } = useObrasApont();
  const [obraId, setObraId] = useState<string>("");
  // Carrega TODAS as equipes — o filtro de equipe é independente do
  // de obra. O usuário pode escolher equipe sem obra, ou misturar.
  const { data: equipes = [] } = useEquipesApont(undefined);
  const [equipeId, setEquipeId] = useState<string>("");
  const [data, setData] = useState<string>(hojeIso());
  const [busca, setBusca] = useState<string>("");

  const { data: funcionarios = [] } = useFuncionarios();

  // QW4 — Auto-filtrar equipe do encarregado logado.
  // Pré-seleciona a equipe na primeira render se o usuário for encarregado
  // de UMA equipe ativa. Só auto-seleciona uma vez — depois o usuário pode
  // trocar à vontade. Match por email do usuário → encarregadoId via lookup
  // no funcionario correspondente. Mantém comportamento atual se não houver
  // match (Admin/Supervisor vê tudo).
  const autoFiltroAplicado = useRef(false);
  useEffect(() => {
    if (autoFiltroAplicado.current) return;
    if (!usuario || funcionarios.length === 0 || equipes.length === 0) return;
    const funcUser = funcionarios.find((f) => f.cpf && usuario.email && f.cpf !== "");
    const meuFuncionarioId = funcionarios.find((f) =>
      f.nome.toLowerCase() === (usuario.nome ?? "").toLowerCase()
    )?.id ?? funcUser?.id;
    if (!meuFuncionarioId) return;
    const minhasEquipes = equipes.filter((e) => e.encarregadoId === meuFuncionarioId);
    if (minhasEquipes.length === 1) {
      setEquipeId(minhasEquipes[0].id);
      autoFiltroAplicado.current = true;
    }
  }, [usuario, funcionarios, equipes]);

  // MW3 — Estado para registro de ponto em lote (FAB)
  const [loteOpen, setLoteOpen] = useState(false);
  const [loteTipo, setLoteTipo] = useState<TipoBatida>("entrada");
  const [loteHora, setLoteHora] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [loteIds, setLoteIds] = useState<Set<string>>(new Set());
  const [loteMotivo, setLoteMotivo] = useState("Lançamento em lote pelo encarregado");
  const [loteSalvando, setLoteSalvando] = useState(false);
  // Lista de funcionários a exibir respeita os filtros aplicados. Quando
  // nada está filtrado, mostra todos os ativos pra permitir registrar
  // ponto sem precisar escolher obra/equipe primeiro.
  const funcsDaEquipe = useMemo(() => {
    let list = funcionarios.filter((f) => f.status === "ativo");
    if (equipeId) list = list.filter((f) => f.equipeId === equipeId);
    if (obraId) list = list.filter((f) => f.obraId === obraId);
    const q = busca.trim().toLowerCase();
    if (q) list = list.filter((f) => f.nome.toLowerCase().includes(q));
    return list;
  }, [funcionarios, equipeId, obraId, busca]);

  const registrosKey = ["apont", "registros", obraId, equipeId, data] as const;
  const { data: registros = [], isLoading: loadingRegs } = useQuery({
    queryKey: registrosKey,
    queryFn: () =>
      equipeId
        ? listRegistrosDoDia(equipeId, data)
        : listRegistrosPontoRange({
            dataInicio: data,
            dataFim: data,
            obraId: obraId || undefined,
          }),
    enabled: !!data,
  });

  const aprovKey = ["apont", "aprovacao-dia", equipeId, data] as const;
  const { data: aprovacao } = useQuery({
    queryKey: aprovKey,
    queryFn: () => getAprovacaoDia(equipeId, data),
    enabled: !!equipeId && !!data,
  });

  const pendenciasKey = ["apont", "pendencias-saida", equipeId] as const;
  const { data: pendencias = [] } = useQuery({
    queryKey: pendenciasKey,
    queryFn: () => listPendenciasSaida(equipeId, 30),
    enabled: !!equipeId,
  });

  const registrosPorFunc = useMemo(() => {
    const m: Record<string, RegistroPonto[]> = {};
    registros.forEach((r) => {
      (m[r.funcionarioId] ??= []).push(r);
    });
    return m;
  }, [registros]);

  // Modal de captura rápida — o usuário escolhe o tipo de batida
  // (entrada / saída almoço / retorno / saída final) e o sistema
  // identifica o funcionário pela face.
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickTipo, setQuickTipo] = useState<TipoBatida | null>(null);
  const matchedRef = useRef<{ funcionario: Funcionario; tipo: TipoBatida } | null>(null);

  // Modal de captura
  const [capturando, setCapturando] = useState<{
    funcionario: Funcionario;
    tipo: TipoBatida;
  } | null>(null);

  // Modal de lançamento manual
  const [manualPara, setManualPara] = useState<Funcionario | null>(null);
  const [marcandoFalta, setMarcandoFalta] = useState<Funcionario | null>(null);

  // Aprovação do dia

  // Lightbox de foto da batida
  const [vendoFoto, setVendoFoto] = useState<RegistroPonto | null>(null);

  // Editar hora
  const [editandoHora, setEditandoHora] = useState<RegistroPonto | null>(null);

  // Excluir batida
  const [excluindoBatida, setExcluindoBatida] = useState<RegistroPonto | null>(
    null
  );

  // Pré-resolve signed URLs das fotos do dia (cache local)
  const [fotosUrl, setFotosUrl] = useState<Record<string, string>>({});
  useEffect(() => {
    const paths = registros.map((r) => r.foto).filter(Boolean) as string[];
    if (paths.length === 0) {
      setFotosUrl({});
      return;
    }
    let alive = true;
    getFotoPontoUrls(paths).then((m) => {
      if (alive) setFotosUrl(m);
    });
    return () => {
      alive = false;
    };
  }, [registros]);

  const congelado = !!aprovacao;

  // Carrega os modelos de face-api em background no primeiro render —
  // evita que o usuário pague o download de ~200 KB no clique de Capturar.
  useEffect(() => {
    preloadFaceModels().catch(() => { /* sem rede: cai pra fallback no validarFace */ });
  }, []);

  // Quando o modal de captura abre, pré-computa em paralelo os descritores
  // das fotos de referência do funcionário. Assim, ao apertar Capturar,
  // a única coisa a calcular é o descritor do frame atual.
  useEffect(() => {
    if (!capturando) return;
    const refs = capturando.funcionario.fotosReferenciaFacial ?? [];
    if (refs.length === 0) return;
    let alive = true;
    (async () => {
      try {
        const urls = await getFotoUrls(refs);
        if (!alive) return;
        await precomputeReferences(Object.values(urls));
      } catch {
        // silencioso — validarFace tenta de novo no clique
      }
    })();
    return () => { alive = false; };
  }, [capturando]);

  async function handleCapture(
    dataUrl: string,
    pos: GeolocationCoordinates | null
  ) {
    if (!capturando) return;
    if (!canRegistrar) return;
    try {
      await registrarBatida({
        funcionarioId: capturando.funcionario.id,
        tipoBatida: capturando.tipo,
        data,
        latitude: pos?.latitude ?? null,
        longitude: pos?.longitude ?? null,
        fotoDataUrl: dataUrl,
        origem: "automatico",
      });
      qc.invalidateQueries({ queryKey: registrosKey });
      qc.invalidateQueries({ queryKey: pendenciasKey });
      setCapturando(null);
    } catch (e) {
      alert(mensagemErroBatida(e));
    }
  }

  /**
   * Captura geolocalização (se o usuário permitir). Resolve em até 6s pra
   * não travar o registro de ponto se o GPS demorar/falhar.
   */
  function pegarGeolocalizacao(): Promise<GeolocationCoordinates | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      let done = false;
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          resolve(null);
        }
      }, 6000);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(p.coords);
        },
        () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(null);
        },
        { timeout: 6000, maximumAge: 60_000 }
      );
    });
  }

  /**
   * Inicia uma batida: se o funcionário tem foto cadastrada, abre o modal
   * de captura facial; se não tem, registra direto (sem foto), pegando
   * geolocalização em best-effort.
   */
  async function iniciarBatida(funcionario: Funcionario, tipo: TipoBatida) {
    if (!canRegistrar) return;
    const temFoto =
      (funcionario.fotosReferenciaFacial?.length ?? 0) > 0 ||
      !!funcionario.fotoPerfil;
    if (temFoto) {
      setCapturando({ funcionario, tipo });
      return;
    }
    try {
      const pos = await pegarGeolocalizacao();
      await registrarBatida({
        funcionarioId: funcionario.id,
        tipoBatida: tipo,
        data,
        latitude: pos?.latitude ?? null,
        longitude: pos?.longitude ?? null,
        origem: "automatico",
      });
      qc.invalidateQueries({ queryKey: registrosKey });
      qc.invalidateQueries({ queryKey: pendenciasKey });
    } catch (e) {
      alert(mensagemErroBatida(e));
    }
  }

  async function validarFace(dataUrl: string) {
    if (!capturando) return { match: false, distancia: 1, threshold: 0.55 };
    const refs = capturando.funcionario.fotosReferenciaFacial ?? [];
    if (refs.length === 0) {
      // Sem referência cadastrada: deixa passar mas alerta
      return { match: true, distancia: 0, threshold: 0.55 };
    }
    const refsUrls = await getFotoUrls(refs);
    return compararFace(dataUrl, Object.values(refsUrls));
  }

  /** Pré-computa descritores de TODOS os funcionários ativos com foto. */
  useEffect(() => {
    if (!quickOpen) return;
    let alive = true;
    (async () => {
      try {
        const candidatos = funcsDaEquipe.filter(
          (f) => (f.fotosReferenciaFacial?.length ?? 0) > 0
        );
        const todasUrls: string[] = [];
        for (const f of candidatos) {
          const urls = await getFotoUrls(f.fotosReferenciaFacial!);
          todasUrls.push(...Object.values(urls));
        }
        if (!alive) return;
        await precomputeReferences(todasUrls);
      } catch {
        /* silencioso — quickValidarFace tenta de novo no clique */
      }
    })();
    return () => { alive = false; };
  }, [quickOpen, funcsDaEquipe]);

  /** Identifica o funcionário pela face e prepara a batida do tipo escolhido. */
  async function quickValidarFace(dataUrl: string) {
    matchedRef.current = null;
    if (!quickTipo) {
      return { match: false, distancia: 1, threshold: 0.55 };
    }
    const elegiveis = funcsDaEquipe.filter(
      (f) => (f.fotosReferenciaFacial?.length ?? 0) > 0
    );
    if (elegiveis.length === 0) {
      return { match: false, distancia: 1, threshold: 0.55 };
    }
    const candidatos = await Promise.all(
      elegiveis.map(async (f) => {
        const urls = await getFotoUrls(f.fotosReferenciaFacial!);
        return { id: f.id, urls: Object.values(urls) };
      })
    );
    const res = await identifyFace(dataUrl, candidatos);
    if (!res.match || !res.candidatoId) {
      return { match: false, distancia: res.distancia, threshold: res.threshold };
    }
    const func = funcsDaEquipe.find((f) => f.id === res.candidatoId);
    if (!func) {
      return { match: false, distancia: res.distancia, threshold: res.threshold };
    }
    const jaBatidos = new Set(
      (registrosPorFunc[func.id] ?? [])
        .filter((r) => r.statusAprovacao !== "rejeitado")
        .map((r) => r.tipoBatida)
    );
    if (jaBatidos.has(quickTipo)) {
      alert(`${func.nome} já registrou ${TIPO_BATIDA_LABEL[quickTipo]} hoje.`);
      return { match: false, distancia: res.distancia, threshold: res.threshold };
    }
    matchedRef.current = { funcionario: func, tipo: quickTipo };
    return { match: true, distancia: res.distancia, threshold: res.threshold };
  }

  async function quickHandleCapture(
    dataUrl: string,
    pos: GeolocationCoordinates | null
  ) {
    const m = matchedRef.current;
    if (!m) return;
    try {
      await registrarBatida({
        funcionarioId: m.funcionario.id,
        tipoBatida: m.tipo,
        data,
        latitude: pos?.latitude ?? null,
        longitude: pos?.longitude ?? null,
        fotoDataUrl: dataUrl,
        origem: "automatico",
      });
      qc.invalidateQueries({ queryKey: registrosKey });
      qc.invalidateQueries({ queryKey: pendenciasKey });
      alert(
        `✅ ${m.funcionario.nome} — ${TIPO_BATIDA_LABEL[m.tipo]} registrada.`
      );
      matchedRef.current = null;
      setQuickOpen(false);
      setQuickTipo(null);
    } catch (e) {
      alert(mensagemErroBatida(e));
    }
  }

  if (obras.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-[var(--color-fg-subtle)]">
        Cadastre obras no módulo Medição antes de registrar ponto.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* PR-PWA1 — Status de conexão e fila de batidas */}
      {(!sync.online || sync.countBatidas > 0) && (
        <div
          className={
            "flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border " +
            (!sync.online
              ? "bg-[var(--color-warning-soft)] border-[var(--color-warning)]/30 text-[var(--color-warning-fg)]"
              : "bg-[var(--color-info-soft)] border-[var(--color-info)]/30 text-[var(--color-info-fg)]")
          }
        >
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className={`w-2 h-2 rounded-full ${!sync.online ? "bg-[var(--color-warning)] animate-pulse" : "bg-[var(--color-info)]"}`} />
            {!sync.online ? (
              <span>
                Offline — batidas vão para a fila e sincronizam quando voltar a conexão.
              </span>
            ) : (
              <span>
                {sync.countBatidas} batida{sync.countBatidas !== 1 ? "s" : ""} na fila aguardando sincronização.
              </span>
            )}
          </div>
          {sync.online && sync.countBatidas > 0 && canSincOffline && (
            <button
              type="button"
              onClick={() => sync.sync()}
              disabled={sync.status === "syncing"}
              className="text-xs font-semibold px-3 py-1 rounded-md bg-[var(--color-surface-1)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] disabled:opacity-50"
            >
              {sync.status === "syncing" ? "Sincronizando…" : "Sincronizar agora"}
            </button>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-[var(--color-fg)]">
            Bater ponto rápido
          </h3>
          <p className="text-[11px] text-[var(--color-fg-subtle)] mt-0.5">
            Toque no tipo de batida — o sistema reconhece o rosto automaticamente.
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <BotaoPontoRapido
            label="Entrada"
            emoji="🟢"
            color="emerald"
            onClick={() => {
              matchedRef.current = null;
              setQuickTipo("entrada");
              setQuickOpen(true);
            }}
          />
          <BotaoPontoRapido
            label="Saída p/ almoço"
            emoji="🍽️"
            color="amber"
            onClick={() => {
              matchedRef.current = null;
              setQuickTipo("saida_almoco");
              setQuickOpen(true);
            }}
          />
          <BotaoPontoRapido
            label="Retorno do almoço"
            emoji="🔁"
            color="orange"
            onClick={() => {
              matchedRef.current = null;
              setQuickTipo("retorno_almoco");
              setQuickOpen(true);
            }}
          />
          <BotaoPontoRapido
            label="Saída final"
            emoji="🏁"
            color="rose"
            onClick={() => {
              matchedRef.current = null;
              setQuickTipo("saida_final");
              setQuickOpen(true);
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Select
          label="Obra"
          options={obras.map((o) => ({ value: o.id, label: o.nome }))}
          value={obraId}
          onChange={(e) => setObraId(e.target.value)}
        />
        <Select
          label="Equipe"
          options={equipes.map((eq) => ({ value: eq.id, label: eq.nome }))}
          value={equipeId}
          onChange={(e) => setEquipeId(e.target.value)}
        />
        <Input
          label="Data"
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
        />
        <Input
          label="Buscar nome"
          type="search"
          placeholder="Digite o nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {equipeId && pendencias.length > 0 && (
        <PendenciasSaida
          pendencias={pendencias}
          funcionarios={funcsDaEquipe}
          onIrPara={(p) => {
            setData(p.data);
          }}
          onLancarManual={(p) => {
            const f = funcsDaEquipe.find((x) => x.id === p.funcionarioId);
            if (f) {
              setData(p.data);
              setManualPara(f);
            }
          }}
        />
      )}

      {loadingRegs ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={`sk-ponto-${i}`} />
          ))}
        </div>
      ) : funcsDaEquipe.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-fg-subtle)]">
          {equipeId
            ? "Nenhum funcionário ativo nesta equipe."
            : obraId
              ? "Nenhum funcionário ativo nesta obra."
              : "Nenhum funcionário ativo cadastrado."}
        </p>
      ) : (
        <>
          {congelado && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm flex items-center justify-between">
              <span className="text-emerald-300">
                ✓ Ponto deste dia aprovado em{" "}
                {new Date(aprovacao!.aprovadoEm).toLocaleString("pt-BR")}
              </span>
              <button
                onClick={async () => {
                  if (!canReabrirPonto) return;
                  if (
                    !confirm(
                      "Reabrir o ponto deste dia? Será removida a aprovação."
                    )
                  )
                    return;
                  await reabrirPontoDia(equipeId, data);
                  qc.invalidateQueries({ queryKey: aprovKey });
                }}
                className="text-xs underline text-[var(--color-fg-muted)]"
              >
                Reabrir
              </button>
            </div>
          )}

          {(() => {
            // Divide o painel em duas colunas:
            //  - Esquerda: ainda não bateram entrada
            //  - Direita: já com entrada (qualquer estado adiante)
            const aguardando = funcsDaEquipe.filter((f) => {
              const rs = registrosPorFunc[f.id] ?? [];
              return statusDoFuncionario(rs) === "aguardando";
            });
            const comEntrada = funcsDaEquipe.filter((f) => {
              const rs = registrosPorFunc[f.id] ?? [];
              return statusDoFuncionario(rs) !== "aguardando";
            });

            const renderCard = (f: Funcionario) => {
              const rs = registrosPorFunc[f.id] ?? [];
              const status = statusDoFuncionario(rs);
              const info = STATUS_INFO[status];
              const ultima = rs[rs.length - 1];
              return (
                <article
                  key={f.id}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3"
                >
                  <header className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar funcionario={f} />
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--color-fg)] truncate">
                          {f.nome}
                        </div>
                        <div className="text-xs">
                          <span className={info.cor}>
                            {info.emoji} {info.label}
                          </span>
                          {ultima && (
                            <span className="text-[var(--color-fg-subtle)] ml-2">
                              · última batida{" "}
                              {new Date(ultima.hora).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </header>

                  {/* B2.1 — Barra visual de progresso das 4 batidas do dia */}
                  <ProgressoBatidas registros={rs} />

                  <BatidasList
                    registros={rs}
                    fotosUrl={fotosUrl}
                    podeEditar={!congelado}
                    onVerFoto={(r) => setVendoFoto(r)}
                    onEditarHora={canEditarBatida ? (r) => setEditandoHora(r) : null}
                    onExcluir={canExcluirBatida ? (r) => setExcluindoBatida(r) : null}
                  />

                  {!congelado && (
                    <AcoesFuncionario
                      status={status}
                      onCapturar={(tipo) => void iniciarBatida(f, tipo)}
                      onLancarManual={canLancarManual ? () => setManualPara(f) : null}
                      onMarcarFalta={canMarcarFalta ? () => setMarcandoFalta(f) : null}
                    />
                  )}
                </article>
              );
            };

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2 flex items-center justify-between">
                    <span>Aguardando entrada</span>
                    <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full bg-[var(--color-info-soft)] text-[var(--color-info-fg)]">
                      {aguardando.length}
                    </span>
                  </h3>
                  {aguardando.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[var(--color-border)] py-6 text-center text-xs text-[var(--color-fg-subtle)]">
                      Todos os funcionários já registraram entrada.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">{aguardando.map(renderCard)}</div>
                  )}
                </section>
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2 flex items-center justify-between">
                    <span>Com entrada registrada</span>
                    <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full bg-[var(--color-success-soft)] text-[var(--color-success-fg)]">
                      {comEntrada.length}
                    </span>
                  </h3>
                  {comEntrada.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[var(--color-border)] py-6 text-center text-xs text-[var(--color-fg-subtle)]">
                      Ninguém registrou entrada ainda.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">{comEntrada.map(renderCard)}</div>
                  )}
                </section>
              </div>
            );
          })()}

        </>
      )}

      <CapturaFotoModal
        open={capturando !== null}
        title={
          capturando
            ? `${TIPO_BATIDA_LABEL[capturando.tipo]} — ${capturando.funcionario.nome}`
            : ""
        }
        onCancel={() => setCapturando(null)}
        onCapture={handleCapture}
        validarFace={capturando ? validarFace : undefined}
      />

      <CapturaFotoModal
        open={quickOpen}
        title={
          quickTipo
            ? `${TIPO_BATIDA_LABEL[quickTipo]} — reconhecer rosto`
            : "Bater ponto — reconhecer rosto"
        }
        onCancel={() => {
          matchedRef.current = null;
          setQuickOpen(false);
          setQuickTipo(null);
        }}
        onCapture={quickHandleCapture}
        validarFace={quickValidarFace}
      />

      <LancamentoManualModal
        funcionario={manualPara}
        data={data}
        onClose={() => setManualPara(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: registrosKey });
          setManualPara(null);
        }}
      />

      <MarcarFaltaModal
        open={marcandoFalta !== null}
        funcionario={marcandoFalta}
        dataSugerida={data}
        onClose={() => setMarcandoFalta(null)}
      />

      <FotoBatidaModal
        registro={vendoFoto}
        url={vendoFoto?.foto ? fotosUrl[vendoFoto.foto] ?? null : null}
        onClose={() => setVendoFoto(null)}
      />

      <EditarHoraModal
        registro={editandoHora}
        onClose={() => setEditandoHora(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: registrosKey });
          setEditandoHora(null);
        }}
      />

      <ConfirmDialog
        open={excluindoBatida !== null}
        onClose={() => setExcluindoBatida(null)}
        onConfirm={async () => {
          if (!canExcluirBatida) { setExcluindoBatida(null); return; }
          if (!excluindoBatida) return;
          await excluirBatida(excluindoBatida.id);
          qc.invalidateQueries({ queryKey: registrosKey });
          setExcluindoBatida(null);
        }}
        title="Excluir batida"
        message={
          excluindoBatida
            ? `Excluir a batida "${
                TIPO_BATIDA_LABEL[excluindoBatida.tipoBatida]
              }" registrada às ${new Date(
                excluindoBatida.hora
              ).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}? A foto também será removida.`
            : ""
        }
        requirePassword={false}
      />

      {/* MW3 — FAB "Registrar em lote" — visível só quando há lista filtrada */}
      {funcsDaEquipe.length > 0 && (
        <button
          type="button"
          onClick={() => {
            // Pré-seleciona todos os funcionários filtrados
            setLoteIds(new Set(funcsDaEquipe.map((f) => f.id)));
            setLoteOpen(true);
          }}
          aria-label="Registrar ponto em lote"
          className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 pl-4 pr-5 py-3.5 rounded-full bg-[var(--color-accent)] text-white shadow-[var(--shadow-xl)] hover:brightness-110 transition-all"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="text-sm font-semibold">Registrar em lote</span>
        </button>
      )}

      {/* MW3 — Modal de registro em lote */}
      <Modal
        open={loteOpen}
        onClose={() => setLoteOpen(false)}
        title="Registrar ponto em lote"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--color-fg-muted)]">
            Marque o tipo de batida, ajuste a hora e selecione os funcionários. As batidas serão
            registradas como <b>manuais</b> (origem manual, aguardando aprovação).
          </p>

          {/* Tipo de batida em pills */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] mb-1.5">
              Tipo de batida
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["entrada", "saida_almoco", "retorno_almoco", "saida_final"] as TipoBatida[]).map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setLoteTipo(t)}
                    className={
                      "px-3 py-2 rounded-lg text-xs font-medium border transition-colors " +
                      (loteTipo === t
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-fg)]"
                        : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]")
                    }
                  >
                    {TIPO_BATIDA_LABEL[t]}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
            <Input
              label="Hora"
              type="time"
              value={loteHora}
              onChange={(e) => setLoteHora(e.target.value)}
            />
          </div>

          <Input
            label="Motivo / justificativa"
            type="text"
            value={loteMotivo}
            onChange={(e) => setLoteMotivo(e.target.value)}
          />

          {/* Lista de funcionários */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
                Funcionários ({loteIds.size}/{funcsDaEquipe.length} selecionados)
              </p>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setLoteIds(new Set(funcsDaEquipe.map((f) => f.id)))}
                  className="text-[var(--color-accent)] hover:underline"
                >
                  Todos
                </button>
                <span className="text-[var(--color-fg-subtle)]">·</span>
                <button
                  type="button"
                  onClick={() => setLoteIds(new Set())}
                  className="text-[var(--color-fg-muted)] hover:underline"
                >
                  Nenhum
                </button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
              {funcsDaEquipe.map((f) => {
                const sel = loteIds.has(f.id);
                return (
                  <label
                    key={f.id}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--color-surface-2)]"
                  >
                    <input
                      type="checkbox"
                      checked={sel}
                      onChange={(e) => {
                        const next = new Set(loteIds);
                        if (e.target.checked) next.add(f.id);
                        else next.delete(f.id);
                        setLoteIds(next);
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-[var(--color-fg)]">{f.nome}</span>
                  </label>
                );
              })}
              {funcsDaEquipe.length === 0 && (
                <p className="px-3 py-4 text-sm text-[var(--color-fg-subtle)]">
                  Nenhum funcionário no filtro atual.
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setLoteOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={loteIds.size === 0 || loteSalvando || !loteMotivo.trim() || !canRegistrarLote}
              onClick={async () => {
                if (!canRegistrarLote) return;
                if (loteIds.size === 0 || !loteMotivo.trim()) return;
                setLoteSalvando(true);
                const horaIso = new Date(`${data}T${loteHora}:00`).toISOString();
                let ok = 0;
                let fail = 0;
                let enfileirados = 0;
                const erroRegrasPorFunc: string[] = [];
                // PR-PWA1: se offline, enfileira tudo direto.
                const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
                for (const id of loteIds) {
                  const func = funcionarios.find((f) => f.id === id);
                  try {
                    if (isOffline) {
                      await enqueueBatidaPonto({
                        funcionarioId: id,
                        funcionarioNome: func?.nome ?? "",
                        data,
                        hora: horaIso,
                        tipoBatida: loteTipo,
                        motivo: loteMotivo.trim(),
                      });
                      enfileirados++;
                    } else {
                      await registrarBatida({
                        funcionarioId: id,
                        data,
                        tipoBatida: loteTipo,
                        hora: horaIso,
                        latitude: null,
                        longitude: null,
                        origem: "manual",
                        motivoManual: loteMotivo.trim(),
                        statusAprovacao: "pendente_aprovacao",
                      });
                      ok++;
                    }
                  } catch (err) {
                    // Regra de negócio (entrada duplicada/saída sem entrada)
                    // — NÃO enfileira offline, contabiliza como falha de regra.
                    // Outros erros (rede): tenta enfileirar.
                    if (err instanceof BatidaRegraError) {
                      fail++;
                      erroRegrasPorFunc.push(`• ${func?.nome ?? id}: ${err.message}`);
                    } else {
                      try {
                        await enqueueBatidaPonto({
                          funcionarioId: id,
                          funcionarioNome: func?.nome ?? "",
                          data,
                          hora: horaIso,
                          tipoBatida: loteTipo,
                          motivo: loteMotivo.trim(),
                        });
                        enfileirados++;
                      } catch {
                        fail++;
                      }
                    }
                  }
                }
                setLoteSalvando(false);
                setLoteOpen(false);
                setLoteIds(new Set());
                qc.invalidateQueries({ queryKey: registrosKey });
                await sync.refresh();
                const partes: string[] = [];
                if (ok > 0) partes.push(`${ok} registrada${ok !== 1 ? "s" : ""}`);
                if (enfileirados > 0)
                  partes.push(
                    `${enfileirados} na fila offline (sincroniza quando voltar online)`
                  );
                if (fail > 0) partes.push(`${fail} falha${fail !== 1 ? "s" : ""}`);
                const resumo = partes.join(" · ") || "Nada para registrar";
                const detalheRegras = erroRegrasPorFunc.length > 0
                  ? "\n\nMotivos:\n" + erroRegrasPorFunc.join("\n")
                  : "";
                alert(resumo + detalheRegras);
              }}
            >
              {loteSalvando ? "Registrando…" : `Registrar para ${loteIds.size}`}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}

function PendenciasSaida({
  pendencias,
  funcionarios,
  onIrPara,
  onLancarManual,
}: {
  pendencias: { funcionarioId: string; data: string; entradaHora: string }[];
  funcionarios: Funcionario[];
  onIrPara: (p: { funcionarioId: string; data: string; entradaHora: string }) => void;
  onLancarManual: (p: {
    funcionarioId: string;
    data: string;
    entradaHora: string;
  }) => void;
}) {
  const nome = useMemo(
    () => Object.fromEntries(funcionarios.map((f) => [f.id, f.nome])),
    [funcionarios]
  );

  return (
    <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-300 mb-2">
        Saídas pendentes ({pendencias.length})
      </h3>
      <ul className="divide-y divide-[var(--color-border)] text-sm">
        {pendencias.map((p) => (
          <li
            key={`${p.funcionarioId}:${p.data}`}
            className="py-2 flex items-center gap-3 flex-wrap"
          >
            <span className="font-mono text-xs text-[var(--color-fg-muted)]">
              {p.data.split("-").reverse().join("/")}
            </span>
            <span className="font-medium text-[var(--color-fg)]">
              {nome[p.funcionarioId] ?? "—"}
            </span>
            <span className="text-xs text-[var(--color-fg-muted)]">
              entrou às{" "}
              {new Date(p.entradaHora).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · sem saída final
            </span>
            <span className="ml-auto flex gap-1">
              <button
                onClick={() => onIrPara(p)}
                className="text-xs px-2 py-1 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              >
                Abrir o dia
              </button>
              <button
                onClick={() => onLancarManual(p)}
                className="text-xs px-2 py-1 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-accent)]"
              >
                Lançar saída
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Avatar({ funcionario }: { funcionario: Funcionario }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!funcionario.fotoPerfil) return;
    let alive = true;
    getFotoUrls([funcionario.fotoPerfil]).then((map) => {
      if (alive && map[funcionario.fotoPerfil!])
        setUrl(map[funcionario.fotoPerfil!]);
    });
    return () => {
      alive = false;
    };
  }, [funcionario.fotoPerfil]);

  if (url) {
    return (
      <img
        src={url}
        alt={funcionario.nome}
        className="w-10 h-10 rounded-full object-cover border border-[var(--color-border)]"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center text-xs text-[var(--color-fg-subtle)]">
      {funcionario.nome.charAt(0).toUpperCase()}
    </div>
  );
}

function BatidasList({
  registros,
  fotosUrl,
  podeEditar,
  onVerFoto,
  onEditarHora,
  onExcluir,
}: {
  registros: RegistroPonto[];
  fotosUrl: Record<string, string>;
  podeEditar: boolean;
  onVerFoto: (r: RegistroPonto) => void;
  onEditarHora: ((r: RegistroPonto) => void) | null;
  onExcluir: ((r: RegistroPonto) => void) | null;
}) {
  if (registros.length === 0) return null;
  return (
    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
      {registros.map((r) => {
        const url = r.foto ? fotosUrl[r.foto] : null;
        return (
          <div
            key={r.id}
            className="flex items-center gap-2 text-[var(--color-fg-muted)]"
          >
            {r.foto ? (
              <button
                type="button"
                onClick={() => onVerFoto(r)}
                title="Ver foto"
                className="w-8 h-8 rounded border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-2)] flex-shrink-0 hover:ring-2 hover:ring-[var(--color-accent)]/50 transition"
              >
                {url ? (
                  <img
                    src={url}
                    alt="batida"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[10px]">📷</span>
                )}
              </button>
            ) : (
              <span className="w-8 h-8 rounded border border-dashed border-[var(--color-border)] flex items-center justify-center text-[10px] text-[var(--color-fg-subtle)]">
                —
              </span>
            )}
            <span className="font-mono">
              {new Date(r.hora).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span>{TIPO_BATIDA_LABEL[r.tipoBatida]}</span>
            {r.origem === "manual" && (
              <span
                className={
                  "px-1.5 py-0.5 rounded text-[10px] font-medium " +
                  (r.statusAprovacao === "pendente_aprovacao"
                    ? "bg-purple-500/20 text-purple-300"
                    : r.statusAprovacao === "rejeitado"
                    ? "bg-rose-500/20 text-rose-300"
                    : "bg-emerald-500/20 text-emerald-300")
                }
              >
                manual · {r.statusAprovacao.replace("_", " ")}
              </span>
            )}
            {/* UX1 — Aprovação/rejeição agora é feita só na aba Aprovação (centraliza decisão) */}
            {podeEditar && (onEditarHora || onExcluir) && (
              <span className="ml-auto flex gap-1">
                {onEditarHora && (
                  <button
                    onClick={() => onEditarHora(r)}
                    title="Alterar hora"
                    className="text-[10px] text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] px-1.5 py-0.5 rounded hover:bg-[var(--color-surface-2)]"
                  >
                    ✎
                  </button>
                )}
                {onExcluir && (
                  <button
                    onClick={() => onExcluir(r)}
                    title="Excluir batida"
                    className="text-[10px] text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] px-1.5 py-0.5 rounded hover:bg-[var(--color-surface-2)]"
                  >
                    ✕
                  </button>
                )}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EditarHoraModal({
  registro,
  onClose,
  onSaved,
}: {
  registro: RegistroPonto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { temAcao } = useAuth();
  const canEditar = temAcao("editar_batida_ponto");
  const [hora, setHora] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (registro) {
      const d = new Date(registro.hora);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      setHora(`${hh}:${mm}`);
    }
  }, [registro]);

  return (
    <Modal
      open={registro !== null}
      onClose={onClose}
      title={
        registro
          ? `Alterar hora — ${TIPO_BATIDA_LABEL[registro.tipoBatida]}`
          : ""
      }
    >
      {registro && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!canEditar) return;
            if (!hora) return;
            setSaving(true);
            try {
              const novaIso = new Date(`${registro.data}T${hora}:00`).toISOString();
              await atualizarHoraBatida(registro.id, novaIso);
              onSaved();
            } catch (err) {
              alert(mensagemErroBatida(err));
            } finally {
              setSaving(false);
            }
          }}
          className="space-y-4"
        >
          <Input
            label="Nova hora"
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            required
          />
          <p className="text-xs text-[var(--color-fg-subtle)]">
            Hora atual:{" "}
            {new Date(registro.hora).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            . A foto e o GPS originais são preservados.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function FotoBatidaModal({
  registro,
  url,
  onClose,
}: {
  registro: RegistroPonto | null;
  url: string | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={registro !== null}
      onClose={onClose}
      title={
        registro
          ? `${TIPO_BATIDA_LABEL[registro.tipoBatida]} · ${new Date(
              registro.hora
            ).toLocaleString("pt-BR")}`
          : ""
      }
      size="lg"
    >
      {registro && (
        <div className="space-y-3">
          {url ? (
            <img
              src={url}
              alt="foto da batida"
              className="w-full max-h-[70vh] object-contain rounded-lg bg-black"
            />
          ) : (
            <p className="text-sm text-[var(--color-fg-subtle)] text-center py-8">
              Foto não disponível.
            </p>
          )}
          <div className="text-xs text-[var(--color-fg-muted)] flex flex-wrap gap-x-4 gap-y-1">
            {registro.latitude != null && registro.longitude != null && (
              <span>
                📍 {registro.latitude.toFixed(5)},{" "}
                {registro.longitude.toFixed(5)}
              </span>
            )}
            <span>
              Origem: {registro.origem === "manual" ? "Manual" : "Automático"}
            </span>
            <span>Status: {registro.statusAprovacao.replace("_", " ")}</span>
          </div>
        </div>
      )}
    </Modal>
  );
}

function AcoesFuncionario({
  status,
  onCapturar,
  onLancarManual,
  onMarcarFalta,
}: {
  status: StatusFunc;
  onCapturar: (tipo: TipoBatida) => void;
  onLancarManual: (() => void) | null;
  onMarcarFalta: (() => void) | null;
}) {
  // Define quais batidas fazem sentido pelo estado atual
  const podeEntrar = status === "aguardando";
  const podeAlmoco = status === "presente";
  const podeRetorno = status === "em_almoco";
  const podeSair =
    status === "presente" || status === "retornou" || status === "em_almoco";

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {podeEntrar && (
        <BotaoBatida onClick={() => onCapturar("entrada")} variant="primary">
          Registrar entrada
        </BotaoBatida>
      )}
      {podeAlmoco && (
        <BotaoBatida onClick={() => onCapturar("saida_almoco")}>
          Saída almoço
        </BotaoBatida>
      )}
      {podeRetorno && (
        <BotaoBatida onClick={() => onCapturar("retorno_almoco")}>
          Retorno do almoço
        </BotaoBatida>
      )}
      {podeSair && (
        <BotaoBatida onClick={() => onCapturar("saida_final")}>
          Saída final
        </BotaoBatida>
      )}
      {onLancarManual && (
        <BotaoBatida onClick={onLancarManual} variant="ghost">
          Lançar manual
        </BotaoBatida>
      )}
      {onMarcarFalta && (
        <BotaoBatida onClick={onMarcarFalta} variant="ghost">
          Marcar falta
        </BotaoBatida>
      )}
    </div>
  );
}

function BotaoPontoRapido({
  label,
  emoji,
  color,
  onClick,
}: {
  label: string;
  emoji: string;
  color: "emerald" | "amber" | "orange" | "rose";
  onClick: () => void;
}) {
  const palette: Record<typeof color, string> = {
    emerald:
      "border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30 text-emerald-200",
    amber:
      "border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30 text-amber-200",
    orange:
      "border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 active:bg-orange-500/30 text-orange-200",
    rose:
      "border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-200",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "w-full min-h-[112px] sm:min-h-[120px] rounded-2xl border-2 " +
        "flex flex-col items-center justify-center gap-2 " +
        "px-4 py-5 transition-colors active:scale-[0.98] " +
        "shadow-sm " +
        palette[color]
      }
    >
      <span className="text-3xl sm:text-4xl leading-none" aria-hidden>
        {emoji}
      </span>
      <span className="text-base sm:text-lg font-semibold tracking-tight text-center">
        {label}
      </span>
    </button>
  );
}

function BotaoBatida({
  children,
  onClick,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "ghost";
}) {
  const base =
    "text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors";
  const cls =
    variant === "primary"
      ? "bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] hover:brightness-110"
      : variant === "ghost"
      ? "border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]"
      : "bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-border-strong)]";
  return (
    <button onClick={onClick} className={`${base} ${cls}`}>
      {children}
    </button>
  );
}

function LancamentoManualModal({
  funcionario,
  data,
  onClose,
  onSaved,
}: {
  funcionario: Funcionario | null;
  data: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tipo, setTipo] = useState<TipoBatida>("saida_final");
  const [hora, setHora] = useState<string>("17:30");
  const [motivo, setMotivo] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (funcionario) {
      setTipo("saida_final");
      setHora("17:30");
      setMotivo("");
    }
  }, [funcionario]);

  return (
    <Modal
      open={funcionario !== null}
      onClose={onClose}
      title={funcionario ? `Lançar batida manual — ${funcionario.nome}` : ""}
    >
      {funcionario && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!motivo.trim()) {
              alert("Justificativa é obrigatória.");
              return;
            }
            setSaving(true);
            try {
              const horaIso = new Date(`${data}T${hora}:00`).toISOString();
              await registrarBatida({
                funcionarioId: funcionario.id,
                data,
                tipoBatida: tipo,
                hora: horaIso,
                latitude: null,
                longitude: null,
                origem: "manual",
                motivoManual: motivo.trim(),
                statusAprovacao: "pendente_aprovacao",
              });
              onSaved();
            } catch (err) {
              alert(mensagemErroBatida(err));
            } finally {
              setSaving(false);
            }
          }}
          className="space-y-4"
        >
          <Select
            label="Tipo de batida"
            options={(
              [
                "entrada",
                "saida_almoco",
                "retorno_almoco",
                "saida_final",
              ] as TipoBatida[]
            ).map((t) => ({ value: t, label: TIPO_BATIDA_LABEL[t] }))}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoBatida)}
          />
          <Input
            label="Hora"
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
          />
          <div>
            <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
              Justificativa <span className="text-[var(--color-danger)]">*</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
              placeholder="Ex: esqueceu de bater saída, GPS sem sinal, etc."
            />
          </div>
          <p className="text-xs text-[var(--color-fg-subtle)]">
            O lançamento ficará pendente até aprovação do supervisor.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Lançar"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/**
 * B2.1 — Mini-stepper visual das 4 batidas do dia:
 *   [🟢 06:13] [🍴 12:00] [🔁 —] [🏁 —]
 * Ajuda o encarregado a ver de relance o estado do funcionário.
 */
function ProgressoBatidas({ registros }: { registros: RegistroPonto[] }) {
  const ordem: { tipo: TipoBatida; label: string }[] = [
    { tipo: "entrada", label: "Entrada" },
    { tipo: "saida_almoco", label: "Almoço" },
    { tipo: "retorno_almoco", label: "Retorno" },
    { tipo: "saida_final", label: "Final" },
  ];
  return (
    <div className="mt-2 grid grid-cols-4 gap-1">
      {ordem.map((step) => {
        const r = registros.find((x) => x.tipoBatida === step.tipo);
        const feito = !!r;
        return (
          <div
            key={step.tipo}
            className={
              "rounded-md px-1.5 py-1 text-center transition-colors " +
              (feito
                ? "bg-[var(--color-success-soft)] border border-[var(--color-success)]/40"
                : "bg-[var(--color-surface-2)] border border-dashed border-[var(--color-border)]")
            }
            title={
              step.label +
              (feito && r
                ? ` · ${new Date(r.hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                : " · pendente")
            }
          >
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
              {step.label}
            </div>
            <div
              className={
                "text-[11px] tabular-nums font-medium " +
                (feito ? "text-[var(--color-success-fg)]" : "text-[var(--color-fg-subtle)]")
              }
            >
              {feito && r
                ? new Date(r.hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
