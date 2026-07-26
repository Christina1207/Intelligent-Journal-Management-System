"use client";

import { CheckCircle2 } from "lucide-react";

import { Notice } from "@/components/common/notice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CompleteTriageDialog({
  open,
  isPending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Complete initial triage?</DialogTitle>
          <DialogDescription>
            This finalizes the saved checklist for the current manuscript
            version and makes the assessment read-only.
          </DialogDescription>
        </DialogHeader>

        <Notice
          tone="info"
          title="Next workflow step"
          description="After completion, the manuscript remains in the submitted queue until you assign an eligible Section Editor."
        />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="touch"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Keep editing
          </Button>
          <Button
            type="button"
            size="touch"
            disabled={isPending}
            onClick={onConfirm}
          >
            <CheckCircle2 aria-hidden="true" />
            {isPending ? "Completing triage…" : "Complete triage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
