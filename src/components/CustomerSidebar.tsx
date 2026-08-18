import { Link } from "@tanstack/react-router";
import {
  Circle,
  CircleDashed,
  CircleDot,
  Diamond,
  Gem,
  Link as LinkIcon,
  LogOut,
  ShoppingBag,
  Sparkle,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

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

/** Distinct icon per product category. Falls back to Gem for unknown categories. */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Rings: CircleDot,
  Earrings: Gem,
  Bracelets: CircleDashed,
  Pendants: Sparkle,
  Necklaces: LinkIcon,
  Bangles: Circle,
};

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
  // Menu icons are sized to 30px by the sidebar itself when collapsed; this
  // size is only needed for the footer Sign Out button (not a menu item).
  const iconSize = collapsed ? "h-6.5 w-6.5" : "h-4 w-4";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        {collapsed ? (
          <span className="wordmark text-center text-3xl text-sidebar-primary">JB</span>
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
          <SidebarGroupLabel className="h-9 px-2 text-sm font-semibold text-sidebar-foreground">
            Catalog
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="All Jewelry">
                  <Link
                    to="/catalog"
                    search={{
                      category: undefined,
                      q: undefined,
                      ringFilter: undefined,
                      trending: undefined,
                      labGrown: undefined,
                    }}
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
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Trending">
                  <Link
                    to="/catalog"
                    search={{
                      trending: true,
                      category: undefined,
                      q: undefined,
                      ringFilter: undefined,
                      labGrown: undefined,
                    }}
                    activeOptions={{ exact: true, includeSearch: true }}
                    activeProps={{
                      className: "bg-sidebar-accent text-sidebar-primary font-medium",
                    }}
                  >
                    <TrendingUp className="h-4 w-4" />
                    <span>Trending</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="h-9 px-2 text-sm font-semibold text-sidebar-foreground">
            Categories
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {categories.map((category) => {
                const CategoryIcon = CATEGORY_ICONS[category.name] ?? Gem;
                return (
                  <SidebarMenuItem key={category.id}>
                    <SidebarMenuButton asChild tooltip={category.name}>
                      <Link
                        to="/catalog"
                        search={{
                          category: category.id,
                          q: undefined,
                          ringFilter: undefined,
                          trending: undefined,
                          labGrown: undefined,
                        }}
                        activeOptions={{ includeSearch: true }}
                        activeProps={{
                          className: "bg-sidebar-accent text-sidebar-primary font-medium",
                        }}
                      >
                        <CategoryIcon className="h-4 w-4" />
                        <span>{category.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Lab Grown Diamond">
                  <Link
                    to="/catalog"
                    search={{
                      labGrown: true,
                      category: undefined,
                      q: undefined,
                      ringFilter: undefined,
                      trending: undefined,
                    }}
                    activeOptions={{ exact: true, includeSearch: true }}
                    activeProps={{
                      className: "bg-sidebar-accent text-sidebar-primary font-medium",
                    }}
                  >
                    <Diamond className="h-4 w-4" />
                    <span>Lab Grown Diamond</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="h-9 px-2 text-sm font-semibold text-sidebar-foreground">
            Order
          </SidebarGroupLabel>
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
          className={`w-full gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
            collapsed ? "justify-center" : "justify-start"
          }`}
        >
          <LogOut className={`${iconSize} shrink-0`} />
          {!collapsed && <span>Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
