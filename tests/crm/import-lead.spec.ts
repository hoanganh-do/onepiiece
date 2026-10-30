import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import os from "node:os";

/* ══════════════════════════════════════════════════════════════════════
 *  Chức năng: IMPORT LEAD ("Tạo lần nhập lead")
 *  Luồng chính: Tải file mẫu XLSX từ hệ thống → chọn LẠI đúng file vừa tải
 *               vào ô "File nhập" → kiểm tra dữ liệu.
 *
 *  Locator LẤY TRỰC TIẾP từ DOM (F12):
 *    - a[href*="download-sample/leads"]        → link "Tải file mẫu XLSX"
 *    - input[name="import_file"]               → ô "File nhập *" (accept .xlsx,.xls)
 *    - #lead-import-validate-button            → nút "Kiểm tra dữ liệu nhập"
 *    - button[type="submit"].primary-button    → nút "Lưu lần nhập"
 *    - select[name="source_id"]  (#source-id)  → "Nguồn *"
 *    - select[name="pipeline_id"]              → "Quy Trình *"
 *    - select[name="entity_type"] (#import-type, value="leads") → "Loại dữ liệu *"
 *    - #lead-import-validation-result          → khu vực kết quả kiểm tra (aria-live)
 *
 *  ⚠️ Khối "Cấu hình xử lý" CHƯA chụp được locator → dưới đây là locator GỢI Ý,
 *     cần mở F12 xem lại đúng thuộc tính name/id rồi chỉnh (đã đánh dấu TODO).
 * ════════════════════════════════════════════════════════════════════ */

const BASE_URL = "https://cenrm.doubletc.com";
const LOGIN_URL = `${BASE_URL}/workspace/login`;
// Suy ra từ URL validate/sample trong DOM (.../workspace/leads/imports/create/validate)
const LEAD_IMPORT_URL = `${BASE_URL}/workspace/leads/imports/create`;

const ACCOUNT = {
  email: "admincentest1@cenrm.com",
  password: "Cen@123",
};

// ID chạy động cho mỗi lần chạy → tách thư mục tải file, không đụng nhau
const RUN_ID = `${Date.now()}`;

/* ─────────────────────────────────────────────────────────────────────
 *  Tập hợp locator của màn hình import
 * ───────────────────────────────────────────────────────────────────── */
function importForm(page: Page) {
  return {
    heading: page.getByText("Tạo lần nhập lead", { exact: true }),

    // Thông tin chung
    source: page.locator('select[name="source_id"]'),        // Nguồn *
    pipeline: page.locator('select[name="pipeline_id"]'),    // Quy Trình *
    entityType: page.locator('select[name="entity_type"]'),  // Loại dữ liệu * (#import-type)
    sampleLink: page.getByRole("link", { name: /Tải file mẫu/i }),
    fileInput: page.locator('input[name="import_file"]'),    // File nhập *

    // Nút hành động
    validateButton: page.locator("#lead-import-validate-button"), // "Kiểm tra dữ liệu nhập"
    saveButton: page.getByRole("button", { name: "Lưu lần nhập" }),

    // Kết quả kiểm tra dữ liệu
    validationResult: page.locator("#lead-import-validation-result"),

    // ── Khối "Cấu hình xử lý" (locator GỢI Ý – TODO: xác nhận lại qua F12) ──
    action: page.locator('select[name="action"]'),                // Hành động *
    errorHandling: page.locator('select[name="error_handling"]'), // Cách xử lý lỗi *
    allowedErrors: page.locator('input[name="allowed_errors"]'),  // Số lỗi cho phép *
    queueToggle: page.locator('input[type="checkbox"]').last(),   // Xử lý bằng queue
  };
}

/* ─────────────────────────────────────────────────────────────────────
 *  Helper: đăng nhập (giống logincrm.spec.ts)
 * ───────────────────────────────────────────────────────────────────── */
async function login(page: Page) {
  await page.goto(LOGIN_URL);
  await page.getByRole("textbox", { name: "Địa Chỉ Email" }).fill(ACCOUNT.email);
  await page.getByPlaceholder("Mật khẩu").fill(ACCOUNT.password);
  await page.getByLabel("Đăng Nhập", { exact: true }).click();
  await expect(page).toHaveTitle(/Bảng Điều Khiển/);

  const dismiss = page.locator("#onesignal-slidedown-cancel-button");
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
  }
}

