"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  FileSearch,
  LogIn,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";

import { Notice } from "@/components/common/notice";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  getOwnReviewerApplication,
  getReviewerApplicationSections,
} from "@/features/reviewer-applications/api/reviewer-applications-api";
import { ReviewerApplicationForm } from "@/features/reviewer-applications/components/reviewer-application-form";
import { reviewerApplicationQueryKeys } from "@/features/reviewer-applications/query-keys";
import type {
  ReviewerApplication,
  ReviewerApplicationStatus,
} from "@/features/reviewer-applications/types";
import { USER_ROLE } from "@/types/roles";

const reviewerApplicationLoginHref = "/login?next=/reviewers/apply";

const statusPresentation: Record<
  ReviewerApplicationStatus,
  {
    label: string;
    badgeVariant: "info" | "success" | "danger";
  }
> = {
  PENDING: {
    label: "Pending",
    badgeVariant: "info",
  },
  APPROVED: {
    label: "Approved",
    badgeVariant: "success",
  },
  REJECTED: {
    label: "Rejected",
    badgeVariant: "danger",
  },
};

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function ReviewerStatusSummary({
  application,
}: {
  application: ReviewerApplication;
}) {
  const presentation = statusPresentation[application.status];

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Application status</CardTitle>
            <CardDescription className="mt-1">
              Submitted for the <strong>{application.section.name}</strong>{" "}
              section.
            </CardDescription>
          </div>

          <Badge variant={presentation.badgeVariant}>
            {presentation.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <dl className="grid gap-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              Section
            </dt>
            <dd className="mt-1 font-medium text-foreground">
              {application.section.name}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              Submitted
            </dt>
            <dd className="mt-1 text-foreground">
              {formatDate(application.submitted_at)}
            </dd>
          </div>

          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">
              Expertise
            </dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {application.keywords.map((keyword) => (
                <Badge key={keyword} variant="secondary">
                  {keyword}
                </Badge>
              ))}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

export function ReviewerApplicationPage() {
  const {
    user,
    isAuthenticated,
    isLoading: isAuthLoading,
    refreshCurrentUser,
  } = useAuth();

  const applicationQuery = useQuery({
    queryKey: reviewerApplicationQueryKeys.own(),
    queryFn: getOwnReviewerApplication,
    enabled: isAuthenticated,
    retry: false,
  });

  const sectionsQuery = useQuery({
    queryKey: reviewerApplicationQueryKeys.sections(),
    queryFn: getReviewerApplicationSections,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  const application = applicationQuery.data;
  const hasReviewerRole = Boolean(user?.roles.includes(USER_ROLE.REVIEWER));

  React.useEffect(() => {
    if (application?.status === "APPROVED" && !hasReviewerRole) {
      void refreshCurrentUser();
    }
  }, [application?.status, hasReviewerRole, refreshCurrentUser]);

  const missingProfileFields = user
    ? [
        !user.first_name.trim() ? "first name" : null,
        !user.last_name.trim() ? "last name" : null,
        !user.affiliation.trim() ? "affiliation" : null,
        !user.country.trim() ? "country" : null,
      ].filter((value): value is string => value !== null)
    : [];

  if (isAuthLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div
          className="h-64 animate-pulse rounded-xl bg-muted"
          role="status"
          aria-label="Loading reviewer application"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Peer review"
        title="Become a reviewer"
        description="Contribute your subject expertise to the journal's double-blind peer-review process."
      />

      <div className="grid gap-5 md:grid-cols-3">
        <Card>
          <CardHeader>
            <BookOpenCheck className="size-6 text-accent" />
            <CardTitle className="text-lg">Subject expertise</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Apply for the single journal section that best matches your academic
            specialization.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <FileSearch className="size-6 text-accent" />
            <CardTitle className="text-lg">Independent assessment</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Review anonymized manuscripts and provide constructive
            recommendations to the responsible editor.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Clock3 className="size-6 text-accent" />
            <CardTitle className="text-lg">Timely reviews</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Accept assignments only when you can complete a careful review
            within the editorial deadline.
          </CardContent>
        </Card>
      </div>

      {!isAuthenticated || !user ? (
        <Notice
          tone="info"
          icon={LogIn}
          title="Log in to apply"
          description="Reviewer applications are connected to your existing journal account. Registration creates a normal author account; reviewer access is granted only after editorial approval."
          action={
            <div className="flex flex-wrap gap-3">
              <Link
                href={reviewerApplicationLoginHref}
                className={buttonVariants({
                  variant: "accent",
                  size: "touch",
                })}
              >
                Log in to apply
              </Link>

              <Link
                href="/register?next=/reviewers/apply"
                className={buttonVariants({
                  variant: "outline",
                  size: "touch",
                })}
              >
                Create an account
              </Link>
            </div>
          }
        />
      ) : null}

      {isAuthenticated &&
      user &&
      missingProfileFields.length > 0 &&
      !application &&
      !hasReviewerRole ? (
        <Notice
          tone="warning"
          title="Complete your profile first"
          description={`Add your ${missingProfileFields.join(
            ", ",
          )} before submitting a reviewer application.`}
          action={
            <Link
              href="/author/profile"
              className={buttonVariants({
                variant: "outline",
                size: "touch",
              })}
            >
              Update profile
            </Link>
          }
        />
      ) : null}

      {isAuthenticated && applicationQuery.isError ? (
        <Notice
          tone="destructive"
          title="Application status unavailable"
          description={
            applicationQuery.error instanceof Error
              ? applicationQuery.error.message
              : "The application could not be loaded."
          }
        />
      ) : null}

      {isAuthenticated &&
      sectionsQuery.isError &&
      !application &&
      !hasReviewerRole ? (
        <Notice
          tone="destructive"
          title="Journal sections unavailable"
          description={
            sectionsQuery.error instanceof Error
              ? sectionsQuery.error.message
              : "The available sections could not be loaded."
          }
        />
      ) : null}

      {application?.status === "PENDING" ? (
        <>
          <Notice
            tone="info"
            icon={Clock3}
            title="Application pending"
            description={`Your application is awaiting review by the Section Manager responsible for the ${application.section.name} section. You may update it while it remains pending.`}
          />

          <ReviewerStatusSummary application={application} />
        </>
      ) : null}

      {application?.status === "REJECTED" ? (
        <>
          <Notice
            tone="destructive"
            title="Application rejected"
            description={
              application.decision_note ||
              "The editorial office did not approve this application."
            }
          />

          <ReviewerStatusSummary application={application} />
        </>
      ) : null}

      {application?.status === "APPROVED" ||
      (hasReviewerRole && !application) ? (
        <Notice
          tone="success"
          icon={CheckCircle2}
          title="Reviewer access approved"
          description={
            application
              ? `You are approved to review manuscripts for the ${application.section.name} section.`
              : "Your account already has reviewer access."
          }
          action={
            <Link
              href="/reviewer/invitations"
              className={buttonVariants({
                variant: "accent",
                size: "touch",
              })}
            >
              <UserRoundCheck data-icon="inline-start" aria-hidden="true" />
              Open reviewer portal
            </Link>
          }
        />
      ) : null}

      {isAuthenticated &&
      user &&
      missingProfileFields.length === 0 &&
      !hasReviewerRole &&
      application?.status !== "APPROVED" &&
      !applicationQuery.isLoading &&
      !applicationQuery.isError &&
      !sectionsQuery.isLoading &&
      !sectionsQuery.isError ? (
        <ReviewerApplicationForm
          application={application ?? null}
          sections={sectionsQuery.data ?? []}
        />
      ) : null}
    </div>
  );
}
