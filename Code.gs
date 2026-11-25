const SPREADSHEET_ID = '177PCcDP638NfZCodr79eETVR5QcmsHbDDsWu0qEyM8s';
const NOTIFICATION_EMAIL = 'fahriztomi@gmail.com';

const ADMIN_CREDENTIALS = ['fahriztommy', 'MUSAFA2026', 'ADMIN_MUSAFA'];
const SECURITY_PINS = ['FT', '1234', '2026'];

const TTE_SPECIMEN_URL = 'https://lh3.googleusercontent.com/d/1mDzoyRWgLuyOutFn81FJd2XQ_JcAQtCo';
const LOGO_URL = 'https://lh3.googleusercontent.com/d/1v9XLw_NjWKP9zdtIgREkPYmgakhKMq_n';

const SHEETS = {
  AGENDA: 'Agenda',
  PELAJARAN: 'Pelajaran',
  UJIAN: 'Ujian',
  TUGAS: 'Tugas',
  NOTULENSI: 'Notulensi'
};

const SHEET_HEADERS = {
  Agenda: ['ID', 'Judul', 'Lokasi', 'JatuhTempo', 'Durasi', 'Prioritas', 'Status', 'DisposisiKepada', 'TamuKhusus', 'Notulensi'],
  Pelajaran: ['ID', 'Hari', 'WaktuMulai', 'WaktuSelesai', 'NamaMapel', 'NamaGuru'],
  Ujian: ['ID', 'Hari', 'Jam', 'NamaMapel', 'StatusAktif'],
  Tugas: ['ID', 'Deadline', 'NamaMapel', 'NamaGuru', 'DetailTugas', 'Selesai'],
  Notulensi: ['ID', 'AgendaID', 'Judul', 'Isi', 'TokenTTE', 'Penandatangan', 'Jabatan', 'Tanggal']
};

/**
 * Jalankan fungsi ini SEKALI dari editor Apps Script (tombol Run)
 * untuk membuat seluruh tab & mengaktifkan trigger email otomatis tiap 15 menit.
 */
function setupSemuaSheet() {
  Object.keys(SHEET_HEADERS).forEach(function(sheetName) {
    getOrCreateSheet(sheetName, SHEET_HEADERS[sheetName]);
  });
  setupTriggerNotifikasiEmail();
  return 'Semua tab & Trigger Email Otomatis ke ' + NOTIFICATION_EMAIL + ' berhasil disiapkan!';
}

/**
 * Memasang time-driven trigger setiap 15 menit tanpa membuat duplikat trigger.
 */
function setupTriggerNotifikasiEmail() {
  const handlerName = 'cekDanKirimNotifikasiEmailOtomatis';
  const triggers = ScriptApp.getProjectTriggers();
  let exists = false;

  triggers.forEach(function(tr) {
    if (tr.getHandlerFunction() === handlerName) {
      exists = true;
    }
  });

  if (!exists) {
    ScriptApp.newTrigger(handlerName)
      .timeBased()
      .everyMinutes(15)
      .create();
  }

  return 'Trigger ' + handlerName + ' aktif setiap 15 menit ke ' + NOTIFICATION_EMAIL;
}

/**
 * Jalankan manual dari editor Apps Script untuk mengetes pengiriman email ke fahriztomi@gmail.com.
 */
function tesKirimEmailNotifikasi() {
  const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Jakarta', 'dd/MM/yyyy HH:mm:ss');
  MailApp.sendEmail({
    to: NOTIFICATION_EMAIL,
    subject: '[MUSAFA Mobile] Tes Notifikasi Email Otomatis',
    body: [
      'Halo Muhammad Sufyan Fahriza,',
      '',
      'Ini adalah email uji coba notifikasi otomatis dari MUSAFA Mobile.',
      'Waktu pengiriman: ' + nowStr,
      '',
      'Sistem akan otomatis mengirim email ke alamat ini untuk:',
      '1. Agenda jatuh tempo dalam <= 1 jam',
      '2. Tugas sekolah dalam <= H-1 (24 jam) sebelum deadline yang belum selesai'
    ].join('\n')
  });
  return 'Email uji coba terkirim ke ' + NOTIFICATION_EMAIL;
}

function parseDateFlexible(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  const str = String(val).trim();
  if (!str) return null;
  const isoCandidate = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(str) ? str.replace(/\s+/, 'T') : str;
  const d = new Date(isoCandidate);
  return isNaN(d.getTime()) ? null : d;
}

function isTaskCompleted(selesaiVal) {
  const v = String(selesaiVal || '').trim().toLowerCase();
  return v === 'selesai' || v === 'ya' || v === 'true' || v === 'done' || v === '1';
}

function wasEmailSent(key) {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty(key) === 'SENT';
}

