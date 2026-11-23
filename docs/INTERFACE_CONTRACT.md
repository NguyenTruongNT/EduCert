# Hợp đồng tích hợp Backend / Frontend

Đặc tả chi tiết và ví dụ sử dụng được hoàn thiện trong giai đoạn BE-06. Tiền tố `/api/v1`. JSON dùng camelCase; thành công `{ "success": true, "data": ... }`, lỗi `{ "success": false, "error": { "code": "...", "message": "..." } }`.

| Method | Đường dẫn | Quyền / mục đích |
| --- | --- | --- |
| GET | `/health` | Kiểm tra tiến trình |
| GET | `/config` | Mạng, contract, ABI và giới hạn công khai |
| POST | `/auth/nonce` | Tạo thông điệp gắn nonce và ví |
| POST | `/auth/verify` | Xác minh chữ ký, trả cookie và CSRF token |
| GET | `/auth/me` | Khôi phục phiên và CSRF token |
| POST | `/auth/logout` | Hủy phiên; cần CSRF |
| POST | `/drafts/generate` | Issuer tạo PDF mẫu |
| POST | `/drafts/upload` | Issuer gửi multipart PDF |
| GET | `/drafts/:id` | Chủ draft đọc metadata |
| GET | `/drafts/:id/preview` | Chủ draft đọc byte PDF cuối |
| POST | `/certificates/:id/finalize` | Chủ draft gửi txHash để đối soát |
| GET | `/certificates/:id/public` | Metadata chain không PII |
| GET | `/certificates/:id/download` | Student sở hữu / Issuer gốc / Admin |
| GET | `/me/certificates` | Danh sách của ví đang đăng nhập |
| GET | `/stats` | Bộ đếm chain |
| GET | `/events` | Nhật ký chain có phân trang |

Frontend dùng `credentials: 'include'`; các POST sau đăng nhập gửi `X-CSRF-Token`. Chỉ các Origin cấu hình rõ ràng được phép. Frontend tự gọi `issueCertificate`/`revokeCertificate` bằng MetaMask, API không ký thay. Băm PDF bằng Web Crypto trước khi ký và khi xác minh; public API không nhận PDF.
