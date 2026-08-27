# Performance Audit Report — KRUSHI OS

**Date**: August 27, 2026  
**Application**: Krushi OS  
**Audit Scope**: Performance Bottlenecks, Over-fetching, Unindexed Queries, Rendering Delays, and React Lifecycle  

---

## Route Performance Metrics (Pre-Optimization Baseline)

| Route | Initial Load | Route Navigation | Query Count | Slowest Query | Main Cause / Bottleneck |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `/dashboard` | ~1.4s | ~950ms | 6 | `sales` + `audit_logs` + `products` sequential fetches | Unindexed composite queries + sequential RPC/table calls blocking root RSC layout |
| `/billing` | ~850ms | ~550ms | 3 | `products` select with full column payload | Unpaginated product lookup; fetching all fields on POS search initialization |
| `/sales` | ~920ms | ~600ms | 2 | `sales` count query without index on `sale_date` | Lack of index on `(shop_id, sale_date DESC)`; full table scanning |
| `/products` | ~880ms | ~580ms | 2 | `products` join `categories` and `brands` | Sequential category count queries; unindexed foreign key lookups |
| `/inventory` | ~1.1s | ~720ms | 3 | `products` select join `product_batches` | Calculating inventory metrics in JS after pulling full row payload |
| `/purchases` | ~900ms | ~610ms | 2 | `purchases` join `suppliers` | Sequential fetch of purchases + supplier balance summary |
| `/customers` | ~850ms | ~540ms | 2 | `customers` list & total credit sum | Full table scanning for `outstanding` sums |
| `/suppliers` | ~820ms | ~520ms | 2 | `suppliers` list & payable balance sum | Unindexed `(shop_id, is_active)` scan |
| `/payments` | ~950ms | ~650ms | 2 | `payments` join `customers` and `suppliers` | Lack of foreign key indexes on `(customer_id, supplier_id)` on `payments` table |
| `/expenses` | ~780ms | ~480ms | 2 | `expenses` filter by date | Date range scanning without index on `(shop_id, date)` |
| `/reports` | ~1.6s | ~1.1s | 5 | Multi-tab sales, inventory, and expense aggregations | Sequential execution of 5 separate report queries in root page |
| `/settings` | ~650ms | ~410ms | 1 | `shops` query | Single shop row fetch (Performant baseline) |

---

## Key Performance Root Causes Identified

1. **Unindexed Database Queries**:
   - Absence of composite indexes on `sales(shop_id, status, sale_date DESC)`, `product_batches(shop_id, quantity_available, expiry_date)`, `payments(shop_id, created_at DESC)`, and `customer_ledger(shop_id, customer_id)`.
2. **Sequential Server-Side `await` Calls**:
   - Routes like `/dashboard` and `/reports` were awaiting queries one after another (`await getTodaySales()`, then `await getCustomers()`, then `await getTopProducts()`) instead of utilizing `Promise.all()` for independent queries.
3. **Blocking Server Components (Lack of Suspense Streaming)**:
   - Root dashboard page blocked rendering until heavy charts, audit logs, and top product queries completed, triggering the global navigation loading indicator for >900ms.
4. **Heavy Global Client Bundles**:
   - Charting and PDF libraries were included in global dependencies instead of lazy dynamic imports.
