# Jewel Brillance NYC — Wholesale Catalog

A private, login-only wholesale jewelry catalog with a customer side and a full admin panel. Clean, white background, navy accents, minimal, mobile-friendly. No public storefront, no cart checkout, no payments.

## Backend (Lovable Cloud)

Enable Lovable Cloud for database, authentication, file storage, and email sending.

Tables (all with row-level security):
- `customers` — name, company, email, phone, username, active, created_at, linked auth user
- `user_roles` — separate role table (`admin`, `customer`); roles never stored on the profile
- `categories` — name, active, display_order (seeded: Rings, Earrings, Bracelets, Pendants, Necklaces, Bangles)
- `products` — category_id, style_number, product_name, description, metal, diamond_type, carat_weight, wholesale_price, active, created_at
- `product_images` — product_id, image_url, image_order, is_primary (max 20 per product, enforced server-side)
- `orders` — order_number (JB-000001, auto-incrementing), customer_id, customer_name, company, email, phone, notes, status, total_quantity, total_value, created_at
- `order_items` — order_id, product_id, style_number, product_name, quantity, unit_price, total_price
- `settings` — wholesale_email, company_name (admin-editable, never hard-coded)

Storage: a `product-images` bucket, admin-write, readable by signed-in users.

Security rules:
- Passwords are handled by the managed auth system — never stored as plain text.
- Customers can read only active products/images/categories, and only their own orders.
- Only admins can read/write customers, settings, all orders, and products.
- Inactive customers are blocked at login.

## Customer experience

1. **Login page** — username + password (username resolved to the account behind the scenes). Branded, minimal. No public sign-up; accounts are created by admin only.
2. **Catalog** — header "Jewel Brillance NYC", nav: All, Rings, Earrings, Bracelets, Pendants, Necklaces, Bangles, My Order. Search box matching Style Number or Product Name.
3. **Grid cards** — main image, style number, product name, wholesale price, Add to Order.
4. **Product page** — large gallery with thumbnails, swipeable on mobile, full specs (metal, diamond type, carat weight), price, quantity + Add to Order.
5. **My Catalog Order** — line items with increase/decrease/remove; totals for Total Styles, Total Quantity, Estimated Wholesale Total. Persisted per customer so it survives reloads.
6. **Submit Catalog Order** — form for Customer Name, Company, Email, Phone, Notes (prefilled from the account). Creates the order + items, assigns order number, clears the list, shows a confirmation with the order number.

## Emails

On submission, two emails go out: a full order email to the wholesale address from Settings, and a confirmation to the customer. Both include order number, customer/company/email/phone, and a table of style number, product, category, quantity, wholesale price, line total, plus notes and grand total.

## Admin panel

Separate `/admin` area, admin-only, redirects everyone else.

- **Dashboard** — counts of products, customers, new orders, recent orders.
- **Products** — list with search/filter by category and status; add/edit/delete; activate/deactivate; change category; image manager (multi-upload, delete, drag to reorder, set main image, "Images: 8 / 20" counter with hard 20 cap).
- **Categories** — add/edit, activate/deactivate, reorder.
- **Customers** — add, edit, delete, change/reset password, activate/deactivate. Customer credentials are never exposed to other customers.
- **Orders** — table of order number, customer, company, date, total styles, total quantity, estimated value, status; detail view with all selected styles; status changes across New, Reviewing, Confirmed, Completed, Cancelled.
- **Settings** — wholesale email address and company name.

## Design

White background, navy blue accents, generous whitespace, serif display for the wordmark, clean sans for everything else. No heavy animation, no e-commerce clutter. Fully responsive; catalog grid and gallery tuned for phone use.

## Technical notes

- TanStack Start routes: `/login`, `/catalog`, `/catalog/$style`, `/my-order`, and `/admin/*`.
- All privileged writes (customer creation, password reset, order submission, email sending, image cap enforcement) run in server functions that verify the caller's role — never trusted from the browser.
- Order numbers generated atomically in the database to avoid duplicates.
- The first admin account is created during setup so you can log in immediately.

## Build order

1. Cloud enablement, schema, policies, seed categories.
2. Auth + login page + route protection.
3. Admin: categories, products, image manager.
4. Customer catalog, product page, search.
5. My Catalog Order + submission + order numbering.
6. Emails + Settings.
7. Admin customers, orders, dashboard.
8. Mobile polish and final pass.
