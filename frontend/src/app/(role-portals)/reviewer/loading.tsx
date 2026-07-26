import { LoadingState } from "@/components/common/loading-state";

export default function ReviewerLoading() {
  return (
    <LoadingState
      label="Loading reviewer workspace"
      className="min-h-[50vh]"
    />
  );
}
