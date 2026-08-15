/** Shared, client-safe account helpers. */

export const ACCOUNT_EMAIL_DOMAIN = "accounts.jewelbrillance.app";

/** Wholesale logins use a username; auth stores it as a stable internal address. */
export function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@${ACCOUNT_EMAIL_DOMAIN}`;
}

export const ORDER_STATUSES = [
  "New",
  "Reviewing",
  "Confirmed",
  "Completed",
  "Cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function formatPrice(value: number | string | null | undefined) {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}
