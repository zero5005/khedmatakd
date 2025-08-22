/**
 * code.gs - كامل ومحدّث لخادم Apps Script
 *
 * بعد اللصق: احفظ ثم Deploy -> Manage deployments -> Update (أو New deployment).
 * تأكد Execute as: Me و Who has access: Anyone أو Anyone, even anonymous حسب حاجتك.
 */

const SPREADSHEET_ID = '1Yb5bWLDxRM5nkKEXtj9eCCUWr29SxbpEjTYYJkQyf3w';
const MEDIA_FOLDER_ID = '12Eyea9FA2KVSvI69HNrTVHkbm7hSSI0T';

const SHEET_NAMES = {
  places: 'الاماكن او الخدمات',
  ads: 'الاعلانات',
  cities: 'المدن',
  areas: 'المناطق',
  sites: 'المواقع او المولات',
  activities: 'نوع النشاط',
  packages: 'الباقات',
  visits: 'سجل الزيارات',
  payments: 'طرق الدفع'
};

// ---------- Entry points ----------
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = (params.action || '').toString().trim();
    console.log('doGet action:', action, 'params:', JSON.stringify(params));
    switch (action.toLowerCase()) {
      case 'ping':
        return jsonSuccess({ pong: true, time: new Date().toISOString() });
      case 'places':
        return jsonSuccess({ places: getPlacesForSelect() });
      case 'getlookups':
      case 'getlookups':
      case 'getLookups':
        return jsonSuccess(getLookups());
      case 'remainingads':
        return jsonSuccess(getRemainingAds(params.placeId || params.placeid || ''));
      case 'ads':
        return jsonSuccess({ ads: getAdsForPlace(params.placeId || params.placeid || '') });
      default:
        return jsonError('Unknown action (GET): ' + action);
    }
  } catch (err) {
    console.error('doGet error', err);
    return jsonError(String(err));
  }
}

function doPost(e) {
  try {
    let data = {};
    if (e.postData && e.postData.contents && e.postData.type && e.postData.type.indexOf('application/json') !== -1) {
      data = JSON.parse(e.postData.contents || '{}');
    } else if (e.parameter && Object.keys(e.parameter).length > 0) {
      data = {};
      for (const k in e.parameter) {
        data[k] = Array.isArray(e.parameter[k]) && e.parameter[k].length === 1 ? e.parameter[k][0] : e.parameter[k];
      }
    } else {
      data = {};
    }

    console.log('doPost action:', data.action, 'payload keys:', Object.keys(data || {}));

    const action = (data.action || '').toString().trim();

    switch (action) {
      case 'getLookups': return jsonSuccess(getLookups());
      case 'registerPlace': return jsonSuccess(registerPlace(data));
      case 'updatePlace': return jsonSuccess(updatePlace(data));
      case 'loginPlace': return jsonSuccess(loginPlace(data));
      case 'choosePackage': return jsonSuccess(choosePackage(data));
      case 'uploadFile':
      case 'uploadMedia': return jsonSuccess(uploadMedia(data));
      case 'getDashboard': return jsonSuccess(getDashboard(data));
      case 'recordVisit': return jsonSuccess(recordVisit(data));
      case 'addAd': return jsonSuccess(addAd(data));
      case 'updateAd': return jsonSuccess(updateAd(data));
      case 'deleteAd': return jsonSuccess(deleteAd(data));
      default:
        return jsonError('Unknown action (POST): ' + action);
    }
  } catch (err) {
    console.error('doPost error', err);
    return jsonError(String(err));
  }
}

// ---------- Utilities ----------
function openSS() { return SpreadsheetApp.openById(SPREADSHEET_ID); }
function jsonSuccess(data) { return ContentService.createTextOutput(JSON.stringify({ success: true, data: data })).setMimeType(ContentService.MimeType.JSON); }
function jsonError(msg) { return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(msg) })).setMimeType(ContentService.MimeType.JSON); }

