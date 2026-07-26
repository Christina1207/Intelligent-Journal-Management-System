import { LoadingState } from "@/components/common/loading-state";

export default function SectionEditorLoading() {
  return (
    <LoadingState
      label="Loading Section Editor workspace"
      className="min-h-[50vh]"
    />
  );
}
