"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AttentionFlagBadge } from "@/features/workflow/components/attention-flag-badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import {
  getManagerMonitoring,
  getManagerQueue,
} from "@/features/workflow/api/manager-api";
import { managerQueryKeys } from "@/features/workflow/api/manager-query-keys";
import type {
  ManagerMonitoringSubmission,
  ManagerQueueSubmission,
} from "@/features/workflow/types";

const DASHBOARD_PAGE = 1;
const DASHBOARD_ITEM_LIMIT = 4;

function getDisplayName(user: {
  first_name?: string;
  last_name?: string;
  username: string;
}) {
  const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return fullName || user.username;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function ManagerDashboard() {
  const { user } = useAuth();

  const queueQuery = useQuery({
    queryKey: managerQueryKeys.queue(DASHBOARD_PAGE),
    queryFn: () => getManagerQueue(DASHBOARD_PAGE),
  });

  const monitoringQuery = useQuery({
    queryKey: managerQueryKeys.monitoring(DASHBOARD_PAGE),
    queryFn: () => getManagerMonitoring(DASHBOARD_PAGE),
  });

  if (queueQuery.isLoading || monitoringQuery.isLoading) {
    return <ManagerDashboardSkeleton />;
  }

  if (queueQuery.isError || monitoringQuery.isError) {
    return (
      <ManagerDashboardError
        onRetry={() => {
          void queueQuery.refetch();
          void monitoringQuery.refetch();
        }}
      />
    );
  }

  const queue = queueQuery.data;
  const monitoring = monitoringQuery.data;

  if (!queue || !monitoring) {
    return null;
  }

  const recentQueueItems = queue.results.slice(0, DASHBOARD_ITEM_LIMIT);

  const attentionCases = monitoring.results
    .filter((submission) => submission.attention_flags.length > 0)
    .slice(0, DASHBOARD_ITEM_LIMIT);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-sm">
        <div className="px-6 py-8 text-white sm:px-8">
          <p className="text-sm font-medium text-slate-300">
            Section Manager dashboard
          </p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome{user ? `, ${getDisplayName(user)}` : ""}
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Oversee initial manuscript screening and follow active editorial
            cases across the sections you manage.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/manager/submissions"
              className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Review screening queue
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>

            <Link
              href="/manager/monitoring"
              className="inline-flex items-center gap-2 rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Monitor active manuscripts
            </Link>
          </div>
        </div>
      </section>

      <section
        aria-label="Manager workload summary"
        className="grid gap-4 sm:grid-cols-2"
      >
        <DashboardCountCard
          label="Awaiting initial screening"
          value={queue.count}
          description="New submissions waiting for triage."
          href="/manager/submissions"
          icon={ClipboardCheck}
        />

        <DashboardCountCard
          label="Active manuscripts"
          value={monitoring.count}
          description="Managed cases currently in the editorial workflow."
          href="/manager/monitoring"
          icon={Activity}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <RecentScreeningQueue submissions={recentQueueItems} />

        <AttentionCases submissions={attentionCases} />
      </div>
    </div>
  );
}

function DashboardCountCard({
  label,
  value,
  description,
  href,
  icon: Icon,
}: {
  label: string;
  value: number;
  description: string;
  href: string;
  icon: LucideIcon;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>

          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            {value.toLocaleString()}
          </p>
        </div>

        <span className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Icon aria-hidden="true" className="size-5" />
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>

      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-950 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        View details
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </article>
  );
}

function RecentScreeningQueue({
  submissions,
}: {
  submissions: ManagerQueueSubmission[];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Recent screening queue
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Most recently submitted manuscripts awaiting triage.
          </p>
        </div>

        <Link
          href="/manager/submissions"
          className="shrink-0 text-sm font-medium text-slate-700 hover:text-slate-950 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          View all
        </Link>
      </div>

      {submissions.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-slate-200 p-6 text-center">
          <ClipboardCheck
            aria-hidden="true"
            className="mx-auto size-6 text-slate-400"
          />
          <h3 className="mt-3 text-sm font-semibold text-slate-950">
            Screening queue is clear
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            There are no newly submitted manuscripts awaiting triage.
          </p>
        </div>
      ) : (
        <div className="mt-5 divide-y divide-slate-200">
          {submissions.map((submission) => (
            <article key={submission.id} className="py-4 first:pt-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="line-clamp-2 font-medium text-slate-950">
                    {submission.title}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {submission.section.name} · Submitted{" "}
                    {formatDate(submission.submitted_at)}
                  </p>
                </div>

                <SubmissionStatusBadge status={submission.status} />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AttentionCases({
  submissions,
}: {
  submissions: ManagerMonitoringSubmission[];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Cases needing attention
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Attention flags found on the current monitoring page.
          </p>
        </div>

        <Link
          href="/manager/monitoring"
          className="shrink-0 text-sm font-medium text-slate-700 hover:text-slate-950 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          View all
        </Link>
      </div>

      {submissions.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-slate-200 p-6 text-center">
          <Activity
            aria-hidden="true"
            className="mx-auto size-6 text-slate-400"
          />
          <h3 className="mt-3 text-sm font-semibold text-slate-950">
            No flagged cases on this page
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            The currently loaded active cases do not require highlighted
            follow-up.
          </p>
        </div>
      ) : (
        <div className="mt-5 divide-y divide-slate-200">
          {submissions.map((submission) => (
            <article key={submission.id} className="py-4 first:pt-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="line-clamp-2 font-medium text-slate-950">
                    {submission.title}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {submission.section.name}
                    {submission.assigned_editor
                      ? ` · ${submission.assigned_editor.full_name}`
                      : " · No editor assigned"}
                  </p>
                </div>

                <SubmissionStatusBadge status={submission.status} />
              </div>

              <div
                aria-label="Attention flags"
                className="mt-3 flex flex-wrap gap-2"
              >
                {submission.attention_flags.map((flag) => (
                  <AttentionFlagBadge key={flag} flag={flag} />
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ManagerDashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-6"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-red-700"
        />

        <div>
          <h1 className="text-lg font-semibold text-red-900">
            Could not load the manager dashboard
          </h1>

          <p className="mt-2 text-sm leading-6 text-red-700">
            The screening queue or active manuscript data could not be
            retrieved. Check your connection and try again.
          </p>

          <Button
            type="button"
            variant="outline"
            onClick={onRetry}
            className="mt-4 border-red-300 bg-white text-red-800 hover:bg-red-100"
          >
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        </div>
      </div>
    </section>
  );
}

function ManagerDashboardSkeleton() {
  return (
    <div
      aria-label="Loading manager dashboard"
      aria-busy="true"
      className="space-y-6"
    >
      <div className="h-56 animate-pulse rounded-xl bg-slate-200" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-40 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-40 animate-pulse rounded-xl bg-slate-200" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-80 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-80 animate-pulse rounded-xl bg-slate-200" />
      </div>
    </div>
  );
}
