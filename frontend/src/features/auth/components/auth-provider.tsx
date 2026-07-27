"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
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

function getAuthScope(user: AuthUser | null) {
  if (!user) {
    return null;
  }

  return `${user.id}|${[...user.roles].sort().join(",")}|${user.status}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = React.useState<AuthUser | null>(() =>
    getStoredCurrentUser(),
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const authScopeRef = React.useRef(getAuthScope(user));

  const applyUser = React.useCallback(
    (nextUser: AuthUser | null) => {
      const nextScope = getAuthScope(nextUser);

      if (authScopeRef.current !== nextScope) {
        queryClient.clear();
      }

      authScopeRef.current = nextScope;
      setUser(nextUser);
    },
    [queryClient],
  );

  const refreshCurrentUser = React.useCallback(async () => {
    const token = getAccessToken();

    if (!token) {
      applyUser(null);
      setIsLoading(false);
      return null;
    }

    try {
      const currentUser = await getCurrentUser();
      applyUser(currentUser);
      saveCurrentUser(currentUser);
      return currentUser;
    } catch {
      clearAuthData();
      applyUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [applyUser]);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshCurrentUser();
    }, 0);

    const unsubscribe = subscribeToAuthStorage(() => {
      applyUser(getStoredCurrentUser());
    });

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [applyUser, refreshCurrentUser]);

  const login = React.useCallback(
    async (payload: LoginPayload) => {
      const tokens = await loginRequest(payload);
      saveAuthTokens(tokens);

      const currentUser = await getCurrentUser();
      saveCurrentUser(currentUser);
      applyUser(currentUser);

      return currentUser;
    },
    [applyUser],
  );

  const register = React.useCallback(
    async (payload: RegisterPayload) => {
      const response = await registerRequest(payload);
      saveAuthTokens(response.tokens);
      saveCurrentUser(response.user);
      applyUser(response.user);

      return response.user;
    },
    [applyUser],
  );

  const logout = React.useCallback(() => {
    clearAuthData();
    applyUser(null);
  }, [applyUser]);

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
