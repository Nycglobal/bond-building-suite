import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
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

/** Preset options for the Diamond type dropdown. */
const DIAMOND_TYPES = [
  "Natural Diamond",
  "Lab Grown Diamond",
  "Moissanite",
  "Cubic Zirconia",
  "Sapphire",
  "Ruby",
  "Emerald",
  "Gemstone",
  "Other",
];

/** Preset options for the Carat weight dropdown (displayed with " ct"). */
const CARAT_WEIGHTS = [
  "0.10",
  "0.25",
  "0.33",
  "0.50",
  "0.75",
  "1.00",
  "1.10",
  "1.20",
  "1.25",
  "1.50",
  "1.55",
  "1.75",
  "2.00",
  "2.25",
  "2.50",
  "2.75",
  "3.00",
  "3.50",
  "4.00",
  "5.00",
];

/** Human-friendly carat label that avoids doubling an existing "ct" suffix. */
function caratLabel(value: string) {
  return value.toLowerCase().includes("ct") ? value : `${value} ct`;
}

/** A file staged in memory for a brand-new product until it is saved. */
type PendingImage = { id: string; file: File; url: string };

function ProductEditor() {
  const { productId } = Route.useParams();
  const isNew = productId === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  // Files staged in memory for a brand-new product (uploaded once it's saved).
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [primaryPendingId, setPrimaryPendingId] = useState<string | null>(null);

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
      let id = productId;
      if (isNew) {
        const { data, error } = await supabase
          .from("products")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
      } else {
        const { error } = await supabase
          .from("products")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", productId);
        if (error) throw error;
      }

      // Upload any staged images (only possible for a brand-new product).
      let uploadedImages = 0;
      const totalImages = pendingImages.length;
      const primaryId = primaryPendingId ?? pendingImages[0]?.id ?? null;
      let order = 0;
      for (const image of pendingImages) {
        const extension = image.file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(PRODUCT_BUCKET)
          .upload(path, image.file, { contentType: image.file.type, upsert: false });
        if (uploadError) continue;
        const { error } = await supabase.from("product_images").insert({
          product_id: id,
          image_path: path,
          image_order: order,
          is_primary: image.id === primaryId,
        });
        if (error) {
          await supabase.storage.from(PRODUCT_BUCKET).remove([path]);
          continue;
        }
        order += 1;
        uploadedImages += 1;
      }
      return { id, uploadedImages, totalImages };
    },
    onSuccess: ({ id, uploadedImages, totalImages }) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-product", productId] });
      if (isNew) {
        if (totalImages > 0 && uploadedImages < totalImages) {
          toast.warning(
            `Product saved, but ${totalImages - uploadedImages} image(s) failed to upload`,
          );
        } else if (totalImages > 0) {
          toast.success(`Product saved with ${uploadedImages} image(s)`);
        } else {
          toast.success("Product saved");
        }
        void navigate({ to: "/admin/products/$productId", params: { productId: id } });
      } else {
        toast.success("Product saved");
      }
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

  /** Stage selected files in memory for a brand-new product (uploaded on save). */
  function stageFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_PRODUCT_IMAGES - pendingImages.length;
    if (room <= 0) {
      toast.error(`Maximum ${MAX_PRODUCT_IMAGES} images per product`);
      return;
    }
    const selected = Array.from(files).slice(0, room);
    if (selected.length < files.length) {
      toast.warning(`Only ${room} more image(s) can be added`);
    }
    const staged = selected.map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
    }));
    const next = [...pendingImages, ...staged];
    setPendingImages(next);
    if (!primaryPendingId && next.length > 0) setPrimaryPendingId(next[0]!.id);
    if (fileInput.current) fileInput.current.value = "";
  }

  /** Remove a staged (not yet uploaded) image for a brand-new product. */
  function removePending(id: string) {
    setPendingImages((prev) => {
      const item = prev.find((image) => image.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((image) => image.id !== id);
    });
    if (primaryPendingId === id) setPrimaryPendingId(null);
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
      await supabase
        .from("product_images")
        .update({ is_primary: false })
        .eq("product_id", productId);
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
              <Select
                value={form.diamond_type}
                onValueChange={(value) => setForm({ ...form, diamond_type: value })}
              >
                <SelectTrigger id="diamond_type">
                  <SelectValue placeholder="Select diamond type" />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set([...DIAMOND_TYPES, form.diamond_type].filter(Boolean))].map(
                    (type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="carat_weight">Carat weight</Label>
              <Select
                value={form.carat_weight}
                onValueChange={(value) => setForm({ ...form, carat_weight: value })}
              >
                <SelectTrigger id="carat_weight">
                  <SelectValue placeholder="Select carat weight" />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set([...CARAT_WEIGHTS, form.carat_weight].filter(Boolean))].map(
                    (carat) => (
                      <SelectItem key={carat} value={carat}>
                        {caratLabel(carat)}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
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
              {isNew ? pendingImages.length : (images.data ?? []).length}/{MAX_PRODUCT_IMAGES}
            </span>
          </div>

          {isNew ? (
            <>
              <label className="mb-4 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary">
                <Upload className="h-4 w-4" />
                {pendingImages.length > 0 ? "Add more images" : "Upload images"}
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => stageFiles(e.target.files)}
                />
              </label>
              <p className="mb-4 text-sm text-muted-foreground">
                Choose up to {MAX_PRODUCT_IMAGES} photos. They are uploaded when you save the
                product.
              </p>
              {pendingImages.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {pendingImages.map((image) => (
                    <div key={image.id} className="space-y-1">
                      <div className="aspect-square overflow-hidden bg-secondary">
                        <img src={image.url} alt="" className="h-full w-full object-cover" />
                      </div>
                      <Button
                        type="button"
                        variant={image.id === primaryPendingId ? "default" : "outline"}
                        size="sm"
                        className="mt-1 h-7 w-full text-[0.65rem] uppercase tracking-wider"
                        onClick={() => setPrimaryPendingId(image.id)}
                      >
                        {image.id === primaryPendingId ? "Main" : "Set main"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 w-full text-[0.65rem] uppercase tracking-wider hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removePending(image.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <label className="mb-4 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary">
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploading ? "Uploading…" : "Upload images"}
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => void handleUpload(e.target.files)}
                />
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(images.data ?? []).map((image) => (
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
                    <Button
                      type="button"
                      variant={image.is_primary ? "default" : "outline"}
                      size="sm"
                      className="mt-1 h-7 w-full text-[0.65rem] uppercase tracking-wider"
                      onClick={() => setPrimary.mutate(image.id)}
                    >
                      {image.is_primary ? "Main" : "Set main"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 w-full text-[0.65rem] uppercase tracking-wider hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removeImage.mutate(image)}
                    >
                      Remove
                    </Button>
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
