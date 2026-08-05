"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CirclePlus,
  Pencil,
  Power,
  PowerOff,
  RefreshCw,
  UserRoundCog,
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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  activateSection,
  assignSectionManager,
  createSection,
  deactivateSection,
  getManagedSections,
  getSectionManagerCandidates,
  updateSection,
} from "@/features/journals/api/section-management-api";
import { journalManagementQueryKeys } from "@/features/journals/query-keys";
import type {
  SectionManagementRecord,
  SectionWritePayload,
} from "@/features/journals/types";

type SectionFormValues = {
  name: string;
  issn: string;
  description: string;
};

type LifecycleTarget = {
  section: SectionManagementRecord;
  action: "activate" | "deactivate";
};

const EMPTY_FORM: SectionFormValues = {
  name: "",
  issn: "",
  description: "",
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function managerName(section: SectionManagementRecord) {
  if (!section.manager) {
    return "No manager assigned";
  }

  return section.manager.full_name.trim() || section.manager.username;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not run yet";
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

export function SectionManagementPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingSection, setEditingSection] =
    React.useState<SectionManagementRecord | null>(null);
  const [formValues, setFormValues] =
    React.useState<SectionFormValues>(EMPTY_FORM);
  const [managerSection, setManagerSection] =
    React.useState<SectionManagementRecord | null>(null);
  const [managerId, setManagerId] = React.useState("");
  const [lifecycleTarget, setLifecycleTarget] =
    React.useState<LifecycleTarget | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null,
  );

  const sectionsQuery = useQuery({
    queryKey: journalManagementQueryKeys.sections(),
    queryFn: getManagedSections,
  });

  const candidatesQuery = useQuery({
    queryKey: journalManagementQueryKeys.managerCandidates(),
    queryFn: getSectionManagerCandidates,
  });

  const refreshSections = React.useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: journalManagementQueryKeys.sections(),
    });
  }, [queryClient]);

  const saveMutation = useMutation({
    mutationFn: ({
      sectionId,
      payload,
    }: {
      sectionId: string | null;
      payload: SectionWritePayload;
    }) =>
      sectionId ? updateSection(sectionId, payload) : createSection(payload),
    onSuccess: async (section, variables) => {
      setFormOpen(false);
      setEditingSection(null);
      setSuccessMessage(
        variables.sectionId
          ? `${section.name} has been updated.`
          : `${section.name} has been created.`,
      );
      await refreshSections();
    },
  });

  const managerMutation = useMutation({
    mutationFn: ({
      sectionId,
      selectedManagerId,
    }: {
      sectionId: string;
      selectedManagerId: string;
    }) => assignSectionManager(sectionId, selectedManagerId),
    onSuccess: async (section) => {
      setManagerSection(null);
      setManagerId("");
      setSuccessMessage(
        `${managerName(section)} is now responsible for ${section.name}.`,
      );
      await refreshSections();
    },
  });

  const lifecycleMutation = useMutation({
    mutationFn: ({ section, action }: LifecycleTarget) =>
      action === "activate"
        ? activateSection(section.id)
        : deactivateSection(section.id),
    onSuccess: async (section, target) => {
      setLifecycleTarget(null);
      setSuccessMessage(
        `${section.name} has been ${
          target.action === "activate" ? "activated" : "deactivated"
        }.`,
      );
      await refreshSections();
    },
  });

  function showCreateForm() {
    saveMutation.reset();
    setSuccessMessage(null);
    setEditingSection(null);
    setFormValues(EMPTY_FORM);
    setFormOpen(true);
  }

  function showEditForm(section: SectionManagementRecord) {
    saveMutation.reset();
    setSuccessMessage(null);
    setEditingSection(section);
    setFormValues({
      name: section.name,
      issn: section.issn,
      description: section.description,
    });
    setFormOpen(true);
  }

  function showManagerDialog(section: SectionManagementRecord) {
    managerMutation.reset();
    setSuccessMessage(null);
    setManagerSection(section);
    setManagerId(section.manager?.id ?? "");
  }

  function showLifecycleDialog(target: LifecycleTarget) {
    lifecycleMutation.reset();
    setSuccessMessage(null);
    setLifecycleTarget(target);
  }

  function updateFormValue(field: keyof SectionFormValues, value: string) {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await saveMutation.mutateAsync({
        sectionId: editingSection?.id ?? null,
        payload: {
          name: formValues.name.trim(),
          issn: formValues.issn.trim(),
          description: formValues.description.trim(),
        },
      });
    } catch {
      // The mutation error is shown inside the dialog.
    }
  }

  async function handleManagerAssignment() {
    if (!managerSection || !managerId) {
      return;
    }

    try {
      await managerMutation.mutateAsync({
        sectionId: managerSection.id,
        selectedManagerId: managerId,
      });
    } catch {
      // The mutation error is shown inside the dialog.
    }
  }

  async function handleLifecycleChange() {
    if (!lifecycleTarget) {
      return;
    }

    try {
      await lifecycleMutation.mutateAsync(lifecycleTarget);
    } catch {
      // The mutation error is shown inside the dialog.
    }
  }

  if (sectionsQuery.isPending) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading sections">
        <div className="h-28 animate-pulse rounded-xl bg-muted" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  if (sectionsQuery.isError) {
    return (
      <ErrorState
        title="Could not load journal sections"
        description={getErrorMessage(
          sectionsQuery.error,
          "The section-management records could not be loaded.",
        )}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => void sectionsQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        }
      />
    );
  }

  const sections = sectionsQuery.data;
  const activeCount = sections.filter((section) => section.is_active).length;
  const unmanagedCount = sections.filter((section) => !section.manager).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Journal structure"
        title="Sections"
        description="Manage scientific sections, assign responsible Section Managers, and deactivate sections without deleting their history."
        actions={
          <Button type="button" size="touch" onClick={showCreateForm}>
            <CirclePlus aria-hidden="true" />
            Create section
          </Button>
        }
      />

      {successMessage ? <Notice tone="success" title={successMessage} /> : null}

      <section
        aria-label="Section summary"
        className="grid gap-4 sm:grid-cols-3"
      >
        <SummaryCard label="Total sections" value={sections.length} />
        <SummaryCard label="Active sections" value={activeCount} />
        <SummaryCard label="Without manager" value={unmanagedCount} />
      </section>

      {unmanagedCount > 0 ? (
        <Notice
          tone="warning"
          title={`${unmanagedCount} section${unmanagedCount === 1 ? " is" : "s are"} missing a manager`}
          description="Assign an active user with the Section Manager role before relying on that section's editorial workflow."
        />
      ) : null}

      {sections.length === 0 ? (
        <EmptyState
          icon={<Building2 aria-hidden="true" />}
          title="No journal sections"
          description="Create the first scientific section to organize submissions and editorial responsibility."
          action={
            <Button type="button" onClick={showCreateForm}>
              <CirclePlus aria-hidden="true" />
              Create section
            </Button>
          }
        />
      ) : (
        <section
          aria-label="Journal sections"
          className="grid gap-4 lg:grid-cols-2"
        >
          {sections.map((section) => (
            <Card
              key={section.id}
              className={!section.is_active ? "opacity-80" : undefined}
            >
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={section.is_active ? "success" : "secondary"}
                      >
                        {section.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {section.issn ? (
                        <Badge variant="outline">ISSN {section.issn}</Badge>
                      ) : null}
                    </div>
                    <CardTitle className="mt-3" dir="auto">
                      {section.name}
                    </CardTitle>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => showEditForm(section)}
                  >
                    <Pencil aria-hidden="true" />
                    Edit
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                <p
                  className="min-h-12 text-sm leading-6 text-muted-foreground"
                  dir="auto"
                >
                  {section.description || "No section description provided."}
                </p>

                <dl className="grid gap-3 rounded-xl bg-muted/45 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      Section Manager
                    </dt>
                    <dd className="mt-1 font-medium" dir="auto">
                      {managerName(section)}
                    </dd>
                    {section.manager ? (
                      <dd className="mt-1 truncate text-xs text-muted-foreground">
                        {section.manager.email}
                      </dd>
                    ) : null}
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      Last topic analysis
                    </dt>
                    <dd className="mt-1 font-medium">
                      {formatDate(section.last_clustered_at)}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => showManagerDialog(section)}
                  >
                    <UserRoundCog aria-hidden="true" />
                    {section.manager ? "Replace manager" : "Assign manager"}
                  </Button>

                  {section.is_active ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() =>
                        showLifecycleDialog({ section, action: "deactivate" })
                      }
                    >
                      <PowerOff aria-hidden="true" />
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        showLifecycleDialog({ section, action: "activate" })
                      }
                    >
                      <Power aria-hidden="true" />
                      Activate
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

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
                {editingSection ? "Edit section" : "Create section"}
              </DialogTitle>
              <DialogDescription>
                The public slug is generated by the backend and remains stable.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="section-name">Name</Label>
                <Input
                  id="section-name"
                  value={formValues.name}
                  required
                  maxLength={255}
                  dir="auto"
                  onChange={(event) =>
                    updateFormValue("name", event.target.value)
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="section-issn">ISSN</Label>
                <Input
                  id="section-issn"
                  value={formValues.issn}
                  maxLength={9}
                  placeholder="1234-5678"
                  inputMode="numeric"
                  onChange={(event) =>
                    updateFormValue("issn", event.target.value)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Optional. Use the XXXX-XXXX format.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="section-description">Description</Label>
                <Textarea
                  id="section-description"
                  value={formValues.description}
                  rows={5}
                  dir="auto"
                  onChange={(event) =>
                    updateFormValue("description", event.target.value)
                  }
                />
              </div>

              {saveMutation.isError ? (
                <Alert variant="destructive">
                  <AlertTitle>Section not saved</AlertTitle>
                  <AlertDescription>
                    {getErrorMessage(
                      saveMutation.error,
                      "The section could not be saved.",
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
                {saveMutation.isPending ? "Saving…" : "Save section"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(managerSection)}
        onOpenChange={(open) => {
          if (!open && !managerMutation.isPending) {
            setManagerSection(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Section Manager</DialogTitle>
            <DialogDescription>
              Select an active user who already has the Section Manager role.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-4">
            {managerSection ? (
              <Notice
                tone="info"
                title={managerSection.name}
                description={`Current manager: ${managerName(managerSection)}`}
              />
            ) : null}

            {candidatesQuery.isError ? (
              <Alert variant="destructive">
                <AlertTitle>Could not load eligible managers</AlertTitle>
                <AlertDescription>
                  {getErrorMessage(
                    candidatesQuery.error,
                    "The eligible manager list could not be loaded.",
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="section-manager">Section Manager</Label>
                <Select
                  id="section-manager"
                  value={managerId}
                  disabled={candidatesQuery.isPending}
                  onChange={(event) => setManagerId(event.target.value)}
                >
                  <option value="">Select an eligible manager</option>
                  {(candidatesQuery.data ?? []).map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.full_name || candidate.username} ·{" "}
                      {candidate.email}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {candidatesQuery.data?.length === 0 ? (
              <Notice
                tone="warning"
                title="No eligible Section Managers"
                description="Assign the Section Manager role to an active user in administration first."
              />
            ) : null}

            {managerMutation.isError ? (
              <Alert variant="destructive">
                <AlertTitle>Manager not assigned</AlertTitle>
                <AlertDescription>
                  {getErrorMessage(
                    managerMutation.error,
                    "The Section Manager assignment could not be saved.",
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
                  disabled={managerMutation.isPending}
                />
              }
            >
              Cancel
            </DialogClose>
            <Button
              type="button"
              disabled={
                !managerId ||
                managerId === managerSection?.manager?.id ||
                managerMutation.isPending
              }
              onClick={() => void handleManagerAssignment()}
            >
              {managerMutation.isPending ? "Assigning…" : "Assign manager"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(lifecycleTarget)}
        onOpenChange={(open) => {
          if (!open && !lifecycleMutation.isPending) {
            setLifecycleTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {lifecycleTarget?.action === "activate"
                ? "Activate this section?"
                : "Deactivate this section?"}
            </DialogTitle>
            <DialogDescription>
              {lifecycleTarget?.action === "activate"
                ? "The section will accept new submissions again."
                : "The section will stop accepting new submissions. Existing submissions and editorial history are preserved."}
            </DialogDescription>
          </DialogHeader>

          {lifecycleTarget ? (
            <Notice
              tone="warning"
              title={lifecycleTarget.section.name}
              description="This operation changes availability; it never deletes the section."
            />
          ) : null}

          {lifecycleMutation.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Section status not changed</AlertTitle>
              <AlertDescription>
                {getErrorMessage(
                  lifecycleMutation.error,
                  "The section status could not be changed.",
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
                lifecycleTarget?.action === "deactivate"
                  ? "destructive"
                  : "default"
              }
              disabled={lifecycleMutation.isPending}
              onClick={() => void handleLifecycleChange()}
            >
              {lifecycleMutation.isPending
                ? "Saving…"
                : lifecycleTarget?.action === "activate"
                  ? "Activate section"
                  : "Deactivate section"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
