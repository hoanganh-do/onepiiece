import { type Locator, type Page } from "@playwright/test";

/**
 * Hàm dựng locator dùng chung.
 * Mỗi hàm giữ phần "format" cố định (viết bằng backtick), page chỉ cần truyền phần khác nhau.
 */

/** Ô input theo thuộc tính name. Ví dụ: inputByName(page, "email") -> input[name="email"] */
export function inputByName(page: Page, name: string): Locator {
  return page.locator(`input[name="${name}"]`);
}

/** Nút bấm theo aria-label. Ví dụ: buttonByLabel(page, "Đăng Nhập") -> button[aria-label="Đăng Nhập"] */
export function buttonByLabel(page: Page, label: string): Locator {
  return page.locator(`button[aria-label="${label}"]`);
}
