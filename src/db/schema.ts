import {
  foreignKey,
  index,
  jsonb,
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

export const complianceSourceDocuments = pgTable(
  'compliance_source_documents',
  {
    id: text('id').primaryKey(),
    url: text('url').notNull(),
    title: text('title').notNull(),
    sourceType: text('source_type').notNull(),
    authority: text('authority'),
    jurisdiction: text('jurisdiction').notNull().default('US'),
    productCategory: text('product_category').notNull().default('dietary_supplement'),
    contentMarkdown: text('content_markdown').notNull(),
    contentHash: text('content_hash'),
    status: text('status', { enum: ['approved', 'pending', 'rejected'] })
      .default('approved')
      .notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (t) => [
    index('compliance_source_documents_authority_idx').on(t.authority),
    index('compliance_source_documents_source_type_idx').on(t.sourceType),
    index('compliance_source_documents_status_idx').on(t.status),
    unique('compliance_source_documents_url_key').on(t.url),
  ],
)

export const productApprovedClaims = pgTable(
  'product_approved_claims',
  {
    id: text('id').primaryKey(),
    productId: uuid('product_id').notNull(),
    orgId: text('org_id').notNull(),
    claimText: text('claim_text').notNull(),
    claimType: text('claim_type').notNull().default('structure_function'),
    status: text('status', { enum: ['proposed', 'approved', 'rejected'] })
      .default('proposed')
      .notNull(),
    rationale: text('rationale').notNull().default(''),
    reviewDecision: text('review_decision'),
    requiredDisclosures: jsonb('required_disclosures').$type<string[]>().notNull().default([]),
    forbiddenImplications: jsonb('forbidden_implications').$type<string[]>().notNull().default([]),
    markets: jsonb('markets').$type<string[]>().notNull().default(['US']),
    channels: jsonb('channels').$type<string[]>().notNull().default(['Website']),
    citations: jsonb('citations')
      .$type<
        Array<{
          documentId?: string
          title?: string
          authority?: string
          sourceType?: string
          url?: string
        }>
      >()
      .notNull()
      .default([]),
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
        'compliance_workflow',
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
