/**
 * Timeout theo TỪNG LOẠI HÀNH ĐỘNG.
 *
 * Nguyên tắc: hành động càng nặng (gõ từng ký tự, upload, tải file, điều hướng)
 * thì timeout càng dài; element "có thì xử lý, không có thì bỏ qua" phải fail
 * thật nhanh để không làm chậm cả bộ test.
 *
 * 3 mức can thiệp, từ hẹp tới rộng:
 *   1. Từng lời gọi : await this.click(btn, 25_000)
 *   2. Cả 1 file/suite: configureTimeouts({ dropdown: 30_000 })
 *   3. Toàn dự án   : sửa DEFAULT_TIMEOUT bên dưới
 */
export interface Timeouts {
  /** Element có thể không tồn tại (popup, banner) - fail nhanh. */
  optional: number;
  click: number;
  /** fill() - điền thẳng cả chuỗi. */
  input: number;
  /** pressSequentially() - gõ từng ký tự nên lâu hơn nhiều. */
  type: number;
  /** Thẻ select chuẩn - option có sẵn trong DOM. */
  select: number;
  /** Combobox JS - phải chờ gọi API rồi render option. */
  dropdown: number;
  upload: number;
  download: number;
  /** Chờ element xuất hiện. */
  visible: number;
  /** Các hàm verify*. */
  verify: number;
  navigation: number;
  /** Timeout cho cả một test case (dùng trong playwright.config.ts). */
  test: number;
}

/** Giá trị mặc định của dự án. */
export const DEFAULT_TIMEOUT: Readonly<Timeouts> = {
  optional: 3_000,
  click: 10_000,
  input: 10_000,
  type: 30_000,
  select: 10_000,
  dropdown: 15_000,
  upload: 30_000,
  download: 60_000,
  visible: 10_000,
  verify: 10_000,
  navigation: 45_000,
  test: 60_000,
};

/** Bảng timeout đang áp dụng. Đọc ở mọi nơi qua `TIMEOUT.<key>`. */
export const TIMEOUT: Timeouts = { ...DEFAULT_TIMEOUT };

/**
 * Chỉnh timeout lúc chạy - ví dụ môi trường staging chậm:
 *   test.beforeAll(() => configureTimeouts({ navigation: 90_000 }));
 */
export function configureTimeouts(overrides: Partial<Timeouts>): void {
  Object.assign(TIMEOUT, overrides);
}

/** Nhân toàn bộ timeout với một hệ số (CI yếu: scaleTimeouts(2)). */
export function scaleTimeouts(factor: number): void {
  for (const key of Object.keys(TIMEOUT) as (keyof Timeouts)[]) {
    TIMEOUT[key] = Math.round(DEFAULT_TIMEOUT[key] * factor);
  }
}

/** Trả về mặc định ban đầu (dùng trong afterAll nếu đã configure). */
export function resetTimeouts(): void {
  Object.assign(TIMEOUT, DEFAULT_TIMEOUT);
}
