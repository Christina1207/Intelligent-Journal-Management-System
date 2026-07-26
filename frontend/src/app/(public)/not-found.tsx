import { PublicResourceNotFound } from "@/features/public/components/public-resource-not-found";

export default function PublicNotFound() {
  return (
    <PublicResourceNotFound
      eyebrow="Not found"
      title="This journal page is unavailable"
      description="The address may be incorrect, or the requested journal resource may no longer be published."
      actionLabel="Return to the journal"
      actionHref="/"
    />
  );
}
