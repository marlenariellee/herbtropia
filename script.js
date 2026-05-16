// ============================================
// HERBTROPIA — DIRECTORY BETA JS
// Preserves the original nav/menu/reveal behavior and adds live directories.
// ============================================

const HERBTROPIA_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbzKtrDuZBpIVEVnwfApHO6h21BCYMYu9QbF1xNf1tYMQNoIw1QoKHminXK8bFSRLcUaEg/exec',
  AUTO_PUBLISH_SUBMISSIONS: false,
  LOCAL_STORAGE_KEY: 'herbtropia_beta_directory'
};

function trackHerbtropiaEvent(eventName, params = {}) {
  if (typeof gtag === 'function') {
    gtag('event', eventName, {
      ...params,
      page_path: window.location.pathname
    });
  }
}

const CATEGORY_LABELS = {
  acupuncture: 'Acupuncture', herbalist: 'Herbalist / Herbal Medicine', naturopathic: 'Naturopathic Medicine', functional: 'Functional Medicine',
  breathwork: 'Breathwork', 'sound-healing': 'Sound Healing', massage: 'Massage / Bodywork', somatic: 'Somatic Wellness', yoga: 'Yoga / Movement',
  nutrition: 'Nutrition', 'beauty-wellness': 'Beauty + Wellness', other: 'Other', workshop: 'Workshop', class: 'Class', 'pop-up': 'Pop-Up',
  retreat: 'Retreat', market: 'Market', 'sound-bath': 'Sound Bath', 'yoga-movement': 'Yoga / Movement', 'herbal-education': 'Herbal Education', community: 'Community Gathering', networking: 'Networking'
};

const FORMAT_LABELS = { 'in-person': 'In-Person', virtual: 'Virtual', hybrid: 'Hybrid', mobile: 'Mobile Services' };
const COST_LABELS = { free: 'Free', 'under-25': 'Under $25', '25-50': '$25–$50', '50-plus': '$50+', donation: 'Donation-Based' };
const LOCATION_LABELS = { online: 'Online / Virtual', phoenix: 'Phoenix', mesa: 'Mesa', gilbert: 'Gilbert', tempe: 'Tempe', scottsdale: 'Scottsdale', chandler: 'Chandler', other: 'Other' };

const state = {
  practitioners: [],
  events: []
};

const seedData = {
  practitioners: [],
  events: []
};

// ============================================
// Original shared UI behavior
// ============================================
const nav = document.getElementById('nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 50);
  });
}

const menuToggle = document.getElementById('menuToggle');
const mobileNav = document.getElementById('mobileNav');
let menuOpen = false;
if (menuToggle && mobileNav) {
  menuToggle.addEventListener('click', () => {
    menuOpen = !menuOpen;
    mobileNav.classList.toggle('open', menuOpen);
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    menuToggle.children[0].style.transform = menuOpen ? 'rotate(45deg) translate(5px, 5px)' : '';
    menuToggle.children[1].style.opacity = menuOpen ? '0' : '1';
    menuToggle.children[2].style.transform = menuOpen ? 'rotate(-45deg) translate(5px, -5px)' : '';
  });
}

function closeMobile() {
  menuOpen = false;
  if (!mobileNav || !menuToggle) return;
  mobileNav.classList.remove('open');
  document.body.style.overflow = '';
  menuToggle.children[0].style.transform = '';
  menuToggle.children[1].style.opacity = '1';
  menuToggle.children[2].style.transform = '';
}
window.closeMobile = closeMobile;

function initReveals() {
  const reveals = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
  reveals.forEach(el => observer.observe(el));
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
      }
    });
  });
}

// ============================================
// Storage + Apps Script bridge
// ============================================
function apiIsConfigured() {
  return HERBTROPIA_CONFIG.API_URL && !HERBTROPIA_CONFIG.API_URL.includes('PASTE_GOOGLE_APPS_SCRIPT');
}

function readLocalData() {
  try {
    const saved = JSON.parse(localStorage.getItem(HERBTROPIA_CONFIG.LOCAL_STORAGE_KEY) || '{}');
    return {
      practitioners: Array.isArray(saved.practitioners) ? saved.practitioners : [],
      events: Array.isArray(saved.events) ? saved.events : []
    };
  } catch (error) {
    console.warn('Could not read Herbtropia local data', error);
    return { practitioners: [], events: [] };
  }
}

function saveLocalData() {
  try {
    localStorage.setItem(HERBTROPIA_CONFIG.LOCAL_STORAGE_KEY, JSON.stringify({ practitioners: state.practitioners, events: state.events }));
  } catch (error) {
    console.warn('Could not save Herbtropia local data', error);
  }
}

function loadInitialData() {
  state.practitioners = [];
  state.events = [];
  renderCurrentPage();

  if (apiIsConfigured()) {
    loadRemoteDataJSONP();
  } else {
    const local = readLocalData();
    state.practitioners = mergeById(seedData.practitioners, local.practitioners).filter(isLive);
    state.events = mergeById(seedData.events, local.events).filter(isLive);
    renderCurrentPage();
  }
}

function loadRemoteDataJSONP() {
  const callbackName = 'HerbtropiaDirectoryCallback_' + Date.now();

  window[callbackName] = function(payload) {
    try {
      if (payload && payload.ok) {
        // IMPORTANT: Replace with Google Sheet data instead of merging with old cached data.
        state.practitioners = (payload.practitioners || []).filter(isLive);
        state.events = (payload.events || []).filter(isLive);

        // Refresh cache with the current approved Sheet data only.
        saveLocalData();
        renderCurrentPage();
      }
    } finally {
      delete window[callbackName];
      const script = document.getElementById(callbackName);
      if (script) script.remove();
    }
  };

  const script = document.createElement('script');
  script.id = callbackName;
  script.src = `${HERBTROPIA_CONFIG.API_URL}?callback=${callbackName}&t=${Date.now()}`;
  script.onerror = function() {
    console.warn('Could not load remote Herbtropia directory data. Showing local fallback only.');
    delete window[callbackName];
    script.remove();
  };

  document.body.appendChild(script);
}

