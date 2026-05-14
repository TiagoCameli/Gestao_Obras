import { useMemo, useState, useRef, useEffect } from "react";
import { X, Plus, Ruler, Sparkles, Trash2, Search, FileSpreadsheet, FileDown, Pencil, Check } from "lucide-react";
import type { Activity, Obra, ContractItem } from "../../types/activity";
import { generateId } from "../../utils/format";
import { useContractItems } from "../../hooks/useContractItems";
import { downloadContractTemplate } from "../../utils/contractTemplate";
import { exportMedicaoExcel } from "../../utils/contractExport";
import { loadCurrentMedicao, saveCurrentMedicao, loadActivities } from "../../utils/storage";
import { reconcileCurrentQty } from "../../utils/reconcileMedicoes";
import {
  buildContribsByCodeAndMedicao,
  itemQtyForMedicao,
  itemAccumulatedQty,
  aggregatedCurrentValue,
  aggregatedAccumulatedValue,
  type ContribMap,
} from "../../utils/medicaoAggregates";
import {
  getLevel, isAggregating, itemTotal, grandTotal, sortByCode, codeDepth,
  itemCurrentValue, itemMeasuredValue, grandCurrentValue, grandMeasuredValue,
  isAdminLocal,
} from "../../utils/contractTree";
import { ImportExcelModal } from "./ImportExcelModal";
import { useAuth } from "../../../../contexts/AuthContext";

interface MeasurementViewProps {
  obra: Obra;
  onClose: () => void;
}

