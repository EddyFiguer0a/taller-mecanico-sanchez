-- ================================================================
-- TALLER MASTER — Production PostgreSQL / Supabase Schema
-- Phase 2 Backend Blueprint
--
-- Instructions:
--   1. Open your Supabase project dashboard.
--   2. Navigate to SQL Editor → New Query.
--   3. Paste this entire file and click "Run".
--   4. All tables, indexes, RLS policies, and the storage bucket
--      will be created in a single pass.
--
-- Run order matters — do NOT reorder the CREATE TABLE blocks.
-- ================================================================

-- ── Extension ──────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ================================================================
-- TABLES
-- ================================================================

-- ── 1. customers ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id          UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  full_name   TEXT        NOT NULL,
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  city        TEXT,
  state       TEXT,
  zip         TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.customers IS
  'One record per vehicle owner / shop customer.';


-- ── 2. vehicles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicles (
  id              UUID  DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id     UUID  NOT NULL
                        REFERENCES public.customers(id) ON DELETE CASCADE,
  license_plate   TEXT  NOT NULL,
  make            TEXT,
  model           TEXT,
  year            INT   CHECK (year BETWEEN 1885 AND 2100),
  vin             TEXT,
  color           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Case-insensitive UNIQUE index — prevents duplicate plates regardless of case
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_license_plate_ci_idx
  ON public.vehicles (LOWER(TRIM(license_plate)));

-- Foreign-key lookup index
CREATE INDEX IF NOT EXISTS vehicles_customer_id_idx
  ON public.vehicles (customer_id);

COMMENT ON TABLE public.vehicles IS
  'One record per vehicle. License plate is unique (case-insensitive).';
COMMENT ON COLUMN public.vehicles.license_plate IS
  'Stored normalized (lowercase, trimmed) by the application layer.';


-- ── 3. invoices_services ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices_services (
  id                UUID    DEFAULT uuid_generate_v4() PRIMARY KEY,
  vehicle_id        UUID    NOT NULL
                            REFERENCES public.vehicles(id) ON DELETE CASCADE,
  invoice_number    TEXT    NOT NULL,           -- e.g. 'INV-0042'
  date              DATE    NOT NULL DEFAULT CURRENT_DATE,
  service_type      TEXT    NOT NULL
                            CHECK (service_type IN ('estimate', 'final_invoice')),
  payment_method    TEXT,                       -- 'Cash' | 'Check' | 'Visa/MC' | 'AMEX' | 'Other'
  mileage_in        INT,
  mileage_out       INT,
  subtotal          NUMERIC(10,2) DEFAULT 0,
  tax               NUMERIC(10,2) DEFAULT 0,
  total_amount      NUMERIC(10,2) DEFAULT 0,
  deposit_paid      NUMERIC(10,2) DEFAULT 0,
  remaining_balance NUMERIC(10,2) DEFAULT 0,
  remarks           TEXT,
  technician_name   TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS invoices_vehicle_id_idx
  ON public.invoices_services (vehicle_id);

CREATE INDEX IF NOT EXISTS invoices_date_idx
  ON public.invoices_services (date DESC);

COMMENT ON TABLE public.invoices_services IS
  'Each service visit / invoice linked to a vehicle.';
COMMENT ON COLUMN public.invoices_services.service_type IS
  'estimate = Cotización (no commitment); final_invoice = completed work order.';


-- ── 4. invoice_items ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id          UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id  UUID        NOT NULL
                          REFERENCES public.invoices_services(id) ON DELETE CASCADE,
  qty         NUMERIC(10,2) NOT NULL DEFAULT 1,
  part_number TEXT,
  description TEXT        NOT NULL,
  unit_price  NUMERIC(10,2) NOT NULL DEFAULT 0,
  total       NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx
  ON public.invoice_items (invoice_id);

COMMENT ON TABLE public.invoice_items IS
  'Line-items (parts + labor rows) belonging to an invoice.';


-- ── 5. invoice_attachments ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_attachments (
  id          UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id  UUID        NOT NULL
                          REFERENCES public.invoices_services(id) ON DELETE CASCADE,
  file_url    TEXT        NOT NULL,             -- Supabase Storage public/signed URL
  file_type   TEXT,                             -- e.g. 'image/jpeg', 'application/pdf'
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS attachments_invoice_id_idx
  ON public.invoice_attachments (invoice_id);

COMMENT ON TABLE public.invoice_attachments IS
  'Photos or scanned copies of the physical invoice sheet.';


-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- All tables are locked down to authenticated shop staff only.
-- ================================================================

ALTER TABLE public.customers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices_services   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_attachments ENABLE ROW LEVEL SECURITY;


-- ── customers RLS ──────────────────────────────────────────────
CREATE POLICY "customers_select" ON public.customers
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "customers_insert" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "customers_update" ON public.customers
  FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "customers_delete" ON public.customers
  FOR DELETE TO authenticated
  USING (auth.role() = 'authenticated');


-- ── vehicles RLS ───────────────────────────────────────────────
CREATE POLICY "vehicles_select" ON public.vehicles
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "vehicles_insert" ON public.vehicles
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "vehicles_update" ON public.vehicles
  FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "vehicles_delete" ON public.vehicles
  FOR DELETE TO authenticated
  USING (auth.role() = 'authenticated');


-- ── invoices_services RLS ──────────────────────────────────────
CREATE POLICY "invoices_select" ON public.invoices_services
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "invoices_insert" ON public.invoices_services
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "invoices_update" ON public.invoices_services
  FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "invoices_delete" ON public.invoices_services
  FOR DELETE TO authenticated
  USING (auth.role() = 'authenticated');


-- ── invoice_items RLS ──────────────────────────────────────────
CREATE POLICY "invoice_items_select" ON public.invoice_items
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "invoice_items_insert" ON public.invoice_items
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "invoice_items_update" ON public.invoice_items
  FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "invoice_items_delete" ON public.invoice_items
  FOR DELETE TO authenticated
  USING (auth.role() = 'authenticated');


-- ── invoice_attachments RLS ────────────────────────────────────
CREATE POLICY "attachments_select" ON public.invoice_attachments
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "attachments_insert" ON public.invoice_attachments
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "attachments_update" ON public.invoice_attachments
  FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "attachments_delete" ON public.invoice_attachments
  FOR DELETE TO authenticated
  USING (auth.role() = 'authenticated');


-- ================================================================
-- SUPABASE STORAGE BUCKET
-- Private bucket for invoice photo snapshots.
-- ================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-invoices',          -- bucket id
  'shop-invoices',          -- display name
  false,                    -- private (not publicly accessible)
  10485760,                 -- 10 MB max file size
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic','application/pdf']
)
ON CONFLICT (id) DO NOTHING;


-- Storage object policies (require authenticated session)
CREATE POLICY "shop_invoices_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'shop-invoices'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "shop_invoices_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'shop-invoices'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "shop_invoices_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'shop-invoices'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "shop_invoices_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'shop-invoices'
    AND auth.role() = 'authenticated'
  );


-- ================================================================
-- DONE
-- Schema, indexes, RLS, and storage bucket are ready.
-- Next steps:
--   1. Create a Supabase Auth user for the mechanic/owner.
--   2. In your React app, replace VEHICULOS_MOCK with Supabase
--      queries using the @supabase/supabase-js client.
--   3. Use supabase.storage.from('shop-invoices').upload() to
--      store invoice photo snapshots.
-- ================================================================
