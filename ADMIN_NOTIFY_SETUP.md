# คู่มือเพิ่มการแจ้งเตือน "เข้ากลุ่มแอดมิน" เมื่อมีคำขอจองใหม่

เดิมระบบจะ push ข้อความ LINE **หาลูกค้า** หลังกดจอง (ผ่าน Apps Script)
คู่มือนี้เพิ่มให้ push **เข้ากลุ่มแชทแอดมิน** พร้อมกันในครั้งเดียว

> **สำคัญ:** โค้ดที่ต้องแก้ **อยู่ใน Google Apps Script** (ตัวหลังบ้านที่ผูกกับชีท booking)
> ไม่ใช่ไฟล์ในโปรเจกต์นี้ — repo นี้มีแต่หน้าเว็บ (`booking.html` ฯลฯ) ที่ยิงข้อมูลไปหา Apps Script เท่านั้น
> เปิดแก้ได้ที่: ชีท booking ▸ เมนู **Extensions ▸ Apps Script**

---

## ภาพรวม 4 ขั้นตอน

1. ตรวจว่ามี **Channel Access Token** อยู่แล้ว (ตัวเดียวกับที่ push หาลูกค้า)
2. เชิญ **LINE Official Account (บอทของร้าน) เข้ากลุ่มแอดมิน**
3. **หา Group ID** ของกลุ่มนั้น (ทำครั้งเดียว)
4. วางโค้ด push เข้ากลุ่ม แล้วเรียกใช้ตอนสร้างการจอง

---

## ขั้นที่ 1 — หา Channel Access Token เดิม

ในไฟล์ Apps Script จะมีตัวแปรเก็บ token อยู่แล้ว (ตัวที่ใช้ push หาลูกค้า)
หน้าตาประมาณ:

```js
const CHANNEL_ACCESS_TOKEN = 'xxxxxxxx...';   // <- ใช้ตัวนี้ซ้ำได้เลย
```

