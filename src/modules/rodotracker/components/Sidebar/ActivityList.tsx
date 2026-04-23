import type { Activity, ContractItem } from "../../types/activity";
import { ActivityCard } from "./ActivityCard";
import { EmptyState } from "../UI/EmptyState";

interface ActivityListProps {
  activities: Activity[];
  contractItems?: ContractItem[];
  onSelect: (activity: Activity) => void;
  onDelete: (id: string) => void;
}

export function ActivityList({ activities, contractItems, onSelect, onDelete }: ActivityListProps) {
  if (activities.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-2 p-3">
      {activities.map((a) => (
        <ActivityCard
          key={a.id}
          activity={a}
          contractItems={contractItems}
          onClick={() => onSelect(a)}
          onDelete={() => onDelete(a.id)}
        />
      ))}
    </div>
  );
}
