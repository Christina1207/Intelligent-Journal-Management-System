import { apiClient } from "@/lib/api/client";
import type { PublicSection } from "@/features/journals/types";

export function getPublicSections() {
  return apiClient.get<PublicSection[]>("/public/sections/", {
    skipAuth: true,
  });
}
