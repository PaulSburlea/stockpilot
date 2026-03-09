-- ============================================================
-- StockPilot — Seed Data Realist (Accesorii Telefoane)
-- ============================================================
-- Parola tuturor utilizatorilor: admin123
--
-- INSTRUCȚIUNI:
--   1. Deschide Supabase Dashboard → SQL Editor
--   2. Lipește tot conținutul acestui fișier
--   3. Apasă Run
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── PASUL 1: Curățăm tot ──────────────────────────────────────────
TRUNCATE
  audit_logs, reorder_suggestions, stock_movements, sales,
  stock, transport_costs, location_settings,
  users, products, locations
RESTART IDENTITY CASCADE;

-- ── PASUL 2: Locații (7 locații — 2 standuri în București) ────────
INSERT INTO locations (name, type, city, address, lat, lng) VALUES
  ('Depozit Central București',   'warehouse', 'București',  'Șos. Giurgiului 120',             44.3890, 26.1220),
  ('Stand Mall Vitan',            'stand',     'București',  'Calea Vitan 55-59',               44.4150, 26.1340),
  ('Stand Mega Mall București',   'stand',     'București',  'Bd. Pierre de Coubertin 3-5',     44.4240, 26.1510),
  ('Stand Iulius Mall Cluj',      'stand',     'Cluj-Napoca','Str. Alexandru Vaida Voevod 53B',  46.7700, 23.6050),
  ('Stand Palas Mall Iași',       'stand',     'Iași',       'Str. Palas 7A',                    47.1560, 27.5890),
  ('Stand Iulius Mall Timișoara', 'stand',     'Timișoara',  'Str. Aristide Demetriade 1',       45.7700, 21.2370),
  ('Stand Electroputere Craiova', 'stand',     'Craiova',    'Calea Bucuresti 80',               44.3100, 23.8370);

-- ── PASUL 3: Produse (20 accesorii telefoane) ─────────────────────
INSERT INTO products (name, sku, category, unit_price, weight_kg) VALUES
  ('Husă Silicon iPhone 15 Pro Max',  'HUS-IP15PM-SIL', 'Huse',                   79.99,  0.050),
  ('Husă Silicon Samsung S24 Ultra',  'HUS-SS24U-SIL',  'Huse',                   69.99,  0.050),
  ('Husă MagSafe iPhone 15',          'HUS-IP15-MAG',   'Huse',                  129.99,  0.080),
  ('Husă Carbon Universală',          'HUS-UNI-CARB',   'Huse',                   49.99,  0.040),
  ('Husă Wallet iPhone 15 Pro',       'HUS-IP15P-WAL',  'Huse',                   99.99,  0.065),
  ('Folie Sticlă iPhone 15 Pro',      'FOL-IP15P-TG',   'Folii Protecție',        39.99,  0.020),
  ('Folie UV Samsung S24 Ultra',      'FOL-SS24U-UV',   'Folii Protecție',        59.99,  0.030),
  ('Folie Mată Universală',           'FOL-UNI-MAT',    'Folii Protecție',        19.99,  0.010),
  ('Protecție Lentilă Camera iPhone', 'FOL-IP15-CAM',   'Folii Protecție',        24.99,  0.005),
  ('Cablu USB-C Lightning 1m',        'CAB-UCL-1M',     'Cabluri & Încărcătoare', 49.99,  0.030),
  ('Cablu USB-C to USB-C 2m',         'CAB-UCUC-2M',    'Cabluri & Încărcătoare', 39.99,  0.040),
  ('Cablu Magnetic 3-in-1',           'CAB-MAG-3IN1',   'Cabluri & Încărcătoare', 59.99,  0.045),
  ('Încărcător Rapid 20W USB-C',      'INC-20W-UC',     'Cabluri & Încărcătoare', 89.99,  0.120),
  ('Încărcător Wireless MagSafe',     'INC-WIR-MAG',    'Cabluri & Încărcătoare',149.99,  0.150),
  ('Baterie Externă 10000mAh',        'BAT-EXT-10K',    'Cabluri & Încărcătoare', 99.99,  0.220),
  ('Căști TWS Bluetooth Pro',         'AUD-TWS-PRO',    'Căști & Audio',         119.99,  0.080),
  ('Adaptor Jack 3.5mm Lightning',    'AUD-JACK-35',    'Căști & Audio',          29.99,  0.010),
  ('Suport Auto Magnetic MagSafe',    'ACC-SUPORT-MAG', 'Accesorii',              69.99,  0.200),
  ('Suport Telefon Birou Reglabil',   'ACC-DESK-STD',   'Accesorii',              44.99,  0.350),
  ('PopSocket Premium',               'ACC-POP-PREM',   'Accesorii',              34.99,  0.020);

