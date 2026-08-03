"use client";

import * as React from "react";
import { FileSearch, RefreshCw, RotateCcw, ShieldAlert } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Notice } from "@/components/common/notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { integrityQueryKeys } from "@/features/integrity/api/integrity-query-keys";
import {
  getPlagiarismScreeningDetail,
  requestPlagiarismScreening,
} from "@/features/integrity/api/plagiarism-api";
import { PlagiarismReportDialog } from "@/features/integrity/components/plagiarism-report-dialog";
import type {
  PlagiarismScreeningDetail,
  PlagiarismScreeningStatus,
  PlagiarismScreeningSummary,
} from "@/features/integrity/types";
import { ApiError } from "@/lib/api/errors";

type BadgeVariant = "outline" | "info" | "warning" | "success" | "danger";

type ScreeningPresentation = {
  badge: BadgeVariant;
  label: string;
  title: string;
  description: string;
};

function isActiveStatus(status: PlagiarismScreeningStatus | undefined) {
  return status === "QUEUED" || status === "RUNNING";
}

function formatPercent(value: number | undefined) {
  return value === undefined ? "—" : `${value.toFixed(1)}%`;
}

function formatProbability(value: number | undefined) {
  return value === undefined ? "—" : `${(value * 100).toFixed(1)}%`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "The screening request could not be completed.";
}

function getPresentation(
  screening: PlagiarismScreeningSummary | null,
  language: string,
): ScreeningPresentation {
  if (!screening) {
    if (language !== "ar") {
      return {
        badge: "outline",
        label: "Not supported",
        title: "Screening unavailable for this language",
        description:
          "Automatic plagiarism screening currently supports Arabic manuscripts only.",
      };
    }

    return {
      badge: "outline",
      label: "Not requested",
      title: "No screening is available",
      description: "Request a screening for the latest manuscript version.",
    };
  }

  if (screening.status === "QUEUED") {
    return {
      badge: "info",
      label: "Queued",
      title: "Screening is waiting to start",
      description:
        "The request was recorded and is waiting for a plagiarism worker.",
    };
  }

  if (screening.status === "RUNNING") {
    return {
      badge: "info",
      label: "Running",
      title: "Screening is in progress",
      description:
        "The manuscript is being compared with the configured source corpus.",
    };
  }

  if (screening.status === "FAILED") {
    return {
      badge: "danger",
      label: "Failed",
      title: "Screening could not complete",
      description:
        screening.error_message ||
        "The screening failed safely and can be requested again.",
    };
  }

  if (screening.summary.plagiarism_detected) {
    return {
      badge: "warning",
      label: "Review required",
      title: "Potential textual overlap was detected",
      description:
        "Review the submitted and matched passages before making an editorial decision.",
    };
  }

  return {
    badge: "success",
    label: "Completed",
    title: "No potential matches were flagged",
    description:
      "The screening completed without flagged evidence. This does not prove originality.",
  };
}

