# KIẾN TRÚC HỆ THỐNG - UNMATCHED EGO 2 (MOD & LOCAL EDITION)

> **Mục đích dự án:** Dự án mod và lưu trữ trò chơi Unmatched Ego 2 (Unity 6 WebGL / IL2CPP). Dự án tập trung vào việc chạy game mượt mà, gỡ bỏ giới hạn Sitelock/Quảng cáo, loại bỏ rào cản cày cuốc (tiền tệ/coins), mở khóa toàn bộ kỹ năng miễn phí 100%, gỡ bỏ cơ chế quay gacha tốn tiền ở sảnh và tự động cấp ngẫu nhiên thức tỉnh (Awakening) khi vào trận đấu.

---

## 1. Cấu Trúc Tổng Quan (High-Level Architecture)

```
[ Trình duyệt Client ]
        │
        ├──> index.html (Wrapper, Mock CrazyGames SDK, Mod Toolbar, Awakening Randomizer, Anti-Cache)
        │
        └──> Node.js Express Server (server.js) [Hosted on Render.com & Localhost]
                    │
                    ├──> Build/unmatched-ego-2.loader.js (Unity WebGL Loader)
                    ├──> Build/unmatched-ego-2.framework.js (Emscripten Bridge & Patched SystemInfo)
                    ├──> Build/unmatched-ego-2.wasm (Patched C++ Core Engine - IL2CPP)
                    └──> Build/unmatched-ego-2.data (3D Assets, UI Textures, Patched UI Strings)
```

---

## 2. Các Thành Phần Chính

### 2.1. Backend & Server (`server.js`)
- **Nền tảng:** Node.js HTTP/Express thuần không phụ thuộc thư viện ngoài.
- **Nhiệm vụ:**
  - Phục vụ toàn bộ tệp tĩnh của WebGL với đúng MIME Types và tiêu đề CORS (`Cross-Origin-Embedder-Policy`, `Cross-Origin-Opener-Policy`).
  - Hỗ trợ lưu trữ cấu hình hoặc điểm số nhẹ qua `database.json`.
  - Stream an toàn (`createReadStream`) không crash khi client ngắt kết nối đột ngột.
- **Triển khai:** Hỗ trợ chạy cục bộ mạng LAN (`localhost:8080`) hoặc triển khai tự động lên **Render.com** qua GitHub repository `Huu-Duy/unmatched-ego-3`.

### 2.2. Client Frontend Wrapper (`index.html`)
- **Khởi chạy Unity:** Sử dụng `createUnityInstance` nạp tài nguyên từ thư mục `Build/`.
- **Giả lập CrazyGames SDK (`window.CrazyGames.SDK`):**
  - Giả lập toàn bộ các API gốc (`init`, `requestAd`, `happytime`, `gameplayStart`, `gameplayStop`...).
  - Vượt qua kiểm tra SDK bắt buộc, ngăn chặn đứng màn hình hoặc treo do lỗi nạp quảng cáo.
  - Tích hợp hook `gameplayStart` để tự động kích hoạt bộ sinh ngẫu nhiên Awakening khi trận đấu bắt đầu.
- **Cơ chế Chống Lưu Đệm (Anti-Caching / Cache Busting):**
  - Gắn tham số thời gian thực `?t=${Date.now()}` vào `dataUrl`, `frameworkUrl`, `codeUrl`.
  - Cấu hình `cacheControl: () => "no-store"` ngăn UnityCache lưu cứng file WebAssembly trong IndexedDB.
  - Script tự động tìm và xóa database `UnityCache` cũ trên trình duyệt người dùng khi mở trang.
- **Bảng điều khiển Mod (`#mod-toolbar`):**
  - Giao diện nổi bật góc trên bên phải, hỗ trợ đổi Nickname người chơi tự do.
  - **Mục Thức Tỉnh (Awakening):** Hiển thị Awakening đang kích hoạt và nút "🎲 Đổi Ngẫu Nhiên Awakening" để người chơi kiểm tra hoặc đổi mới tùy ý.
  - Hiển thị bảng phím tắt kỹ năng (`R`, `T`, `F`, `Shift`, `Space`).

---

## 3. Bản Vá WebAssembly & IL2CPP (Reverse Engineering)

Game được biên dịch từ C# sang C++ qua Unity 6 IL2CPP và xuất ra WebAssembly (`unmatched-ego-2.wasm` - kích thước cố định: `29,724,971 bytes`).

### 3.1. Vượt Sitelock & SDK
- **Hàm:** `_JS_SystemInfo_GetDocumentURL` trong `unmatched-ego-2.framework.js` và WASM.
- **Cơ chế:** Trả về URL hợp lệ thuộc tên miền cho phép của game gốc (`https://www.crazygames.com/game/...`), ngăn chặn cơ chế tự khóa màn hình.