-- ── PASUL 4: Utilizatori (parola: admin123) ───────────────────────
INSERT INTO users (name, email, password, role, location_id) VALUES
  ('Alexandru Popescu', 'admin@stockpilot.ro',
    crypt('admin123', gen_salt('bf', 10)), 'admin', NULL),
  ('Maria Ionescu',     'depozit@stockpilot.ro',
    crypt('admin123', gen_salt('bf', 10)), 'warehouse_manager', 1),
  ('Andrei Stanescu',   'vitan@stockpilot.ro',
    crypt('admin123', gen_salt('bf', 10)), 'stand_manager', 2),
  ('Cristina Marinescu','megamall@stockpilot.ro',
    crypt('admin123', gen_salt('bf', 10)), 'stand_manager', 3),
  ('Elena Dumitrescu',  'cluj@stockpilot.ro',
    crypt('admin123', gen_salt('bf', 10)), 'stand_manager', 4),
  ('Mihai Popa',        'iasi@stockpilot.ro',
    crypt('admin123', gen_salt('bf', 10)), 'stand_manager', 5),
  ('Ana Radu',          'timisoara@stockpilot.ro',
    crypt('admin123', gen_salt('bf', 10)), 'stand_manager', 6);
-- Craiova (loc 7) nu are manager asignat

-- ── PASUL 5: Stocuri ─────────────────────────────────────────────
INSERT INTO stock (location_id, product_id, quantity, safety_stock) VALUES
-- ─── DEPOZIT CENTRAL (loc 1) ────────────────────────────────────
  (1, 1, 150, 20), (1, 2,  80, 20), (1, 3, 200, 20), (1, 4, 120, 20), (1, 5,  90, 20),
  (1, 6, 100, 20), (1, 7,  90, 20), (1, 8, 250, 20), (1, 9, 110, 15), (1,10,  60, 20),
  (1,11, 180, 20), (1,12,  75, 15), (1,13,  45, 20), (1,14,   8, 20), (1,15,  55, 15),
  (1,16,  70, 20), (1,17, 300, 20), (1,18,  55, 15), (1,19,  85, 15), (1,20,  95, 15),
  --                                                        ↑ prod 14 CRITIC în depozit!

-- ─── STAND VITAN (loc 2) — stand aglomerat, câteva critice ─────
  (2, 1,   3,  8),  -- ⚠️ CRITIC
  (2, 2,  12,  8),  -- scăzut
  (2, 3,  18,  6),  -- normal
  (2, 4,   7,  5),  -- scăzut
  (2, 5,  10,  5),  -- normal
  (2, 6,   2,  6),  -- ⚠️ CRITIC
  (2, 7,  10,  5),  -- normal
  (2, 8,  20,  5),  -- normal
  (2, 9,   8,  5),  -- normal
  (2,10,  45,  5),  -- surplus (tocmai primit transfer)
  (2,11,  14,  5),  -- normal
  (2,12,   6,  5),  -- scăzut
  (2,13,   9,  6),  -- scăzut
  (2,14,   6,  5),  -- scăzut
  (2,15,   4,  5),  -- ⚠️ CRITIC
  (2,16,  35,  5),  -- surplus
  (2,17,   8,  5),  -- normal
  (2,18,  15,  5),  -- surplus DAR niciodată vândut → NO TRACTION
  (2,19,   3,  5),  -- ⚠️ CRITIC
  (2,20,  10,  5),  -- normal

-- ─── STAND MEGA MALL (loc 3) — al doilea stand din București ────
  (3, 1,  14,  6),  -- normal
  (3, 2,   5,  6),  -- ⚠️ CRITIC
  (3, 3,  11,  5),  -- normal
  (3, 4,   8,  5),  -- normal
  (3, 5,  16,  5),  -- normal
  (3, 6,  10,  5),  -- normal
  (3, 7,   4,  5),  -- ⚠️ CRITIC
  (3, 8,  20,  5),  -- surplus, NICIODATĂ VÂNDUT → NO TRACTION
  (3, 9,  12,  5),  -- normal
  (3,10,   7,  5),  -- scăzut
  (3,11,   9,  5),  -- low
  (3,12,  14,  5),  -- normal
  (3,13,  11,  5),  -- normal
  (3,14,   8,  5),  -- normal
  (3,15,  13,  5),  -- normal
  (3,16,   3,  5),  -- ⚠️ CRITIC
  (3,17,   6,  5),  -- scăzut
  (3,18,   9,  5),  -- low
  (3,19,  10,  5),  -- normal
  (3,20,   7,  5),  -- scăzut

