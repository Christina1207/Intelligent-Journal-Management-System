"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileOutput,
  RefreshCw,
} from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicationStatusBadge } from "@/features/publishing/components/publication-status-badge";
import { usePublicationRecords } from "@/features/publishing/hooks";
import { getPublicationReadinessGaps } from "@/features/publishing/readiness";
import type { PublicationRecord } from "@/features/publishing/types";

const EMPTY_RECORDS: PublicationRecord[] = [];

type PublicationRecordsPageProps = {
  basePath?: string;
  journalWide?: boolean;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function issueLabel(record: PublicationRecord) {
  if (!record.publication_issue) {
    return "Not assigned";
  }

  return `Vol. ${record.volume || "—"}, No. ${record.issue || "—"}`;
}

export function PublicationRecordsPage({
  basePath = "/manager/publishing",
  journalWide = false,
}: PublicationRecordsPageProps) {
  const [page, setPage] = React.useState(1);
  const recordsQuery = usePublicationRecords(page);

  const records = recordsQuery.data?.results ?? EMPTY_RECORDS;
  const hasPreviousPage = Boolean(recordsQuery.data?.previous);
  const hasNextPage = Boolean(recordsQuery.data?.next);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          journalWide ? "Journal-wide publishing" : "Publishing workflow"
        }
        title="Publication records"
        description={
          journalWide
            ? "Prepare accepted manuscripts, assign drafts to the current open issue, and publish articles individually across the journal."
            : "Review publication drafts in your managed sections and release finalized articles into the public journal archive."
        }
      />

      <Card>
        <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Managed publications</CardTitle>
            <p
              className="mt-1 text-sm text-muted-foreground"
              aria-live="polite"
            >
              {recordsQuery.data
                ? `${recordsQuery.data.count} publication record${
                    recordsQuery.data.count === 1 ? "" : "s"
                  } ${journalWide ? "across the journal" : "in your managed sections"}`
                : "Loading publication records…"}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={recordsQuery.isFetching}
            onClick={() => void recordsQuery.refetch()}
          >
            <RefreshCw
              aria-hidden="true"
              className={recordsQuery.isFetching ? "animate-spin" : ""}
            />
            Refresh
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          {recordsQuery.isPending ? (
            <div className="grid gap-4 p-5 md:grid-cols-2" aria-busy="true">
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  className="h-56 animate-pulse rounded-xl bg-muted"
                />
              ))}
            </div>
          ) : recordsQuery.isError ? (
            <div className="p-5">
              <ErrorState
                title="Publication records unavailable"
                description={
                  recordsQuery.error instanceof Error
                    ? recordsQuery.error.message
                    : "The publishing queue could not be loaded."
                }
                action={
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void recordsQuery.refetch()}
                  >
                    Try again
                  </Button>
                }
              />
            </div>
          ) : records.length === 0 ? (
            <EmptyState
              icon={<FileOutput aria-hidden="true" />}
              title="No publication records"
              description="Accepted manuscripts appear here after an authorized editor creates their publication drafts."
              className="m-5"
            />
          ) : (
            <div className="grid gap-4 p-5 md:grid-cols-2">
              {records.map((record) => {
                const readinessGaps = getPublicationReadinessGaps(record);

                return (
                  <article
                    key={record.id}
                    className="flex flex-col rounded-xl border bg-card p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          {record.section}
                        </p>
                        <h2
                          className="mt-2 line-clamp-2 font-semibold leading-6"
                          dir="auto"
                        >
                          {record.title}
                        </h2>
                      </div>
                      <PublicationStatusBadge status={record.status} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {journalWide && record.status === "draft" ? (
                        readinessGaps.length === 0 ? (
                          <Badge variant="success">
                            <CheckCircle2 aria-hidden="true" />
                            Ready to publish
                          </Badge>
                        ) : (
                          <Badge variant="warning">
                            <AlertTriangle aria-hidden="true" />
                            {readinessGaps.length} item
                            {readinessGaps.length === 1 ? "" : "s"} missing
                          </Badge>
                        )
                      ) : null}
                    </div>

                    <dl className="mt-5 grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4 text-sm">
                      <div>
                        <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          Accepted
                        </dt>
                        <dd className="mt-1">
                          {formatDate(record.accepted_at)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          Issue
                        </dt>
                        <dd className="mt-1">{issueLabel(record)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          DOI
                        </dt>
                        <dd className="mt-1 truncate">
                          {record.doi || "Not assigned"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          Updated
                        </dt>
                        <dd className="mt-1">
                          {formatDate(record.updated_at)}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-auto pt-5">
                      <Link
                        href={`${basePath}/${record.id}`}
                        className={buttonVariants()}
                      >
                        Manage publication
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {recordsQuery.data && records.length > 0 ? (
            <nav
              aria-label="Publication record pagination"
              className="flex items-center justify-between gap-4 border-t px-5 py-4"
            >
              <p className="text-sm text-muted-foreground">Page {page}</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!hasPreviousPage || recordsQuery.isFetching}
                  onClick={() =>
                    setPage((currentPage) => Math.max(1, currentPage - 1))
                  }
                >
                  <ChevronLeft aria-hidden="true" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!hasNextPage || recordsQuery.isFetching}
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                >
                  Next
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </nav>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
