import { getDbConfig, describeDbConfig, type DbConfig } from "./db.config.js";

/**
 * LỚP TRUY CẬP DATABASE cho test.
 *
 * Vai trò: mở pool 1 lần, cho các hàm truy vấn dùng chung, đóng lại ở cuối.
 * Mọi câu lệnh đều đi qua đây để hưởng sẵn: timeout, chặn ghi (readOnly),
 * và tham số hoá (chống SQL injection + tránh lỗi dấu nháy trong tên tiếng Việt).
 *
 * ⚠️ Driver được nạp LAZY bằng import động -> file này compile được ngay cả
 *    khi chưa cài driver. Khi dùng thật thì chạy:
 *        npm i -D mysql2          (MySQL/MariaDB)
 *        npm i -D pg @types/pg    (PostgreSQL)
 *
 * Dùng DB trong test để làm gì (và không nên làm gì):
 *   ✅ Kiểm chứng kết quả: tạo lead trên UI xong -> query xem bản ghi đã vào DB đúng chưa.
 *   ✅ Dựng/chọn dữ liệu đầu vào: lấy id quy trình, lấy user có sẵn.
 *   ✅ Dọn dẹp: xoá bản ghi test đã tạo.
 *   ❌ Thay thế assert trên UI - DB đúng không có nghĩa là người dùng thấy đúng.
 */

/* ══════════════════════ Kiểu tối thiểu của driver ══════════════════════ */
/* Tự khai thay vì import type từ mysql2 để không phụ thuộc lúc chưa cài.   */

interface PoolLike {
  query(sql: string, params?: readonly unknown[]): Promise<[unknown, unknown]>;
  end(): Promise<void>;
}

interface MysqlModuleLike {
  createPool(options: Record<string, unknown>): PoolLike;
}

/** Hàng trả về từ DB: object key=tên cột. */
export type Row = Record<string, unknown>;

/** Kết quả của câu lệnh ghi. */
export interface WriteResult {
  affectedRows: number;
  insertId?: number;
}

/* ══════════════════════ Chặn câu lệnh ghi ══════════════════════ */

const WRITE_STATEMENT = /^\s*(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|REPLACE|GRANT)\b/i;

function assertAllowed(sql: string, config: DbConfig): void {
  if (config.readOnly && WRITE_STATEMENT.test(sql)) {
    throw new Error(
      `[Database] Bị chặn: đang ở chế độ readOnly nên không chạy được câu lệnh ghi.\n` +
        `SQL: ${sql.slice(0, 120)}...\n` +
        `Chỉ set DB_READONLY=false khi chắc chắn đang trỏ vào DB test riêng.`,
    );
  }
}

/* ══════════════════════ Lớp Database ══════════════════════ */

export class Database {
  private pool?: PoolLike;
  private readonly config: DbConfig;

  constructor(config: DbConfig = getDbConfig()) {
    this.config = config;
  }

  /* ── Vòng đời kết nối ────────────────────────────────────────── */