-- ─── STAND CLUJ (loc 4) — cu stoc mort și fără tracțiune ────────
  (4, 1,  22,  6),  -- normal
  (4, 2,  15,  6),  -- normal
  (4, 3,  20,  5),  -- STALE (ultima vânzare: ~75 zile)
  (4, 4,   8,  5),  -- normal
  (4, 5,  12,  5),  -- normal
  (4, 6,  14,  5),  -- normal
  (4, 7,   6,  5),  -- scăzut
  (4, 8,  18,  5),  -- NICIODATĂ VÂNDUT → NO TRACTION
  (4, 9,   9,  4),  -- normal
  (4,10,  10,  5),  -- normal
  (4,11,   7,  5),  -- scăzut
  (4,12,   5,  5),  -- la safety → critic
  (4,13,  12,  5),  -- normal
  (4,14,   9,  5),  -- low
  (4,15,   6,  4),  -- normal
  (4,16,   5,  5),  -- la safety → critic
  (4,17,  12,  5),  -- normal
  (4,18,   6,  5),  -- scăzut
  (4,19,   4,  5),  -- ⚠️ CRITIC
  (4,20,   3,  5),  -- ⚠️ CRITIC

-- ─── STAND IAȘI (loc 5) — performant, dar cu goluri ─────────────
  (5, 1,  16,  6),  -- normal
  (5, 2,   2,  6),  -- ⚠️ CRITIC — vândut bine
  (5, 3,  14,  5),  -- normal
  (5, 4,  11,  5),  -- normal
  (5, 5,   6,  5),  -- scăzut
  (5, 6,  18,  5),  -- normal
  (5, 7,   8,  5),  -- normal
  (5, 8,   5,  5),  -- la safety → critic
  (5, 9,   7,  4),  -- normal
  (5,10,   5,  5),  -- la safety → critic
  (5,11,   9,  5),  -- low
  (5,12,   4,  5),  -- ⚠️ CRITIC
  (5,13,   1,  5),  -- ⚠️ CRITIC — aproape zero
  (5,14,   7,  5),  -- normal
  (5,15,  11,  5),  -- normal
  (5,16,  11,  5),  -- normal
  (5,17,  15,  5),  -- normal
  (5,18,   4,  5),  -- ⚠️ CRITIC
  (5,19,   8,  5),  -- normal
  (5,20,   8,  5),  -- normal

-- ─── STAND TIMIȘOARA (loc 6) — stoc mort vechi ──────────────────
  (6, 1,  14,  5),  (6, 2,  10,  5),  (6, 3,   8,  5),
  (6, 4,  28,  5),  -- surplus + STALE (~85 zile)
  (6, 5,   9,  5),  (6, 6,  12,  5),  (6, 7,   9,  5),  (6, 8,   7,  5),
  (6, 9,  11,  4),  (6,10,   7,  5),  (6,11,  20,  5),  (6,12,   5,  5),
  (6,13,   6,  5),
  (6,14,  22,  5),  -- surplus
  (6,15,   8,  5),  (6,16,   8,  5),  (6,17,  10,  5),  (6,18,   5,  5),
  (6,19,  12,  5),  (6,20,  12,  5),

-- ─── STAND CRAIOVA (loc 7) — stand mic, activitate redusă ──────
  (7, 1,   8,  5),  (7, 2,   6,  5),  (7, 3,   4,  5),  (7, 4,  10,  5),
  (7, 5,   5,  5),
  (7, 6,   7,  5),
  (7, 7,   3,  5),  -- ⚠️ CRITIC
  (7, 8,  12,  5),  -- NICIODATĂ VÂNDUT → NO TRACTION
  (7, 9,   6,  4),  (7,10,   5,  5),  (7,11,   8,  5),  (7,12,   3,  5),
  (7,13,   4,  5),  (7,14,   2,  5),
  (7,15,   6,  5),  (7,16,   3,  5),
  (7,17,  40,  5),  -- SURPLUS MARE + NICIODATĂ VÂNDUT → NO TRACTION
  (7,18,   6,  5),  (7,19,   4,  5),  (7,20,   6,  5);


-- ── PASUL 6: Costuri de transport ─────────────────────────────────
INSERT INTO transport_costs (from_location_id, to_location_id, cost_per_kg, fixed_cost, lead_time_days) VALUES
-- Depozit (1) → standuri
  (1, 2,  3.50, 15.00, 1),  -- → Vitan (același oraș)
  (1, 3,  3.50, 15.00, 1),  -- → Mega Mall (același oraș)
  (1, 4,  5.00, 35.00, 2),  -- → Cluj
  (1, 5,  5.50, 38.00, 2),  -- → Iași
  (1, 6,  5.00, 35.00, 2),  -- → Timișoara
  (1, 7,  4.00, 25.00, 1),  -- → Craiova
