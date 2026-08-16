import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { MAX_PRODUCT_IMAGES, PRODUCT_BUCKET, useSignedUrls } from "@/lib/images";

export const Route = createFileRoute("/_authenticated/admin/products/$productId")({
  head: () => ({
    meta: [
      { title: "Edit Product — Jewel Brillance NYC Admin" },
      {
        name: "description",
        content:
          "Edit style details, specifications, wholesale price and up to 20 photos for a jewelry style.",
      },
      { property: "og:title", content: "Edit Product — Jewel Brillance NYC Admin" },
      { property: "og:description", content: "Edit a jewelry style and its photo gallery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductEditor,
  errorComponent: () => (
    <AdminShell title="Product">
      <p className="text-sm text-muted-foreground">This product could not be loaded.</p>
    </AdminShell>
  ),
  notFoundComponent: () => (
    <AdminShell title="Product">
      <p className="text-sm text-muted-foreground">Product not found.</p>
    </AdminShell>
  ),
});

const emptyForm = {
  category_id: "",
  style_number: "",
  product_name: "",
  description: "",
  metal: "",
  diamond_type: "",
  carat_weight: "",
  wholesale_price: "",
  active: true,
};

function ProductEditor() {
  const { productId } = Route.useParams();
  const isNew = productId === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);

  const categories = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .order("display_order")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const product = useQuery({
    queryKey: ["admin-product", productId],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const images = useQuery({
    queryKey: ["admin-product-images", productId],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_images")
        .select("id, image_path, image_order, is_primary, bucket")
        .eq("product_id", productId)
        .order("image_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const signed = useSignedUrls(images.data ?? []);

  useEffect(() => {
    if (!product.data) return;
    setForm({
      category_id: product.data.category_id ?? "",
      style_number: product.data.style_number,
      product_name: product.data.product_name,
      description: product.data.description ?? "",
      metal: product.data.metal ?? "",
      diamond_type: product.data.diamond_type ?? "",
      carat_weight: product.data.carat_weight ?? "",
      wholesale_price: String(product.data.wholesale_price ?? ""),
      active: product.data.active,
    });
  }, [product.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        category_id: form.category_id || null,
        style_number: form.style_number.trim(),
        product_name: form.product_name.trim(),
        description: form.description.trim() || null,
        metal: form.metal.trim() || null,
        diamond_type: form.diamond_type.trim() || null,
        carat_weight: form.carat_weight.trim() || null,
        wholesale_price: Number(form.wholesale_price || 0),
        active: form.active,
      };
      if (!payload.style_number || !payload.product_name) {
        throw new Error("Style number and product name are required");
      }
      if (isNew) {
        const { data, error } = await supabase
          .from("products")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      }
      const { error } = await supabase
        .from("products")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", productId);
      if (error) throw error;
      return productId;
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-product", productId] });
      toast.success("Product saved");
      if (isNew) void navigate({ to: "/admin/products/$productId", params: { productId: id } });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save"),
  });

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || isNew) return;
    const existing = images.data ?? [];
    const room = MAX_PRODUCT_IMAGES - existing.length;
    if (room <= 0) {
      toast.error(`Maximum ${MAX_PRODUCT_IMAGES} images per product`);
      return;
    }
    const selected = Array.from(files).slice(0, room);
    if (selected.length < files.length) {
      toast.warning(`Only ${room} more image(s) can be added`);
    }
    setUploading(true);
    let order = existing.length;
    for (const file of selected) {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${productId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(PRODUCT_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        toast.error(uploadError.message);
        continue;
      }
      const { error } = await supabase.from("product_images").insert({
        product_id: productId,
        image_path: path,
        image_order: order,
        is_primary: existing.length === 0 && order === 0,
      });
      if (error) {
        await supabase.storage.from(PRODUCT_BUCKET).remove([path]);
        toast.error(error.message);
        continue;
      }
      order += 1;
    }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
    void queryClient.invalidateQueries({ queryKey: ["admin-product-images", productId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
  }

  const removeImage = useMutation({
    mutationFn: async (image: { id: string; image_path: string; bucket: string | null }) => {
      const { error } = await supabase.from("product_images").delete().eq("id", image.id);
      if (error) throw error;
      await supabase.storage.from(image.bucket || PRODUCT_BUCKET).remove([image.image_path]);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-product-images", productId] });
      toast.success("Image removed");
    },
  });

  const setPrimary = useMutation({
    mutationFn: async (imageId: string) => {
      await supabase.from("product_images").update({ is_primary: false }).eq("product_id", productId);
      const { error } = await supabase
        .from("product_images")
        .update({ is_primary: true })
        .eq("id", imageId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-product-images", productId] });
      toast.success("Main image updated");
    },
  });

  const moveImage = useMutation({
    mutationFn: async ({ index, direction }: { index: number; direction: -1 | 1 }) => {
      const list = [...(images.data ?? [])];
      const target = index + direction;
      if (target < 0 || target >= list.length) return;
      const a = list[index]!;
      const b = list[target]!;
      await supabase.from("product_images").update({ image_order: target }).eq("id", a.id);
      await supabase.from("product_images").update({ image_order: index }).eq("id", b.id);
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["admin-product-images", productId] }),
  });

  return (
    <AdminShell title={isNew ? "Add Product" : "Edit Product"}>
      <Link
        to="/admin/products"
        className="mb-6 inline-block text-xs tracking-[0.2em] text-muted-foreground uppercase hover:text-primary"
      >
        ← All products
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        <form
          className="space-y-5 border border-border bg-background p-6"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="style_number">Style number</Label>
              <Input
                id="style_number"
                required
                maxLength={60}
                value={form.style_number}
                onChange={(e) => setForm({ ...form, style_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={form.category_id}
                onValueChange={(value) => setForm({ ...form, category_id: value })}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {(categories.data ?? []).map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product_name">Product name</Label>
            <Input
              id="product_name"
              required
              maxLength={140}
              value={form.product_name}
              onChange={(e) => setForm({ ...form, product_name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              maxLength={2000}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="metal">Metal</Label>
              <Input
                id="metal"
                maxLength={80}
                placeholder="14K Yellow Gold"
                value={form.metal}
                onChange={(e) => setForm({ ...form, metal: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="diamond_type">Diamond type</Label>
              <Input
                id="diamond_type"
                maxLength={80}
                placeholder="Natural / Lab Grown"
                value={form.diamond_type}
                onChange={(e) => setForm({ ...form, diamond_type: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="carat_weight">Carat weight</Label>
              <Input
                id="carat_weight"
                maxLength={60}
                placeholder="1.25 ct"
                value={form.carat_weight}
                onChange={(e) => setForm({ ...form, carat_weight: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wholesale_price">Wholesale price (USD)</Label>
              <Input
                id="wholesale_price"
                type="number"
                min={0}
                step="0.01"
                required
                value={form.wholesale_price}
                onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3 pt-7">
              <Switch
                id="active"
                checked={form.active}
                onCheckedChange={(checked) => setForm({ ...form, active: checked })}
              />
              <Label htmlFor="active">Visible to customers</Label>
            </div>
          </div>

          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save Product"}
          </Button>
        </form>

        <div className="border border-border bg-background p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg text-primary">Images</h2>
            <span className="text-xs text-muted-foreground">
              {(images.data ?? []).length}/{MAX_PRODUCT_IMAGES}
            </span>
          </div>

          {isNew ? (
            <p className="text-sm text-muted-foreground">
              Save the product first, then upload up to {MAX_PRODUCT_IMAGES} photos.
            </p>
          ) : (
            <>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                className="mb-4 block w-full text-sm"
                onChange={(e) => void handleUpload(e.target.files)}
              />
              {uploading && <p className="mb-4 text-sm text-muted-foreground">Uploading…</p>}
              <div className="grid grid-cols-3 gap-3">
                {(images.data ?? []).map((image, index) => (
                  <div key={image.id} className="space-y-1">
                    <div className="aspect-square overflow-hidden bg-secondary">
                      {signed.data?.[image.image_path] ? (
                        <img
                          src={signed.data[image.image_path]}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between text-[0.65rem] uppercase">
                      <button
                        type="button"
                        aria-label="Move left"
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => moveImage.mutate({ index, direction: -1 })}
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        className={
                          image.is_primary
                            ? "text-primary"
                            : "text-muted-foreground hover:text-primary"
                        }
                        onClick={() => setPrimary.mutate(image.id)}
                      >
                        {image.is_primary ? "Main" : "Set main"}
                      </button>
                      <button
                        type="button"
                        aria-label="Move right"
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => moveImage.mutate({ index, direction: 1 })}
                      >
                        →
                      </button>
                    </div>
                    <button
                      type="button"
                      className="w-full text-[0.65rem] tracking-[0.1em] text-muted-foreground uppercase hover:text-destructive"
                      onClick={() => removeImage.mutate(image)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
