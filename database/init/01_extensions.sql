-- PostGIS init for first boot of the dev PostGIS container (docker-entrypoint-initdb.d).
-- Prisma migrations also create the extension in the initial migration SQL; this
-- guarantees it exists even if migrations have not been applied yet.
CREATE EXTENSION IF NOT EXISTS postgis;
