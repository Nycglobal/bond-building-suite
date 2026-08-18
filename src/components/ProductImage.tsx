import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type ProductImageProps = {
  src?: string | undefined;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  /** True while the source URL itself is still being resolved (e.g. signed URLs). */
  urlLoading?: boolean;
};

/**
 * Fills its parent with a product image. Shows a spinner while the URL is
 * resolving or the image is loading, then swaps in the image. Falls back to a
 * "No image" message only when the image is genuinely missing or fails to load.
 */
export function ProductImage({
  src,
  alt,
  className,
  loading = "lazy",
  urlLoading = false,
}: ProductImageProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  // Reset to loading whenever the source changes (new product / new view).
  useEffect(() => {
    setStatus("loading");
  }, [src]);

  const busy = urlLoading || (Boolean(src) && status === "loading");
  const noImage = src ? status === "error" : !urlLoading;

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-secondary", className)}>
      {busy && (
        <div className="absolute inset-0 grid place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {noImage && !busy && (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          No image
        </div>
      )}
      {src && (
        <img
          src={src}
          alt={alt}
          loading={loading}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          className={cn("h-full w-full object-cover", busy && "opacity-0")}
        />
      )}
    </div>
  );
}