### 3.2. Mở Khóa & Miễn Phí Kỹ Năng 100% (Phase 2)
Không phụ thuộc vào biến Coin hay dữ liệu lưu trong máy, các hàm quyết định trạng thái kỹ năng và luồng trang bị trong `Build/unmatched-ego-2.wasm` đã được can thiệp:

| Hàm trong WASM | Offset Byte | Kích Thước | Chức Năng Gốc | Logic Sau Khi Vá |
| :--- | :--- | :--- | :--- | :--- |
| **Func #43444** | `11981431` | 118 bytes | `UnlockableSkill.IsUnlocked` | Luôn trả về `1` (`true`) |
| **Func #43437** | `11980182` | 95 bytes | `UnlockableSkill.IsSkillUnlocked` | Luôn trả về `1` (`true`) |
| **Func #84202** | `21198852` | 17 bytes | Vtable Stub cho `IsUnlocked` | Luôn trả về `1` (`true`) |
| **Func #84195** | `21198568` | 15 bytes | Vtable Stub cho `IsSkillUnlocked` | Luôn trả về `1` (`true`) |
| **Func #23212** | `6276939` | 121 bytes | `UnlockableSkill.OnClick` | Nhảy trực tiếp sang gọi hàm Equip (`#43441`) |
| **Func #23213** | `6277062` | 175 bytes | `UnlockableSkill.OnUnlockConfirmed` | Nhảy trực tiếp sang gọi hàm Equip (`#43441`) |
| **Func #84200** | `21198779` | 56 bytes | Vtable Invoker cho `OnClick` | Gọi hàm Equip (`#43441`) |
| **Func #84199** | `21198718` | 60 bytes | Vtable Invoker cho `OnUnlockConfirmed` | Gọi hàm Equip (`#43441`) |

$\rightarrow$ **Kết quả:** Toàn bộ kỹ năng hiển thị nút `Equip`. Khi người chơi bấm vào kỹ năng, game lập tức trang bị trực tiếp mà không bao giờ mở hộp thoại hỏi mua hay kiểm tra tiền.

### 3.3. Xóa Bỏ Giá Tiền & Hộp Thoại Mua Trên Giao Diện (`unmatched-ego-2.data`)
Trong tệp nhị phân tài nguyên `unmatched-ego-2.data` (kích thước cố định: `56,265,176 bytes`), các chuỗi định dạng văn bản đã được vá chuẩn xác từng byte:
- `Buy ({0})` (9 bytes) $\rightarrow$ `Equip    ` (9 bytes)
- `Unlock {0} for {1} coins?` (25 bytes) $\rightarrow$ `Equip {0}?               ` (25 bytes)

### 3.4. Vô Hiệu Hóa Vòng Quay Gacha Tiền Tệ Ở Sảnh (Phase 3A)
Gỡ bỏ hoàn toàn cơ chế tiêu tiền quay Gacha ở sảnh chờ:
- **Func #78510** (Offset `20222295`, 52b): `ClearDisplay / StartRoll thunk` $\rightarrow$ void return.
- **Func #77081** (Offset `20015407`, 44b): `StartRoll core` $\rightarrow$ return local 0 (thoát ngay).
- **Func #78509** (Offset `20222242`, 52b): `RollRoutine thunk` $\rightarrow$ void return.
- **Func #2619** (Offset `805178`, 50b) & **Func #1625** (Offset `605400`, 531b): `StartRoll invoker/core` $\rightarrow$ return local 0.
- **Trong `unmatched-ego-2.data`:**
  - `ROLL\n1000 COINS` (15 bytes) $\rightarrow$ `RANDOM\nIN MATCH` (15 bytes).
  - `Not enough coins!` (17 bytes) $\rightarrow$ `RANDOM IN MATCH\0\0` (17 bytes).

### 3.5. Cơ Chế Thức Tỉnh Động Ngẫu Nhiên Trong Trận Đấu (Dynamic In-Match Multi-Awakening)
Theo đúng cơ chế gốc của game, trong một trận đấu một cầu thủ có thể được kích hoạt/nhận Awakening nhiều lần (thông qua quyết định của Simulation/Quantum Engine). Thay vì bị gán cứng một loại Awakening duy nhất chọn từ ngoài sảnh, bản vá can thiệp để **mỗi lần nhận Awakening trong trận đấu đều được random một kỹ năng mới khác nhau** trong danh sách 14 loại thức tỉnh (`0..13`):
1. **Playmaker** (0)
2. **Speedster** (1)
3. **Fakeout** (2)
4. **Metavision** (3)
5. **Finesse** (4)
6. **Finisher** (5)
7. **Destruction** (6)
8. **Quickshot** (7)
9. **Control** (8)
10. **Hardhead** (9)
11. **Genius** (10)
12. **Emperor** (11)
13. **Inspiration** (12)
14. **Destroyer** (13)

