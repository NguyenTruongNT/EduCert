# Quyết định tích hợp Backend

Đây là các quyết định triển khai được đề xuất trong PR Backend để nhóm review, không phải biên bản đã duyệt M0.

| Mã | Quyết định | Lý do |
| --- | --- | --- |
| BE-D01 | Giữ Hardhat 2 đang có, Solidity 0.8.20 và ABI hiện tại | Bộ 20 contract tests chạy được trên Node 22.17.0; báo cáo nhắc Hardhat 3 cần nhóm cập nhật riêng |
| BE-D02 | Một nguồn contract-config; RPC_URL chỉ chọn node, không tự thay address/chain | Tránh FE/BE đọc nhầm mạng |
| BE-D03 | API camelCase, ví checksum, ID/hash hex thường, thời gian ISO UTC | Khóa định dạng tích hợp |
| BE-D04 | Cookie HttpOnly, SameSite=Lax, CSRF token và Origin allowlist | Bảo vệ thao tác API qua trình duyệt |
| BE-D05 | Upload PDF tạo bản mới có trang xác minh QR bổ sung | Không che nội dung gốc; từ chối PDF mã hóa hoặc đã có chữ ký số |
| BE-D06 | Cung cấp PDF adapter cơ bản và font tiếng Việt có giấy phép | Cho phép Backend chạy độc lập; Tùng có thể thay mẫu theo giao diện adapter |
| BE-D07 | Finalize yêu cầu chủ draft và chứng cứ on-chain; không yêu cầu vẫn giữ issuer role để đối soát giao dịch đã thành công | Khôi phục được giao dịch hợp lệ sau khi role thay đổi; tạo draft mới vẫn kiểm tra issuer role hiện tại |
| BE-D08 | Preview draft chỉ Issuer tạo draft; download chứng chỉ đối chiếu chain và quyền | Không công khai PII hoặc bản nháp |
| BE-D09 | Event API giới hạn cửa sổ tối đa 5000 block, có phân trang và trả mốc block | Truy vấn hữu hạn; FE có thể lần lượt đọc các cửa sổ |
| BE-D10 | Nhánh giai đoạn nối tiếp, PR tổng kết về main từ fork NguyenTruongNT | Tài khoản thực hiện chưa có quyền push repo nhóm; giữ các mốc BE-01 → BE-06 |
