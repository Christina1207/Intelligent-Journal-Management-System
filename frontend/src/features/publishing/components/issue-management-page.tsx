"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  CalendarDays,
  CirclePlus,
  FileText,
  LockKeyhole,
  Pencil,
  RefreshCw,
} from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Notice } from "@/components/common/notice";
import { PageHeader } from "@/components/common/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  closeIssue,
  createIssue,
  getIssues,
  openIssue,
  updateIssue,
} from "@/features/publishing/api";
import { publishingQueryKeys } from "@/features/publishing/query-keys";
import type {
  IssueManagementRecord,
  IssueWritePayload,
} from "@/features/publishing/types";

type IssueFormValues = {
  title: string;
  volume: string;
  number: string;
  year: string;
  description: string;
};

type LifecycleAction = {
  kind: "open" | "close";
  issue: IssueManagementRecord;
};

function emptyFormValues(): IssueFormValues {
  return {
    title: "",
    volume: "",
    number: "",
    year: String(new Date().getFullYear()),
    description: "",
  };
}

function valuesForIssue(issue: IssueManagementRecord): IssueFormValues {
  return {
    title: issue.title,
    volume: issue.volume,
    number: issue.number,
    year: String(issue.year),
    description: issue.description,
  };
}

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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function IssueCounts({ issue }: { issue: IssueManagementRecord }) {
  return (
    <dl className="grid grid-cols-3 gap-3 text-center text-sm">
      <div className="rounded-lg bg-muted/60 p-3">
        <dt className="text-xs text-muted-foreground">Total</dt>
        <dd className="mt-1 text-lg font-semibold">{issue.article_count}</dd>
      </div>
      <div className="rounded-lg bg-muted/60 p-3">
        <dt className="text-xs text-muted-foreground">Published</dt>
        <dd className="mt-1 text-lg font-semibold">
          {issue.published_article_count}
        </dd>
      </div>
      <div className="rounded-lg bg-muted/60 p-3">
        <dt className="text-xs text-muted-foreground">Drafts</dt>
        <dd className="mt-1 text-lg font-semibold">
          {issue.draft_article_count}
        </dd>
      </div>
    </dl>
  );
}

