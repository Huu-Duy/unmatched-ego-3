# KIẾN TRÚC HỆ THỐNG - UNMATCHED EGO 2 (MOD & LOCAL EDITION)

> **Mục đích dự án:** Đây là dự án mod và lưu trữ trò chơi giải trí, không yêu cầu các quy chuẩn doanh nghiệp khắt khe. Dự án tập trung vào việc chạy game mượt mà, gỡ bỏ giới hạn Sitelock/Quảng cáo, loại bỏ rào cản cày cuốc (tiền tệ/coins) và cho phép người chơi trải nghiệm toàn bộ kỹ năng miễn phí.

---

## 1. Cấu Trúc Tổng Quan (High-Level Architecture)

```
[ Trình duyệt Client ]
        │
        ├──> index.html (Wrapper, Mock CrazyGames SDK, Mod Toolbar, Cache Busting)
        │
        └──> Node.js Express Server (server.js) [Hosted on Render.com]
                    │
                    ├──> Build/unmatched-ego-2.loader.js (Unity WebGL Loader)
                    ├──> Build/unmatched-ego-2.framework.js (Emscripten Bridge & Patched SystemInfo)
                    ├──> Build/unmatched-ego-2.wasm (Patched C++ Core Engine - IL2CPP)
                    └──> Build/unmatched-ego-2.data (3D Assets, Animations, Shaders, Sound)
```

---

## 2. Các Thành Phần Chính

### 2.1. Backend & Server (`server.js`)
- **Nền tảng:** Node.js Express.
- **Nhiệm vụ:**
  - Phục vụ toàn bộ tệp tĩnh của WebGL với đúng Content-Type và Content-Encoding.
  - Cấu hình tiêu đề CORS và bảo mật cơ bản (`Cross-Origin-Embedder-Policy`, `Cross-Origin-Opener-Policy`).
  - Hỗ trợ lưu cấu hình hoặc điểm số nhẹ qua `database.json`.
- **Triển khai:** Web Service trên **Render.com** (tự động build & deploy mỗi khi có commit mới đẩy lên nhánh `main` của GitHub `Huu-Duy/unmatched-ego-3`).

### 2.2. Client Frontend Wrapper (`index.html`)
- **Khởi chạy Unity:** Gọi `createUnityInstance` nạp các tệp trong thư mục `Build/`.
- **Giả lập CrazyGames SDK (`window.Crazygames` / `window.CrazySDK`):**
  - Giả lập toàn bộ các hàm API của cổng game gốc (`init`, `requestAd`, `happytime`, `gameplayStart`, `gameplayStop`...).
  - Vượt qua kiểm tra SDK bắt buộc, ngăn game bị đứng/treo khi cố gắng tải quảng cáo hoặc banner từ máy chủ bên thứ ba.
- **Cơ chế Chống Lưu Đệm (Anti-Caching / Cache Busting):**
  - Gắn tham số phiên bản `?v=X` vào `dataUrl`, `frameworkUrl`, `codeUrl`.
  - Cấu hình `cacheControl: () => "no-store"` ngăn UnityCache lưu cứng file WebAssembly trong IndexedDB.
  - Script tự động tìm và xóa database `UnityCache` cũ trên trình duyệt người dùng khi mở trang.
- **Bảng điều khiển Mod (`#mod-toolbar`):**
  - Giao diện nhỏ gọn góc trên bên phải giúp bật/tắt hướng dẫn kỹ năng.
  - Tích hợp nút nạp Coin tức thì qua `unityInstance.SendMessage("CurrencyManager", "AddMoney", ...)`.

---

## 3. Bản Vá WebAssembly & IL2CPP (Reverse Engineering)

Game được biên dịch từ C# sang C++ qua Unity 6 IL2CPP và xuất ra WebAssembly (`unmatched-ego-2.wasm`).

### 3.1. Vượt Sitelock
- **Hàm:** `_JS_SystemInfo_GetDocumentURL` trong `unmatched-ego-2.framework.js` và WASM.
- **Cơ chế:** Trả về URL hợp lệ thuộc tên miền cho phép của game gốc (`https://www.crazygames.com/game/...`), ngăn chặn cơ chế tự khóa màn hình.

### 3.2. Mở Khóa Kỹ Năng Hoàn Toàn (Skill Free Mod)
Không phụ thuộc vào biến Coin hay dữ liệu lưu trong máy, các hàm quyết định trạng thái kỹ năng trong `Build/unmatched-ego-2.wasm` đã được vá mã máy trực tiếp:

| Hàm trong WASM | Offset Byte | Kích Thước | Chức Năng Gốc | Logic Sau Khi Vá |
| :--- | :--- | :--- | :--- | :--- |
| **Func #43444** | `11981431` | 118 bytes | `UnlockableSkill.IsUnlocked` | Luôn trả về `1` (`true`) |
| **Func #43437** | `11980182` | 95 bytes | `UnlockableSkill.IsSkillUnlocked` | Luôn trả về `1` (`true`) |
| **Func #43443** | `11981228` | 202 bytes | `unlockedList.Contains(skillIndex)` | Luôn trả về `1` (`true`) |
| **Func #84201** | `21198836` | 15 bytes | Vtable Stub cho `RefreshButton` | Luôn trả về `1` (`true`) |
| **Func #84202** | `21198852` | 17 bytes | Vtable Stub cho `IsUnlocked` | Luôn trả về `1` (`true`) |
| **Func #84195** | `21198568` | 15 bytes | Vtable Stub cho `IsSkillUnlocked` | Luôn trả về `1` (`true`) |

$\rightarrow$ **Kết quả:** Tất cả các kỹ năng đều hiển thị sẵn trạng thái sẵn sàng trang bị ("Equip"), khi người chơi bấm vào nút sẽ lập tức trang bị ("Equipped") mà không bao giờ kích hoạt luồng hỏi mua hay trừ Coin.

---

## 4. Thư Mục Công Cụ & Nghiên Cứu (`scratch/`)

Thư mục `scratch/` nằm ở thư mục gốc workspace `e:\REG\scratch\` là kho vũ khí dịch ngược:
- **`global-metadata.dat`:** Metadata trích xuất từ game, chứa toàn bộ tên class, field, method, token, string literal.
- **Script phân tích & dịch ngược:**
  - `trace_*.py`: Disassembler tự viết đọc byte opcode của từng hàm WASM.
  - `inspect_skill_methods.py`: Định vị metadata và vtable của class `UnlockableSkill`.
  - `find_t_for_funcs.py`: Ánh xạ bảng phần tử (WASM Table Section) sang Function Index.
  - `patch_all_skills.py`: Tự động áp dụng các bản vá nhị phân chính xác từng byte vào file `.wasm`.
