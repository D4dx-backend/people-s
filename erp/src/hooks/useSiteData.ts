import { useQuery } from "@tanstack/react-query";
import { website } from "@/lib/api";

export interface SiteValue {
  title?: string;
  description?: string;
  icon?: string;
}

export interface SiteSettings {
  aboutUs?: { title?: string; description?: string; imageUrl?: string };
  hero?: { title?: string; subtitle?: string; ctaText?: string; ctaLink?: string; secondaryCtaText?: string; secondaryCtaLink?: string };
  vision?: { title?: string; description?: string };
  mission?: { title?: string; description?: string };
  values?: SiteValue[];
  counts?: Array<{ _id?: string; title: string; count: number; icon?: string }>;
  contactDetails?: { phone?: string; email?: string; address?: string; whatsapp?: string };
  socialMedia?: { facebook?: string; instagram?: string; youtube?: string; twitter?: string; linkedin?: string };
  donation?: {
    enabled?: boolean; heading?: string; description?: string; accountName?: string; accountNumber?: string;
    bankName?: string; ifsc?: string; upiId?: string; paymentLink?: string; qrImageUrl?: string;
  };
  seo?: { title?: string; description?: string; keywords?: string; ogImageUrl?: string };
  footer?: { description?: string; copyrightText?: string; links?: Array<{ label: string; url: string }> };
}

export interface SiteHomeData {
  settings: SiteSettings;
  banners: Array<{ _id: string; title?: string; description?: string; imageUrl: string; link?: string }>;
  projects: Array<{ _id: string; name: string; description?: string; category?: string; status?: string }>;
  schemes: Array<{ _id: string; name?: string; title?: string; description?: string; category?: string }>;
  news: Array<{ _id: string; title: string; description?: string; category?: string; imageUrl?: string; publishDate?: string; featured?: boolean }>;
  blogs: Array<{ _id: string; title: string; slug: string; excerpt?: string; author?: string; coverImageUrl?: string; category?: string; publishDate?: string }>;
  gallery: Array<{ _id: string; title: string; category?: string; coverImageUrl?: string; imageCount?: number }>;
  videos: Array<{ _id: string; title: string; description?: string; videoUrl: string; thumbnailUrl?: string; category?: string; featured?: boolean }>;
  partners: Array<{ _id: string; name: string; logoUrl?: string; link?: string }>;
  brochures: Array<{ _id: string; title: string; description?: string; fileUrl: string; fileName?: string; category?: string }>;
  faqs: Array<{ _id: string; question: string; answer: string; category?: string }>;
  media: Array<{ _id: string; title: string; source?: string; link?: string; imageUrl?: string; publishDate?: string }>;
}

/**
 * Fetch the aggregated public home content for the franchise resolved by hostname.
 */
export function useSiteData() {
  return useQuery({
    queryKey: ["site-home"],
    queryFn: async () => {
      const res: any = await website.getHome();
      return (res?.data || {}) as SiteHomeData;
    },
    staleTime: 1000 * 60 * 5,
  });
}

/** Extract a YouTube video id from common URL formats. */
export function getYouTubeId(url?: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

/** Best-effort thumbnail for a video (custom thumb, else YouTube auto thumb). */
export function videoThumb(videoUrl?: string, thumbnailUrl?: string): string {
  if (thumbnailUrl) return thumbnailUrl;
  const id = getYouTubeId(videoUrl);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
}
