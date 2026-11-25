# KIẾN TRÚC & CHI TIẾT BẢN MOD UNMATCHED EGO 2 (WEBGL)

> **Mục đích dự án:** Phiên bản WebGL của **Unmatched Ego 2** (Unity IL2CPP + Photon Quantum), tập trung mở khóa trang bị kỹ năng miễn phí 100%, vô hiệu hóa quay gacha ở sảnh, và **random động Awakening (`1..14`) ngay trong trận đấu** (áp dụng cho cả Thường / Casual / Ranked / Bot Match và Private Match, kể cả chế độ Infinite Abilities) kèm đồng bộ tên Awakening trực tiếp lên HUD.

---

## 1. Kiến Trúc Tổng Quan & Luồng Dữ Liệu

```text
Trình duyệt người chơi (Client Browser)
 └──> unmatched__ego/index.html (Mock CrazyGames SDK, Mod Toolbar read-only, Anti-Cache ?t=)
       └──> Build/unmatched-ego-2.loader.js + Build/unmatched-ego-2.framework.js
             ├──> Build/unmatched-ego-2.data (56,265,176 bytes - Tài nguyên & UI Strings đã vá)
             └──> Build/unmatched-ego-2.wasm (29,724,971 bytes - Mã máy IL2CPP + Photon Quantum)
```

---

## 2. Cấu Trúc Các Thành Phần Trong Repository