**Kiến trúc kỹ thuật nhị phân (Binary Implementation):**
- **Địa chỉ bộ nhớ chia sẻ `0x550000` (Awakening ID) & `0x550004` (Seed PRNG):**
  - `0x550004`: Lưu trữ seed 32-bit cho thuật toán Linear Congruential Generator (LCG).
  - `0x550000`: Lưu chỉ số Awakening hiện tại (0..13).
- **Bộ máy sinh số ngẫu nhiên WASM (Func #15138 & wasmTable[88158]):**
  - Công thức LCG: `seed = (seed * 1664525 + 1013904223 + param0) >>> 0`.
  - Chỉ số Awakening: `((seed ^ (seed >>> 16)) >>> 0) % 14`.
  - Ghi seed mới vào `0x550004` và ghi Awakening mới vào `0x550000`.
- **Can thiệp vào `PlayerView.HandlePassives` (Func #73237):**
  - **Loc 1 (Offset `19534168`, 11b):** `41 80 80 d4 02 41 00 10 a2 76 01` (`i32.const 0x550000; i32.const 0; call 15138; nop`).
    - Mỗi khi game gọi `HandlePassives` để trao Awakening cho cầu thủ, nó lập tức kích hoạt bộ sinh ngẫu nhiên `Func #15138`, tịnh tiến seed và bốc một Awakening mới.
  - **Loc 1b (Offset `19534179`, 11b):** `41 80 80 d4 02 28 02 00 21 01 01` (`i32.const 0x550000; i32.load; local.set 1; nop`).
    - Nạp ngay Awakening mới bốc được vào `local 1` để thực hiện kiểm tra logic nội bộ.
  - **Loc 2 (Offset `19534276`, 11b):** `41 80 80 d4 02 28 02 00 22 01 01` (`i32.const 0x550000; i32.load; local.tee 1; nop`).
    - Đồng bộ Awakening mới này vào cả `PassiveController` (`[PlayerView + 0x50] + 0x0c`) và `VisualController` (`[PlayerView + 0xbc] + 0x0c`).
- **Giữ nguyên 100% cơ chế gốc:**
  - Không tạo thêm phím bấm hay điều kiện stamina tùy tiện.
  - Game tự quyết định khi nào và cầu thủ nào được thức tỉnh, chỉ có loại thức tỉnh được nhận là hoàn toàn ngẫu nhiên và biến hóa mỗi lần.

---

## 4. Kiểm Thử Toàn Diện (End-to-End Verification)

Toàn bộ hệ thống đã trải qua kiểm thử thực tế bằng Chrome Headless DevTools Protocol:
1. **Lobby & Currency Bypass:** Vượt qua kiểm tra tiền tệ, không xuất hiện lỗi số dư.
2. **Skills Screen:** Toàn bộ skill hiển thị nhãn `Equip`, bấm trang bị trực tiếp không hỏi coin ([e2e_4a_5_skills_overview.png](file:///e:/REG/scratch/e2e_4a_5_skills_overview.png)).
3. **Gacha Panel:** Nút bấm hiển thị `RANDOM\nIN MATCH`, click kiểm tra an toàn không crash ([e2e_4a_3_gacha_panel.png](file:///e:/REG/scratch/e2e_4a_3_gacha_panel.png)).
4. **In-Match Spawn:** PlayerView spawn thành công trên sân bóng, điều khiển mượt mà, nhận đúng Awakening ngẫu nhiên được cấp ([e2e_4a_8_gameplay_match1_4.png](file:///e:/REG/scratch/e2e_4a_8_gameplay_match1_4.png)).
5. **Multi-match Randomness:** Xác nhận Awakening thay đổi động và độc lập giữa các trận đấu ([e2e_4a_9_gameplay_match2.png](file:///e:/REG/scratch/e2e_4a_9_gameplay_match2.png)).

---

## 5. Nguyên Tắc Bất Di Bất Dịch (Binary Integrity Checklist)

- **Zero-offset Drift:**
  - Kích thước [Build/unmatched-ego-2.wasm](file:///e:/REG/unmatched__ego/Build/unmatched-ego-2.wasm) bắt buộc cố định chính xác `29,724,971 bytes`.
  - Kích thước [Build/unmatched-ego-2.data](file:///e:/REG/unmatched__ego/Build/unmatched-ego-2.data) bắt buộc cố định chính xác `56,265,176 bytes`.
- **WebAssembly Validation:** Mọi bản vá nhị phân phải đạt `WebAssembly.validate(bytes) === true`.
- **Cache-Busting Discipline:** Luôn duy trì query timestamp chống lưu đệm trên trình duyệt người dùng.