async function submitToBackend(item) {
  if (!apiIsConfigured()) {
    console.info('Apps Script URL is not configured yet. Submission captured in demo mode only.');
    return { ok: false, demoMode: true };
  }
  try {
    await fetch(HERBTROPIA_CONFIG.API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(item)
    });
    return { ok: true };
  } catch (error) {
    console.warn('Could not submit to Apps Script.', error);
    throw error;
  }
}

function mergeById(...arrays) {
  const map = new Map();
  arrays.flat().filter(Boolean).forEach(item => {
    if (!item.id) item.id = createId(item.type || 'item');
    map.set(item.id, { ...(map.get(item.id) || {}), ...item });
  });
  return Array.from(map.values());
}

function isLive(item) {
  const status = String(item.status || '').trim().toLowerCase();
  // Review workflow: only approved rows from Google Sheets should appear publicly.
  return status === 'approved';
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function slugify(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'other';
}

function escapeHTML(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith('@')) return `https://instagram.com/${raw.replace('@', '')}`;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function getInitials(name) {
  const source = String(name || 'Herbtropia Listing').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('');
  return source.toUpperCase() || 'H';
}

function splitTags(value) {
  if (Array.isArray(value)) return value.map(tag => String(tag).trim()).filter(Boolean);
  return String(value || '')
    .split(/[,|;]/)
    .map(tag => tag.trim())
    .filter(Boolean);
}

function labelizeSlug(value) {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function displayLabels(valueOrValues, labelMap = {}) {
  const labels = splitTags(valueOrValues).map(value => labelMap[slugify(value)] || value || labelizeSlug(value));
  return labels.filter(Boolean).join(', ');
}

function mergeTagValues(...values) {
  return values.flatMap(splitTags).filter(Boolean);
}

function getCheckedValues(filterType, scope) {
  return Array.from(document.querySelectorAll(`input[data-${scope}-filter="${filterType}"]:checked`)).map(input => input.value);
}

function clearCheckedFilters(scope) {
  document.querySelectorAll(`input[data-${scope}-filter]`).forEach(input => {
    input.checked = false;
  });
}

function anySelectedMatches(selectedValues, valueOrValues) {
  if (!selectedValues.length) return true;
  const slugged = splitTags(valueOrValues).map(slugify).filter(Boolean);
  return selectedValues.some(selected => slugged.includes(selected));
}

const CORE_CITY_SLUGS = ['phoenix', 'mesa', 'gilbert', 'tempe', 'scottsdale', 'chandler'];

function locationMatches(selectedLocations, city, format, venue = '', serviceAreas = '', additionalLocations = '') {
  if (!selectedLocations.length) return true;
  const citySlug = slugify(city);
  const serviceAreaSlugs = splitTags(serviceAreas).map(slugify);
  const locationText = [city, format, venue, serviceAreas, additionalLocations].join(' ').toLowerCase();
  return selectedLocations.some(loc => {
    if (loc === 'online') return locationText.includes('virtual') || locationText.includes('online') || serviceAreaSlugs.includes('online');
    if (loc === 'other') return serviceAreaSlugs.includes('other') || (citySlug && !CORE_CITY_SLUGS.includes(citySlug));
    return citySlug === loc || serviceAreaSlugs.includes(loc) || locationText.includes(loc.replace('-', ' '));
  });
}

function formatLocationDisplay(item) {
  const cityStateZip = [item.city, item.state, item.zip].filter(Boolean).join(', ');
  const primary = [item.addressLine, cityStateZip].filter(Boolean).join(' — ');
  const areas = displayLabels(item.serviceAreas, LOCATION_LABELS);
  const extra = item.additionalLocations || item.additionalAddresses;
  const pieces = [primary || cityStateZip, areas, extra].filter(Boolean);
  return pieces.join(' • ') || 'Location TBD';
}

function formatCardLocation(item) {
  const cityState = [item.city, item.state].filter(Boolean).join(', ');
  const areas = displayLabels(item.serviceAreas, LOCATION_LABELS);

  return [cityState, areas].filter(Boolean).join(' • ') || 'Location TBD';
}

function formatDate(value) {
  if (!value) return 'Date TBD';

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return raw;
}

function formatTime(value) {
  if (!value) return '';

  const raw = String(value).trim();

  if (/^\d{1,2}:\d{2}/.test(raw)) {
    const [hours, minutes] = raw.split(':').map(Number);
    const date = new Date();
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  return '';
}

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read uploaded file.'));
    reader.readAsDataURL(file);
  });
}

function stripUploadPayload(item) {
  const cleaned = { ...item };
  ['photoBase64', 'photoFileName', 'photoMimeType', 'imageBase64', 'imageFileName', 'imageMimeType'].forEach(key => delete cleaned[key]);
  return cleaned;
}

