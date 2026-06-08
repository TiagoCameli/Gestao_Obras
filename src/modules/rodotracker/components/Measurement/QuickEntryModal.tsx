import { useMemo, useState } from "react";
import Modal from "../../../../components/ui/Modal";
import Input from "../../../../components/ui/Input";
import Select from "../../../../components/ui/Select";
import Button from "../../../../components/ui/Button";
import SubmitButton from "../../../../components/ui/SubmitButton";
import { CbuqForm } from "../Form/CbuqForm";
import { TrocaSoloForm } from "../Form/TrocaSoloForm";
import { useActivities } from "../../hooks/useActivities";
import { useContractItems } from "../../hooks/useContractItems";
import { buildCbuqActivity, buildTsActivity } from "../../utils/activityBuilders";
import { parseKm } from "../../utils/quickEntryParsers";
import type { CbuqData, LadoPista, Obra, TrocaSoloData } from "../../types/activity";

interface Props {
  open: boolean;
  onClose: () => void;
  obra: Obra;
  medicao: number;
}

type Tab = "cbuq" | "ts";

const LADO_OPTIONS = [
  { value: "Pista Toda", label: "Pista Toda" },
  { value: "Direito", label: "Direito" },
  { value: "Esquerdo", label: "Esquerdo" },
];

const emptyCbuq = (medicao: number): CbuqData => ({ medicaoNumber: medicao, cargas: [], contributions: {} });
const emptyTs = (medicao: number): TrocaSoloData => ({
  categoria: "rotineira", medicaoNumber: medicao,
  comprimento: 0, largura: 0, espessura: 0, drenos: [], contributions: {},
});