-- Standuri → depozit (returnări)
  (2, 1,  3.50, 15.00, 1),  (3, 1,  3.50, 15.00, 1),
  (4, 1,  5.00, 35.00, 2),  (5, 1,  5.50, 38.00, 2),
  (6, 1,  5.00, 35.00, 2),  (7, 1,  4.00, 25.00, 1),
-- Între standuri din București (foarte rapid)
  (2, 3,  2.00, 10.00, 1),  (3, 2,  2.00, 10.00, 1),
-- Inter-oraș
  (2, 4,  6.00, 40.00, 2),  (4, 2,  6.00, 40.00, 2),
  (2, 5,  6.50, 42.00, 3),  (5, 2,  6.50, 42.00, 3),
  (3, 4,  6.00, 40.00, 2),  (4, 3,  6.00, 40.00, 2),
  (3, 5,  6.50, 42.00, 3),  (5, 3,  6.50, 42.00, 3),
  (4, 5,  7.00, 45.00, 3),  (5, 4,  7.00, 45.00, 3),
  (4, 6,  4.50, 30.00, 2),  (6, 4,  4.50, 30.00, 2),
  (5, 6,  7.00, 42.00, 3),  (6, 5,  7.00, 42.00, 3),
  (6, 7,  5.00, 32.00, 2),  (7, 6,  5.00, 32.00, 2),
  (2, 7,  4.00, 25.00, 2),  (7, 2,  4.00, 25.00, 2),
  (3, 7,  4.00, 25.00, 2),  (7, 3,  4.00, 25.00, 2),
  (2, 6,  6.00, 38.00, 3),  (6, 2,  6.00, 38.00, 3);


-- ── PASUL 7: Setări per locație ───────────────────────────────────
INSERT INTO location_settings
  (location_id, lead_time_days, safety_stock_multiplier,
   reorder_threshold_days, surplus_threshold_days,
   max_transfer_qty, min_transfer_qty, auto_suggestions,
   stale_days_threshold, storage_capacity, max_transport_cost_ratio,
   notes, updated_by)
VALUES
  (1, 1, 1.0,  7, 45, 200, 10, true, 60, 9999, 0.30, 'Depozit central — fără limită de capacitate', 'System'),
  (2, 1, 1.2, 10, 40, 100,  5, true, 45,  500, 0.25, 'Stand cu trafic ridicat — prag mai strict', 'Alexandru Popescu'),
  (3, 1, 1.1, 10, 40, 100,  5, true, 50,  450, 0.25, 'Al doilea stand București', 'Alexandru Popescu'),
  (4, 2, 1.0,  7, 50, 100,  5, true, 60,  400, 0.25, NULL, 'System'),
  (5, 2, 1.0,  7, 45, 100,  5, true, 60,  400, 0.25, NULL, 'System'),
  (6, 2, 1.0,  7, 50, 100,  5, true, 60,  350, 0.20, 'Stand cu activitate medie', 'System'),
  (7, 1, 1.0, 14, 60,  80,  5, true, 90,  250, 0.30, 'Stand mic — prag stale mai generos', 'System');


-- ═══════════════════════════════════════════════════════════════════
-- PASUL 8: VÂNZĂRI (date realiste pe 90 zile)
-- ═══════════════════════════════════════════════════════════════════

-- ─── Prod 1 (Husă iPhone) ─ cel mai popular produs ──────────────
-- Vitan: vândut intens → stoc ajunge CRITIC
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 2, 1,
  (random()*2+2)::int, NOW() - (random()*25 || ' days')::interval FROM generate_series(1,22);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 2, 1,
  (random()*2+1)::int, NOW() - ((random()*30+30) || ' days')::interval FROM generate_series(1,15);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 2, 1,
  (random()*1+1)::int, NOW() - ((random()*30+60) || ' days')::interval FROM generate_series(1,10);
-- Mega Mall: vânzări bune
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 3, 1,
  (random()*2+1)::int, NOW() - (random()*40 || ' days')::interval FROM generate_series(1,16);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 3, 1,
  (random()*1+1)::int, NOW() - ((random()*30+40) || ' days')::interval FROM generate_series(1,10);
-- Cluj/Iași/Timișoara/Craiova: moderate
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 4, 1,
  (random()*2+1)::int, NOW() - (random()*60 || ' days')::interval FROM generate_series(1,14);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 5, 1,
  (random()*2+1)::int, NOW() - (random()*45 || ' days')::interval FROM generate_series(1,12);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 6, 1,
  (random()*1+1)::int, NOW() - (random()*60 || ' days')::interval FROM generate_series(1,10);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 7, 1,
  (random()*1+1)::int, NOW() - (random()*60 || ' days')::interval FROM generate_series(1,6);

