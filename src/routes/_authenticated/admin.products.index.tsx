import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/account";

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

  const products = useQuery({
    queryKey: ["admin-products", term],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select(
          "id, style_number, product_name, wholesale_price, active, category:categories(name), product_images(id)",
        )
        .order("created_at", { ascending: false });
      if (term.trim()) {
        query = query.or(`style_number.ilike.%${term.trim()}%,product_name.ilike.%${term.trim()}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
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
        <Button asChild>
          <Link to="/admin/products/$productId" params={{ productId: "new" }}>
            Add Product
          </Link>
        </Button>
      </div>

      <div className="border border-border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs tracking-[0.15em] text-muted-foreground uppercase">
            <tr>
              <th className="p-4">Style #</th>
              <th className="p-4">Product</th>
              <th className="p-4">Category</th>
              <th className="p-4">Images</th>
              <th className="p-4 text-right">Wholesale</th>
              <th className="p-4">Active</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(products.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No products yet.
                </td>
              </tr>
            ) : (
              (products.data ?? []).map((product) => (
                <tr key={product.id} className="border-b border-border last:border-0">
                  <td className="p-4">{product.style_number}</td>
                  <td className="p-4">{product.product_name}</td>
                  <td className="p-4">{product.category?.name ?? "—"}</td>
                  <td className="p-4">{product.product_images?.length ?? 0}</td>
                  <td className="p-4 text-right">{formatPrice(product.wholesale_price)}</td>
                  <td className="p-4">
                    <Switch
                      checked={product.active}
                      onCheckedChange={(checked) =>
                        toggleActive.mutate({ id: product.id, active: checked })
                      }
                    />
                  </td>
                  <td className="space-x-4 p-4 text-right text-xs tracking-[0.15em] uppercase">
                    <Link
                      to="/admin/products/$productId"
                      params={{ productId: product.id }}
                      className="text-muted-foreground hover:text-primary"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => remove.mutate(product.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
