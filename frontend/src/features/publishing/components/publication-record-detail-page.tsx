"use client";

import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  FileOutput,
  RefreshCw,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicationStatusBadge } from "@/features/publishing/components/publication-status-badge";
import {
  usePublicationRecord,
  usePublishPublicationRecord,
} from "@/features/publishing/hooks";

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function PublicationRecordDetailPage({
  articleId,
}: {
  articleId: string;
}) {
  const recordQuery = usePublicationRecord(articleId);
  const publishMutation = usePublishPublicationRecord();

  if (recordQuery.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-80 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (recordQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Publication record unavailable</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            {recordQuery.error instanceof Error
              ? recordQuery.error.message
              : "The publication record could not be loaded."}
          </p>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              void recordQuery.refetch();
            }}
          >
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const record = recordQuery.data;

  function handlePublish() {
    const confirmed = window.confirm(
      `Publish “${record.title}”? This will make the article publicly accessible.`,
    );

    if (confirmed) {
      publishMutation.mutate(record.id);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/manager/publishing"
        className="text-sm font-medium text-slate-600 hover:text-slate-950"
      >
        ← Back to publication records
      </Link>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              {record.section}
            </p>

            <h1 className="mt-2 max-w-4xl text-2xl font-bold tracking-tight text-slate-950">
              {record.title}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Publication record created {formatDateTime(record.created_at)}
            </p>
          </div>

          <PublicationStatusBadge status={record.status} />
        </div>
      </section>

      {publishMutation.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Article not published</AlertTitle>
          <AlertDescription>
            {publishMutation.error instanceof Error
              ? publishMutation.error.message
              : "The publishing operation could not be completed."}
          </AlertDescription>
        </Alert>
      ) : null}

      {record.status === "published" ? (
        <Alert>
          <CheckCircle2 aria-hidden="true" />
          <AlertTitle>Article published</AlertTitle>
          <AlertDescription>
            This record is publicly available in the journal reader portal.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Scholarly metadata</CardTitle>
            </CardHeader>

            <CardContent>
              <dl className="grid gap-5 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Language</dt>
                  <dd className="mt-1 font-medium text-slate-950">
                    {record.language || "Not specified"}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">DOI</dt>
                  <dd className="mt-1 font-medium text-slate-950">
                    {record.doi || "Not assigned"}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Volume</dt>
                  <dd className="mt-1 font-medium text-slate-950">
                    {record.volume || "Assigned on publish"}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Issue</dt>
                  <dd className="mt-1 font-medium text-slate-950">
                    {record.issue || "Assigned on publish"}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Pages</dt>
                  <dd className="mt-1 font-medium text-slate-950">
                    {record.pages || "Not assigned"}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">License</dt>
                  <dd className="mt-1 font-medium text-slate-950">
                    {record.license_name || "Not specified"}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Manuscript received</dt>
                  <dd className="mt-1 font-medium text-slate-950">
                    {formatDateTime(record.received_at)}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Accepted</dt>
                  <dd className="mt-1 font-medium text-slate-950">
                    {formatDateTime(record.accepted_at)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Abstract</CardTitle>
            </CardHeader>

            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {record.abstract || "No abstract was provided."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Authors</CardTitle>
            </CardHeader>

            <CardContent>
              {record.authors.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No author snapshot is available.
                </p>
              ) : (
                <ol className="space-y-3">
                  {record.authors.map((author) => (
                    <li
                      key={`${author.order}-${author.full_name}`}
                      className="rounded-lg border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-950">
                            {author.order}. {author.full_name}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {author.affiliation || "No affiliation provided"}
                          </p>

                          {author.orcid ? (
                            <p className="mt-1 text-xs text-slate-500">
                              ORCID: {author.orcid}
                            </p>
                          ) : null}
                        </div>

                        {author.is_corresponding ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            Corresponding author
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Keywords</CardTitle>
            </CardHeader>

            <CardContent>
              {record.keywords.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No keywords are available.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {record.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside>
          <Card className="xl:sticky xl:top-24">
            <CardHeader>
              <CardTitle>Publishing action</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {record.status === "draft" ? (
                <>
                  <Alert>
                    <FileOutput aria-hidden="true" />
                    <AlertTitle>Ready for publishing review</AlertTitle>
                    <AlertDescription>
                      Publishing assigns the configured current draft issue,
                      records the publication timestamp, and exposes the article
                      publicly.
                    </AlertDescription>
                  </Alert>

                  <Button
                    type="button"
                    className="w-full"
                    disabled={publishMutation.isPending}
                    onClick={handlePublish}
                  >
                    <FileOutput aria-hidden="true" />
                    {publishMutation.isPending
                      ? "Publishing article…"
                      : "Publish article"}
                  </Button>
                </>
              ) : record.status === "published" ? (
                <Link
                  href={`/articles/${record.slug}`}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  View public article
                  <ExternalLink aria-hidden="true" className="size-4" />
                </Link>
              ) : (
                <Alert variant="destructive">
                  <AlertTitle>Publication unavailable</AlertTitle>
                  <AlertDescription>
                    Retracted records cannot be republished.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
