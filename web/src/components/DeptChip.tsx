import { useData } from "../store";
import { useI18n } from "../lib/i18n";

export function DeptChip({ id }: { id: string | null | undefined }) {
  const { departments } = useData();
  const { t } = useI18n();
  const d = departments.find((x) => x.id === id);
  const color = d?.color || "#9ca3af";
  return (
    <span className="dept-chip" style={{ borderColor: color, color }}>
      <i style={{ background: color }} />
      {d ? d.name : t("common.unassigned")}
    </span>
  );
}
