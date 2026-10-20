# Tủ đồ Tulip — trang link affiliate

Trang web: **https://tulip27110shop.github.io/tulip27110-links/**

Link-in-bio cho kênh TikTok **@tulip27110**: tổng hợp shop đã review, mỗi thẻ là
một link affiliate Shopee.

## Cách hoạt động

```
Google Sheet "Tổng hợp shop đồ xinh"
  │
  ├─ (1) Mỗi người mở trang ──> trang tự tải trực tiếp từng tab từ Google Sheet
  │        => thêm dòng / sửa link trong sheet là web MỚI NGAY, không cần làm gì
  │
  └─ (2) GitHub Actions chạy mỗi 3 giờ (sync.mjs)
           => tab mới thêm vào sheet được nhận tự động (ghi vào data.js)
           => làm mới bản dữ liệu lưu sẵn (dùng khi mạng tới Google lỗi)
```

- `index.html` — giao diện + logic đọc sheet. Cột được nhận diện theo tên tiêu đề
  (Link, BRAND/Sản phẩm, Phong cách, Phân loại, Ghi chú/Lý do, Phân khúc giá),
  nên đổi thứ tự cột trong sheet cũng không sao.
- `data.js` — **tự sinh**, đừng sửa tay. Danh sách tab + bản chụp dữ liệu.
- `sync.mjs` — script đồng bộ sheet → data.js.

## Thêm tab mới trong Google Sheet

Không cần làm gì. Chỉ cần tab có cột tiêu đề chứa chữ **Link** (cột chứa link
affiliate) là tab đó tự được đưa vào trang trong vòng ~3 giờ (hoặc vào tab
Actions → **Sync Google Sheet** → **Run workflow** để chạy ngay).

Danh mục lọc (Đồ nữ / Mỹ phẩm / Phụ kiện / Quà tặng...) tự sinh từ cột Phân loại
hoặc tên tab; tên tab lạ sẽ thành một nút lọc mới.

## Chạy tay trên máy

```bash
node sync.mjs   # cần Node 18+; cập nhật lại data.js từ sheet
```
