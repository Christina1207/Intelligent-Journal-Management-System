import type { ManagerMonitoringStatus } from "@/features/workflow/types";

const MANAGER_QUERY_ROOT = ["manager"] as const;

export const managerQueryKeys = {
  all: MANAGER_QUERY_ROOT,

  queueRoot: [...MANAGER_QUERY_ROOT, "queue"] as const,

  queue: (page: number) => [...MANAGER_QUERY_ROOT, "queue", { page }] as const,

  monitoringRoot: [...MANAGER_QUERY_ROOT, "monitoring"] as const,

  monitoring: (page: number, status?: ManagerMonitoringStatus) =>
    [
      ...MANAGER_QUERY_ROOT,
      "monitoring",
      {
        page,
        status: status ?? null,
      },
    ] as const,

  triageRoot: [...MANAGER_QUERY_ROOT, "triage"] as const,

  triage: (submissionId: string) =>
    [...MANAGER_QUERY_ROOT, "triage", submissionId] as const,

  eligibleEditorsRoot: [...MANAGER_QUERY_ROOT, "eligible-editors"] as const,

  eligibleEditors: (submissionId: string) =>
    [...MANAGER_QUERY_ROOT, "eligible-editors", submissionId] as const,
};
