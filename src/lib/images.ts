import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const PRODUCT_BUCKET = "product-images";
export const MAX_PRODUCT_IMAGES = 20;

/** Product images live in a private bucket, so every view needs signed URLs. */
export function useSignedUrls(paths: string[]) {
  const key = [...paths].sort().join("|");
  return useQuery({
    queryKey: ["signed-urls", key],
    enabled: paths.length > 0,
    staleTime: 45 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(PRODUCT_BUCKET)
        .createSignedUrls(paths, 60 * 60);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const item of data ?? []) {
        if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
      }
      return map;
    },
  });
}
