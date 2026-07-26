import type { Metadata } from "next";

import { LoginForm } from "@/features/auth/components/login-form";
import { getSafeNextPath } from "@/features/auth/utils/safe-next-path";

export const metadata: Metadata = {
  title: "Author Login",
  description: "Sign in to manage journal submissions and author tasks.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const nextValue = (await searchParams).next;
  const nextPath = getSafeNextPath(
    typeof nextValue === "string" ? nextValue : null,
  );

  return <LoginForm nextPath={nextPath} />;
}
