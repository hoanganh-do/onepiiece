import { expect, test, type Page } from "@playwright/test";
import { LeadFormPage } from "../pages/LeadFormPage.js";
import { LeadListPage } from "../pages/LeadListPage.js";

/* ══════════════════════════════════════════════════════════════════════
 *  Chức năng: TẠO KHÁCH HÀNG TIỀM NĂNG (Create Lead)
 *  Hệ thống : CenRM (nền tảng Krayin CRM) - https://cenrm.doubletc.com
 *
 *  Locator được LẤY TRỰC TIẾP từ DOM qua F12:
 *    - input[name="person[contact_numbers][0][value]"]  → SĐT/Liên hệ
 *    - input[name="person[citizen_id]"]  (placeholder "Nhập 12 số CCCD")
 *    - input[name="person[birthday]"]    (flatpickr)
 *    - select[name="person[gender]"]     → Giới tính
 *    - input[name="person[address]"]     → Địa chỉ
 *    - #title / #description / #form / #lead_value / #lead_type_id / #lead_source_id
 *
 *  Các test case chạy qua LeadFormPage (tests/pages/LeadFormPage.ts, kế thừa
 *  BasePage). Hai helper leadForm() + setPersonName() bên dưới GIỮ NGUYÊN làm
 *  bản tham chiếu/dự phòng - cùng nội dung đã đóng gói trong page object.
 *
 *  ⚠️ Các điểm CHƯA thấy trong ảnh F12 → đã đánh dấu TODO để chỉnh lại:
 *    - LEAD_CREATE_URL  (đường dẫn màn hình tạo lead)
 *    - Nút Lưu / submit
 *    - Text thông báo thành công & text lỗi validate
 * ════════════════════════════════════════════════════════════════════ */

const BASE_URL = "https://cenrm.doubletc.com";
const LOGIN_URL = `${BASE_URL}/workspace/login`;
// TODO: xác nhận lại path màn hình tạo lead (Krayin mặc định là /admin/leads/create)
const LEAD_CREATE_URL = `${BASE_URL}/workspace/leads/create`;

const ACCOUNT = {
  email: "admincentest1@cenrm.com",
  password: "Cen@123",
};

/** Từ khoá tìm quy trình ở dropdown trên màn Khách hàng tiềm năng. */
const PIPELINE_KEYWORD = "Mua - Bán";

/* ─────────────────────────────────────────────────────────────────────
 *  Tập hợp locator của form (1 nơi duy nhất để dễ bảo trì)
 *  Giữ nguyên bản gốc; bản đã tối ưu nằm trong LeadFormPage.
 * ───────────────────────────────────────────────────────────────────── */
function leadForm(page: Page) {
  return {
    // Khối "Thông Tin Về Khách Hàng"
    personNameBox: page.getByText("Nhấn để Thêm", { exact: true }), // combobox "Tên *"
    personNameInput: page.locator('input[name="person[name]"]'), // fallback nếu là input thường
    contactValue: page.locator(
      'input[name="person[contact_numbers][0][value]"]',
    ),
    citizenId: page.locator('input[name="person[citizen_id]"]'),
    birthday: page.locator('input[name="person[birthday]"]'),
    gender: page.locator('select[name="person[gender]"]'),
    address: page.locator('input[name="person[address]"]'),

    // Khối "Chi Tiết"
    title: page.locator("#title"),
    description: page.locator("#description"),
    form: page.locator("#form"),
    leadValue: page.locator("#lead_value"),
    leadType: page.locator("#lead_type_id"),
    leadSource: page.locator("#lead_source_id"),

    // TODO: chỉnh lại đúng nút lưu trên UI (chưa có trong ảnh F12)
    submit: page.getByRole("button", { name: /^(Lưu|Lưu Lại|Save|Tạo)/i }),
  };
}

/* ─────────────────────────────────────────────────────────────────────
 *  Helper: đăng nhập (dùng đúng locator như logincrm.spec.ts)
 * ───────────────────────────────────────────────────────────────────── */
