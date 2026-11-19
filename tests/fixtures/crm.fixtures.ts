import { test as base, expect, type Page } from "@playwright/test";
import { LeadFormPage } from "../pages/LeadFormPage.js";
import { LeadListPage } from "../pages/LeadListPage.js";

/**
 * CUSTOM FIXTURE cho CenRM.
 *
 * Gom các bước chuẩn bị đang bị lặp trong beforeEach của từng spec
 * (đăng nhập -> đóng popup -> vào đúng màn -> new Page Object) về 1 chỗ,
 * kèm luôn phần dọn dẹp sau test.
 *
 * Cách dùng trong spec:
 *   import { test, expect } from "../fixtures/crm.fixtures.js";
 *
 *   test("TC01 ...", async ({ leadFormPage }) => {   // đã ở sẵn form tạo lead
 *     await leadFormPage.createLead({ ... });
 *   });
 *
 * Fixture là LAZY: khai gì trong ngoặc thì mới chạy cái đó.
 *   ({ loggedInPage })  -> chỉ đăng nhập, không vào màn lead.
 *   ({ leadListPage })  -> đăng nhập + mở màn Khách hàng tiềm năng.
 *   ({ leadFormPage })  -> thêm bước chọn quy trình + mở form tạo lead.
 *
 * File này KHÔNG sửa gì trong spec/page object hiện có - các spec cũ vẫn
 * chạy nguyên trạng, muốn chuyển sang fixture thì đổi dòng import là xong.
 */

/* ══════════════════════ Hằng số ══════════════════════ */

export const BASE_URL = "https://cenrm.doubletc.com";
export const LOGIN_URL = `${BASE_URL}/workspace/login`;

/** Tài khoản mặc định - trùng với logincrm.spec.ts / create-lead.spec.ts. */
export const DEFAULT_ACCOUNT = {
  email: "admincentest1@cenrm.com",
  password: "Cen@123",
};

export interface Account {
  email: string;
  password: string;
}

/* ══════════════════════ Kiểu fixture ══════════════════════ */

/**
 * OPTION fixture: giá trị cấu hình, override được bằng test.use({...})
 * ở cấp file hoặc describe, hoặc bằng `use.account` trong playwright.config.ts.
 */
export interface CrmOptions {
  /** Tài khoản dùng để đăng nhập. */
  account: Account;
  /** Từ khoá chọn quy trình ở màn Khách hàng tiềm năng. */
  pipelineKeyword: string;
}

/** WORKER fixture: chạy 1 lần cho mỗi worker, không phải mỗi test. */
export interface CrmWorkerFixtures {
  /** Nơi gom dấu vết dữ liệu test để dọn ở cuối worker. */
  testDataTracker: TestDataTracker;
}

/** TEST fixture: dựng mới cho từng test, tự teardown sau test. */
export interface CrmFixtures {
  /** Page đã đăng nhập sẵn + đã đóng popup OneSignal. */
  loggedInPage: Page;
  /** LeadListPage đang đứng ở màn /workspace/leads. */
  leadListPage: LeadListPage;
  /** LeadFormPage đang mở sẵn form tạo lead của quy trình đã chọn. */
  leadFormPage: LeadFormPage;
}

/* ══════════════════════ Dọn dẹp dữ liệu test ══════════════════════ */

/**
 * Sổ ghi dữ liệu test đã tạo.
 *
 * Hiện tại chỉ GHI LẠI và in ra cuối worker, chưa gọi xoá thật vì chưa có
 * API/đường dẫn xoá lead được xác nhận. Khi có rồi thì chỉ cần sửa
 * `cleanup()` bên dưới, spec không phải đụng tới.
 */
export class TestDataTracker {
  private readonly leadTitles: string[] = [];

  /** Gọi ngay sau khi tạo lead thành công: tracker.trackLead(title). */
  trackLead(title: string): void {
    this.leadTitles.push(title);
  }

  get tracked(): readonly string[] {
    return this.leadTitles;
  }

  /** Chạy ở cuối worker. TODO: thay console.log bằng lời gọi xoá thật. */
  async cleanup(): Promise<void> {
    if (this.leadTitles.length === 0) return;

    console.log(
      `[cleanup] ${this.leadTitles.length} lead đã tạo trong lượt chạy này:\n  - ` +
        this.leadTitles.join("\n  - "),
    );
    this.leadTitles.length = 0;
  }
}

/* ══════════════════════ Bước đăng nhập ══════════════════════ */

/**
 * Đăng nhập + đóng popup OneSignal.
 * Locator giữ y hệt logincrm.spec.ts để không lệch hành vi so với bản cũ.
 */
async function login(page: Page, account: Account): Promise<void> {
  await page.goto(LOGIN_URL);
  await page.getByRole("textbox", { name: "Địa Chỉ Email" }).fill(account.email);
  await page.getByPlaceholder("Mật khẩu").fill(account.password);
  await page.getByLabel("Đăng Nhập", { exact: true }).click();
  await expect(page).toHaveTitle(/Bảng Điều Khiển/);

  // Popup thông báo đẩy: có thì đóng, không có thì bỏ qua (không được fail).
  const dismiss = page.locator("#onesignal-slidedown-cancel-button");
  if (await dismiss.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await dismiss.click();
  }
}

/* ══════════════════════ Khai báo fixture ══════════════════════ */

export const test = base.extend<CrmOptions & CrmFixtures, CrmWorkerFixtures>({
  /* ── Option: override bằng test.use({ ... }) ─────────────────── */

  account: [DEFAULT_ACCOUNT, { option: true }],
  pipelineKeyword: ["Mua - Bán", { option: true }],

  /* ── Worker fixture: 1 lần / worker ──────────────────────────── */

  testDataTracker: [
    async ({}, use) => {
      const tracker = new TestDataTracker();
      await use(tracker); // <- phần trước use() là SETUP
      await tracker.cleanup(); // <- phần sau use() là TEARDOWN
    },
    { scope: "worker" },
  ],

  /* ── Test fixture: 1 lần / test ──────────────────────────────── */

  /** Đăng nhập sẵn. Mọi fixture bên dưới đều dựng trên page này. */
  loggedInPage: async ({ page, account }, use) => {
    await login(page, account);
    await use(page);
    // Teardown: context của `page` do Playwright tự đóng sau mỗi test,
    // nên ở đây không cần làm gì thêm. Nếu sau này cần logout hay xoá
    // localStorage thì đặt vào đúng chỗ này.
  },

  /** Đã ở màn Khách hàng tiềm năng. */
  leadListPage: async ({ loggedInPage }, use) => {
    const leadList = new LeadListPage(loggedInPage);
    await leadList.openFromSidebar();
    await use(leadList);
  },

  /** Đã chọn quy trình + đã mở form tạo lead (có sanity check). */
  leadFormPage: async ({ leadListPage, loggedInPage, pipelineKeyword }, use) => {
    await leadListPage.selectPipeline(pipelineKeyword);
    await leadListPage.openCreateLeadForm();

    const leadForm = new LeadFormPage(loggedInPage);
    await leadForm.verifyFormLoaded();
    await use(leadForm);
  },
});

export { expect } from "@playwright/test";