const CURRENCY = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const QTY_FMT = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export function MeasurementView({ obra, onClose }: MeasurementViewProps) {
  const { temAcao } = useAuth();
  const canEditItens = temAcao("editar_itens_contrato");
  const canImportContrato = temAcao("importar_contrato_medicao");
  const canExportMedicao = temAcao("exportar_medicao");
  const canFecharMedicao = temAcao("fechar_medicao");
  const canTrocarPeriodo = temAcao("trocar_periodo_medicao");
  const canBaixarTemplate = temAcao("baixar_template_contrato");
  const canGerenciarContrato = temAcao("gerenciar_contrato");

  const { items, addItems, replaceAll } = useContractItems(obra.id);
  const [query, setQuery] = useState("");
  const [showImport, setShowImport] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  // Edit mode: read-only by default; on Editar we work on a draft copy
  // and only commit to localStorage when the user clicks Salvar.
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<ContractItem[] | null>(null);
  // Current measurement period (e.g. "6" → 6ª Medição), persisted per obra.
  // Carrega async do Supabase; default = 1 até chegar.
  const [currentMedicao, setCurrentMedicao] = useState<number>(1);
  useEffect(() => {
    let alive = true;
    loadCurrentMedicao(obra.id).then((n) => {
      if (alive) setCurrentMedicao(n);
    });
    return () => {
      alive = false;
    };
  }, [obra.id]);
  const medicaoLabel = `${currentMedicao}ª Medição`;
  const setMedicao = (n: number) => {
    const safe = Math.max(1, Math.floor(n) || 1);
    setCurrentMedicao(safe);
    void saveCurrentMedicao(obra.id, safe);
  };

  const workingItems = editMode && draft ? draft : items;

  const startEdit = () => {
    if (!canEditItens) return;
    setDraft(items.map((i) => ({ ...i })));
    setEditMode(true);
  };

  const cancelEdit = () => {
    setDraft(null);
    setEditMode(false);
  };

  const saveEdit = () => {
    if (!canEditItens) return;
    if (draft) replaceAll(draft);
    setDraft(null);
    setEditMode(false);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const sortedItems = useMemo(() => sortByCode(workingItems), [workingItems]);

  const filtered = useMemo(() => {
    if (!query.trim()) return sortedItems;
    const q = query.trim().toLowerCase();
    return sortedItems.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.code ?? "").toLowerCase().includes(q) ||
        i.unit.toLowerCase().includes(q)
    );
  }, [sortedItems, query]);

  // Contribuições indexadas por código e medicaoNumber, a partir de todas
  // as atividades da obra (TS + CBUQ). Recarrega quando itens mudam (casos de
  // reconciliar, editar, etc.) — mantém dependência explícita.
  const [activitiesForObra, setActivitiesForObra] = useState<Activity[]>([]);
  useEffect(() => {
    let alive = true;
    loadActivities(obra.id).then((acts) => {
      if (alive) setActivitiesForObra(acts);
    });
    return () => {
      alive = false;
    };
  }, [obra.id, items]);
  const contribsMap: ContribMap = useMemo(() => {
    return buildContribsByCodeAndMedicao(activitiesForObra);
  }, [activitiesForObra]);

  const contractTotal = useMemo(() => grandTotal(workingItems), [workingItems]);
  const measuredCurrentTotal = useMemo(
    () =>
      workingItems
        .filter((i) => !isAggregating(i, workingItems))
        .reduce(
          (sum, i) =>
            sum + aggregatedCurrentValue(i, workingItems, contribsMap, currentMedicao),
          0
        ),
    [workingItems, contribsMap, currentMedicao]
  );
  const measuredTotalAll = useMemo(
    () =>
      workingItems
        .filter((i) => !isAggregating(i, workingItems))
        .reduce(
          (sum, i) => sum + aggregatedAccumulatedValue(i, workingItems, contribsMap),
          0
        ),
    [workingItems, contribsMap]
  );
  void grandCurrentValue; void grandMeasuredValue;

  const handleAdd = () => {
    if (!editMode) return;
    const now = Date.now();
    const item: ContractItem = {
      id: generateId(),
      obraId: obra.id,
      code: "",
      name: "",
      unit: "",
      contractedQty: 0,
      unitPrice: 0,
      type: "item",
      createdAt: now,
      updatedAt: now,
    };
    setDraft((prev) => (prev ? [...prev, item] : [item]));
    setTimeout(() => {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 50);
  };

  const handleUpdate = (
    id: string,
    patch: Partial<ContractItem>
  ) => {
    if (!editMode) return;
    setDraft((prev) =>
      prev
        ? prev.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i))
        : prev
    );
  };

  const handleDelete = (id: string) => {
    if (!editMode) return;
    if (!confirm("Excluir este item do contrato?")) return;
    setDraft((prev) => (prev ? prev.filter((i) => i.id !== id) : prev));
  };

  return (
    <div
      className="fixed inset-0 z-[3000] flex flex-col animate-fadeIn"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between"
        style={{
          padding: "14px 22px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "linear-gradient(180deg, rgba(24,29,40,0.9), rgba(13,16,23,0.9))",
          backdropFilter: "blur(14px)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 36, height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #2fd3a6, #22b590)",
              boxShadow: "0 0 0 1px rgba(47,211,166,0.5), 0 6px 18px -4px rgba(47,211,166,0.5)",
            }}
          >
            <Ruler className="h-4 w-4" style={{ color: "#032a1e" }} />
          </div>
          <div>
            <div className="flex items-center gap-2" style={{ marginBottom: 2 }}>
              <Sparkles className="h-3 w-3" style={{ color: "var(--success)" }} />
              <span className="label-eyebrow" style={{ fontSize: 10 }}>Medição · Contrato</span>
            </div>
            <h1
              style={{
                fontSize: 16, fontWeight: 700,
                letterSpacing: "-0.015em",
                color: "var(--text-primary)",
                lineHeight: 1,
              }}
            >
              {obra.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Medição vigente — stepper */}
          <div
            className="flex items-center gap-1"
            style={{
              padding: "4px 6px",
              background: "var(--info-dim)",
              border: "1px solid rgba(90,167,255,0.35)",
              borderRadius: "var(--r-md)",
            }}
            title="Medição vigente (ciclo atual)"
          >
            <button
              type="button"
              onClick={() => setMedicao(currentMedicao - 1)}
              disabled={currentMedicao <= 1 || !canTrocarPeriodo}
              title={!canTrocarPeriodo ? "Sem permissão para trocar período" : ""}
              style={{
                width: 22, height: 22, borderRadius: 6,
                background: "transparent",
                border: "none",
                color: "var(--info)",
                cursor: currentMedicao <= 1 || !canTrocarPeriodo ? "not-allowed" : "pointer",
                opacity: currentMedicao <= 1 || !canTrocarPeriodo ? 0.4 : 1,
                fontWeight: 700,
              }}
            >
              −
            </button>
            <div
              className="font-mono"
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--info)",
                minWidth: 80,
                textAlign: "center",
                letterSpacing: "-0.01em",
              }}
            >
              {currentMedicao}ª Medição
            </div>
            <button
              type="button"
              onClick={() => setMedicao(currentMedicao + 1)}
              disabled={!canFecharMedicao}
              title={!canFecharMedicao ? "Avançar período fecha a medição — sem permissão" : ""}
              style={{
                width: 22, height: 22, borderRadius: 6,
                background: "transparent",
                border: "none",
                color: "var(--info)",
                cursor: !canFecharMedicao ? "not-allowed" : "pointer",
                opacity: !canFecharMedicao ? 0.4 : 1,
                fontWeight: 700,
              }}
            >
              +
            </button>
          </div>
          {/* Search */}
          <div
            className="flex items-center gap-2"
            style={{
              padding: "7px 12px",
              background: "var(--bg-sunken)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--r-md)",
              minWidth: 220,
            }}
          >
            <Search className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar item..."
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-primary)",
                fontSize: 12,
                width: "100%",
              }}
            />
          </div>
          {canBaixarTemplate && (
            <button
              onClick={() => downloadContractTemplate(obra.name)}
              className="btn btn-ghost"
              style={{ padding: "9px 14px", fontSize: 12 }}
              title="Baixar planilha modelo (.xlsx)"
            >
              <FileDown className="h-4 w-4" />
              Modelo
            </button>
          )}
          {canImportContrato && (
            <button
              onClick={() => setShowImport(true)}
              className="btn btn-ghost"
              style={{ padding: "9px 14px", fontSize: 12 }}
              title="Importar Excel / CSV"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Importar
            </button>
          )}
          {canGerenciarContrato && (
            <button
              onClick={async () => {
                const acts = await loadActivities(obra.id);
                const base = editMode && draft ? draft : items;
                const reconciled = reconcileCurrentQty(base, acts);
                const changed = reconciled.filter(
                  (r, i) => r !== base[i]
                ).length;
                if (changed === 0) {
                  alert("Já está tudo reconciliado — nenhum item precisou de ajuste.");
                  return;
                }
                const ok = confirm(
                  `Recalcular "Qtd da medição atual" a partir das atividades?\n\n${changed} ${changed === 1 ? "item será" : "itens serão"} ajustados.\n\nObs: o total acumulado (Qtd Total) das medições fechadas é preservado.`
                );
                if (!ok) return;
                if (editMode) {
                  setDraft(reconciled);
                } else {
                  replaceAll(reconciled);
                }
              }}
              disabled={items.length === 0}
              className="btn"
              style={{
                padding: "9px 14px",
                fontSize: 12,
                opacity: items.length === 0 ? 0.5 : 1,
                background: "linear-gradient(180deg, rgba(47,211,166,0.18), rgba(47,211,166,0.06))",
                border: "1px solid rgba(47,211,166,0.45)",
                color: "var(--success)",
                fontWeight: 600,
              }}
              title="Recalcular as quantidades da medição atual a partir das atividades (corrige drift)"
            >
              <Check className="h-4 w-4" />
              Reconciliar
            </button>
          )}
          {canExportMedicao && (
            <button
              onClick={async () => {
                const acts = await loadActivities(obra.id);
                exportMedicaoExcel({
                  obra,
                  items: workingItems,
                  activities: acts,
                  medicao: currentMedicao,
                });
              }}
              disabled={items.length === 0}
              className="btn"
              style={{
                padding: "9px 14px",
                fontSize: 12,
                opacity: items.length === 0 ? 0.5 : 1,
                background: "linear-gradient(180deg, rgba(245,158,11,0.18), rgba(245,158,11,0.06))",
                border: "1px solid rgba(245,158,11,0.45)",
                color: "var(--accent-hover)",
                fontWeight: 600,
              }}
              title={`Exportar Excel premium da ${currentMedicao}ª medição`}
            >
              <Sparkles className="h-4 w-4" />
              Excel {currentMedicao}ª Med.
            </button>
          )}
          {editMode && items.length > 0 && (
            <button
              onClick={() => {
                if (
                  confirm(
                    `Apagar TODOS os ${items.length} ${items.length === 1 ? "item" : "itens"} do contrato?\n\nEssa ação não pode ser desfeita.`
                  )
                ) {
                  setDraft([]);
                }
              }}
              className="btn"
              style={{
                padding: "9px 14px",
                fontSize: 12,
                background: "transparent",
                border: "1px solid rgba(255, 90, 114, 0.25)",
                color: "var(--danger)",
                transition: "all 0.18s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--danger-dim)";
                e.currentTarget.style.borderColor = "rgba(255, 90, 114, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "rgba(255, 90, 114, 0.25)";
              }}
              title="Apagar todos os itens do contrato"
            >
              <Trash2 className="h-4 w-4" />
              Apagar tudo
            </button>
          )}
          {editMode ? (
            <>
              <button
                onClick={handleAdd}
                className="btn btn-ghost"
                style={{ padding: "9px 14px", fontSize: 12 }}
                title="Novo item"
              >
                <Plus className="h-4 w-4" />
                Item
              </button>
              <button
                onClick={cancelEdit}
                className="btn btn-ghost"
                style={{ padding: "9px 14px", fontSize: 12 }}
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                className="btn shimmer-wrap"
                style={{
                  padding: "9px 16px",
                  fontSize: 13,
                  background: "linear-gradient(180deg, #3ee2bb, #2fd3a6)",
                  color: "#032a1e",
                  border: "1px solid rgba(47, 211, 166, 0.7)",
                  boxShadow: "0 1px 0 rgba(255, 255, 255, 0.25) inset, 0 4px 12px -4px rgba(47, 211, 166, 0.5)",
                  fontWeight: 700,
                }}
                title="Salvar alterações"
              >
                <Check className="h-4 w-4" />
                Salvar
              </button>
            </>
          ) : (
            canEditItens && (
              <button
                onClick={startEdit}
                className="btn btn-primary shimmer-wrap"
                style={{ padding: "9px 16px", fontSize: 13 }}
                title="Editar itens do contrato"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>
            )
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg"
            style={{ color: "var(--text-muted)", transition: "all 0.2s" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-primary)";
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.background = "transparent";
            }}
            title="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Body */}
      {workingItems.length === 0 ? (
        <EmptyState
          onAdd={() => {
            if (!editMode) startEdit();
            setTimeout(() => handleAdd(), 0);
          }}
          onImport={() => setShowImport(true)}
          onTemplate={() => downloadContractTemplate(obra.name)}
        />
      ) : (
        <>
          <div
            className="flex-1 overflow-auto"
            ref={listRef}
            style={{ padding: "18px 22px" }}
          >
            <ContractTable
              items={filtered}
              allItems={workingItems}
              editMode={editMode}
              medicaoLabel={medicaoLabel}
              contribsMap={contribsMap}
              selectedMedicao={currentMedicao}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
            {filtered.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                Nenhum item encontrado para "{query}".
              </div>
            )}
          </div>

          {/* Summary bar */}
          <div
            className="shrink-0 flex items-center justify-between"
            style={{
              padding: "14px 22px",
              borderTop: "1px solid var(--border-subtle)",
              background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.3))",
            }}
          >
            <div className="flex items-center gap-6 flex-wrap">
              <SummaryStat label="Itens" value={workingItems.length.toString()} />
              <div style={{ width: 1, height: 24, background: "var(--border-subtle)" }} />
              <SummaryStat
                label="Contratado"
                value={CURRENCY.format(contractTotal)}
                accent
              />
              <div style={{ width: 1, height: 24, background: "var(--border-subtle)" }} />
              <SummaryStat
                label={medicaoLabel}
                value={CURRENCY.format(measuredCurrentTotal)}
                color="var(--info)"
              />
              <SummaryStat
                label="Medido total"
                value={CURRENCY.format(measuredTotalAll)}
                color="var(--success)"
              />
              {contractTotal > 0 && (
                <SummaryStat
                  label="% executado"
                  value={`${((measuredTotalAll / contractTotal) * 100).toFixed(1)}%`}
                  color="#c084fc"
                />
              )}
            </div>
            {editMode ? (
              <button
                onClick={handleAdd}
                className="btn btn-ghost"
                style={{ padding: "9px 16px", fontSize: 13 }}
              >
                <Plus className="h-4 w-4" />
                Adicionar item
              </button>
            ) : (
              <button
                onClick={startEdit}
                className="btn btn-primary shimmer-wrap"
                style={{ padding: "9px 16px", fontSize: 13 }}
              >
                <Pencil className="h-4 w-4" />
                Editar itens
              </button>
            )}
          </div>
        </>
      )}

      {showImport && (
        <ImportExcelModal
          obraId={obra.id}
          onCancel={() => setShowImport(false)}
          onConfirm={(incoming) => {
            if (editMode) {
              // Merge into the in-progress draft so Save commits everything at once
              setDraft((prev) => [...(prev ?? []), ...incoming]);
            } else {
              addItems(incoming);
            }
            setShowImport(false);
          }}
        />
      )}
    </div>
  );
}