async function login(page: Page) {
  await page.goto(LOGIN_URL);
  await page
    .getByRole("textbox", { name: "Địa Chỉ Email" })
    .fill(ACCOUNT.email);
  await page.getByPlaceholder("Mật khẩu").fill(ACCOUNT.password);
  await page.getByLabel("Đăng Nhập", { exact: true }).click();
  await expect(page).toHaveTitle(/Bảng Điều Khiển/);
  


  test.setTimeout(30_000);
  // Đóng popup thông báo đẩy (OneSignal) nếu xuất hiện
  const dismiss = page.locator("#onesignal-slidedown-cancel-button");
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
  }
}

/* ─────────────────────────────────────────────────────────────────────
 *  Helper: nhập "Tên *" - phòng cả 2 trường hợp input thường / combobox
 *  Giữ nguyên bản gốc; bản đã tối ưu là LeadFormPage.setPersonName().
 * ───────────────────────────────────────────────────────────────────── */
async function setPersonName(page: Page, name: string) {
  const f = leadForm(page);
  if (await f.personNameInput.count()) {
    await f.personNameInput.first().fill(name);
    return;
  }
  // Combobox "Nhấn để Thêm": click mở → gõ tên → chọn/tạo mới
  await f.personNameBox.click();
  const search = page.getByPlaceholder(/Tìm|Search|Nhập tên/i).first();
  await search.fill(name);
  await page.keyboard.press("Enter");
}

/* ─────────────────────────────────────────────────────────────────────
 *  beforeEach: đăng nhập + mở màn hình tạo lead
 * ───────────────────────────────────────────────────────────────────── */
let leadFormPage: LeadFormPage;

test.beforeEach(async ({ page }) => {
  await login(page);

  // Vào màn Khách hàng tiềm năng -> chọn quy trình -> mở form tạo lead.
  // Toàn bộ thao tác nằm trong LeadListPage (kế thừa BasePage).
  await new LeadListPage(page).goToCreateLeadForm(PIPELINE_KEYWORD);

  leadFormPage = new LeadFormPage(page);
  await leadFormPage.verifyFormLoaded(); // sanity check đã vào đúng form
});

test.describe("Tạo khách hàng tiềm năng", () => {
  /* ── CA CƠ BẢN (Happy path) ─────────────────────────────────────── */
  test("TC01 - Tạo lead với thông tin hợp lệ", async () => {
    const unique = Date.now();

    await leadFormPage.createLead({
      // Thông tin khách hàng
      personName: `KH Tự Động ${unique}`,
      contactValue: "0987654321",
      address: "123 Đường Test, Quận 1",

      // Chi tiết lead
      title: `Yêu cầu tự động ${unique}`,
      description: "Lead tạo tự động bởi Playwright - happy path",
      leadValue: "1000000",
      leadType: 1, // "Dự án *" - chọn dự án đầu tiên (bỏ qua placeholder)
      // "Hình thức" giữ mặc định "Không xác định", "Nguồn" giữ mặc định "Email - Cenhomes"
    });

    // Kỳ vọng: tạo thành công → rời khỏi trang /create
    await leadFormPage.verifyCreateSucceeded();
    // (tuỳ chọn) kiểm tra toast thành công - chỉnh text cho khớp thực tế:
    // await leadFormPage.verifyMessage(/thành công|success/i);
  });

  /* ── CA BẤT THƯỜNG 1: bỏ trống trường bắt buộc ──────────────────── */
  test("TC02 - Bỏ trống trường bắt buộc thì không tạo được", async () => {
    // Không nhập gì, bấm Lưu ngay
    await leadFormPage.clickSubmit();

    // Kỳ vọng: vẫn ở trang tạo và có thông báo lỗi bắt buộc
    await leadFormPage.verifyStayOnFormWithError(
      /bắt buộc|không được để trống|required/i,
    );
  });

  /* ── CA BẤT THƯỜNG 2: CCCD sai định dạng ────────────────────────── */
  test("TC03 - CCCD không đủ 12 số phải báo lỗi", async () => {
    const unique = Date.now();

    await leadFormPage.createLead({
      personName: `KH CCCD ${unique}`,
      title: `Yêu cầu CCCD ${unique}`,
      leadType: 1,
      citizenId: "123abc", // sai: có chữ và không đủ 12 số
    });

    // Kỳ vọng: vẫn ở trang tạo và báo lỗi CCCD
    // TODO: chỉnh regex cho khớp đúng text lỗi thực tế của hệ thống
    await leadFormPage.verifyStayOnFormWithError(
      /CCCD|căn cước|12 số|không hợp lệ/i,
    );
  });
});