-- ─── Prod 2 (Husă Samsung) ──────────────────────────────────────
-- Iași: vândut intens → CRITIC
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 5, 2,
  (random()*3+2)::int, NOW() - (random()*25 || ' days')::interval FROM generate_series(1,18);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 5, 2,
  (random()*2+1)::int, NOW() - ((random()*30+30) || ' days')::interval FROM generate_series(1,12);
-- Mega Mall: critice
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 3, 2,
  (random()*2+1)::int, NOW() - (random()*35 || ' days')::interval FROM generate_series(1,14);
-- Alte standuri: moderate
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 2, 2,
  (random()*1+1)::int, NOW() - (random()*60 || ' days')::interval FROM generate_series(1,10);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 4, 2,
  (random()*1+1)::int, NOW() - (random()*60 || ' days')::interval FROM generate_series(1,8);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 6, 2,
  (random()*1+1)::int, NOW() - (random()*60 || ' days')::interval FROM generate_series(1,6);

-- ─── Prod 3 (MagSafe) @ Cluj ─ STALE: vândut doar 70-90 zile în urmă ───
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 4, 3,
  (random()*2+1)::int, NOW() - ((random()*20+70) || ' days')::interval FROM generate_series(1,10);
-- Alte standuri: normal
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 2, 3,
  (random()*1+1)::int, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,8);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 3, 3,
  (random()*1+1)::int, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,6);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 5, 3,
  (random()*1+1)::int, NOW() - (random()*60 || ' days')::interval FROM generate_series(1,6);

-- ─── Prod 4 (Carbon) @ Timișoara ─ STALE: ultima vânzare ~85 zile ───
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 6, 4,
  (random()*2+1)::int, NOW() - ((random()*10+80) || ' days')::interval FROM generate_series(1,8);
-- Alte standuri: normal
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 2, 4,
  (random()*1+1)::int, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,5);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 5, 4,
  (random()*1+1)::int, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,5);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 7, 4,
  1, NOW() - (random()*40 || ' days')::interval FROM generate_series(1,3);

-- ─── Prod 5 (Wallet case) ─ moderat ─────────────────────────────
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 2, 5,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,6);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 3, 5,
  (random()*1+1)::int, NOW() - (random()*45 || ' days')::interval FROM generate_series(1,8);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 4, 5,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,5);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 5, 5,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,4);

-- ─── Prod 6 (Folie iPhone) ─ popular ────────────────────────────
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 2, 6,
  (random()*2+1)::int, NOW() - (random()*30 || ' days')::interval FROM generate_series(1,16);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 3, 6,
  (random()*1+1)::int, NOW() - (random()*45 || ' days')::interval FROM generate_series(1,10);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 4, 6,
  (random()*1+1)::int, NOW() - (random()*45 || ' days')::interval FROM generate_series(1,10);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 5, 6,
  (random()*1+1)::int, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,8);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 6, 6,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,6);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 7, 6,
  1, NOW() - (random()*60 || ' days')::interval FROM generate_series(1,4);

-- ─── Prod 7 (Folie UV Samsung) ──────────────────────────────────
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 2, 7,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,6);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 3, 7,
  1, NOW() - (random()*40 || ' days')::interval FROM generate_series(1,5);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 5, 7,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,5);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 6, 7,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,4);

-- ─── Prod 9 (Protecție lentilă) ─ moderat ───────────────────────
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 2, 9,
  1, NOW() - (random()*40 || ' days')::interval FROM generate_series(1,5);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 3, 9,
  1, NOW() - (random()*45 || ' days')::interval FROM generate_series(1,6);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 5, 9,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,4);

-- ─── Prod 10 (Cablu USB-C Lightning) ─ vânzări bune ─────────────
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 2, 10,
  (random()*1+1)::int, NOW() - (random()*60 || ' days')::interval FROM generate_series(1,12);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 3, 10,
  (random()*1+1)::int, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,8);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 4, 10,
  (random()*1+1)::int, NOW() - (random()*60 || ' days')::interval FROM generate_series(1,8);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 5, 10,
  (random()*2+1)::int, NOW() - (random()*45 || ' days')::interval FROM generate_series(1,10);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 6, 10,
  1, NOW() - (random()*60 || ' days')::interval FROM generate_series(1,5);

-- ─── Prod 12 (Cablu magnetic 3-in-1) ─ moderat ──────────────────
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 2, 12,
  1, NOW() - (random()*45 || ' days')::interval FROM generate_series(1,4);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 3, 12,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,5);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 5, 12,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,4);

