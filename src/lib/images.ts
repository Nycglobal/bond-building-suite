import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const PRODUCT_BUCKET = "product-images";
export const MAX_PRODUCT_IMAGES = 20;

export type ImageRef = { image_path: string; bucket?: string | null };

/** Product images live in private buckets, so every view needs signed URLs. */
export function useSignedUrls(refs: Array<ImageRef | string>) {
  const normalized = refs.map((ref) =>
    typeof ref === "string"
      ? { path: ref, bucket: PRODUCT_BUCKET }
      : { path: ref.image_path, bucket: ref.bucket || PRODUCT_BUCKET },
  );
  const key = normalized
    .map((item) => `${item.bucket}:${item.path}`)
    .sort()
    .join("|");

  return useQuery({
    queryKey: ["signed-urls", key],
    enabled: normalized.length > 0,
    staleTime: 45 * 60 * 1000,
    queryFn: async () => {
      const byBucket = new Map<string, string[]>();
      for (const item of normalized) {
        const list = byBucket.get(item.bucket) ?? [];
        if (!list.includes(item.path)) list.push(item.path);
        byBucket.set(item.bucket, list);
      }

      const map: Record<string, string> = {};
      for (const [bucket, paths] of byBucket) {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrls(paths, 60 * 60);
        if (error) throw error;
        for (const item of data ?? []) {
          if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
        }
      }
      return map;
    },
  });
}
