import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  head: () => ({
    meta: [
      { title: "Categories — Jewel Brillance NYC Admin" },
      { name: "description", content: "Create and order the jewelry categories customers browse." },
      { property: "og:title", content: "Categories — Jewel Brillance NYC Admin" },
      { property: "og:description", content: "Manage jewelry categories for the wholesale catalog." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminCategories,
});

function AdminCategories() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

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

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    void queryClient.invalidateQueries({ queryKey: ["categories", "active"] });
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
    onError: () =>
      toast.error("This category still has products. Move or delete them first."),
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
    </AdminShell>
  );
}