/* ─────────────────────────────────────────────────────────────────────
 *  Helper: tải file mẫu do hệ thống sinh ra và trả về ĐƯỜNG DẪN ĐỘNG.
 *  - Tên file lấy động từ download.suggestedFilename() (không fix cứng).
 *  - Lưu vào thư mục tạm riêng theo RUN_ID.
 * ───────────────────────────────────────────────────────────────────── */
async function downloadSampleFile(page: Page): Promise<string> {
  const f = importForm(page);

  // Link có target="_blank"; bắt sự kiện download ngay khi click.
  const downloadPromise = page.waitForEvent("download");
  await f.sampleLink.click();
  const download = await downloadPromise;
  // Nếu môi trường của bạn mở tab mới rồi mới tải, thay bằng:
  //   const popup = await page.context().waitForEvent("page");
  //   const download = await popup.waitForEvent("download");

  const savePath = path.join(
    os.tmpdir(),
    "cenrm-samples",
    RUN_ID,
    download.suggestedFilename(), // ví dụ: leads-sample.xlsx (do server đặt tên)
  );
  await download.saveAs(savePath); // saveAs tự tạo thư mục cha
  return savePath;
}

/* ─────────────────────────────────────────────────────────────────────
 *  Setup: đăng nhập + mở màn hình import
 * ───────────────────────────────────────────────────────────────────── */
test.beforeEach(async ({ page }) => {
  test.setTimeout(60_000); // login + tải file thật cần > timeout mặc định (10s)
  await login(page);
  await page.goto(LEAD_IMPORT_URL);
  await expect(importForm(page).fileInput).toBeVisible();
});

test.describe("Import lead từ file mẫu", () => {
  /* ── CA CƠ BẢN: tải file mẫu → chọn lại đúng file đó ─────────────── */
  test("TC01 - Tải file mẫu XLSX rồi chọn lại đúng file vừa tải vào ô File nhập", async ({
    page,
  }) => {
    const f = importForm(page);

    // Đảm bảo Loại dữ liệu = Lead để khớp file mẫu (mặc định value="leads")
    await f.entityType.selectOption("leads");

    // 1) Tải file mẫu (tên & đường dẫn đều động)
    const samplePath = await downloadSampleFile(page);
    expect(samplePath.toLowerCase()).toMatch(/\.(xlsx|xls)$/);

    // 2) Chọn LẠI đúng file vừa tải vào ô "File nhập *"
    await f.fileInput.setInputFiles(samplePath);

    // 3) Xác nhận input đã nhận đúng file (tên file lấy động từ đường dẫn)
    const attached = await f.fileInput.inputValue();
    expect(attached).toContain(path.basename(samplePath));
  });

  /* ── CA MỞ RỘNG: kiểm tra dữ liệu nhập với file mẫu vừa tải ──────── */
  test("TC02 - Kiểm tra dữ liệu nhập (validate) với file mẫu hợp lệ", async ({
    page,
  }) => {
    const f = importForm(page);

    const samplePath = await downloadSampleFile(page);
    await f.fileInput.setInputFiles(samplePath);

    await f.validateButton.click();

    // Khu vực kết quả (aria-live="polite") phải hiển thị kết quả kiểm tra
    await expect(f.validationResult).toBeVisible();
    // TODO: bổ sung assert nội dung "hợp lệ / X bản ghi" khi biết text thực tế
  });

  /* ── CA BẤT THƯỜNG: chọn file sai định dạng → phải báo lỗi ───────── */
  test("TC03 - Upload file sai định dạng (.txt) phải báo lỗi khi kiểm tra", async ({
    page,
  }) => {
    const f = importForm(page);

    // Tạo file rác ngay trong bộ nhớ (dữ liệu động, không cần file thật trên đĩa)
    await f.fileInput.setInputFiles({
      name: `invalid-${RUN_ID}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from("day khong phai file excel hop le"),
    });

    await f.validateButton.click();

    // Kỳ vọng: vẫn ở màn hình import và có thông báo lỗi
    await expect(page).toHaveURL(/imports\/create/);
    await expect(f.validationResult).toBeVisible();
    // TODO: chỉnh assert cho khớp đúng text lỗi ("Định dạng không hợp lệ", ...)
    // await expect(f.validationResult).toContainText(/không hợp lệ|lỗi|invalid/i);
  });
});
