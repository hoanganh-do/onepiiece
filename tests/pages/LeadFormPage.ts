import { type Locator } from "@playwright/test";
import { BasePage, TIMEOUT } from "../common/BasePage.js";

/**
 * Màn hình "Tạo khách hàng tiềm năng" (form tạo lead).
 *
 * Nguyên tắc đặt locator (giống LeadListPage):
 *   - Ưu tiên thứ người dùng nhìn thấy (getByText / getByRole / getByLabel).
 *   - Chỉ bám attribute khi field không có nhãn gắn chuẩn: các ô trong khối
 *     "Thông Tin Về Khách Hàng" đều theo mẫu name="person[<field>]" nên gom
 *     về 1 hàm dựng locator `personField()` thay vì chép 6 dòng page.locator().
 *   - Khối "Chi Tiết" dùng id trùng name (#title, #lead_type_id...) -> gom về
 *     `detailField()`.
 *   - Luôn `.first()` để tránh strict-mode violation khi form render kèm
 *     bản ẩn (modal / template) có cùng name.
 *
 * Mọi thao tác đều đi qua hàm của BasePage (input/click/select/verify) để
 * hưởng sẵn timeout theo loại hành động.
 */

/** Dữ liệu điền vào form. Field nào bỏ trống thì bỏ qua, không đụng tới. */
export interface LeadFormData {
  // Khối "Thông Tin Về Khách Hàng"
  personName?: string;
  contactValue?: string;
  citizenId?: string;
  birthday?: string;
  /** Chọn theo text hiển thị ("Nam"/"Nữ") hoặc theo vị trí option. */
  gender?: string | number;
  address?: string;

  // Khối "Chi Tiết"
  title?: string;
  description?: string;
  /** "Hình thức *" - theo text hiển thị hoặc vị trí option. */
  form?: string | number;
  leadValue?: string;
  /** "Dự án *" - truyền số 1 để lấy option đầu tiên (bỏ qua placeholder). */
  leadType?: string | number;
  /** "Nguồn *" - theo text hiển thị hoặc vị trí option. */
  leadSource?: string | number;
}

export class LeadFormPage extends BasePage {
  /* ── Hàm dựng locator theo nhóm field ──────────────────────────── */

  /** Ô trong khối "Thông Tin Về Khách Hàng": name="person[<field>]". */
  private personField(field: string): Locator {
    return this.page.locator(`[name="person[${field}]"]`).first();
  }

  /** Ô trong khối "Chi Tiết": id trùng name (#title, #lead_type_id...). */
  private detailField(id: string): Locator {
    return this.page.locator(`#${id}`).first();
  }

  /* ── Khối "Thông Tin Về Khách Hàng" ────────────────────────────── */

  /** Combobox "Tên *" - khi chưa chọn ai thì hiển thị chữ "Nhấn để Thêm". */
  private readonly personNameBox = this.page.getByText("Nhấn để Thêm", { exact: true }).first();

  /** Ô tìm hiện ra sau khi mở combobox "Tên *". */
  private readonly personNameSearchBox = this.page
    .getByPlaceholder(/tìm|search|nhập tên/i)
    .first();

  /** Trường hợp hệ thống render "Tên *" thành input thường (không phải combobox). */
  private readonly personNameInput = this.personField("name");

  /** SĐT/Liên hệ - name lồng nhiều cấp nên viết thẳng, không qua personField(). */
  private readonly contactValue = this.page
    .locator('[name="person[contact_numbers][0][value]"]')
    .first();
  private readonly citizenId = this.personField("citizen_id");
  /** Ô ngày sinh dùng flatpickr -> fill() được, nhưng nếu bị readonly phải gõ tay. */
  private readonly birthday = this.personField("birthday");
  private readonly gender = this.personField("gender");
  private readonly address = this.personField("address");

  /* ── Khối "Chi Tiết" ───────────────────────────────────────────── */

