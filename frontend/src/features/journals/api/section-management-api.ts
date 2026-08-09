import { apiClient } from "@/lib/api/client";

import type {
  SectionManagementRecord,
  SectionManagerCandidate,
  SectionWritePayload,
} from "@/features/journals/types";

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export async function getManagedSections() {
  const sections: SectionManagementRecord[] = [];
  let nextUrl: string | null = "/sections/manage/sections/";

  while (nextUrl) {
    const response:
      | SectionManagementRecord[]
      | PaginatedResponse<SectionManagementRecord> =
      await apiClient.get(nextUrl);

    if (Array.isArray(response)) {
      sections.push(...response);
      break;
    }

    sections.push(...response.results);
    nextUrl = response.next;
  }

  return sections;
}

export function getSectionManagerCandidates() {
  return apiClient.get<SectionManagerCandidate[]>(
    "/sections/manage/section-manager-candidates/",
  );
}

export function createSection(payload: SectionWritePayload) {
  return apiClient.post<SectionManagementRecord>(
    "/sections/manage/sections/",
    payload,
  );
}

export function updateSection(
  sectionId: string,
  payload: Partial<SectionWritePayload>,
) {
  return apiClient.patch<SectionManagementRecord>(
    `/sections/manage/sections/${sectionId}/`,
    payload,
  );
}

export function assignSectionManager(sectionId: string, managerId: string) {
  return apiClient.post<SectionManagementRecord>(
    `/sections/manage/sections/${sectionId}/manager/`,
    { manager_id: managerId },
  );
}

export function activateSection(sectionId: string) {
  return apiClient.post<SectionManagementRecord>(
    `/sections/manage/sections/${sectionId}/activate/`,
    {},
  );
}

export function deactivateSection(sectionId: string) {
  return apiClient.post<SectionManagementRecord>(
    `/sections/manage/sections/${sectionId}/deactivate/`,
    {},
  );
}
