import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CustomerShell, useCategories } from "@/components/CustomerShell";
import { ProductImage } from "@/components/ProductImage";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/account";
import { useSignedUrls } from "@/lib/images";
import { cn } from "@/lib/utils";

type CatalogSearch = {
  category: string | undefined;
  subcategory: string | undefined;
  q: string | undefined;
  ringFilter: string | undefined;
  trending: boolean | undefined;
  labGrown: boolean | undefined;
};

const EARRINGS_CATEGORY_ID = "a212b86c-4492-40e5-bdd4-ed2e4df8a15c";

/** Per-category filter tabs. The first ("All") resets the filter; the rest are
 *  applied on top of the active category and the search term. */
const CATEGORY_FILTERS: Record<string, { id: string; label: string }[]> = {
  Rings: [
    { id: "diamond", label: "Diamond Rings" },
    { id: "gold", label: "Gold Rings" },
    { id: "gemstone", label: "Gemstone Rings" },
    { id: "initial", label: "Initial Rings" },
  ],
  Bracelets: [
    { id: "diamond", label: "Diamond Bracelets" },
    { id: "gemstone", label: "Gemstone Bracelets" },
    { id: "bangles", label: "Bangles" },
  ],
  Earrings: [
    { id: "diamond", label: "Diamond Earrings" },
    { id: "gemstone", label: "Gemstone Earrings" },
    { id: "piercings", label: "Piercings" },
  ],
  Necklaces: [
    { id: "diamond", label: "Diamond Necklaces" },
    { id: "gold", label: "Gold Necklaces" },
    { id: "gemstone", label: "Gemstone Necklaces" },
    { id: "initial", label: "Initial Necklaces" },
  ],
};

/** Generic filter tabs shown on the cross-category Trending view. */
const TRENDING_FILTERS = [
  { id: "diamond", label: "Diamond" },
  { id: "gold", label: "Gold" },
  { id: "gemstone", label: "Gemstone" },
  { id: "initial", label: "Initial" },
];

/** Type tabs shown on the cross-category Lab Grown Diamond view. */
const LAB_GROWN_FILTERS: { id: string; label: string; categoryId: string }[] = [
  { id: "rings", label: "Rings", categoryId: "db6c1361-5036-4d1e-9838-3c18a718c39f" },
  { id: "necklaces", label: "Necklaces", categoryId: "d3605570-aac6-425f-adbf-74e2d5997ffe" },
  { id: "earrings", label: "Earrings", categoryId: EARRINGS_CATEGORY_ID },
  { id: "bracelets", label: "Bracelets", categoryId: "da136319-f20e-40be-8231-3c9e2c01bdb8" },
];

/** Product sorting options, worded to match the app's wholesale style language. */
const SORT_OPTIONS = [
  { value: "best-selling", label: "Best Selling" },
  { value: "a-z", label: "Name: A to Z" },
  { value: "z-a", label: "Name: Z to A" },
  { value: "price-desc", label: "Wholesale: High to Low" },
  { value: "price-asc", label: "Wholesale: Low to High" },
  { value: "newest", label: "Newest Arrivals" },
  { value: "oldest", label: "Oldest First" },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]["value"];

