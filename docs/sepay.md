# SePay: cấu hình và nghiệm thu

Mỗi chủ đơn vị có một kết nối riêng và chọn các tài khoản nhận tiền đã khai báo
trong **Cài đặt**. Phiên bản này dùng webhook thủ công của SePay; không dùng OAuth,
tài khoản ảo VA, cộng dồn nhiều giao dịch hoặc API đồng bộ lịch sử.

## Chuẩn bị ứng dụng

1. Chạy tất cả migration theo thứ tự tên file. Với database đã có thanh toán thủ
   công, chạy tiếp `20261004000000_sepay_reconciliation.sql` và
   `20261004010000_quote_edit_alias.sql`. Không sửa hoặc chạy lại migration cũ.
   Migration SePay chuyển các yêu cầu đã `paid` sang nguồn `manual`, giữ lịch sử.
2. Cấu hình các giá trị sau ở server; không thêm tiền tố `NEXT_PUBLIC_` cho bí mật:

   | Biến | Giá trị |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key dùng cho phiên người dùng |
   | `APP_URL` | Origin công khai, ví dụ `https://portal.example.com`; dùng HTTPS khi production |
   | `SUPABASE_SECRET_KEY` | Secret key Supabase có quyền `service_role`, hoặc legacy service role key |
   | `SEPAY_ENCRYPTION_KEY` | Khóa AES 32 byte được mã hóa base64 |

   Tạo khóa mã hóa bằng lệnh sau rồi lưu kết quả trong kho bí mật của môi trường:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

   Giữ nguyên khóa mã hóa qua các lần deploy và sao lưu cùng cấu hình server.
   Thay khóa này trực tiếp sẽ khiến các bí mật đang lưu không giải mã được; cần
   quy trình tái mã hóa hoặc tạo lại kết nối. Đổi khóa webhook trong giao diện
   không thay khóa mã hóa này.
3. Khởi động lại ứng dụng sau khi cấu hình. Nếu thiếu migration hoặc biến môi
   trường, phần SePay trong Cài đặt sẽ hiển thị hướng dẫn hoặc lỗi tải rõ ràng.

## Kết nối từng đơn vị

1. Đăng nhập đúng đơn vị, khai báo và kiểm tra ngân hàng, số tài khoản, tên chủ
   tài khoản. Chọn các tài khoản tương ứng với tài khoản đã kết nối trên SePay.
2. Nhấn **Kết nối SePay**. Sao chép URL webhook và khóa xác thực đang hiển thị.
   Khóa chỉ hiện sau khi tạo hoặc đổi khóa; tải lại trang sẽ không hiển thị lại.
3. Trong SePay, tạo webhook cho các tài khoản đó, chọn sự kiện **Có tiền vào**,
   nội dung **JSON**, xác thực **HMAC-SHA256**. Điền URL và khóa từ ứng dụng.
   Chọn gửi cả giao dịch không có mã để chúng được lưu vào **Cần kiểm tra**.
   Ứng dụng tự nhận diện mã TP 22 ký tự trong `content`, không phụ thuộc trường
   `code` hoặc cấu hình trích mã của SePay.
4. Khi chọn **Đổi khóa và tài khoản**, cập nhật khóa mới trên SePay ngay. Khóa
   cũ mất hiệu lực; URL giữ nguyên. **Ngắt kết nối** dừng nhận webhook và giữ
   giao dịch, yêu cầu thanh toán cùng lịch sử đã ghi. Tắt webhook tương ứng ở SePay.

