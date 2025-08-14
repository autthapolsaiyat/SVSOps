.PHONY: up down ps restart logs tail psql api api-raw probe ready seed out levels layers card clean \
        fix-fifo backup-now backups-list restore-overwrite restore-new \
        restore-last-name restore-show-levels restore-show-layers restore-show-card \
        backup-prune restore-test help

# ค่าพื้นฐาน
DBU   := svs
DBN   := svssystem
HOST  ?= localhost
PORT  ?= 8888
DBR   ?= svssystem_restore   # ชื่อ DB เป้าหมายเวลากู้คืน
KEEP  ?= 30                  # จำนวนไฟล์ backup ที่เก็บตอน prune

# --- lifecycle ---
up:
	@docker compose up -d --build

down:
	@docker compose down

ps:
	@docker compose ps

restart: ## ใช้ S=backend (หรือชื่อ service) เพื่อรีสตาร์ทเฉพาะตัวนั้น
	@docker compose restart $(S)

logs:
	@docker compose logs -f --tail=200

tail:    ## ใช้ S=proxy (หรือชื่อ service) เพื่อดูล็อกเฉพาะตัวนั้น
	@docker compose logs -f --tail=200 $(S)

# --- DB / API quick ops ---
psql:
	@docker compose exec db psql -U $(DBU) -d $(DBN)

api:
	@curl -sfS http://$(HOST):$(PORT)/api/healthz | python3 -m json.tool 2>/dev/null || \
	curl -s http://$(HOST):$(PORT)/api/healthz || echo "API not reachable"

api-raw:
	@curl -i http://$(HOST):$(PORT)/api/healthz

probe:
	@curl -s -o /tmp/svs_api_body.txt -w "HTTP %{http_code}\n" http://$(HOST):$(PORT)/api/healthz; \
	cat /tmp/svs_api_body.txt; echo

ready:
	@bash -lc 'for i in {1..30}; do \
	  if curl -sf http://$(HOST):$(PORT)/api/healthz >/dev/null; then echo "API OK"; exit 0; \
	  else sleep 1; fi; \
	done; echo "API not ready"; exit 1'

# --- stock quick demo ---
seed:
	@docker compose exec -T db psql -U $(DBU) -d $(DBN) < scripts/seed.sql

out:
	@docker compose exec -T db psql -U $(DBU) -d $(DBN) < scripts/seed_out.sql

levels:
	@docker compose exec db psql -U $(DBU) -d $(DBN) -c "SELECT i.sku, l.on_hand, l.avg_cost FROM stock_levels l JOIN items i USING(item_id);"

layers:
	@docker compose exec db psql -U $(DBU) -d $(DBN) -c "SELECT i.sku, w.wh_code, l.qty_in, l.qty_remaining, l.unit_cost FROM stock_layers l JOIN items i USING(item_id) JOIN warehouses w ON w.wh_id=l.wh_id ORDER BY l.created_at;"

card:
	@docker compose exec db psql -U $(DBU) -d $(DBN) -c "SELECT m.move_type, i.sku, m.qty, m.unit_cost, m.moved_at FROM stock_moves m JOIN items i USING(item_id) ORDER BY m.moved_at;"

