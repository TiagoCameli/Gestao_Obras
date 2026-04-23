import { ArrowRight, Pencil, Trash2, MapPin, FileText, Hash } from "lucide-react";
import type { Obra } from "../../types/activity";

interface ObraCardProps {
  obra: Obra;
  activityCount: number;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ObraCard({ obra, activityCount, onOpen, onEdit, onDelete }: ObraCardProps) {
  return (
    <div className="group bg-[#181b23] border border-[#2e3345] rounded-2xl overflow-hidden hover:border-[#3e4355] transition-all">
      {/* Top color bar */}
      <div className="h-1.5 bg-gradient-to-r from-[#f59e0b] to-[#d97706]" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-[#e8eaf0] truncate">{obra.name}</h3>
            {obra.trecho && (
              <p className="text-xs text-[#5c6380] mt-0.5 truncate">{obra.trecho}</p>
            )}
          </div>
          <div className="flex items-center gap-1 ml-3 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1.5 rounded-lg text-[#5c6380] hover:text-[#f59e0b] hover:bg-[#f59e0b15] opacity-0 group-hover:opacity-100 transition-all"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 rounded-lg text-[#5c6380] hover:text-[#ef4444] hover:bg-[#ef444415] opacity-0 group-hover:opacity-100 transition-all"
              title="Excluir"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Info pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {obra.rodovia && (
            <span className="inline-flex items-center gap-1 bg-[#3b82f620] text-[#3b82f6] border border-[#3b82f640] rounded-full px-2.5 py-0.5 text-[11px] font-mono">
              <MapPin className="h-3 w-3" /> {obra.rodovia}
            </span>
          )}
          {obra.lote && (
            <span className="inline-flex items-center gap-1 bg-[#f59e0b20] text-[#f59e0b] border border-[#f59e0b40] rounded-full px-2.5 py-0.5 text-[11px] font-mono">
              <Hash className="h-3 w-3" /> {obra.lote}
            </span>
          )}
          {obra.contrato && (
            <span className="inline-flex items-center gap-1 bg-[#8b5cf620] text-[#8b5cf6] border border-[#8b5cf640] rounded-full px-2.5 py-0.5 text-[11px] font-mono">
              <FileText className="h-3 w-3" /> {obra.contrato}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#5c6380]">
            <span className="font-mono text-[#9198ad]">{activityCount}</span> atividade(s)
          </span>
          <button
            onClick={onOpen}
            className="flex items-center gap-1.5 bg-[#f59e0b] hover:bg-[#d97706] text-[#0f1117] font-semibold rounded-lg px-4 py-2 text-xs transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(245,158,11,0.3)]"
          >
            Abrir Tracker
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