function findHeaderIndex(headers, names) {
  if (!headers || !Array.isArray(headers)) return -1;
  for (let k = 0; k < names.length; k++) {
    const name = names[k];
    for (let i = 0; i < headers.length; i++) {
      if (String(headers[i]).trim() === name) return i;
    }
  }
  for (let k = 0; k < names.length; k++) {
    const name = names[k].toLowerCase();
    for (let i = 0; i < headers.length; i++) {
      if (String(headers[i]).toLowerCase().indexOf(name) !== -1) return i;
    }
  }
  return -1;
}

// ---------- Lookups ----------
function getLookups() {
  const ss = openSS();
  const toArr = (sheetName) => {
    const sh = ss.getSheetByName(sheetName);
    if (!sh) return [];
    const values = sh.getDataRange().getValues();
    if (!values || values.length === 0) return [];
    const headers = values[0];
    return values.slice(1).map(r => {
      const obj = {};
      for (let i = 0; i < headers.length; i++) obj[headers[i]] = r[i];
      return obj;
    });
  };

  const citiesRows = toArr(SHEET_NAMES.cities);
  const areasRows = toArr(SHEET_NAMES.areas);
  const sitesRows = toArr(SHEET_NAMES.sites);
  const activitiesRows = toArr(SHEET_NAMES.activities);
  const packagesRows = toArr(SHEET_NAMES.packages);
  const paymentsRows = toArr(SHEET_NAMES.payments);

  const mapSimple = (rows, idKey, nameKey) => rows.map(r => ({ id: String(r[idKey] || ''), name: String(r[nameKey] || ''), raw: r }));

  return {
    cities: mapSimple(citiesRows, 'ID المدينة', 'اسم المدينة'),
    areas: mapSimple(areasRows, 'ID المنطقة', 'اسم المنطقة'),
    sites: mapSimple(sitesRows, 'ID الموقع او المول', 'اسم الموقع او المول'),
    activities: mapSimple(activitiesRows, 'ID النشاط', 'اسم النشاط'),
    packages: (packagesRows || []).map(r => ({
      id: String(r['ID الباقة'] || ''),
      name: String(r['اسم الباقة'] || ''),
      duration: Number(r['مدة الباقة باليوم']) || 0,
      raw: r
    })),
    payments: (paymentsRows || []).map(r => ({
      id: String(r['معرف الدفع'] || r['معرف الدفع'] || ''),
      name: String(r['طرق الدفع'] || ''),
      raw: r
    }))
  };
}

// ---------- Places select ----------
function getPlacesForSelect() {
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.places);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  if (!values || values.length <= 1) return [];
  const headers = values[0];
  const idCol = headers.indexOf('ID المكان');
  const nameCol = headers.indexOf('اسم المكان');
  const rows = values.slice(1);
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const id = idCol >= 0 ? r[idCol] : (i + 1).toString();
    const name = nameCol >= 0 ? r[nameCol] : ('مكان ' + (i + 1));
    if (id !== '' && name !== '') out.push({ id: String(id), name: String(name), raw: rows[i] });
  }
  return out;
}

