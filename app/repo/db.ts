import type { D1Database } from '@cloudflare/workers-types';

export interface RunResult {
  changes: number;
  lastInsertRowid: number | null;
}

export interface DbStatement<T = unknown> {
  get(...params: unknown[]): Promise<T | undefined>;
  all(...params: unknown[]): Promise<T[]>;
  run(...params: unknown[]): Promise<RunResult>;
}

export interface DatabaseClient {
  prepare<T = unknown>(query: string): DbStatement<T>;
  exec(query: string): Promise<void>;
}

type RequestContextLoader = () => { env?: Record<string, unknown> };

let cachedRequestContext: RequestContextLoader | null = null;

const contextModuleSpecifiers = [
  '@opennextjs/cloudflare/context',
  '@opennextjs/cloudflare/runtime',
  '@opennextjs/cloudflare',
  '@cloudflare/next-on-pages',
];

const loadRequestContext = async (): Promise<() => { env?: Record<string, unknown> }> => {
  if (cachedRequestContext) {
    return cachedRequestContext;
  }

  let lastError: unknown = null;

  for (const specifier of contextModuleSpecifiers) {
    try {
      const module = await import(specifier);
      const candidate =
        module?.getRequestContext ??
        module?.default?.getRequestContext ??
        module?.context?.getRequestContext;
      if (typeof candidate === 'function') {
        cachedRequestContext = candidate as RequestContextLoader;
        return cachedRequestContext;
      }
    } catch (error) {
      lastError = error;
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[DB] Unable to load Cloudflare request context from "${specifier}". Install @opennextjs/cloudflare to ensure Workers bindings are available.`,
          error
        );
      }
    }
  }

  cachedRequestContext = () => {
    throw new Error(
      'D1 binding "COMPREHENDO_DB" is unavailable. Install @opennextjs/cloudflare and ensure the binding is configured in wrangler.toml.'
    );
  };

  if (process.env.NODE_ENV !== 'production' && lastError) {
    console.error('[DB] No Cloudflare request context loader could be found.', lastError);
  }

  return cachedRequestContext;
};

const getDatabase = async (): Promise<D1Database> => {
  const getContext = await loadRequestContext();
  const { env } = getContext();
  const globalEnv = globalThis as {
    env?: Record<string, unknown>;
    __env?: Record<string, unknown>;
  };
  const binding =
    env?.['COMPREHENDO_DB'] ??
    globalEnv.env?.['COMPREHENDO_DB'] ??
    globalEnv.__env?.['COMPREHENDO_DB'] ??
    (globalThis as Record<string, unknown>)['COMPREHENDO_DB'];
  if (!binding) {
    throw new Error(
      'D1 binding "COMPREHENDO_DB" is not available in the current request context. Ensure the Cloudflare binding is configured.'
    );
  }
  return binding as D1Database;
};

const db: DatabaseClient = {
  prepare<T = unknown>(query: string): DbStatement<T> {
    return {
      async get(...params: unknown[]): Promise<T | undefined> {
        const database = await getDatabase();
        const prepared = database.prepare(query);
        const result = (await prepared.bind(...params).first()) as T | null;
        return result ?? undefined;
      },
      async all(...params: unknown[]): Promise<T[]> {
        const database = await getDatabase();
        const prepared = database.prepare(query);
        const { results } = await prepared.bind(...params).all();
        return (results as T[] | undefined) ?? [];
      },
      async run(...params: unknown[]): Promise<RunResult> {
        const database = await getDatabase();
        const prepared = database.prepare(query);
        const { meta } = await prepared.bind(...params).run();
        return {
          changes: meta?.changes ?? 0,
          lastInsertRowid: typeof meta?.last_row_id === 'number' ? meta.last_row_id : null,
        };
      },
    };
  },
  async exec(query: string): Promise<void> {
    const database = await getDatabase();
    await database.exec(query);
  },
};

export default db;