async function addImageUploadData(data, input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (!file.type || !file.type.startsWith('image/')) {
    alert('Please upload an image file, such as JPG, PNG, or WebP.');
    throw new Error('Invalid image upload type.');
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    alert('Please upload an image that is 5 MB or smaller.');
    throw new Error('Image upload is too large.');
  }

  const dataUrl = await fileToDataUrl(file);
  const base64 = dataUrl.includes(',') ? dataUrl.split(',').pop() : dataUrl;

  if (input.name === 'photoFile') {
    data.photoUrl = dataUrl;
    data.photoBase64 = base64;
    data.photoFileName = file.name;
    data.photoMimeType = file.type;
  }
  if (input.name === 'imageFile') {
    data.imageUrl = dataUrl;
    data.imageBase64 = base64;
    data.imageFileName = file.name;
    data.imageMimeType = file.type;
  }
}

async function getFormData(form) {
  const formData = new FormData(form);
  const data = {};
  const fileFieldNames = new Set(Array.from(form.querySelectorAll('input[type="file"]')).map(input => input.name).filter(Boolean));
  const keys = new Set(Array.from(formData.keys()).filter(key => !fileFieldNames.has(key)));

  for (const key of keys) {
    const values = formData.getAll(key)
      .map(value => typeof value === 'string' ? value.trim() : value)
      .filter(value => value !== '' && value !== null && value !== undefined);
    data[key] = values.length > 1 ? values.join(', ') : (values[0] || '');
  }

  const fileInputs = Array.from(form.querySelectorAll('input[type="file"]'));
  for (const input of fileInputs) {
    await addImageUploadData(data, input);
  }
  return data;
}

function validateRequiredMultiGroups(form) {
  const groups = Array.from(form.querySelectorAll('[data-required-multiple]'));
  for (const group of groups) group.classList.remove('invalid');
  const invalid = groups.filter(group => !group.querySelector('input[type="checkbox"]:checked'));
  if (invalid.length) {
    invalid.forEach(group => group.classList.add('invalid'));
    invalid[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    const label = invalid[0].querySelector('legend')?.textContent?.replace('*', '').trim() || 'required options';
    alert(`Please select at least one option for: ${label}.`);
    return false;
  }
  return true;
}


// ============================================
// Mobile filter drawer helpers
// ============================================
function getActiveFilterCount(scope) {
  return document.querySelectorAll(`input[data-${scope}-filter]:checked`).length;
}

function updateFilterBadge(scope) {
  const count = getActiveFilterCount(scope);
  const badgeId = scope === 'practitioner' ? 'activePractitionerFilterCount' : 'activeEventFilterCount';
  const triggerId = scope === 'practitioner' ? 'openPractitionerFilters' : 'openEventFilters';
  const badge = document.getElementById(badgeId);
  const trigger = document.getElementById(triggerId);
  if (badge) badge.textContent = count;
  if (trigger) trigger.classList.toggle('has-active-filters', count > 0);
}

function resetDirectoryFilters(scope) {
  const searchId = scope === 'practitioner' ? 'practitionerSearch' : 'eventSearch';
  const search = document.getElementById(searchId);
  if (search) search.value = '';
  clearCheckedFilters(scope);
  if (scope === 'practitioner') renderPractitioners();
  if (scope === 'event') renderEvents();
  updateFilterBadge(scope);
}

function initFilterDrawer(scope, triggerId, panelId) {
  const trigger = document.getElementById(triggerId);
  const panel = document.getElementById(panelId);
  const backdrop = document.querySelector('[data-filter-backdrop]');
  if (!trigger || !panel) return;

  const closeButtons = panel.querySelectorAll('[data-close-filters]');
  const openFilters = () => {
    panel.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    document.body.classList.add('filter-drawer-open');
    trigger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };
  const closeFilters = () => {
    panel.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    document.body.classList.remove('filter-drawer-open');
    trigger.setAttribute('aria-expanded', 'false');
    if (!document.querySelector('.modal-backdrop.open') && !document.querySelector('.nav-mobile.open')) {
      document.body.style.overflow = '';
    }
  };

  trigger.addEventListener('click', openFilters);
  if (backdrop) backdrop.addEventListener('click', closeFilters);
  closeButtons.forEach(btn => btn.addEventListener('click', closeFilters));
  panel.querySelectorAll(`input[data-${scope}-filter]`).forEach(input => {
    input.addEventListener('change', updateFilterBadge.bind(null, scope));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('open')) closeFilters();
  });
}

// ============================================
// Dynamic practitioner address builder
// ============================================
function initAddressBuilder() {
  const list = document.getElementById('additionalAddressList');
  const addBtn = document.getElementById('addAddressBtn');
  if (!list || !addBtn) return;
  let addressCount = 0;

  function syncAdditionalLocations() {
    const hidden = document.getElementById('additionalLocations');
    if (!hidden) return;
    const addresses = Array.from(list.querySelectorAll('.additional-address-card')).map((card) => {
      const line = card.querySelector('[data-address-line]')?.value?.trim() || '';
      const city = card.querySelector('[data-address-city]')?.value?.trim() || '';
      const state = card.querySelector('[data-address-state]')?.value?.trim() || '';
      const zip = card.querySelector('[data-address-zip]')?.value?.trim() || '';
      return [line, [city, state, zip].filter(Boolean).join(', ')].filter(Boolean).join(' — ');
    }).filter(Boolean);
    hidden.value = addresses.join(' | ');
  }

  function addAddressCard() {
    addressCount += 1;
    const card = document.createElement('div');
    card.className = 'additional-address-card';
    card.innerHTML = `
      <div class="additional-address-header">
        <strong>Additional Address ${addressCount}</strong>
        <button class="remove-address-btn" type="button">Remove</button>
      </div>
      <div class="form-group"><label>Address / Practice Location</label><input class="form-input" type="text" placeholder="Street address, suite, studio, or location note" data-address-line></div>
      <div class="form-row three-part">
        <div class="form-group"><label>City</label><input class="form-input" type="text" placeholder="Phoenix" data-address-city></div>
        <div class="form-group"><label>State</label><input class="form-input" type="text" placeholder="AZ" data-address-state></div>
        <div class="form-group"><label>Zip Code</label><input class="form-input" type="text" placeholder="85004" data-address-zip></div>
      </div>
    `;
    list.appendChild(card);
    card.querySelector('.remove-address-btn').addEventListener('click', () => {
      card.remove();
      syncAdditionalLocations();
    });
    card.querySelectorAll('input').forEach(input => input.addEventListener('input', syncAdditionalLocations));
  }

  function resetAdditionalAddressCards() {
    list.innerHTML = '';
    addressCount = 0;
    const hidden = document.getElementById('additionalLocations');
    if (hidden) hidden.value = '';
  }

  addBtn.addEventListener('click', (event) => {
    event.preventDefault();
    addAddressCard();
  });
  const form = document.getElementById('practitionerForm');
  if (form) form.addEventListener('submit', syncAdditionalLocations);
  window.resetAdditionalAddressCards = resetAdditionalAddressCards;
}