export function QuickEntryModal({ open, onClose, obra, medicao }: Props) {
  const { activities, addActivity } = useActivities(obra.id);
  const { items: contractItems } = useContractItems(obra.id);

  const [tab, setTab] = useState<Tab>("cbuq");
  const [savedCount, setSavedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cabeçalho CBUQ
  const [cData, setCData] = useState("");
  const [cKmIni, setCKmIni] = useState("");
  const [cKmFim, setCKmFim] = useState("");
  const [cbuqData, setCbuqData] = useState<CbuqData>(() => emptyCbuq(medicao));

  // Cabeçalho TS
  const [tData, setTData] = useState("");
  const [tKm, setTKm] = useState("");
  const [tEstaca, setTEstaca] = useState("");
  const [tFracao, setTFracao] = useState("");
  const [tLado, setTLado] = useState<LadoPista>("Pista Toda");
  const [tNomenclatura, setTNomenclatura] = useState("");
  const [tsData, setTsData] = useState<TrocaSoloData>(() => emptyTs(medicao));

  const nomenclaturasExistentes = useMemo(() => {
    const s = new Set<string>();
    for (const a of activities) {
      if (a.medicao === medicao && a.nomenclatura) s.add(a.nomenclatura.trim());
    }
    return s;
  }, [activities, medicao]);

  const nomenclaturaDup = tNomenclatura.trim().length > 0 && nomenclaturasExistentes.has(tNomenclatura.trim());

  const resetCbuq = () => { setCData(""); setCKmIni(""); setCKmFim(""); setCbuqData(emptyCbuq(medicao)); };
  const resetTs = () => {
    setTData(""); setTKm(""); setTEstaca(""); setTFracao("");
    setTLado("Pista Toda"); setTNomenclatura(""); setTsData(emptyTs(medicao));
  };

  const handleClose = () => {
    if (saving) return;
    resetCbuq(); resetTs(); setError(null); setSavedCount(0); setTab("cbuq");
    onClose();
  };

  async function save(close: boolean) {
    if (saving) return;
    setError(null);

    if (tab === "cbuq") {
      const kmIni = parseKm(cKmIni);
      const kmFim = parseKm(cKmFim);
      if (!cData) return setError("Informe a data.");
      if (kmIni == null || kmFim == null) return setError("Informe o trecho com KM inicial e final válidos.");
      if (kmFim <= kmIni) return setError("O KM final precisa ser maior que o inicial.");
      const cargas = cbuqData.cargas;
      if (cargas.length === 0) return setError("Adicione pelo menos uma carga.");
      for (let i = 0; i < cargas.length; i++) {
        if (!cargas[i].placa.trim()) return setError(`A carga #${i + 1} precisa de placa.`);
        if (cargas[i].pesoT <= 0) return setError(`A carga #${i + 1} precisa de peso maior que zero.`);
      }
      const activity = buildCbuqActivity({ data: cData, kmInicial: kmIni, kmFinal: kmFim, cargas }, obra, medicao);
      setSaving(true);
      try {
        await addActivity(activity);
      } catch (e) {
        setSaving(false);
        return setError(`Falha ao salvar: ${(e as Error).message}`);
      }
      setSaving(false);
      setSavedCount((n) => n + 1);
      if (close) return handleClose();
      resetCbuq();
      return;
    }

    // tab === "ts"
    const km = parseKm(tKm);
    if (!tData) return setError("Informe a data.");
    if (km == null) return setError("Informe um KM válido.");
    if (!tNomenclatura.trim()) return setError("Informe a nomenclatura.");
    const { comprimento, largura, espessura } = tsData;
    if (comprimento <= 0 || largura <= 0 || espessura <= 0) {
      return setError("Preencha comprimento, largura e espessura da troca de solo.");
    }
    const activity = buildTsActivity(
      { data: tData, km, estaca: tEstaca, fracao: tFracao, lado: tLado,
        nomenclatura: tNomenclatura, ts: tsData },
      obra, medicao,
    );
    setSaving(true);
    try {
      await addActivity(activity);
    } catch (e) {
      setSaving(false);
      return setError(`Falha ao salvar: ${(e as Error).message}`);
    }
    setSaving(false);
    setSavedCount((n) => n + 1);
    if (close) return handleClose();
    resetTs();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Lançamento rápido — ${obra.name} · ${medicao}ª Medição`}
      size="xl"
      overlayClassName="z-[3600]"
      contentClassName="z-[3600]"
    >
      {/* Abas */}
      <div className="flex gap-1 mb-4" role="tablist">
        {(["cbuq", "ts"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => { setTab(t); setError(null); }}
            className={
              "px-3 py-1.5 text-sm rounded-lg border transition-colors " +
              (tab === t
                ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                : "bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] border-[var(--color-border)]")
            }
          >
            {t === "cbuq" ? "CBUQ" : "Troca de Solo"}
          </button>
        ))}
        {savedCount > 0 && (
          <span className="ml-auto self-center text-xs text-[var(--color-fg-muted)]">
            {savedCount} {savedCount === 1 ? "lançada" : "lançadas"} nesta sessão
          </span>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {tab === "cbuq" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Data" type="date" required value={cData} onChange={(e) => setCData(e.target.value)} />
            <Input label="KM inicial" placeholder="620" value={cKmIni} onChange={(e) => setCKmIni(e.target.value)} />
            <Input label="KM final" placeholder="635" value={cKmFim} onChange={(e) => setCKmFim(e.target.value)} />
          </div>
          <CbuqForm data={cbuqData} onChange={setCbuqData} contractItems={contractItems} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Data" type="date" required value={tData} onChange={(e) => setTData(e.target.value)} />
            <Input label="KM" placeholder="620+500" value={tKm} onChange={(e) => setTKm(e.target.value)} />
            <Select label="Lado" options={LADO_OPTIONS} value={tLado}
              onChange={(e) => setTLado(e.target.value as LadoPista)} />
            <Input label="Estaca" value={tEstaca} onChange={(e) => setTEstaca(e.target.value)} />
            <Input label="Fração" value={tFracao} onChange={(e) => setTFracao(e.target.value)} />
            <Input label="Nomenclatura" required placeholder="TS15/07"
              value={tNomenclatura} onChange={(e) => setTNomenclatura(e.target.value)} />
          </div>
          {nomenclaturaDup && (
            <div className="text-xs text-[var(--color-warning,#f59e0b)]">
              Já existe uma atividade com essa nomenclatura nesta medição. Você ainda pode salvar.
            </div>
          )}
          <TrocaSoloForm data={tsData} onChange={setTsData} contractItems={contractItems} />
        </div>
      )}

      <div className="flex justify-end gap-2 mt-6">
        <Button type="button" variant="ghost" onClick={handleClose} disabled={saving}>Cancelar</Button>
        <Button type="button" variant="secondary" onClick={() => void save(false)} disabled={saving}>
          Salvar e novo
        </Button>
        <SubmitButton loading={saving} onClick={() => void save(true)}>Salvar e fechar</SubmitButton>
      </div>
    </Modal>
  );
}
