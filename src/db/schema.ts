import {
  foreignKey,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

export const brands = pgTable(
  'brands',
  {
    id: serial('id').primaryKey(),
    organizationId: text('organization_id').notNull(), // WorkOS "org_..." — WorkOS is the source of truth for orgs
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (t) => [
    index('brands_org_idx').on(t.organizationId),
    // Unique pair required so products can composite-FK against it.
    unique('brands_id_org_key').on(t.id, t.organizationId),
  ],
)

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    brandId: integer('brand_id').notNull(),
    organizationId: text('organization_id').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (t) => [
    index('products_brand_idx').on(t.brandId),
    index('products_org_idx').on(t.organizationId),
    // Composite FK: a product's org must match its brand's org — Postgres
    // rejects cross-tenant rows even if application code has a bug.
    foreignKey({
      columns: [t.brandId, t.organizationId],
      foreignColumns: [brands.id, brands.organizationId],
    }).onDelete('cascade'),
  ],
)
