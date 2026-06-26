# ShopRi Manager - Hệ Thống Quản Lý Kho Ri / Size & Bán Hàng Kho Sỉ

Ứng dụng full-stack hiện đại xây dựng trên nền tảng **React (Vite) + Tailwind CSS + Supabase (PostgreSQL)**, chuyên biệt cho các mô hình bán buôn/sỉ quần áo, giày dép theo ri (dây), theo màu và size.

**Người viết phần mềm:** Hoàng Uyên  
**Bản quyền thuộc về:** Hoàng Uyên 0931325512

---

## 📌 Các Tính Năng Chính (Modules)

1. **Tổng Quan (Dashboard)**:
   - Thống kê doanh số bán ra trong ngày, tổng nợ phải thu, tổng sản phẩm tồn kho hiện tại và tổng số đối tác/khách hàng.
   - Biểu đồ doanh thu 7 ngày gần nhất bằng Recharts.
   - Danh sách hóa đơn mới xuất trong ngày.
   - **Cảnh báo sắp hết hàng**: Tự động lọc ra các mã hàng và nhóm size có số lượng tồn kho ít ($\le 15$ cái) được hiển thị tinh gọn dưới dạng một dòng duy nhất giúp chủ shop nhập hàng kịp thời.

2. **Nhập Hàng (Import Module)**:
   - Nhập hàng theo mã hàng (Mã sản phẩm), màu sắc, và lựa chọn nhóm size (Ri nhí: 3-10, Ri đại: 11-16, hoặc tự tạo size tùy chọn).
   - Hỗ trợ nhập nhanh theo số lượng mỗi size hoặc nhập sỉ nguyên ri (tự động nhân số lượng đều cho các size trong nhóm).
   - Quản lý danh mục các mẫu ri/size hiện có.

3. **Xem Tồn Kho (Inventory Module)**:
   - Giao diện bento-grid phân cấp, hiện đại, màu sắc trực quan (gradient xanh dương, tím, cam, lục) giúp dễ dàng nhận diện thông tin trong nháy mắt.
   - **Cấp 1 - Mã hàng**: Hiển thị tổng tồn kho, số màu, số nhóm ri, và các tag màu thực tế.
   - **Cấp 2 - Nhóm Ri**: Click "Xem chi tiết" để xem phân rã các nhóm ri (Ri nhí: gradient xanh lá, Ri đại: gradient cam, Tùy chọn: gradient tím) kèm lượng tồn của nhóm.
   - **Cấp 3 - Size con**: Click vào nhóm ri để hiển thị danh sách các size cụ thể cùng trạng thái màu sắc theo tồn kho thực tế:
     - Tồn $> 20$ cái: Xanh lá (`Còn hàng`)
     - Tồn từ $1 - 20$ cái: Vàng/Cam (`Sắp hết`)
     - Tồn $= 0$ cái: Đỏ/Xám (`Hết hàng`)
   - Tích hợp nút sửa nhanh số lượng và xóa dòng tồn kho, xóa toàn bộ mã hàng với popup hộp thoại xác nhận tuỳ chỉnh, bảo đảm đồng bộ dữ liệu tức thời lên Supabase và cập nhật giao diện không cần reload.

4. **Xuất Hoá Đơn (Invoice Module)**:
   - Tạo hóa đơn xuất kho cho khách sỉ nhanh chóng.
   - Chọn sản phẩm, chọn màu, chọn phương thức nhập (bán lẻ từng size hoặc bán nguyên ri).
   - Tự động trừ tồn kho tương ứng trong bảng `inventory_batches` khi xuất hóa đơn.
   - Tính toán công nợ khách hàng tự động dựa trên số tiền trả trước.

