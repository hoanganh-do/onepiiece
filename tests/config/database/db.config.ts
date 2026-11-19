/**
 * CẤU HÌNH KẾT NỐI DATABASE.
 *
 * Nguyên tắc: KHÔNG hard-code thông tin kết nối trong code.
 * Mọi giá trị đọc từ biến môi trường -> mỗi người/CI dùng DB riêng mà không
 * phải sửa file, và mật khẩu không bị commit lên git.
 *
 * Cách nạp biến môi trường (chọn 1):
 *   1. Set thẳng khi chạy:  DB_HOST=... npx playwright test
 *   2. Dùng file .env  -> bỏ comment 2 dòng dotenv ở đầu playwright.config.ts
 *                         và nhớ thêm `.env` vào .gitignore.
 *
 * ⚠️ CenRM chạy trên nền Krayin (Laravel) nên DB mặc định là MySQL/MariaDB.
 *    Nếu thực tế là PostgreSQL thì đổi DB_CLIENT=pg và cài `pg` thay `mysql2`.
 */

/* ══════════════════════ Thông tin cần có ══════════════════════ */

/**
 * Loại DB. Quyết định driver nào được nạp trong Database.ts.
 * Hiện khung mới hiện thực nhánh "mysql"; "pg" để sẵn chỗ mở rộng.
 */
export type DbClient = "mysql" | "pg";

export interface DbConfig {
  /** Loại DB -> chọn driver. */
  client: DbClient;

  /* ── Bắt buộc: định danh máy chủ ── */
  /** IP/hostname máy chủ DB. KHÔNG phải URL của web app. */
  host: string;
  /** Cổng. MySQL mặc định 3306, PostgreSQL 5432. */
  port: number;
  /** Tên database (schema) cần truy vấn. */
  database: string;

  /* ── Bắt buộc: thông tin đăng nhập ── */
  /** User DB. Nên xin user CHỈ CÓ QUYỀN SELECT cho mục đích test. */
  user: string;
  password: string;

  /* ── Tuỳ chọn: bảo mật đường truyền ── */
  /**
   * Bật khi DB nằm ngoài mạng nội bộ và yêu cầu TLS.
   * rejectUnauthorized=false chỉ dùng cho server self-signed ở môi trường test.
   */
  ssl?: { rejectUnauthorized: boolean };

  /* ── Tuỳ chọn: pool & timeout ── */
  /**
   * Số kết nối tối đa trong pool.
   * Để >= số worker của Playwright, nếu không các worker sẽ xếp hàng chờ nhau.
   */
  connectionLimit: number;
  /** Timeout khi mở kết nối (ms). */
  connectTimeout: number;
  /** Timeout cho 1 câu truy vấn (ms). Tránh test treo vì query nặng. */
  queryTimeout: number;

  /* ── An toàn ── */
  /**
   * true = CHẶN mọi câu lệnh ghi (INSERT/UPDATE/DELETE/DROP...).
   * Mặc định BẬT. Chỉ tắt khi chắc chắn đang trỏ vào DB test riêng,
   * vì cenrm.doubletc.com là môi trường dùng chung.
   */
  readOnly: boolean;
}

/* ══════════════════════ Đọc biến môi trường ══════════════════════ */

function env(key: string): string | undefined {
  const value = process.env[key];
  return value === undefined || value.trim() === "" ? undefined : value.trim();
}

function envNumber(key: string, fallback: number): number {
  const raw = env(key);
  if (raw === undefined) return fallback;

  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`[db.config] ${key}="${raw}" không phải số hợp lệ.`);
  }
  return parsed;
}

function envBool(key: string, fallback: boolean): boolean {
  const raw = env(key)?.toLowerCase();
  if (raw === undefined) return fallback;
  return raw === "1" || raw === "true" || raw === "yes";
}

/* ══════════════════════ Dựng & kiểm tra cấu hình ══════════════════════ */

/** Các biến BẮT BUỘC phải có, thiếu là báo lỗi ngay thay vì fail giữa test. */
const REQUIRED_ENV = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"] as const;

/**
 * Trả về cấu hình đã kiểm tra đủ trường.
 * Ném lỗi có hướng dẫn cụ thể nếu thiếu biến - tốt hơn là để driver
 * báo "ECONNREFUSED" khó đoán nguyên nhân.
 */
export function getDbConfig(): DbConfig {
  const missing = REQUIRED_ENV.filter((key) => env(key) === undefined);
  if (missing.length > 0) {
    throw new Error(
      `[db.config] Thiếu biến môi trường: ${missing.join(", ")}.\n` +
        `Xem .env.example (ngang hàng playwright.config.ts) để biết cần set những gì.`,
    );
  }

  const client = (env("DB_CLIENT") ?? "mysql") as DbClient;
  const defaultPort = client === "pg" ? 5432 : 3306;

  return {
    client,
    host: env("DB_HOST")!,
    port: envNumber("DB_PORT", defaultPort),
    database: env("DB_NAME")!,
    user: env("DB_USER")!,
    password: env("DB_PASSWORD")!,
    ssl: envBool("DB_SSL", false) ? { rejectUnauthorized: envBool("DB_SSL_STRICT", true) } : undefined,
    connectionLimit: envNumber("DB_POOL_SIZE", 5),
    connectTimeout: envNumber("DB_CONNECT_TIMEOUT", 10_000),
    queryTimeout: envNumber("DB_QUERY_TIMEOUT", 15_000),
    readOnly: envBool("DB_READONLY", true),
  };
}

/** true nếu đã cấu hình đủ để kết nối - dùng để test.skip() khi chưa có DB. */
export function isDbConfigured(): boolean {
  return REQUIRED_ENV.every((key) => env(key) !== undefined);
}

/** Chuỗi mô tả kết nối, ĐÃ che mật khẩu - an toàn để log. */
export function describeDbConfig(config: DbConfig): string {
  return `${config.client}://${config.user}:***@${config.host}:${config.port}/${config.database}` +
    ` (pool=${config.connectionLimit}, readOnly=${config.readOnly})`;
}
