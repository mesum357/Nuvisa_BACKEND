# NUvisa PostgreSQL on VPS

Self-hosted PostgreSQL 16 for NUvisa (replaces Supabase **hosting** only). All apps already use the PostgreSQL protocol via Prisma and Sequelize.

## Quick start (on VPS)

```bash
cd /var/www/nuvisa/infrastructure/postgres   # or your deploy path
cp .env.example .env
nano .env                                    # set POSTGRES_PASSWORD (strong)

docker compose up -d
docker compose ps
docker compose logs -f postgres
```

Health check:

```bash
docker exec nuvisa-postgres pg_isready -U nuvisa -d nuvisa
```

## Connection strings

| Where apps run | `DATABASE_URL` host | SSL |
|----------------|---------------------|-----|
| PM2 on same VPS | `127.0.0.1:5432` | `DATABASE_SSL=false` |
| Docker (later) | `postgres:5432` | `DATABASE_SSL=false` |

Copy from `connection.env.example` into:

- `NUvisa-backend/.env`
- `New-NUvisa/.env.local` (or production env)
- `Nuvisa-Admin/.env.local`

Use the **same** database name and user for all three apps (one shared DB).

## Migrate data from Supabase

1. In Supabase Dashboard → Settings → Database, copy the **direct** connection string (port **5432**, not 6543 pooler).

2. On the VPS:

```bash
export SUPABASE_DIRECT_URL='postgresql://...'
chmod +x scripts/*.sh
./scripts/migrate-from-supabase.sh
```

3. Update each app’s `DATABASE_URL` / `DIRECT_URL` to the VPS values.

4. Restart backend (PM2), then frontend and admin.

5. Smoke-test: login, visa application, Stripe test payment, admin CMS, FAQs.

Keep Supabase read-only for 1–2 weeks as rollback.

## Backups (cron)

```bash
# Daily at 2:00 AM
0 2 * * * /var/www/nuvisa/infrastructure/postgres/scripts/backup.sh >> /var/log/nuvisa-pg-backup.log 2>&1
```

Backups are written to `infrastructure/postgres/backups/`.

## Security

- Postgres listens on `127.0.0.1` only (see `docker-compose.yml`).
- Do not open port 5432 on the public firewall.
- Rotate `POSTGRES_PASSWORD` if it was ever committed or shared.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `POSTGRES_PASSWORD is not set` | Create `.env` from `.env.example` |
| Prisma migrate fails | Use `DIRECT_URL` on port 5432 (same as `DATABASE_URL` on VPS) |
| Backend SSL errors | Set `DATABASE_SSL=false` for local Docker |
| Empty database after restore | Re-run migrate script; check `SUPABASE_DIRECT_URL` uses port 5432 |
