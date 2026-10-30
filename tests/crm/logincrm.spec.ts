import { chromium, expect, test } from "@playwright/test";

test("Login to web CRM", async ({}) => {
  // 1. Khởi tạo trình duyệt với tham số --start-maximized
  const browser = await chromium.launch({
    headless: false,
    args: ["--start-maximized"],
  });

  // 2. Tạo context mới và set viewport thành null
  const context = await browser.newContext({
    viewport: null,
    deviceScaleFactor: undefined,
  });

  const page = await context.newPage();
  await page.goto("https://cenrm.doubletc.com/workspace/login");

  await page.getByRole("textbox", { name: "Địa Chỉ Email" }).fill("admincentest1@cenrm.com");
  await page.getByPlaceholder("Mật khẩu").fill("Cen@123");
  await page.getByLabel("Đăng Nhập", { exact: true }).click();

  const pageTitle = await page.title();
  console.log("Title là :" + pageTitle);

  expect(pageTitle).toContain("Bảng Điều Khiển");

  await page.locator("#onesignal-slidedown-cancel-button").click();

  console.log("gud");

  test.setTimeout(30000);
  await browser.close();
});
