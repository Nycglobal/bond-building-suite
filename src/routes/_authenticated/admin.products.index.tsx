import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Loader2, Table } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/AdminShell";
import { ProductImage } from "@/components/ProductImage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/account";
import { useSignedUrls } from "@/lib/images";
import { cn } from "@/lib/utils";

type AdminProduct = {
  id: string;
  style_number: string;
  product_name: string;
  wholesale_price: number | string | null;
  active: boolean;
  category: { name: string } | null;
  product_images:
    | {
        id: string;
        image_path: string;
        image_order: number | null;
        is_primary: boolean | null;
        bucket: string | null;
      }[]
    | null;
};

export const Route = createFileRoute("/_authenticated/admin/products/")({
  head: () => ({
    meta: [
      { title: "Products — Jewel Brillance NYC Admin" },
      {
        name: "description",
        content: "Add, edit and publish jewelry styles with specifications and wholesale pricing.",
      },
      { property: "og:title", content: "Products — Jewel Brillance NYC Admin" },
      { property: "og:description", content: "Manage jewelry styles in the wholesale catalog." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminProducts,
});

function AdminProducts() {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [view, setView] = useState<"table" | "grid">("table");
  const [pendingDelete, setPendingDelete] = useState<AdminProduct | null>(null);

  const categories = useQuery({
    queryKey: ["admin-categories", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .eq("active", true)
        .order("display_order")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const products = useQuery({
    queryKey: ["admin-products", term, filter],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select(
          "id, style_number, product_name, wholesale_price, active, category:categories(name), product_images(id, image_path, image_order, is_primary, bucket)",
        )
        .order("created_at", { ascending: false });
      if (filter === "lab-grown") {
        query = query.contains("tags", ["lab-grown"]);
      } else if (filter !== "all") {
        query = query.eq("category_id", filter);
      }
      if (term.trim()) {
        query = query.or(`style_number.ilike.%${term.trim()}%,product_name.ilike.%${term.trim()}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AdminProduct[];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("products").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { data: images } = await supabase
        .from("product_images")
        .select("image_path")
        .eq("product_id", id);
      if (images?.length) {
        await supabase.storage.from("product-images").remove(images.map((i) => i.image_path));
      }
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Product deleted");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete"),
  });

  /** Primary image (is_primary first, then lowest image_order) for a product. */
  const primaryImage = (product: AdminProduct) => {
    const images = [...(product.product_images ?? [])].sort(
      (a, b) =>
        Number(b.is_primary) - Number(a.is_primary) || (a.image_order ?? 0) - (b.image_order ?? 0),
    );
    return images[0];
  };

  const primaryPaths = (products.data ?? [])
    .map(primaryImage)
    .filter((image): image is NonNullable<typeof image> => Boolean(image));
  const signed = useSignedUrls(primaryPaths);

  const imageUrl = (product: AdminProduct) => {
    const image = primaryImage(product);
    return image ? signed.data?.[image.image_path] : undefined;
  };

  const filters = [
    { value: "all", label: "All" },
    ...(categories.data ?? []).map((category) => ({ value: category.id, label: category.name })),
    { value: "lab-grown", label: "Lab Grown Diamonds" },
  ];

  return (
    <AdminShell title="Products">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Input
          className="w-72"
          placeholder="Search style number or name"
          value={term}
          maxLength={80}
          onChange={(e) => setTerm(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-md border border-border bg-background p-1">
            <button
              type="button"
              onClick={() => setView("table")}
              aria-label="Table view"
              className={cn(
                "grid h-8 w-8 place-items-center rounded-md transition-colors",
                view === "table"
                  ? "bg-secondary text-primary"
                  : "text-muted-foreground hover:text-primary",
              )}
            >
              <Table className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-label="Grid view"
              className={cn(
                "grid h-8 w-8 place-items-center rounded-md transition-colors",
                view === "grid"
                  ? "bg-secondary text-primary"
                  : "text-muted-foreground hover:text-primary",
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <Button asChild>
            <Link to="/admin/products/$productId" params={{ productId: "new" }}>
              Add Product
            </Link>
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {filters.map((item) => {
          const active = filter === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={cn(
                "rounded-none border px-4 py-1.5 text-sm transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/60 hover:text-primary",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {view === "table" ? (
        <div className="border border-border bg-background">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs tracking-[0.15em] text-muted-foreground uppercase">
              <tr>
                <th className="p-4">Image</th>
                <th className="p-4">Style #</th>
                <th className="p-4">Product</th>
                <th className="p-4">Category</th>
                <th className="p-4 text-right">Wholesale</th>
                <th className="p-4">Active</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.isPending ? (
                <tr>
                  <td colSpan={7} className="p-8">
                    <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Loading products…
                    </div>
                  </td>
                </tr>
              ) : (products.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No products yet.
                  </td>
                </tr>
              ) : (
                (products.data ?? []).map((product) => (
                  <tr key={product.id} className="border-b border-border last:border-0">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-md border border-border bg-secondary">
                          <ProductImage
                            src={imageUrl(product)}
                            alt={product.product_name}
                            urlLoading={signed.isLoading}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {product.product_images?.length ?? 0}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">{product.style_number}</td>
                    <td className="p-4">{product.product_name}</td>
                    <td className="p-4">{product.category?.name ?? "—"}</td>
                    <td className="p-4 text-right">{formatPrice(product.wholesale_price)}</td>
                    <td className="p-4">
                      <Switch
                        checked={product.active}
                        onCheckedChange={(checked) =>
                          toggleActive.mutate({ id: product.id, active: checked })
                        }
                      />
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="uppercase tracking-[0.15em]"
                        >
                          <Link to="/admin/products/$productId" params={{ productId: product.id }}>
                            Edit
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="uppercase tracking-[0.15em] hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setPendingDelete(product)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {products.isPending ? (
            Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="border border-border bg-background p-4">
                <div className="aspect-square animate-pulse bg-secondary" />
                <div className="mt-3 h-3 w-1/2 animate-pulse bg-secondary" />
                <div className="mt-2 h-4 w-3/4 animate-pulse bg-secondary" />
                <div className="mt-2 h-3 w-1/3 animate-pulse bg-secondary" />
              </div>
            ))
          ) : (products.data ?? []).length === 0 ? (
            <p className="col-span-full p-8 text-center text-muted-foreground">No products yet.</p>
          ) : (
            (products.data ?? []).map((product) => (
              <div key={product.id} className="border border-border bg-background p-4">
                <div className="aspect-square overflow-hidden rounded-md border border-border bg-secondary">
                  <ProductImage
                    src={imageUrl(product)}
                    alt={product.product_name}
                    urlLoading={signed.isLoading}
                  />
                </div>
                <p className="mt-3 text-[0.65rem] tracking-[0.2em] text-muted-foreground uppercase">
                  {product.style_number}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-primary">{product.product_name}</p>
                <p className="text-xs text-muted-foreground">{product.category?.name ?? "—"}</p>
                <p className="mt-2 text-sm text-primary">{formatPrice(product.wholesale_price)}</p>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={product.active}
                      onCheckedChange={(checked) =>
                        toggleActive.mutate({ id: product.id, active: checked })
                      }
                    />
                    Active
                  </label>
                  <div className="flex gap-2">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="uppercase tracking-[0.15em]"
                    >
                      <Link to="/admin/products/$productId" params={{ productId: product.id }}>
                        Edit
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="uppercase tracking-[0.15em] hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setPendingDelete(product)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="mt-3 flex items-center gap-4">
                <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border border-border bg-secondary">
                  <ProductImage
                    src={pendingDelete ? imageUrl(pendingDelete) : undefined}
                    alt={pendingDelete?.product_name ?? ""}
                    urlLoading={signed.isLoading}
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {pendingDelete?.product_name}
                  </p>
                  <p className="text-xs text-muted-foreground">{pendingDelete?.style_number}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    This will permanently delete this style and its images. This cannot be undone.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) remove.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
