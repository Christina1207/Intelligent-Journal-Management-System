"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileOutput, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PublicationStatusBadge } from "@/features/publishing/components/publication-status-badge";
import { usePublicationRecords } from "@/features/publishing/hooks";
import type { PublicationRecord } from "@/features/publishing/types";

const EMPTY_RECORDS: PublicationRecord[] = [];

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

export function PublicationRecordsPage() {
  const [page, setPage] = React.useState(1);
  const recordsQuery = usePublicationRecords(page);

  const records = recordsQuery.data?.results ?? EMPTY_RECORDS;
  const hasPreviousPage = Boolean(recordsQuery.data?.previous);
  const hasNextPage = Boolean(recordsQuery.data?.next);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">
          Publishing workflow
        </p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
          Publication records
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Review publication drafts created from accepted manuscripts and
          release finalized articles into the public journal archive.
        </p>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Managed publications
            </h2>

            <p className="mt-1 text-sm text-slate-500" aria-live="polite">
              {recordsQuery.data
                ? `${recordsQuery.data.count} publication record${
                    recordsQuery.data.count === 1 ? "" : "s"
                  } in your managed sections`
                : "Loading publication records…"}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={recordsQuery.isFetching}
            onClick={() => {
              void recordsQuery.refetch();
            }}
          >
            <RefreshCw
              aria-hidden="true"
              className={recordsQuery.isFetching ? "animate-spin" : ""}
            />
            Refresh
          </Button>
        </header>

        {recordsQuery.isPending ? (
          <div className="grid gap-4 p-5 md:grid-cols-2" aria-busy="true">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-48 animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : recordsQuery.isError ? (
          <div className="p-5">
            <Alert variant="destructive">
              <AlertTitle>Publication records unavailable</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  {recordsQuery.error instanceof Error
                    ? recordsQuery.error.message
                    : "The publishing queue could not be loaded."}
                </p>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void recordsQuery.refetch();
                  }}
                >
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : records.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <FileOutput
              aria-hidden="true"
              className="mx-auto size-10 text-slate-300"
            />

            <h2 className="mt-4 font-semibold text-slate-950">
              No publication records
            </h2>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Accepted manuscripts appear here after their assigned Section
              Editor creates the publication draft.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2">
            {records.map((record) => (
              <article
                key={record.id}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {record.section}
                    </p>

                    <h2 className="mt-2 line-clamp-2 font-semibold leading-6 text-slate-950">
                      {record.title}
                    </h2>
                  </div>

                  <PublicationStatusBadge status={record.status} />
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-sm">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Accepted
                    </dt>
                    <dd className="mt-1 text-slate-800">
                      {formatDate(record.accepted_at)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Updated
                    </dt>
                    <dd className="mt-1 text-slate-800">
                      {formatDate(record.updated_at)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      DOI
                    </dt>
                    <dd className="mt-1 truncate text-slate-800">
                      {record.doi || "Not assigned"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Issue
                    </dt>
                    <dd className="mt-1 text-slate-800">
                      {record.volume || record.issue
                        ? `Vol. ${record.volume || "—"}, No. ${
                            record.issue || "—"
                          }`
                        : "Assigned on publish"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-auto pt-5">
                  <Link
                    href={`/manager/publishing/${record.id}`}
                    className="inline-flex min-h-10 items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                  >
                    Manage publication
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        {recordsQuery.data && records.length > 0 ? (
          <nav
            aria-label="Publication record pagination"
            className="flex items-center justify-between gap-4 border-t border-slate-200 px-5 py-4"
          >
            <p className="text-sm text-slate-500">Page {page}</p>

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
      </section>
    </div>
  );
}
