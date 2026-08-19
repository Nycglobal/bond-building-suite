import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { assertActiveSession } from "@/lib/customers.functions";
import { SESSION_TAKEN_MESSAGE } from "@/lib/account";

export type AccountCustomer = {
  id: string;
  company_name: string;
  customer_name: string;
  email: string;
  phone: string | null;
  username: string;
  active: boolean;
};

export type Account = {
  userId: string;
  isAdmin: boolean;
  customer: AccountCustomer | null;
};

export async function fetchAccount(): Promise<Account | null> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;

  // Single-session rule: if this login is being used on another device, the
  // server rejects it and we sign the stale local session out.
  try {
    await assertActiveSession();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(SESSION_TAKEN_MESSAGE)) {
      await supabase.auth.signOut();
      return null;
    }
    // Any other error (e.g. transient) is ignored; enforcement still applies
    // on protected server actions.
  }

  const [{ data: roles }, { data: customer }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase
      .from("customers")
      .select("id, company_name, customer_name, email, phone, username, active")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return {
    userId: user.id,
    isAdmin: (roles ?? []).some((r) => r.role === "admin"),
    customer: (customer as AccountCustomer | null) ?? null,
  };
}

export function useAccount() {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        queryClient.invalidateQueries({ queryKey: ["account"] });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  const query = useQuery({
    queryKey: ["account"],
    queryFn: fetchAccount,
    enabled: ready,
    staleTime: 30_000,
  });

  return {
    account: query.data ?? null,
    isLoading: !ready || query.isLoading,
  };
}
