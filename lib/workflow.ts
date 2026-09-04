export type WorkflowAction = "approve" | "reject" | "post" | "issue" | "reconcile" | "retry" | "complete" | "void" | "set_status";

const ALLOWED_FROM: Record<WorkflowAction, string[]> = {
  approve: ["Pending Approval"],
  reject: ["Pending Approval"],
  post: ["Draft", "Approved"],
  issue: ["Draft"],
  reconcile: ["Unreconciled"],
  retry: ["Failed", "Queued"],
  complete: ["Pending", "In Progress"],
  void: ["Draft", "Issued", "Pending Approval", "Approved", "Preparing", "Ready to File", "Unreconciled", "Rejected"],
  set_status: ["Preparing"],
};

export function transitionStatus(currentStatus: string, action: WorkflowAction, requestedStatus?: string) {
  if (!ALLOWED_FROM[action].includes(currentStatus)) return null;
  if (action === "approve") return "Approved";
  if (action === "reject") return "Rejected";
  if (action === "post") return "Posted";
  if (action === "issue") return "Issued";
  if (action === "reconcile") return "Reconciled";
  if (action === "retry") return "Synced";
  if (action === "complete") return "Completed";
  if (action === "void") return "Void";
  return requestedStatus === "Ready to File" ? requestedStatus : null;
}
