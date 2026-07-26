"use client";

import * as React from "react";
import {
  clearAuthData,
  getAccessToken,
  getStoredCurrentUser,
  saveAuthTokens,
  saveCurrentUser,
  subscribeToAuthStorage,
} from "@/lib/auth/auth-storage";
import type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
  UserRole,
} from "@/types/auth";
import {
  getCurrentUser,
  login as loginRequest,
  register as registerRequest,
} from "@/features/auth/api/auth-api";
import { AuthContext } from "@/features/auth/hooks/use-auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(() =>
    getStoredCurrentUser(),
  );
  const [isLoading, setIsLoading] = React.useState(true);

  const refreshCurrentUser = React.useCallback(async () => {
    const token = getAccessToken();

    if (!token) {
      setUser(null);
      setIsLoading(false);
      return null;
    }

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      saveCurrentUser(currentUser);
      return currentUser;
    } catch {
      clearAuthData();
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshCurrentUser();
    }, 0);

    const unsubscribe = subscribeToAuthStorage(() => {
      setUser(getStoredCurrentUser());
    });

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [refreshCurrentUser]);

  const login = React.useCallback(async (payload: LoginPayload) => {
    const tokens = await loginRequest(payload);
    saveAuthTokens(tokens);

    const currentUser = await getCurrentUser();
    saveCurrentUser(currentUser);
    setUser(currentUser);

    return currentUser;
  }, []);

  const register = React.useCallback(async (payload: RegisterPayload) => {
    const response = await registerRequest(payload);
    saveAuthTokens(response.tokens);
    saveCurrentUser(response.user);
    setUser(response.user);

    return response.user;
  }, []);

  const logout = React.useCallback(() => {
    clearAuthData();
    setUser(null);
  }, []);

  const value = React.useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      refreshCurrentUser,
      hasRole: (role: UserRole) => Boolean(user?.roles.includes(role)),
    }),
    [isLoading, login, logout, refreshCurrentUser, register, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