// ---------- Register / Update Place ----------
function registerPlace(data) {
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.places);
  if (!sh) throw 'Sheet not found: ' + SHEET_NAMES.places;
  const allVals = sh.getDataRange().getValues();
  if (!allVals || allVals.length === 0) throw 'Sheet لا يحتوي على صف الرؤوس';
  const headers = allVals[0];
  const idCol = headers.indexOf('ID المكان');
  if (idCol < 0) throw 'Header "ID المكان" غير موجود في ورقة ' + SHEET_NAMES.places;

  const lastRow = sh.getLastRow();
  let existingIds = [];
  if (lastRow > 1) {
    try { existingIds = sh.getRange(2, idCol + 1, lastRow - 1, 1).getValues().flat(); } catch (e) { existingIds = []; }
  }
  let maxId = 0;
  existingIds.forEach(v => { const n = Number(v); if (!isNaN(n) && n > maxId) maxId = n; });
  const newId = maxId + 1;

  const payload = {
    name: data.name || data.placeName || data.place || '',
    activityId: data.activityId || data.activity || data.activityType || '',
    cityId: data.cityId || data.city || '',
    areaId: data.areaId || data.area || '',
    siteId: data.siteId || data.mall || data.location || '',
    address: data.address || data.detailedAddress || '',
    mapLink: data.mapLink || '',
    phone: data.phone || '',
    whatsapp: data.whatsapp || data.whatsappLink || '',
    email: data.email || '',
    website: data.website || '',
    hours: data.hours || data.workingHours || '',
    delivery: data.delivery || '',
    packageId: data.packageId || data.package || '',
    password: data.password || '',
    description: data.description || '',
    logoUrl: data.logoUrl || data.logo || '',
    status: data.status || ''
  };

  const row = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    switch (h) {
      case 'ID المكان': row.push(newId); break;
      case 'اسم المكان': row.push(payload.name); break;
      case 'نوع النشاط / الفئة': row.push(payload.activityId); break;
      case 'المدينة': row.push(payload.cityId); break;
      case 'المنطقة': row.push(payload.areaId); break;
      case 'الموقع او المول': row.push(payload.siteId); break;
      case 'العنوان التفصيلي': row.push(payload.address); break;
      case 'رابط الموقع على الخريطة': row.push(payload.mapLink); break;
      case 'رقم التواصل': row.push(payload.phone); break;
      case 'رابط واتساب': row.push(payload.whatsapp); break;
      case 'البريد الإلكتروني': row.push(payload.email); break;
      case 'الموقع الالكتروني': row.push(payload.website); break;
      case 'ساعات العمل': row.push(payload.hours); break;
      case 'خدمات التوصيل': row.push(payload.delivery); break;
      case 'صورة شعار أو صورة المكان': row.push(payload.logoUrl || ''); break;
      case 'رابط صورة شعار المكان': row.push(payload.logoUrl || ''); break;
      case 'عدد االزيارات الكليه': row.push(0); break;
      case 'عدد الزيارات اليومية': row.push(0); break;
      case 'وصف مختصر ': row.push(payload.description || ''); break;
      case 'حالة التسجيل': row.push(payload.status || 'مُسجّل'); break;
      case 'تاريخ بداية الاشتراك': row.push(''); break;
      case 'تاريخ نهاية الاشتراك': row.push(''); break;
      case 'الباقة': row.push(payload.packageId || ''); break;
      case 'حالة الباقة': row.push(''); break;
      case 'كلمة المرور': row.push(payload.password || ''); break;
      case 'حالة المكان': row.push(payload.status || ''); break;
      default: row.push('');
    }
  }

  sh.appendRow(row);
  return { message: 'تم التسجيل', id: newId };
}

function updatePlace(data) {
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.places);
  if (!sh) throw 'Sheet not found: ' + SHEET_NAMES.places;
  const headers = sh.getDataRange().getValues()[0];

  let rowNum = null;
  if (data.row) rowNum = Number(data.row);
  else if (data.placeId) {
    const values = sh.getDataRange().getValues();
    const idCol = headers.indexOf('ID المكان');
    for (let i = 1; i < values.length; i++) { if (String(values[i][idCol]) === String(data.placeId)) { rowNum = i + 1; break; } }
  }
  if (!rowNum) throw 'Place not found to update';

  const map = {
    'اسم المكان': data.name || data.placeName || '',
    'نوع النشاط / الفئة': data.activityId || data.activity || data.activityType || '',
    'المدينة': data.cityId || data.city || '',
    'المنطقة': data.areaId || data.area || '',
    'الموقع او المول': data.siteId || data.mall || data.location || '',
    'العنوان التفصيلي': data.address || data.detailedAddress || '',
    'رابط الموقع على الخريطة': data.mapLink || '',
    'رقم التواصل': data.phone || '',
    'رابط واتساب': data.whatsapp || data.whatsappLink || '',
    'البريد الإلكتروني': data.email || '',
    'الموقع الالكتروني': data.website || '',
    'ساعات العمل': data.hours || data.workingHours || '',
    'خدمات التوصيل': data.delivery || '',
    'صورة شعار أو صورة المكان': data.logoUrl || '',
    'رابط صورة شعار المكان': data.logoUrl || '',
    'وصف مختصر ': data.description || '',
    'حالة التسجيل': data.status || '',
    'حالة المكان': data.status || ''
  };

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (map.hasOwnProperty(h)) {
      const valueToWrite = map[h];
      if (valueToWrite !== '' && valueToWrite !== null && valueToWrite !== undefined) {
        try { sh.getRange(rowNum, i + 1).setValue(valueToWrite); } catch (e) {}
      }
    }
  }

  const updatedRow = sh.getRange(rowNum, 1, 1, headers.length).getValues()[0];
  const obj = {};
  for (let j = 0; j < headers.length; j++) obj[headers[j]] = updatedRow[j];
  obj._row = rowNum;
  return { message: 'تم التحديث', place: normalizePlaceObject(obj) };
}

