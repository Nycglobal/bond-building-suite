# Sidebar Dashboard Layout — Admin & Customer

Replace the current top-nav layouts with a proper collapsible sidebar dashboard on both sides, using the existing shadcn sidebar component so the navy/ivory premium look stays intact.

## Shared behaviour

- Fixed left sidebar with brand mark at top, nav links in the middle, sign-out at the bottom.
- Collapse/expand toggle icon in the header bar — collapsed state shows an icon-only mini rail (never disappears).
- Active link is highlighted; clicking a link routes and filters the right-hand page content.
- On mobile the sidebar becomes a slide-over sheet opened by the same toggle icon.
- Collapsed/expanded state persists across pages.

## Admin side

Sidebar sections with icons:
- Dashboard, Products, Categories, Customers, Orders, Settings

Right pane keeps each page's existing content, now inside a header bar showing the page title plus the toggle icon and sign-out.

## Customer side

Sidebar sections with icons:
- All Jewelry
- Categories group (Rings, Earrings, Necklaces, Bracelets, Pendants, Sets — loaded live from the database)
- My Catalog Order, with the item-count badge

Clicking a category link filters the catalog grid on the right (drives the existing `?category=` search param), so the page updates in place instead of navigating to a new layout. The company name stays visible in the header bar.

## Technical notes

- Use `SidebarProvider`, `Sidebar collapsible="icon"`, `SidebarTrigger`, and `SidebarInset` from `src/components/ui/sidebar.tsx`.
- Rewrite `src/components/AdminShell.tsx` and `src/components/CustomerShell.tsx` to render the sidebar + inset; page routes keep calling the same shells so no route files change.
- Add `src/components/AdminSidebar.tsx` and `src/components/CustomerSidebar.tsx`.
- Keep the existing `useCategories` / `useCartCount` queries; move them into the customer sidebar.
- Ensure sidebar width classes use explicit `var(--sidebar-width)` syntax for Tailwind 4.
- Icons from `lucide-react`; colors from existing semantic tokens only.
