import type { UserRole } from "@/types/roles";

export type { UserRole } from "@/types/roles";

export type BackendRoleDto = {
  id: number;
  name: UserRole;
};

export type AuthUserDto = {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  orcid: string;
  affiliation: string;
  country: string;
  status: string;
  roles: BackendRoleDto[];
};

export type AuthUser = Omit<AuthUserDto, "roles"> & {
  roles: UserRole[];
};

export type AuthTokens = {
  access: string;
  refresh: string;
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type RegisterPayload = {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  orcid?: string;
  affiliation?: string;
  country?: string;
};

export type UpdateCurrentUserProfilePayload = Partial<{
  first_name: string;
  last_name: string;
  orcid: string;
  affiliation: string;
  country: string;
}>;