export function PlagiarismScreeningPanel({
  submissionId,
  language,
  screening,
  onScreeningChange,
}: {
  submissionId: string;
  language: string;
  screening: PlagiarismScreeningSummary | null;
  onScreeningChange: (screening: PlagiarismScreeningSummary) => void;
}) {
  const queryClient = useQueryClient();
  const [reportOpen, setReportOpen] = React.useState(false);

  const screeningId = screening?.id ?? null;

  const detailQuery = useQuery({
    queryKey: integrityQueryKeys.plagiarismScreening(screeningId ?? "none"),
    queryFn: () => {
      if (!screeningId) {
        throw new Error("No plagiarism screening was selected.");
      }

      return getPlagiarismScreeningDetail(screeningId);
    },
    enabled:
      screeningId !== null && (reportOpen || isActiveStatus(screening?.status)),
    refetchInterval: (query) => {
      const status = query.state.data?.status ?? screening?.status;

      return isActiveStatus(status) ? 5_000 : false;
    },
    refetchOnWindowFocus: false,
  });

  const requestMutation = useMutation({
    mutationFn: () => requestPlagiarismScreening(submissionId),
    onSuccess: (nextScreening) => {
      queryClient.setQueryData<PlagiarismScreeningDetail>(
        integrityQueryKeys.plagiarismScreening(nextScreening.id),
        {
          ...nextScreening,
          report: null,
        },
      );

      onScreeningChange(nextScreening);
    },
  });

  const currentScreening = detailQuery.data ?? screening;

  const presentation = getPresentation(currentScreening, language);

  const canRequest =
    language === "ar" &&
    (currentScreening === null || currentScreening.status === "FAILED");

  const isActive = isActiveStatus(currentScreening?.status);

  const summary =
    currentScreening?.status === "COMPLETED" ? currentScreening.summary : null;

  return (
    <>
      <section className="rounded-xl border border-border/80 bg-card p-5 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert
              aria-hidden="true"
              className="size-5 text-muted-foreground"
            />
            <h2 className="font-heading font-semibold text-foreground">
              Plagiarism screening
            </h2>
          </div>

          <Badge variant={presentation.badge}>{presentation.label}</Badge>
        </div>

        <p className="mt-3 text-sm font-medium text-foreground">
          {presentation.title}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {presentation.description}
        </p>

        {summary ? (
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <ScreeningMetric
              label="Flagged coverage"
              value={formatPercent(summary.flagged_coverage_percent)}
            />
            <ScreeningMetric
              label="Flagged segments"
              value={
                summary.flagged_segments_count === undefined
                  ? "—"
                  : String(summary.flagged_segments_count)
              }
            />
            <ScreeningMetric
              label="Matched sources"
              value={
                summary.matched_source_documents_count === undefined
                  ? "—"
                  : String(summary.matched_source_documents_count)
              }
            />
            <ScreeningMetric
              label="Highest score"
              value={formatProbability(summary.highest_verifier_probability)}
            />
          </dl>
        ) : null}

        {currentScreening ? (
          <dl className="mt-4 space-y-2 border-t border-border/80 pt-4 text-xs">
            <ScreeningRecord
              label="Manuscript version"
              value={`Version ${currentScreening.version_number}`}
            />
            <ScreeningRecord
              label="Requested by"
              value={
                currentScreening.requested_by?.full_name ??
                "Automatically requested"
              }
            />
            <ScreeningRecord
              label="Last updated"
              value={formatDateTime(
                currentScreening.completed_at ??
                  currentScreening.started_at ??
                  currentScreening.created_at,
              )}
            />
            {currentScreening.error_code ? (
              <ScreeningRecord
                label="Error code"
                value={currentScreening.error_code}
              />
            ) : null}
          </dl>
        ) : null}

        {requestMutation.isError ? (
          <Notice
            tone="destructive"
            title="Screening request failed"
            description={getErrorMessage(requestMutation.error)}
            className="mt-4"
          />
        ) : null}

        {detailQuery.isError && isActive ? (
          <Notice
            tone="warning"
            title="Live status could not refresh"
            description="The screening may still be running. Refresh its status again shortly."
            className="mt-4"
          />
        ) : null}

        <div className="mt-4 space-y-2">
          {currentScreening?.status === "COMPLETED" ? (
            <Button
              type="button"
              variant="outline"
              size="touch"
              className="w-full"
              onClick={() => setReportOpen(true)}
            >
              <FileSearch aria-hidden="true" />
              Review complete evidence
            </Button>
          ) : null}

          {isActive ? (
            <Button
              type="button"
              variant="outline"
              size="touch"
              className="w-full"
              disabled={detailQuery.isFetching}
              onClick={() => void detailQuery.refetch()}
            >
              <RefreshCw
                aria-hidden="true"
                className={detailQuery.isFetching ? "animate-spin" : undefined}
              />
              {detailQuery.isFetching ? "Refreshing status…" : "Refresh status"}
            </Button>
          ) : null}

          {canRequest ? (
            <Button
              type="button"
              variant="outline"
              size="touch"
              className="w-full"
              disabled={requestMutation.isPending}
              onClick={() => requestMutation.mutate()}
            >
              <RotateCcw aria-hidden="true" />
              {requestMutation.isPending
                ? "Requesting screening…"
                : currentScreening?.status === "FAILED"
                  ? "Retry screening"
                  : "Request screening"}
            </Button>
          ) : null}
        </div>

        {isActive ? (
          <p className="mt-3 text-xs text-muted-foreground" role="status">
            Status refreshes automatically every five seconds.
          </p>
        ) : null}

        <p className="mt-4 border-t border-border/80 pt-4 text-xs leading-5 text-muted-foreground">
          Screening is editorial decision support only. It never completes,
          rejects, or blocks triage automatically.
        </p>
      </section>

      {currentScreening ? (
        <PlagiarismReportDialog
          open={reportOpen}
          screening={currentScreening}
          detail={detailQuery.data ?? null}
          isLoading={reportOpen && detailQuery.isFetching && !detailQuery.data}
          isError={reportOpen && detailQuery.isError}
          onOpenChange={setReportOpen}
          onRetry={() => void detailQuery.refetch()}
        />
      ) : null}
    </>
  );
}

function ScreeningMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/45 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function ScreeningRecord({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground" dir="auto">
        {value}
      </dd>
    </div>
  );
}
