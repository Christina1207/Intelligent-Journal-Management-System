import { apiClient } from "@/lib/api/client";
import type {
  AuthTokens,
  AuthUser,
  AuthUserDto,
  LoginPayload,
  RegisterPayload,
  UpdateCurrentUserProfilePayload,
  UserRole,
} from "@/types/auth";

function mapCurrentUser(dto: AuthUserDto): AuthUser {
  return {
    ...dto,
    roles: dto.roles.map((role) => role.name),
  };
}

export function hasRole(user: AuthUser | null, role: UserRole) {
  return Boolean(user?.roles.includes(role));
}

export async function login(payload: LoginPayload) {
  return apiClient.post<AuthTokens>("/auth/login/", payload, {
    skipAuth: true,
  });
}

export async function register(payload: RegisterPayload) {
  const response = await apiClient.post<{
    user: AuthUserDto;
    tokens: AuthTokens;
  }>("/auth/register/", payload, {
    skipAuth: true,
  });

  return {
    user: mapCurrentUser(response.user),
    tokens: response.tokens,
  };
}

export async function getCurrentUser() {
  const dto = await apiClient.get<AuthUserDto>("/auth/me/");
  return mapCurrentUser(dto);
}

export async function updateCurrentUserProfile(
  payload: UpdateCurrentUserProfilePayload,
) {
  const dto = await apiClient.patch<AuthUserDto>("/auth/me/", payload);
  return mapCurrentUser(dto);
}
