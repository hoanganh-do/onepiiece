import { expect, type Locator, type Page } from "@playwright/test";
import { TIMEOUT } from "./timeouts.js";

export { TIMEOUT, configureTimeouts, scaleTimeouts, resetTimeouts } from "./timeouts.js";

/**
 * Cho phép truyền vào Locator có sẵn HOẶC chuỗi selector.
 * => Page object con muốn viết kiểu nào cũng được:
 *      await this.click(this.submitButton);
 *      await this.click("#submit");
 */
export type Target = Locator | string;

/** Tuỳ chọn cho dropdown động (combobox tự render bằng JS, không phải thẻ select). */
export interface DropdownOptions {
  /** Ô tìm kiếm hiện ra sau khi mở dropdown. Bỏ trống = gõ thẳng vào chính trigger. */
  searchBox?: Target;
  /** Phạm vi chứa danh sách option. Bỏ trống = tìm trong cả trang. */
  optionList?: Target;
  /** true = khớp tuyệt đối text option; false = chỉ cần chứa. */
  exact?: boolean;
  /** true = gõ xong nhấn Enter luôn (combobox kiểu "nhập để tạo mới"). */
  pressEnter?: boolean;
  /** Chờ option render - mặc định TIMEOUT.dropdown. */
  timeout?: number;
  /**
   * Chờ cứng (ms) sau khi gõ từ khoá, trước khi tìm option.
   * Mặc định 0 vì Playwright đã tự chờ option hiện ra; chỉ dùng khi dropdown
   * gọi API có debounce và danh sách cũ còn hiển thị gây click nhầm.
   */
  settleMs?: number;
}

/**
 * Lớp cha của mọi Page Object.
 *
 * Chứa các hàm thao tác cơ bản (input / click / chọn dropdown / verify)
 * để page object con chỉ cần khai báo locator + viết hàm nghiệp vụ,
 * không phải lặp lại `await page.locator(...).fill(...)` ở khắp nơi.
 *
 * Mỗi hàm có timeout mặc định riêng theo loại hành động (xem timeouts.ts)
 * và đều nhận tham số `timeout` cuối cùng để ghi đè cho từng trường hợp:
 *      await this.click(this.heavyButton, 30_000);
 */
