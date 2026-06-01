import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSupabaseConfigured } from '../database/supabase.client.js';
import { __dumpMemoryClientes, __loadMemoryClientes } from '../modules/clientes/clientes.repository.js';
import { __dumpMemoryProdutos, __loadMemoryProdutos } from '../modules/produtos/produtos.repository.js';
import { __dumpMemoryPedidos, __loadMemoryPedidos } from '../modules/pedidos/pedidos.repository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '../../.data');
const dataFile = path.join(dataDir, 'demo-memory.json');
let lastLoadedMtimeMs = null;

function canUseDemoStore() {
  return process.env.NODE_ENV !== 'production' && !isSupabaseConfigured();
}

export function getDemoMemoryFilePath() {
  return dataFile;
}

export async function loadDemoMemoryFromDisk() {
  if (!canUseDemoStore()) return { loaded: false, reason: 'disabled' };
  try {
    const raw = await readFile(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    __loadMemoryClientes(parsed.clientes || []);
    __loadMemoryProdutos(parsed.produtos || []);
    __loadMemoryPedidos(parsed.pedidos || {});
    lastLoadedMtimeMs = Date.now();
    return { loaded: true };
  } catch (error) {
    if (error?.code === 'ENOENT') return { loaded: false, reason: 'missing' };
    throw error;
  }
}

export async function ensureDemoMemoryLoaded() {
  if (!canUseDemoStore()) return { loaded: false, reason: 'disabled' };
  try {
    const stats = await stat(dataFile);
    if (lastLoadedMtimeMs !== null && Number.isFinite(stats?.mtimeMs) && stats.mtimeMs <= lastLoadedMtimeMs) {
      return { loaded: false, reason: 'up_to_date' };
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return { loaded: false, reason: 'missing' };
    throw error;
  }
  return loadDemoMemoryFromDisk();
}

export async function saveDemoMemoryToDisk() {
  if (!canUseDemoStore()) return { saved: false, reason: 'disabled' };
  await mkdir(dataDir, { recursive: true });
  const payload = {
    savedAt: new Date().toISOString(),
    clientes: __dumpMemoryClientes(),
    produtos: __dumpMemoryProdutos(),
    pedidos: __dumpMemoryPedidos()
  };
  await writeFile(dataFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return { saved: true, path: dataFile };
}
