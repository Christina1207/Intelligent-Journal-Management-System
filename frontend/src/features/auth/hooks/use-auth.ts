"use client";

import * as React from "react";
import type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
  UserRole,
} from "@/types/auth";

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<AuthUser>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  logout: () => void;
  refreshCurrentUser: () => Promise<AuthUser | null>;
  hasRole: (role: UserRole) => boolean;
};

export const AuthContext = React.createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = React.useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
