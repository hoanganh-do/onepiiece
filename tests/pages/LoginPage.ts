import { expect, type Locator, type Page } from "@playwright/test";
//Trong LoginPage.ts, mình xoá đoạn khai báo DEFAULT_ACCOUNT cũ và thêm dòng import:
import { DEFAULT_ACCOUNT } from "../data/accounts.js";
import { LOGIN_URL } from "../data/url.js";
import { buttonByLabel, inputByName } from "../common/CommonLocator.js"
/*
Vì sao viết hoa CommonLocator thì báo lỗi?
Code của bạn không sai, lỗi chỉ nằm ở VS Code. Chạy tsc từ terminal thì không báo lỗi gì.
Nguyên nhân:
-Windows không phân biệt chữ hoa, chữ thường trong tên file, nên với
Windows commonLocator.ts và CommonLocator.ts là cùng một file.
-Phần kiểm tra TypeScript của VS Code vẫn nhớ tên cũ commonLocator.ts từ trước khi b đổi tên.
-Giờ bạn import theo tên mới CommonLocator.js, nên VS Code tưởng có 2 file chỉ khác nhau
chữ hoa/thường và báo lỗi ts(1261). TypeScript báo lỗi này để tránh trường hợp chạy được
trên Windows nhưng hỏng trên Linux, vì Linux có phân biệt hoa thường.
Ngược lại, để tên thường thì khớp đúng tên VS Code đang nhớ, nên không có lỗi.
Mình đã kiểm tra repo:
-Trong tests/common/ chỉ có BasePage.ts, CommonLocator.ts, timeouts.ts. Không còn file
commonLocator.ts nào tồn tại ẩn.
-Git chưa theo dõi file này, nên trong git cũng không còn bản cũ nào cần xoá.
Mình không xoá gì vì không có gì để xoá.
Cách hết lỗi: nhấn Ctrl+Shift+P, gõ "TypeScript: Restart TS Server" rồi Enter.
Nếu vẫn còn lỗi thì tắt và mở lại VS Code.
Lưu ý cho lần sau: nếu đổi tên một file đã commit mà chỉ khác chữ hoa/thường,
hãy dùng git mv commonLocator.ts CommonLocator.ts. 
Repo này có core.ignorecase=true, nên đổi tên bằng tay thì git sẽ không nhận ra thay đổi.
*/


/** Dữ liệu đăng nhập mặc định (lấy từ logincrm.spec.ts). */
// Bản cũ - giữ lại để tham chiếu, nay đã chuyển sang tests/data/accounts.ts và tests/data/url.ts
// export const LOGIN_URL = "https://cenrm.doubletc.com/workspace/login";
// export const DEFAULT_ACCOUNT = {
//   email: "admincentest1@cenrm.com",
//   password: "Cen@123",
// };

/** Màn hình đăng nhập CenRM. */
export class LoginPage {
  /* ══════════════════════ Khối 1: Locator ══════════════════════ */

  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  /** Nút "Từ chối" trên popup xin quyền thông báo (OneSignal). */
  readonly notificationCancelButton: Locator;

  /*
  1. Constructor dùng để làm gì?
  Constructor chạy đúng một lần, ngay lúc spec gọi new LoginPage(page). Ở đây nó làm 2 việc:
  Nhận page từ spec truyền vào. page là tab trình duyệt do spec tạo ra. Class không tự có page, phải có chỗ nhận từ ngoài vào, và chỗ đó là constructor.
  Tạo các locator từ page. Locator nào cũng sinh ra từ page (page.getByRole(...)). Phải có page trước thì mới tạo được locator.
  Nếu bỏ constructor đi thì new LoginPage(page) vẫn chạy nhưng page truyền vào bị bỏ qua. Class không có page, nên không tạo được locator và cũng không goto/fill được gì. Nói ngắn gọn: page object nào cần page thì cũng phải có constructor ở đâu đó để nhận nó.
  Khi nào không cần tự viết constructor? Khi class kế thừa một class cha đã có sẵn constructor nhận page. Ví dụ LeadListPage extends BasePage: BasePage đã nhận page rồi, nên LeadListPage không có constructor mà vẫn viết locator thẳng được:
  private readonly sidebarLeadsIcon = this.page.getByRole("navigation")...
  Nếu sau này cho LoginPage extends BasePage thì cũng bỏ được constructor theo cách này.
  */
  // Đây là cú pháp rút gọn của TypeScript, gọi là parameter property. Hai cách viết dưới đây
  // giống hệt nhau về kết quả
  // Cách viết đầy đủ (đẩy page ra ngoài):
  //   private readonly page: Page;        // 1. khai báo biến
  //   constructor(page: Page) {
  //   this.page = page;                   // 2. gán giá trị
  //   this.emailInput = page.getByRole("textbox", { name: "Địa Chỉ Email" });
  //   }
  constructor(private readonly page: Page) {
    // Dùng hàm chung trong commonLocator: chỉ truyền phần khác nhau
    this.emailInput = inputByName(page, "email");
    this.passwordInput = inputByName(page, "password");
    this.loginButton = buttonByLabel(page, "Đăng Nhập");
    // Bản cũ - giữ lại để tham chiếu:
    // this.emailInput = page.getByRole("textbox", { name: "Địa Chỉ Email" });
    // this.passwordInput = page.getByPlaceholder("Mật khẩu");
    // this.loginButton = page.getByLabel("Đăng Nhập", { exact: true });
    this.notificationCancelButton = page.locator("#onesignal-slidedown-cancel-button");
  }


  /* ══════════════════════ Khối 2: Hàm login ══════════════════════ */

  /** Mở trang đăng nhập. */
  async goto(): Promise<void> {
    await this.page.goto(LOGIN_URL);
  }

  /**
  3. Tham số login(email = ..., password = ...)
  Dấu = là giá trị mặc định. Nhờ nó gọi được login() không cần truyền gì, sẽ tự dùng tài khoản admin. Muốn tài khoản khác thì gọi login("x@y.com", "123").
  Rút gọn thành login(email: string, password: string): được, nhưng lần gọi nào cũng phải truyền đủ 2 giá trị. Bỏ = mà vẫn gọi login() thì TypeScript báo lỗi thiếu tham số.
  Cách gọn hơn mà vẫn có mặc định: truyền cả object tài khoản:
  async login({ email, password } = DEFAULT_ACCOUNT)
  // gọi: login()  hoặc  login({ email: "x@y.com", password: "123" })
  */
  async login(email = DEFAULT_ACCOUNT.email, password = DEFAULT_ACCOUNT.password): Promise<void> {
    await this.goto();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  /** Xác nhận đã vào Bảng Điều Khiển. */
  async verifyLoginSuccess(): Promise<void> {
    await expect(this.page).toHaveTitle(/Bảng Điều Khiển/);
  }

  /**
   * Đóng popup thông báo OneSignal KHI NÀO nó hiện lên.
   * Popup có thể hiện muộn vài giây hoặc không hiện -> không click thẳng (dễ timeout).
   * addLocatorHandler: trước mỗi thao tác sau này, nếu thấy popup đang hiện thì
   * Playwright tự bấm nút đóng rồi mới làm tiếp. Popup không hiện thì bỏ qua.
   */
  async dismissNotificationPopup(): Promise<void> {
    const { page, notificationCancelButton } = this;

    await page.addLocatorHandler(notificationCancelButton, async () => {
      await notificationCancelButton.click();
    });
  }
}
