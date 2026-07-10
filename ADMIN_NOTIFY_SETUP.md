# คู่มือเพิ่มการแจ้งเตือน "เข้ากลุ่มแอดมิน" เมื่อมีคำขอจองใหม่

เดิมระบบ push ข้อความ LINE **หาลูกค้า** หลังกดจอง (ผ่าน Apps Script)
คู่มือนี้เพิ่มให้ push **เข้ากลุ่มแชทแอดมิน** พร้อมกันในครั้งเดียว

> **สำคัญ:** โค้ดที่ต้องแก้ **อยู่ใน Google Apps Script** (backend ที่ผูกกับชีท `Bookings`)
> ไม่ใช่ไฟล์ในโปรเจกต์นี้ — repo นี้มีแต่หน้าเว็บ (`booking.html` ฯลฯ) ที่ยิงข้อมูลไปหา Apps Script ผ่าน `API_URL`
> เปิดแก้ได้ที่: ชีท ▸ เมนู **Extensions ▸ Apps Script**
>
> คู่มือนี้อ้างอิงชื่อจริงในไฟล์ Apps Script ของโปรเจกต์: ค่าคงที่ `LINE_ACCESS_TOKEN`,
> ฟังก์ชัน `sendLineNotification(to, messageObj)` และ `handleCreate(p)`

---

## ภาพรวม 4 ขั้นตอน

1. ใช้ **`LINE_ACCESS_TOKEN`** เดิม (ตัวเดียวกับที่ push หาลูกค้า) — ไม่ต้องขอใหม่
2. เชิญ **LINE Official Account (บอทของร้าน) เข้ากลุ่มแอดมิน**
3. **หา Group ID** ของกลุ่มนั้น (ทำครั้งเดียว)
4. วางฟังก์ชัน `notifyAdminGroup()` แล้วเรียกใน `handleCreate()`

---

## ขั้นที่ 1 — Token

ไฟล์ Apps Script มี token อยู่แล้วบนสุดของไฟล์:

```js
const LINE_ACCESS_TOKEN = "……";   // ← ใช้ตัวนี้ซ้ำได้เลย ไม่ต้องเพิ่มอะไร
```

ฟังก์ชัน `sendLineNotification(to, messageObj)` ที่มีอยู่แล้ว push ไปที่ `to` อะไรก็ได้
**รวมถึง Group ID** จึงนำมาใช้ push เข้ากลุ่มได้ทันที

---

## ขั้นที่ 2 — เชิญบอทเข้ากลุ่มแอดมิน

1. เปิดกลุ่มแชทแอดมินใน LINE (หรือสร้างกลุ่มใหม่)
2. เชิญ **Official Account ของร้าน** (บอทตัวเดียวกับที่คุยกับลูกค้า) เข้ากลุ่ม
3. ตรวจว่าเปิดให้บอทเข้ากลุ่มได้:
   LINE Official Account Manager ▸ **Settings ▸ Response settings** ▸ เปิด *Join group chats*

---

## ขั้นที่ 3 — หา Group ID (ทำครั้งเดียว)

Group ID มองไม่เห็นตรง ๆ ต้องให้บอทบอกเรามา วิธีที่ง่ายสุดคือ
ตั้งให้ Apps Script ตอบ Group ID กลับเข้ากลุ่มเมื่อมีคนพิมพ์ข้อความ

### 3.1 เพิ่ม "โหมดหา Group ID" ชั่วคราวใน `doPost`

ในไฟล์ Apps Script หา `function doPost(e) {` แล้วเพิ่มบล็อกนี้ **เป็นบรรทัดแรก
ในบล็อก `try`** (ก่อน `const payload = JSON.parse(...)` เดิม):

