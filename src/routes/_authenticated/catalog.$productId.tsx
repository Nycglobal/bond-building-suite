import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { CustomerShell } from "@/components/CustomerShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/account";
import { useSignedUrls } from "@/lib/images";

export const Route = createFileRoute("/_authenticated/catalog/$productId")({
  head: () => ({
    meta: [
      { title: "Style Details — Jewel Brillance NYC Wholesale" },
      {
        name: "description",
        content:
          "Full specifications, gallery and wholesale pricing for this Jewel Brillance NYC style.",
      },
      { property: "og:title", content: "Style Details — Jewel Brillance NYC Wholesale" },
      {
        property: "og:description",
        content: "Full specifications and wholesale pricing for this Jewel Brillance NYC style.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductPage,
  errorComponent: () => (
    <CustomerShell>
      <p className="py-20 text-center text-sm text-muted-foreground">
        This style could not be loaded.
      </p>
    </CustomerShell>
  ),
  notFoundComponent: () => (
    <CustomerShell>
      <p className="py-20 text-center text-sm text-muted-foreground">Style not found.</p>
    </CustomerShell>
  ),
});

function ProductPage() {
  const { productId } = Route.useParams();
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const product = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, style_number, product_name, description, metal, diamond_type, carat_weight, wholesale_price, category:categories(name), product_images(id, image_path, image_order, is_primary, bucket)",
        )
        .eq("id", productId)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const images = [...(product.data?.product_images ?? [])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.image_order - b.image_order,
  );
  const signed = useSignedUrls(images);
  const current = images[Math.min(index, Math.max(images.length - 1, 0))];

  const addToOrder = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in again");
      const { data: existing } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("product_id", productId)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + quantity })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cart_items")
          .insert({ user_id: auth.user.id, product_id: productId, quantity });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cart-count"] });
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast.success("Added to your catalog order");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not add item"),
  });

  if (product.isLoading) {
    return (
      <CustomerShell>
        <div className="h-96 animate-pulse bg-secondary" />
      </CustomerShell>
    );
  }

  if (!product.data) {
    return (
      <CustomerShell>
        <p className="py-20 text-center text-sm text-muted-foreground">Style not available.</p>
      </CustomerShell>
    );
  }

  const item = product.data;
  const specs = [
    { label: "Style Number", value: item.style_number },
    { label: "Category", value: item.category?.name ?? "—" },
    { label: "Metal", value: item.metal ?? "—" },
    { label: "Diamond Type", value: item.diamond_type ?? "—" },
    { label: "Carat Weight", value: item.carat_weight ?? "—" },
  ];

  return (
    <CustomerShell>
      <Link
        to="/catalog"
        search={{ category: undefined, q: undefined }}
        className="mb-8 inline-block text-xs tracking-[0.2em] text-muted-foreground uppercase hover:text-primary"
      >
        ← Back to catalog
      </Link>

      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden bg-secondary">
            {current && signed.data?.[current.image_path] ? (
              <img
                src={signed.data[current.image_path]}
                alt={`${item.product_name} — view ${index + 1}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No image
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
              {images.map((image, i) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`View image ${i + 1}`}
                  className={`h-20 w-20 flex-shrink-0 overflow-hidden border ${
                    i === index ? "border-accent" : "border-border"
                  }`}
                >
                  {signed.data?.[image.image_path] ? (
                    <img
                      src={signed.data[image.image_path]}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="block h-full w-full bg-secondary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-[0.65rem] tracking-[0.25em] text-muted-foreground uppercase">
            {item.category?.name ?? "Jewelry"}
          </p>
          <h1 className="mt-2 text-3xl text-primary">{item.product_name}</h1>
          <p className="mt-4 text-xl text-primary">{formatPrice(item.wholesale_price)}</p>
          <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
            Wholesale price
          </p>

          {item.description && (
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          )}

          <dl className="mt-8 border-t border-border">
            {specs.map((spec) => (
              <div key={spec.label} className="flex justify-between border-b border-border py-3">
                <dt className="text-xs tracking-[0.15em] text-muted-foreground uppercase">
                  {spec.label}
                </dt>
                <dd className="text-sm text-primary">{spec.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex items-end gap-4">
            <div className="w-28 space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={999}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(999, Number(e.target.value))))}
              />
            </div>
            <Button
              className="flex-1"
              disabled={addToOrder.isPending}
              onClick={() => addToOrder.mutate()}
            >
              {addToOrder.isPending ? "Adding…" : "Add to My Catalog Order"}
            </Button>
          </div>
        </div>
      </div>
    </CustomerShell>
  );
}
