import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { CustomerShell } from "@/components/CustomerShell";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/useAccount";

export const Route = createFileRoute("/_authenticated/order-success")({
  validateSearch: (search: Record<string, unknown>) => ({
    orderNumber: typeof search["orderNumber"] === "string" ? search["orderNumber"] : "",
    emailed: search["emailed"] === true || search["emailed"] === "true",
  }),
  head: () => ({
    meta: [
      { title: "Order Submitted — Jewel Brillance NYC" },
      {
        name: "description",
        content: "Your wholesale catalog order was submitted successfully.",
      },
    ],
  }),
  component: OrderSuccessPage,
});

function OrderSuccessPage() {
  const { orderNumber, emailed } = Route.useSearch();
  const { account } = useAccount();
  const email = account?.customer?.email;

  return (
    <CustomerShell>
      <div className="grid min-h-[calc(100vh-7rem)] place-items-center py-8">
        <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-background px-6 py-12 text-center shadow-[0_18px_50px_-24px_oklch(0.27_0.062_259/0.55)] sm:px-12">
          <div className="pointer-events-none absolute inset-2 rounded-2xl border border-accent/45" />
          <div className="relative">
            <CheckCircle2 className="mx-auto h-12 w-12 text-accent" strokeWidth={1.25} />
            <p className="mt-5 text-xs tracking-[0.28em] text-muted-foreground uppercase">
              Jewel Brillance NYC
            </p>
            <h1 className="mt-2 text-3xl text-primary">Order Submitted</h1>
            <div className="mx-auto mt-4 h-px w-16 bg-accent" />
            <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-muted-foreground">
              Thank you. Your catalog order{" "}
              {orderNumber ? (
                <strong className="text-primary">{orderNumber}</strong>
              ) : (
                "has been received"
              )}{" "}
              has been sent to Jewel Brillance NYC. Our team will contact you shortly.
            </p>
            {emailed && email ? (
              <p className="mt-3 text-sm text-muted-foreground">
                A confirmation email was sent to <strong className="text-primary">{email}</strong>.
              </p>
            ) : (
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Note: email delivery is not configured on this project yet, but your order has been
                received.
              </p>
            )}
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild variant="outline">
                <Link to="/my-order">
                  <ArrowLeft />
                  Back to Order
                </Link>
              </Button>
              <Button asChild>
                <Link
                  to="/catalog"
                  search={{
                    category: undefined,
                    subcategory: undefined,
                    q: undefined,
                    ringFilter: undefined,
                    trending: undefined,
                    labGrown: undefined,
                    looseDiamonds: undefined,
                  }}
                >
                  Continue Browsing
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </CustomerShell>
  );
}
