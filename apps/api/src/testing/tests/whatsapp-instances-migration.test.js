import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assertEqual } from '../assert.js';

function readMigration(relativePath) {
  const filePath = fileURLToPath(new URL(relativePath, import.meta.url));
  return readFileSync(filePath, 'utf8');
}

export function getWhatsappInstancesMigrationTests() {
  return [
    {
      name: 'migration adiciona instance_type com backfill idempotente',
      run: async () => {
        const sql = readMigration('../../../../../packages/database/supabase/migrations/202606290001_add_whatsapp_instances_instance_type.sql');
        assertEqual(sql.includes('add column if not exists instance_type text'), true, 'deve adicionar coluna');
        assertEqual(sql.includes("coalesce(metadata->>'instance_type', metadata->>'type', 'operational')"), true, 'deve preencher registros existentes');
        assertEqual(sql.includes("alter column instance_type set default 'operational'"), true, 'deve aplicar default');
        assertEqual(sql.includes("alter column instance_type set not null"), true, 'deve reforcar not null');
        assertEqual(sql.includes("whatsapp_instances_instance_type_check"), true, 'deve criar check constraint');
        assertEqual(sql.includes("check (instance_type in ('operational', 'learning'))"), true, 'deve limitar valores');
        assertEqual(sql.includes('idx_whatsapp_instances_provider_instance_name_instance_type'), true, 'deve criar indice composto');
        assertEqual(sql.includes('metadata = coalesce'), false, 'nao deve alterar metadata');
      }
    }
  ];
}
