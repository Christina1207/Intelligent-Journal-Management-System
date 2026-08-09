"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileOutput,
  Pencil,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import { ErrorState } from "@/components/common/error-state";
import { Notice } from "@/components/common/notice";
import { PageHeader } from "@/components/common/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PublicationStatusBadge } from "@/features/publishing/components/publication-status-badge";
import {
  useIssues,
  usePublicationRecord,
  usePublishPublicationRecord,
  useUpdatePublicationRecord,
} from "@/features/publishing/hooks";
import { getPublicationReadinessGaps } from "@/features/publishing/readiness";
import type {
  IssueManagementRecord,
  PublicationRecord,
  PublicationUpdatePayload,
} from "@/features/publishing/types";

type PublicationRecordDetailPageProps = {
  articleId: string;
  basePath?: string;
  enableIssueSelection?: boolean;
};

type MetadataFormValues = {
  title: string;
  abstract: string;
  language: string;
  keywords: string;
  doi: string;
  licenseName: string;
  licenseUrl: string;
  firstPage: string;
  lastPage: string;
};

function metadataValues(record: PublicationRecord): MetadataFormValues {
  return {
    title: record.title,
    abstract: record.abstract,
    language: record.language,
    keywords: record.keywords.join(", "),
    doi: record.doi ?? "",
    licenseName: record.license_name,
    licenseUrl: record.license_url,
    firstPage: record.first_page,
    lastPage: record.last_page,
  };
}

function metadataPayload(values: MetadataFormValues): PublicationUpdatePayload {
  const keywords = values.keywords
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  return {
    title: values.title.trim(),
    abstract: values.abstract.trim(),
    language: values.language.trim(),
    keywords: Array.from(new Set(keywords)),
    doi: values.doi.trim() || null,
    license_name: values.licenseName.trim(),
    license_url: values.licenseUrl.trim(),
    first_page: values.firstPage.trim(),
    last_page: values.lastPage.trim(),
  };
}

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

