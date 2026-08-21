import { Link } from "@tanstack/react-router";
import {
  Circle,
  CircleDashed,
  CircleDot,
  ChevronDown,
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
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

type Category = {
  id: string;
  name: string;
  subcategories: { id: string; name: string }[];
};

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
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const quietActiveProps = {
    className: "font-medium text-sidebar-primary",
  };

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
                    activeProps={quietActiveProps}
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
                    activeProps={quietActiveProps}
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
                  <Collapsible key={category.id} asChild>
                    <SidebarMenuItem
                      className="group/category"
                      onMouseEnter={() => collapsed && setOpenCategoryId(category.id)}
                      onMouseLeave={() => collapsed && setOpenCategoryId(null)}
                      onFocus={() => collapsed && setOpenCategoryId(category.id)}
                      onBlur={(event) => {
                        if (collapsed && !event.currentTarget.contains(event.relatedTarget)) {
                          setOpenCategoryId(null);
                        }
                      }}
                    >
                      <div className="flex items-center">
                        <SidebarMenuButton
                          asChild
                          tooltip={category.name}
                          className="group-data-[collapsible=icon]:justify-center"
                        >
                          <Link
                            to="/catalog"
                            search={{
                              category: category.id,
                              subcategory: undefined,
                              q: undefined,
                              ringFilter: undefined,
                              trending: undefined,
                              labGrown: undefined,
                            }}
                            activeOptions={{ includeSearch: true }}
                            activeProps={quietActiveProps}
                          >
                            <CategoryIcon className="h-4 w-4" />
                            <span>{category.name}</span>
                          </Link>
                        </SidebarMenuButton>
                        {category.subcategories.length > 0 && !collapsed && (
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                              <ChevronDown className="h-4 w-4 transition-transform in-data-[state=open]:rotate-180" />
                              <span className="sr-only">Toggle {category.name} subcategories</span>
                            </Button>
                          </CollapsibleTrigger>
                        )}
                      </div>
                      {category.subcategories.length > 0 && (
                        <CollapsibleContent className="overflow-hidden transition-all duration-200 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                          <div className="ml-8 border-l border-sidebar-border pl-2">
                            {category.subcategories.map((subcategory) => (
                              <SidebarMenuButton key={subcategory.id} asChild size="sm">
                                <Link
                                  to="/catalog"
                                  search={{
                                    category: category.id,
                                    subcategory: subcategory.id,
                                    q: undefined,
                                    ringFilter: undefined,
                                    trending: undefined,
                                    labGrown: undefined,
                                  }}
                                  activeOptions={{ includeSearch: true }}
                                  activeProps={{
                                    className: "text-sidebar-primary font-medium",
                                  }}
                                >
                                  <span>{subcategory.name}</span>
                                </Link>
                              </SidebarMenuButton>
                            ))}
                          </div>
                        </CollapsibleContent>
                      )}
                      {category.subcategories.length > 0 && collapsed && (
                        <div
                          className={`absolute left-full top-0 z-50 w-56 pl-2 transition-all duration-200 ${
                            openCategoryId === category.id
                              ? "pointer-events-auto translate-x-0 opacity-100"
                              : "pointer-events-none translate-x-1 opacity-0"
                          }`}
                        >
                          <div className="rounded-lg border border-sidebar-border bg-sidebar p-2 shadow-xl">
                            <p className="px-2 pb-2 text-xs font-semibold tracking-[0.14em] text-sidebar-primary uppercase">
                              {category.name}
                            </p>
                            <div className="space-y-0.5">
                              {category.subcategories.map((subcategory) => (
                                <Link
                                  key={subcategory.id}
                                  to="/catalog"
                                  search={{
                                    category: category.id,
                                    subcategory: subcategory.id,
                                    q: undefined,
                                    ringFilter: undefined,
                                    trending: undefined,
                                    labGrown: undefined,
                                  }}
                                  className="block rounded-md px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                >
                                  {subcategory.name}
                                </Link>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Lab Grown Diamond">
                  <Link
                    to="/catalog"
                    search={{
                      labGrown: true,
                      looseDiamonds: undefined,
                      category: undefined,
                      q: undefined,
                      ringFilter: undefined,
                      trending: undefined,
                    }}
                    activeOptions={{ exact: true, includeSearch: true }}
                    activeProps={quietActiveProps}
                  >
                    <Diamond className="h-4 w-4" />
                    <span>Lab Grown Diamond</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Loose Diamonds">
                  <Link
                    to="/catalog"
                    search={{
                      labGrown: undefined,
                      looseDiamonds: true,
                      category: undefined,
                      q: undefined,
                      ringFilter: undefined,
                      trending: undefined,
                    }}
                    activeOptions={{ exact: true, includeSearch: true }}
                    activeProps={quietActiveProps}
                  >
                    <Diamond className="h-4 w-4" />
                    <span>Loose Diamonds</span>
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