5. **Hoá Đơn Hôm Nay (Today's Invoices)**:
   - Xem danh sách toàn bộ hóa đơn xuất trong ngày.
   - In hóa đơn (xuất file hóa đơn bán sỉ trực quan).
   - Hỗ trợ hủy/xóa hóa đơn (hoàn trả lại tồn kho vào bảng `inventory_batches` một cách an toàn và cập nhật lại công nợ khách hàng).

6. **Khách Hàng & Công Nợ (Customers & Debts)**:
   - Quản lý danh bạ khách sỉ, số điện thoại, địa chỉ.
   - Thống kê lịch sử mua hàng, tổng giá trị hóa đơn đã mua, tổng tiền đã thanh toán, và dư nợ hiện tại.
   - Tạo phiếu thu hồi nợ (ghi nhận lịch sử thanh toán).
   - Tạo mã tra cứu trực tuyến (Tracking Token) độc nhất cho mỗi khách sỉ.

7. **Tra Cứu Đơn Hàng (Tracking View)**:
   - Trang độc lập dành cho khách sỉ tự tra cứu trạng thái đơn hàng và công nợ cá nhân từ xa bằng mã tra cứu được cung cấp, tăng tính minh bạch và uy tín cho shop.

8. **Backup & Restore Dữ Liệu**:
   - Tải file backup JSON chứa toàn bộ dữ liệu quan trọng: sản phẩm, bộ size, tồn kho, khách hàng, hóa đơn, chi tiết hóa đơn và thanh toán.
   - Kiểm tra định dạng file backup trước khi restore để tránh dùng nhầm file.
   - Restore dữ liệu theo đúng thứ tự quan hệ bảng để hạn chế rối loạn, đứt liên kết hoặc mất dữ liệu.
   - Tự động tải một file backup dự phòng của dữ liệu hiện tại ngay trước khi restore.

---

## 🗄️ Cấu Trúc Cơ Sở Dữ Liệu (Supabase PostgreSQL)

Hệ thống sử dụng các bảng dữ liệu sau trong schema `public`:

```
┌─────────────────────────────────┐
│            products             │ <─── Cơ sở thông tin sản phẩm
└─────────────────────────────────┘
                 │ (1:N)
                 ▼
┌─────────────────────────────────┐
│        inventory_batches        │ <─── Lưu trữ tồn kho thực tế theo từng tổ hợp:
└─────────────────────────────────┘      [product_id, color, size, unit_type]
                 ▲
                 │ (N:1)
┌─────────────────────────────────┐
│            size_sets            │ <─── Danh mục bộ size mẫu (Ri nhí, Ri đại,...)
└─────────────────────────────────┘
```

### Chi tiết các bảng:
1. **`products`**:
   - `id` (UUID, PK)
   - `code` (TEXT, UNIQUE): Mã hàng (ví dụ: `A`, `B`, `Q01`,...)
   - `colors` (TEXT[]): Danh sách các màu của sản phẩm.
   - `note` (TEXT): Ghi chú.

2. **`size_sets`**:
   - `id` (UUID, PK)
   - `name` (TEXT): Tên bộ mẫu size (ví dụ: `Ri nhí (Size 3-10)`)
   - `sizes` (TEXT[]): Mảng các size con (ví dụ: `['3','4','5',...]`)
   - `is_default` (BOOLEAN): Bộ mặc định của hệ thống.

3. **`inventory_batches`**:
   - `id` (UUID, PK)
   - `product_id` (UUID, FK -> `products.id` ON DELETE CASCADE)
   - `product_code` (TEXT)
   - `color` (TEXT)
   - `size` (TEXT)
   - `quantity` (INTEGER): Số lượng tồn kho.
   - `unit_type` (TEXT): Nhóm size (`Ri nhí`, `Ri đại`, hoặc `Tuỳ chọn`)
   - `note` (TEXT)

4. **`customers`**:
   - `id` (UUID, PK)
   - `name` (TEXT): Tên khách sỉ.
   - `phone` (TEXT)
   - `tracking_token` (TEXT, UNIQUE): Token tra cứu đơn hàng từ xa.

5. **`invoices`**:
   - `id` (UUID, PK)
   - `invoice_code` (TEXT, UNIQUE): Mã hóa đơn (ví dụ: `HD-1002`)
   - `customer_id` (UUID, FK)
   - `total_amount` (BIGINT)
   - `paid_amount` (BIGINT)
   - `debt_amount` (BIGINT)
   - `payment_status` (TEXT): Trạng thái thu tiền (`đã thu`, `chưa thu`, `thu một phần`)

6. **`invoice_items`**:
   - `id` (UUID, PK)
   - `invoice_id` (UUID, FK -> `invoices.id` ON DELETE CASCADE)
   - `product_id` (UUID, FK)
   - `product_code` (TEXT)
   - `color` (TEXT)
   - `size` (TEXT)
   - `quantity` (INTEGER)
   - `unit_price` (BIGINT)
   - `subtotal` (BIGINT)
   - `unit_type` (TEXT)

7. **`payments`**:
   - `id` (UUID, PK)
   - `customer_id` (UUID, FK)
   - `invoice_id` (UUID, FK)
   - `amount` (BIGINT)

---

## 🛠️ Hướng Dẫn Cài Đặt và Khởi Chạy

### 1. Khai báo biến môi trường
Nếu bạn chạy độc lập, hãy tạo file `.env` ở thư mục gốc:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_APP_URL=https://your-domain.example
```

Không nhúng khóa cấu hình trực tiếp vào source khi deploy. Hãy khai báo các biến trên trong hosting provider.

### 2. Cài đặt thư viện
```bash
npm install
```

### 3. Khởi chạy môi trường Phát triển (Development)
```bash
npm run dev
```
Ứng dụng sẽ chạy tại địa chỉ: `http://localhost:3000`

### 4. Biên dịch Dự án (Build)
```bash
npm run build
```
Dữ liệu tĩnh sẽ được tạo ra tại thư mục `/dist`.
