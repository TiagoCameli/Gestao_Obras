import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../../../../components/shadcn/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/shadcn/tabs";
import { Button } from "../../../../components/shadcn/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../../../components/shadcn/select";
import { Loader2 } from "lucide-react";
import { QuickEntryGridCbuq } from "./QuickEntryGridCbuq";
import { QuickEntryGridTs } from "./QuickEntryGridTs";
import type { CbuqRow, TsRow } from "../../utils/quickEntryValidators";
import {
  validateRowCbuq, validateRowTs, validateCrossRowTs,
} from "../../utils/quickEntryValidators";
import {
  groupCbuqRowsToActivities, groupTsRowsToActivities,
} from "../../utils/quickEntryGrouping";
import type { Obra, Activity } from "../../types/activity";
import { useActivities } from "../../hooks/useActivities";

interface Props {
  open: boolean;
  onClose: () => void;
  obra: Obra;
  medicao: number;
}

export function QuickEntrySheet({ open, onClose, obra, medicao }: Props) {
  const { activities, addActivity } = useActivities(obra.id);
  const [tab, setTab] = useState<"cbuq" | "ts">("cbuq");
  const [cbuqRows, setCbuqRows] = useState<CbuqRow[]>([]);
  const [tsRows, setTsRows] = useState<TsRow[]>([]);
  const [categoria, setCategoria] = useState<"rotineira" | "passivo">("rotineira");
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ done: number; total: number } | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const existingNomenclaturas = useMemo(() => {
    const s = new Set<string>();
    for (const a of activities) {
      if (a.medicao === medicao && a.nomenclatura) s.add(a.nomenclatura);
    }
    return s;
  }, [activities, medicao]);

  const hasUnsavedContent = cbuqRows.length > 0 || tsRows.length > 0;

  const tryClose = () => {
    if (hasUnsavedContent && !saving) {
      const ok = window.confirm("Você tem lançamentos não salvos. Descartar?");
      if (!ok) return;
    }
    setCbuqRows([]); setTsRows([]); setGlobalError(null); setSaveProgress(null);
    onClose();
  };

  const handleSave = async () => {
    setGlobalError(null);

    // Fase 1 — validação local
    const cbuqHasErrors = cbuqRows.some((r) => Object.keys(validateRowCbuq(r)).length > 0);
    const tsRowHasErrors = tsRows.some((r) => Object.keys(validateRowTs(r)).length > 0);
    const tsCrossErrors = validateCrossRowTs(tsRows, existingNomenclaturas);
    if (cbuqHasErrors || tsRowHasErrors || tsCrossErrors.length > 0) {
      setGlobalError("Corrija os erros marcados em vermelho antes de salvar.");
      return;
    }

    // Fase 2 — agrupamento
    const cbuqActivities = groupCbuqRowsToActivities(cbuqRows, obra, medicao);
    const tsActivities = groupTsRowsToActivities(tsRows, obra, medicao, categoria);
    const all: Activity[] = [...cbuqActivities, ...tsActivities];
    if (all.length === 0) {
      setGlobalError("Nada para salvar.");
      return;
    }

    // Fase 3 — batch upsert sequencial
    setSaving(true);
    setSaveProgress({ done: 0, total: all.length });
    let cargasTotal = 0, drenosTotal = 0;
    try {
      for (let i = 0; i < all.length; i++) {
        await addActivity(all[i]);
        setSaveProgress({ done: i + 1, total: all.length });
        if (all[i].cbuq) cargasTotal += all[i].cbuq!.cargas.length;
        if (all[i].trocaSolo) drenosTotal += all[i].trocaSolo!.drenos.length;
      }
    } catch (err) {
      setGlobalError(`Falha ao salvar: ${(err as Error).message}`);
      setSaving(false);
      return;
    }

    // Fase 4 — pós-save
    setSaving(false);
    setSaveProgress(null);
    setCbuqRows([]); setTsRows([]);
    alert(
      `${all.length} Activities criadas (${cbuqActivities.length} CBUQ, ${tsActivities.length} TS) — ` +
      `${cargasTotal} cargas, ${drenosTotal} drenos.`
    );
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) tryClose(); }}>
      <DialogContent
        overlayClassName="z-[3600]"
        className="z-[3600] max-w-[95vw] w-[1200px] max-h-[90vh] overflow-hidden flex flex-col"
      >
        <DialogHeader>
          <DialogTitle>
            Lançamento rápido — {obra.name} · {medicao}ª Medição
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "cbuq" | "ts")} className="flex-1 overflow-hidden flex flex-col">
          <TabsList>
            <TabsTrigger value="cbuq">CBUQ ({cbuqRows.length})</TabsTrigger>
            <TabsTrigger value="ts">Troca de Solo / Drenos ({tsRows.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="cbuq" className="flex-1 overflow-auto">
            <div className="text-xs text-muted-foreground p-2">
              Cada linha = 1 carga. Linhas com mesma <b>Data</b> + mesmo <b>Trecho do dia</b> viram 1 Activity.
            </div>
            <QuickEntryGridCbuq rows={cbuqRows} onRowsChange={setCbuqRows} />
          </TabsContent>

          <TabsContent value="ts" className="flex-1 overflow-auto">
            <div className="flex items-center justify-between p-2">
              <div className="text-xs text-muted-foreground">
                Cada linha = 1 trecho (TS ou Dreno). Linhas com mesma <b>Nomenclatura</b> viram 1 Activity.
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>Categoria:</span>
                <Select value={categoria} onValueChange={(v) => setCategoria(v as "rotineira" | "passivo")}>
                  <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rotineira">Rotineira</SelectItem>
                    <SelectItem value="passivo">Passivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <QuickEntryGridTs
              rows={tsRows}
              onRowsChange={setTsRows}
              existingNomenclaturas={existingNomenclaturas}
            />
          </TabsContent>
        </Tabs>

        {globalError && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {globalError}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={tryClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || (cbuqRows.length === 0 && tsRows.length === 0)}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {saveProgress ? `Salvando ${saveProgress.done}/${saveProgress.total}...` : "Salvar tudo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