### 2.1. Backend & Cấu Hình (`unmatched__ego/`)
- **[server.js](file:///e:/REG/unmatched__ego/server.js):** Static HTTP server phục vụ WebGL build (`Content-Type: application/wasm`, `.data`, `.framework.js`).
- **[index.html](file:///e:/REG/unmatched__ego/index.html):**
  - Giả lập `window.CrazyGames.SDK` chạy local.
  - Chống cache bằng query `CACHE_BUST` (`?t=`) trên `.data`, `.framework.js`, `.wasm`.
  - Cung cấp bảng ánh xạ `AWAKENING_NAMES` (`1..14`) và hàm chỉ-đọc `window.readMatchAwakeningState()` đọc telemetry từ `.bss` `0x550000..0x550014` để hiển thị trên `#mod-toolbar`.
- **[unmatched-ego-2.framework.js](file:///e:/REG/unmatched__ego/Build/unmatched-ego-2.framework.js):** Mock SDK callbacks, hỗ trợ bàn phím ảo, giữ lỗi runtime không gây `quit_` sập game.

---

## 3. Phân Tích Cơ Chế Awakening Trong Game & Các Bản Vá WASM + DATA

### 3.1. Điều Kiện Nhận Awakening Nguyên Bản (Photon Quantum Simulation)
Theo disassembly từ [unmatched-ego-2.wasm](file:///e:/REG/unmatched__ego/Build/unmatched-ego-2.wasm):
1. **Chế độ Thường / Casual / Ranked / Bot Match (`RuntimeConfig.isPrivateRoom == 0`):**
   - Trong `Quantum.ThirdPersonCharacter.GameplaySystem.Update` (`Func #85617`): yêu cầu `GameStarted == 1`, `GameEnded == 0`, `disableAwk == 0`.
   - Tính phút hiện tại `minute = (int)(ElapsedSeconds(awkTimer) / 60)`. Mỗi khi bước sang phút thứ `1..4` (`minute > lastAwakeningMinute && minute <= 4`), hệ thống gọi `GameplaySystem.GrantRandomAwakening` (`Func #23569`).
2. **Private Match tiêu chuẩn (`isPrivateRoom == 1`, `infiniteAbilities == 0`):**
   - `GameplaySystem.Update` (`#85617`) kiểm tra bộ đếm `60.0s` (`0x3c0000` fixed-point); cứ mỗi 60 giây khi trận đang chạy lại reset timer và gọi `GrantRandomAwakening` (`#23569`).
3. **Private Match bật Infinite Abilities (`infiniteAbilities == 1`):**
   - `Quantum.MovementSystem.SkillUpdate` (`Func #44340`) đưa cooldown Skill 1/2 về `0` và gán `Player->hasAwakening = 1` ở mọi frame; nhấn phím **F** (`PCKeybinds` Action `16`) gọi `PerformAwk` (`#44328`).
4. **Quy tắc chọn người nhận trong `GrantRandomAwakening` (`#23569`):**
   - Lọc các cầu thủ có `Player->hasReceivedAwakening == 0` (`+0x48`), ưu tiên trọng số `3x` cho đội đang thua hoặc hòa so với `1x` cho đội đang dẫn, chọn 1 người bằng `RNGSession.Next`, bật `hasAwakening = 1` (`+0x44`) và `hasReceivedAwakening = 1` (`+0x48`), đồng thời phát sự kiện `FrameEvents.AwakeningGranted` (`#23568`).

### 3.2. Bảng Bản Vá Nhị Phân Trong [Build/unmatched-ego-2.wasm](file:///e:/REG/unmatched__ego/Build/unmatched-ego-2.wasm)
Áp dụng từ script [scratch/apply_dynamic_awakening_v2.py](file:///e:/REG/scratch/apply_dynamic_awakening_v2.py) (tra cứu đúng bảng `CodeGenModule`, **Zero-offset drift**, đạt `WebAssembly.validate === true`):

| Nhóm | Hàm / Vị trí WASM | Byte Offset | Kích thước | Chức năng đã vá |
| :--- | :--- | :---: | :---: | :--- |
| **Skills Free** | **Func #19882** (`.UnlockableSkill.IsUnlocked`) | `5399356` | 84 B | Luôn trả về `1` (`true`) |
| **Skills Free** | **Func #13574** (`.UnlockableSkill.IsSkillUnlocked`) | `3505570` | 78 B | Luôn trả về `1` (`true`) |
| **Skills Free** | **Func #19927** (`.CurrencyManager.SpendMoney`) | `5415551` | 44 B | Luôn trả về `1` (`true`), không trừ Coin |
| **Tắt Gacha Sảnh** | **Func #71277** (`.GachaSystem.StartRoll`) | `19177554` | 225 B | Thoát hàm rỗng (`return` ngay) |
| **Helper Roll** | **Func #71267** (thay `.<RollRoutine>d__39.MoveNext`) | `19175946` | 1018 B | `RollDifferentAwakening(Player*, Frame*)`: dùng `RNGSession.Next` (`#15255`) chọn ngẫu nhiên `1..14` khác giá trị cũ; ghi telemetry `0x550000..0x55000c` |
| **Helper Guard** | **Func #35717** (thay `.GachaSystem.PickRarity`) | `9840797` | 336 B | `GuardOrInitAwakening(Player*, Frame*)`: nếu `disableAwk` trả `-1`; nếu ngoài `[1..14]` khởi tạo ngẫu nhiên; bảo toàn giá trị `1..14` hợp lệ giữa các frame |
| **Helper HUD** | **Func #73489** (thay `CrazyGames.BannerModuleDemo.RequestVideo`) | `19565713` | 401 B | `SyncHudAwakening(PlayerView*, stack_base)`: tra `GachaSystem.Instance->awakenings` (`+0x18`) và cập nhật chữ `GameManager->awkName` (`+0x400`) theo `Player.awkIndex` |
| **Hook Update** | **Func #85853** (`Quantum.MovementSystem.Update`, `+294..329`) | `21446736` | 35 B | Ngừng ghi đè cứng từ `RuntimePlayer->awkIndex` (`+0x74`), gọi `GuardOrInitAwakening` (`#35717`) |
| **Hook Grant** | **Func #23569** (`GameplaySystem.GrantRandomAwakening`) | `6349177` | 1325 B | Gọi `RollDifferentAwakening` (`#71267`) khi trao Awakening cho cầu thủ (tận dụng 11 B của `Debug.Log("Awk given")`) |
| **Hook Perform** | **Func #44328** (`Quantum.MovementSystem.PerformAwk`) | `12233811` | 795 B | Sau khi thực thi Awakening thành công và gán `p->currentSkill = old + 50`, gọi `RollDifferentAwakening` (`#71267`) để đổi sang loại khác cho lần kế tiếp |
| **Hook HUD** | **Func #56046** (`PlayerView.OnUpdateView`, `@2199`) | `17307981` | 11 B | Trong nhánh `PlayerIsLocal`, gọi `SyncHudAwakening` (`#73489`) thay cho lệnh init thừa |

- **Bản đồ chỉ số `awkIndex` (`1..14`) trong `PerformAwk` (`#44328` `br_table`):**
  `1: Direct`, `2: FakeVolley`, `3: SpeedBurst`, `4: Intercept`, `5: PerfectPass`, `6: Nutmeg`, `7: JumpVolley`, `8: BicycleDrive`, `9: TapLift`, `10: AirIntercept`, `11: StagedVolley`, `12: CutIns`, `13: AdaptiveVolley`, `14: KillCounter`.
- **Vùng nhớ Telemetry `.bss` an toàn (`0x550000..0x550014`):**
  - `0x550000`: `awkIdx` lần roll gần nhất (`1..14`)
  - `0x550004`: `rollCount`
  - `0x550008..0x55000b`: cờ `RuntimeConfig` (`isPrivateRoom`, `isRankedRoom`, `infiniteAbilities`, `disableAwk`)
  - `0x55000c`: con trỏ `Player*` cuối cùng được xử lý
  - `0x550010` / `0x550014`: cache `awkIdx` và con trỏ `TMP_Text*` của HUD nội bộ

### 3.3. Bản Vá Chuỗi Trong [Build/unmatched-ego-2.data](file:///e:/REG/unmatched__ego/Build/unmatched-ego-2.data)
Thay thế giữ nguyên độ dài byte (`56,265,176 bytes`):
- `Buy ({0})` $\rightarrow$ `Equip    `
- `Unlock {0} for {1} coins?` $\rightarrow$ `Equip {0}?               `
- `ROLL\n1000 COINS` $\rightarrow$ `RANDOM\nIN MATCH`
- `Not enough coins!` $\rightarrow$ `RANDOM IN MATCH\0\0`

---

## 4. Kiểm Thử Thực Tế (Chrome CDP End-to-End Verification)

Đã kiểm thử bằng [scratch/verify_v3_full_e2e.js](file:///e:/REG/scratch/verify_v3_full_e2e.js) và [scratch/verify_keyf_solo.js](file:///e:/REG/scratch/verify_keyf_solo.js):
1. **Free Skills & Gacha Panel:** `Power Shot` bấm `Equip` gắn thành công vào Slot 1 mà giữ nguyên `Coins: 500` ([e2e_v3_skills_grid.png](file:///e:/REG/scratch/e2e_v3_skills_grid.png), [e2e_v3_slots_after_powershot.png](file:///e:/REG/scratch/e2e_v3_slots_after_powershot.png)); màn hình Gacha hiển thị `RANDOM\nIN MATCH` ([e2e_v3_gacha_screen.png](file:///e:/REG/scratch/e2e_v3_gacha_screen.png)).
2. **Private Match — Infinite Abilities ON:** Spawn ngẫu nhiên `Tap Lift Volley (#9)` ([keyf_solo_spawn.png](file:///e:/REG/scratch/keyf_solo_spawn.png)), nhấn `F` kích hoạt `Speed Burst (#3)` tự động đổi sang `Intercept (#4)` rồi nhấn `F` tiếp đổi sang `Cut-Ins (#12)` và cập nhật chữ HUD trực tiếp theo từng lần ([keyf_solo_after_f1.png](file:///e:/REG/scratch/keyf_solo_after_f1.png), [keyf_solo_after_f2.png](file:///e:/REG/scratch/keyf_solo_after_f2.png)).
3. **Private Match tiêu chuẩn (1v1, Infinite Abilities OFF):** Spawn ngẫu nhiên (`#9` / `#12`), sau khi bộ đếm 60s kích hoạt `GrantRandomAwakening`, người chơi nhận Awakening (`hasAwakening=1`), re-roll sang `Bicycle Drive (#8)` và HUD cập nhật thành `Bicycle Drive [F]` ([e2e_v3_priv_std_after60s.png](file:///e:/REG/scratch/e2e_v3_priv_std_after60s.png)).
4. **Casual Match (`isPrivateRoom = 0`):** Vào trận public thực tế với `awkIndex` khởi tạo ngẫu nhiên (`AdaptiveVolley #3`, HUD cục bộ `#14`) ([e2e_v3_casual_match.png](file:///e:/REG/scratch/e2e_v3_casual_match.png)).
