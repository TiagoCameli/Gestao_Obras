import { useEffect, useMemo, useState } from "react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import {
  calcularValorHora,
  formatarCpf,
  FUNCOES,
  isCpfValido,
  type Funcionario,
  type FuncaoFuncionario,
  type StatusFuncionario,
  type TipoVinculo,
} from "../types/funcionario";
import { existeCpf, getFotoUrls, uploadFoto } from "../utils/apontamentoApi";

interface Props {
  initial?: Funcionario | null;
  onSaved: () => void;
  onCancel: () => void;
  onSubmit: (
    f: Omit<Funcionario, "createdAt" | "updatedAt">
  ) => Promise<Funcionario>;
}

type FotoState = { dataUrl?: string; path?: string; previewUrl?: string };

const STATUS_OPTS: { value: StatusFuncionario; label: string }[] = [
  { value: "ativo", label: "Ativo" },
  { value: "inativo", label: "Inativo" },
  { value: "afastado", label: "Afastado" },
  { value: "demitido", label: "Demitido" },
];

const VINCULO_OPTS: { value: TipoVinculo; label: string }[] = [
  { value: "CLT", label: "CLT" },
  { value: "diarista", label: "Diarista" },
  { value: "terceirizado", label: "Terceirizado" },
  { value: "MEI", label: "MEI" },
];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

