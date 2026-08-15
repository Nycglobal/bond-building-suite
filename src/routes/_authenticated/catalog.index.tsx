import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { CustomerShell, useCategories } from "@/components/CustomerShell";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/account";
import { useSignedUrls } from "@/lib/images";

type CatalogSearch = { category?: string; q?: string };

export const Route = createFileRoute("/_authenticated/catalog/")({
  validateSearch: (search: Record<string, unknown>): CatalogSearch => ({
    category: typeof search.category === "string" ? search.category : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Catalog — Jewel Brillance NYC Wholesale" },
      {
        name: "description",
        content:
          "Browse rings, earrings, bracelets, necklaces, pendants and sets with wholesale pricing.",
      },
      { property: "og:title", content: "Catalog — Jewel Brillance NYC Wholesale" },
      {
        property: "og:description",
        content: "Browse the Jewel Brillance NYC diamond jewelry catalog with wholesale pricing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const { category, q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [term, setTerm] = useState(q ?? "");
  const categories = useCategories();

  const products = useQuery({
    queryKey: ["catalog", category ?? "all", q ?? ""],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select(
          "id, style_number, product_name, metal, diamond_type, carat_weight, wholesale_price, category:categories(name), product_images(image_path, image_order, is_primary)",
        )
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (category) query = query.eq("category_id", category);
      if (q) query = query.or(`style_number.ilike.%${q}%,product_name.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const primaryPaths = (products.data ?? [])
    .map((product) => {
      const images = [...(product.product_images ?? [])].sort(
        (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.image_order - b.image_order,
      );
      return images[0]?.image_path;
    })
    .filter((path): path is string => Boolean(path));
  const signed = useSignedUrls(primaryPaths);

  const activeCategory = categories.data?.find((c) => c.id === category);

  return (
    <CustomerShell>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl text-primary">{activeCategory?.name ?? "The Collection"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.data ? `${products.data.length} styles available` : "Loading styles…"}
          </p>
        </div>
        <form
          className="w-full sm:w-72"
          onSubmit={(event) => {
            event.preventDefault();
            void navigate({ search: { category, q: term.trim() || undefined } });
          }}
        >
          <Input
            value={term}
            placeholder="Search style number or name"
            maxLength={80}
            onChange={(e) => setTerm(e.target.value)}
          />
        </form>
      </div>

      {products.isLoading ? (
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="aspect-square animate-pulse bg-secondary" />
          ))}
        </div>
      ) : (products.data ?? []).length === 0 ? (
        <p className="py-20 text-center text-sm text-muted-foreground">
          No styles found in this selection.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
          {(products.data ?? []).map((product) => {
            const images = [...(product.product_images ?? [])].sort(
              (a, b) =>
                Number(b.is_primary) - Number(a.is_primary) || a.image_order - b.image_order,
            );
            const url = images[0] ? signed.data?.[images[0].image_path] : undefined;
            return (
              <Link
                key={product.id}
                to="/catalog/$productId"
                params={{ productId: product.id }}
                className="group block"
              >
                <div className="aspect-square overflow-hidden bg-secondary">
                  {url ? (
                    <img
                      src={url}
                      alt={`${product.product_name} — style ${product.style_number}`}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>
                <div className="mt-3 space-y-1">
                  <p className="text-[0.65rem] tracking-[0.2em] text-muted-foreground uppercase">
                    {product.style_number}
                  </p>
                  <h2 className="text-base leading-tight text-primary">{product.product_name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {formatPrice(product.wholesale_price)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </CustomerShell>
  );
}
