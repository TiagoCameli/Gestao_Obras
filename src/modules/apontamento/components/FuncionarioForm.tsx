import { useEffect, useState } from "react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import {
  formatarCpf,
  FUNCOES,
  isCpfValido,
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
    initial?.funcao ?? ""
  );
  const [tipoVinculo, setTipoVinculo] = useState<TipoVinculo>(
    initial?.tipoVinculo ?? "CLT"
  );
  const [salarioBase, setSalarioBase] = useState<number | null>(
    initial?.salarioBase ?? null
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

  // Documentos: misturamos persistidos (com `path`) e os ainda não enviados
  // (com `pendingFile`). Os enviados ganham um signed URL pra download.
  type DocState = {
    item: FuncionarioDocumento;
    pendingFile?: File;
    downloadUrl?: string;
  };
  const [documentos, setDocumentos] = useState<DocState[]>(() =>
    (initial?.documentos ?? []).map((d) => ({ item: d }))
  );

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

  // Hidrata signed URLs dos documentos persistidos.
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

  function validate(): boolean {
    const e: Record<string, string> = {};
    // Único campo obrigatório: nome. Os demais são opcionais — quando o
    // usuário decide preencher CPF, validamos o formato.
    if (!nome.trim()) e.nome = "Obrigatório";
    const cpfDigits = cpf.replace(/\D/g, "");
    if (cpfDigits && !isCpfValido(cpfDigits)) e.cpf = "CPF inválido";
    if (fotos.length > 5) e.fotos = "Máximo de 5 fotos";
    if (salarioBase == null || salarioBase <= 0) {
      e.salarioBase = "Obrigatório (> 0) — base pra cálculo de folha";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    const cpfDigits = cpf.replace(/\D/g, "");
    setSaving(true);
    try {
      // CPF é opcional — só checa duplicidade se foi preenchido.
      if (cpfDigits) {
        const dup = await existeCpf(cpfDigits, initial?.id);
        if (dup) {
          setErrors((e) => ({ ...e, cpf: "CPF já cadastrado" }));
          setSaving(false);
          return;
        }
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

      // Sobe documentos pendentes e monta a lista final.
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
        salarioBase,
        valorDiaria: initial?.valorDiaria ?? null,
        valorHora: initial?.valorHora ?? null,
        obraId: initial?.obraId ?? null,
        equipeId: initial?.equipeId ?? null,
        encarregadoId: initial?.encarregadoId ?? null,
        dataAdmissao,
        dataDemissao: dataDemissao || null,
        status,
        contatoEmergencia: contatoEmergencia || null,
        permiteHorasExtras: false,
        documentos: finalDocs,
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

  function handleAdicionarDocumentos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const novos: DocState[] = files.map((file) => ({
      pendingFile: file,
      item: {
        id: crypto.randomUUID(),
        nome: file.name,
        path: "", // preenchido após upload no submit
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
    // Se já estava no storage, apaga o arquivo também.
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
            error={errors.dataNascimento}
          />
        </Grid>
      </Section>

      <Section title="Cargo e vínculo">
        <Grid cols={3}>
          <Select
            label="Função/cargo"
            options={FUNCOES.map((f) => ({ value: f, label: f }))}
            value={funcao}
            onChange={(e) => setFuncao(e.target.value as FuncaoFuncionario)}
            error={errors.funcao}
          />
          <Select
            label="Tipo de vínculo"
            options={VINCULO_OPTS}
            value={tipoVinculo}
            onChange={(e) => setTipoVinculo(e.target.value as TipoVinculo)}
            error={errors.tipoVinculo}
          />
          <Input
            label="Salário base (R$/mês)"
            type="number"
            step="0.01"
            min="0.01"
            value={salarioBase ?? ""}
            onChange={(e) =>
              setSalarioBase(e.target.value ? Number(e.target.value) : null)
            }
            error={errors.salarioBase}
            placeholder="Ex.: 1518.00"
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
          />
          <Input
            label="Contato de emergência"
            value={contatoEmergencia ?? ""}
            onChange={(e) => setContatoEmergencia(e.target.value)}
            placeholder="Nome + telefone"
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
                    <p className="text-[11px] text-[var(--color-fg-subtle)]">
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
