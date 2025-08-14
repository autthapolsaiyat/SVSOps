BEGIN;
INSERT INTO stock_moves(move_type, ref_no, ref_type, item_id, wh_from, qty, unit_cost, note)
VALUES ('OUT','SEED-OUT-001','MANUAL',
        (SELECT item_id FROM items WHERE sku='SKU-TEST'),
        (SELECT wh_id FROM warehouses WHERE wh_code='MAIN'),
        3, 100, 'seed OUT');

-- consume FIFO layers for that OUT (reduce qty_remaining accordingly)
SELECT * FROM fifo_consume(
  (SELECT item_id FROM items WHERE sku='SKU-TEST'),
  (SELECT wh_id FROM warehouses WHERE wh_code='MAIN'),
  3::NUMERIC,
  NULL
);
COMMIT;