ถ้าเก็บชื่ออื่น (เช่น `LINE_TOKEN`, `ACCESS_TOKEN`) ก็ใช้ชื่อนั้นแทนในโค้ดด้านล่าง
> ถ้าหาไม่เจอ: token อยู่ที่ [LINE Developers Console](https://developers.line.biz/console/)
> ▸ เลือก Provider ▸ Channel (Messaging API) ▸ แท็บ **Messaging API** ▸ *Channel access token (long-lived)*

---

## ขั้นที่ 2 — เชิญบอทเข้ากลุ่มแอดมิน

1. เปิดกลุ่มแชทแอดมินใน LINE (หรือสร้างกลุ่มใหม่)
2. เชิญ **Official Account ของร้าน** (บอทตัวเดียวกับที่คุยกับลูกค้า) เข้ากลุ่ม
3. ในคอนโซล LINE ตรวจว่าเปิด **"Allow bot to join group chats"** ไว้:
   LINE Official Account Manager ▸ **Settings ▸ Response settings** ▸ เปิด *Join group chats*

---

## ขั้นที่ 3 — หา Group ID (ทำครั้งเดียว)

Group ID มองไม่เห็นตรง ๆ ต้องให้บอทบอกเรามา วิธีที่ง่ายสุด:
ตั้งให้ Apps Script ตอบ Group ID กลับมาในกลุ่ม เมื่อมีคนพิมพ์ข้อความ

### 3.1 วาง "โหมดหา Group ID" ชั่วคราวใน `doPost`

เปิดฟังก์ชัน `doPost(e)` ในไฟล์ Apps Script แล้วเพิ่ม **บล็อกนี้ไว้บนสุด** ของฟังก์ชัน
(ก่อนโค้ด `action` เดิมทั้งหมด):

```js
function doPost(e) {
  const body = JSON.parse(e.postData.contents);

  // ── LINE webhook: ตอบ Group ID กลับเข้ากลุ่ม (ใช้ชั่วคราวตอนตั้งค่า) ──
  if (body.events) {
    body.events.forEach(function (ev) {
      const gid = ev.source && ev.source.groupId;
      if (gid && ev.replyToken) {
        UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
          method: 'post',
          contentType: 'application/json',
          headers: { Authorization: 'Bearer ' + CHANNEL_ACCESS_TOKEN },
          payload: JSON.stringify({
            replyToken: ev.replyToken,
            messages: [{ type: 'text', text: 'GROUP ID:\n' + gid }]
          }),
          muteHttpExceptions: true
        });
      }
    });
    return ContentService.createTextOutput('ok');
  }

  // ── โค้ด action เดิมทั้งหมด (create / history / adminLogin ...) อยู่ต่อจากนี้ ──
  // ...
}
```

> ระบบแยกออกเองว่า POST นี้มาจาก **LINE (มี `events`)** หรือมาจาก **หน้าเว็บจอง (ไม่มี `events`)**
> จึงไม่กระทบการจองเดิม

### 3.2 Deploy แล้วตั้งเป็น Webhook

1. ใน Apps Script กด **Deploy ▸ Manage deployments** ▸ ปุ่มดินสอ ▸ **Version: New version** ▸ Deploy
   (ใช้ URL `/exec` เดิม — ตัวเดียวกับ `API_URL` ในหน้าเว็บ)
2. เอา URL `/exec` นั้นไปวางที่ LINE Developers Console:
   Channel ▸ แท็บ **Messaging API** ▸ *Webhook URL* ▸ วาง ▸ **Update** ▸ เปิด **Use webhook**

### 3.3 ดึง Group ID

- พิมพ์ข้อความอะไรก็ได้ (เช่น `id`) ลงในกลุ่มแอดมิน
- บอทจะตอบกลับมาว่า `GROUP ID: Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **คัดลอก** ค่านั้นไว้ (ขึ้นต้นด้วย `C`)

### 3.4 ปิดโหมดชั่วคราว

ได้ Group ID แล้ว จะเอาบล็อกใน 3.1 ออกก็ได้ หรือปิด *Use webhook* ในคอนโซลไว้ก็พอ
(ถ้าไม่อยากให้บอทตอบทุกครั้งที่มีคนพิมพ์ในกลุ่ม)

---

## ขั้นที่ 4 — เพิ่มการแจ้งเตือนเข้ากลุ่ม

### 4.1 ใส่ค่าคงที่ + ฟังก์ชัน push (วางไว้ท้ายไฟล์ Apps Script)

```js
const ADMIN_GROUP_ID = 'Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';  // <- Group ID จากขั้นที่ 3

// push แจ้งเตือนคำขอจองใหม่เข้ากลุ่มแอดมิน
function notifyAdminGroup(b) {
  if (!ADMIN_GROUP_ID) return;

  const text =
    '🟢 มีคำขอจองใหม่\n' +
    '━━━━━━━━━━━━━━\n' +
    'เลขที่: ' + (b.bookingNo || '-') + '\n' +
    'ชื่อ: '   + (b.customerName || '-') + '\n' +
    'โทร: '   + (b.phone || '-') + '\n' +
    'วันที่: ' + (b.date || '-') + '\n' +
    'เวลา: '  + (b.startTime || '-') + '–' + (b.endTime || '-') + '\n' +
    'Bay: '   + (b.bay || '-') + '\n' +
    'จำนวน: ' + (b.guests || '-') + ' คน' +
    (b.note ? '\nหมายเหตุ: ' + b.note : '') +
    '\nสถานะ: รอยืนยัน';

  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + CHANNEL_ACCESS_TOKEN },
    payload: JSON.stringify({
      to: ADMIN_GROUP_ID,
      messages: [{ type: 'text', text: text }]
    }),
    muteHttpExceptions: true
  });
}
```

### 4.2 เรียกใช้ตอนสร้างการจอง

หาส่วนที่จัดการ `action === 'create'` (จุดเดียวกับที่ push หาลูกค้าอยู่แล้ว)
เพิ่มการเรียก `notifyAdminGroup(...)` **หลังจากบันทึกลงชีทและได้เลขที่จองแล้ว** เช่น:

```js
if (action === 'create') {
  // ... โค้ดเดิม: บันทึกแถวลงชีท, สร้าง bookingNo, push หาลูกค้า ...

  // ── เพิ่มบรรทัดนี้ ──
  notifyAdminGroup({
    bookingNo:    bookingNo,      // เลขที่จองที่เพิ่งสร้าง
    customerName: data.customerName,
    phone:        data.phone,
    date:         data.date,
    startTime:    data.startTime,
    endTime:      data.endTime,
    bay:          data.bay,
    guests:       data.guests,
    note:         data.note
  });

  return ...; // return เดิม
}
```

> ชื่อตัวแปร (`data`, `bookingNo`) ให้ปรับตามที่ใช้จริงในไฟล์ — payload ที่หน้าเว็บส่งมามีครบ:
> `date, startTime, endTime, bay, customerName, phone, note, guests, status, lineUserId`
> (ดู `booking.html` บรรทัดที่เรียก `postBooking({action:'create', ...})`)

### 4.3 Deploy ทับ

**Deploy ▸ Manage deployments ▸ New version ▸ Deploy** — เสร็จ
ลองจองผ่านหน้าเว็บ 1 รอบ กลุ่มแอดมินต้องได้ข้อความแจ้งเตือนพร้อมลูกค้า

---

## เช็กลิสต์ก่อนใช้จริง

- [ ] บอท (OA) อยู่ในกลุ่มแอดมินแล้ว และเปิดให้เข้ากลุ่มได้
- [ ] `CHANNEL_ACCESS_TOKEN` ถูกต้อง (push หาลูกค้าได้อยู่แล้ว)
- [ ] `ADMIN_GROUP_ID` ขึ้นต้นด้วย `C` และวางครบ
- [ ] เรียก `notifyAdminGroup(...)` ในบล็อก `action === 'create'`
- [ ] Deploy เวอร์ชันใหม่แล้ว (ไม่ใช่แค่ Save)

## แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ/วิธีแก้ |
|---|---|
| กลุ่มไม่ได้ข้อความ แต่ลูกค้าได้ | ยังไม่ได้เรียก `notifyAdminGroup` หรือ `ADMIN_GROUP_ID` ว่าง/ผิด |
| Error 403 ตอน push | Token ผิด หรือบอทถูกเตะออกจากกลุ่มแล้ว |
| ขั้นที่ 3 บอทไม่ตอบ Group ID | ยังไม่เปิด *Use webhook* / ยังไม่ Deploy เวอร์ชันใหม่ / ปิด join group chats |
| การจองพัง หลังแก้โค้ด | เช็กว่าบล็อก webhook (3.1) `return` ก่อน แล้วโค้ด action เดิมยังอยู่ครบ |