function SummaryStat({
  label, value, accent = false, color,
}: {
  label: string;
  value: string;
  accent?: boolean;
  color?: string;
}) {
  const valueColor = color ?? (accent ? "var(--success)" : "var(--text-primary)");
  return (
    <div>
      <div
        style={{
          fontSize: 9, fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: accent ? 18 : 14, fontWeight: 700,
          letterSpacing: "-0.02em",
          color: valueColor,
        }}
      >
        {value}
      </div>
    </div>
  );
}

// Column order: Tipo · Código · Descrição · Unid · QtdContr · R$Unit · R$TotalContr
//               · QtdAtual · R$Atual · QtdTotal · R$TotalMed · Delete
const GRID_COLS =
  "78px 80px minmax(260px, 1.7fr) 70px 100px 115px 140px 110px 140px 110px 140px 36px";
const GRID_MIN_WIDTH = 1420;

function ContractTable({
  items, allItems, editMode, medicaoLabel, contribsMap, selectedMedicao, onUpdate, onDelete,
}: {
  items: ContractItem[];
  allItems: ContractItem[];
  editMode: boolean;
  medicaoLabel: string;
  contribsMap: ContribMap;
  selectedMedicao: number;
  onUpdate: (id: string, patch: Partial<ContractItem>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="surface-raised" style={{ padding: 0, overflowX: "auto" }}>
      <div style={{ minWidth: GRID_MIN_WIDTH }}>
      <div
        className="grid shrink-0"
        style={{
          gridTemplateColumns: GRID_COLS,
          padding: "10px 14px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "rgba(13,16,23,0.5)",
          fontSize: 10, fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          gap: 10,
        }}
      >
        <div>Tipo</div>
        <div>Código</div>
        <div>Descrição</div>
        <div>Unid.</div>
        <div style={{ textAlign: "right" }}>Qtd. contratada</div>
        <div style={{ textAlign: "right" }}>R$ Unitário</div>
        <div style={{ textAlign: "right" }}>R$ Total contr.</div>
        <div style={{ textAlign: "right", color: "var(--info)" }} title={`Quantidade medida na ${medicaoLabel}`}>
          Qtd {medicaoLabel}
        </div>
        <div style={{ textAlign: "right", color: "var(--info)" }} title={`R$ medido na ${medicaoLabel}`}>
          R$ {medicaoLabel}
        </div>
        <div style={{ textAlign: "right", color: "var(--success)" }} title="Qtd. total acumulada">
          Qtd. total
        </div>
        <div style={{ textAlign: "right", color: "var(--success)" }} title="R$ total medido acumulado">
          R$ total medido
        </div>
        <div />
      </div>

      <div>
        {items.map((item) => (
          <Row
            key={item.id}
            item={item}
            allItems={allItems}
            editMode={editMode}
            contribsMap={contribsMap}
            selectedMedicao={selectedMedicao}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </div>
      </div>
    </div>
  );
}

function Row({
  item, allItems, editMode, contribsMap, selectedMedicao, onUpdate, onDelete,
}: {
  item: ContractItem;
  allItems: ContractItem[];
  editMode: boolean;
  contribsMap: ContribMap;
  selectedMedicao: number;
  onUpdate: (id: string, patch: Partial<ContractItem>) => void;
  onDelete: (id: string) => void;
}) {
  const level = getLevel(item);
  const aggregated = isAggregating(item, allItems);
  const total = itemTotal(item, allItems);
  // Qty/R$ derivadas por medição a partir das atividades (TS + CBUQ):
  // garantem que trocar o stepper realmente filtra por medicaoNumber.
  const medicaoQty = aggregated
    ? 0
    : itemQtyForMedicao(item, allItems, contribsMap, selectedMedicao, selectedMedicao);
  const medicaoValue = aggregated
    ? aggregatedCurrentValue(item, allItems, contribsMap, selectedMedicao)
    : medicaoQty * (item.unitPrice || 0);
  const accumQty = aggregated
    ? 0
    : itemAccumulatedQty(item, allItems, contribsMap);
  const accumValue = aggregated
    ? aggregatedAccumulatedValue(item, allItems, contribsMap)
    : accumQty * (item.unitPrice || 0);
  const measuredCurrent = medicaoValue;
  const measuredTotal = accumValue;
  void itemCurrentValue; void itemMeasuredValue; // kept imported for other consumers
  const depth = Math.max(1, codeDepth(item.code));
  const indent = Math.max(0, (depth - 1)) * 16;

  const isEtapa = level === "etapa";
  const isSubetapa = level === "subetapa";
  const isItem = level === "item";
  const levelStyles: React.CSSProperties = isEtapa
    ? {
        background: "linear-gradient(180deg, rgba(255,176,32,0.10), rgba(255,176,32,0.03))",
        borderLeft: "3px solid var(--accent)",
        borderBottom: "1px solid rgba(255,176,32,0.18)",
      }
    : isSubetapa
    ? {
        background: "linear-gradient(180deg, rgba(192,132,252,0.08), rgba(192,132,252,0.02))",
        borderLeft: "3px solid #c084fc",
        borderBottom: "1px solid rgba(192,132,252,0.16)",
      }
    : isItem
    ? {
        borderLeft: "3px solid transparent",
        borderBottom: "1px solid var(--border-hair)",
      }
    : {
        borderLeft: "3px solid transparent",
        borderBottom: "1px solid var(--border-hair)",
      };

  const nameWeight = isEtapa ? 700 : isSubetapa ? 650 : isItem ? 500 : 500;
  const nameColor = isEtapa
    ? "var(--accent-hover)"
    : isSubetapa
    ? "#d9b7ff"
    : isItem
    ? "var(--text-primary)"
    : "var(--text-secondary)";
  const nameTransform = isEtapa ? "uppercase" : "none";
  const nameLetterSpacing = isEtapa ? "0.06em" : isSubetapa ? "0.015em" : "-0.005em";

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: GRID_COLS,
        padding: "8px 14px",
        gap: 10,
        alignItems: "center",
        transition: "background 0.18s",
        ...levelStyles,
      }}
      onMouseEnter={(e) => {
        if (!isEtapa) e.currentTarget.style.background = "rgba(255,255,255,0.025)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = (levelStyles.background as string) || "transparent";
      }}
    >
      <TypeChip
        type={level}
        readOnly={!editMode}
        onToggle={() => {
          const next: "etapa" | "subetapa" | "item" =
            level === "etapa" ? "subetapa" : level === "subetapa" ? "item" : "etapa";
          const patch: Partial<ContractItem> = { type: next };
          if (next === "etapa" || next === "subetapa") {
            patch.unit = "";
            patch.contractedQty = 0;
            patch.unitPrice = 0;
          }
          onUpdate(item.id, patch);
        }}
      />
      <CellInput
        value={item.code ?? ""}
        onChange={(v) => onUpdate(item.id, { code: v })}
        placeholder="—"
        mono
        bold={isEtapa}
        color={isEtapa ? "var(--accent-hover)" : undefined}
        readOnly={!editMode}
      />
      <div style={{ display: "flex", alignItems: "center" }}>
        {indent > 0 && (
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: indent,
              flexShrink: 0,
            }}
          />
        )}
        <CellInput
          value={item.name}
          onChange={(v) => onUpdate(item.id, { name: v })}
          placeholder={
            isEtapa
              ? "Ex: INFRAESTRUTURA"
              : isSubetapa
              ? "Ex: Reparo profundo"
              : "Ex: CBUQ — Tapa buracos"
          }
          weight={nameWeight}
          color={nameColor}
          transform={nameTransform}
          letterSpacing={nameLetterSpacing}
          readOnly={!editMode}
        />
      </div>
      {aggregated ? (
        <>
          <AggCell />
          <AggCell align="right" label="(somado)" />
          <AggCell align="right" />
        </>
      ) : (
        <>
          <CellInput
            value={item.unit}
            onChange={(v) => onUpdate(item.id, { unit: v })}
            placeholder="m²"
            mono
            readOnly={!editMode}
          />
          <CellNumberInput
            value={item.contractedQty}
            onChange={(v) => onUpdate(item.id, { contractedQty: v })}
            format={QTY_FMT}
            align="right"
            decimals={4}
            readOnly={!editMode}
          />
          <CellNumberInput
            value={item.unitPrice}
            onChange={(v) => onUpdate(item.id, { unitPrice: v })}
            format={CURRENCY}
            align="right"
            decimals={2}
            readOnly={!editMode}
          />
        </>
      )}
      {/* R$ Total contratado (com badge "auto" em agregadores) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 6,
        }}
      >
        {aggregated && total > 0 && (
          <span
            className="font-mono"
            title="Somado dos filhos"
            style={{
              fontSize: 8.5, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--border-subtle)",
              padding: "2px 6px",
              borderRadius: 999,
            }}
          >
            auto
          </span>
        )}
        <span
          className="font-mono"
          style={{
            fontSize: isEtapa ? 13.5 : 12.5,
            fontWeight: 700,
            color: total > 0
              ? isEtapa ? "var(--accent-hover)" : "var(--success)"
              : "var(--text-faint)",
            letterSpacing: "-0.01em",
          }}
        >
          {CURRENCY.format(total)}
        </span>
      </div>
      {/* Qtd Nª Medição — derivada das atividades registradas com esse medicaoNumber. */}
      {aggregated ? (
        <AggCell align="right" label="—" />
      ) : (
        (() => {
          const suffix = isAdminLocal(item) && medicaoQty > 0 ? " %" : "";
          const tooltip = isAdminLocal(item)
            ? `% calculado a partir dos R$ medidos dos outros itens na ${selectedMedicao}ª medição`
            : `Soma das atividades (Troca de Solo + CBUQ) registradas na ${selectedMedicao}ª medição`;
          return (
            <div
              className="font-mono"
              style={{
                textAlign: "right",
                fontSize: 12,
                fontWeight: 600,
                color: medicaoQty > 0 ? "var(--info)" : "var(--text-faint)",
              }}
              title={tooltip}
            >
              {medicaoQty > 0 ? `${QTY_FMT.format(medicaoQty)}${suffix}` : "—"}
            </div>
          );
        })()
      )}
      {/* R$ medido na medição atual (computed) — ao lado da Qtd atual */}
      <div
        className="font-mono"
        style={{
          textAlign: "right", fontSize: 12,
          fontWeight: 600,
          color: measuredCurrent > 0 ? "var(--info)" : "var(--text-faint)",
        }}
        title="R$ executado na medição atual"
      >
        {measuredCurrent > 0 ? CURRENCY.format(measuredCurrent) : "—"}
      </div>
      {/* Qtd. total medida — soma de todas as medições (atividades de todas as N) + measuredQty */}
      {aggregated ? (
        <AggCell align="right" label="—" />
      ) : (
        (() => {
          const suffix = isAdminLocal(item) && accumQty > 0 ? " %" : "";
          return (
            <div
              className="font-mono"
              style={{
                textAlign: "right",
                fontSize: 12,
                fontWeight: 600,
                color: accumQty > 0 ? "var(--text-primary)" : "var(--text-faint)",
              }}
              title="Soma acumulada de todas as medições (todas atividades)"
            >
              {accumQty > 0 ? `${QTY_FMT.format(accumQty)}${suffix}` : "—"}
            </div>
          );
        })()
      )}
      {/* R$ Total medido (computed) — ao lado da Qtd total */}
      <div
        className="font-mono"
        style={{
          textAlign: "right", fontSize: 12.5,
          fontWeight: 700,
          color: measuredTotal > 0 ? "var(--success)" : "var(--text-faint)",
        }}
        title="R$ acumulado medido"
      >
        {measuredTotal > 0 ? CURRENCY.format(measuredTotal) : "—"}
      </div>
      {editMode ? (
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="p-1.5 rounded-md"
          style={{
            color: "var(--text-faint)",
            background: "transparent",
            transition: "all 0.18s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--danger)";
            e.currentTarget.style.background = "var(--danger-dim)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-faint)";
            e.currentTarget.style.background = "transparent";
          }}
          title="Excluir"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

function CellInput({
  value, onChange, placeholder, mono = false,
  bold = false, color, transform, letterSpacing, weight,
  readOnly = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  bold?: boolean;
  color?: string;
  transform?: React.CSSProperties["textTransform"];
  letterSpacing?: string;
  weight?: number;
  readOnly?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => !readOnly && onChange(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      className={mono ? "font-mono" : ""}
      style={{
        background: "transparent",
        border: "1px solid transparent",
        borderRadius: 6,
        padding: "6px 8px",
        color: color ?? "var(--text-primary)",
        fontSize: 12.5,
        fontWeight: weight ?? (bold ? 700 : 500),
        textTransform: transform,
        letterSpacing,
        width: "100%",
        transition: "border-color 0.18s, background 0.18s",
        cursor: readOnly ? "default" : "text",
      }}
      onFocus={(e) => {
        if (readOnly) return;
        e.currentTarget.style.borderColor = "var(--accent-border)";
        e.currentTarget.style.background = "var(--bg-sunken)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "transparent";
        e.currentTarget.style.background = "transparent";
      }}
    />
  );
}

function TypeChip({
  type, readOnly, onToggle,
}: {
  type: "etapa" | "subetapa" | "item" | "subitem";
  readOnly: boolean;
  onToggle: () => void;
}) {
  const palette =
    type === "etapa"
      ? { color: "var(--accent)", bg: "var(--accent-faint)", border: "rgba(255,176,32,0.35)", label: "Etapa" }
      : type === "subetapa"
      ? { color: "#c084fc", bg: "rgba(192,132,252,0.14)", border: "rgba(192,132,252,0.35)", label: "Subetapa" }
      : { color: "var(--info)", bg: "var(--info-dim)", border: "rgba(90,167,255,0.35)", label: "Item" };
  return (
    <button
      type="button"
      onClick={readOnly ? undefined : onToggle}
      disabled={readOnly}
      className="font-mono"
      title={readOnly ? palette.label : "Alternar tipo (Etapa → Subetapa → Item)"}
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "4px 10px",
        borderRadius: 999,
        color: palette.color,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        cursor: readOnly ? "default" : "pointer",
        transition: "all 0.18s",
        justifySelf: "start",
        width: "fit-content",
      }}
      onMouseEnter={(e) => {
        if (!readOnly) {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = `0 4px 10px -3px ${palette.border}`;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {palette.label}
    </button>
  );
}

function AggCell({ align = "left", label }: { align?: "left" | "right"; label?: string }) {
  return (
    <span
      className="font-mono"
      style={{
        fontSize: 10.5,
        color: "var(--text-faint)",
        padding: "0 10px",
        textAlign: align,
        fontWeight: 500,
      }}
    >
      {label ?? "—"}
    </span>
  );
}

function CellNumberInput({
  value, onChange, format, align = "left", decimals = 2,
  readOnly = false,
}: {
  value: number;
  onChange: (v: number) => void;
  format: Intl.NumberFormat;
  align?: "left" | "right";
  decimals?: number;
  readOnly?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(value.toString().replace(".", ","));

  useEffect(() => {
    if (!focused) setDraft(value.toString().replace(".", ","));
  }, [value, focused]);

  const commit = () => {
    const parsed = parseFloat(draft.replace(/\./g, "").replace(",", "."));
    onChange(Number.isFinite(parsed) ? parsed : 0);
    setFocused(false);
  };

  const display = focused
    ? draft
    : value > 0
    ? format.format(Number(value.toFixed(decimals)))
    : "—";

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      readOnly={readOnly}
      onChange={(e) => !readOnly && setDraft(e.target.value)}
      onFocus={(e) => {
        if (readOnly) return;
        setFocused(true);
        setDraft(value === 0 ? "" : value.toString().replace(".", ","));
        setTimeout(() => e.target.select(), 0);
        e.currentTarget.style.borderColor = "var(--accent-border)";
        e.currentTarget.style.background = "var(--bg-sunken)";
      }}
      onBlur={(e) => {
        if (readOnly) return;
        commit();
        e.currentTarget.style.borderColor = "transparent";
        e.currentTarget.style.background = "transparent";
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="font-mono"
      style={{
        background: "transparent",
        border: "1px solid transparent",
        borderRadius: 6,
        padding: "6px 8px",
        color: value > 0 ? "var(--text-primary)" : "var(--text-faint)",
        fontSize: 12.5,
        width: "100%",
        textAlign: align,
        transition: "border-color 0.18s, background 0.18s",
        cursor: readOnly ? "default" : "text",
      }}
    />
  );
}

function EmptyState({
  onAdd, onImport, onTemplate,
}: {
  onAdd: () => void;
  onImport: () => void;
  onTemplate: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center" style={{ maxWidth: 480 }}>
        <div
          className="flex items-center justify-center mx-auto pulse-glow"
          style={{
            width: 72, height: 72,
            borderRadius: "50%",
            background: "rgba(47,211,166,0.08)",
            border: "1px solid rgba(47,211,166,0.25)",
            marginBottom: 18,
          }}
        >
          <Ruler className="h-8 w-8" style={{ color: "var(--success)" }} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>
          Nenhum item cadastrado
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 22 }}>
          Cadastre os itens do contrato manualmente ou importe de uma planilha Excel.
          O sistema calcula os totais automaticamente.
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={onImport}
            className="btn btn-primary shimmer-wrap"
            style={{ padding: "10px 20px", fontSize: 13 }}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Importar do Excel
          </button>
          <button
            onClick={onAdd}
            className="btn btn-ghost"
            style={{ padding: "10px 20px", fontSize: 13 }}
          >
            <Plus className="h-4 w-4" />
            Cadastrar manualmente
          </button>
        </div>
        <button
          onClick={onTemplate}
          style={{
            marginTop: 14,
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            fontSize: 11,
            letterSpacing: "0.04em",
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: 3,
            transition: "color 0.18s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--success)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          Baixar planilha modelo em branco
        </button>
      </div>
    </div>
  );
}
