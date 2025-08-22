const API_URL = 'https://script.google.com/macros/s/AKfycbx-fMI2hsJ5LvKKh9fzd3Vidn2TeGtEbHV9Nyj2nZBy9xQk9Uy_uL-m3hrDqp1uUWAPwA/exec';

let currentTab = 'places';
let uploadedImages = [];
let uploadedVideos = [];
let editingAdId = null;

// ---------- Theme (الوضع الليلي) ----------
const THEME_KEY = 'khedmatak_theme'; // 'dark' or 'light'
function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark');
    const icon = document.getElementById('themeIcon');
    const lbl = document.getElementById('themeLabel');
    if (icon) { icon.className = 'fas fa-sun'; }
    if (lbl) lbl.textContent = 'الوضع النهاري';
  } else {
    document.body.classList.remove('dark');
    const icon = document.getElementById('themeIcon');
    const lbl = document.getElementById('themeLabel');
    if (icon) { icon.className = 'fas fa-moon'; }
    if (lbl) lbl.textContent = 'الوضع الليلي';
  }
  try { localStorage.setItem(THEME_KEY, theme || 'light'); } catch(e){}
}
function toggleTheme() {
  const cur = (localStorage.getItem(THEME_KEY) === 'dark') ? 'dark' : 'light';
  const next = (cur === 'dark') ? 'light' : 'dark';
  applyTheme(next);
}
function initTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) applyTheme(saved);
    else {
      // respect system preference by default
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark ? 'dark' : 'light');
    }
  } catch (e) {
    applyTheme('light');
  }
}

// ------------------ Place status buttons init & update ------------------
function initPlaceStatusButtons() {
  const container = document.getElementById('placeStatusButtons');
  if (!container) return;
  container.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', async (ev) => {
      const status = btn.dataset.status;
      if (!status) return;
      const ok = confirm(`هل تريد تغيير حالة المكان إلى: "${status}"؟`);
      if (!ok) return;
      await updatePlaceStatus(status, btn);
    });
  });
}

function showPlaceStatusBar(place) {
  const bar = document.getElementById('placeStatusBar');
  const msg = document.getElementById('placeStatusMessage');
  if (!bar) return;
  if (!place || !place.id) {
    bar.style.display = 'none';
    if (msg) msg.textContent = '';
    return;
  }
  bar.style.display = 'block';
  const current = (place.status && String(place.status).trim() !== '') ? place.status
    : (place.raw && (place.raw['حالة المكان'] || place.raw['حالة التسجيل']) ? (place.raw['حالة المكان'] || place.raw['حالة التسجيل']) : '');
  const buttons = document.querySelectorAll('#placeStatusButtons .status-btn');
  buttons.forEach(b => {
    b.classList.toggle('active', b.dataset.status === current);
    b.disabled = false;
  });
  if (msg) msg.textContent = current ? `الحالة الحالية: ${current}` : 'الحالة غير محددة';
  initPlaceStatusButtons();
}

function hidePlaceStatusBar() {
  const bar = document.getElementById('placeStatusBar');
  const msg = document.getElementById('placeStatusMessage');
  if (bar) bar.style.display = 'none';
  if (msg) msg.textContent = '';
}