```js
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    // ── LINE webhook: ตอบ Group ID กลับเข้ากลุ่ม (ใช้ชั่วคราวตอนตั้งค่า) ──
    if (body.events) {
      body.events.forEach(function (ev) {
        const gid = ev.source && ev.source.groupId;
        if (gid && ev.replyToken) {
          UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", {
            method: "post",
            headers: { "Content-Type":"application/json",
                       "Authorization":"Bearer " + LINE_ACCESS_TOKEN },
            payload: JSON.stringify({
              replyToken: ev.replyToken,
              messages: [{ type:"text", text:"GROUP ID:\n" + gid }]
            }),
            muteHttpExceptions: true
          });
        }
      });
      return jsonResponse({ status:"ok" });
    }

    const payload = JSON.parse(e.postData.contents);   // ← บรรทัดเดิม อยู่ต่อจากนี้
    // ... โค้ด router เดิมทั้งหมด ...
```

> ระบบแยกออกเองว่า POST มาจาก **LINE (มี `body.events`)** หรือจาก **หน้าเว็บจอง (ไม่มี)**
> จึงไม่กระทบการจองเดิม

### 3.2 Deploy แล้วตั้งเป็น Webhook

1. **Deploy ▸ Manage deployments** ▸ ปุ่มดินสอ ▸ **Version: New version** ▸ Deploy
   (URL `/exec` เดิม — ตัวเดียวกับ `API_URL` ในหน้าเว็บ)
