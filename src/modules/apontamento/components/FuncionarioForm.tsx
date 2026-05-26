/**
 * FuncionarioForm (Apontamento RH) — Onda 5.C: migrado pra RHF + Zod (hybrid).
 *
 * RHF gerencia campos top-level (identificação + cargo/vínculo + vigência).
 * Fotos (até 5, com upload async pro Storage) e documentos (anexos
 * arbitrários, upload async) continuam em useState — uploads são
 * sequenciais no submit handler.
 *
 * Validação assíncrona de CPF duplicado (existeCpf API) fica no submit
 * handler — não dá pra cobrir no Zod sync.
 */
import { useCallback, useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import { useToast } from "../../../components/ui/Toast";
import {
  formatarCpf,
  FUNCOES,
  type Funcionario,
  type FuncaoFuncionario,
  type FuncionarioDocumento,
  type StatusFuncionario,
  type TipoVinculo,
} from "../types/funcionario";
import {
  deleteDocumentos,
  existeCpf,
  getDocumentoUrls,
  getFotoUrls,
  uploadDocumento,
  uploadFoto,
} from "../utils/apontamentoApi";
import {
  funcionarioRhFormSchema,
  type FuncionarioRhFormValues,
} from "../../../schemas/apontamento/funcionarioRh.schema";

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
  { value: "prestador_servico", label: "Prestador de serviço" },
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

function buildDefaults(initial: Funcionario | null | undefined): FuncionarioRhFormValues {
  return {
    nome: initial?.nome ?? "",
    cpf: initial?.cpf ?? "",
    rg: initial?.rg ?? "",
    pis: initial?.pis ?? "",
    ctps: initial?.ctps ?? "",
    dataNascimento: initial?.dataNascimento ?? "",
    funcao: initial?.funcao ?? "",
    // Schema do form não aceita 'diarista' (já migrado pra prestador_servico —
    // ver fix #12 do audit). Funcionários antigos com 'diarista' → mapear.
    tipoVinculo: (initial?.tipoVinculo === "diarista" ? "prestador_servico" : initial?.tipoVinculo) ?? "CLT",
    salarioBase: initial?.salarioBase ?? (undefined as unknown as number),
    dataAdmissao: initial?.dataAdmissao ?? new Date().toISOString().slice(0, 10),
    dataDemissao: initial?.dataDemissao ?? "",
    status: initial?.status ?? "ativo",
    contatoEmergencia: initial?.contatoEmergencia ?? "",
  };
}

export default function FuncionarioForm({
  initial,
  onSaved,
  onCancel,
  onSubmit,
}: Props) {
  const { showToast } = useToast();

  // ── Estado fora do RHF: fotos, documentos, errors locais, saving ────────
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

  type DocState = {
    item: FuncionarioDocumento;
    pendingFile?: File;
    downloadUrl?: string;
  };
  const [documentos, setDocumentos] = useState<DocState[]>(() =>
    (initial?.documentos ?? []).map((d) => ({ item: d }))
  );

  const [errorFotos, setErrorFotos] = useState<string | null>(null);
  const [errorCpfDup, setErrorCpfDup] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── RHF + Zod ────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit: rhfHandleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FuncionarioRhFormValues>({
    resolver: zodResolver(funcionarioRhFormSchema),
    mode: "onChange",
    defaultValues: buildDefaults(initial),
  });

  useEffect(() => {
    reset(buildDefaults(initial));
  }, [initial, reset]);

  // Hidrata previews das fotos persistidas
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

  // Hidrata signed URLs dos documentos persistidos
  useEffect(() => {
    const paths = documentos
      .filter((d) => !d.pendingFile && !d.downloadUrl)
      .map((d) => d.item.path);
    if (paths.length === 0) return;
    let alive = true;
    getDocumentoUrls(paths).then((urls) => {
      if (!alive) return;
      setDocumentos((prev) =>
        prev.map((d) =>
          d.pendingFile || d.downloadUrl ? d : { ...d, downloadUrl: urls[d.item.path] }
        )
      );
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Submit ───────────────────────────────────────────────────────────────
  const onValidSubmit = useCallback(async (values: FuncionarioRhFormValues) => {
    setErrorCpfDup(null);
    setErrorFotos(null);
    if (fotos.length > 5) {
      setErrorFotos("Máximo de 5 fotos");
      return;
    }
    const cpfDigits = (values.cpf ?? "").replace(/\D/g, "");
    setSaving(true);
    try {
      // CPF é opcional — só checa duplicidade se foi preenchido.
      if (cpfDigits) {
        const dup = await existeCpf(cpfDigits, initial?.id);
        if (dup) {
          setErrorCpfDup("CPF já cadastrado");
          setSaving(false);
          return;
        }
      }

      const funcionarioId = initial?.id ?? crypto.randomUUID();

      // Sobe fotos novas, preserva ordem (1ª = avatar)
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

      // Sobe documentos pendentes
      const finalDocs: FuncionarioDocumento[] = [];
      for (const d of documentos) {
        if (d.pendingFile) {
          const path = await uploadDocumento(funcionarioId, d.pendingFile);
          finalDocs.push({ ...d.item, path });
        } else {
          finalDocs.push(d.item);
        }
      }

      const payload: Omit<Funcionario, "createdAt" | "updatedAt"> = {
        id: funcionarioId,
        nome: values.nome.trim(),
        cpf: cpfDigits,
        rg: values.rg || null,
        pis: values.pis || null,
        ctps: values.ctps || null,
        dataNascimento: values.dataNascimento || "",
        fotoPerfil: finalPaths[0] ?? null,
        fotosReferenciaFacial: finalPaths,
        funcao: values.funcao as FuncaoFuncionario,
        tipoVinculo: values.tipoVinculo,
        salarioBase: values.salarioBase,
        valorDiaria: initial?.valorDiaria ?? null,
        valorHora: initial?.valorHora ?? null,
        obraId: initial?.obraId ?? null,
        equipeId: initial?.equipeId ?? null,
        encarregadoId: initial?.encarregadoId ?? null,
        dataAdmissao: values.dataAdmissao,
        dataDemissao: values.dataDemissao || null,
        status: values.status,
        contatoEmergencia: values.contatoEmergencia || null,
        permiteHorasExtras: false,
        documentos: finalDocs,
      };
      await onSubmit(payload);
      onSaved();
    } catch (err) {
      console.error("Falha ao salvar funcionário:", err);
      showToast({
        kind: "error",
        message: `Falha ao salvar: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setSaving(false);
    }
  }, [fotos, documentos, initial, onSubmit, onSaved, showToast]);

  // ── Fotos / Documentos handlers ──────────────────────────────────────────
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

  function handleAdicionarDocumentos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const novos: DocState[] = files.map((file) => ({
      pendingFile: file,
      item: {
        id: crypto.randomUUID(),
        nome: file.name,
        path: "",
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
      },
    }));
    setDocumentos((prev) => [...prev, ...novos]);
    e.target.value = "";
  }

  async function removerDocumento(id: string) {
    const target = documentos.find((d) => d.item.id === id);
    if (!target) return;
    if (!target.pendingFile && target.item.path) {
      try {
        await deleteDocumentos([target.item.path]);
      } catch (e) {
        console.warn("Falha ao apagar documento do storage:", e);
      }
    }
    setDocumentos((prev) => prev.filter((d) => d.item.id !== id));
  }

  function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }

  return (
    <form onSubmit={rhfHandleSubmit(onValidSubmit)} className="space-y-5">
      <Section title="Identificação">
        <Grid cols={2}>
          <Input
            label="Nome completo"
            required
            error={errors.nome?.message}
            {...register("nome")}
          />
          <Controller
            control={control}
            name="cpf"
            render={({ field }) => (
              <Input
                label="CPF"
                maxLength={14}
                error={errorCpfDup ?? errors.cpf?.message}
                value={formatarCpf(field.value ?? "")}
                onChange={(e) => {
                  setErrorCpfDup(null);
                  field.onChange(e.target.value.replace(/\D/g, ""));
                }}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
          <Input label="RG" error={errors.rg?.message} {...register("rg")} />
          <Input label="PIS" error={errors.pis?.message} {...register("pis")} />
          <Input
            label="CTPS (número e série)"
            error={errors.ctps?.message}
            {...register("ctps")}
          />
          <Input
            label="Data de nascimento"
            type="date"
            error={errors.dataNascimento?.message}
            {...register("dataNascimento")}
          />
        </Grid>
      </Section>

      <Section title="Cargo e vínculo">
        <Grid cols={3}>
          <Select
            label="Função/cargo"
            options={FUNCOES.map((f) => ({ value: f, label: f }))}
            error={errors.funcao?.message}
            {...register("funcao")}
          />
          <Select
            label="Tipo de vínculo"
            options={VINCULO_OPTS}
            error={errors.tipoVinculo?.message}
            {...register("tipoVinculo")}
          />
          <Input
            label="Salário base (R$/mês)"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Ex.: 1518.00"
            error={errors.salarioBase?.message}
            {...register("salarioBase", { valueAsNumber: true })}
          />
        </Grid>
      </Section>

      <Section title="Vigência">
        <Grid cols={2}>
          <Input
            label="Data de admissão"
            type="date"
            required
            error={errors.dataAdmissao?.message}
            {...register("dataAdmissao")}
          />
          <Input
            label="Data de demissão"
            type="date"
            error={errors.dataDemissao?.message}
            {...register("dataDemissao")}
          />
          <Select
            label="Status"
            options={STATUS_OPTS}
            error={errors.status?.message}
            {...register("status")}
          />
          <Input
            label="Contato de emergência"
            placeholder="Nome + telefone"
            error={errors.contatoEmergencia?.message}
            {...register("contatoEmergencia")}
          />
        </Grid>
      </Section>

      <Section title="Fotos do rosto (opcional)">
        <p className="text-xs text-[var(--color-fg-muted)] mb-3">
          Opcional — até 5 fotos. Se cadastrar, a <strong>primeira</strong> será a
          foto de perfil e as demais ajudam o reconhecimento facial. Funcionários
          sem foto cadastrada batem ponto sem captura/validação facial.
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
                <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-3xs font-semibold bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]">
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
                  className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-3xs py-1 opacity-0 hover:opacity-100 transition-opacity"
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

        {errorFotos && (
          <p className="text-[var(--color-danger)] text-xs mt-2">
            {errorFotos}
          </p>
        )}
      </Section>

      <Section title="Documentos (opcional)">
        <p className="text-xs text-[var(--color-fg-muted)] mb-3">
          Anexe RG, CTPS, comprovantes ou qualquer outro arquivo. Sem
          restrição de tipo. Os arquivos só são enviados quando você
          salvar o cadastro.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <label
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            Anexar arquivos
            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleAdicionarDocumentos}
            />
          </label>
          <span className="text-xs text-[var(--color-fg-subtle)]">
            {documentos.length}{" "}
            {documentos.length === 1 ? "arquivo" : "arquivos"}
          </span>
        </div>

        {documentos.length > 0 && (
          <ul className="space-y-1.5">
            {documentos.map((d) => {
              const podeBaixar = !d.pendingFile && d.downloadUrl;
              return (
                <li
                  key={d.item.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)]"
                >
                  <svg className="w-4 h-4 shrink-0 text-[var(--color-fg-subtle)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--color-fg)] truncate">{d.item.nome}</p>
                    <p className="text-2xs text-[var(--color-fg-subtle)]">
                      {formatBytes(d.item.size)}
                      {d.pendingFile && (
                        <span className="ml-2 text-[var(--color-warning-fg)]">
                          • aguardando salvar
                        </span>
                      )}
                    </p>
                  </div>
                  {podeBaixar && (
                    <a
                      href={d.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2 py-1 rounded text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors"
                      title="Abrir / baixar"
                    >
                      Abrir
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => removerDocumento(d.item.id)}
                    className="text-xs px-2 py-1 rounded text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] transition-colors"
                  >
                    Remover
                  </button>
                </li>
              );
            })}
          </ul>
        )}
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
