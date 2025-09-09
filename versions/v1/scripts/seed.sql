BEGIN;
INSERT INTO warehouses(wh_code, wh_name, location)
VALUES ('MAIN','Main Warehouse','HQ')
ON CONFLICT (wh_code) DO NOTHING;

INSERT INTO items(sku, item_name, uom, category, cost_method, last_cost)
VALUES ('SKU-TEST','Test Item','pcs','General','AVERAGE',100)
ON CONFLICT (sku) DO NOTHING;

INSERT INTO stock_moves(move_type, ref_no, ref_type, item_id, wh_to, qty, unit_cost, note)
VALUES ('IN','SEED-001','MANUAL',
        (SELECT item_id FROM items WHERE sku='SKU-TEST'),
        (SELECT wh_id FROM warehouses WHERE wh_code='MAIN'),
        10, 100, 'seed IN');
COMMIT;
