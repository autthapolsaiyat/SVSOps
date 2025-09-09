# SVS-Ops quick seed

```bash
cp .env.example .env
docker compose up -d --build

# seed IN 10 @ 100
make seed
make levels

# OUT 3 and consume FIFO
make out
make levels
make layers
```