function markEmailSent(key) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(key, 'SENT');
}

/**
 * Dipanggil otomatis oleh trigger tiap 15 menit:
 * - Mengirim email jika sisa waktu Agenda <= 1 jam (60 menit)
 * - Mengirim email jika sisa waktu Tugas <= H-1 (24 jam) dan belum selesai
 */
function cekDanKirimNotifikasiEmailOtomatis() {
  const now = new Date();
  const nowMs = now.getTime();
  const oneHourMs = 60 * 60 * 1000;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const tz = Session.getScriptTimeZone() || 'Asia/Jakarta';

  const agendaSheet = getOrCreateSheet(SHEETS.AGENDA, SHEET_HEADERS.Agenda);
  const tugasSheet = getOrCreateSheet(SHEETS.TUGAS, SHEET_HEADERS.Tugas);

  const agendas = sheetToObjects(agendaSheet);
  const tugasList = sheetToObjects(tugasSheet);

  agendas.forEach(function(ag) {
    const status = String(ag.Status || '').trim().toLowerCase();
    if (status === 'selesai') return;

    const dt = parseDateFlexible(ag.JatuhTempo);
    if (!dt) return;

    const diffMs = dt.getTime() - nowMs;
    if (diffMs > 0 && diffMs <= oneHourMs) {
      const minsLeft = Math.max(1, Math.ceil(diffMs / 60000));
      const slotKey = 'EMAIL_AG_1H_' + String(ag.ID || ag.Judul || '') + '_' + Utilities.formatDate(dt, tz, 'yyyyMMddHHmm');
      if (wasEmailSent(slotKey)) return;

      const waktuFormatted = Utilities.formatDate(dt, tz, 'EEEE, dd MMMM yyyy HH:mm');
      const subject = '[Pengingat Agenda <= 1 Jam] ' + (ag.Judul || 'Agenda');
      const body = [
        'Pengingat Agenda MUSAFA Mobile (Jatuh tempo dalam <= 1 jam):',
        '',
        'Judul Agenda : ' + (ag.Judul || '-'),
        'Lokasi       : ' + (ag.Lokasi || '-'),
        'Prioritas    : ' + (ag.Prioritas || '-'),
        'Status       : ' + (ag.Status || '-'),
        'Jatuh Tempo  : ' + waktuFormatted + ' (sisa +- ' + minsLeft + ' menit)',
        ag.DisposisiKepada ? 'Disposisi    : ' + ag.DisposisiKepada : '',
        ag.TamuKhusus ? 'Tamu Khusus  : ' + ag.TamuKhusus : ''
      ].filter(Boolean).join('\n');

      MailApp.sendEmail({
        to: NOTIFICATION_EMAIL,
        subject: subject,
        body: body
      });
      markEmailSent(slotKey);
    }
  });

  tugasList.forEach(function(tg) {
    if (isTaskCompleted(tg.Selesai)) return;

    const dl = parseDateFlexible(tg.Deadline);
    if (!dl) return;

    const diffMs = dl.getTime() - nowMs;
    if (diffMs > 0 && diffMs <= oneDayMs) {
      const hoursLeft = Math.max(1, Math.ceil(diffMs / (60 * 60 * 1000)));
      const slotKey = 'EMAIL_TG_H1_' + String(tg.ID || tg.DetailTugas || '') + '_' + Utilities.formatDate(dl, tz, 'yyyyMMddHH');
      if (wasEmailSent(slotKey)) return;

      const deadlineFormatted = Utilities.formatDate(dl, tz, 'EEEE, dd MMMM yyyy HH:mm');
      const subject = '[Pengingat Tugas H-1] ' + (tg.NamaMapel || 'Tugas Sekolah');
      const body = [
        'Pengingat Deadline Tugas Sekolah MUSAFA Mobile (H-1 / <= 24 jam):',
        '',
        'Mata Pelajaran : ' + (tg.NamaMapel || '-'),
        'Guru Mapel     : ' + (tg.NamaGuru || '-'),
        'Detail Tugas   : ' + (tg.DetailTugas || '-'),
        'Deadline       : ' + deadlineFormatted + ' (sisa +- ' + hoursLeft + ' jam)',
        'Status         : ' + (tg.Selesai || 'Belum')
      ].join('\n');

      MailApp.sendEmail({
        to: NOTIFICATION_EMAIL,
        subject: subject,
        body: body
      });
      markEmailSent(slotKey);
    }
  });
}

