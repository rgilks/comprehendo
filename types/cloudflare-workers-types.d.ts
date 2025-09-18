declare module '@cloudflare/workers-types' {
  export interface D1PreparedStatement<T = unknown> {
    bind(...params: unknown[]): D1PreparedStatement<T>;
    first(): Promise<T | null>;
    all(): Promise<{ results?: T[] }>;
    run(): Promise<{ meta?: { changes?: number; last_row_id?: number } }>;
  }

  export interface D1Database {
    prepare<T = unknown>(query: string): D1PreparedStatement<T>;
    exec(query: string): Promise<void>;
  }
}