-- ─── Prod 13 (Încărcător 20W) @ Iași ─ CRITIC ───────────────────
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 5, 13,
  (random()*2+1)::int, NOW() - (random()*30 || ' days')::interval FROM generate_series(1,14);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 5, 13,
  (random()*1+1)::int, NOW() - ((random()*30+30) || ' days')::interval FROM generate_series(1,8);
-- Moderat la alte standuri
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 2, 13,
  (random()*1+1)::int, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,7);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 3, 13,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,6);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 4, 13,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,5);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 6, 13,
  1, NOW() - (random()*60 || ' days')::interval FROM generate_series(1,4);

-- ─── Prod 14 (Wireless MagSafe) ─ puține dar valoroase ──────────
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 2, 14,
  1, NOW() - (random()*45 || ' days')::interval FROM generate_series(1,4);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 3, 14,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,3);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 6, 14,
  1, NOW() - (random()*60 || ' days')::interval FROM generate_series(1,3);

-- ─── Prod 15 (Baterie externă) ──────────────────────────────────
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 2, 15,
  1, NOW() - (random()*35 || ' days')::interval FROM generate_series(1,6);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 3, 15,
  1, NOW() - (random()*40 || ' days')::interval FROM generate_series(1,5);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 5, 15,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,4);

-- ─── Prod 16 (Căști TWS) ─ moderate ─────────────────────────────
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 2, 16,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,6);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 3, 16,
  1, NOW() - (random()*40 || ' days')::interval FROM generate_series(1,6);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 4, 16,
  1, NOW() - (random()*60 || ' days')::interval FROM generate_series(1,4);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 5, 16,
  1, NOW() - (random()*40 || ' days')::interval FROM generate_series(1,5);

-- ─── Prod 18 (Suport auto) ─ se vinde la Iași/Timișoara, NU la Vitan → no-traction Vitan
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 5, 18,
  1, NOW() - (random()*40 || ' days')::interval FROM generate_series(1,5);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 6, 18,
  1, NOW() - (random()*60 || ' days')::interval FROM generate_series(1,3);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 3, 18,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,4);

-- ─── Prod 19 (Suport birou) ─ moderat ───────────────────────────
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 2, 19,
  1, NOW() - (random()*30 || ' days')::interval FROM generate_series(1,5);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 3, 19,
  1, NOW() - (random()*40 || ' days')::interval FROM generate_series(1,4);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 5, 19,
  1, NOW() - (random()*45 || ' days')::interval FROM generate_series(1,4);

-- ─── Prod 20 (PopSocket) ────────────────────────────────────────
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 2, 20,
  1, NOW() - (random()*40 || ' days')::interval FROM generate_series(1,5);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 3, 20,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,4);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 4, 20,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,3);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 5, 20,
  1, NOW() - (random()*45 || ' days')::interval FROM generate_series(1,4);

-- ─── Craiova — vânzări puține ────────────────────────────────────
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 7, 2,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,3);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 7, 3,
  1, NOW() - (random()*60 || ' days')::interval FROM generate_series(1,2);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 7, 6,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,3);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 7, 7,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,2);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 7, 10,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,2);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 7, 13,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,2);
INSERT INTO sales (location_id, product_id, quantity, sold_at) SELECT 7, 20,
  1, NOW() - (random()*50 || ' days')::interval FROM generate_series(1,2);
-- NOTĂ: Prod 8/17 la Cluj/Craiova → ZERO vânzări = no-traction
-- NOTĂ: Prod 18 la Vitan → ZERO vânzări = no-traction


-- ═══════════════════════════════════════════════════════════════════
-- PASUL 9: MIȘCĂRI DE STOC
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO stock_movements
  (product_id, from_location_id, to_location_id, quantity, movement_type,
   status, transport_cost, notes, recommendation_reason, recommended_lead_time,
   accepted_at, picked_up_at, completed_at, created_at)
VALUES
-- 1. COMPLETED — depozit → Vitan (Cablu USB-C, 20 buc)
  (10, 1, 2,  20, 'transfer', 'completed', 15.60,
   'Reaprovizionare stand Vitan', 'Depozit central — 15.60 RON, 1z', 1,
   NOW()-INTERVAL '4 days', NULL, NOW()-INTERVAL '3 days', NOW()-INTERVAL '5 days'),

-- 2. IN_TRANSIT — depozit → Iași (Husă Samsung, 15 buc)
  (2, 1, 5,  15, 'transfer', 'in_transit', 38.83,
   'Reaprovizionare urgentă — stoc critic', 'Depozit central — 38.83 RON, 2z', 2,
   NOW()-INTERVAL '1 day', NULL, NULL, NOW()-INTERVAL '2 days'),

