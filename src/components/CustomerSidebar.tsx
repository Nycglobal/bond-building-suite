import { Link } from "@tanstack/react-router";
import { Gem, LogOut, Sparkles, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type Category = { id: string; name: string };

export function CustomerSidebar({
  categories,
  cartCount,
  onSignOut,
}: {
  categories: Category[];
  cartCount: number;
  onSignOut: () => void;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        {collapsed ? (
          <span className="wordmark text-center text-xl text-sidebar-primary">JB</span>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="wordmark text-xl text-sidebar-foreground">Jewel Brillance</span>
            <span className="text-[0.6rem] tracking-[0.35em] text-sidebar-primary uppercase">
              New York
            </span>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Catalog</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="All Jewelry">
                  <Link
                    to="/catalog"
                    search={{ category: undefined, q: undefined }}
                    activeOptions={{ exact: true, includeSearch: true }}
                    activeProps={{
                      className: "bg-sidebar-accent text-sidebar-primary font-medium",
                    }}
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>All Jewelry</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Categories</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {categories.map((category) => (
                <SidebarMenuItem key={category.id}>
                  <SidebarMenuButton asChild tooltip={category.name}>
                    <Link
                      to="/catalog"
                      search={{ category: category.id, q: undefined }}
                      activeOptions={{ includeSearch: true }}
                      activeProps={{
                        className: "bg-sidebar-accent text-sidebar-primary font-medium",
                      }}
                    >
                      <Gem className="h-4 w-4" />
                      <span>{category.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Order</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="My Catalog Order">
                  <Link
                    to="/my-order"
                    activeProps={{
                      className: "bg-sidebar-accent text-sidebar-primary font-medium",
                    }}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    <span>My Catalog Order</span>
                  </Link>
                </SidebarMenuButton>
                {cartCount > 0 && <SidebarMenuBadge>{cartCount}</SidebarMenuBadge>}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSignOut}
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