// ============================================
// Practitioner directory
// ============================================
// Practitioner directory
// ============================================
function initDirectoryPage() {
  const search = document.getElementById('practitionerSearch');
  if (search) search.addEventListener('input', renderPractitioners);
  document.querySelectorAll('input[data-practitioner-filter]').forEach(input => {
    input.addEventListener('change', renderPractitioners);
  });

  const clear = document.getElementById('clearPractitionerFilters');
  if (clear) clear.addEventListener('click', () => resetDirectoryFilters('practitioner'));

  const mobileClear = document.getElementById('mobileClearPractitionerFilters');
  if (mobileClear) mobileClear.addEventListener('click', () => resetDirectoryFilters('practitioner'));

  initFilterDrawer('practitioner', 'openPractitionerFilters', 'practitionerFilters');

  const form = document.getElementById('practitionerForm');
  if (form) form.addEventListener('submit', handlePractitionerSubmit);

  initModal('profileModal');
}

function practitionerMatches(practitioner) {
  const q = String(document.getElementById('practitionerSearch')?.value || '').toLowerCase().trim();
  const selectedCategories = getCheckedValues('category', 'practitioner');
  const selectedLocations = getCheckedValues('location', 'practitioner');
  const selectedFormats = getCheckedValues('format', 'practitioner');
  const selectedFocus = getCheckedValues('focus', 'practitioner');
  const haystack = [practitioner.name, practitioner.businessName, practitioner.category, practitioner.addressLine, practitioner.city, practitioner.state, practitioner.zip, practitioner.serviceFormat, practitioner.serviceAreas, practitioner.additionalLocations, practitioner.additionalAddresses, practitioner.wellnessFocus, practitioner.serviceTags, practitioner.services, practitioner.bio]
    .join(' ').toLowerCase();
  if (q && !haystack.includes(q)) return false;
  if (!anySelectedMatches(selectedCategories, practitioner.category)) return false;
  if (!anySelectedMatches(selectedFormats, practitioner.serviceFormat)) return false;
  if (!locationMatches(selectedLocations, practitioner.city, practitioner.serviceFormat, '', practitioner.serviceAreas, [practitioner.additionalLocations, practitioner.addressLine, practitioner.additionalAddresses].filter(Boolean).join(' '))) return false;
  if (!anySelectedMatches(selectedFocus, practitioner.wellnessFocus)) return false;
  return true;
}

function renderPractitioners() {
  const grid = document.getElementById('practitionerGrid');
  const empty = document.getElementById('practitionerEmpty');
  const count = document.getElementById('practitionerCount');
  if (!grid) return;
  updateFilterBadge('practitioner');
  const matches = state.practitioners.filter(practitionerMatches);
  grid.innerHTML = matches.map(renderPractitionerCard).join('');
  if (count) count.textContent = `${matches.length} practitioner${matches.length === 1 ? '' : 's'} showing`;
  if (empty) empty.style.display = matches.length ? 'none' : 'block';
  grid.style.display = matches.length ? 'grid' : 'none';
  grid.querySelectorAll('[data-open-practitioner]').forEach(btn => {
    btn.addEventListener('click', () => openPractitionerModal(btn.dataset.openPractitioner));
  });
}

function renderPractitionerCard(p) {
  const category = displayLabels(p.category, CATEGORY_LABELS) || 'Practitioner';
  const format = displayLabels(p.serviceFormat, FORMAT_LABELS) || 'Format TBD';
  const location = formatCardLocation(p);
  const tags = mergeTagValues(p.wellnessFocus, p.serviceTags)
    .slice(0, 4)
    .map(tag => `<span class="tag">${escapeHTML(displayLabels(tag, { ...CATEGORY_LABELS, ...FORMAT_LABELS, ...LOCATION_LABELS }) || labelizeSlug(tag))}</span>`)
    .join('');

  const image = p.photoUrl
    ? `<img src="${escapeHTML(normalizeUrl(p.photoUrl))}" alt="${escapeHTML(p.businessName || p.name)}">`
    : escapeHTML(getInitials(p.businessName || p.name));

  return `<article class="profile-card">
    <div class="avatar">${image}</div>
    <span class="card-badge">${escapeHTML(category)}</span>
    <h3><button class="card-title-btn" type="button" data-open-practitioner="${escapeHTML(p.id)}">${escapeHTML(p.businessName || p.name)}</button></h3>
    <div class="card-meta">📍 ${escapeHTML(location)} • ${escapeHTML(format)}</div>
    <div class="tag-row">${tags}</div>
    <div class="card-actions">
      <button class="card-action secondary" type="button" data-open-practitioner="${escapeHTML(p.id)}">View Profile</button>
      ${p.bookingLink ? `<a class="card-action" href="${escapeHTML(normalizeUrl(p.bookingLink))}" target="_blank" rel="noopener">Book</a>` : ''}
    </div>
  </article>`;
}

