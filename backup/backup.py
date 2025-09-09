# backup/backup.py
import os, time, subprocess, datetime, shlex, shutil

pg_user = os.getenv("POSTGRES_USER")
pg_db   = os.getenv("POSTGRES_DB")
pg_host = os.getenv("PG_HOST","db")
pg_port = os.getenv("PG_PORT_IN","5432")
outdir  = "/backups"

# เลือกไบนารีให้ตรงเวอร์ชันเซิร์ฟเวอร์ (v16) ถ้ามี
pg_dump_bin = shutil.which("pg_dump16") or shutil.which("pg_dump") or "pg_dump"

def run_backup():
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    out = f"{outdir}/{pg_db}_{ts}.sql.gz"
    cmd = f'{pg_dump_bin} -h {pg_host} -p {pg_port} -U {pg_user} {pg_db} | gzip > {shlex.quote(out)}'
    print("RUN:", cmd, flush=True)
    subprocess.run(cmd, shell=True, check=True)

while True:
    try:
        run_backup()
    except Exception as e:
        print("Backup error:", e, flush=True)
    time.sleep(24*3600)

