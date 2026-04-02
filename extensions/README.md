# Extensions

Thư mục này chứa các tùy biến cá nhân cho Claw Code.

## Cấu trúc

- `preflight.rs` - Logic chạy trước khi khởi động Core, bao gồm:
  - **Vá lỗi Windows**: Tự động chuyển `USERPROFILE` thành `HOME`
  - **Tìm file .env thông minh**: Tự động tìm ở thư mục hiện tại, thư mục cha, hoặc thư mục gốc
  - Thiết lập biến môi trường (chỉ khi chưa tồn tại)
  - Cho phép hardcode cấu hình nếu cần

## Vá lỗi Windows

Claw Code gốc được thiết kế cho Unix/Linux/Mac, nên nó tìm biến `HOME` để xác định thư mục người dùng. Trên Windows, biến này không tồn tại (thay vào đó là `USERPROFILE`).

File `preflight.rs` tự động vá lỗi này bằng cách:
```rust
if env::var("HOME").is_err() {
    if let Ok(user_profile) = env::var("USERPROFILE") {
        env::set_var("HOME", user_profile);
    }
}
```

Nhờ đó, Claw Code chạy mượt mà trên Windows mà không cần sửa Core!

## Cách sử dụng

1. Tạo file `.env` ở thư mục gốc (copy từ `.env.example`)
2. Điền thông tin API key và cấu hình của bạn
3. Build và chạy Claw như bình thường

## Khi update Core

Khi có phiên bản mới của Claw Code:

1. Thư mục `extensions/` và file `.env` của bạn giữ nguyên
2. Chỉ cần mở `rust/crates/claw-cli/src/main.rs` và thêm lại 2 dòng:
   - Thêm module: `#[path = "../../../../extensions/preflight.rs"] mod preflight;`
   - Gọi hàm: `preflight::setup_env();` ở đầu `main()`

Đơn giản và chuyên nghiệp!
