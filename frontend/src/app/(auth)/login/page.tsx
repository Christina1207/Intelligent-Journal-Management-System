import * as React from "react";

import { LoginForm } from "@/features/auth/components/login-form";

export const metadata = {
  title: "Login",
};

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          Loading login...
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
