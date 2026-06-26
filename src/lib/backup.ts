import { supabase, supabaseConfigError } from './supabase';

export const BACKUP_FORMAT = 'shopri-manager-backup';
export const BACKUP_VERSION = 1;

export const BACKUP_TABLES = [
  'products',
  'size_sets',
  'inventory_batches',
  'customers',
  'invoices',
  'invoice_items',
  'payments',
] as const;

export type BackupTableName = (typeof BACKUP_TABLES)[number];

export type BackupPayload = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  app: {
    name: string;
    author: string;
    copyright: string;
  };
  tables: Record<BackupTableName, unknown[]>;
};

const DELETE_ORDER: BackupTableName[] = [
  'payments',
  'invoice_items',
  'invoices',
  'inventory_batches',
  'customers',
  'size_sets',
  'products',
];

const INSERT_ORDER: BackupTableName[] = [
  'products',
  'size_sets',
  'customers',
  'inventory_batches',
  'invoices',
  'invoice_items',
  'payments',
];

const assertSupabaseConfigured = () => {
  if (supabaseConfigError) {
    throw new Error(supabaseConfigError);
  }
};

const chunkRows = <T,>(rows: T[], size = 500): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
};

export const validateBackupPayload = (payload: unknown): BackupPayload => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('File backup không đúng định dạng JSON.');
  }

  const candidate = payload as Partial<BackupPayload>;
  if (candidate.format !== BACKUP_FORMAT || candidate.version !== BACKUP_VERSION || !candidate.tables) {
    throw new Error('File backup không thuộc đúng định dạng của ShopRi Manager.');
  }

  for (const table of BACKUP_TABLES) {
    if (!Array.isArray(candidate.tables[table])) {
      throw new Error(`File backup thiếu bảng ${table}.`);
    }
  }

  return candidate as BackupPayload;
};

export const createBackupPayload = async (): Promise<BackupPayload> => {
  assertSupabaseConfigured();

  const tables = {} as Record<BackupTableName, unknown[]>;

  for (const table of BACKUP_TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Không thể đọc bảng ${table}: ${error.message}`);
    }

    tables[table] = data || [];
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: {
      name: 'ShopRi Manager',
      author: 'Hoàng Uyên',
      copyright: 'Hoàng Uyên 0931325512',
    },
    tables,
  };
};

export const downloadBackupFile = (payload: BackupPayload) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `shopri-backup-${timestamp}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const restoreBackupPayload = async (payload: BackupPayload) => {
  assertSupabaseConfigured();
  validateBackupPayload(payload);

  for (const table of DELETE_ORDER) {
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      throw new Error(`Không thể xoá dữ liệu cũ trong bảng ${table}: ${error.message}`);
    }
  }

  for (const table of INSERT_ORDER) {
    const rows = payload.tables[table];
    if (rows.length === 0) continue;

    for (const chunk of chunkRows(rows)) {
      const { error } = await supabase
        .from(table)
        .insert(chunk as Record<string, unknown>[]);

      if (error) {
        throw new Error(`Không thể phục hồi bảng ${table}: ${error.message}`);
      }
    }
  }
};

export const getBackupSummary = (payload: BackupPayload) => {
  return BACKUP_TABLES.map((table) => ({
    table,
    count: payload.tables[table].length,
  }));
};
