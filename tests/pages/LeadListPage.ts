import { type Locator } from "@playwright/test";
import { BasePage, TIMEOUT } from "../common/BasePage.js";

/**
 * Màn hình "Khách hàng tiềm năng" (danh sách lead dạng Kanban).
 *
 * Ưu tiên locator theo kiểu người dùng nhìn thấy (getByRole / getByPlaceholder)
 * thay vì bám class CSS. Chỉ giữ CSS ở 2 chỗ không có "tên" để bám vào:
 *   - Icon sidebar  : chỉ có icon, không có nhãn chữ -> bám href.
 *   - Khối dropdown : div.relative bọc nút mở + panel -> dùng làm phạm vi (scope),
 *                     nhận diện bằng chính các dòng quy trình `a[data-pipeline-name]`.
 *
 * ⚠️ Cách panel lọc danh sách: KHÔNG xoá dòng không khớp mà gán
 * `style="display: none"`. Vì vậy locator của option bắt buộc phải lọc
 * `visible: true`, nếu không sẽ click trúng dòng đang bị ẩn.
 *
 * Quy ước dùng `this` trong file này:
 *   - Locator  : destructure ra biến ở đầu hàm -> `const { pipelineTrigger } = this;`
 *   - Hàm của BasePage: PHẢI gọi qua `this.` (destructure sẽ mất binding).
 */
export class LeadListPage extends BasePage {
  /* ── Sidebar ───────────────────────────────────────────────────── */

  /**
   * Icon "Leads" trên sidebar trái (không có nhãn chữ nên bám href).
   * Dùng `href$=` (kết thúc bằng) để KHÔNG dính các mục cùng tiền tố:
   * /workspace/leads/export/requests, /workspace/lead-segments...
   */
  private readonly sidebarLeadsIcon = this.page
    .getByRole("navigation")
    .locator('a[href$="/workspace/leads"]')
    .first();

  /* ── Dropdown quy trình (pipeline) ─────────────────────────────── */

  /** Cả khối dropdown: bọc nút mở + panel xổ xuống. Dùng làm phạm vi cho 2 cái dưới. */
  private readonly pipelineDropdown = this.page
    .locator("div.relative:has(a[data-pipeline-name])")
    .first();

  /** Nút mở dropdown - nhãn đổi theo quy trình đang chọn nên không khoá theo `name`. */
  private readonly pipelineTrigger = this.pipelineDropdown.getByRole("button").first();

  /** Panel xổ xuống chứa ô tìm + danh sách quy trình. */
  private readonly pipelinePanel = this.pipelineDropdown.locator("div.absolute").first();

  /** Ô "Tìm quy trình...". */
  private readonly pipelineSearchBox = this.pipelinePanel.getByPlaceholder(/tìm quy trình/i);

  /* ── Thanh công cụ ─────────────────────────────────────────────── */

  /** Link "Tạo khách hàng tiềm năng" (thẻ a, không phải button). */
  private readonly createLeadButton = this.page.getByRole("link", {
    name: /tạo khách hàng tiềm năng/i,
  });

  /* ── Locator động ──────────────────────────────────────────────── */

  /**
   * Một dòng quy trình cụ thể trong danh sách đã lọc.
   * Khớp theo tên hiển thị (getByRole mặc định so khớp "chứa", bỏ qua hoa/thường)
   * nên truyền thẳng keyword có dấu: "Mua - Bán".
   * filter({ visible: true }) để bỏ qua các dòng bị ẩn bằng display:none.
   */
  //hàm pipelineOptions này trả về cái locator có giá trị là Mua Bán cho thằng option đc khai báo
  private pipelineOption(keyword: string): Locator {
    return this.pipelinePanel
      .getByRole("link", { name: keyword })
      .filter({ visible: true })
      .first();
  }

  /* ── Hành động ─────────────────────────────────────────────────── */

  /** Vào màn Khách hàng tiềm năng bằng icon trên sidebar. */
  async openFromSidebar(): Promise<void> {
    const { sidebarLeadsIcon } = this;

    await this.click(sidebarLeadsIcon);
    await this.verifyUrl(/\/workspace\/leads/);
  }

  /** Bước 1: bấm nút quy trình để xổ panel ra. */
  async openPipelineDropdown(): Promise<void> {
    const { pipelineTrigger, pipelinePanel } = this;

    await this.click(pipelineTrigger);
    await this.waitForVisible(pipelinePanel);
  }

  /** Bước 2: gõ từ khoá vào ô tìm -> panel tự ẩn bớt dòng không khớp. */
  async filterPipeline(keyword: string): Promise<void> {
    const { pipelineSearchBox } = this;

    await this.input(pipelineSearchBox, keyword);
  }

  /**
   * Bước 3 (trước đây bị thiếu): click đúng dòng quy trình trong danh sách,
   * rồi xác nhận nút dropdown đã đổi sang tên quy trình vừa chọn.
   */
  async choosePipeline(keyword: string): Promise<void> {
    const option = this.pipelineOption(keyword);

    await this.verifyVisible(option, TIMEOUT.dropdown);
    await this.click(option);
    await this.verifyPipelineSelected(keyword);
  }

  /** Tên quy trình đang áp dụng được hiển thị ngay trên nút mở dropdown. */
  async verifyPipelineSelected(keyword: string): Promise<void> {
    const { pipelineTrigger } = this;

    await this.verifyText(pipelineTrigger, keyword);
  }

  /**
   * Gộp 3 bước: mở dropdown -> lọc theo từ khoá -> chọn quy trình.
   * @param keyword Từ khoá, ví dụ "Mua - Bán" (không cần gõ đủ tên quy trình).
   */
  async selectPipeline(keyword: string): Promise<void> {
    await this.openPipelineDropdown();
    await this.filterPipeline(keyword);
    await this.choosePipeline(keyword);
  }

  /** Bấm "Tạo khách hàng tiềm năng" để sang form tạo lead. */
  async openCreateLeadForm(): Promise<void> {
    const { createLeadButton } = this;

    await this.click(createLeadButton);
    await this.verifyUrl(/\/leads\/create/);
  }

  /** Gộp cả luồng: sidebar -> chọn quy trình -> mở form tạo lead. */
  async goToCreateLeadForm(pipelineKeyword: string): Promise<void> {
    await this.openFromSidebar();
    await this.selectPipeline(pipelineKeyword);
    await this.openCreateLeadForm();
  }
}