-- 3. AWAITING_PICKUP — Cluj trimite spre Vitan (Husă iPhone, 10 buc)
  (1, 4, 2,  10, 'transfer', 'awaiting_pickup', 40.50,
   'Surplus la Cluj, deficit la Vitan',
   'Transfer din Iulius Mall Cluj — 40.50 RON, 2z', 2,
   NOW()-INTERVAL '12 hours', NULL, NULL, NOW()-INTERVAL '1 day'),

-- 4. PENDING — cerere Mega Mall pt Folie UV Samsung
  (7, 1, 3,  12, 'transfer', 'pending', 15.30,
   'Cerere manuală din stand', 'Depozit central — 15.30 RON, 1z', 1,
   NULL, NULL, NULL, NOW()-INTERVAL '6 hours'),

-- 5. CANCELLED — cerere anulată
  (13, 1, 7,  10, 'transfer', 'cancelled', 25.48,
   'Cerere manuală | Anulat: Cantitate prea mică, nu justifică transportul',
   NULL, NULL, NULL, NULL, NULL, NOW()-INTERVAL '8 days'),

-- 6. SUPPLIER ORDER in transit — Wireless MagSafe spre depozit (stoc critic depozit)
  (14, NULL, 1,  50, 'supplier_order', 'in_transit', NULL,
   'Comandă furnizor — stoc critic în depozit (8 buc, minim 20)',
   'Comandă furnizor externă', NULL,
   NOW()-INTERVAL '2 days', NULL, NULL, NOW()-INTERVAL '3 days'),

-- 7. COMPLETED — transfer între standuri București (Vitan → Mega Mall)
  (6, 2, 3,  8, 'transfer', 'completed', 10.16,
   'Transfer intern București', 'Transfer rapid între standuri — 10.16 RON, 1z', 1,
   NOW()-INTERVAL '10 days', NULL, NOW()-INTERVAL '9 days', NOW()-INTERVAL '11 days');


-- ═══════════════════════════════════════════════════════════════════
-- PASUL 10: SUGESTII EXISTENTE
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO reorder_suggestions
  (product_id, from_location_id, to_location_id, suggested_qty, reason, estimated_cost, status)
VALUES
  (1, 1, 2, 25,
   '{"type":"deficit","urgencyTag":"[CRITIC]","destName":"Stand Mall Vitan","destCity":"București","productName":"Husă Silicon iPhone 15 Pro Max","daysRemaining":1,"dailySales":2.8,"soldLast30Days":68,"currentQty":3,"safetyStock":8}',
   15.88, 'pending'),
  (6, 1, 5, 20,
   '{"type":"deficit","urgencyTag":"[NORMAL]","destName":"Stand Palas Mall Iași","productName":"Folie Sticlă iPhone 15 Pro","daysRemaining":12}',
   38.40, 'approved'),
  (16, 2, 4, 10,
   '{"type":"surplus","sourceName":"Stand Mall Vitan","destName":"Stand Iulius Mall Cluj","productName":"Căști TWS Bluetooth Pro"}',
   40.80, 'rejected');


-- ═══════════════════════════════════════════════════════════════════
-- PASUL 11: AUDIT LOGS
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO audit_logs
  (user_id, user_name, user_email, user_role, action, entity, entity_id,
   description, metadata, ip_address, created_at)
