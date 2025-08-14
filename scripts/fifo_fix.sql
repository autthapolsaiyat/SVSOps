BEGIN;
CREATE OR REPLACE FUNCTION fifo_consume(
  p_item  UUID,
  p_wh    UUID,
  p_qty   NUMERIC,
  p_batch UUID DEFAULT NULL
)
RETURNS TABLE(layer_id UUID, qty_taken NUMERIC, unit_cost NUMERIC)
LANGUAGE plpgsql
AS $$
DECLARE
  remaining NUMERIC := p_qty;
  v_lid UUID;
  v_take NUMERIC;
  v_cost NUMERIC;
BEGIN
  FOR v_lid, v_take, v_cost IN
    SELECT l.layer_id,
           LEAST(l.qty_remaining, remaining),
           l.unit_cost
      FROM stock_layers l
     WHERE l.item_id = p_item
       AND l.wh_id   = p_wh
       AND (p_batch IS NULL OR l.batch_id = p_batch)
       AND l.qty_remaining > 0
     ORDER BY l.created_at ASC, l.layer_id ASC
  LOOP
    EXIT WHEN remaining <= 0;

    UPDATE stock_layers AS sl
       SET qty_remaining = sl.qty_remaining - v_take
     WHERE sl.layer_id = v_lid;

    remaining := remaining - v_take;

    layer_id  := v_lid;
    qty_taken := v_take;
    unit_cost := v_cost;
    RETURN NEXT;
  END LOOP;

  IF remaining > 0 THEN
    RAISE EXCEPTION 'Insufficient FIFO layers for item %, wh %, need % more units',
      p_item, p_wh, remaining;
  END IF;
END;
$$;
COMMIT;