// ---------- Login ----------
function loginPlace(data) {
  const idOrPhone = String(data.phoneOrId || '').trim();
  const password = String(data.password || '');
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.places);
  if (!sh) throw 'Sheet not found: ' + SHEET_NAMES.places;
  const values = sh.getDataRange().getValues();
  if (!values || values.length === 0) return { success: false, error: 'لا توجد بيانات' };
  const headers = values[0];
  const rows = values.slice(1);
  const idCol = headers.indexOf('ID المكان');
  const phoneCol = headers.indexOf('رقم التواصل');
  const pwCol = headers.indexOf('كلمة المرور');

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const idVal = String(r[idCol] || '');
    const phoneVal = String(r[phoneCol] || '');
    const pwVal = String(r[pwCol] || '');
    if ((idVal && idVal === idOrPhone) || (phoneVal && phoneVal === idOrPhone)) {
      if (pwVal === password) {
        const obj = {};
        for (let j = 0; j < headers.length; j++) obj[headers[j]] = r[j];
        obj._row = i + 2;
        return { message: 'تم الدخول', place: normalizePlaceObject(obj) };
      } else {
        return { success: false, error: 'كلمة المرور غير صحيحة' };
      }
    }
  }
  return { success: false, error: 'لم يتم العثور على المكان' };
}

function normalizePlaceObject(obj) {
  return {
    id: String(obj['ID المكان'] || ''),
    name: obj['اسم المكان'] || '',
    phone: obj['رقم التواصل'] || '',
    package: obj['الباقة'] || '',
    packageEnd: obj['تاريخ نهاية الاشتراك'] || '',
    raw: obj
  };
}

// ---------- Choose package ----------
function choosePackage(data) {
  const placeId = String(data.placeId || '');
  const pkgId = String(data.packageId || '');
  if (!placeId || !pkgId) throw 'placeId and packageId required';
  const ss = openSS();
  const shPlaces = ss.getSheetByName(SHEET_NAMES.places);
  if (!shPlaces) throw 'Sheet not found: ' + SHEET_NAMES.places;
  const headers = shPlaces.getDataRange().getValues()[0];
  const rows = shPlaces.getDataRange().getValues();

  const shPkg = ss.getSheetByName(SHEET_NAMES.packages);
  if (!shPkg) throw 'Sheet not found: ' + SHEET_NAMES.packages;
  const pkgValues = shPkg.getDataRange().getValues();
  const pkgHeaders = pkgValues[0];

  let duration = 0;
  for (let i = 1; i < pkgValues.length; i++) {
    const r = pkgValues[i];
    if (String(r[pkgHeaders.indexOf('ID الباقة')]) === pkgId) {
      duration = Number(r[pkgHeaders.indexOf('مدة الباقة باليوم')]) || 0;
      break;
    }
  }

  const idCol = headers.indexOf('ID المكان');
  let foundRow = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol]) === placeId) { foundRow = i + 1; break; }
  }
  if (foundRow === -1) throw 'Place not found';

  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + duration * 24 * 3600 * 1000);
  const startCol = headers.indexOf('تاريخ بداية الاشتراك');
  const endCol = headers.indexOf('تاريخ نهاية الاشتراك');
  const pkgCol = headers.indexOf('الباقة');
  const pkgStatusCol = headers.indexOf('حالة الباقة');

  if (startCol >= 0) shPlaces.getRange(foundRow, startCol + 1).setValue(formatDate(startDate));
  if (endCol >= 0) shPlaces.getRange(foundRow, endCol + 1).setValue(formatDate(endDate));
  if (pkgCol >= 0) shPlaces.getRange(foundRow, pkgCol + 1).setValue(pkgId);
  if (pkgStatusCol >= 0) shPlaces.getRange(foundRow, pkgStatusCol + 1).setValue('نشطة');

  return { message: 'تم تحديد الباقة', start: formatDate(startDate), end: formatDate(endDate) };
}