export const Route = createFileRoute("/_authenticated/catalog/")({
  validateSearch: (search: Record<string, unknown>): CatalogSearch => ({
    category: typeof search["category"] === "string" ? search["category"] : undefined,
    subcategory: typeof search["subcategory"] === "string" ? search["subcategory"] : undefined,
    q: typeof search["q"] === "string" ? search["q"] : undefined,
    ringFilter: typeof search["ringFilter"] === "string" ? search["ringFilter"] : undefined,
    trending: search["trending"] === true,
    labGrown: search["labGrown"] === true,
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
  const { category, subcategory, q, ringFilter, trending, labGrown } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [term, setTerm] = useState(q ?? "");
  const [sort, setSort] = useState<SortKey>("best-selling");
  const categories = useCategories();
  const isTrending = trending === true;
  const isLabGrown = labGrown === true;
  const viewKey = isLabGrown ? "lab-grown" : isTrending ? "trending" : (category ?? "all");
  const queryClient = useQueryClient();
  const selectedSubcategoryName = categories.data
    ?.find((item) => item.id === category)
    ?.subcategories.find((item) => item.id === subcategory)?.name;

  /** Product IDs ticked for the bulk "Add to Catalog" action. */
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Clear the selection when switching catalog views so stale picks aren't carried over.
  useEffect(() => {
    setSelected(new Set());
  }, [viewKey]);

  const products = useQuery({
    queryKey: [
      "catalog",
      viewKey,
      subcategory ?? "all",
      selectedSubcategoryName ?? "",
      q ?? "",
      ringFilter ?? "all",
    ],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select(
          "id, style_number, product_name, metal, diamond_type, carat_weight, wholesale_price, created_at, category:categories(name), product_images(image_path, image_order, is_primary, bucket)",
        )
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (isLabGrown) {
        query = query.contains("tags", ["lab-grown"]);
        const lgTab = LAB_GROWN_FILTERS.find((t) => t.id === ringFilter);
        if (lgTab) query = query.eq("category_id", lgTab.categoryId);
      } else if (isTrending) query = query.contains("tags", ["trending"]);
      else if (category) query = query.eq("category_id", category);
      if (selectedSubcategoryName === "Men's") {
        query = query.or(
          "style_number.ilike.AR%,product_name.ilike.%men's%,product_name.ilike.%mens%,product_name.ilike.%unisex%",
        );
      } else if (selectedSubcategoryName === "Ladies'") {
        query = query
          .not("style_number", "ilike", "AR%")
          .not("product_name", "ilike", "%men's%")
          .not("product_name", "ilike", "%mens%")
          .not("product_name", "ilike", "%unisex%");
      } else if (subcategory) query = query.eq("subcategory_id", subcategory);
      if (category === EARRINGS_CATEGORY_ID)
        query = query.not("tags", "cs", '{"plain-gold-earrings"}');
      if (ringFilter === "diamond") query = query.neq("diamond_type", null);
      else if (ringFilter === "gold") query = query.ilike("product_name", "%gold%");
      else if (ringFilter === "plain-gold" && category !== EARRINGS_CATEGORY_ID)
        query = query.overlaps("tags", [
          "plain-gold",
          "plain-gold-bracelets",
          "plain-gold-bangles",
        ]);
      else if (ringFilter === "gemstone")
        query = query.or(
          "product_name.ilike.%ruby%,product_name.ilike.%emerald%,product_name.ilike.%sapphire%,product_name.ilike.%gemstone%",
        );
      else if (ringFilter === "initial") query = query.ilike("product_name", "%initial%");
      else if (ringFilter === "bangles") query = query.ilike("product_name", "%bangle%");
      else if (ringFilter === "piercings") query = query.ilike("product_name", "%piercing%");
      if (q) query = query.or(`style_number.ilike.%${q}%,product_name.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  /** Products in the currently selected sort order (Best Selling keeps the server order). */
  const productsList = useMemo(() => {
    const list = products.data ?? [];
    switch (sort) {
      case "a-z":
        return [...list].sort((a, b) => a.product_name.localeCompare(b.product_name));
      case "z-a":
        return [...list].sort((a, b) => b.product_name.localeCompare(a.product_name));
      case "price-desc":
        return [...list].sort((a, b) => Number(b.wholesale_price) - Number(a.wholesale_price));
      case "price-asc":
        return [...list].sort((a, b) => Number(a.wholesale_price) - Number(b.wholesale_price));
      case "newest":
        return [...list].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      case "oldest":
        return [...list].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
      default:
        return list;
    }
  }, [products.data, sort]);

  /** Add every ticked product to the customer's catalog order (cart), one unit each. */
  const addSelectedToOrder = useMutation({
    mutationFn: async (productIds: string[]) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in again");

      const { data: existing, error: existingError } = await supabase
        .from("cart_items")
        .select("id, product_id, quantity")
        .in("product_id", productIds);
      if (existingError) throw existingError;

      const existingRows = existing ?? [];
      const byProduct = new Map<string, (typeof existingRows)[number]>(
        existingRows.map((row) => [row.product_id, row] as const),
      );

      for (const productId of productIds) {
        const row = byProduct.get(productId);
        if (row) {
          const { error } = await supabase
            .from("cart_items")
            .update({ quantity: row.quantity + 1 })
            .eq("id", row.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("cart_items")
            .insert({ user_id: auth.user.id, product_id: productId, quantity: 1 });
          if (error) throw error;
        }
      }
    },
    onSuccess: (_data, productIds) => {
      void queryClient.invalidateQueries({ queryKey: ["cart-count"] });
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      setSelected(new Set());
      toast.success(
        productIds.length > 1
          ? `Added ${productIds.length} styles to your catalog order`
          : "Added to your catalog order",
      );
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not add items"),
  });

  const primaryPaths = (products.data ?? [])
    .map((product) => {
      const images = [...(product.product_images ?? [])].sort(
        (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.image_order - b.image_order,
      );
      return images[0];
    })
    .filter((image): image is NonNullable<typeof image> => Boolean(image));
  const signed = useSignedUrls(primaryPaths);

  const activeCategory = categories.data?.find((c) => c.id === category);
  const activeSubcategory = activeCategory?.subcategories.find((item) => item.id === subcategory);
  const viewTitle = isLabGrown
    ? "Lab Grown Diamond"
    : isTrending
      ? "Trending"
      : (activeSubcategory?.name ?? activeCategory?.name ?? "The Collection");
  const tabs = isLabGrown
    ? LAB_GROWN_FILTERS
    : isTrending
      ? TRENDING_FILTERS
      : activeCategory
        ? CATEGORY_FILTERS[activeCategory.name]
        : undefined;

  return (
    <CustomerShell>
      <div className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Wholesale Collection
          </p>
          <h1 className="mt-1 text-3xl text-primary">{viewTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.data ? `${products.data.length} styles available` : "Loading styles…"}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          {selected.size > 0 && (
            <Button
              type="button"
              onClick={() => addSelectedToOrder.mutate([...selected])}
              disabled={addSelectedToOrder.isPending}
              className="whitespace-nowrap"
            >
              {addSelectedToOrder.isPending
                ? "Adding…"
                : `Add ${selected.size} ${selected.size === 1 ? "style" : "styles"} to Catalog`}
            </Button>
          )}
          <form
            className="w-full sm:w-72"
            onSubmit={(event) => {
              event.preventDefault();
              void navigate({
                search: {
                  category,
                  subcategory,
                  q: term.trim() || undefined,
                  ringFilter,
                  trending,
                  labGrown,
                },
              });
            }}
          >
            <Input
              value={term}
              placeholder="Search style number or name"
              maxLength={80}
              onChange={(e) => setTerm(e.target.value)}
            />
          </form>
          <span className="hidden text-xs tracking-[0.2em] text-muted-foreground uppercase sm:inline">
            Sort by
          </span>
          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
            <SelectTrigger
              className="w-full uppercase tracking-[0.15em] text-xs sm:w-48"
              aria-label="Sort products"
            >
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {tabs && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              void navigate({
                search: { category, subcategory, q, ringFilter: undefined, trending, labGrown },
              })
            }
            className={cn(
              "rounded-none border px-4 py-1.5 text-sm transition-colors",
              !ringFilter
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/60 hover:text-primary",
            )}
          >
            All {viewTitle}
          </button>
          {tabs.map((filter) => {
            const active = ringFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() =>
                  void navigate({
                    search: {
                      category,
                      subcategory,
                      q,
                      ringFilter: active ? undefined : filter.id,
                      trending,
                      labGrown,
                    },
                  })
                }
                className={cn(
                  "rounded-none border px-4 py-1.5 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/60 hover:text-primary",
                )}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      )}

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
          {productsList.map((product) => {
            const images = [...(product.product_images ?? [])].sort(
              (a, b) =>
                Number(b.is_primary) - Number(a.is_primary) || a.image_order - b.image_order,
            );
            const url = images[0] ? signed.data?.[images[0].image_path] : undefined;
            return (
              <div key={product.id} className="group relative block">
                <Link to="/catalog/$productId" params={{ productId: product.id }} className="block">
                  <div className="aspect-square overflow-hidden bg-secondary ring-1 ring-border/70 transition group-hover:ring-primary/60">
                    <ProductImage
                      src={url}
                      alt={`${product.product_name} — style ${product.style_number}`}
                      urlLoading={signed.isLoading}
                      className="transition-transform duration-500 group-hover:scale-105"
                    />
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
                <div className="absolute left-2 top-2 z-10">
                  <Checkbox
                    aria-label={`Select ${product.product_name} (${product.style_number}) for your catalog order`}
                    className="bg-background/80 backdrop-blur-sm"
                    checked={selected.has(product.id)}
                    onCheckedChange={(checked) => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(product.id);
                        else next.delete(product.id);
                        return next;
                      });
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CustomerShell>
  );
}
