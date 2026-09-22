import { apiGet, apiPost, apiGetBody } from "./api";

export interface LegalDocument {
  id?: string;
  version?: string;
  title: string;
  effectiveDate?: string;
  lastUpdated?: string;
  contentFormat?: string;
  content: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  order?: number;
  category?: string;
  helpfulCount?: number;
  notHelpfulCount?: number;
}

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  status?: string;
  version?: number;
  publishedAt?: string;
  blocks: Array<{ type: string; order?: number; data: Record<string, unknown> }>;
}

export interface CollectionPage {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  tagline?: string;
  products: unknown[];
  pagination?: { page: number; limit: number; total: number; totalPages?: number };
}

export const contentService = {
  async getLegalConfig() {
    return apiGet<{ loginLegal: Record<string, string> }>("/legal/config", { skipAuth: true });
  },

  async getTerms(version?: string) {
    const q = version ? `?version=${encodeURIComponent(version)}` : "";
    return apiGet<LegalDocument>(`/legal/terms${q}`, { skipAuth: true });
  },

  async getPrivacy(version?: string) {
    const q = version ? `?version=${encodeURIComponent(version)}` : "";
    return apiGet<LegalDocument>(`/legal/privacy${q}`, { skipAuth: true });
  },

  async getLicense(version?: string) {
    const q = version ? `?version=${encodeURIComponent(version)}` : "";
    return apiGet<LegalDocument>(`/legal/license${q}`, { skipAuth: true });
  },

  async acceptLegal(input: { termsVersion?: string; privacyVersion?: string }) {
    return apiPost("/legal/accept", input);
  },

  async getFaq(category?: string): Promise<{ data: FaqItem[]; categories: string[] }> {
    const q = category ? `?category=${encodeURIComponent(category)}` : "";
    const result = await apiGetBody<{ data: FaqItem[]; categories: string[] }>(`/faq${q}`, {
      skipAuth: true,
    });
    return { data: result.data ?? [], categories: result.categories ?? [] };
  },

  async getFaqCategories() {
    return apiGetBody<{ data: Array<{ id: string; name: string; order?: number }> }>(
      "/faq/categories",
      { skipAuth: true },
    );
  },

  async submitFaqFeedback(id: string, helpful: boolean) {
    return apiPost(`/faq/${id}/feedback`, { helpful });
  },

  async getOnboardingPages() {
    return apiGet<Array<{ _id: string; pageNumber: number; title: string; description: string; imageUrl?: string }>>(
      "/onboarding/pages",
      { skipAuth: true },
    );
  },

  async getOnboardingStatus() {
    return apiGet<{ onboardingCompleted: boolean; onboardingCompletedAt?: string }>("/onboarding/status", {
      skipAuth: true,
    });
  },

  async completeOnboarding() {
    return apiPost("/onboarding/complete");
  },

  async getCollection(slug: string, page = 1, limit = 20) {
    return apiGet<CollectionPage>(
      `/collections/${encodeURIComponent(slug)}?page=${page}&limit=${limit}`,
      { skipAuth: true },
    );
  },

  async getPage(slug: string) {
    return apiGet<CmsPage>(`/pages/${encodeURIComponent(slug)}`, { skipAuth: true });
  },
};