function issueOptionLabel(issue: IssueManagementRecord) {
  const lifecycle = issue.is_current
    ? "Current open issue"
    : issue.status === "draft"
      ? "Upcoming draft"
      : "Closed issue";

  return `${issue.title} · Vol. ${issue.volume}, No. ${issue.number} · ${lifecycle}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function PublicationRecordDetailPage({
  articleId,
  basePath = "/manager/publishing",
  enableIssueSelection = false,
}: PublicationRecordDetailPageProps) {
  const recordQuery = usePublicationRecord(articleId);
  const issuesQuery = useIssues(enableIssueSelection);
  const updateMutation = useUpdatePublicationRecord();
  const publishMutation = usePublishPublicationRecord();
  const [metadataOpen, setMetadataOpen] = React.useState(false);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [formValues, setFormValues] = React.useState<MetadataFormValues | null>(
    null,
  );

  if (recordQuery.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
        <div className="h-80 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (recordQuery.isError) {
    return (
      <ErrorState
        title="Publication record unavailable"
        description={getErrorMessage(
          recordQuery.error,
          "The publication record could not be loaded.",
        )}
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void recordQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        }
      />
    );
  }

  const record = recordQuery.data;
  const issues = issuesQuery.data ?? [];
  const currentIssue = issues.find(
    (issue) => issue.status === "published" && issue.is_current,
  );
  const assignedIssue = issues.find(
    (issue) => issue.id === record.publication_issue,
  );
  const readinessGaps = enableIssueSelection
    ? getPublicationReadinessGaps(record)
    : [];
  const assignedToCurrentIssue = Boolean(
    currentIssue && record.publication_issue === currentIssue.id,
  );
  const canPublishFromEicWorkspace =
    !enableIssueSelection ||
    (assignedToCurrentIssue && readinessGaps.length === 0);

  function openMetadataEditor() {
    updateMutation.reset();
    setFormValues(metadataValues(record));
    setMetadataOpen(true);
  }

  function updateFormValue(field: keyof MetadataFormValues, value: string) {
    setFormValues((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current,
    );
  }

  async function handleMetadataSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formValues || !formValues.title.trim()) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        articleId: record.id,
        payload: metadataPayload(formValues),
      });
      setMetadataOpen(false);
    } catch {
      // The mutation error remains visible in the dialog.
    }
  }

  async function handleIssueChange(issueId: string) {
    updateMutation.reset();

    try {
      await updateMutation.mutateAsync({
        articleId: record.id,
        payload: {
          publication_issue: issueId || null,
        },
      });
    } catch {
      // The error is rendered beside the issue selector.
    }
  }

  async function handlePublish() {
    try {
      await publishMutation.mutateAsync(record.id);
      setPublishOpen(false);
    } catch {
      // The mutation error remains visible in the confirmation dialog.
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={record.section}
        title={record.title}
        description={`Publication record created ${formatDateTime(record.created_at)}`}
        breadcrumbs={
          <Link
            href={basePath}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Publication records
          </Link>
        }
        actions={<PublicationStatusBadge status={record.status} />}
      />

      {record.status === "published" ? (
        <Notice
          tone="success"
          icon={CheckCircle2}
          title="Article published"
          description={`Published ${formatDateTime(record.published_at)} and available in the public journal.`}
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Scholarly metadata</CardTitle>
              {record.status === "draft" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={openMetadataEditor}
                >
                  <Pencil aria-hidden="true" />
                  Edit metadata
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              <dl className="grid gap-5 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Language</dt>
                  <dd className="mt-1 font-medium">
                    {record.language || "Not specified"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">DOI</dt>
                  <dd className="mt-1 font-medium">
                    {record.doi || "Not assigned"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Volume</dt>
                  <dd className="mt-1 font-medium">
                    {record.volume || "Assigned from the issue"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Issue</dt>
                  <dd className="mt-1 font-medium">
                    {record.issue || "Assigned from the issue"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Pages</dt>
                  <dd className="mt-1 font-medium">
                    {record.pages || "Not assigned"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">License</dt>
                  <dd className="mt-1 font-medium">
                    {record.license_name || "Not specified"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Received</dt>
                  <dd className="mt-1 font-medium">
                    {formatDateTime(record.received_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Accepted</dt>
                  <dd className="mt-1 font-medium">
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
              <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
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
                <p className="text-sm text-muted-foreground">
                  No author snapshot is available.
                </p>
              ) : (
                <ol className="space-y-3">
                  {record.authors.map((author) => (
                    <li
                      key={`${author.order}-${author.full_name}`}
                      className="rounded-lg border p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {author.order}. {author.full_name}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {author.affiliation || "No affiliation provided"}
                          </p>
                        </div>
                        {author.is_corresponding ? (
                          <Badge variant="secondary">
                            Corresponding author
                          </Badge>
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
                <p className="text-sm text-muted-foreground">
                  No keywords are available.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {record.keywords.map((keyword) => (
                    <Badge key={keyword} variant="secondary">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          {enableIssueSelection ? (
            <Card>
              <CardHeader>
                <CardTitle>Publication issue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {issuesQuery.isPending ? (
                  <div className="h-20 animate-pulse rounded-lg bg-muted" />
                ) : issuesQuery.isError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Issues unavailable</AlertTitle>
                    <AlertDescription>
                      {getErrorMessage(
                        issuesQuery.error,
                        "The issue list could not be loaded.",
                      )}
                    </AlertDescription>
                  </Alert>
                ) : record.status === "draft" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="publication-issue">Issue</Label>
                      <select
                        id="publication-issue"
                        value={record.publication_issue ?? ""}
                        disabled={updateMutation.isPending}
                        className="flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                        onChange={(event) =>
                          void handleIssueChange(event.target.value)
                        }
                      >
                        <option value="">Not assigned</option>
                        {issues.map((issue) => (
                          <option
                            key={issue.id}
                            value={issue.id}
                            disabled={!issue.is_current}
                          >
                            {issueOptionLabel(issue)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {!currentIssue ? (
                      <Notice
                        tone="warning"
                        title="No current open issue"
                        description="Open an issue before assigning and publishing this article."
                        action={
                          <Link
                            href="/eic/issues"
                            className={buttonVariants({ variant: "outline" })}
                          >
                            Manage issues
                          </Link>
                        }
                      />
                    ) : null}

                    {updateMutation.isError ? (
                      <Alert variant="destructive">
                        <AlertTitle>Issue not updated</AlertTitle>
                        <AlertDescription>
                          {getErrorMessage(
                            updateMutation.error,
                            "The issue assignment could not be changed.",
                          )}
                        </AlertDescription>
                      </Alert>
                    ) : null}
                  </>
                ) : (
                  <div className="space-y-2 text-sm">
                    <p className="font-medium">
                      {assignedIssue?.title ??
                        (record.volume || record.issue
                          ? `Volume ${record.volume || "—"}, Issue ${record.issue || "—"}`
                          : "Issue unavailable")}
                    </p>
                    <p className="text-muted-foreground">
                      Published articles cannot be moved between issues.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card className="xl:sticky xl:top-24">
            <CardHeader>
              <CardTitle>Publishing readiness</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {record.status === "draft" ? (
                <>
                  {!enableIssueSelection ? (
                    <Alert>
                      <FileOutput aria-hidden="true" />
                      <AlertTitle>Ready for publishing review</AlertTitle>
                      <AlertDescription>
                        Publishing uses the configured current open issue and
                        exposes the article publicly.
                      </AlertDescription>
                    </Alert>
                  ) : readinessGaps.length === 0 ? (
                    <Notice
                      tone="success"
                      icon={CheckCircle2}
                      title="Ready to publish"
                      description="Required metadata and the publication issue are present."
                    />
                  ) : (
                    <Alert variant="warning">
                      <TriangleAlert aria-hidden="true" />
                      <AlertTitle>Complete before publishing</AlertTitle>
                      <AlertDescription>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                          {readinessGaps.map((gap) => (
                            <li key={gap.key}>{gap.label}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="button"
                    className="w-full"
                    disabled={
                      publishMutation.isPending || !canPublishFromEicWorkspace
                    }
                    onClick={() => {
                      publishMutation.reset();
                      setPublishOpen(true);
                    }}
                  >
                    <FileOutput aria-hidden="true" />
                    Publish article
                  </Button>
                </>
              ) : record.status === "published" ? (
                <Link
                  href={`/articles/${record.slug}`}
                  className={buttonVariants({ className: "w-full" })}
                >
                  View public article
                  <ExternalLink aria-hidden="true" />
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

      <Dialog
        open={metadataOpen}
        onOpenChange={(open) => {
          if (!updateMutation.isPending) {
            setMetadataOpen(open);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={handleMetadataSave}>
            <DialogHeader>
              <DialogTitle>Edit publication metadata</DialogTitle>
              <DialogDescription>
                Volume and issue number are intentionally excluded; they come
                from the selected issue.
              </DialogDescription>
            </DialogHeader>

            {formValues ? (
              <div className="grid gap-4 py-5 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="publication-title">Title</Label>
                  <Input
                    id="publication-title"
                    required
                    value={formValues.title}
                    onChange={(event) =>
                      updateFormValue("title", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="publication-abstract">Abstract</Label>
                  <Textarea
                    id="publication-abstract"
                    rows={6}
                    value={formValues.abstract}
                    onChange={(event) =>
                      updateFormValue("abstract", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="publication-language">Language</Label>
                  <Input
                    id="publication-language"
                    placeholder="en or ar"
                    value={formValues.language}
                    onChange={(event) =>
                      updateFormValue("language", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="publication-doi">DOI (optional)</Label>
                  <Input
                    id="publication-doi"
                    value={formValues.doi}
                    onChange={(event) =>
                      updateFormValue("doi", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="publication-keywords">
                    Keywords (comma separated)
                  </Label>
                  <Input
                    id="publication-keywords"
                    value={formValues.keywords}
                    onChange={(event) =>
                      updateFormValue("keywords", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="publication-license-name">License</Label>
                  <Input
                    id="publication-license-name"
                    value={formValues.licenseName}
                    onChange={(event) =>
                      updateFormValue("licenseName", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="publication-license-url">License URL</Label>
                  <Input
                    id="publication-license-url"
                    type="url"
                    value={formValues.licenseUrl}
                    onChange={(event) =>
                      updateFormValue("licenseUrl", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="publication-first-page">First page</Label>
                  <Input
                    id="publication-first-page"
                    value={formValues.firstPage}
                    onChange={(event) =>
                      updateFormValue("firstPage", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="publication-last-page">Last page</Label>
                  <Input
                    id="publication-last-page"
                    value={formValues.lastPage}
                    onChange={(event) =>
                      updateFormValue("lastPage", event.target.value)
                    }
                  />
                </div>
              </div>
            ) : null}

            {updateMutation.isError ? (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Metadata not saved</AlertTitle>
                <AlertDescription>
                  {getErrorMessage(
                    updateMutation.error,
                    "The publication metadata could not be updated.",
                  )}
                </AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <DialogClose
                render={
                  <Button
                    type="button"
                    variant="outline"
                    disabled={updateMutation.isPending}
                  />
                }
              >
                Cancel
              </DialogClose>
              <Button
                type="submit"
                disabled={updateMutation.isPending || !formValues?.title.trim()}
              >
                {updateMutation.isPending ? "Saving…" : "Save metadata"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={publishOpen}
        onOpenChange={(open) => {
          if (!publishMutation.isPending) {
            setPublishOpen(open);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Publish this article?</DialogTitle>
            <DialogDescription>
              This makes the article publicly accessible immediately under the
              current open issue.
            </DialogDescription>
          </DialogHeader>

          {currentIssue ? (
            <Alert>
              <FileOutput aria-hidden="true" />
              <AlertTitle>{currentIssue.title}</AlertTitle>
              <AlertDescription>
                Volume {currentIssue.volume}, Issue {currentIssue.number}
              </AlertDescription>
            </Alert>
          ) : null}

          {publishMutation.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Article not published</AlertTitle>
              <AlertDescription>
                {getErrorMessage(
                  publishMutation.error,
                  "The publishing operation could not be completed.",
                )}
              </AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  disabled={publishMutation.isPending}
                />
              }
            >
              Cancel
            </DialogClose>
            <Button
              type="button"
              disabled={
                publishMutation.isPending || !canPublishFromEicWorkspace
              }
              onClick={() => void handlePublish()}
            >
              <FileOutput aria-hidden="true" />
              {publishMutation.isPending ? "Publishing…" : "Publish article"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
