# Hướng dẫn sử dụng NVIDIA API với Claw Code

## Lỗi Windows đã được vá

File `preflight.rs` đã tự động vá:
- ✅ Lỗi `HOME is not set` trên Windows
- ✅ Tự động tìm file `.env` ở thư mục gốc (ngay cả khi chạy từ `rust/`)

## Cấu hình nhanh

File `.env` đã được tạo sẵn ở thư mục gốc với cấu hình NVIDIA. Bạn chỉ cần chạy:

```bash
cd rust
cargo run --bin claw -- --model stepfun-ai/step-3.5-flash
```

## Các cách sử dụng

### 1. Chế độ REPL (Interactive)
```bash
cd rust
cargo run --bin claw -- --model stepfun-ai/step-3.5-flash
```

### 2. Chế độ Prompt một lần
```bash
cd rust
cargo run --bin claw -- --model stepfun-ai/step-3.5-flash prompt "Viết hàm Fibonacci bằng Rust"
```

### 3. Đặt model mặc định
Mở file `.env` và bỏ comment dòng:
```env
CLAW_MODEL=stepfun-ai/step-3.5-flash
```

Sau đó chạy đơn giản:
```bash
cd rust
cargo run --bin claw
```

## Về Reasoning Tokens

Model `step-3.5-flash` hỗ trợ reasoning (suy nghĩ trước khi trả lời), tương tự DeepSeek-R1.

**Hiện trạng:**
- Claw Code chạy hoàn hảo với model này
- Luồng reasoning chạy ngầm, chỉ hiển thị kết quả cuối cùng
- Nếu muốn xem cả quá trình suy nghĩ, cần sửa `rust/crates/api/src/providers/openai_compat.rs`

**Để hiển thị reasoning (tùy chọn):**
Thêm trường `reasoning_content` vào struct `ChunkDelta`:
```rust
struct ChunkDelta {
    #[serde(default)]
    content: Option<String>,
    #[serde(default)]
    reasoning_content: Option<String>,  // Thêm dòng này
    // ...
}
```

## Bảo mật

⚠️ File `.env` đã được thêm vào `.gitignore` để tránh commit API key lên Git.

Nếu cần đổi API key:
1. Mở file `.env`
2. Thay giá trị `OPENAI_API_KEY`
3. Không cần build lại, chỉ cần chạy lại Claw

## Các model khác của NVIDIA

NVIDIA hỗ trợ nhiều model khác, bạn có thể thử:
- `meta/llama-3.1-405b-instruct`
- `google/gemma-2-27b-it`
- `mistralai/mixtral-8x7b-instruct-v0.1`

Chỉ cần thay tên model trong lệnh `--model`.