function openPractitionerModal(id) {
  const p = state.practitioners.find(item => item.id === id);
  if (!p) return;

  trackHerbtropiaEvent('profile_open', {
  profile_id: id
  });

  const modal = document.getElementById('profileModal');
  const content = document.getElementById('modalContent');
  const category = displayLabels(p.category, CATEGORY_LABELS) || 'Practitioner';
  const format = displayLabels(p.serviceFormat, FORMAT_LABELS) || 'Format TBD';
  const location = formatLocationDisplay(p);
  const focusTags = splitTags(p.wellnessFocus).map(tag => `<span class="tag">${escapeHTML(displayLabels(tag, CATEGORY_LABELS) || labelizeSlug(tag))}</span>`).join('');
  const serviceTags = splitTags(p.serviceTags).map(tag => `<span class="tag">${escapeHTML(displayLabels(tag, CATEGORY_LABELS) || labelizeSlug(tag))}</span>`).join('');
  const profileImage = p.photoUrl ? `
  <button class="modal-image-wrap profile-photo compact-modal-image" type="button" data-open-image="${escapeHTML(normalizeUrl(p.photoUrl))}" aria-label="View ${escapeHTML(p.businessName || p.name)} image larger">
    <img src="${escapeHTML(normalizeUrl(p.photoUrl))}" alt="${escapeHTML(p.businessName || p.name)}">
    <span class="image-expand-hint">Click to enlarge</span>
  </button>
` : '';
  const contactButtons = [
    p.bookingLink ? `<a class="card-action" href="${escapeHTML(normalizeUrl(p.bookingLink))}" target="_blank" rel="noopener">Book Now</a>` : '',
    p.website ? `<a class="card-action secondary" href="${escapeHTML(normalizeUrl(p.website))}" target="_blank" rel="noopener">Website</a>` : '',
    p.instagram ? `<a class="card-action secondary" href="${escapeHTML(normalizeUrl(p.instagram))}" target="_blank" rel="noopener">Instagram</a>` : ''
  ].join('');
  content.innerHTML = `<div class="modal-head">
      <div class="card-badge">${escapeHTML(category)}</div>
      <h2 class="modal-title" id="modalTitle">${escapeHTML(p.businessName || p.name)}</h2>
      <div class="modal-sub">${escapeHTML(p.name || '')}${p.name && p.businessName ? ' • ' : ''}${escapeHTML(location)} • ${escapeHTML(format)}</div>
    </div>
    ${profileImage}
    <div class="modal-body"><div class="modal-grid">
      <div>
        <div class="modal-section-title">About</div>
        <p class="modal-text">${escapeHTML(p.bio || 'Profile details coming soon.')}</p>
        <div class="modal-section-title">Services</div>
        <p class="modal-text">${escapeHTML(p.services || 'Services coming soon.')}</p>
        ${focusTags ? `<div class="modal-section-title">Wellness Focus</div><div class="tag-row">${focusTags}</div>` : ''}
        ${serviceTags ? `<div class="modal-section-title">Searchable Specialties</div><div class="tag-row">${serviceTags}</div>` : ''}
        <div class="card-actions">${contactButtons || '<span class="card-meta">Contact links coming soon.</span>'}</div>
      </div>
      <aside class="detail-list">
        <div class="detail-item"><div class="detail-label">Practitioner Type</div><div class="detail-value">${escapeHTML(category)}</div></div>
        <div class="detail-item"><div class="detail-label">Location / Service Areas</div><div class="detail-value">${escapeHTML(location)}</div></div>
        <div class="detail-item"><div class="detail-label">Format</div><div class="detail-value">${escapeHTML(format)}</div></div>
        <div class="detail-item"><div class="detail-label">Accepting Clients</div><div class="detail-value">${escapeHTML(p.acceptingClients || 'Ask directly')}</div></div>
        <div class="detail-item"><div class="detail-label">Price Range</div><div class="detail-value">${escapeHTML(p.priceRange || 'Varies')}</div></div>
      </aside>
    </div></div>`;
  openModal(modal);
}

async function handlePractitionerSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  if (!validateRequiredMultiGroups(form)) return;
  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonHTML = submitButton ? submitButton.innerHTML : '';
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML = 'Submitting for review...';
  }

  try {
    const data = await getFormData(form);
    if (data.website_confirm) return;
    const itemWithUploadPayload = {
      ...data,
      id: createId('practitioner'),
      type: 'practitioner',
      status: 'Pending Review',
      submittedAt: new Date().toISOString(),
      category: data.category,
      serviceFormat: data.serviceFormat
    };
  await submitToBackend(itemWithUploadPayload);

  trackHerbtropiaEvent('practitioner_submission', {
    form_name: 'practitioner_signup'
  });
  
  form.reset();
  if (typeof window.resetAdditionalAddressCards === 'function') window.resetAdditionalAddressCards();
  document.getElementById('practitionerFormWrap').style.display = 'none';
  document.getElementById('practitionerSuccess').style.display = 'block';
  } catch (error) {
    console.warn('Could not submit practitioner profile.', error);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonHTML;
    }
  }
}

