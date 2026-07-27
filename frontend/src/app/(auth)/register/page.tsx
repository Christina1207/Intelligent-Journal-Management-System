import type { Metadata } from "next";

import { RegisterForm } from "@/features/auth/components/register-form";
import { getSafeNextPath } from "@/features/auth/utils/safe-next-path";

export const metadata: Metadata = {
  title: "Create Author Account",
  description: "Create an author account for manuscript submission and tracking.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const nextValue = (await searchParams).next;
  const nextPath = getSafeNextPath(
    typeof nextValue === "string" ? nextValue : null,
    "/author",
  );

  return <RegisterForm nextPath={nextPath ?? "/author"} />;
}
