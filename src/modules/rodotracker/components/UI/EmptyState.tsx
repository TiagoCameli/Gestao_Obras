import { MapPin } from "lucide-react";

interface EmptyStateProps {
  message?: string;
}

export function EmptyState({ message = "Nenhuma atividade registrada ainda." }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <MapPin className="h-16 w-16 text-[#5c6380] mb-4" />
      <p className="text-[#9198ad] text-sm">{message}</p>
      <p className="text-[#5c6380] text-xs mt-1">
        Clique em "+ Nova Atividade" para começar
      </p>
    </div>
  );
}