VALUES
  (1, 'Alexandru Popescu', 'admin@stockpilot.ro', 'admin',
   'LOGIN', 'user', 1, 'Alexandru Popescu s-a autentificat',
   '{}', '192.168.1.10', NOW()-INTERVAL '2 hours'),

  (2, 'Maria Ionescu', 'depozit@stockpilot.ro', 'warehouse_manager',
   'ACCEPT', 'movement', 2,
   'Acceptat și expediat din depozit: 15 buc Husă Samsung → Iași',
   '{"from_location_id":1,"to_location_id":5,"source_type":"warehouse"}',
   '192.168.1.20', NOW()-INTERVAL '1 day'),

  (3, 'Andrei Stanescu', 'vitan@stockpilot.ro', 'stand_manager',
   'CREATE', 'sale', 150,
   'Vânzare înregistrată: 3 buc — Husă iPhone la Stand Vitan',
   '{"product_id":1,"location_id":2,"quantity":3,"new_stock":3}',
   '192.168.1.30', NOW()-INTERVAL '4 hours'),

  (4, 'Cristina Marinescu', 'megamall@stockpilot.ro', 'stand_manager',
   'CREATE', 'sale', 160,
   'Vânzare înregistrată: 2 buc — Husă Samsung la Stand Mega Mall',
   '{"product_id":2,"location_id":3,"quantity":2,"new_stock":5}',
   '192.168.1.35', NOW()-INTERVAL '5 hours'),

  (2, 'Maria Ionescu', 'depozit@stockpilot.ro', 'warehouse_manager',
   'CREATE', 'movement', 1,
   'Mișcare creată manual: 20 buc Cablu USB-C → Vitan',
   '{"from_location_id":1,"to_location_id":2,"quantity":20}',
   '192.168.1.20', NOW()-INTERVAL '5 days'),

  (2, 'Maria Ionescu', 'depozit@stockpilot.ro', 'warehouse_manager',
   'RECEIVE', 'movement', 1,
   'Primire confirmată la Stand Vitan: 20 buc Cablu USB-C',
   '{"from_location_id":1,"to_location_id":2}',
   '192.168.1.20', NOW()-INTERVAL '3 days'),

  (1, 'Alexandru Popescu', 'admin@stockpilot.ro', 'admin',
   'UPDATE', 'settings', 2,
   'Setări actualizate pentru Stand Mall Vitan',
   '{"safety_stock_multiplier":1.2,"stale_days_threshold":45}',
   '192.168.1.10', NOW()-INTERVAL '6 days'),

  (1, 'Alexandru Popescu', 'admin@stockpilot.ro', 'admin',
   'APPROVE', 'suggestion', 2,
   'Sugestie #2 aprobată: 20 buc Folie Sticlă → Iași',
   '{"status":"approved","product_id":6,"to_location_id":5}',
   '192.168.1.10', NOW()-INTERVAL '4 days'),

  (6, 'Mihai Popa', 'iasi@stockpilot.ro', 'stand_manager',
   'CREATE', 'sale', 170,
   'Vânzare înregistrată: 2 buc — Încărcător 20W la Stand Iași',
   '{"product_id":13,"location_id":5,"quantity":2,"new_stock":1}',
   '192.168.1.50', NOW()-INTERVAL '8 hours'),

  (5, 'Elena Dumitrescu', 'cluj@stockpilot.ro', 'stand_manager',
   'LOGIN', 'user', 5, 'Elena Dumitrescu s-a autentificat',
   '{}', '192.168.1.40', NOW()-INTERVAL '3 hours'),

  (2, 'Maria Ionescu', 'depozit@stockpilot.ro', 'warehouse_manager',
   'SUPPLIER_ORDER', 'movement', 6,
   'Comandă furnizor: 50 buc Încărcător Wireless MagSafe → depozit',
   '{"to_location_id":1,"estimated_cost":null}',
   '192.168.1.20', NOW()-INTERVAL '3 days'),

  (2, 'Maria Ionescu', 'depozit@stockpilot.ro', 'warehouse_manager',
   'ACCEPT', 'movement', 7,
   'Transfer intern București: 8 buc Folie Sticlă, Vitan → Mega Mall',
   '{"from_location_id":2,"to_location_id":3,"source_type":"stand"}',
   '192.168.1.20', NOW()-INTERVAL '10 days');


-- ═══════════════════════════════════════════════════════════════════
-- PASUL 12 (opțional): Funcții atomice pentru stoc
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION decrement_stock(
  p_location_id INT, p_product_id INT, p_quantity INT
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE rows_affected INT;
BEGIN
  UPDATE stock SET quantity = quantity - p_quantity, updated_at = NOW()
  WHERE location_id = p_location_id AND product_id = p_product_id AND quantity >= p_quantity;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END; $$;

CREATE OR REPLACE FUNCTION increment_stock(
  p_location_id INT, p_product_id INT, p_quantity INT
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE stock SET quantity = quantity + p_quantity, updated_at = NOW()
  WHERE location_id = p_location_id AND product_id = p_product_id;
END; $$;


-- ═══════════════════════════════════════════════════════════════════
-- ✅ Verificare rapidă
-- ═══════════════════════════════════════════════════════════════════
SELECT '✅ Locații: '    || COUNT(*) FROM locations        UNION ALL
SELECT '✅ Produse: '    || COUNT(*) FROM products         UNION ALL
SELECT '✅ Utilizatori: '|| COUNT(*) FROM users            UNION ALL
SELECT '✅ Stock rows: ' || COUNT(*) FROM stock            UNION ALL
SELECT '✅ Vânzări: '    || COUNT(*) FROM sales            UNION ALL
SELECT '✅ Mișcări: '    || COUNT(*) FROM stock_movements   UNION ALL
SELECT '✅ Sugestii: '   || COUNT(*) FROM reorder_suggestions UNION ALL
SELECT '✅ Audit logs: ' || COUNT(*) FROM audit_logs       UNION ALL
SELECT '✅ Transport: '  || COUNT(*) FROM transport_costs  UNION ALL
SELECT '✅ Setări: '     || COUNT(*) FROM location_settings;