// ============================================
// Events directory
// ============================================
function initEventsPage() {
  const search = document.getElementById('eventSearch');
  if (search) search.addEventListener('input', renderEvents);
  document.querySelectorAll('input[data-event-filter]').forEach(input => {
    input.addEventListener('change', renderEvents);
  });

  const clear = document.getElementById('clearEventFilters');
  if (clear) clear.addEventListener('click', () => resetDirectoryFilters('event'));

  const mobileClear = document.getElementById('mobileClearEventFilters');
  if (mobileClear) mobileClear.addEventListener('click', () => resetDirectoryFilters('event'));

  initFilterDrawer('event', 'openEventFilters', 'eventFilters');

  const form = document.getElementById('eventForm');
  if (form) form.addEventListener('submit', handleEventSubmit);
  initModal('eventModal');
}

function eventMatches(event) {
  const q = String(document.getElementById('eventSearch')?.value || '').toLowerCase().trim();
  const selectedCategories = getCheckedValues('category', 'event');
  const selectedLocations = getCheckedValues('location', 'event');
  const selectedFormats = getCheckedValues('format', 'event');
  const selectedCosts = getCheckedValues('cost', 'event');
  const selectedRecurring = getCheckedValues('recurring', 'event');
  const haystack = [event.eventName, event.organizerName, event.category, event.city, event.state, event.format, event.costType, event.serviceAreas, event.additionalLocations, event.venue, event.description, event.audience, event.eventFocus, event.recurring]
    .join(' ').toLowerCase();
  if (q && !haystack.includes(q)) return false;
  if (!anySelectedMatches(selectedCategories, event.category)) return false;
  if (!anySelectedMatches(selectedFormats, event.format)) return false;
  if (!anySelectedMatches(selectedCosts, event.costType)) return false;
  if (!anySelectedMatches(selectedRecurring, event.recurring || 'one-time')) return false;
  if (!locationMatches(selectedLocations, event.city, event.format, event.venue, event.serviceAreas, event.additionalLocations)) return false;
  return true;
}

function renderEvents() {
  const grid = document.getElementById('eventGrid');
  const empty = document.getElementById('eventEmpty');
  const count = document.getElementById('eventCount');
  if (!grid) return;
  updateFilterBadge('event');
  const matches = state.events.filter(eventMatches).sort((a, b) => String(a.eventDate || '').localeCompare(String(b.eventDate || '')));
  grid.innerHTML = matches.map(renderEventCard).join('');
  if (count) count.textContent = `${matches.length} event${matches.length === 1 ? '' : 's'} showing`;
  if (empty) empty.style.display = matches.length ? 'none' : 'block';
  grid.style.display = matches.length ? 'grid' : 'none';
  grid.querySelectorAll('[data-open-event]').forEach(btn => {
    btn.addEventListener('click', () => openEventModal(btn.dataset.openEvent));
  });
}

function renderEventCard(event) {
  const category = displayLabels(event.category, CATEGORY_LABELS) || 'Event';
  const format = displayLabels(event.format, FORMAT_LABELS) || 'Format TBD';
  const cost = displayLabels(event.costType, COST_LABELS) || 'Cost TBD';
  const location = formatCardLocation(event) || format;

  const tags = mergeTagValues(event.audience, event.eventFocus)
    .slice(0, 3)
    .map(tag => `<span class="tag">${escapeHTML(displayLabels(tag, { ...CATEGORY_LABELS, ...FORMAT_LABELS, ...LOCATION_LABELS, ...COST_LABELS }) || labelizeSlug(tag))}</span>`)
    .join('');

  const dateTime = [formatDate(event.eventDate), formatTime(event.startTime)]
    .filter(Boolean)
    .join(' • ');

  return `<article class="event-card">
    <span class="card-badge gold">${escapeHTML(cost)}</span>
    <span class="card-badge">${escapeHTML(category)}</span>
    <h3><button class="card-title-btn" type="button" data-open-event="${escapeHTML(event.id)}">${escapeHTML(event.eventName)}</button></h3>
    <div class="card-meta">${escapeHTML(dateTime)} • ${escapeHTML(location || format)}</div>
    <div class="tag-row">${tags}</div>
    <div class="card-actions">
      <button class="card-action secondary" type="button" data-open-event="${escapeHTML(event.id)}">View Event</button>
      ${event.eventLink ? `<a class="card-action" href="${escapeHTML(normalizeUrl(event.eventLink))}" target="_blank" rel="noopener">RSVP</a>` : ''}
    </div>
  </article>`;
}

