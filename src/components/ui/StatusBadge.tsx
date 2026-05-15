import { CheckCircle2, FileEdit, AlertTriangle } from "lucide-react";
import { KPIStatus } from "@/types";

export function StatusBadge({ status }: { status: KPIStatus }) {
  if (status === "Certified")
    return (
      <span className="badge badge-certified">
        <CheckCircle2 size={12} /> Certified
      </span>
    );
  if (status === "Draft")
    return (
      <span className="badge badge-draft">
        <FileEdit size={12} /> Draft
      </span>
    );
  return (
    <span className="badge badge-review">
      <AlertTriangle size={12} /> Needs Review
    </span>
  );
}