function doGet(e) {
  const params = (e && e.parameter) || {};

  if (params.manifest === '1' || params.manifest === 'true') {
    const manifestObj = {
      name: 'MUSAFA Mobile - Manajemen Agenda & Tugas',
      short_name: 'MUSAFA',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#0f172a',
      theme_color: '#2563eb',
      icons: [
        {
          src: LOGO_URL,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: LOGO_URL,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    };
    return ContentService
      .createTextOutput(JSON.stringify(manifestObj))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (params.action) {
    let args = [];
    if (params.args) {
      try {
        args = JSON.parse(params.args);
      } catch (err) {
        args = [];
      }
    }
    const result = dispatchAction(String(params.action), Array.isArray(args) ? args : []);
    if (params.callback) {
      const safeCb = String(params.callback).replace(/[^a-zA-Z0-9_$]/g, '');
      return ContentService
        .createTextOutput(`${safeCb}(${JSON.stringify(result)});`)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('MUSAFA Mobile - Sistem Managemen Agenda dan Tugas')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    body = {};
  }
  const action = String(body.action || '');
  const args = Array.isArray(body.args) ? body.args : [];
  const result = dispatchAction(action, args);
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function dispatchAction(action, args) {
  switch (action) {
    case 'verifyLogin':
      return verifyLogin(args[0]);
    case 'getAllData':
      return getAllData();
    case 'saveRecord':
      return saveRecord(args[0], args[1], args[2]);
    case 'deleteRecord':
      return deleteRecord(args[0], args[1], args[2]);
    case 'toggleUjianStatus':
      return toggleUjianStatus(args[0], args[1], args[2]);
    case 'saveNotulensi':
      return saveNotulensi(args[0], args[1]);
    case 'saveNotulensiArchive':
      return saveNotulensiArchive(args[0]);
    case 'deleteNotulensiArchive':
      return deleteNotulensiArchive(args[0], args[1]);
    case 'getAdminTteToken':
      return getAdminTteToken(args[0]);
    case 'verifyTteToken':
      return verifyTteToken(args[0]);
    default:
      return { success: false, message: 'Aksi tidak dikenal: ' + action };
  }
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    }
  } else if (headers && headers.length > 0 && sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

function sheetToObjects(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return rows
    .filter(r => r.some(cell => String(cell).trim() !== ''))
    .map(r => {
      const obj = {};
      headers.forEach((h, idx) => {
        if (h) obj[h] = r[idx];
      });
      return obj;
    });
}

function verifyLogin(cred) {
  const val = String(cred || '').trim();
  if (!val) return { success: false, message: 'Kredensial kosong.' };
  if (ADMIN_CREDENTIALS.indexOf(val) !== -1) {
    return { success: true, role: 'admin', message: 'Login admin berhasil.' };
  }
  return { success: false, message: 'Kredensial admin tidak valid.' };
}

function verifyPin(pin) {
  return SECURITY_PINS.indexOf(String(pin || '').trim()) !== -1;
}

function getAllData() {
  try {
    const agendaSheet = getOrCreateSheet(SHEETS.AGENDA, SHEET_HEADERS.Agenda);
    const pelajaranSheet = getOrCreateSheet(SHEETS.PELAJARAN, SHEET_HEADERS.Pelajaran);
    const ujianSheet = getOrCreateSheet(SHEETS.UJIAN, SHEET_HEADERS.Ujian);
    const tugasSheet = getOrCreateSheet(SHEETS.TUGAS, SHEET_HEADERS.Tugas);
    const notulensiSheet = getOrCreateSheet(SHEETS.NOTULENSI, SHEET_HEADERS.Notulensi);

    return {
      success: true,
      agenda: sheetToObjects(agendaSheet),
      pelajaran: sheetToObjects(pelajaranSheet),
      ujian: sheetToObjects(ujianSheet),
      tugas: sheetToObjects(tugasSheet),
      notulensi: sheetToObjects(notulensiSheet)
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function saveRecord(sheetName, payload, pin) {
  if (!verifyPin(pin)) {
    return { success: false, message: 'PIN Keamanan salah!' };
  }
  try {
    const headers = SHEET_HEADERS[sheetName];
    if (!headers) return { success: false, message: 'Sheet tidak valid.' };

    const sheet = getOrCreateSheet(sheetName, headers);
    const data = Object.assign({}, payload || {});
    if (!data.ID || String(data.ID).startsWith('TMP-')) {
      data.ID = sheetName.slice(0, 3).toUpperCase() + '-' + new Date().getTime();
    }

    const lastRow = sheet.getLastRow();
    const idColIndex = headers.indexOf('ID') + 1;
    let foundRow = -1;

    if (lastRow >= 2 && idColIndex > 0) {
      const ids = sheet.getRange(2, idColIndex, lastRow - 1, 1).getValues().flat();
      const idx = ids.findIndex(v => String(v).trim() === String(data.ID).trim());
      if (idx !== -1) foundRow = idx + 2;
    }

    const rowValues = headers.map(h => (data[h] !== undefined ? data[h] : ''));
    if (foundRow > 0) {
      sheet.getRange(foundRow, 1, 1, headers.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return { success: true, id: data.ID, message: 'Data berhasil disimpan ke Spreadsheet MUSAFA.' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function deleteRecord(sheetName, id, pin) {
  if (!verifyPin(pin)) {
    return { success: false, message: 'PIN Keamanan salah!' };
  }
  try {
    const sheet = getOrCreateSheet(sheetName, SHEET_HEADERS[sheetName] || []);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, message: 'Data tidak ditemukan.' };

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const idCol = headers.indexOf('ID') + 1;
    const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues().flat();
    const rowIdx = ids.findIndex(v => String(v).trim() === String(id).trim());

    if (rowIdx === -1) return { success: false, message: 'ID tidak ditemukan.' };
    sheet.deleteRow(rowIdx + 2);
    return { success: true, message: 'Data berhasil dihapus dari Spreadsheet MUSAFA.' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function toggleUjianStatus(id, nextStatus, pin) {
  if (!verifyPin(pin)) {
    return { success: false, message: 'PIN Keamanan salah!' };
  }
  try {
    const sheet = getOrCreateSheet(SHEETS.UJIAN, SHEET_HEADERS.Ujian);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, message: 'Data ujian kosong.' };

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const idCol = headers.indexOf('ID') + 1;
    const stCol = headers.indexOf('StatusAktif') + 1;
    const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues().flat();
    const idx = ids.findIndex(v => String(v).trim() === String(id).trim());
    if (idx === -1) return { success: false, message: 'Jadwal ujian tidak ditemukan.' };

    sheet.getRange(idx + 2, stCol).setValue(nextStatus);
    return { success: true, message: 'Status ujian diubah menjadi ' + nextStatus };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function saveNotulensi(agendaId, isi) {
  try {
    const sheet = getOrCreateSheet(SHEETS.AGENDA, SHEET_HEADERS.Agenda);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, message: 'Agenda tidak ditemukan.' };

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const idCol = headers.indexOf('ID') + 1;
    const notulCol = headers.indexOf('Notulensi') + 1;
    const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues().flat();
    const idx = ids.findIndex(v => String(v).trim() === String(agendaId).trim());
    if (idx !== -1 && notulCol > 0) {
      sheet.getRange(idx + 2, notulCol).setValue(isi);
    }
    return { success: true, message: 'Notulensi agenda tersimpan.' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function saveNotulensiArchive(record) {
  try {
    const headers = SHEET_HEADERS.Notulensi;
    const sheet = getOrCreateSheet(SHEETS.NOTULENSI, headers);
    const item = Object.assign({}, record || {});
    if (!item.ID) item.ID = 'NOT-' + new Date().getTime();

    const lastRow = sheet.getLastRow();
    const idCol = headers.indexOf('ID') + 1;
    let foundRow = -1;

    if (lastRow >= 2) {
      const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues().flat();
      const idx = ids.findIndex(v => String(v).trim() === String(item.ID).trim());
      if (idx !== -1) foundRow = idx + 2;
    }

    const values = headers.map(h => (item[h] !== undefined ? item[h] : ''));
    if (foundRow > 0) {
      sheet.getRange(foundRow, 1, 1, headers.length).setValues([values]);
    } else {
      sheet.appendRow(values);
    }

    return { success: true, id: item.ID, message: 'Arsip notulensi tersimpan di Spreadsheet MUSAFA.' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function deleteNotulensiArchive(id, pin) {
  if (!verifyPin(pin)) {
    return { success: false, message: 'PIN Keamanan salah!' };
  }
  return deleteRecord(SHEETS.NOTULENSI, id, pin);
}

function computeServerToken(minuteOffset) {
  const slot = Math.floor(Date.now() / 60000) + (minuteOffset || 0);
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'MUSAFA-TTE-FT-' + slot);
  const hex = bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('').toUpperCase();
  return hex.slice(-6);
}

function getAdminTteToken(username) {
  const val = String(username || '').trim();
  if (ADMIN_CREDENTIALS.indexOf(val) === -1) {
    return { success: false, message: 'Akses ditolak.' };
  }
  return {
    success: true,
    token: computeServerToken(0),
    specimenUrl: TTE_SPECIMEN_URL
  };
}

function verifyTteToken(tokenInput) {
  const clean = String(tokenInput || '').trim().toUpperCase();
  if (!clean) return { success: false, message: 'Token kosong.' };
  if (clean === computeServerToken(0) || clean === computeServerToken(-1)) {
    return {
      success: true,
      ttdUrl: TTE_SPECIMEN_URL,
      message: 'Token TTE valid.'
    };
  }
  return { success: false, message: 'Token TTE tidak valid atau kedaluwarsa.' };
}