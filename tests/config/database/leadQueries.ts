import type { Database, Row } from "./Database.js";

/**
 * CÂU TRUY VẤN THEO NGHIỆP VỤ (lead).
 *
 * Để SQL tập trung ở đây thay vì rải trong spec:
 *   - Spec đọc như tiếng Việt: `await findLeadByTitle(db, title)`.
 *   - Schema đổi thì sửa 1 chỗ.
 *
 * ⚠️ TÊN BẢNG/CỘT BÊN DƯỚI LÀ KHUNG MẪU theo cấu trúc mặc định của Krayin
 *    (leads / persons / lead_pipelines). TÔI CHƯA KIỂM CHỨNG ĐƯỢC vì chưa có
 *    quyền truy cập DB. Trước khi dùng, hãy đối chiếu bằng:
 *        SHOW TABLES;
 *        DESCRIBE leads;
 *    rồi chỉnh lại cho khớp.
 */

/* ══════════════════════ Kiểu hàng trả về ══════════════════════ */

export interface LeadRow extends Row {
  id: number;
  title: string;
  description: string | null;
  lead_value: string | null;
  person_id: number | null;
  lead_pipeline_id: number | null;
  created_at: string;
}

export interface PersonRow extends Row {
  id: number;
  name: string;
  contact_numbers: string | null;
  address: string | null;
}

/* ══════════════════════ Truy vấn ══════════════════════ */

/** Tìm lead theo tiêu đề - dùng để kiểm chứng sau khi tạo trên UI. */
export async function findLeadByTitle(db: Database, title: string): Promise<LeadRow | null> {
  return db.queryOne<LeadRow>(
    `SELECT id, title, description, lead_value, person_id, lead_pipeline_id, created_at
       FROM leads
      WHERE title = ?
      ORDER BY id DESC
      LIMIT 1`,
    [title],
  );
}

/**
 * Chờ lead xuất hiện trong DB (UI có thể ghi qua queue nên không tức thì).
 * Trả về hàng lead, quá thời gian thì ném lỗi.
 */
export async function waitForLeadByTitle(
  db: Database,
  title: string,
  timeout = 15_000,
): Promise<LeadRow> {
  return db.waitForRow<LeadRow>(
    `SELECT id, title, description, lead_value, person_id, lead_pipeline_id, created_at
       FROM leads
      WHERE title = ?
      ORDER BY id DESC
      LIMIT 1`,
    [title],
    { timeout },
  );
}

/** Lấy thông tin khách hàng gắn với lead - kiểm chứng tên/SĐT/địa chỉ đã lưu đúng. */
export async function findPersonOfLead(db: Database, leadId: number): Promise<PersonRow | null> {
  return db.queryOne<PersonRow>(
    `SELECT p.id, p.name, p.contact_numbers, p.address
       FROM persons p
       JOIN leads l ON l.person_id = p.id
      WHERE l.id = ?`,
    [leadId],
  );
}

/** Lấy id quy trình theo tên - dùng để dựng dữ liệu đầu vào thay vì hard-code id. */
export async function findPipelineIdByName(db: Database, keyword: string): Promise<number | null> {
  return db.queryValue<number>(
    `SELECT id FROM lead_pipelines WHERE name LIKE ? ORDER BY id LIMIT 1`,
    [`%${keyword}%`], // ký tự % thuộc GIÁ TRỊ, không nối vào chuỗi SQL
  );
}

/** Đếm lead do test tự sinh (theo tiền tố tiêu đề). */
export async function countLeadsByTitlePrefix(db: Database, prefix: string): Promise<number> {
  return (await db.queryValue<number>(
    `SELECT COUNT(*) AS total FROM leads WHERE title LIKE ?`,
    [`${prefix}%`],
  )) ?? 0;
}

/* ══════════════════════ Dọn dẹp ══════════════════════ */

/**
 * Xoá lead test theo tiêu đề. CHỈ chạy khi DB_READONLY=false,
 * nếu không Database sẽ chặn lại.
 *
 * Luôn xoá theo điều kiện hẹp (tiêu đề test có timestamp), tuyệt đối
 * không DELETE theo khoảng thời gian hay không điều kiện.
 */
export async function deleteLeadByTitle(db: Database, title: string): Promise<number> {
  const result = await db.execute(`DELETE FROM leads WHERE title = ?`, [title]);
  return result.affectedRows;
}
