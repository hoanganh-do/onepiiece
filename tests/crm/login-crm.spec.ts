import { chromium, test } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage.js";

test("Login to web CRM", async () => {
  test.setTimeout(30_000);

  // Mở trình duyệt full cửa sổ (giữ như logincrm.spec.ts)
  const browser = await chromium.launch({
    headless: false,
    args: ["--start-maximized"],
  });
  const context = await browser.newContext({
    viewport: null,
    deviceScaleFactor: undefined,
  });
  const page = await context.newPage();

  const loginPage = new LoginPage(page);
  await loginPage.login();
  await loginPage.verifyLoginSuccess();
  await loginPage.dismissNotificationPopup();

  await browser.close();
});
