# Jewel Brillance NYC — Wholesale Catalog Build Plan

A private, login-only wholesale jewelry catalog: customer catalog + full admin panel. No public storefront, no cart checkout, no payments. Clean, white, navy accents, luxury minimal, mobile-first.

## Backend (Lovable Cloud)

Enable Lovable Cloud for database, authentication, image storage, and email.

Tables:
- `customers` — id, name, company, email, phone, username, active, created_at, linked auth account (passwords handled by managed auth, never stored in this table, never plain text)
- `user_roles` — separate role table (`admin`, `customer`); roles never stored on the customer row
- `categories` — id, name, active, display_order — seeded with Rings, Earrings, Bracelets, Pendants, Necklaces, Bangles
- `products` — id, category_id, style_number, product_name, description, metal, diamond_type, carat_weight, wholesale_price, active, created_at
- `product_images` — id, product_id, image_url, image_order, is_primary (hard cap of 20 per product enforced in the database)
- `orders` — id, order_number, customer_id, customer_name, company, email, phone, notes, status, total_quantity, total_value, created_at
- `order_items` — id, order_id, product_id, style_number, product_name, quantity, unit_price, total_price
- `settings` — id, wholesale_email, company_name

Storage: `product-images` bucket — admin writes, signed-in users read.

Security (row-level policies on every table):
- Customers read only active categories, active products, and their images. Nothing else.
- Customers can read only their own orders; they never see other customers, other orders, settings, or the admin panel.
- Only admins read/write customers, settings, all orders, all products, categories, images.
- Inactive customers are blocked at login and cannot load the catalog.
- Order numbers (JB-000001) generated atomically in the database so they never duplicate.

## Customer side

1. **Login page** — username + password, branded. No self sign-up; only admin creates accounts. Inactive accounts get a clear "account inactive" message.
2. **Catalog** — header "Jewel Brillance NYC"; nav: All, Rings, Earrings, Bracelets, Pendants, Necklaces, Bangles, My Order. Search box matching Style Number or Product Name. Logout in the header.
3. **Grid cards** — main image, style number, product name, wholesale price, Add to Order.
4. **Style page** — large gallery with thumbnails, swipeable on mobile; style number, product name, specs (category, metal, diamond type, carat weight), description, wholesale price, quantity + Add to Order.
5. **My Catalog Order** — list of selected styles with increase / decrease / remove; shows Total Styles, Total Quantity, Estimated Wholesale Total. Saved per customer so it survives reloads and devices.
6. **Submit Catalog Order** — form for Customer Name, Company Name, Email, Phone, Notes (prefilled from the account). Creates the order + items, assigns JB-000001 style number, clears the list, shows a confirmation with the order number.

## Email

On submit, two emails send automatically:
- To the wholesale address from Settings: header "Jewel Brillance NYC — Wholesale Catalog Order", order number, customer name, company, email, phone, then a table of Style Number, Product, Category, Quantity, Wholesale Price, Total — plus customer notes and grand total.
- Confirmation copy to the customer.

The address always comes from Settings — never hard-coded.

## Admin panel

Separate `/admin` area; anyone who isn't an admin is redirected out.

- **Dashboard** — counts of products, active customers, new orders; recent orders list.
- **Products** — searchable list, filter by category and active status; add / edit / delete style; activate/deactivate; change category; all style fields from the spec.
- **Image manager** (inside product edit) — multi-file upload, delete, drag to reorder, set main image, live "Images: 8 / 20" counter, uploads blocked past 20.
- **Categories** — add, edit, activate/deactivate, set display order.
- **Customers** — add, edit, delete, change/reset password, activate/deactivate. Credentials never exposed to other customers.
- **Orders** — table with Order Number, Customer, Company, Date, Total Styles, Total Quantity, Estimated Value, Status; detail view listing every selected style; status set to New, Reviewing, Confirmed, Completed or Cancelled.
- **Settings** — wholesale email address and company name.

## Design

White background, navy blue accents, generous whitespace, a refined serif wordmark with a clean sans for everything else. No animation flourishes, no e-commerce clutter, large tap targets, fast on phones.

## Technical notes

- Routes: `/login`, `/catalog`, `/catalog/$style`, `/my-order`, `/admin`, `/admin/products`, `/admin/categories`, `/admin/customers`, `/admin/orders`, `/admin/settings`.
- Username login is mapped to the managed auth system behind the scenes so passwords stay hashed; admin-issued password resets go through a server-side admin action.
- Every privileged action (creating customers, resetting passwords, submitting orders, sending email, enforcing the 20-image cap) runs server-side with the caller's role verified — never trusted from the browser.
- The first admin account is created during setup so you can log in and start uploading immediately.

## Build order

1. Cloud, schema, policies, seed the six categories, create admin account.
2. Auth + login page + route protection (customer vs admin).
3. Admin: categories, products, image manager.
4. Customer catalog, category nav, search, style page gallery.
5. My Catalog Order + submission + order numbering.
6. Settings + both emails.
7. Admin customers, orders + statuses, dashboard.
8. Mobile pass and final polish.