function formatDate(d) {
  return Utilities.formatDate(new Date(d), Session.getScriptTimeZone() || 'GMT+3', 'yyyy-MM-dd');
}

// ---------- Upload media ----------
function uploadMedia(data) {
  const placeId = String(data.placeId || '');
  const filename = data.fileName || ('upload_' + new Date().getTime());
  const mimeType = data.mimeType || 'application/octet-stream';
  const base64 = data.fileData || data.base64 || '';
  if (!base64) throw 'No base64 data';
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, filename);
  const folder = DriveApp.getFolderById(MEDIA_FOLDER_ID);
  const file = folder.createFile(blob);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  const url = file.getUrl();

  if (placeId) {
    try {
      const ss = openSS();
      const sh = ss.getSheetByName(SHEET_NAMES.places);
      if (sh) {
        const values = sh.getDataRange().getValues();
        const headers = values[0];
        const idCol = headers.indexOf('ID المكان');
        const logoLinkCol = headers.indexOf('رابط صورة شعار المكان');
        const logoNameCol = headers.indexOf('صورة شعار أو صورة المكان');
        for (let i = 1; i < values.length; i++) {
          if (String(values[i][idCol]) === placeId) {
            if (logoLinkCol >= 0) sh.getRange(i + 1, logoLinkCol + 1).setValue(url);
            if (logoNameCol >= 0) sh.getRange(i + 1, logoNameCol + 1).setValue(filename);
            break;
          }
        }
      }
    } catch (e) { console.warn('uploadMedia: failed to write logo link to place row', e); }
  }

  return { message: 'uploaded', fileUrl: url, fileId: file.getId() };
}

// ---------- Ads helpers ----------
function getAdsForPlace(placeId) {
  if (!placeId) return [];
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.ads);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  if (!values || values.length <= 1) return [];
  const headers = values[0];
  const rows = values.slice(1);
  const idCol = findHeaderIndex(headers, ['ID الإعلان', 'IDالاعلان']);
  const placeCol = findHeaderIndex(headers, ['ID المكان', 'IDالمكان']);
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const pid = String(r[placeCol] || '');
    if (pid === String(placeId)) {
      const obj = {};
      for (let j = 0; j < headers.length; j++) obj[headers[j]] = r[j];
      obj._row = i + 2;
      obj.id = String(r[idCol] || '');
      out.push(normalizeAdObject(obj, headers));
    }
  }
  return out;
}

function normalizeAdObject(obj, headers) {
  const ad = { id: String(obj['ID الإعلان'] || obj['IDالاعلان'] || obj.id || ''), raw: obj };
  ad.placeId = String(obj['ID المكان'] || obj['IDالمكان'] || '');
  ad.type = obj['نوع الاعلان'] || obj['نوع الإعلان'] || '';
  ad.title = obj['العنوان'] || '';
  ad.description = obj['الوصف'] || '';
  ad.startDate = obj['تاريخ البداية'] || '';
  ad.endDate = obj['تاريخ النهاية'] || '';
  ad.coupon = obj['كوبون خصم'] || '';
  ad.videoFile = obj['الفيديو'] || '';
  ad.videoUrl = obj['رابط الفيديو'] || '';
  ad.status = obj['حالة الاعلان'] || obj['حالة الإعلان'] || '';
  ad.images = [];
  for (let i = 1; i <= 8; i++) {
    const nameHeaderCandidates = [`صورة${i}`, `صورة ${i}`];
    const linkHeaderCandidates = [`رابط صورة${i}`, `رابط صورة ${i}`];
    let nameVal = '';
    let linkVal = '';
    for (const h of headers) {
      if (nameHeaderCandidates.indexOf(h) !== -1) { nameVal = obj[h] || nameVal; }
      if (linkHeaderCandidates.indexOf(h) !== -1) { linkVal = obj[h] || linkVal; }
    }
    if (nameVal || linkVal) ad.images.push({ name: nameVal || '', url: linkVal || '' });
  }
  return ad;
}

