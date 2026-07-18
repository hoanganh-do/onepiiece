import { chromium, expect, test } from "@playwright/test";

test("Start with locator method", async ({ page, context }) => {
  // const browser = await chromium.open();
  // const context = await browser.newContext();
  // const page = await context.newPage();

  await page.goto("https://www.saucedemo.com/");
  await page.locator("//input[@name='user-name']").fill("standard-user");
  await page.locator("input#password").fill("secret_sauce");
  await page.locator(`.submit-button`).click();
  await page.locator("input[value=Login]").click();
  await page.locator("text=Sauce LABS Backpack").click();
  await page.locator("id=add-to-cart-sauce-labs-backpack").click();
  await page.locator("data-test=add-to-cart-sauce-labs-backpack").click();
});

test("Practice locator method with Options", async ({ page }) => {
  await page.goto("https://www.saucedemoo.com/");
  await page
    .locator(".form_group", { has: page.locator("input#user-name") })
    .click();
  await page
    .locator(".form_group", { has: page.locator("input#user-name") })
    .pressSequentially("standard_user");

  await page
    .locator(".form_group", { hasNot: page.locator("input#user-name") })
    .click();
  await page
    .locator(".form_group", { hasNot: page.locator("input#user-name") })
    .pressSequentially("standard_user");

  await page.locator("#login-button").click();

  await page.locator("//a", { hasText: "Sauce Labs Backpack" }).click();
  await page.locator(".inventory_item_name", { hasNotText: /sauce.*/ }).click();
});

test("Practice locator method with getByTypeMethods", async ({ page }) => {
  await page.goto("https://demo.nopcommerce.com/login");
  await page
    .getByLabel("Email:", { exact: true })
    .fill("testcodeautomate@gmail.com");
  console.log(
    await page.getByText("New Customer", { exact: true }).textContent(),
  );
  await page.getByAltText("nopCommerce demo store").click();
  await page
    .getByTitle("Show products in category Electronics")
    .first()
    .click();
  await page.getByPlaceholder("Search store").fill("Mobile");
  await page.getByRole("button", { name: "Search" }).click();
});

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
