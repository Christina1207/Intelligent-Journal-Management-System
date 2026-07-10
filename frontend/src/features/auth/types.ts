export type RoleName =
  | "AUTHOR"
  | "EDITOR_IN_CHIEF"
  | "SECTION_MANAGER"
  | "SECTION_EDITOR"
  | "REVIEWER"
  | "READER";

export type CurrentUser = {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  orcid: string;
  affiliation: string;
  country: string;
  status: string;
  roles: RoleName[];
};

export type BackendRoleDto = {
  id: number;
  name: RoleName;
};

export type CurrentUserDto = Omit<CurrentUser, "roles"> & {
  roles: BackendRoleDto[];
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

export type AuthTokens = {
  access: string;
  refresh: string;
};
