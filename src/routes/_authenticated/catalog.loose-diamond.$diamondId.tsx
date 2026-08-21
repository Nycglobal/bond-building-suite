import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ShieldCheck, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CustomerShell } from "@/components/CustomerShell";
import { ProductImage } from "@/components/ProductImage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSignedUrls } from "@/lib/images";
import { looseDiamondImagePath } from "@/lib/loose-diamonds";

export const Route = createFileRoute("/_authenticated/catalog/loose-diamond/$diamondId")({
  head: () => ({
    meta: [
      { title: "Loose Diamond Details — Jewel Brillance NYC Wholesale" },
      {
        name: "description",
        content: "View loose diamond specifications and add a stone to your catalog order.",
      },
    ],
  }),
  component: LooseDiamondDetailPage,
});

function LooseDiamondDetailPage() {
  const { diamondId } = Route.useParams();
  const queryClient = useQueryClient();
  const diamond = useQuery({
    queryKey: ["loose-diamond", diamondId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loose_diamonds")
        .select(
          "id, page, category, item_number, carat_weight, shape, cut_style, color_grade, clarity_grade, report_number, image_path, created_at",
        )
        .eq("id", diamondId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const item = diamond.data;
  const imagePath = item ? looseDiamondImagePath(item) : undefined;
  const certificatePath = item?.page
    ? `diamonds-certificates/page_${item.page}_image_1.jpeg`
    : undefined;
  const signed = useSignedUrls(
    [imagePath, certificatePath]
      .filter((path): path is string => Boolean(path))
      .map((path) => ({ image_path: path, bucket: "images" })),
  );
  const [informationOpen, setInformationOpen] = useState(false);
  const [certificateOpen, setCertificateOpen] = useState(false);
  const addToCatalog = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in again");
      const { data: existing, error: existingError } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("loose_diamond_id", diamondId)
        .maybeSingle();
      if (existingError) throw existingError;

      if (existing) {
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + 1 })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cart_items")
          .insert({ user_id: auth.user.id, loose_diamond_id: diamondId, quantity: 1 });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cart-count"] });
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast.success("Added to your catalog order");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not add diamond"),
  });

  if (diamond.isLoading) {
    return (
      <CustomerShell>
        <div className="grid gap-12 lg:grid-cols-2">
          <div className="aspect-square animate-pulse bg-secondary" />
          <div className="space-y-5">
            <div className="h-10 w-3/4 animate-pulse bg-secondary" />
            <div className="h-32 animate-pulse bg-secondary" />
          </div>
        </div>
      </CustomerShell>
    );
  }

  if (!item) {
    return (
      <CustomerShell>
        <p className="py-20 text-center text-sm text-muted-foreground">Loose diamond not found.</p>
      </CustomerShell>
    );
  }

  const title = `${item.carat_weight ?? ""} Carat ${item.shape ?? "Diamond"}`;
  const specs = [
    ["Carat", item.carat_weight ?? "—"],
    ["Color", item.color_grade ?? "—"],
    ["Clarity", item.clarity_grade ?? "—"],
    ["Cut", item.cut_style ?? "—"],
  ];

  return (
    <CustomerShell>
      <Link
        to="/catalog"
        search={{
          category: undefined,
          q: undefined,
          ringFilter: undefined,
          trending: undefined,
          labGrown: undefined,
          looseDiamonds: true,
        }}
        className="mb-8 inline-flex items-center gap-2 text-xs tracking-[0.2em] text-muted-foreground uppercase transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to loose diamonds
      </Link>

      <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div className="relative aspect-square overflow-hidden bg-secondary ring-1 ring-border/70">
          <ProductImage
            src={imagePath ? signed.data?.[imagePath] : undefined}
            alt={title}
            urlLoading={signed.isLoading}
          />
          <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 border border-border bg-background/90 px-3 py-2 text-xs tracking-[0.15em] text-primary uppercase backdrop-blur-sm">
            <ShieldCheck className="h-4 w-4 text-accent-foreground" /> Verified inventory
          </div>
        </div>

        <div className="pt-1">
          <p className="text-[0.65rem] tracking-[0.25em] text-muted-foreground uppercase">
            Loose Diamond{item.report_number ? ` · ${item.report_number}` : ""}
          </p>
          <h1 className="mt-3 max-w-xl text-4xl leading-[1.05] text-primary sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Natural and lab-grown loose diamond inventory selected for wholesale sourcing.
          </p>

          <dl className="mt-8 grid grid-cols-2 border-y border-border sm:grid-cols-4">
            {specs.map(([label, value]) => (
              <div
                key={label}
                className="border-border py-4 first:pl-0 sm:border-r sm:px-4 last:border-0"
              >
                <dt className="text-[0.6rem] tracking-[0.2em] text-muted-foreground uppercase">
                  {label}
                </dt>
                <dd className="mt-1 text-base font-medium text-primary">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="border-b border-border py-5">
            <button
              type="button"
              onClick={() => setInformationOpen(true)}
              className="text-sm font-medium text-primary transition-colors hover:text-accent-foreground"
            >
              View Full Diamond Information <span aria-hidden="true">→</span>
            </button>
          </div>

          <div className="flex items-center gap-3 border-b border-border py-5">
            <div className="grid h-10 w-10 place-items-center rounded-full border border-accent text-accent-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">
                IGI Certified
                {item.report_number && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    #{item.report_number}
                  </span>
                )}
                <span className="ml-2 rounded-full border border-emerald-400 px-2 py-0.5 text-[0.6rem] tracking-[0.12em] text-emerald-600 uppercase">
                  Verified
                </span>
              </p>
              <button
                type="button"
                onClick={() => setCertificateOpen(true)}
                className="mt-1 text-sm text-accent-foreground transition-colors hover:text-primary"
              >
                Get the Certificate Now <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          <div className="mt-8 border-b border-border pb-8">
            <Button
              type="button"
              className="h-12 w-full uppercase tracking-[0.18em]"
              onClick={() => addToCatalog.mutate()}
              disabled={addToCatalog.isPending}
            >
              {addToCatalog.isPending ? "Adding…" : "Add to Catalog"}
            </Button>
          </div>

          <div className="grid gap-5 pt-7 sm:grid-cols-2">
            <div className="flex gap-3">
              <Check className="mt-0.5 h-4 w-4 text-accent-foreground" />
              <div>
                <p className="text-sm font-medium text-primary">Wholesale selection</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Request details through your catalog order.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Truck className="mt-0.5 h-4 w-4 text-accent-foreground" />
              <div>
                <p className="text-sm font-medium text-primary">Ready to source</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Availability confirmed with your order.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={informationOpen} onOpenChange={setInformationOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-background p-0">
          <div className="p-6 sm:p-8">
            <DialogHeader className="border-b border-border pb-5 pr-8 text-left">
              <p className="text-[0.65rem] tracking-[0.25em] text-accent-foreground uppercase">
                Full Diamond Information
              </p>
              <DialogTitle className="mt-2 font-serif text-2xl text-primary">
                {title} Loose Diamond
              </DialogTitle>
              <DialogDescription className="mt-2 text-xs tracking-[0.18em] text-muted-foreground uppercase">
                {item.report_number ?? "Inventory details"}
              </DialogDescription>
            </DialogHeader>
            <dl className="mt-2 divide-y divide-border">
              {[
                ["Stock Number", item.report_number ?? item.item_number ?? "—"],
                ["Shape", item.shape ?? "—"],
                ["Carat Weight", item.carat_weight ? `${item.carat_weight} ct.` : "—"],
                ["Color", item.color_grade ?? "—"],
                ["Clarity", item.clarity_grade ?? "—"],
                ["Cut", item.cut_style ?? "—"],
                ["Certification", item.report_number ? `IGI · #${item.report_number}` : "—"],
                ["Type", item.category ?? "Lab Grown"],
                ["Status", "Available"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-6 py-3">
                  <dt className="text-sm text-muted-foreground">{label}:</dt>
                  <dd className="text-right text-sm font-medium text-primary">{value}</dd>
                </div>
              ))}
            </dl>
            <Button
              type="button"
              className="mt-6 w-full uppercase tracking-[0.15em]"
              onClick={() => setCertificateOpen(true)}
            >
              View Verified Certificate <span aria-hidden="true">→</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={certificateOpen} onOpenChange={setCertificateOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto bg-background p-0">
          <div className="p-5 sm:p-8">
            <DialogHeader className="border-b border-border pb-5 pr-8 text-left">
              <p className="text-[0.65rem] tracking-[0.25em] text-accent-foreground uppercase">
                Certificate Preview
              </p>
              <DialogTitle className="mt-2 font-serif text-2xl text-primary">
                IGI Report
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs tracking-[0.18em] text-muted-foreground uppercase">
                Report no. {item.report_number ?? "Unavailable"}
              </DialogDescription>
            </DialogHeader>
            {certificatePath && signed.data?.[certificatePath] ? (
              <img
                src={signed.data[certificatePath]}
                alt={`IGI certificate for ${title}`}
                className="mt-6 max-h-[65vh] w-full object-contain bg-secondary"
              />
            ) : (
              <div className="mt-6 grid min-h-64 place-items-center bg-secondary p-8 text-center text-sm text-muted-foreground">
                The certificate is not available for this diamond yet.
              </div>
            )}
            <div className="mt-5 border-t border-border pt-5 text-sm text-muted-foreground">
              This document is the official certificate file for this stone. Verify the report
              number directly with IGI before purchase.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </CustomerShell>
  );
}