export abstract class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /* ══════════════════════ Điều hướng ══════════════════════ */

  /** Mở một đường dẫn (tương đối với baseURL, hoặc URL đầy đủ). */
  async goto(path: string, timeout = TIMEOUT.navigation): Promise<void> {
    await this.page.goto(path, { timeout });
  }

  async reload(timeout = TIMEOUT.navigation): Promise<void> {
    await this.page.reload({ timeout });
  }

  get currentUrl(): string {
    return this.page.url();
  }

  /** Chuẩn hoá Target thành Locator. Mọi hàm bên dưới đều đi qua đây. */
  protected locator(target: Target): Locator {
    return typeof target === "string" ? this.page.locator(target) : target;
  }

  /* ══════════════════════ Nhập liệu ══════════════════════ */

  /** Điền text (tự xoá nội dung cũ). */
  protected async input(target: Target, value: string, timeout = TIMEOUT.input): Promise<void> {
    await this.locator(target).fill(value, { timeout });
  }

  /** Chỉ điền khi có dữ liệu - dùng cho form nhiều trường không bắt buộc. */
  protected async inputIfHasValue(
    target: Target,
    value?: string | null,
    timeout = TIMEOUT.input,
  ): Promise<void> {
    if (value === undefined || value === null || value === "") return;
    await this.input(target, value, timeout);
  }

  /** Gõ từng ký tự - cho ô autocomplete cần trigger sự kiện bàn phím. */
  protected async typeText(
    target: Target,
    value: string,
    delay = 50,
    timeout = TIMEOUT.type,
  ): Promise<void> {
    const element = this.locator(target);
    await element.click({ timeout: TIMEOUT.click });
    await element.fill("", { timeout: TIMEOUT.input });
    await element.pressSequentially(value, { delay, timeout });
  }

  protected async clearText(target: Target, timeout = TIMEOUT.input): Promise<void> {
    await this.locator(target).fill("", { timeout });
  }

  protected async uploadFile(
    target: Target,
    filePath: string | string[],
    timeout = TIMEOUT.upload,
  ): Promise<void> {
    await this.locator(target).setInputFiles(filePath, { timeout });
  }

  /* ══════════════════════ Click / phím ══════════════════════ */

  protected async click(target: Target, timeout = TIMEOUT.click): Promise<void> {
    await this.locator(target).click({ timeout });
  }

  /**
   * Click nếu element đang hiển thị. Trả về true nếu đã click (popup, banner...).
   * `waitFor` để ngắn (TIMEOUT.optional) vì element này có thể không bao giờ xuất hiện.
   */
  protected async clickIfVisible(target: Target, waitFor = TIMEOUT.optional): Promise<boolean> {
    const element = this.locator(target);
    const visible = await element.isVisible({ timeout: waitFor }).catch(() => false);
    if (visible) await element.click({ timeout: TIMEOUT.click });
    return visible;
  }

  protected async setCheckbox(
    target: Target,
    checked: boolean,
    timeout = TIMEOUT.click,
  ): Promise<void> {
    await this.locator(target).setChecked(checked, { timeout });
  }

  protected async pressKey(target: Target, key: string, timeout = TIMEOUT.click): Promise<void> {
    await this.locator(target).press(key, { timeout });
  }

  /* ══════════════════════ Dropdown ══════════════════════ */

  /** Thẻ select chuẩn - chọn theo value. */
  protected async selectByValue(
    target: Target,
    value: string,
    timeout = TIMEOUT.select,
  ): Promise<void> {
    await this.locator(target).selectOption(value, { timeout });
  }

  /** Thẻ select chuẩn - chọn theo text hiển thị. */
  protected async selectByLabel(
    target: Target,
    label: string,
    timeout = TIMEOUT.select,
  ): Promise<void> {
    await this.locator(target).selectOption({ label }, { timeout });
  }

  /** Thẻ select chuẩn - chọn theo vị trí (index 1 = bỏ qua option placeholder). */
  protected async selectByIndex(
    target: Target,
    index: number,
    timeout = TIMEOUT.select,
  ): Promise<void> {
    await this.locator(target).selectOption({ index }, { timeout });
  }

  /**
   * Dropdown ĐỘNG: combobox do JS render, option chỉ xuất hiện sau khi mở,
   * có thể kèm ô tìm kiếm.
   *
   *   // chọn option có sẵn trong danh sách
   *   await this.selectFromDropdown(this.projectBox, "Dự án A");
   *
   *   // gõ vào ô tìm kiếm rồi Enter để tạo mới
   *   await this.selectFromDropdown(this.nameBox, "KH 123", {
   *     searchBox: this.nameSearch,
   *     pressEnter: true,
   *   });
   *
   *   // danh sách tải chậm -> nới riêng lời gọi này
   *   await this.selectFromDropdown(this.projectBox, "Dự án A", { timeout: 40_000 });
   */
  protected async selectFromDropdown(
    trigger: Target,
    optionText: string,
    options: DropdownOptions = {},
  ): Promise<void> {
    const { searchBox, optionList, exact = false, pressEnter = false, settleMs = 0 } = options;
    const timeout = options.timeout ?? TIMEOUT.dropdown;

    // 1. Mở dropdown
    await this.click(trigger);

    // 2. Gõ từ khoá để lọc (nếu dropdown có ô nhập)
    const search = this.locator(searchBox ?? trigger);
    const canType = await search.isEditable({ timeout: TIMEOUT.optional }).catch(() => false);
    if (canType) {
      await search.fill(optionText, { timeout: TIMEOUT.input });
      if (settleMs > 0) await this.page.waitForTimeout(settleMs);
    }

    // 3a. Kiểu "nhập để tạo mới": Enter là xong
    if (pressEnter) {
      await search.press("Enter", { timeout: TIMEOUT.click });
      return;
    }

    // 3b. Kiểu chọn từ danh sách: chờ option render rồi click
    const scope = optionList ? this.locator(optionList) : this.page;
    // visible: true để bỏ qua option đang bị ẩn (nhiều dropdown lọc bằng
    // display:none chứ không xoá khỏi DOM) -> tránh click trúng dòng cũ.
    const option = scope.getByText(optionText, { exact }).filter({ visible: true }).first();
    await expect(option).toBeVisible({ timeout });
    await option.click({ timeout: TIMEOUT.click });
  }

  /* ══════════════════════ Lấy dữ liệu ══════════════════════ */

  protected async getText(target: Target, timeout = TIMEOUT.visible): Promise<string> {
    return (await this.locator(target).innerText({ timeout })).trim();
  }

  protected async getValue(target: Target, timeout = TIMEOUT.visible): Promise<string> {
    return this.locator(target).inputValue({ timeout });
  }

  protected async count(target: Target): Promise<number> {
    return this.locator(target).count();
  }

  protected async exists(target: Target): Promise<boolean> {
    return (await this.count(target)) > 0;
  }

  protected async isVisible(target: Target, timeout = TIMEOUT.optional): Promise<boolean> {
    return this.locator(target)
      .isVisible({ timeout })
      .catch(() => false);
  }

  protected async waitForVisible(target: Target, timeout = TIMEOUT.visible): Promise<void> {
    await this.locator(target).waitFor({ state: "visible", timeout });
  }

  /* ══════════════════════ Verify kết quả ══════════════════════ */

  async verifyVisible(target: Target, timeout = TIMEOUT.verify): Promise<void> {
    await expect(this.locator(target)).toBeVisible({ timeout });
  }

  async verifyHidden(target: Target, timeout = TIMEOUT.verify): Promise<void> {
    await expect(this.locator(target)).toBeHidden({ timeout });
  }

  /** Element chứa text / khớp regex. */
  async verifyText(
    target: Target,
    expected: string | RegExp,
    timeout = TIMEOUT.verify,
  ): Promise<void> {
    await expect(this.locator(target)).toContainText(expected, { timeout });
  }

  /** Giá trị trong ô input. */
  async verifyValue(
    target: Target,
    expected: string | RegExp,
    timeout = TIMEOUT.verify,
  ): Promise<void> {
    await expect(this.locator(target)).toHaveValue(expected, { timeout });
  }

  /** Có thông báo khớp regex hiển thị trên trang (toast / lỗi validate). */
  async verifyMessage(pattern: RegExp, timeout = TIMEOUT.verify): Promise<void> {
    await expect(this.page.getByText(pattern).first()).toBeVisible({ timeout });
  }

  async verifyUrl(pattern: RegExp | string, timeout = TIMEOUT.verify): Promise<void> {
    await expect(this.page).toHaveURL(pattern, { timeout });
  }

  /** Dùng sau khi submit thành công: đã rời khỏi trang hiện tại. */
  async verifyNotUrl(pattern: RegExp | string, timeout = TIMEOUT.verify): Promise<void> {
    await expect(this.page).not.toHaveURL(pattern, { timeout });
  }

  async verifyTitle(pattern: RegExp | string, timeout = TIMEOUT.verify): Promise<void> {
    await expect(this.page).toHaveTitle(pattern, { timeout });
  }
}