  private readonly title = this.detailField("title");
  private readonly description = this.detailField("description");
  /** "Hình thức *" - id="form" (không phải thẻ <form>). */
  private readonly form = this.detailField("form");
  private readonly leadValue = this.detailField("lead_value");
  private readonly leadType = this.detailField("lead_type_id");
  private readonly leadSource = this.detailField("lead_source_id");

  /* ── Nút hành động ─────────────────────────────────────────────── */

  private readonly submitButton = this.page.getByRole("button", {
    name: /^(Lưu|Lưu Lại|Save|Tạo)/i,
  });

  /* ── Tiện ích nội bộ ───────────────────────────────────────────── */

  /**
   * Chọn option cho thẻ <select>, bỏ qua nếu không truyền giá trị.
   * Số = chọn theo vị trí (1 = option đầu tiên sau placeholder),
   * chuỗi = chọn theo text hiển thị.
   */
  private async selectIfHasValue(target: Locator, value?: string | number): Promise<void> {
    if (value === undefined || value === "") return;
    if (typeof value === "number") await this.selectByIndex(target, value);
    else await this.selectByLabel(target, value);
  }

  /* ── Hành động ─────────────────────────────────────────────────── */

  /** Form đã mở xong (dùng làm sanity check sau khi điều hướng). */
  async verifyFormLoaded(): Promise<void> {
    await this.verifyVisible(this.title);
  }

  /**
   * Điền "Tên *" - phòng cả 2 kiểu render:
   *   - input thường  -> fill thẳng.
   *   - combobox "Nhấn để Thêm" -> mở, gõ tên, Enter để tạo mới.
   */
  async setPersonName(name: string): Promise<void> {
    if (await this.exists(this.personNameInput)) {
      await this.input(this.personNameInput, name);
      return;
    }

    await this.selectFromDropdown(this.personNameBox, name, {
      searchBox: this.personNameSearchBox,
      pressEnter: true,
    });
  }

  /** Điền khối "Thông Tin Về Khách Hàng" (field nào không truyền thì bỏ qua). */
  async fillCustomerInfo(data: LeadFormData): Promise<void> {
    if (data.personName) await this.setPersonName(data.personName);
    await this.inputIfHasValue(this.contactValue, data.contactValue);
    await this.inputIfHasValue(this.citizenId, data.citizenId);
    await this.inputIfHasValue(this.birthday, data.birthday);
    await this.selectIfHasValue(this.gender, data.gender);
    await this.inputIfHasValue(this.address, data.address);
  }

  /** Điền khối "Chi Tiết" (field nào không truyền thì bỏ qua). */
  async fillLeadDetail(data: LeadFormData): Promise<void> {
    await this.inputIfHasValue(this.title, data.title);
    await this.inputIfHasValue(this.description, data.description);
    await this.selectIfHasValue(this.form, data.form);
    await this.inputIfHasValue(this.leadValue, data.leadValue);
    await this.selectIfHasValue(this.leadType, data.leadType);
    await this.selectIfHasValue(this.leadSource, data.leadSource);
  }

  /** Điền cả 2 khối của form. */
  async fillLeadForm(data: LeadFormData): Promise<void> {
    await this.fillCustomerInfo(data);
    await this.fillLeadDetail(data);
  }

  /** Bấm nút Lưu. */
  async clickSubmit(): Promise<void> {
    await this.click(this.submitButton);
  }

  /** Gộp: điền form -> bấm Lưu. */
  async createLead(data: LeadFormData): Promise<void> {
    await this.fillLeadForm(data);
    await this.clickSubmit();
  }

  /* ── Verify kết quả ────────────────────────────────────────────── */

  /** Tạo thành công: hệ thống rời khỏi trang /create. */
  async verifyCreateSucceeded(timeout = TIMEOUT.navigation): Promise<void> {
    await this.verifyNotUrl(/\/create/, timeout);
  }

  /** Tạo thất bại: vẫn ở trang /create và có thông báo lỗi khớp regex. */
  async verifyStayOnFormWithError(pattern: RegExp): Promise<void> {
    await this.verifyUrl(/\/create/);
    await this.verifyMessage(pattern);
  }
}
