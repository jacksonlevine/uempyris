CREATE TYPE "public"."market_research_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "brand_ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"status" "market_research_status" DEFAULT 'pending' NOT NULL,
	"content" text,
	"trigger_run_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_kb" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"path" text NOT NULL,
	"content" text NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_kb_brand_path_uq" UNIQUE("brand_id","path")
);
--> statement-breakpoint
CREATE TABLE "brand" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_research" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"status" "market_research_status" DEFAULT 'pending' NOT NULL,
	"content" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_approved_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"org_id" text NOT NULL,
	"claim_text" text NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"generated_by" text DEFAULT 'workflow' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "product_facts" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"org_id" text NOT NULL,
	"category" text NOT NULL,
	"statement" text NOT NULL,
	"source" text NOT NULL,
	"source_excerpt" text,
	"confidence" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_ingestion_runs" ADD CONSTRAINT "brand_ingestion_runs_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_ingestion_runs" ADD CONSTRAINT "brand_ingestion_runs_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_kb" ADD CONSTRAINT "brand_kb_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_research" ADD CONSTRAINT "market_research_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_approved_claims" ADD CONSTRAINT "product_approved_claims_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_facts" ADD CONSTRAINT "product_facts_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brand_ingestion_runs_org_idx" ON "brand_ingestion_runs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "brand_ingestion_runs_brand_idx" ON "brand_ingestion_runs" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "brand_ingestion_runs_product_idx" ON "brand_ingestion_runs" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "brand_ingestion_runs_status_idx" ON "brand_ingestion_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "brand_kb_org_idx" ON "brand_kb" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "brand_org_idx" ON "brand" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "market_research_org_idx" ON "market_research" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "market_research_product_idx" ON "market_research" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_approved_claims_product_idx" ON "product_approved_claims" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_approved_claims_org_idx" ON "product_approved_claims" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "product_approved_claims_status_idx" ON "product_approved_claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_facts_product_idx" ON "product_facts" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_facts_org_idx" ON "product_facts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "product_org_idx" ON "product" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "product_brand_idx" ON "product" USING btree ("brand_id");