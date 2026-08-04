"use client";

import { EmptyState } from "@/components/common/empty-state";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { EditorialAnalyticsDashboard } from "@/features/intelligence/components/editorial-analytics-dashboard";
import { USER_ROLE } from "@/types/roles";

export function DashboardPage() {
  const { isLoading, hasRole } = useAuth();

  if (isLoading) {
    return (
      <div
        aria-label="Loading dashboard"
        className="h-64 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none"
      />
    );
  }
  const isEditorInChief = hasRole(USER_ROLE.EDITOR_IN_CHIEF);

  const canViewJournalAnalytics = isEditorInChief || hasRole(USER_ROLE.ADMIN);

  if (!canViewJournalAnalytics) {
    return (
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Use the navigation menu to open your role-specific workspace.
          </p>
        </div>

        <EmptyState
          title="Journal-wide analytics are restricted"
          description="The journal analytics dashboard is available to the Editor-in-Chief and administrators."
        />
      </section>
    );
  }

  return <EditorialAnalyticsDashboard />;
}