2. นำ URL `/exec` ไปวางที่ [LINE Developers Console](https://developers.line.biz/console/):
   Channel ▸ แท็บ **Messaging API** ▸ *Webhook URL* ▸ วาง ▸ **Update** ▸ เปิด **Use webhook**

### 3.3 ดึง Group ID

- พิมพ์ข้อความอะไรก็ได้ (เช่น `id`) ลงในกลุ่มแอดมิน
- บอทจะตอบกลับ `GROUP ID: Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **คัดลอก** ค่านั้น (ขึ้นต้นด้วย `C`)

### 3.4 ปิดโหมดชั่วคราว

ได้ Group ID แล้ว จะลบบล็อกใน 3.1 ออก หรือปิด *Use webhook* ในคอนโซลก็ได้
(ถ้าไม่อยากให้บอทตอบทุกครั้งที่มีคนพิมพ์ในกลุ่ม)

---

## ขั้นที่ 4 — เพิ่มการแจ้งเตือนเข้ากลุ่ม

### 4.1 ใส่ Group ID (ต่อจาก `LINE_ACCESS_TOKEN` บนสุดของไฟล์)

```js
const ADMIN_GROUP_ID = "Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";  // ← Group ID จากขั้นที่ 3
```

### 4.2 เพิ่มฟังก์ชัน `notifyAdminGroup` (วางใต้ `sendLineNotification` ในหมวด LINE)

```js
// push แจ้งเตือนคำขอจองใหม่เข้ากลุ่มแอดมิน (ใช้ sendLineNotification เดิมซ้ำ)
function notifyAdminGroup(p, bookingNo, createdAt, status) {
  if (!ADMIN_GROUP_ID) return;
  try {
    const guests = parseInt(p.guests) || 1;
    const bay    = (p.bay || "A").toUpperCase();
    const name   = p.customerName || p.name || "-";
    const text =
      "🟢 มีคำขอจองใหม่\n" +
      "━━━━━━━━━━━━━━\n" +
      "เลขที่: " + bookingNo + "\n" +
      "ชื่อ: "   + name + "\n" +
      "โทร: "   + (p.phone || "-") + "\n" +
      "วันที่: " + (p.date || "-") + "\n" +
      "เวลา: "  + (p.startTime || "-") + " - " + (p.endTime || "-") + "\n" +
      "Bay: "   + bay + " (" + guests + " คน)" +
      (p.note ? "\nหมายเหตุ: " + p.note : "") +
      "\nสถานะ: " + (status === "confirmed" ? "ยืนยันแล้ว" : "รอยืนยัน") +
      "\nจองเมื่อ: " + createdAt;

    sendLineNotification(ADMIN_GROUP_ID, { type: "text", text: text });
  } catch (err) {
    // อย่าให้ push กลุ่มล้มเหลว ไปกระทบการบันทึกจองของลูกค้า
  }
}
```

> ห่อ `try/catch` ไว้ ถ้า push กลุ่มพลาด (บอทไม่อยู่ในกลุ่ม / token ผิด)
> การบันทึกชีทและการแจ้งลูกค้าจะยังทำงานปกติ

### 4.3 เรียกใช้ใน `handleCreate` (เพิ่ม 1 บรรทัดก่อน `return`)

```js
  if (status === "pending" && lineUserId) {
    sendLineNotification(lineUserId, createFlexMessage(
      "⏳ ได้รับคำขอจอง รอแอดมินยืนยัน", "#F2A51A",
      p.date, `${p.startTime} - ${p.endTime}`,
      `Bay ${p.bay} (${guests} คน)`, bookingNo
    ));
  }

  notifyAdminGroup(p, bookingNo, createdAt, status);   // ← เพิ่มบรรทัดนี้

  return jsonResponse({ status:"success", id: newId, bookingNo });
```

### 4.4 Deploy ทับ

**Deploy ▸ Manage deployments ▸ New version ▸ Deploy**
ลองจองผ่านหน้าเว็บ 1 รอบ — กลุ่มแอดมินต้องได้ข้อความแจ้งเตือนพร้อมลูกค้า

---

## (ตัวเลือกเสริม) แจ้งกลุ่มตอน "ยกเลิก" ด้วย

ถ้าอยากให้กลุ่มรู้ตอนลูกค้ายกเลิกเอง เพิ่มใน `handleCancel` ก่อน `return`:

```js
  if (ADMIN_GROUP_ID) {
    try {
      sendLineNotification(ADMIN_GROUP_ID, { type:"text", text:
        "🔴 ลูกค้ายกเลิกการจอง\nเลขที่: " + bno +
        "\nวันที่: " + formatDate(d[COL.DATE - 1]) +
        "\nBay: " + d[COL.BAY - 1] });
    } catch (err) {}
  }
```

---

## เช็กลิสต์ก่อนใช้จริง

- [ ] บอท (OA) อยู่ในกลุ่มแอดมินแล้ว และเปิดให้เข้ากลุ่มได้
- [ ] `LINE_ACCESS_TOKEN` ถูกต้อง (push หาลูกค้าได้อยู่แล้ว)
- [ ] `ADMIN_GROUP_ID` ขึ้นต้นด้วย `C` และวางครบ
- [ ] เพิ่มฟังก์ชัน `notifyAdminGroup` และเรียกใน `handleCreate` แล้ว
- [ ] Deploy เวอร์ชันใหม่แล้ว (ไม่ใช่แค่ Save)

## แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ/วิธีแก้ |
|---|---|
| กลุ่มไม่ได้ข้อความ แต่ลูกค้าได้ | ยังไม่ได้เรียก `notifyAdminGroup` หรือ `ADMIN_GROUP_ID` ว่าง/ผิด |
| กลุ่มไม่ได้ ทั้งลูกค้าก็ไม่ได้ | `LINE_ACCESS_TOKEN` ผิด หรือยังไม่ Deploy เวอร์ชันใหม่ |
| ขั้นที่ 3 บอทไม่ตอบ Group ID | ยังไม่เปิด *Use webhook* / ยังไม่ Deploy / ปิด join group chats |
| การจองพังหลังแก้โค้ด | เช็กว่าบล็อก webhook (3.1) `return` ก่อน แล้ว router เดิมยังอยู่ครบ |

> **ความปลอดภัย:** `LINE_ACCESS_TOKEN` และ `ADMIN_PASSWORD` เป็นความลับ อย่าวางลงไฟล์ในโปรเจกต์
> (repo เป็น public) — เก็บไว้ใน Apps Script เท่านั้น หากสงสัยว่าหลุด ให้ rotate token ที่ LINE Console
