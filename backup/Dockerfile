# backup/Dockerfile
FROM python:3.11-alpine
# ใช้ client v16 ให้ตรงกับเซิร์ฟเวอร์
RUN apk add --no-cache postgresql16-client tzdata && \
    cp /usr/share/zoneinfo/Asia/Bangkok /etc/localtime
WORKDIR /app
COPY backup.py /app/backup.py
CMD ["python","/app/backup.py"]