export default function FuncionarioForm({
  initial,
  onSaved,
  onCancel,
  onSubmit,
}: Props) {
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [cpf, setCpf] = useState(initial?.cpf ?? "");
  const [rg, setRg] = useState(initial?.rg ?? "");
  const [pis, setPis] = useState(initial?.pis ?? "");
  const [ctps, setCtps] = useState(initial?.ctps ?? "");
  const [dataNascimento, setDataNascimento] = useState(
    initial?.dataNascimento ?? ""
  );
  const [funcao, setFuncao] = useState<FuncaoFuncionario>(
    initial?.funcao ?? "operador"
  );
  const [tipoVinculo, setTipoVinculo] = useState<TipoVinculo>(
    initial?.tipoVinculo ?? "CLT"
  );
  const [salarioBase, setSalarioBase] = useState<string>(
    initial?.salarioBase != null ? String(initial.salarioBase) : ""
  );
  const [dataAdmissao, setDataAdmissao] = useState(
    initial?.dataAdmissao ?? new Date().toISOString().slice(0, 10)
  );
  const [dataDemissao, setDataDemissao] = useState(initial?.dataDemissao ?? "");
  const [status, setStatus] = useState<StatusFuncionario>(
    initial?.status ?? "ativo"
  );
  const [contatoEmergencia, setContatoEmergencia] = useState(
    initial?.contatoEmergencia ?? ""
  );
  const [permiteHorasExtras, setPermiteHorasExtras] = useState(
    initial?.permiteHorasExtras ?? true
  );

  // Galeria unificada: 1..5 fotos. A primeira é, automaticamente, a foto de
  // perfil (avatar) e também uma das referências faciais usadas no match.
  const [fotos, setFotos] = useState<FotoState[]>(() => {
    const paths = new Set<string>();
    const initialPaths: string[] = [];
    const push = (p?: string | null) => {
      if (p && !paths.has(p)) {
        paths.add(p);
        initialPaths.push(p);
      }
    };
    push(initial?.fotoPerfil);
    (initial?.fotosReferenciaFacial ?? []).forEach(push);
    return initialPaths.map((path) => ({ path }));
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Hidrata previews das fotos já persistidas
  useEffect(() => {
    const paths = fotos
      .filter((f) => f.path && !f.previewUrl)
      .map((f) => f.path!);
    if (paths.length === 0) return;
    let alive = true;
    getFotoUrls(paths).then((urls) => {
      if (!alive) return;
      setFotos((prev) =>
        prev.map((f) =>
          f.path && urls[f.path] ? { ...f, previewUrl: urls[f.path] } : f
        )
      );
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const valorHoraCalc = useMemo(
    () =>
      calcularValorHora(
        tipoVinculo,
        salarioBase ? Number(salarioBase) : null
      ),
    [tipoVinculo, salarioBase]
  );

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!nome.trim()) e.nome = "Obrigatório";
    const cpfDigits = cpf.replace(/\D/g, "");
    if (!cpfDigits) e.cpf = "Obrigatório";
    else if (!isCpfValido(cpfDigits)) e.cpf = "CPF inválido";
    if (!dataNascimento) e.dataNascimento = "Obrigatório";
    if (!funcao) e.funcao = "Obrigatório";
    if (!tipoVinculo) e.tipoVinculo = "Obrigatório";
    if (!salarioBase) e.salarioBase = "Obrigatório";
    if (!dataAdmissao) e.dataAdmissao = "Obrigatório";
    if (fotos.length < 1) e.fotos = "Adicione pelo menos 1 foto do rosto";
    if (fotos.length > 5) e.fotos = "Máximo de 5 fotos";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    const cpfDigits = cpf.replace(/\D/g, "");
    setSaving(true);
    try {
      // checa CPF duplicado
      const dup = await existeCpf(cpfDigits, initial?.id);
      if (dup) {
        setErrors((e) => ({ ...e, cpf: "CPF já cadastrado" }));
        setSaving(false);
        return;
      }

      // Pré-gera id pra novos cadastros: assim conseguimos subir as fotos
      // antes do INSERT e gravar tudo numa transação só (evita corrida
      // entre o thumb da lista e o segundo update).
      const funcionarioId = initial?.id ?? crypto.randomUUID();

      // Sobe as fotos novas e monta a lista final preservando a ordem
      // (a primeira continua sendo o avatar).
      const finalPaths: string[] = [];
      for (let i = 0; i < fotos.length; i++) {
        const f = fotos[i];
        if (f.path && !f.dataUrl) {
          finalPaths.push(f.path);
        } else if (f.dataUrl) {
          const path = await uploadFoto(funcionarioId, "rosto", i, f.dataUrl);
          finalPaths.push(path);
        }
      }

      const payload: Omit<Funcionario, "createdAt" | "updatedAt"> = {
        id: funcionarioId,
        nome: nome.trim(),
        cpf: cpfDigits,
        rg: rg || null,
        pis: pis || null,
        ctps: ctps || null,
        dataNascimento,
        fotoPerfil: finalPaths[0] ?? null,
        fotosReferenciaFacial: finalPaths,
        funcao,
        tipoVinculo,
        salarioBase: salarioBase ? Number(salarioBase) : null,
        valorDiaria: null,
        valorHora: valorHoraCalc,
        obraId: initial?.obraId ?? null,
        equipeId: initial?.equipeId ?? null,
        encarregadoId: initial?.encarregadoId ?? null,
        dataAdmissao,
        dataDemissao: dataDemissao || null,
        status,
        contatoEmergencia: contatoEmergencia || null,
        permiteHorasExtras,
      };
      await onSubmit(payload);
      onSaved();
    } catch (err) {
      console.error("Falha ao salvar funcionário:", err);
      alert(
        `Falha ao salvar: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAdicionarFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const novas: FotoState[] = await Promise.all(
      files.map(async (f) => {
        const dataUrl = await readFileAsDataUrl(f);
        return { dataUrl, previewUrl: dataUrl };
      })
    );
    setFotos((prev) => [...prev, ...novas].slice(0, 5));
    e.target.value = "";
  }

  function removerFoto(idx: number) {
    setFotos((prev) => prev.filter((_, i) => i !== idx));
  }

  function definirComoPrincipal(idx: number) {
    if (idx === 0) return;
    setFotos((prev) => {
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.unshift(item);
      return next;
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Section title="Identificação">
        <Grid cols={2}>
          <Input
            label="Nome completo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            error={errors.nome}
          />
          <Input
            label="CPF"
            value={formatarCpf(cpf)}
            onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))}
            required
            maxLength={14}
            error={errors.cpf}
          />
          <Input label="RG" value={rg ?? ""} onChange={(e) => setRg(e.target.value)} />
          <Input label="PIS" value={pis ?? ""} onChange={(e) => setPis(e.target.value)} />
          <Input
            label="CTPS (número e série)"
            value={ctps ?? ""}
            onChange={(e) => setCtps(e.target.value)}
          />
          <Input
            label="Data de nascimento"
            type="date"
            value={dataNascimento}
            onChange={(e) => setDataNascimento(e.target.value)}
            required
            error={errors.dataNascimento}
          />
        </Grid>
      </Section>

      <Section title="Cargo e vínculo">
        <Grid cols={2}>
          <Select
            label="Função/cargo"
            options={FUNCOES.map((f) => ({ value: f, label: f }))}
            value={funcao}
            onChange={(e) => setFuncao(e.target.value as FuncaoFuncionario)}
            required
            error={errors.funcao}
          />
          <Select
            label="Tipo de vínculo"
            options={VINCULO_OPTS}
            value={tipoVinculo}
            onChange={(e) => setTipoVinculo(e.target.value as TipoVinculo)}
            required
            error={errors.tipoVinculo}
          />
          <Input
            label="Salário base (R$)"
            type="number"
            step="0.01"
            value={salarioBase}
            onChange={(e) => setSalarioBase(e.target.value)}
            required
            error={errors.salarioBase}
          />
          <Input
            label="Valor-hora (calculado: salário ÷ 220)"
            value={valorHoraCalc != null ? `R$ ${valorHoraCalc.toFixed(4)}` : "—"}
            readOnly
          />
        </Grid>
      </Section>

      <Section title="Vigência">
        <Grid cols={2}>
          <Input
            label="Data de admissão"
            type="date"
            value={dataAdmissao}
            onChange={(e) => setDataAdmissao(e.target.value)}
            required
            error={errors.dataAdmissao}
          />
          <Input
            label="Data de demissão"
            type="date"
            value={dataDemissao ?? ""}
            onChange={(e) => setDataDemissao(e.target.value)}
          />
          <Select
            label="Status"
            options={STATUS_OPTS}
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFuncionario)}
            required
          />
          <Input
            label="Contato de emergência"
            value={contatoEmergencia ?? ""}
            onChange={(e) => setContatoEmergencia(e.target.value)}
            placeholder="Nome + telefone"
          />
        </Grid>
      </Section>

      <Section title="Fotos do rosto">
        <p className="text-xs text-[var(--color-fg-muted)] mb-3">
          Adicione de 1 a 5 fotos do rosto. A <strong>primeira</strong> será a
          foto de perfil; as demais ajudam o reconhecimento facial.
        </p>

        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {fotos.map((f, i) => (
            <div
              key={i}
              className={
                "relative aspect-square rounded-lg overflow-hidden border " +
                (i === 0
                  ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30"
                  : "border-[var(--color-border)]")
              }
            >
              {f.previewUrl ? (
                <img
                  src={f.previewUrl}
                  alt={`foto-${i + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[var(--color-surface-2)]" />
              )}

              {i === 0 && (
                <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]">
                  Principal
                </span>
              )}

              <button
                type="button"
                onClick={() => removerFoto(i)}
                title="Remover"
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-[var(--color-danger)] text-white text-sm flex items-center justify-center"
              >
                ×
              </button>

              {i !== 0 && (
                <button
                  type="button"
                  onClick={() => definirComoPrincipal(i)}
                  className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[10px] py-1 opacity-0 hover:opacity-100 transition-opacity"
                >
                  Tornar principal
                </button>
              )}
            </div>
          ))}

          {fotos.length < 5 && (
            <label
              className="aspect-square rounded-lg border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] text-[var(--color-fg-muted)] flex flex-col items-center justify-center cursor-pointer text-xs"
            >
              <span className="text-2xl leading-none">+</span>
              <span className="mt-1">Adicionar</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleAdicionarFotos}
              />
            </label>
          )}
        </div>

        {errors.fotos && (
          <p className="text-[var(--color-danger)] text-xs mt-2">
            {errors.fotos}
          </p>
        )}
      </Section>

      <Section title="Regras">
        <label className="flex items-center gap-3 text-sm text-[var(--color-fg)]">
          <input
            type="checkbox"
            checked={permiteHorasExtras}
            onChange={(e) => setPermiteHorasExtras(e.target.checked)}
            className="w-4 h-4"
          />
          Permite horas extras
          <span className="text-xs text-[var(--color-fg-subtle)]">
            (se desligado, sistema não calcula HE mesmo em jornada estendida)
          </span>
        </label>
      </Section>

      <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : initial ? "Salvar alterações" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-3">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Grid({
  cols,
  children,
}: {
  cols: 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`grid grid-cols-1 ${cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"} gap-4`}
    >
      {children}
    </div>
  );
}