clean:
	@docker compose down -v
	@rm -rf db/backups/*

fix-fifo:
	@docker compose exec -T db psql -U $(DBU) -d $(DBN) < scripts/fifo_fix.sql

# --- backup / restore ---
backup-now:
	@docker compose exec db sh -lc 'pg_dump -U $$POSTGRES_USER $$POSTGRES_DB | gzip > /backups/$${POSTGRES_DB}_$$(date +%Y%m%d_%H%M%S).sql.gz' && \
	echo "✔ Backup created in db/backups/"

backups-list:
	@ls -lh db/backups/ | tail -n +1

# กู้คืนแบบ "ลบทิ้งแล้วสร้างใหม่" (เขียนทับชื่อเดิม)
restore-overwrite:
	@docker compose exec db sh -lc '\
	  DB=$(DBR); \
	  LATEST=$$(ls -1t /backups/svssystem_*.sql.gz | head -n1); \
	  echo Using backup: $$LATEST; \
	  psql -U $$POSTGRES_USER -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='\''$$DB'\'';" || true; \
	  dropdb  -U $$POSTGRES_USER "$$DB" || true; \
	  createdb -U $$POSTGRES_USER "$$DB"; \
	  gunzip -c "$$LATEST" | psql -q -X -v ON_ERROR_STOP=1 -U $$POSTGRES_USER -d "$$DB" \
	' && echo "✔ Restored to database: $(DBR) (overwritten)"

# กู้คืนแบบ "สร้างชื่อใหม่ทุกครั้ง"
restore-new:
	@docker compose exec -e DB_BASE=$(DBR) db sh -lc '\
	  TS=$$(date +%Y%m%d_%H%M%S); \
	  DB_BASE="$${DB_BASE:-svssystem_restore}"; \
	  DB="$${DB_BASE}_$${TS}"; \
	  LATEST=$$(ls -1t /backups/svssystem_*.sql.gz 2>/dev/null | head -n1); \
	  [ -z "$$LATEST" ] && echo "No backups found in /backups" && exit 1; \
	  echo Using backup: $$LATEST; echo "Creating $$DB"; \
	  createdb -U $$POSTGRES_USER "$$DB"; \
	  gunzip -c "$$LATEST" | psql -q -X -v ON_ERROR_STOP=1 -U $$POSTGRES_USER -d "$$DB"; \
	  echo "$$DB" > /tmp/last_restore_name.txt \
	' && echo "✔ Restored to NEW database (see: make restore-last-name)"

restore-last-name:
	@docker compose exec db sh -lc 'cat /tmp/last_restore_name.txt 2>/dev/null || echo "(no restore-new yet)"'

restore-show-levels:
	@docker compose exec db sh -lc '\
	  DB=$$(cat /tmp/last_restore_name.txt); \
	  psql -U $$POSTGRES_USER -d "$$DB" -c "SELECT i.sku, l.on_hand, l.avg_cost FROM stock_levels l JOIN items i USING(item_id);" \
	'

restore-show-layers:
	@docker compose exec db sh -lc '\
	  DB=$$(cat /tmp/last_restore_name.txt); \
	  psql -U $$POSTGRES_USER -d "$$DB" -c "SELECT i.sku, w.wh_code, l.qty_in, l.qty_remaining, l.unit_cost FROM stock_layers l JOIN items i USING(item_id) JOIN warehouses w ON w.wh_id=l.wh_id ORDER BY l.created_at;" \
	'

restore-show-card:
	@docker compose exec db sh -lc '\
	  DB=$$(cat /tmp/last_restore_name.txt); \
	  psql -U $$POSTGRES_USER -d "$$DB" -c "SELECT m.move_type, i.sku, m.qty, m.unit_cost, m.moved_at FROM stock_moves m JOIN items i USING(item_id) ORDER BY m.moved_at;" \
	'

# เก็บไว้แค่ล่าสุด $(KEEP) ไฟล์
backup-prune:
	@docker compose exec db sh -lc '\
	  KEEP=$(KEEP); \
	  files=$$(ls -1t /backups/svssystem_*.sql.gz 2>/dev/null | awk "NR>$$KEEP{print}"); \
	  if [ -z "$$files" ]; then echo "Nothing to prune. Keeping latest $$KEEP files."; else echo "$$files" | xargs rm -f && echo "Pruned. Keeping latest $$KEEP files."; fi \
	'

# compatibility alias
restore-test: restore-overwrite

help:
	@echo "Targets:"; \
	echo "  up / down / ps / restart S=svc / logs / tail S=svc"; \
	echo "  ready / api / api-raw / probe"; \
	echo "  psql / seed / out / levels / layers / card / fix-fifo / clean"; \
	echo "  backup-now / backups-list / backup-prune KEEP=30"; \
	echo "  restore-overwrite DBR=svssystem_restore"; \
	echo "  restore-new DBR=svssystem_restore  (with timestamp)"; \
	echo "  restore-last-name / restore-show-levels / restore-show-layers / restore-show-card"