Tham khảo [hướng dẫn tạo webhook](https://developer.sepay.vn/sepay-webhooks/tao-webhook)
và [xác thực HMAC](https://developer.sepay.vn/en/sepay-webhooks/xac-thuc).

## Quy tắc xử lý

Endpoint `POST /api/payments/sepay/[connectionId]` chạy Node.js và không cần phiên
đăng nhập. Server kiểm tra HMAC-SHA256 trên `timestamp + "." + raw_body`, so sánh
chữ ký bằng thời gian hằng và từ chối timestamp lệch hơn 300 giây. Timestamp này
là lúc ký webhook; `transactionDate` trong JSON là lúc chuyển tiền theo giờ Việt Nam.

Chỉ tự xác nhận khi tiền vào khớp đơn vị, ngân hàng, số tài khoản được liên kết,
một mã yêu cầu đầy đủ và toàn bộ số tiền VND. Yêu cầu phải còn `pending` hoặc
`reported`, báo giá đã được duyệt và thời điểm chuyển tiền nằm từ lúc tạo đến lúc
hết hạn yêu cầu. Webhook đến sau hạn vẫn được nhận nếu giao dịch xảy ra đúng hạn.
Yêu cầu đã hủy, thay thế hoặc thanh toán không được xác nhận lần hai.

Giao dịch sai tiền, tài khoản, thiếu mã, nhiều mã, ngoài thời hạn hoặc không khớp
được lưu cùng lý do ở **Thanh toán → Cần kiểm tra**. Không cộng dồn tiền chuyển.
Chủ đơn vị vẫn có thể kiểm tra sao kê và xác nhận thủ công. Cổng khách hàng chỉ
thấy nguồn xác nhận **Thủ công** hoặc **SePay**, không thấy ghi chú xác minh,
giao dịch nội bộ, nhật ký hoặc bí mật kết nối.

RPC `reconcile_sepay_transaction` dành riêng cho `service_role` lưu giao dịch,
khóa yêu cầu, cập nhật trạng thái và ghi lịch sử trong cùng transaction. Khóa
duy nhất `(owner_id, provider_id)` ngăn webhook trùng. Các thay đổi thủ công cũng
khóa cùng yêu cầu; hành động hoàn tất trước giữ nguồn xác nhận duy nhất.
Owner chỉ có quyền đọc metadata kết nối, liên kết và giao dịch của mình. Bảng
`sepay_connection_secrets` không cấp quyền cho `anon` hay `authenticated`; khóa
webhook được mã hóa AES-256-GCM với dữ liệu xác thực gắn với kết nối và đơn vị.

Server trả `200 {"success":true}` sau khi lưu và xử lý thành công, bao gồm giao
dịch cần kiểm tra và webhook trùng. Lỗi lưu trữ trả `503 {"success":false}` để
SePay gửi lại; chữ ký sai trả 401, JSON lỗi 400, dữ liệu quá lớn 413, loại nội
dung không hỗ trợ 415, kết nối không tồn tại/đã ngắt 404. Xem
[hợp đồng phản hồi SePay](https://developer.sepay.vn/en/sepay-webhooks/tich-hop-webhook).

## Nghiệm thu bằng fixture riêng

```bash
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Kiểm thử chạy migration thật trong PGlite PostgreSQL và dùng Auth/Storage giả
lập. Suite database kiểm tra dữ liệu thanh toán cũ, RLS hai đơn vị, quyền RPC,
khóa bí mật, mã và số tiền không khớp, hết hạn, hủy, gửi trùng, rollback/gửi lại,
đổi khóa và tranh chấp xác nhận thủ công. PGlite dùng một kết nối PostgreSQL;
kiểm thử gọi đồng thời xác minh tính duy nhất nhưng không thay thế thử tải với
nhiều kết nối PostgreSQL trên Supabase staging.

Suite trình duyệt chạy Next.js thật cùng database trong bộ nhớ riêng ở cổng
3100/54321, ghi đè cấu hình Supabase cho subprocess và không gửi yêu cầu đến
project trong `.env.local`. Nó thực hiện tạo/sửa/nhân bản, khách duyệt, tạo QR,
cấu hình kết nối bằng khóa fixture và gửi webhook có chữ ký qua endpoint thật.
Nó cũng kiểm tra hai ngôn ngữ ở 375/768/1440px, không tràn ngang, giữ bản nháp
biểu mẫu, tạm dừng lúc tab ẩn, giới hạn 15 phút và không hiện lại khóa sau tải
lại trang. Ảnh và trace nằm trong `test-results/`, được
loại khỏi Git. Chỉ chạy suite này khi hai cổng thử nghiệm còn trống.

Chưa nghiệm thu tiền thật vì chưa có tài khoản SePay. Sau khi mỗi đơn vị kết nối
ngân hàng và webhook, cần nghiệm thu trên Supabase staging bằng một giao dịch
thật có mã QR và kiểm tra sao kê, nguồn xác nhận, nhật ký cùng khả năng gửi lại.
Đợt thay đổi này không áp dụng migration lên database hiện dùng hoặc deploy production.
