export class MemoryD1Database {
  constructor() {
    this.sessions = new Map();
    this.states = new Map();
    this.failNext = false;
  }

  prepare(sql) {
    return new MemoryD1Statement(this, sql);
  }
}

class MemoryD1Statement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql.replace(/\s+/g, " ").trim().toLowerCase();
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  async first() {
    if (this.database.failNext) {
      this.database.failNext = false;
      throw new Error("simulated D1 failure");
    }

    if (this.sql.startsWith("insert into prompthub_auth_sessions ")) {
      const [id, payload, expires_at] = this.values;
      if (this.database.sessions.has(id)) return null;
      this.database.sessions.set(id, { payload, expires_at });
      return { id };
    }

    if (this.sql.startsWith("select payload, expires_at from prompthub_auth_sessions ")) {
      const [id] = this.values;
      const row = this.database.sessions.get(id);
      return row ? { payload: row.payload, expires_at: row.expires_at } : null;
    }

    if (this.sql.startsWith("select payload, expires_at from prompthub_oauth_states ")) {
      const [state_hash, now] = this.values;
      const row = this.database.states.get(state_hash);
      return row && row.expires_at > now ? { payload: row.payload, expires_at: row.expires_at } : null;
    }

    if (this.sql.startsWith("insert into prompthub_oauth_states ")) {
      const [state_hash, payload, expires_at] = this.values;
      if (this.database.states.has(state_hash)) return null;
      this.database.states.set(state_hash, { payload, expires_at });
      return { state_hash };
    }

    if (this.sql.startsWith("delete from prompthub_oauth_states ") && this.sql.includes("returning state_hash")) {
      const [state_hash, payload, expires_at, now] = this.values;
      const row = this.database.states.get(state_hash);
      if (!row || row.payload !== payload || row.expires_at !== expires_at || row.expires_at <= now) return null;
      this.database.states.delete(state_hash);
      return { state_hash };
    }

    throw new Error(`unsupported D1 first query: ${this.sql}`);
  }

  async run() {
    if (this.database.failNext) {
      this.database.failNext = false;
      throw new Error("simulated D1 failure");
    }

    if (this.sql === "delete from prompthub_auth_sessions where id = ?") {
      const [id] = this.values;
      const changes = this.database.sessions.delete(id) ? 1 : 0;
      return { success: true, meta: { changes } };
    }

    const cleanup = this.sql.match(/^delete from (prompthub_auth_sessions|prompthub_oauth_states) where (id|state_hash) in \(select \2 from \1 where expires_at <= \? limit \?\)$/);
    if (cleanup) {
      const table = cleanup[1] === "prompthub_auth_sessions" ? this.database.sessions : this.database.states;
      const [now, limit] = this.values;
      let changes = 0;
      for (const [key, row] of table) {
        if (row.expires_at <= now) {
          table.delete(key);
          changes += 1;
          if (changes >= limit) break;
        }
      }
      return { success: true, meta: { changes } };
    }

    throw new Error(`unsupported D1 run query: ${this.sql}`);
  }
}
