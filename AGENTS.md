# HƯỚNG DẪN HOẠT ĐỘNG DÀNH CHO AI AGENT (AGENTS.md)

> **Dự án:** Unmatched Ego 2 (WebGL Mod & Hosting)  
> **Tính chất:** Dự án giải trí cá nhân cho vui vẻ, không áp đặt các quy trình khắt khe hay thủ tục rườm rà.

---

## 1. Nguyên Tắc Cốt Lõi (Core Principles)

1. **Kiểm tra kỹ lưỡng mọi thay đổi (Always Verify):**
   - Trước và sau khi thay đổi bất kỳ tệp tin nào (đặc biệt là tệp nhị phân `.wasm`, code `server.js`, hoặc cấu trúc `index.html`), Agent **bắt buộc phải kiểm tra lại** xem có sai sót hay không.
   - Khi chỉnh sửa file `.wasm`, luôn chạy kiểm tra tính hợp lệ bằng lệnh:
     ```bash
     node -e "const fs = require('fs'); console.log('Wasm Valid:', WebAssembly.validate(fs.readFileSync('Build/unmatched-ego-2.wasm')));"
     ```
   - Đảm bảo file `.wasm` đạt `Wasm Valid: true` thì mới được commit hoặc bàn giao.

2. **Giữ lại các file công cụ trong `scratch/` (Keep Scratch Scripts):**
   - Tuyệt đối **không xóa** các file script Python (`.py`), file văn bản (`.txt`) hay metadata trong thư mục `scratch/`.
   - Các file này chứa công cụ dịch ngược (disassembler), tra cứu metadata, tìm bảng vtable và script vá nhị phân. Chúng có giá trị tái sử dụng rất lớn cho các tính năng mod tiếp theo.

3. **Tiết kiệm Token & Tối Ưu Hóa Tương Tác:**
   - Tránh in toàn bộ nội dung file lớn, transcript dài hay các khối log dư thừa vào màn hình chat.
   - Câu trả lời cần ngắn gọn, tập trung thẳng vào giải pháp và kết quả.

4. **Chủ động nhờ người dùng hỗ trợ các việc đơn giản:**
   - Khi một tác vụ có thể do người dùng thực hiện nhanh hơn hoặc tiết kiệm token hơn (ví dụ: gõ lệnh `git push origin main`, mở trình duyệt test, bấm `Ctrl + Shift + R` để làm mới cache), hãy cung cấp câu lệnh sẵn sàng để người dùng copy-paste thực hiện.

---

## 2. Quy Tắc Vá Mã Nhị Phân WebAssembly (WASM Patching Rules)

Khi can thiệp trực tiếp vào file `Build/unmatched-ego-2.wasm`:
- **Bảo toàn số byte (Zero-offset drift):** Không làm tăng hay giảm kích thước của bất kỳ hàm nào. Bản vá phải có chiều dài byte **bằng đúng 100%** kích thước hàm gốc.
- **Vị trí chỉ lệnh `0x0b` (End):**
  - Trong chuẩn WebAssembly, byte kết thúc hàm `0x0b` **phải luôn nằm ở vị trí byte cuối cùng** của phần thân hàm.
  - Mọi chỉ lệnh NOP (`0x01`) đệm phải đặt **TRƯỚC** `0x0b`, không được đặt sau `0x0b`.
  - Cấu trúc mẫu cho hàm trả về `1` (`true`):
    ```
    [0x00]              ; 0 local declarations
    [0x41, 0x01]        ; i32.const 1
    [0x01 ... 0x01]     ; (size - 4) x NOP
    [0x0b]              ; end (byte cuối cùng)
    ```

---

## 3. Quy Trình Cập Nhật & Đẩy Code (Workflow Guide)

Khi hoàn thành một tính năng hoặc sửa lỗi:
1. **Kiểm tra tính hợp lệ:** Chạy test hoặc validate file đã sửa.
2. **Tăng phiên bản Cache:** Tăng biến `BUILD_VER` trong `index.html` (ví dụ `v4` $\rightarrow$ `v5`) để người chơi không bị vướng bộ nhớ đệm trình duyệt cũ.
3. **Commit & Hướng dẫn người dùng Push:**
   - Tạo commit với nội dung rõ ràng:
     ```bash
     git add Build/unmatched-ego-2.wasm index.html
     git commit -m "Mô tả tính năng hoặc bản vá"
     ```
   - Cung cấp lệnh để người dùng có thể tự push hoặc nhờ người dùng chạy:
     ```bash
     git push origin main
     ```
   - Nhắc người dùng đợi Render build (khoảng 1-2 phút) và tải lại web với `Ctrl + Shift + R`.

---

## 4. Bảng Tra Cứu Nhanh (Cheat Sheet)

| Tệp / Thư mục | Vai trò |
| :--- | :--- |
| `index.html` | Client wrapper, giả lập SDK CrazyGames, chống cache, Mod menu nổi |
| `server.js` | Express static server, phục vụ WebGL trên Render |
| `Build/unmatched-ego-2.wasm` | Mã máy logic game C++ (IL2CPP) |
| `Build/unmatched-ego-2.framework.js` | Emscripten JS runtime, chứa hàm kiểm tra Sitelock |
| `scratch/` | Thư mục chứa các script Python dịch ngược và metadata gốc |