  /**
   * Mở pool (idempotent - gọi nhiều lần vẫn chỉ tạo 1 pool).
   * Pool = tập kết nối dùng lại, tránh mở/đóng TCP cho từng câu query.
   */
  async connect(): Promise<void> {
    if (this.pool) return;

    if (this.config.client !== "mysql") {
      throw new Error(
        `[Database] Khung này mới hiện thực client "mysql". ` +
          `Với "${this.config.client}" cần bổ sung nhánh nạp driver tương ứng.`,
      );
    }

    // Specifier để trong biến -> TypeScript không resolve lúc compile,
    // nên không cần cài mysql2 mới build được.
    const specifier = "mysql2/promise";
    let driver: MysqlModuleLike;
    try {
      driver = (await import(specifier)) as unknown as MysqlModuleLike;
    } catch {
      throw new Error(`[Database] Chưa cài driver. Chạy: npm i -D mysql2`);
    }

    this.pool = driver.createPool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      ssl: this.config.ssl,
      connectionLimit: this.config.connectionLimit,
      connectTimeout: this.config.connectTimeout,
      waitForConnections: true,
      // Trả DATE/DATETIME về dạng chuỗi -> so sánh trong test ổn định,
      // không lệ thuộc timezone của máy chạy test.
      dateStrings: true,
    });

    // Ping sớm: sai host/mật khẩu thì fail ngay tại đây với thông báo rõ,
    // thay vì fail ở câu query đầu tiên giữa test.
    try {
      await this.query("SELECT 1");
    } catch (error) {
      await this.close();
      throw new Error(
        `[Database] Không kết nối được ${describeDbConfig(this.config)}\n${String(error)}`,
      );
    }
  }

  /** Đóng pool. Gọi ở teardown của worker/global. */
  async close(): Promise<void> {
    if (!this.pool) return;
    await this.pool.end();
    this.pool = undefined;
  }

  private requirePool(): PoolLike {
    if (!this.pool) {
      throw new Error(`[Database] Chưa gọi connect() trước khi truy vấn.`);
    }
    return this.pool;
  }

  /* ── Truy vấn ────────────────────────────────────────────────── */

  /**
   * Chạy SELECT, trả về mảng hàng.
   *
   * LUÔN truyền giá trị qua `params` (dấu ? trong SQL), KHÔNG nối chuỗi:
   *   ✅ db.query("SELECT * FROM leads WHERE title = ?", [title])
   *   ❌ db.query(`SELECT * FROM leads WHERE title = '${title}'`)
   */
  async query<T extends Row = Row>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    assertAllowed(sql, this.config);

    const [rows] = await this.requirePool().query(
      { sql, timeout: this.config.queryTimeout } as unknown as string,
      params,
    );
    return (rows ?? []) as T[];
  }

  /** Lấy đúng 1 hàng, không có thì trả null. */
  async queryOne<T extends Row = Row>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  /** Lấy 1 ô giá trị (cột đầu của hàng đầu) - tiện cho COUNT/MAX. */
  async queryValue<T = unknown>(sql: string, params: readonly unknown[] = []): Promise<T | null> {
    const row = await this.queryOne(sql, params);
    if (!row) return null;

    const firstKey = Object.keys(row)[0];
    return firstKey === undefined ? null : (row[firstKey] as T);
  }

  /** Có tồn tại ít nhất 1 hàng khớp không. */
  async exists(sql: string, params: readonly unknown[] = []): Promise<boolean> {
    return (await this.query(sql, params)).length > 0;
  }

  /**
   * Chờ đến khi DB có hàng khớp - dùng khi UI ghi bất đồng bộ (queue/job).
   * Trả về hàng đầu tiên tìm được, hết thời gian thì ném lỗi.
   *
   *   const lead = await db.waitForRow(
   *     "SELECT id FROM leads WHERE title = ?", [title], { timeout: 15_000 },
   *   );
   */
  async waitForRow<T extends Row = Row>(
    sql: string,
    params: readonly unknown[] = [],
    options: { timeout?: number; intervalMs?: number } = {},
  ): Promise<T> {
    const timeout = options.timeout ?? 10_000;
    const intervalMs = options.intervalMs ?? 500;
    const deadline = Date.now() + timeout;

    for (;;) {
      const row = await this.queryOne<T>(sql, params);
      if (row) return row;

      if (Date.now() >= deadline) {
        throw new Error(`[Database] Quá ${timeout}ms vẫn không thấy hàng khớp.\nSQL: ${sql}`);
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  /* ── Ghi dữ liệu (chỉ chạy khi DB_READONLY=false) ────────────── */

  /** INSERT/UPDATE/DELETE. Dùng cho dọn dẹp hoặc dựng dữ liệu đầu vào. */
  async execute(sql: string, params: readonly unknown[] = []): Promise<WriteResult> {
    assertAllowed(sql, this.config);

    const [result] = await this.requirePool().query(
      { sql, timeout: this.config.queryTimeout } as unknown as string,
      params,
    );
    const info = (result ?? {}) as { affectedRows?: number; insertId?: number };

    return {
      affectedRows: info.affectedRows ?? 0,
      ...(info.insertId !== undefined ? { insertId: info.insertId } : {}),
    };
  }
}

/* ══════════════════════ Instance dùng chung ══════════════════════ */

let shared: Database | undefined;

/**
 * Database dùng chung cho cả worker. Lần gọi đầu sẽ tự connect().
 * Nhớ gọi closeSharedDatabase() ở teardown để process không bị treo.
 */
export async function getDatabase(): Promise<Database> {
  if (!shared) {
    shared = new Database();
    await shared.connect();
  }
  return shared;
}

export async function closeSharedDatabase(): Promise<void> {
  await shared?.close();
  shared = undefined;
}