// ---------- Add / Update / Delete Ad ----------
function addAd(data) {
  const placeId = String(data.placeId || '');
  if (!placeId) throw 'placeId required to add ad';
  const remainingInfo = getRemainingAds(placeId);
  if (remainingInfo.allowed <= 0) return { success: false, error: 'هذه الباقة لا تسمح بإضافة إعلانات' };
  if (remainingInfo.remaining <= 0) return { success: false, error: 'لقد استنفدت عدد الإعلانات المسموح بها في باقتك' };

  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.ads);
  if (!sh) throw 'Sheet not found: ' + SHEET_NAMES.ads;
  const headers = sh.getDataRange().getValues()[0];

  const idCol = findHeaderIndex(headers, ['ID الإعلان', 'IDالاعلان']);
  const values = sh.getDataRange().getValues();
  const allIds = [];
  for (let i = 1; i < values.length; i++) {
    const v = values[i][idCol];
    const n = Number(v);
    if (!isNaN(n)) allIds.push(n);
  }
  const newId = (allIds.length === 0) ? 1 : (Math.max.apply(null, allIds) + 1);

  let imageFiles = [];
  let imageUrls = [];
  try { if (typeof data.imageFiles === 'string') imageFiles = JSON.parse(data.imageFiles || '[]'); else if (Array.isArray(data.imageFiles)) imageFiles = data.imageFiles; } catch (e) { imageFiles = []; }
  try { if (typeof data.imageUrls === 'string') imageUrls = JSON.parse(data.imageUrls || '[]'); else if (Array.isArray(data.imageUrls)) imageUrls = data.imageUrls; } catch (e) { imageUrls = []; }

  const videoFile = data.videoFile || '';
  const videoUrl = data.videoUrl || '';

  const row = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (h === 'ID الإعلان' || h === 'IDالاعلان') { row.push(newId); continue; }
    if (/(^id.?المكان$)|(^idالمكان$)/i.test(h)) { row.push(placeId || ''); continue; }
    if (/نوع.?الاعلان|نوع.?الإعلان/i.test(h)) { row.push(data.adType || ''); continue; }
    if (/^العنوان$/i.test(h)) { row.push(data.adTitle || ''); continue; }
    if (/^الوصف$/i.test(h)) { row.push(data.adDescription || ''); continue; }
    if (/تاريخ.?البداية/i.test(h)) { row.push(data.startDate || ''); continue; }
    if (/تاريخ.?النهاية/i.test(h)) { row.push(data.endDate || ''); continue; }
    if (/كوبون.?خصم/i.test(h)) { row.push(data.coupon || ''); continue; }
    let m = h.match(/صورة\s*([1-8])/i) || h.match(/صورة([1-8])/i);
    if (m) { const idx = Number(m[1]) - 1; row.push(imageFiles[idx] || ''); continue; }
    m = (h.match(/رابط\s*صورة\s*([1-8])/i) || h.match(/رابطصورة\s*([1-8])/i));
    if (m) { const idx = Number(m[1]) - 1; row.push(imageUrls[idx] || ''); continue; }
    if (/^الفيديو$/i.test(h)) { row.push(videoFile || ''); continue; }
    if (/رابط.?الفيديو/i.test(h)) { row.push(videoUrl || ''); continue; }
    if (/حالة.?الإعلان|حالة.?الاعلان/i.test(h)) { row.push(data.adActiveStatus || ''); continue; }
    row.push('');
  }

  sh.appendRow(row);
  return { message: 'ad saved', id: newId };
}

