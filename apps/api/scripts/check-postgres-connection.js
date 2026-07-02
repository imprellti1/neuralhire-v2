import pg from 'pg';

const { Client } = pg;

function maskDatabaseUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    return '<invalid DATABASE_URL>';
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    await client.connect();
    const result = await client.query('select current_database(), current_user, now();');
    const row = result.rows[0] ?? {};

    console.log('Postgres connection OK');
    console.log(`DATABASE_URL=${maskDatabaseUrl(databaseUrl)}`);
    console.log(`current_database=${row.current_database ?? ''}`);
    console.log(`current_user=${row.current_user ?? ''}`);
    console.log(`now=${row.now ?? ''}`);

    process.exit(0);
  } catch (error) {
    console.error('Postgres connection FAILED');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

await main();
