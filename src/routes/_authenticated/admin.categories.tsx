import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  head: () => ({
    meta: [
      { title: "Categories — Jewel Brillance NYC Admin" },
      { name: "description", content: "Create and order the jewelry categories customers browse." },
      { property: "og:title", content: "Categories — Jewel Brillance NYC Admin" },
      {
        property: "og:description",
        content: "Manage jewelry categories for the wholesale catalog.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminCategories,
});

function AdminCategories() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [subcategoryName, setSubcategoryName] = useState("");
  const [subcategoryCategoryId, setSubcategoryCategoryId] = useState("");

  const categories = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, active, display_order")
        .order("display_order")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const subcategories = useQuery({
    queryKey: ["admin-subcategories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subcategories")
        .select("id, category_id, name, active, display_order")
        .order("display_order")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    void queryClient.invalidateQueries({ queryKey: ["categories", "active"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-subcategories"] });
    void queryClient.invalidateQueries({ queryKey: ["subcategories", "active"] });
  };

  const create = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Enter a category name");
      const nextOrder = (categories.data?.length ?? 0) + 1;
      const { error } = await supabase
        .from("categories")
        .insert({ name: trimmed, display_order: nextOrder, active: true });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      invalidate();
      toast.success("Category added");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not add"),
  });

  const createSubcategory = useMutation({
    mutationFn: async () => {
      const trimmed = subcategoryName.trim();
      if (!subcategoryCategoryId) throw new Error("Choose a parent category");
      if (!trimmed) throw new Error("Enter a subcategory name");
      const nextOrder =
        (subcategories.data ?? []).filter((item) => item.category_id === subcategoryCategoryId)
          .length + 1;
      const { error } = await supabase.from("subcategories").insert({
        category_id: subcategoryCategoryId,
        name: trimmed,
        display_order: nextOrder,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSubcategoryName("");
      invalidate();
      toast.success("Subcategory added");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not add subcategory"),
  });

  const updateSubcategory = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: Partial<{ name: string; active: boolean; display_order: number }>;
    }) => {
      const { error } = await supabase.from("subcategories").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update subcategory"),
  });

  const removeSubcategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subcategories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Subcategory deleted");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not delete subcategory"),
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: Partial<{ name: string; active: boolean; display_order: number }>;
    }) => {
      const { error } = await supabase.from("categories").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Category deleted");
    },
    onError: () => toast.error("This category still has products. Move or delete them first."),
  });

  return (
    <AdminShell title="Categories">
      <form
        className="mb-8 flex max-w-lg items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <div className="flex-1 space-y-2">
          <Label htmlFor="category-name">New category</Label>
          <Input
            id="category-name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={create.isPending}>
          Add
        </Button>
      </form>

      <form
        className="mb-8 flex max-w-3xl flex-wrap items-end gap-3 border border-border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          createSubcategory.mutate();
        }}
      >
        <div className="min-w-52 flex-1 space-y-2">
          <Label htmlFor="subcategory-parent">Parent category</Label>
          <Select value={subcategoryCategoryId} onValueChange={setSubcategoryCategoryId}>
            <SelectTrigger id="subcategory-parent">
              <SelectValue placeholder="Choose category" />
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
        <div className="min-w-52 flex-1 space-y-2">
          <Label htmlFor="subcategory-name">New subcategory</Label>
          <Input
            id="subcategory-name"
            value={subcategoryName}
            maxLength={60}
            onChange={(e) => setSubcategoryName(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={createSubcategory.isPending}>
          Add subcategory
        </Button>
      </form>

      <div className="border border-border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs tracking-[0.15em] text-muted-foreground uppercase">
            <tr>
              <th className="p-4">Name</th>
              <th className="p-4 w-32">Order</th>
              <th className="p-4 w-32">Active</th>
              <th className="p-4 w-24" />
            </tr>
          </thead>
          <tbody>
            {(categories.data ?? []).map((category) => (
              <tr key={category.id} className="border-b border-border last:border-0">
                <td className="p-4">
                  <Input
                    defaultValue={category.name}
                    maxLength={60}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value && value !== category.name) {
                        update.mutate({ id: category.id, values: { name: value } });
                      }
                    }}
                  />
                </td>
                <td className="p-4">
                  <Input
                    type="number"
                    defaultValue={category.display_order}
                    onBlur={(e) =>
                      update.mutate({
                        id: category.id,
                        values: { display_order: Number(e.target.value) || 0 },
                      })
                    }
                  />
                </td>
                <td className="p-4">
                  <Switch
                    checked={category.active}
                    onCheckedChange={(checked) =>
                      update.mutate({ id: category.id, values: { active: checked } })
                    }
                  />
                </td>
                <td className="p-4 text-right">
                  <button
                    type="button"
                    className="text-xs tracking-[0.15em] text-muted-foreground uppercase hover:text-destructive"
                    onClick={() => remove.mutate(category.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 border border-border bg-background">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold tracking-[0.15em] text-primary uppercase">
            Subcategories
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs tracking-[0.15em] text-muted-foreground uppercase">
            <tr>
              <th className="p-4">Parent</th>
              <th className="p-4">Name</th>
              <th className="w-32 p-4">Order</th>
              <th className="w-32 p-4">Active</th>
              <th className="w-24 p-4" />
            </tr>
          </thead>
          <tbody>
            {(subcategories.data ?? []).map((subcategory) => (
              <tr key={subcategory.id} className="border-b border-border last:border-0">
                <td className="p-4 text-muted-foreground">
                  {(categories.data ?? []).find(
                    (category) => category.id === subcategory.category_id,
                  )?.name ?? "Unknown"}
                </td>
                <td className="p-4">
                  <Input
                    defaultValue={subcategory.name}
                    maxLength={60}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value && value !== subcategory.name) {
                        updateSubcategory.mutate({ id: subcategory.id, values: { name: value } });
                      }
                    }}
                  />
                </td>
                <td className="p-4">
                  <Input
                    type="number"
                    defaultValue={subcategory.display_order}
                    onBlur={(e) =>
                      updateSubcategory.mutate({
                        id: subcategory.id,
                        values: { display_order: Number(e.target.value) || 0 },
                      })
                    }
                  />
                </td>
                <td className="p-4">
                  <Switch
                    checked={subcategory.active}
                    onCheckedChange={(checked) =>
                      updateSubcategory.mutate({ id: subcategory.id, values: { active: checked } })
                    }
                  />
                </td>
                <td className="p-4 text-right">
                  <button
                    type="button"
                    className="text-xs tracking-[0.15em] text-muted-foreground uppercase hover:text-destructive"
                    onClick={() => removeSubcategory.mutate(subcategory.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
