"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpenText,
  CircleUserRound,
  FilePlus2,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { getAuthorDashboard } from "@/features/submissions/api/submissions-api";
import { ActionRequiredPanel } from "@/features/submissions/components/action-required-panel";
import { RecentSubmissionsList } from "@/features/submissions/components/recent-submissions-list";
import { SubmissionSummaryCards } from "@/features/submissions/components/submission-summary-cards";
import { submissionQueryKeys } from "@/features/submissions/query-keys";
import { cn } from "@/lib/utils";

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
    queryKey: submissionQueryKeys.dashboard(),
    queryFn: getAuthorDashboard,
  });

  if (dashboardQuery.isLoading) {
    return <AuthorDashboardSkeleton />;
  }

  if (dashboardQuery.isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Author workspace"
          title="Dashboard"
          description="Review manuscripts that need your attention and follow recent editorial activity."
        />
        <ErrorState
          title="Could not load your dashboard"
          description="Check your connection and try loading your author workspace again."
          action={
            <button
              type="button"
              className={buttonVariants({ variant: "outline", size: "touch" })}
              onClick={() => dashboardQuery.refetch()}
            >
              <RefreshCw aria-hidden="true" />
              Try again
            </button>
          }
        />
      </div>
    );
  }

  const dashboard = dashboardQuery.data;

  if (!dashboard) {
    return null;
  }

  const displayName = user ? getDisplayName(user) : null;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Author workspace"
        title={displayName ? `Welcome, ${displayName}` : "Dashboard"}
        description="Start a submission, respond to journal requests, and follow your manuscripts through editorial review."
        actions={
          <Link
            href="/author/submissions/new"
            className={buttonVariants({ variant: "accent", size: "touch" })}
          >
            <FilePlus2 aria-hidden="true" />
            New submission
          </Link>
        }
      />

      {dashboardQuery.isFetching ? (
        <p
          className="flex items-center gap-2 text-xs text-muted-foreground"
          role="status"
        >
          <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
          Updating submission activity…
        </p>
      ) : null}

      <ActionRequiredPanel items={dashboard.action_required} />
      <SubmissionSummaryCards summary={dashboard.summary} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.55fr)]">
        <RecentSubmissionsList submissions={dashboard.recent_submissions} />
        <Card>
          <CardHeader>
            <CardTitle>Author resources</CardTitle>
            <CardDescription>
              Prepare accurate metadata before you submit.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <ResourceLink
              href="/author-guidelines"
              icon={BookOpenText}
              title="Author guidelines"
              description="Review journal scope, file, and manuscript requirements."
            />
            <ResourceLink
              href="/author/profile"
              icon={CircleUserRound}
              title="Researcher profile"
              description="Keep your affiliation and ORCID up to date."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ResourceLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-16 items-start gap-3 rounded-lg border border-transparent p-3",
        "transition-colors hover:border-border hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      <ArrowRight
        className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

function AuthorDashboardSkeleton() {
  return (
    <div className="space-y-7" aria-label="Loading author dashboard">
      <div className="space-y-3 border-b border-border pb-6">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.55fr)]">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  );
}