function openEventModal(id) {
  const event = state.events.find(item => item.id === id);
  if (!event) return;

  trackHerbtropiaEvent('event_open', {
  event_id: id
  });
  
  const modal = document.getElementById('eventModal');
  const content = document.getElementById('eventModalContent');
  const category = displayLabels(event.category, CATEGORY_LABELS) || 'Event';
  const format = displayLabels(event.format, FORMAT_LABELS) || 'Format TBD';
  const cost = displayLabels(event.costType, COST_LABELS) || event.price || 'Cost TBD';
  const location = [event.venue, formatLocationDisplay(event)].filter(Boolean).join(' • ');
  const dateTime = [formatDate(event.eventDate), formatTime(event.startTime)].filter(Boolean).join(' • ');
  const audienceTags = splitTags(event.audience).map(tag => `<span class="tag">${escapeHTML(labelizeSlug(tag))}</span>`).join('');
  const focusTags = splitTags(event.eventFocus).map(tag => `<span class="tag">${escapeHTML(labelizeSlug(tag))}</span>`).join('');
  const flyerImage = event.imageUrl ? `
  <button class="modal-image-wrap event-flyer compact-modal-image" type="button" data-open-image="${escapeHTML(normalizeUrl(event.imageUrl))}" aria-label="View ${escapeHTML(event.eventName)} flyer larger">
    <img src="${escapeHTML(normalizeUrl(event.imageUrl))}" alt="${escapeHTML(event.eventName)} flyer">
    <span class="image-expand-hint">Click to enlarge flyer</span>
  </button>
` : '';
    content.innerHTML = `<div class="modal-head">
      <div class="card-badge">${escapeHTML(category)}</div>
      <h2 class="modal-title" id="modalTitle">${escapeHTML(event.eventName)}</h2>
      <div class="modal-sub">Hosted by ${escapeHTML(event.organizerName || 'TBD')} • ${escapeHTML(dateTime)}</div>
    </div>
    ${flyerImage}
    <div class="modal-body"><div class="modal-grid">
      <div>
        <div class="modal-section-title">About This Event</div>
        <p class="modal-text">${escapeHTML(event.description || 'Event details coming soon.')}</p>
        ${audienceTags ? `<div class="modal-section-title">Audience / Vibe</div><div class="tag-row">${audienceTags}</div>` : ''}
        ${focusTags ? `<div class="modal-section-title">Wellness Focus</div><div class="tag-row">${focusTags}</div>` : ''}
        <div class="card-actions">${event.eventLink ? `<a class="card-action" href="${escapeHTML(normalizeUrl(event.eventLink))}" target="_blank" rel="noopener">RSVP / Learn More</a>` : '<span class="card-meta">RSVP link coming soon.</span>'}</div>
      </div>
      <aside class="detail-list">
        <div class="detail-item"><div class="detail-label">Date / Time</div><div class="detail-value">${escapeHTML(dateTime)}</div></div>
        <div class="detail-item"><div class="detail-label">Location</div><div class="detail-value">${escapeHTML(location || 'Location TBD')}</div></div>
        <div class="detail-item"><div class="detail-label">Format</div><div class="detail-value">${escapeHTML(format)}</div></div>
        <div class="detail-item"><div class="detail-label">Cost</div><div class="detail-value">${escapeHTML(event.price || cost)}</div></div>
        <div class="detail-item"><div class="detail-label">Recurring</div><div class="detail-value">${escapeHTML(event.recurring || 'One-Time')}</div></div>
      </aside>
    </div></div>`;
  openModal(modal);
}

async function handleEventSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  if (!validateRequiredMultiGroups(form)) return;
  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonHTML = submitButton ? submitButton.innerHTML : '';
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML = 'Submitting for review...';
  }

  try {
    const data = await getFormData(form);
    if (data.website_confirm) return;
    const itemWithUploadPayload = {
      ...data,
      id: createId('event'),
      type: 'event',
      status: 'Pending Review',
      submittedAt: new Date().toISOString(),
      eventDate: data.eventDate
    };
  await submitToBackend(itemWithUploadPayload);

  trackHerbtropiaEvent('event_submission', {
  form_name: 'event_submission'
  });

  form.reset();
  document.getElementById('eventFormWrap').style.display = 'none';
  document.getElementById('eventSuccess').style.display = 'block';    
  } catch (error) {
    console.warn('Could not submit event.', error);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonHTML;
    }
  }
}

// ============================================
// Newsletter signup
// ============================================
function initNewsletterPage() {
  const form = document.getElementById('newsletterForm');
  if (!form) return;
  form.addEventListener('submit', handleNewsletterSubmit);
}

async function handleNewsletterSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonHTML = submitButton ? submitButton.innerHTML : '';
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML = 'Joining...';
  }
  try {
    const data = await getFormData(form);
    if (data.website_confirm) return;
    const item = {
      ...data,
      name: [data.firstName, data.lastName].filter(Boolean).join(' '),
      id: createId('newsletter'),
      type: 'newsletter',
      source: 'Website Newsletter Page',
      status: 'Subscribed',
      createdAt: new Date().toISOString()
    };
  await submitToBackend(item);

  trackHerbtropiaEvent('newsletter_signup', {
  form_name: 'newsletter'
  });

  form.reset();
  document.getElementById('newsletterFormWrap').style.display = 'none';
  document.getElementById('newsletterSuccess').style.display = 'block';
  } catch (error) {
    console.warn('Could not submit newsletter signup.', error);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonHTML;
    }
  }
}

// ============================================
// Modal helpers
// ============================================
function initModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.matches('[data-close-modal]')) closeModal(modal);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(modal);
  });
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

// ============================================
// Image lightbox for practitioner photos/event flyers
// ============================================
function openImageLightbox(src) {
  if (!src) return;

  let lightbox = document.getElementById('imageLightbox');

  if (!lightbox) {
    lightbox = document.createElement('div');
    lightbox.id = 'imageLightbox';
    lightbox.className = 'image-lightbox';
    lightbox.setAttribute('aria-hidden', 'true');
    lightbox.innerHTML = `
      <button class="image-lightbox-close" type="button" aria-label="Close enlarged image">×</button>
      <img src="" alt="Expanded Herbtropia image">
    `;
    document.body.appendChild(lightbox);

    lightbox.addEventListener('click', function(e) {
      if (e.target === lightbox || e.target.classList.contains('image-lightbox-close')) {
        closeImageLightbox();
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && lightbox.classList.contains('open')) {
        closeImageLightbox();
      }
    });
  }

  const img = lightbox.querySelector('img');
  img.src = src;
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
}

function closeImageLightbox() {
  const lightbox = document.getElementById('imageLightbox');
  if (!lightbox) return;

  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');

  const img = lightbox.querySelector('img');
  if (img) img.src = '';
}

