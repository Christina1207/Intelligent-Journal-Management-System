import * as React from "react";

import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata = {
  title: "Register as Author",
};

export default function RegisterPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          Loading registration...
        </div>
      }
    >
      <RegisterForm />
    </React.Suspense>
  );
}