function updateAd(data) {
  const adId = String(data.adId || data.id || '');
  if (!adId) throw 'adId required';
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.ads);
  if (!sh) throw 'Sheet not found: ' + SHEET_NAMES.ads;
  const values = sh.getDataRange().getValues();
  if (!values || values.length <= 1) throw 'No ads rows';
  const headers = values[0];
  const idCol = findHeaderIndex(headers, ['ID الإعلان', 'IDالاعلان']);
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(adId)) { rowIndex = i + 1; break; }
  }
  if (rowIndex === -1) throw 'Ad not found';

  let imageFiles = [];
  let imageUrls = [];
  try { if (typeof data.imageFiles === 'string') imageFiles = JSON.parse(data.imageFiles || '[]'); else if (Array.isArray(data.imageFiles)) imageFiles = data.imageFiles; } catch (e) { imageFiles = []; }
  try { if (typeof data.imageUrls === 'string') imageUrls = JSON.parse(data.imageUrls || '[]'); else if (Array.isArray(data.imageUrls)) imageUrls = data.imageUrls; } catch (e) { imageUrls = []; }

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    let valueToWrite = null;
    if (/(^id.?المكان$)|(^idالمكان$)/i.test(h) && data.placeId) valueToWrite = data.placeId;
    else if (/نوع.?الاعلان|نوع.?الإعلان/i.test(h) && data.adType) valueToWrite = data.adType;
    else if (/^العنوان$/i.test(h) && data.adTitle) valueToWrite = data.adTitle;
    else if (/^الوصف$/i.test(h) && data.adDescription) valueToWrite = data.adDescription;
    else if (/تاريخ.?البداية/i.test(h) && data.startDate) valueToWrite = data.startDate;
    else if (/تاريخ.?النهاية/i.test(h) && data.endDate) valueToWrite = data.endDate;
    else if (/كوبون.?خصم/i.test(h) && data.coupon) valueToWrite = data.coupon;
    else {
      let m = h.match(/صورة\s*([1-8])/i) || h.match(/صورة([1-8])/i);
      if (m) {
        const idx = Number(m[1]) - 1;
        if (imageFiles[idx]) valueToWrite = imageFiles[idx];
      }
      m = (h.match(/رابط\s*صورة\s*([1-8])/i) || h.match(/رابطصورة\s*([1-8])/i));
      if (m) {
        const idx = Number(m[1]) - 1;
        if (imageUrls[idx]) valueToWrite = imageUrls[idx];
      }
      if (/^الفيديو$/i.test(h) && data.videoFile) valueToWrite = data.videoFile;
      if (/رابط.?الفيديو/i.test(h) && data.videoUrl) valueToWrite = data.videoUrl;
      if (/حالة.?الإعلان|حالة.?الاعلان/i.test(h) && data.adActiveStatus) valueToWrite = data.adActiveStatus;
    }
    if (valueToWrite !== null && valueToWrite !== undefined && String(valueToWrite).trim() !== '') {
      try { sh.getRange(rowIndex, i + 1).setValue(valueToWrite); } catch (e) {}
    }
  }

  const updatedRow = sh.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const obj = {};
  for (let j = 0; j < headers.length; j++) obj[headers[j]] = updatedRow[j];
  obj._row = rowIndex;
  obj.id = String(updatedRow[idCol] || '');
  return { message: 'ad updated', ad: normalizeAdObject(obj, headers) };
}

function deleteAd(data) {
  const adId = String(data.adId || data.id || '');
  if (!adId) throw 'adId required';
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.ads);
  if (!sh) throw 'Sheet not found: ' + SHEET_NAMES.ads;
  const values = sh.getDataRange().getValues();
  if (!values || values.length <= 1) throw 'No ads rows';
  const headers = values[0];
  const idCol = findHeaderIndex(headers, ['ID الإعلان', 'IDالاعلان']);
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(adId)) { rowIndex = i + 1; break; }
  }
  if (rowIndex === -1) throw 'Ad not found';
  sh.deleteRow(rowIndex);
  return { message: 'ad deleted', id: adId };
}

// ---------- Packages & quota ----------
function getPackageById(pkgId) {
  if (!pkgId) return null;
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.packages);
  if (!sh) return null;
  const values = sh.getDataRange().getValues();
  if (!values || values.length === 0) return null;
  const headers = values[0];
  const idCol = headers.indexOf('ID الباقة');
  const adsCountCol = headers.indexOf('عدد الاعلانات');
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === pkgId) {
      return {
        id: String(values[i][idCol]),
        name: String(values[i][headers.indexOf('اسم الباقة')] || ''),
        duration: Number(values[i][headers.indexOf('مدة الباقة باليوم')] || 0),
        description: values[i][headers.indexOf('وصف الباقة')] || '',
        allowedAds: Number(values[i][adsCountCol] || 0),
        raw: values[i]
      };
    }
  }
  return null;
}