document.addEventListener('click', function(e) {
  const trigger = e.target.closest('[data-open-image]');
  if (!trigger) return;

  e.preventDefault();
  openImageLightbox(trigger.dataset.openImage);
});

// ============================================
// Boot
// ============================================
function renderCurrentPage() {
  const page = document.body.dataset.page;
  if (page === 'directory') renderPractitioners();
  if (page === 'events') renderEvents();
}

document.addEventListener('DOMContentLoaded', () => {
  initReveals();
  initSmoothScroll();
  const page = document.body.dataset.page;
  initAddressBuilder();
  if (page === 'directory') initDirectoryPage();
  if (page === 'events') initEventsPage();
  if (page === 'newsletter') initNewsletterPage();
  if (page === 'update-request') initUpdateRequestPage();

  loadInitialData();
});

document.addEventListener('click', function(e) {
  const link = e.target.closest('a');
  if (!link) return;

  const text = (link.textContent || '').trim().slice(0, 80);
  const href = link.getAttribute('href') || '';

  if (
    href.includes('directory.html') ||
    href.includes('events.html') ||
    href.includes('practitioner-signup.html') ||
    href.includes('submit-event.html') ||
    href.includes('newsletter.html')
  ) {
    trackHerbtropiaEvent('cta_click', {
      link_text: text,
      link_url: href
    });
  }
});

// ============================================
// Update request form
// ============================================
function initUpdateRequestPage() {
  const form = document.getElementById('updateRequestForm');
  if (!form) return;

  const params = new URLSearchParams(window.location.search);

  const listingType = params.get('type') || '';
  const listingId = params.get('id') || '';
  const updateToken = params.get('token') || '';
  const email = params.get('email') || '';

  const listingTypeInput = document.getElementById('listingType');
  const listingIdInput = document.getElementById('listingId');
  const updateTokenInput = document.getElementById('updateToken');
  const currentEmailInput = document.getElementById('currentEmail');

  if (listingTypeInput) listingTypeInput.value = listingType;
  if (listingIdInput) listingIdInput.value = listingId;
  if (updateTokenInput) updateTokenInput.value = updateToken;
  if (currentEmailInput && email) currentEmailInput.value = email;

  form.addEventListener('submit', handleUpdateRequestSubmit);
}

async function handleUpdateRequestSubmit(e) {
  e.preventDefault();

  const form = e.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonHTML = submitButton ? submitButton.innerHTML : '';

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML = 'Submitting update request...';
  }

  try {
    const data = await getFormData(form);
    if (data.website_confirm) return;

    const item = {
      ...data,
      id: createId('update-request'),
      type: 'update-request',
      status: 'Pending Review',
      submittedAt: new Date().toISOString()
    };

    await submitToBackend(item);

    form.reset();
    document.getElementById('updateFormWrap').style.display = 'none';
    document.getElementById('updateSuccess').style.display = 'block';
  } catch (error) {
    console.warn('Could not submit update request.', error);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonHTML;
    }
  }
}

/* ============================================
   CLEAN DIRECTORY CARD SPACING
   Keeps cards clean after hiding long descriptions
   ============================================ */

   .profile-card,
   .event-card {
     min-height: 520px;
     padding: clamp(32px, 4vw, 46px);
     display: flex;
     flex-direction: column;
     align-items: flex-start;
   }
   
   /* Avatar/logo spacing on practitioner cards */
   .profile-card .avatar {
     margin-bottom: 28px;
   }
   
   /* Keep badge/pill spacing consistent */
   .profile-card .card-badge,
   .event-card .card-badge {
     margin-bottom: 26px;
     max-width: 100%;
   }
   
   /* If an event has two badges, keep them stacked cleanly */
   .event-card .card-badge + .card-badge {
     margin-top: 0;
   }
   
   /* Title spacing */
   .profile-card h3,
   .event-card h3 {
     margin: 0 0 18px;
     line-height: 1.12;
   }
   
   /* Make title buttons inherit the pretty title styling */
   .card-title-btn {
     font-family: inherit;
     font-size: inherit;
     font-weight: inherit;
     line-height: inherit;
     color: inherit;
     text-align: left;
     background: transparent;
     padding: 0;
   }
   
   /* Meta text: date, location, format */
   .profile-card .card-meta,
   .event-card .card-meta {
     margin-bottom: 30px;
     line-height: 1.55;
   }
   
   /* Tags sit near the bottom, but above buttons */
   .profile-card .tag-row,
   .event-card .tag-row {
     margin-top: auto;
     margin-bottom: 28px;
     display: flex;
     flex-wrap: wrap;
     gap: 10px;
     max-height: 92px;
     overflow: hidden;
   }
   
   /* Keep buttons aligned and intentional */
   .profile-card .card-actions,
   .event-card .card-actions {
     margin-top: 0;
     display: flex;
     align-items: center;
     gap: 14px;
     width: 100%;
   }
   
   /* Make buttons feel balanced */
   .profile-card .card-action,
   .event-card .card-action {
     min-height: 52px;
     display: inline-flex;
     align-items: center;
     justify-content: center;
     white-space: nowrap;
   }
   
   /* Mobile card polish */
   @media (max-width: 700px) {
     .profile-card,
     .event-card {
       min-height: 500px;
       padding: 34px 30px;
     }
   
     .profile-card .tag-row,
     .event-card .tag-row {
       max-height: 86px;
       margin-bottom: 24px;
     }
   
     .profile-card .card-actions,
     .event-card .card-actions {
       gap: 12px;
     }
   
     .profile-card .card-action,
     .event-card .card-action {
       min-height: 50px;
       padding-left: 22px;
       padding-right: 22px;
     }
   }