async function updatePlaceStatus(newStatus, btnElement = null) {
  try {
    const logged = getLoggedPlace();
    const placeId = (logged && logged.id) ? logged.id : (logged && logged.placeId) ? logged.placeId : null;
    if (!placeId) throw new Error('لا يوجد مكان مسجّل للدخول');

    const buttons = document.querySelectorAll('#placeStatusButtons .status-btn');
    buttons.forEach(b => b.disabled = true);
    if (btnElement) btnElement.textContent = 'جاري الحفظ...';

    const payload = { action: 'updatePlace', placeId: placeId, status: newStatus };
    const resp = await apiPost(payload);
    if (!resp.ok) throw new Error('فشل في التواصل مع الخادم');
    const data = resp.data;
    if (!data || data.success === false) throw new Error((data && data.error) ? data.error : 'استجابة غير متوقعة');

    const stored = getLoggedPlace() || {};
    stored.status = newStatus;
    if (!stored.raw) stored.raw = {};
    stored.raw['حالة المكان'] = newStatus;
    stored.raw['حالة التسجيل'] = newStatus;
    setLoggedPlace(stored);

    buttons.forEach(b => {
      b.classList.toggle('active', b.dataset.status === newStatus);
      if (b !== btnElement) b.disabled = false;
    });
    if (btnElement) btnElement.textContent = btnElement.dataset.status || 'تم';
    const msg = document.getElementById('placeStatusMessage');
    if (msg) msg.textContent = `تم التحديث إلى: ${newStatus}`;

    showSuccess('تم تحديث حالة المكان');
  } catch (err) {
    console.error('updatePlaceStatus error', err);
    showError(err.message || 'فشل تحديث حالة المكان');
    document.querySelectorAll('#placeStatusButtons .status-btn').forEach(b => { b.disabled = false; });
    if (btnElement) btnElement.textContent = btnElement.dataset.status || 'تجربة';
  }
}

// ------------------ API utilities ------------------
async function apiFetch(url, opts = {}) {
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (e) { data = text; }
    return { ok: res.ok, status: res.status, data, raw: text };
  } catch (err) {
    return { ok: false, status: 0, error: err.message || String(err) };
  }
}
async function apiPost(payload) {
  try {
    if (payload instanceof FormData) {
      return await apiFetch(API_URL, { method: 'POST', body: payload });
    }
    if (typeof payload === 'object' && payload !== null) {
      const form = new FormData();
      for (const k of Object.keys(payload)) {
        const v = payload[k];
        if (v !== null && typeof v === 'object') form.append(k, JSON.stringify(v));
        else form.append(k, v === undefined ? '' : v);
      }
      return await apiFetch(API_URL, { method: 'POST', body: form });
    }
    return await apiFetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: String(payload) });
  } catch (err) {
    return { ok: false, status: 0, error: err.message || String(err) };
  }
}

// ------------------ Init ------------------
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  initTheme();
  // theme toggle button
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  setupEventListeners();
  loadLookupsAndPopulate();
  loadPlacesForAds();
  setupAuthUI();
  if (typeof updateAdsTabVisibility === 'function') updateAdsTabVisibility();

  const stored = getLoggedPlace();
  if (stored && stored.id) showPlaceStatusBar(stored);
  else hidePlaceStatusBar();
  initPlaceStatusButtons();
});

function initializeApp() {
  const today = new Date().toISOString().split('T')[0];
  const startInput = document.querySelector('input[name="startDate"]');
  const endInput = document.querySelector('input[name="endDate"]');
  if (startInput) startInput.value = today;
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
  if (endInput) endInput.value = nextWeek.toISOString().split('T')[0];
}

function setupEventListeners() {
  const placeForm = document.getElementById('placeForm');
  const adForm = document.getElementById('adForm');
  const citySelect = document.querySelector('select[name="city"]');
  if (placeForm) placeForm.addEventListener('submit', handlePlaceSubmit);
  if (adForm) adForm.addEventListener('submit', handleAdSubmit);
  if (citySelect) citySelect.addEventListener('change', updateAreas);
}

// ------------------ Lookups & the rest of the script ------------------
// (Remaining functions unchanged from previous script: loadLookupsAndPopulate, updateAreas,
// showTab, previewImage, previewMultipleImages, previewVideo, uploadToGoogleDrive,
// handlePlaceSubmit, handleAdSubmit, loadPlacesForAds, renderAdsList, startEditAd, deleteAdConfirm,
// checkAdQuotaAndToggle, updateAdsTabVisibility, fetchPlace, setupAuthUI, get/set/clear logged place,
// setLoggedInUI, setLoggedOutUI, tryPrefillPlaceForm, select helpers, helpers, login handlers, etc.)
//
// For brevity I kept the rest of the script the same as your current script (unchanged),
// so paste the remaining functions from your existing script.js below this point.
// If you prefer, I can return a single combined script.js file with everything in place (complete file).
