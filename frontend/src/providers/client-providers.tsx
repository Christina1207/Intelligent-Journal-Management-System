"use client";

import * as React from "react";

import { AuthProvider } from "@/features/auth/components/auth-provider";
import { QueryProvider } from "@/providers/query-provider";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>{children}</AuthProvider>
    </QueryProvider>
  );
}
