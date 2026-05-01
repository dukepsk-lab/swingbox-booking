/**
 * Google Apps Script — Backend Update for Self-Booking + LINE OA
 *
 * Add these functions/cases to your existing GAS web app.
 * Set LINE_CHANNEL_ACCESS_TOKEN in:
 *   GAS Editor → Project Settings → Script Properties
 *
 * Sheet structure:
 *   "Bookings"  — existing confirmed bookings sheet
 *   "Pending"   — new sheet for pending requests (create this sheet)
 *     Columns: id | customerName | phone | bay | date | startTime | endTime | note | lineUserId | lineDisplayName | submittedAt
 */

// ─── Add to your doGet(e) handler ────────────────────────────────
function doGet(e) {
  const action = e.parameter.action;
  if (action === 'getPending') {
    return ContentService
      .createTextOutput(JSON.stringify(getPending()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // ... existing GET handler (return all confirmed bookings)
  return ContentService
    .createTextOutput(JSON.stringify(getConfirmedBookings()))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Add to your doPost(e) handler ───────────────────────────────
function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  let result;

  switch (payload.action) {
    case 'create':        result = createBooking(payload);        break;
    case 'delete':        result = deleteBooking(payload.id);     break;
    case 'createPending': result = createPending(payload);        break;
    case 'approve':       result = approvePending(payload.id);    break;
    case 'reject':        result = rejectPending(payload.id);     break;
    default: result = { error: 'Unknown action' };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Pending sheet helpers ────────────────────────────────────────
function getPendingSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Pending');
  if (!sheet) {
    sheet = ss.insertSheet('Pending');
    sheet.appendRow(['id','customerName','phone','bay','date','startTime','endTime','note','lineUserId','lineDisplayName','submittedAt']);
  }
  return sheet;
}

function getPending() {
  const sheet = getPendingSheet();
  const rows  = sheet.getDataRange().getValues();
  const headers = rows[0];
  return rows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
}

function createPending(data) {
  const sheet = getPendingSheet();
  const id    = Utilities.getUuid();
  sheet.appendRow([
    id,
    data.customerName || '',
    data.phone        || '',
    data.bay          || 'A',
    data.date         || '',
    data.startTime    || '',
    data.endTime      || '',
    data.note         || '',
    data.lineUserId   || '',
    data.lineDisplayName || '',
    new Date().toISOString()
  ]);
  return { ok: true, id };
}

function approvePending(id) {
  const sheet   = getPendingSheet();
  const rows    = sheet.getDataRange().getValues();
  const headers = rows[0];
  const idIdx   = headers.indexOf('id');

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idIdx]) === String(id)) {
      const pending = Object.fromEntries(headers.map((h, j) => [h, rows[i][j]]));

      // Move to confirmed Bookings sheet
      createBooking({
        customerName: pending.customerName,
        phone:        pending.phone,
        bay:          pending.bay,
        date:         pending.date,
        startTime:    pending.startTime,
        endTime:      pending.endTime,
        note:         pending.note
      });

      // Send LINE push message if lineUserId is present
      if (pending.lineUserId) {
        sendLineMessage(
          pending.lineUserId,
          buildConfirmationMessage(pending)
        );
      }

      // Remove from Pending sheet
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { error: 'Pending booking not found' };
}

function rejectPending(id) {
  const sheet   = getPendingSheet();
  const rows    = sheet.getDataRange().getValues();
  const headers = rows[0];
  const idIdx   = headers.indexOf('id');

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idIdx]) === String(id)) {
      const pending = Object.fromEntries(headers.map((h, j) => [h, rows[i][j]]));

      // Notify customer via LINE if connected
      if (pending.lineUserId) {
        sendLineMessage(
          pending.lineUserId,
          `❌ SwingBox Golf Simulator\n\nขออภัยครับ/ค่ะ คำขอจองของคุณถูกปฏิเสธ\n\n📅 ${pending.date}\n⏰ ${pending.startTime} – ${pending.endTime}\n\nกรุณาติดต่อเจ้าหน้าที่เพื่อเลือกเวลาอื่น หรือโทรหาเราโดยตรงครับ/ค่ะ`
        );
      }

      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { error: 'Pending booking not found' };
}

// ─── LINE Messaging API ───────────────────────────────────────────
function sendLineMessage(lineUserId, text) {
  const token = PropertiesService
    .getScriptProperties()
    .getProperty('LINE_CHANNEL_ACCESS_TOKEN');

  if (!token) {
    console.warn('LINE_CHANNEL_ACCESS_TOKEN not set in Script Properties');
    return;
  }

  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    payload: JSON.stringify({
      to: lineUserId,
      messages: [{ type: 'text', text: text }]
    }),
    muteHttpExceptions: true
  });
}

function buildConfirmationMessage(booking) {
  return (
    `✅ SwingBox Golf Simulator\nยืนยันการจองของคุณแล้ว!\n\n` +
    `🏌️ Bay ${(booking.bay || '').toUpperCase()}\n` +
    `📅 ${booking.date}\n` +
    `⏰ ${booking.startTime} – ${booking.endTime}\n` +
    `👤 ${booking.customerName}\n` +
    (booking.note ? `📝 ${booking.note}\n` : '') +
    `\nขอบคุณที่ใช้บริการครับ/ค่ะ 🏌️\nพบกันที่ SwingBox!`
  );
}

// ─── Setup Instructions ───────────────────────────────────────────
/**
 * 1. Open Google Apps Script editor for your web app
 * 2. Copy the functions above into your script
 * 3. Create a "Pending" sheet in your Google Spreadsheet
 * 4. Go to Project Settings → Script Properties → Add:
 *      Key:   LINE_CHANNEL_ACCESS_TOKEN
 *      Value: (your LINE Messaging API Channel Access Token)
 * 5. Re-deploy the web app (New deployment or deploy new version)
 *
 * LINE Setup:
 * - Create a LINE Official Account at https://manager.line.biz
 * - Enable Messaging API in the LINE Developers console
 * - Copy the Channel Access Token (long-lived)
 * - Create a LIFF app, set the endpoint URL to your index.html URL
 * - Copy the LIFF App ID into LIFF_APP_ID in index.html
 */
