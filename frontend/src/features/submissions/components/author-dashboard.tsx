"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { getAuthorDashboard } from "@/features/submissions/api/submissions-api";
import { ActionRequiredPanel } from "@/features/submissions/components/action-required-panel";
import { RecentSubmissionsList } from "@/features/submissions/components/recent-submissions-list";
import { SubmissionSummaryCards } from "@/features/submissions/components/submission-summary-cards";

function getDisplayName(user: {
  first_name?: string;
  last_name?: string;
  username: string;
}) {
  const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return fullName || user.username;
}

export function AuthorDashboard() {
  const { user } = useAuth();

  const dashboardQuery = useQuery({
    queryKey: ["author-dashboard"],
    queryFn: getAuthorDashboard,
  });

  if (dashboardQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-64 animate-pulse rounded-xl bg-slate-200" />
      </div>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-lg font-semibold text-red-900">
          Could not load dashboard
        </h1>
        <p className="mt-2 text-sm text-red-700">
          Please check your connection and try again.
        </p>
      </div>
    );
  }

  const dashboard = dashboardQuery.data;
  if (!dashboard) {
    return null;
  }
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="bg-slate-950 px-6 py-8 text-white">
          <p className="text-sm font-medium text-slate-300">Author dashboard</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome{user ? `, ${getDisplayName(user)}` : ""}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Submit manuscripts, follow editorial progress, respond to revision
            requests, and review your publication history from one place.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/author/submissions/new"
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
            >
              Submit new manuscript
            </Link>
            <Link
              href="/author/submissions"
              className="rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              View my submissions
            </Link>
          </div>
        </div>
      </section>

      <SubmissionSummaryCards summary={dashboard.summary} />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <ActionRequiredPanel items={dashboard.action_required} />
        <RecentSubmissionsList submissions={dashboard.recent_submissions} />
      </div>
    </div>
  );
}