function countActiveAdsForPlace(placeId) {
  if (!placeId) return 0;
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.ads);
  if (!sh) return 0;
  const values = sh.getDataRange().getValues();
  if (!values || values.length <= 1) return 0;
  const headers = values[0];
  const placeCol = findHeaderIndex(headers, ['ID المكان', 'IDالمكان', 'id المكان']);
  const statusCol = findHeaderIndex(headers, ['حالة الاعلان', 'حالة الإعلان', 'حالة الاعلان']);
  let count = 0;
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const pid = String(row[placeCol] || '');
    if (pid === String(placeId)) {
      if (statusCol >= 0) {
        const s = String(row[statusCol] || '').toLowerCase();
        if (s === 'نشط' || s === 'active' || s === 'مفتوح') count++;
      } else count++;
    }
  }
  return count;
}

function getRemainingAds(placeId) {
  if (!placeId) return { packageId: '', allowed: 0, used: 0, remaining: 0 };
  const ss = openSS();
  const shPlaces = ss.getSheetByName(SHEET_NAMES.places);
  if (!shPlaces) throw 'Sheet not found: ' + SHEET_NAMES.places;
  const values = shPlaces.getDataRange().getValues();
  if (!values || values.length === 0) return { packageId: '', allowed: 0, used: 0, remaining: 0 };
  const headers = values[0];
  const idCol = headers.indexOf('ID المكان');
  const pkgCol = headers.indexOf('الباقة');
  let pkgId = '';
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(placeId)) { pkgId = String(values[i][pkgCol] || ''); break; }
  }
  const pkg = getPackageById(pkgId);
  const allowed = pkg ? Number(pkg.allowedAds || 0) : 0;
  const used = countActiveAdsForPlace(placeId);
  const remaining = Math.max(0, allowed - used);
  return { packageId: pkg ? pkg.id : '', allowed: allowed, used: used, remaining: remaining, packageName: pkg ? pkg.name : '' };
}

// ---------- Dashboard & visits ----------
function getDashboard(data) {
  const placeId = String(data.placeId || '');
  const ss = openSS();
  const shPlaces = ss.getSheetByName(SHEET_NAMES.places);
  if (!shPlaces) throw 'Sheet not found: ' + SHEET_NAMES.places;
  const allVals = shPlaces.getDataRange().getValues();
  if (!allVals || allVals.length === 0) return { place: null, visits: [] };
  const headers = allVals[0];
  const rows = allVals.slice(1);
  let place = null;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][headers.indexOf('ID المكان')]) === placeId) {
      const obj = {};
      for (let j = 0; j < headers.length; j++) obj[headers[j]] = rows[i][j];
      obj._row = i + 2;
      place = normalizePlaceObject(obj);
      break;
    }
  }

  const visits = [];
  const shVisits = ss.getSheetByName(SHEET_NAMES.visits);
  if (shVisits) {
    const vValues = shVisits.getDataRange().getValues();
    if (vValues && vValues.length > 1) {
      const vHeaders = vValues[0];
      for (let i = 1; i < vValues.length; i++) {
        const r = vValues[i];
        if (String(r[vHeaders.indexOf('ID المكان')]) === placeId || String(r[vHeaders.indexOf('ID الإعلان')]) === placeId) {
          const rec = {};
          for (let j = 0; j < vHeaders.length; j++) rec[vHeaders[j]] = r[j];
          visits.push(rec);
        }
      }
    }
  }

  return { place: place, visits: visits };
}

function recordVisit(data) {
  const ss = openSS();
  const sh = ss.getSheetByName(SHEET_NAMES.visits);
  if (!sh) throw 'Sheet not found: ' + SHEET_NAMES.visits;
  const headers = sh.getDataRange().getValues()[0];
  const row = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    switch (h) {
      case 'ID الإعلان': row.push(data.adId || ''); break;
      case 'ID المكان': row.push(data.placeId || ''); break;
      case 'نوع الزيارة': row.push(data.type || ''); break;
      case 'التاريخ': row.push(formatDate(new Date())); break;
      case 'IP': row.push(data.ip || ''); break;
      default: row.push('');
    }
  }
  sh.appendRow(row);
  return { message: 'visit recorded' };
}