export function IssueManagementPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingIssue, setEditingIssue] =
    React.useState<IssueManagementRecord | null>(null);
  const [formValues, setFormValues] =
    React.useState<IssueFormValues>(emptyFormValues);
  const [lifecycleAction, setLifecycleAction] =
    React.useState<LifecycleAction | null>(null);

  const issuesQuery = useQuery({
    queryKey: publishingQueryKeys.issues(),
    queryFn: getIssues,
  });

  const refreshIssueQueries = React.useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: publishingQueryKeys.all,
    });
  }, [queryClient]);

  const saveMutation = useMutation({
    mutationFn: ({
      issueId,
      payload,
    }: {
      issueId: string | null;
      payload: IssueWritePayload;
    }) => (issueId ? updateIssue(issueId, payload) : createIssue(payload)),
    onSuccess: async () => {
      setFormOpen(false);
      setEditingIssue(null);
      await refreshIssueQueries();
    },
  });

  const lifecycleMutation = useMutation({
    mutationFn: (action: LifecycleAction) =>
      action.kind === "open"
        ? openIssue(action.issue.id)
        : closeIssue(action.issue.id),
    onSuccess: async () => {
      setLifecycleAction(null);
      await refreshIssueQueries();
    },
  });

  function showCreateForm() {
    saveMutation.reset();
    setEditingIssue(null);
    setFormValues(emptyFormValues());
    setFormOpen(true);
  }

  function showEditForm(issue: IssueManagementRecord) {
    saveMutation.reset();
    setEditingIssue(issue);
    setFormValues(valuesForIssue(issue));
    setFormOpen(true);
  }

  function showLifecycleConfirmation(action: LifecycleAction) {
    lifecycleMutation.reset();
    setLifecycleAction(action);
  }

  function updateFormValue(field: keyof IssueFormValues, value: string) {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const year = Number(formValues.year);

    if (!Number.isInteger(year) || year < 1 || year > 9999) {
      return;
    }

    try {
      await saveMutation.mutateAsync({
        issueId: editingIssue?.id ?? null,
        payload: {
          title: formValues.title.trim(),
          volume: formValues.volume.trim(),
          number: formValues.number.trim(),
          year,
          description: formValues.description.trim(),
        },
      });
    } catch {
      // The mutation error is rendered in the form dialog.
    }
  }

  async function handleLifecycleAction() {
    if (!lifecycleAction) {
      return;
    }

    try {
      await lifecycleMutation.mutateAsync(lifecycleAction);
    } catch {
      // The mutation error is rendered in the confirmation dialog.
    }
  }

  if (issuesQuery.isPending) {
    return (
      <div
        className="space-y-6"
        role="status"
        aria-label="Loading issue management"
      >
        <div className="h-28 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-56 animate-pulse rounded-xl bg-muted" />
          <div className="h-56 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  if (issuesQuery.isError) {
    return (
      <ErrorState
        title="Could not load journal issues"
        description={getErrorMessage(
          issuesQuery.error,
          "The issue-management records could not be loaded.",
        )}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => void issuesQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        }
      />
    );
  }

  const issues = issuesQuery.data;
  const currentIssue = issues.find(
    (issue) => issue.status === "published" && issue.is_current,
  );
  const draftIssues = issues.filter((issue) => issue.status === "draft");
  const archivedIssues = issues.filter((issue) => issue.status === "archived");
  const inconsistentOpenIssues = issues.filter(
    (issue) => issue.status === "published" && !issue.is_current,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Continuous publication"
        title="Journal issues"
        description="Open one current issue, publish articles into it continuously, then close it before opening its successor."
        actions={
          <Button type="button" size="touch" onClick={showCreateForm}>
            <CirclePlus aria-hidden="true" />
            Create draft issue
          </Button>
        }
      />

      {inconsistentOpenIssues.length > 0 ? (
        <Notice
          tone="destructive"
          title="Inconsistent legacy issue data"
          description="One or more published issues are not marked current. Resolve these records before performing another lifecycle action."
        />
      ) : null}

      <section aria-labelledby="current-issue-heading" className="space-y-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-accent uppercase">
            Live publication destination
          </p>
          <h2 id="current-issue-heading" className="mt-1 text-xl font-semibold">
            Current open issue
          </h2>
        </div>

        {currentIssue ? (
          <Card className="border-status-success-border">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success">Open · Published</Badge>
                    <span className="text-sm text-muted-foreground">
                      Volume {currentIssue.volume}, Issue {currentIssue.number}
                    </span>
                  </div>
                  <CardTitle className="mt-3" dir="auto">
                    {currentIssue.title}
                  </CardTitle>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Opened {formatDate(currentIssue.published_at)}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="destructive"
                  disabled={currentIssue.draft_article_count > 0}
                  title={
                    currentIssue.draft_article_count > 0
                      ? "Publish or remove all publication drafts first."
                      : undefined
                  }
                  onClick={() =>
                    showLifecycleConfirmation({
                      kind: "close",
                      issue: currentIssue,
                    })
                  }
                >
                  <LockKeyhole aria-hidden="true" />
                  Close issue
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <IssueCounts issue={currentIssue} />
              {currentIssue.draft_article_count > 0 ? (
                <Notice
                  tone="warning"
                  title="Issue cannot be closed yet"
                  description={`${currentIssue.draft_article_count} publication draft(s) must be published or removed first.`}
                />
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={<CalendarDays aria-hidden="true" />}
            title="No issue is currently open"
            description="Create an upcoming issue, complete its metadata, and open it before publishing articles."
            action={
              <Button type="button" onClick={showCreateForm}>
                <CirclePlus aria-hidden="true" />
                Create draft issue
              </Button>
            }
          />
        )}
      </section>

      <section aria-labelledby="draft-issues-heading" className="space-y-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-accent uppercase">
            Upcoming
          </p>
          <h2 id="draft-issues-heading" className="mt-1 text-xl font-semibold">
            Draft issues
          </h2>
        </div>

        {draftIssues.length === 0 ? (
          <EmptyState
            icon={<FileText aria-hidden="true" />}
            title="No upcoming issue"
            description="Create a draft now if the next volume or issue is already known."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {draftIssues.map((issue) => (
              <Card key={issue.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge variant="secondary">Draft</Badge>
                      <CardTitle className="mt-3" dir="auto">
                        {issue.title}
                      </CardTitle>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Volume {issue.volume}, Issue {issue.number} ·{" "}
                        {issue.year}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <IssueCounts issue={issue} />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => showEditForm(issue)}
                    >
                      <Pencil aria-hidden="true" />
                      Edit metadata
                    </Button>
                    <Button
                      type="button"
                      disabled={Boolean(currentIssue)}
                      title={
                        currentIssue
                          ? "Close the current issue before opening another."
                          : undefined
                      }
                      onClick={() =>
                        showLifecycleConfirmation({
                          kind: "open",
                          issue,
                        })
                      }
                    >
                      <CalendarDays aria-hidden="true" />
                      Open issue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="archived-issues-heading" className="space-y-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-accent uppercase">
            Public archive
          </p>
          <h2
            id="archived-issues-heading"
            className="mt-1 text-xl font-semibold"
          >
            Closed issues
          </h2>
        </div>

        {archivedIssues.length === 0 ? (
          <EmptyState
            icon={<Archive aria-hidden="true" />}
            title="No closed issues yet"
            description="Closed issues remain public and appear here as read-only records."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <ul className="divide-y">
              {archivedIssues.map((issue) => (
                <li
                  key={issue.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">Closed</Badge>
                      <span className="text-xs text-muted-foreground">
                        {issue.year}
                      </span>
                    </div>
                    <p className="mt-2 truncate font-medium" dir="auto">
                      {issue.title}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Volume {issue.volume}, Issue {issue.number}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm text-muted-foreground">
                    {issue.published_article_count} published article(s)
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!saveMutation.isPending) {
            setFormOpen(open);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>
                {editingIssue ? "Edit draft issue" : "Create draft issue"}
              </DialogTitle>
              <DialogDescription>
                Issue metadata becomes read-only after the issue is opened.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="issue-title">Title</Label>
                <Input
                  id="issue-title"
                  value={formValues.title}
                  required
                  maxLength={255}
                  dir="auto"
                  onChange={(event) =>
                    updateFormValue("title", event.target.value)
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="issue-volume">Volume</Label>
                  <Input
                    id="issue-volume"
                    value={formValues.volume}
                    required
                    maxLength={50}
                    onChange={(event) =>
                      updateFormValue("volume", event.target.value)
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="issue-number">Issue number</Label>
                  <Input
                    id="issue-number"
                    value={formValues.number}
                    required
                    maxLength={50}
                    onChange={(event) =>
                      updateFormValue("number", event.target.value)
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="issue-year">Year</Label>
                  <Input
                    id="issue-year"
                    type="number"
                    min={1}
                    max={9999}
                    value={formValues.year}
                    required
                    onChange={(event) =>
                      updateFormValue("year", event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="issue-description">Description</Label>
                <Textarea
                  id="issue-description"
                  value={formValues.description}
                  rows={4}
                  dir="auto"
                  onChange={(event) =>
                    updateFormValue("description", event.target.value)
                  }
                />
              </div>

              {saveMutation.isError ? (
                <Alert variant="destructive">
                  <AlertTitle>Issue not saved</AlertTitle>
                  <AlertDescription>
                    {getErrorMessage(
                      saveMutation.error,
                      "The draft issue could not be saved.",
                    )}
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>

            <DialogFooter className="mt-5">
              <DialogClose
                render={
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saveMutation.isPending}
                  />
                }
              >
                Cancel
              </DialogClose>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : "Save draft issue"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(lifecycleAction)}
        onOpenChange={(open) => {
          if (!open && !lifecycleMutation.isPending) {
            setLifecycleAction(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {lifecycleAction?.kind === "open"
                ? "Open this issue?"
                : "Close the current issue?"}
            </DialogTitle>
            <DialogDescription>
              {lifecycleAction?.kind === "open"
                ? "The issue will become public and will receive newly published articles."
                : "The issue will remain public in the archive but will no longer accept articles."}
            </DialogDescription>
          </DialogHeader>

          {lifecycleAction ? (
            <Notice
              tone="warning"
              title={lifecycleAction.issue.title}
              description={`Volume ${lifecycleAction.issue.volume}, Issue ${lifecycleAction.issue.number} · ${lifecycleAction.issue.year}`}
            />
          ) : null}

          {lifecycleMutation.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Lifecycle action failed</AlertTitle>
              <AlertDescription>
                {getErrorMessage(
                  lifecycleMutation.error,
                  "The issue lifecycle could not be updated.",
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
                  disabled={lifecycleMutation.isPending}
                />
              }
            >
              Cancel
            </DialogClose>
            <Button
              type="button"
              variant={
                lifecycleAction?.kind === "close" ? "destructive" : "default"
              }
              disabled={lifecycleMutation.isPending}
              onClick={() => void handleLifecycleAction()}
            >
              {lifecycleMutation.isPending
                ? "Updating…"
                : lifecycleAction?.kind === "open"
                  ? "Open issue"
                  : "Close issue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
