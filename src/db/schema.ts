import {
  foreignKey,
  index,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

export const marketResearchStatus = pgEnum('market_research_status', [
  'pending',
  'running',
  'completed',
  'failed',
])

export const brands = pgTable(
  'brand',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: text('org_id').notNull(),
    name: text('name').notNull(),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { mode: 'string', withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('brand_org_idx').on(t.orgId),
  ],
)

export const productApprovedClaims = pgTable(
  'product_approved_claims',
  {
    id: text('id').primaryKey(),
    productId: uuid('product_id').notNull(),
    orgId: text('org_id').notNull(),
    claimText: text('claim_text').notNull(),
    status: text('status', { enum: ['proposed', 'approved', 'rejected'] })
      .default('proposed')
      .notNull(),
    generatedBy: text('generated_by').notNull().default('workflow'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    reviewedAt: timestamp('reviewed_at', { mode: 'string' }),
  },
  (t) => [
    index('product_approved_claims_product_idx').on(t.productId),
    index('product_approved_claims_org_idx').on(t.orgId),
    index('product_approved_claims_status_idx').on(t.status),
    foreignKey({
      columns: [t.productId],
      foreignColumns: [products.id],
    }).onDelete('cascade'),
  ],
)

export const products = pgTable(
  'product',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: text('org_id').notNull(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { mode: 'string', withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('product_org_idx').on(t.orgId),
    index('product_brand_idx').on(t.brandId),
  ],
)

export const brandKb = pgTable(
  'brand_kb',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: text('org_id').notNull(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    content: text('content').notNull(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    createdAt: timestamp('created_at', { mode: 'string', withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('brand_kb_org_idx').on(t.orgId),
    unique('brand_kb_brand_path_uq').on(t.brandId, t.path),
  ],
)

export const brandIngestionRuns = pgTable(
  'brand_ingestion_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: text('org_id').notNull(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    status: marketResearchStatus('status').notNull().default('pending'),
    content: text('content'),
    triggerRunId: text('trigger_run_id'),
    createdAt: timestamp('created_at', { mode: 'string', withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('brand_ingestion_runs_org_idx').on(t.orgId),
    index('brand_ingestion_runs_brand_idx').on(t.brandId),
    index('brand_ingestion_runs_product_idx').on(t.productId),
    index('brand_ingestion_runs_status_idx').on(t.status),
  ],
)

export const marketResearch = pgTable(
  'market_research',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: text('org_id').notNull(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    status: marketResearchStatus('status').notNull().default('pending'),
    content: text('content'),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { mode: 'string', withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('market_research_org_idx').on(t.orgId),
    index('market_research_product_idx').on(t.productId),
  ],
)

export const productFacts = pgTable(
  'product_facts',
  {
    id: serial('id').primaryKey(),
    productId: uuid('product_id').notNull(),
    orgId: text('org_id').notNull(),
    category: text('category').notNull(),
    statement: text('statement').notNull(),
    source: text('source', {
      enum: [
        'url',
        'form_label',
        'form_claims',
        'form_evidence',
        'form_brand_voice',
        'product_claims_workflow',
      ],
    }).notNull(),
    sourceExcerpt: text('source_excerpt'),
    confidence: real('confidence').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (t) => [
    index('product_facts_product_idx').on(t.productId),
    index('product_facts_org_idx').on(t.orgId),
    foreignKey({
      columns: [t.productId],
      foreignColumns: [products.id],
    }).onDelete('cascade'),
  ],
)
