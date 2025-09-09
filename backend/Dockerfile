FROM python:3.11-slim

WORKDIR /app

# เครื่องมือพื้นฐาน (curl ใช้กับ healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# ติดตั้งไลบรารี Python
COPY requirements.txt /app/requirements.txt
RUN python -m pip install --upgrade pip \
 && pip install --no-cache-dir -r /app/requirements.txt

# คัดลอกซอร์ส FastAPI ทั้งหมดใน backend เข้าอิมเมจ
COPY . /app/

# รันแบบ non-root
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TZ=Asia/Bangkok

EXPOSE 8080

# ✅ รัน Uvicorn (กำหนด root-path=/api ให้เส้นทางเป็น /api/...)
#   ต้องมีไฟล์ /app/app.py และตัวแปรแอปชื่อ 'app' (app = FastAPI())
CMD ["uvicorn","app:app","--host","0.0.0.0","--port","8080","--root-path","/api"]

