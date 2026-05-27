// ============================================
// HERBTROPIA — DIRECTORY BETA JS
// Preserves the original nav/menu/reveal behavior and adds live directories.
// ============================================

const HERBTROPIA_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwZVE71y14zMrczqNHtOyZdCCUhAiaBPlPrP28ZRAJUlwN-h4MQpOkUd7ZXHrkOTB5Krw/exec',
  AUTO_PUBLISH_SUBMISSIONS: false,
  LOCAL_STORAGE_KEY: 'herbtropia_directory_v2'
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

const LISTING_TYPE_LABELS = {
  'individual-practitioner': 'Individual Practitioner',
  'practice-clinic': 'Practice / Clinic',
  'wellness-business': 'Wellness Business',
  'wellness-studio-space': 'Wellness Studio / Space',
  'school-training-program': 'School / Training Program',
  'community-organization': 'Community Organization',
  'holistic-product-brand': 'Holistic Product Brand',
  other: 'Other'
};

const FORMAT_LABELS = { 'in-person': 'In-Person', virtual: 'Virtual', hybrid: 'Hybrid', mobile: 'Mobile Services' };
const COST_LABELS = { free: 'Free', 'under-25': 'Under $25', '25-50': '$25–$50', '50-plus': '$50+', donation: 'Donation-Based' };
const LOCATION_LABELS = { online: 'Online / Virtual', phoenix: 'Phoenix', mesa: 'Mesa', gilbert: 'Gilbert', tempe: 'Tempe', scottsdale: 'Scottsdale', chandler: 'Chandler', other: 'Other' };
const EDUCATION_TOPIC_LABELS = { herbal: 'Herbal Medicine', naturopathic: 'Naturopathic Medicine', 'nervous-system': 'Nervous System', somatic: 'Somatic Wellness', functional: 'Functional Medicine', nutrition: 'Nutrition', 'skin-body': 'Skin + Body', spiritual: 'Spiritual Wellness', movement: 'Movement', community: 'Community Wellness', other: 'Other' };
const RESOURCE_TYPE_LABELS = { article: 'Article', guide: 'Guide', video: 'Video', podcast: 'Podcast', research: 'Research', directory: 'Directory', tool: 'Tool', book: 'Book', other: 'Other' };
const LEVEL_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', 'practitioner-level': 'Practitioner-Level', all: 'All Levels' };

const state = {
  listings: [],
  events: [],
  education: []
};

const seedData = {
  listings: [],
  events: [],
  education: []
};

// ============================================
// Original shared UI behavior
// ============================================
const nav = document.getElementById('nav');

const menuToggle = document.getElementById('menuToggle');
const mobileNav = document.getElementById('mobileNav');
let menuOpen = false;

function setHamburgerIcon(open) {
  if (!menuToggle) return;
  const bars = menuToggle.querySelectorAll('span');
  if (bars[0]) bars[0].style.transform = open ? 'rotate(45deg) translate(5px, 5px)' : '';
  if (bars[1]) bars[1].style.opacity = open ? '0' : '1';
  if (bars[2]) bars[2].style.transform = open ? 'rotate(-45deg) translate(5px, -5px)' : '';
}

function setMobileMenu(open) {
  menuOpen = Boolean(open);
  if (!mobileNav || !menuToggle) return;

  mobileNav.classList.toggle('open', menuOpen);
  document.body.classList.toggle('mobile-menu-open', menuOpen);
  document.body.style.overflow = menuOpen ? 'hidden' : '';
  menuToggle.setAttribute('aria-expanded', String(menuOpen));
  mobileNav.setAttribute('aria-hidden', String(!menuOpen));
  setHamburgerIcon(menuOpen);
}

if (menuToggle && mobileNav) {
  // Force the full-screen menu to start closed, even if the browser restores classes.
  setMobileMenu(false);

  menuToggle.addEventListener('click', (event) => {
    event.preventDefault();
    setMobileMenu(!menuOpen);
  });

  mobileNav.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (link) setMobileMenu(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuOpen) setMobileMenu(false);
  });
}

function closeMobile() {
  setMobileMenu(false);
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
  const url = HERBTROPIA_CONFIG.API_URL || '';
  return url && !url.includes('PASTE_') && /^https:\/\/script\.google\.com\/macros\/s\//.test(url);
}

function readLocalData() {
  try {
    const saved = JSON.parse(localStorage.getItem(HERBTROPIA_CONFIG.LOCAL_STORAGE_KEY) || '{}');
    return {
      listings: Array.isArray(saved.listings) ? saved.listings : [],
      events: Array.isArray(saved.events) ? saved.events : [],
      education: Array.isArray(saved.education) ? saved.education : []
    };
  } catch (error) {
    console.warn('Could not read Herbtropia local data', error);
    return { listings: [], events: [], education: [] };
  }
}

function saveLocalData() {
  try {
    localStorage.setItem(HERBTROPIA_CONFIG.LOCAL_STORAGE_KEY, JSON.stringify({
      listings: state.listings,
      events: state.events,
      education: state.education
    }));
  } catch (error) {
    console.warn('Could not save Herbtropia local data', error);
  }
}

function loadInitialData() {
  state.listings = [];
  state.events = [];
  state.education = [];
  renderCurrentPage();

  if (apiIsConfigured()) {
    loadRemoteDataJSONP();
  } else {
    const local = readLocalData();
    state.listings = mergeById(seedData.listings, local.listings).filter(isLive);
    state.events = mergeById(seedData.events, local.events).filter(isLive);
    state.education = mergeById(seedData.education || [], local.education || []).filter(isLive);
    renderCurrentPage();
  }
}



function loadRemoteDataJSONP() {
  const callbackName = 'HerbtropiaDirectoryCallback_' + Date.now();
  let completed = false;

  const finish = () => {
    completed = true;
    const script = document.getElementById(callbackName);
    if (script) script.remove();
    try {
      delete window[callbackName];
    } catch (error) {
      window[callbackName] = undefined;
    }
  };

  const useFallback = (reason) => {
    console.warn('Could not load remote Herbtropia data.', reason || '');
    const local = readLocalData();
    state.listings = Array.isArray(local.listings) ? local.listings.filter(isLive) : [];
    state.events = Array.isArray(local.events) ? local.events.filter(isLive) : [];
    state.education = Array.isArray(local.education) ? local.education.filter(isLive) : [];
    renderCurrentPage();
  };

  window[callbackName] = function(payload) {
    if (completed) return;

    try {
      if (payload && payload.ok) {
        const listings = payload.listings || [];
        state.listings = (listings || []).filter(isLive);
            state.events = (payload.events || []).filter(isLive);
        state.education = (payload.education || payload.resources || []).filter(isLive);
        saveLocalData();
      } else {
        console.warn('Herbtropia backend returned an error payload:', payload);
        useFallback(payload && payload.error ? payload.error : 'Unknown backend error');
      }

      renderCurrentPage();
    } finally {
      finish();
    }
  };

  const script = document.createElement('script');
  script.id = callbackName;
  script.src = `${HERBTROPIA_CONFIG.API_URL}?callback=${callbackName}&t=${Date.now()}`;

  script.onerror = function() {
    if (completed) return;
    useFallback('JSONP script failed to load.');
    finish();
  };

  document.body.appendChild(script);

  setTimeout(() => {
    if (completed) return;
    useFallback('Timed out waiting for Apps Script response.');
    finish();
  }, 9000);
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
  const badgeId = scope === 'listing' ? 'activeListingFilterCount' : 'activeEventFilterCount';
  const triggerId = scope === 'listing' ? 'openListingFilters' : 'openEventFilters';
  const badge = document.getElementById(badgeId);
  const trigger = document.getElementById(triggerId);
  if (badge) badge.textContent = count;
  if (trigger) trigger.classList.toggle('has-active-filters', count > 0);
}

function resetDirectoryFilters(scope) {
  const searchId = scope === 'listing' ? 'listingSearch' : 'eventSearch';
  const search = document.getElementById(searchId);
  if (search) search.value = '';
  clearCheckedFilters(scope);
  if (scope === 'listing') renderListings();
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
// Dynamic listing address builder
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
  const form = document.getElementById('listingForm');
  if (form) form.addEventListener('submit', syncAdditionalLocations);
  window.resetAdditionalAddressCards = resetAdditionalAddressCards;
}


function getListingName(item) {
  return item.listingName || item.businessName || item.name || 'Herbtropia Listing';
}

function getContactName(item) {
  return item.contactName || item.name || '';
}

function getListingType(item) {
  return item.listingType || 'individual-practitioner';
}

// ============================================
// Wellness directory

function getListingName(item) {
  return item.listingName || item.businessName || item.name || 'Herbtropia Listing';
}

function getContactName(item) {
  return item.contactName || item.name || '';
}

function getListingType(item) {
  return item.listingType || 'individual-practitioner';
}

// ============================================
// Wellness directory
// ============================================
function initDirectoryPage() {
  const search = document.getElementById('listingSearch');
  if (search) search.addEventListener('input', renderListings);
  document.querySelectorAll('input[data-listing-filter]').forEach(input => {
    input.addEventListener('change', renderListings);
  });

  const clear = document.getElementById('clearListingFilters');
  if (clear) clear.addEventListener('click', () => resetDirectoryFilters('listing'));

  const mobileClear = document.getElementById('mobileClearListingFilters');
  if (mobileClear) mobileClear.addEventListener('click', () => resetDirectoryFilters('listing'));

  initFilterDrawer('listing', 'openListingFilters', 'listingFilters');

  const form = document.getElementById('listingForm');
  if (form) form.addEventListener('submit', handleListingSubmit);

  initModal('listingModal');
}

function listingMatches(listing) {
  const q = String(document.getElementById('listingSearch')?.value || '').toLowerCase().trim();
  const selectedListingTypes = getCheckedValues('listingType', 'listing');
  const selectedCategories = getCheckedValues('category', 'listing');
  const selectedLocations = getCheckedValues('location', 'listing');
  const selectedFormats = getCheckedValues('format', 'listing');
  const selectedFocus = getCheckedValues('focus', 'listing');
  const haystack = [getListingName(listing), getContactName(listing), listing.listingType, listing.category, listing.addressLine, listing.city, listing.state, listing.zip, listing.serviceFormat, listing.serviceAreas, listing.additionalLocations, listing.additionalAddresses, listing.wellnessFocus, listing.serviceTags, listing.services, listing.bio]
    .join(' ').toLowerCase();
  if (q && !haystack.includes(q)) return false;
  if (!anySelectedMatches(selectedListingTypes, listing.listingType || 'individual-listing')) return false;
  if (!anySelectedMatches(selectedCategories, listing.category)) return false;
  if (!anySelectedMatches(selectedFormats, listing.serviceFormat)) return false;
  if (!locationMatches(selectedLocations, listing.city, listing.serviceFormat, '', listing.serviceAreas, [listing.additionalLocations, listing.addressLine, listing.additionalAddresses].filter(Boolean).join(' '))) return false;
  if (!anySelectedMatches(selectedFocus, listing.wellnessFocus)) return false;
  return true;
}

function renderListings() {
  const grid = document.getElementById('listingGrid');
  const empty = document.getElementById('listingEmpty');
  const count = document.getElementById('listingCount');
  if (!grid) return;
  updateFilterBadge('listing');
  const matches = state.listings.filter(listingMatches);
  grid.innerHTML = matches.map(renderListingCard).join('');
  if (count) count.textContent = `${matches.length} listing${matches.length === 1 ? '' : 's'} showing`;
  if (empty) empty.style.display = matches.length ? 'none' : 'block';
  grid.style.display = matches.length ? 'grid' : 'none';
  grid.querySelectorAll('[data-open-listing]').forEach(btn => {
    btn.addEventListener('click', () => openListingModal(btn.dataset.openListing));
  });
}



function renderListingCard(p) {
  const listingType = displayLabels(getListingType(p), LISTING_TYPE_LABELS) || 'Directory Listing';
  const category = displayLabels(p.category, CATEGORY_LABELS) || 'Wellness';
  const format = displayLabels(p.serviceFormat, FORMAT_LABELS) || 'Format TBD';
  const location = formatCardLocation(p);
  const title = getListingName(p);
  const hasPhoto = String(p.photoUrl || '').trim().length > 0;

  const mediaContent = hasPhoto
    ? `<img src="${escapeHTML(normalizeUrl(p.photoUrl))}" alt="${escapeHTML(title)}">`
    : `<div class="listing-placeholder-frame"><span>${escapeHTML(getInitials(title))}</span></div>`;

  return `<article class="event-card horizontal-card listing-result-card listing-event-match has-flyer">
    <div class="card-media event-media listing-media">
      <button class="event-card-image listing-card-image" type="button" data-open-listing="${escapeHTML(p.id)}" aria-label="View ${escapeHTML(title)} listing">
        ${mediaContent}
      </button>
    </div>

    <div class="card-main event-card-main listing-card-main">
      <div class="event-card-copy listing-card-copy">
        <h3><button class="card-title-btn" type="button" data-open-listing="${escapeHTML(p.id)}">${escapeHTML(title)}</button></h3>
        <div class="card-meta">${escapeHTML([category, '📍 ' + location, format].filter(Boolean).join(' • '))}</div>
      </div>

      <div class="event-card-side listing-card-side">
        <div class="event-badge-row listing-badge-row">
          <span class="card-badge">${escapeHTML(listingType)}</span>
          <span class="card-badge soft">${escapeHTML(category)}</span>
        </div>

        <div class="card-actions event-card-actions listing-card-actions">
          <button class="card-action secondary" type="button" data-open-listing="${escapeHTML(p.id)}">View Listing</button>
          ${p.bookingLink ? `<a class="card-action" href="${escapeHTML(normalizeUrl(p.bookingLink))}" target="_blank" rel="noopener">Book</a>` : ''}
        </div>
      </div>
    </div>
  </article>`;
}



function openListingModal(id) {
  const p = state.listings.find(item => item.id === id);
  if (!p) return;

  trackHerbtropiaEvent('listing_open', {
    listing_id: id
  });

  const modal = document.getElementById('listingModal');
  const content = document.getElementById('listingModalContent');
  const listingType = displayLabels(getListingType(p), LISTING_TYPE_LABELS) || 'Directory Listing';
  const category = displayLabels(p.category, CATEGORY_LABELS) || 'Wellness';
  const format = displayLabels(p.serviceFormat, FORMAT_LABELS) || 'Format TBD';
  const location = formatLocationDisplay(p);
  const title = getListingName(p);
  const contactName = getContactName(p);
  const focusTags = splitTags(p.wellnessFocus).map(tag => `<span class="tag">${escapeHTML(displayLabels(tag, CATEGORY_LABELS) || labelizeSlug(tag))}</span>`).join('');
  const serviceTags = splitTags(p.serviceTags).map(tag => `<span class="tag">${escapeHTML(displayLabels(tag, CATEGORY_LABELS) || labelizeSlug(tag))}</span>`).join('');
  const profileImage = p.photoUrl ? `
  <button class="modal-image-wrap profile-photo compact-modal-image" type="button" data-open-image="${escapeHTML(normalizeUrl(p.photoUrl))}" aria-label="View ${escapeHTML(title)} image larger">
    <img src="${escapeHTML(normalizeUrl(p.photoUrl))}" alt="${escapeHTML(title)}">
    <span class="image-expand-hint">Click to enlarge</span>
  </button>
` : '';
  const contactButtons = [
    p.bookingLink ? `<a class="card-action" href="${escapeHTML(normalizeUrl(p.bookingLink))}" target="_blank" rel="noopener">Book / Contact</a>` : '',
    p.website ? `<a class="card-action secondary" href="${escapeHTML(normalizeUrl(p.website))}" target="_blank" rel="noopener">Website</a>` : '',
    p.instagram ? `<a class="card-action secondary" href="${escapeHTML(normalizeUrl(p.instagram))}" target="_blank" rel="noopener">Instagram</a>` : ''
  ].join('');
  content.innerHTML = `<div class="modal-head">
      <div class="card-badge">${escapeHTML(listingType)}</div>
      <h2 class="modal-title" id="modalTitle">${escapeHTML(title)}</h2>
      <div class="modal-sub">${escapeHTML([contactName, category, location, format].filter(Boolean).join(' • '))}</div>
    </div>
    ${profileImage}
    <div class="modal-body"><div class="modal-grid">
      <div>
        <div class="modal-section-title">About</div>
        <p class="modal-text">${escapeHTML(p.bio || 'Listing details coming soon.')}</p>
        <div class="modal-section-title">Services / Offerings</div>
        <p class="modal-text">${escapeHTML(p.services || 'Offerings coming soon.')}</p>
        ${focusTags ? `<div class="modal-section-title">Wellness Focus</div><div class="tag-row">${focusTags}</div>` : ''}
        ${serviceTags ? `<div class="modal-section-title">Searchable Specialties</div><div class="tag-row">${serviceTags}</div>` : ''}
        <div class="card-actions">${contactButtons || '<span class="card-meta">Contact links coming soon.</span>'}</div>
      </div>
      <aside class="detail-list">
        <div class="detail-item"><div class="detail-label">Listing Type</div><div class="detail-value">${escapeHTML(listingType)}</div></div>
        <div class="detail-item"><div class="detail-label">Category / Modality</div><div class="detail-value">${escapeHTML(category)}</div></div>
        <div class="detail-item"><div class="detail-label">Location / Service Areas</div><div class="detail-value">${escapeHTML(location)}</div></div>
        <div class="detail-item"><div class="detail-label">Format</div><div class="detail-value">${escapeHTML(format)}</div></div>
        <div class="detail-item"><div class="detail-label">Accepting Clients / Availability</div><div class="detail-value">${escapeHTML(p.acceptingClients || 'Ask directly')}</div></div>
        <div class="detail-item"><div class="detail-label">Price Range</div><div class="detail-value">${escapeHTML(p.priceRange || 'Varies')}</div></div>
      </aside>
    </div></div>`;
  openModal(modal);
}



async function handleListingSubmit(e) {
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
      id: createId('listing'),
      type: 'listing',
      status: 'Pending Review',
      submittedAt: new Date().toISOString(),
      contactName: data.contactName || data.name || '',
      listingName: data.listingName || data.businessName || '',
      name: data.name || data.contactName || '',
      businessName: data.businessName || data.listingName || '',
      listingType: data.listingType || 'individual-practitioner',
      category: data.category,
      serviceFormat: data.serviceFormat
    };
    await submitToBackend(itemWithUploadPayload);

    trackHerbtropiaEvent('listing_submission', {
      form_name: 'submit_listing'
    });

    form.reset();
    if (typeof window.resetAdditionalAddressCards === 'function') window.resetAdditionalAddressCards();
    const wrap = document.getElementById('listingFormWrap') || document.getElementById('listingFormWrap');
    const success = document.getElementById('listingSuccess') || document.getElementById('listingSuccess');
    if (wrap) wrap.style.display = 'none';
    if (success) success.style.display = 'block';
  } catch (error) {
    console.warn('Could not submit directory listing.', error);
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
  const cost = displayLabels(event.costType, COST_LABELS) || 'Cost TBD';
  const format = displayLabels(event.format, FORMAT_LABELS) || 'Format TBD';
  const location = formatCardLocation(event) || format;

  const dateTime = [formatDate(event.eventDate), formatTime(event.startTime)]
    .filter(Boolean)
    .join(' • ');

  const hasFlyer = String(event.imageUrl || '').trim().length > 0;

  const flyerImage = hasFlyer ? `
    <button class="event-card-image" type="button" data-open-image="${escapeHTML(normalizeUrl(event.imageUrl))}" aria-label="View ${escapeHTML(event.eventName)} flyer larger">
      <img src="${escapeHTML(normalizeUrl(event.imageUrl))}" alt="${escapeHTML(event.eventName)} flyer">
    </button>
  ` : '';

  return `<article class="event-card horizontal-card ${hasFlyer ? 'has-flyer' : 'no-flyer'}">
    ${hasFlyer ? `<div class="card-media event-media">${flyerImage}</div>` : ''}
    <div class="card-main event-card-main">
      <div class="event-card-copy">
        <h3><button class="card-title-btn" type="button" data-open-event="${escapeHTML(event.id)}">${escapeHTML(event.eventName)}</button></h3>
        <div class="card-meta">${escapeHTML([dateTime, location || format].filter(Boolean).join(' • '))}</div>
      </div>

      <div class="event-card-side">
        <div class="event-badge-row">
          <span class="card-badge gold">${escapeHTML(cost)}</span>
          <span class="card-badge">${escapeHTML(category)}</span>
        </div>

        <div class="card-actions event-card-actions">
          <button class="card-action secondary" type="button" data-open-event="${escapeHTML(event.id)}">View Event</button>
          ${event.eventLink ? `<a class="card-action" href="${escapeHTML(normalizeUrl(event.eventLink))}" target="_blank" rel="noopener">RSVP</a>` : ''}
        </div>
      </div>
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
// Education library
// ============================================
function initEducationPage() {
  const search = document.getElementById('educationSearch');
  if (search) search.addEventListener('input', renderEducation);
  document.querySelectorAll('input[data-education-filter]').forEach(input => {
    input.addEventListener('change', renderEducation);
  });
  const clear = document.getElementById('clearEducationFilters');
  if (clear) clear.addEventListener('click', () => {
    const s = document.getElementById('educationSearch');
    if (s) s.value = '';
    document.querySelectorAll('input[data-education-filter]').forEach(input => input.checked = false);
    renderEducation();
  });
}

function educationMatches(resource) {
  const q = String(document.getElementById('educationSearch')?.value || '').toLowerCase().trim();
  const selectedTopics = getCheckedValues('topic', 'education');
  const selectedTypes = getCheckedValues('resourceType', 'education');
  const selectedLevels = getCheckedValues('level', 'education');
  const haystack = [resource.title, resource.sourceName, resource.resourceType, resource.topic, resource.summary, resource.tags, resource.level, resource.audience]
    .join(' ').toLowerCase();
  if (q && !haystack.includes(q)) return false;
  if (!anySelectedMatches(selectedTopics, resource.topic)) return false;
  if (!anySelectedMatches(selectedTypes, resource.resourceType)) return false;
  if (!anySelectedMatches(selectedLevels, resource.level)) return false;
  return true;
}

function renderEducation() {
  const grid = document.getElementById('educationGrid');
  const empty = document.getElementById('educationEmpty');
  const count = document.getElementById('educationCount');
  if (!grid) return;
  const matches = state.education.filter(educationMatches);
  grid.innerHTML = matches.map(renderEducationCard).join('');
  if (count) count.textContent = `${matches.length} resource${matches.length === 1 ? '' : 's'} showing`;
  if (empty) empty.style.display = matches.length ? 'none' : 'block';
  grid.style.display = matches.length ? 'grid' : 'none';
}

function renderEducationCard(resource) {
  const topic = displayLabels(resource.topic, EDUCATION_TOPIC_LABELS) || 'Education';
  const type = displayLabels(resource.resourceType, RESOURCE_TYPE_LABELS) || 'Resource';
  const level = displayLabels(resource.level, LEVEL_LABELS) || 'All Levels';
  const url = normalizeUrl(resource.resourceUrl);
  return `<article class="profile-card horizontal-card education-card">
    <div class="card-main">
      <span class="card-badge">${escapeHTML(type)}</span>
      <h3>${url ? `<a class="card-title-btn" href="${escapeHTML(url)}" target="_blank" rel="noopener">${escapeHTML(resource.title || 'Untitled resource')}</a>` : escapeHTML(resource.title || 'Untitled resource')}</h3>
      <div class="card-meta">${escapeHTML([topic, level, resource.sourceName].filter(Boolean).join(' • '))}</div>
      <p class="card-desc">${escapeHTML(resource.summary || 'Curated wellness education resource.').slice(0, 220)}${String(resource.summary || '').length > 220 ? '…' : ''}</p>
      <div class="card-actions">
        ${url ? `<a class="card-action" href="${escapeHTML(url)}" target="_blank" rel="noopener">Open Resource</a>` : ''}
      </div>
    </div>
  </article>`;
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
// Image lightbox for listing photos/event flyers
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
  if (page === 'directory') renderListings();
  if (page === 'events') renderEvents();
  if (page === 'education') renderEducation();
}

document.addEventListener('DOMContentLoaded', () => {
  initReveals();
  initSmoothScroll();
  const page = document.body.dataset.page;
  initAddressBuilder();
  if (page === 'directory' || page === 'submit-listing') initDirectoryPage();
  if (page === 'events' || page === 'submit-event') initEventsPage();
  if (page === 'newsletter') initNewsletterPage();
  if (page === 'education') initEducationPage();
  if (page === 'update-request') initUpdateRequestPage();

  loadInitialData();
});

document.addEventListener('click', function(e) {
  const link = e.target.closest('a');
  if (!link) return;

  const text = (link.textContent || '').trim().slice(0, 80);
  const href = link.getAttribute('href') || '';

  if (
    href.includes('/directory/') ||
    href.includes('/events/') ||
    href.includes('/submit-listing/') ||
    href.includes('/submit-listing/') ||
    href.includes('/submit-event/') ||
    href.includes('/education/') ||
    href.includes('/newsletter/')
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

// ============================================
// CARD VIEW TOGGLES + PAGINATION + EDUCATION POLISH
// Added May 2026: lets users switch listings/events between list and grid cards,
// limits each public collection to 20 cards per page, and gives education cards
// a blog-style presentation without changing the spreadsheet backend.
// ============================================
const HERBTROPIA_PAGE_SIZE = 20;
const HERBTROPIA_VIEW_KEY_PREFIX = 'herbtropia_view_mode_';
const herbtropiaPageState = { listing: 1, event: 1, education: 1 };
const herbtropiaLastFilterSignature = { listing: '', event: '', education: '' };

function getViewMode(scope) {
  try {
    return localStorage.getItem(`${HERBTROPIA_VIEW_KEY_PREFIX}${scope}`) || (scope === 'education' ? 'grid' : 'list');
  } catch (error) {
    return scope === 'education' ? 'grid' : 'list';
  }
}

function setViewMode(scope, mode) {
  const safeMode = mode === 'grid' ? 'grid' : 'list';
  try {
    localStorage.setItem(`${HERBTROPIA_VIEW_KEY_PREFIX}${scope}`, safeMode);
  } catch (error) {
    console.warn('Could not save Herbtropia view mode.', error);
  }
  if (scope === 'listing') renderListings();
  if (scope === 'event') renderEvents();
  if (scope === 'education') renderEducation();
}

function getFilterSignature(scope) {
  const searchId = scope === 'listing' ? 'listingSearch' : scope === 'event' ? 'eventSearch' : 'educationSearch';
  const searchValue = String(document.getElementById(searchId)?.value || '').trim().toLowerCase();
  const checked = Array.from(document.querySelectorAll(`input[data-${scope}-filter]:checked`))
    .map(input => `${input.getAttribute(`data-${scope}-filter`)}:${input.value}`)
    .sort();
  return JSON.stringify({ searchValue, checked });
}

function getPagedItems(scope, items) {
  const currentSignature = getFilterSignature(scope);
  if (herbtropiaLastFilterSignature[scope] !== currentSignature) {
    herbtropiaPageState[scope] = 1;
    herbtropiaLastFilterSignature[scope] = currentSignature;
  }

  const totalPages = Math.max(1, Math.ceil(items.length / HERBTROPIA_PAGE_SIZE));
  herbtropiaPageState[scope] = Math.min(Math.max(1, herbtropiaPageState[scope] || 1), totalPages);
  const page = herbtropiaPageState[scope];
  const start = (page - 1) * HERBTROPIA_PAGE_SIZE;
  return {
    page,
    totalPages,
    start,
    end: Math.min(items.length, start + HERBTROPIA_PAGE_SIZE),
    total: items.length,
    items: items.slice(start, start + HERBTROPIA_PAGE_SIZE)
  };
}

function renderCollectionControls(scope, grid, paged, options = {}) {
  if (!grid || !grid.parentElement) return;
  const parent = grid.parentElement;
  const label = options.label || 'items';
  const showViewToggle = options.showViewToggle !== false;
  const currentView = getViewMode(scope);
  const beforeId = `${scope}CollectionControls`;
  const afterId = `${scope}PaginationControls`;

  let controls = document.getElementById(beforeId);
  if (!controls) {
    controls = document.createElement('div');
    controls.id = beforeId;
    controls.className = 'collection-controls';
    parent.insertBefore(controls, grid);
  }

  const rangeText = paged.total
    ? `Showing ${paged.start + 1}–${paged.end} of ${paged.total} ${label}`
    : `No ${label} found`;

  controls.innerHTML = `
    <div class="collection-status">${escapeHTML(rangeText)}</div>
    ${showViewToggle ? `
      <div class="view-toggle" aria-label="Choose card layout">
        <button type="button" class="view-toggle-btn ${currentView === 'list' ? 'active' : ''}" data-view-scope="${escapeHTML(scope)}" data-view-mode="list" aria-pressed="${currentView === 'list'}">List</button>
        <button type="button" class="view-toggle-btn ${currentView === 'grid' ? 'active' : ''}" data-view-scope="${escapeHTML(scope)}" data-view-mode="grid" aria-pressed="${currentView === 'grid'}">Grid</button>
      </div>
    ` : ''}
  `;

  controls.querySelectorAll('[data-view-scope]').forEach(button => {
    button.addEventListener('click', () => setViewMode(button.dataset.viewScope, button.dataset.viewMode));
  });

  let pagination = document.getElementById(afterId);
  if (!pagination) {
    pagination = document.createElement('div');
    pagination.id = afterId;
    pagination.className = 'pagination-controls';
    parent.insertBefore(pagination, grid.nextSibling);
  }

  if (paged.totalPages <= 1) {
    pagination.innerHTML = '';
    pagination.style.display = 'none';
    return;
  }

  pagination.style.display = 'flex';
  const pageButtons = [];
  for (let i = 1; i <= paged.totalPages; i += 1) {
    if (i === 1 || i === paged.totalPages || Math.abs(i - paged.page) <= 1) {
      pageButtons.push(`<button type="button" class="page-number ${i === paged.page ? 'active' : ''}" data-page-scope="${escapeHTML(scope)}" data-page-number="${i}" aria-label="Go to page ${i}" aria-current="${i === paged.page ? 'page' : 'false'}">${i}</button>`);
    } else if (!pageButtons[pageButtons.length - 1]?.includes('page-ellipsis')) {
      pageButtons.push('<span class="page-ellipsis">…</span>');
    }
  }

  pagination.innerHTML = `
    <button type="button" class="page-step" data-page-scope="${escapeHTML(scope)}" data-page-number="${Math.max(1, paged.page - 1)}" ${paged.page === 1 ? 'disabled' : ''}>← Previous</button>
    <div class="page-number-group">${pageButtons.join('')}</div>
    <button type="button" class="page-step" data-page-scope="${escapeHTML(scope)}" data-page-number="${Math.min(paged.totalPages, paged.page + 1)}" ${paged.page === paged.totalPages ? 'disabled' : ''}>Next →</button>
  `;

  pagination.querySelectorAll('[data-page-scope]').forEach(button => {
    button.addEventListener('click', () => {
      const nextPage = Number(button.dataset.pageNumber || 1);
      herbtropiaPageState[scope] = nextPage;
      if (scope === 'listing') renderListings();
      if (scope === 'event') renderEvents();
      if (scope === 'education') renderEducation();
      const target = document.querySelector('.search-panel') || grid;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function parseDateForSort(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0).getTime();
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime();
}

function timeForSort(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return (Number(match[1]) * 60) + Number(match[2]);
}

function sortEventsByDate(a, b) {
  const dateDiff = parseDateForSort(a.eventDate) - parseDateForSort(b.eventDate);
  if (dateDiff !== 0) return dateDiff;
  return timeForSort(a.startTime) - timeForSort(b.startTime);
}

function getEventMonthLabel(event) {
  const raw = String(event.eventDate || '').trim();
  let date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    date = new Date(year, month - 1, day, 12, 0, 0);
  } else {
    date = new Date(raw);
  }
  if (!date || Number.isNaN(date.getTime())) return 'Date TBD';
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function renderEventsWithMonthGroups(events) {
  let lastMonth = '';
  return events.map(event => {
    const month = getEventMonthLabel(event);
    const header = month !== lastMonth ? `<div class="event-month-heading"><span>${escapeHTML(month)}</span></div>` : '';
    lastMonth = month;
    return `${header}${renderEventCard(event)}`;
  }).join('');
}

function renderListings() {
  const grid = document.getElementById('listingGrid');
  const empty = document.getElementById('listingEmpty');
  const count = document.getElementById('listingCount');
  if (!grid) return;
  updateFilterBadge('listing');
  const matches = state.listings.filter(listingMatches);
  const paged = getPagedItems('listing', matches);
  const viewMode = getViewMode('listing');

  grid.classList.remove('card-view-list', 'card-view-grid');
  grid.classList.add(`card-view-${viewMode}`);
  grid.innerHTML = paged.items.map(renderListingCard).join('');

  renderCollectionControls('listing', grid, paged, { label: `listing${matches.length === 1 ? '' : 's'}`, showViewToggle: true });
  if (count) count.textContent = `${matches.length} listing${matches.length === 1 ? '' : 's'} showing`;
  if (empty) empty.style.display = matches.length ? 'none' : 'block';
  grid.style.display = matches.length ? 'grid' : 'none';
  grid.querySelectorAll('[data-open-listing]').forEach(btn => {
    btn.addEventListener('click', () => openListingModal(btn.dataset.openListing));
  });
}

function renderEvents() {
  const grid = document.getElementById('eventGrid');
  const empty = document.getElementById('eventEmpty');
  const count = document.getElementById('eventCount');
  if (!grid) return;
  updateFilterBadge('event');
  const matches = state.events.filter(eventMatches).sort(sortEventsByDate);
  const paged = getPagedItems('event', matches);
  const viewMode = getViewMode('event');

  grid.classList.remove('card-view-list', 'card-view-grid');
  grid.classList.add(`card-view-${viewMode}`);
  grid.innerHTML = renderEventsWithMonthGroups(paged.items);

  renderCollectionControls('event', grid, paged, { label: `event${matches.length === 1 ? '' : 's'}`, showViewToggle: true });
  if (count) count.textContent = `${matches.length} event${matches.length === 1 ? '' : 's'} showing`;
  if (empty) empty.style.display = matches.length ? 'none' : 'block';
  grid.style.display = matches.length ? 'grid' : 'none';
  grid.querySelectorAll('[data-open-event]').forEach(btn => {
    btn.addEventListener('click', () => openEventModal(btn.dataset.openEvent));
  });
}

function estimateReadTime(resource) {
  const text = [resource.summary, resource.description, resource.content, resource.body].filter(Boolean).join(' ');
  const words = text.trim() ? text.trim().split(/\s+/).length : 700;
  const minutes = Math.max(2, Math.min(12, Math.round(words / 180)) || 4);
  return `${minutes} min read`;
}

function getEducationAuthor(resource) {
  return resource.authorName || resource.addedBy || resource.sourceName || 'Herbtropia';
}

function renderEducation() {
  const grid = document.getElementById('educationGrid');
  const empty = document.getElementById('educationEmpty');
  const count = document.getElementById('educationCount');
  if (!grid) return;
  const matches = state.education.filter(educationMatches);
  const paged = getPagedItems('education', matches);

  grid.classList.remove('card-view-list');
  grid.classList.add('card-view-grid', 'education-blog-grid');
  grid.innerHTML = paged.items.map(renderEducationCard).join('');

  renderCollectionControls('education', grid, paged, { label: `resource${matches.length === 1 ? '' : 's'}`, showViewToggle: false });
  if (count) count.textContent = `${matches.length} resource${matches.length === 1 ? '' : 's'} showing`;
  if (empty) empty.style.display = matches.length ? 'none' : 'block';
  grid.style.display = matches.length ? 'grid' : 'none';
}

function renderEducationCard(resource) {
  const topic = displayLabels(resource.topic, EDUCATION_TOPIC_LABELS) || 'Education';
  const type = displayLabels(resource.resourceType, RESOURCE_TYPE_LABELS) || 'Resource';
  const level = displayLabels(resource.level, LEVEL_LABELS) || 'All Levels';
  const url = normalizeUrl(resource.resourceUrl);
  const title = resource.title || 'Untitled resource';
  const summary = String(resource.summary || 'Curated wellness education resource.').trim();
  const author = getEducationAuthor(resource);
  const readTime = resource.readTime || estimateReadTime(resource);
  const sourceLine = [author, resource.sourceName && resource.sourceName !== author ? resource.sourceName : '', level].filter(Boolean).join(' • ');
  const imageUrl = resource.imageUrl || resource.photoUrl || resource.coverImageUrl || '';
  const visual = imageUrl
    ? `<img src="${escapeHTML(normalizeUrl(imageUrl))}" alt="${escapeHTML(title)}">`
    : '<span class="education-leaf">⌁</span>';

  return `<article class="education-card blog-card">
    <a class="education-card-visual" ${url ? `href="${escapeHTML(url)}" target="_blank" rel="noopener"` : ''} aria-label="Open ${escapeHTML(title)}">
      ${visual}
    </a>
    <div class="education-card-body">
      <div class="education-card-meta-row">
        <span class="education-topic">${escapeHTML(topic)}</span>
        <span class="education-read-time">${escapeHTML(readTime)}</span>
      </div>
      <h3>${url ? `<a class="card-title-btn" href="${escapeHTML(url)}" target="_blank" rel="noopener">${escapeHTML(title)}</a>` : escapeHTML(title)}</h3>
      <p class="card-desc">${escapeHTML(summary).slice(0, 190)}${summary.length > 190 ? '…' : ''}</p>
      <div class="education-card-footer">
        <span>${escapeHTML(sourceLine)}</span>
        ${url ? `<a class="education-read-link" href="${escapeHTML(url)}" target="_blank" rel="noopener">Open →</a>` : `<span class="education-read-link muted">${escapeHTML(type)}</span>`}
      </div>
    </div>
  </article>`;
}

// ============================================
// EDUCATION PAGE VIEW TOGGLE + AUTHOR PLACEMENT
// Final override: gives Education the same List/Grid choice and moves author/source
// directly under the article title.
// ============================================
function getEducationAuthor(resource) {
  return resource.authorName || resource.author || resource.byline || resource.sourceName || resource.addedBy || 'Herbtropia';
}

function renderEducation() {
  const grid = document.getElementById('educationGrid');
  const empty = document.getElementById('educationEmpty');
  const count = document.getElementById('educationCount');
  if (!grid) return;

  const matches = state.education.filter(educationMatches);
  const paged = getPagedItems('education', matches);
  const viewMode = getViewMode('education');

  grid.classList.remove('card-view-list', 'card-view-grid', 'education-blog-grid', 'education-card-view-list', 'education-card-view-grid');
  grid.classList.add(`card-view-${viewMode}`, `education-card-view-${viewMode}`);
  grid.innerHTML = paged.items.map(renderEducationCard).join('');

  renderCollectionControls('education', grid, paged, {
    label: `resource${matches.length === 1 ? '' : 's'}`,
    showViewToggle: true
  });

  if (count) count.textContent = `${matches.length} resource${matches.length === 1 ? '' : 's'} showing`;
  if (empty) empty.style.display = matches.length ? 'none' : 'block';
  grid.style.display = matches.length ? 'grid' : 'none';
}

function renderEducationCard(resource) {
  const topic = displayLabels(resource.topic, EDUCATION_TOPIC_LABELS) || 'Education';
  const type = displayLabels(resource.resourceType, RESOURCE_TYPE_LABELS) || 'Resource';
  const level = displayLabels(resource.level, LEVEL_LABELS) || 'All Levels';
  const url = normalizeUrl(resource.resourceUrl || resource.url || resource.link || '');
  const title = resource.title || 'Untitled resource';
  const summary = String(resource.summary || resource.description || 'Curated wellness education resource.').trim();
  const author = getEducationAuthor(resource);
  const readTime = resource.readTime || estimateReadTime(resource);
  const sourceName = resource.sourceName || '';
  const imageUrl = resource.imageUrl || resource.photoUrl || resource.coverImageUrl || '';
  const visual = imageUrl
    ? `<img src="${escapeHTML(normalizeUrl(imageUrl))}" alt="${escapeHTML(title)}">`
    : '<span class="education-leaf">⌁</span>';
  const sourceMeta = [sourceName && sourceName !== author ? sourceName : '', level, type].filter(Boolean).join(' • ');

  return `<article class="education-card blog-card">
    <a class="education-card-visual" ${url ? `href="${escapeHTML(url)}" target="_blank" rel="noopener"` : ''} aria-label="Open ${escapeHTML(title)}">
      ${visual}
    </a>
    <div class="education-card-body">
      <div class="education-card-meta-row">
        <span class="education-topic">${escapeHTML(topic)}</span>
        <span class="education-read-time">${escapeHTML(readTime)}</span>
      </div>
      <h3>${url ? `<a class="card-title-btn" href="${escapeHTML(url)}" target="_blank" rel="noopener">${escapeHTML(title)}</a>` : escapeHTML(title)}</h3>
      <div class="education-author-line">${escapeHTML(author)}</div>
      ${sourceMeta ? `<div class="education-source-line">${escapeHTML(sourceMeta)}</div>` : ''}
      <p class="card-desc">${escapeHTML(summary).slice(0, 210)}${summary.length > 210 ? '…' : ''}</p>
      <div class="education-card-footer">
        <span>${escapeHTML(type)}</span>
        ${url ? `<a class="education-read-link" href="${escapeHTML(url)}" target="_blank" rel="noopener">Open →</a>` : `<span class="education-read-link muted">No link yet</span>`}
      </div>
    </div>
  </article>`;
}

// ============================================
// EDUCATION PAGE — RESOURCE TYPE GROUPS + TYPE-SPECIFIC CARDS
// Final override: groups visible resources by type like Events groups by month,
// while keeping the same List/Grid toggle and accessible card structure.
// ============================================
const EDUCATION_RESOURCE_TYPE_ORDER = {
  article: 1,
  guide: 2,
  video: 3,
  podcast: 4,
  research: 5,
  tool: 6,
  book: 7,
  other: 98,
  resource: 99
};

const EDUCATION_RESOURCE_TYPE_HEADINGS = {
  article: 'Articles',
  guide: 'Guides',
  video: 'Videos',
  podcast: 'Podcasts',
  research: 'Research',
  tool: 'Tools',
  book: 'Books',
  other: 'Other Resources',
  resource: 'Resources'
};

const EDUCATION_RESOURCE_TYPE_ICONS = {
  article: 'Article',
  guide: 'Guide',
  video: '▶ Video',
  podcast: 'Audio',
  research: 'Study',
  tool: 'Tool',
  book: 'Book',
  other: 'Resource',
  resource: 'Resource'
};

function getEducationResourceTypeKey(resource) {
  const raw = splitTags(resource.resourceType || resource.type || 'resource')[0] || 'resource';
  const key = slugify(raw);
  if (EDUCATION_RESOURCE_TYPE_ORDER[key]) return key;
  if (key.includes('video')) return 'video';
  if (key.includes('podcast') || key.includes('audio')) return 'podcast';
  if (key.includes('book')) return 'book';
  if (key.includes('research') || key.includes('study')) return 'research';
  if (key.includes('guide')) return 'guide';
  if (key.includes('tool')) return 'tool';
  if (key.includes('article') || key.includes('blog')) return 'article';
  return key || 'resource';
}

function getEducationResourceTypeLabel(resource) {
  const key = getEducationResourceTypeKey(resource);
  return displayLabels(resource.resourceType, RESOURCE_TYPE_LABELS) || EDUCATION_RESOURCE_TYPE_HEADINGS[key]?.replace(/s$/, '') || labelizeSlug(key) || 'Resource';
}

function getEducationResourceTypeHeading(resource) {
  const key = getEducationResourceTypeKey(resource);
  return EDUCATION_RESOURCE_TYPE_HEADINGS[key] || `${labelizeSlug(key)} Resources`;
}

function getEducationPublishedTime(resource) {
  const raw = resource.publishedAt || resource.date || resource.createdAt || resource.submittedAt || '';
  const time = parseDateForSort(raw);
  return Number.isFinite(time) ? time : 0;
}

function sortEducationResources(a, b) {
  const typeA = getEducationResourceTypeKey(a);
  const typeB = getEducationResourceTypeKey(b);
  const orderDiff = (EDUCATION_RESOURCE_TYPE_ORDER[typeA] || 90) - (EDUCATION_RESOURCE_TYPE_ORDER[typeB] || 90);
  if (orderDiff !== 0) return orderDiff;

  const featuredA = /^(yes|true|featured)$/i.test(String(a.featured || '').trim()) ? 1 : 0;
  const featuredB = /^(yes|true|featured)$/i.test(String(b.featured || '').trim()) ? 1 : 0;
  if (featuredA !== featuredB) return featuredB - featuredA;

  const dateDiff = getEducationPublishedTime(b) - getEducationPublishedTime(a);
  if (dateDiff !== 0) return dateDiff;

  return String(a.title || '').localeCompare(String(b.title || ''));
}

function renderEducationWithTypeGroups(resources) {
  let lastType = '';
  return resources.map(resource => {
    const typeKey = getEducationResourceTypeKey(resource);
    const heading = getEducationResourceTypeHeading(resource);
    const header = typeKey !== lastType
      ? `<div class="education-type-heading education-type-heading-${escapeHTML(typeKey)}"><span>${escapeHTML(heading)}</span></div>`
      : '';
    lastType = typeKey;
    return `${header}${renderEducationCard(resource)}`;
  }).join('');
}

function renderEducation() {
  const grid = document.getElementById('educationGrid');
  const empty = document.getElementById('educationEmpty');
  const count = document.getElementById('educationCount');
  if (!grid) return;

  const matches = state.education.filter(educationMatches).sort(sortEducationResources);
  const paged = getPagedItems('education', matches);
  const viewMode = getViewMode('education');

  grid.classList.remove('card-view-list', 'card-view-grid', 'education-blog-grid', 'education-card-view-list', 'education-card-view-grid');
  grid.classList.add(`card-view-${viewMode}`, `education-card-view-${viewMode}`);
  grid.innerHTML = renderEducationWithTypeGroups(paged.items);

  renderCollectionControls('education', grid, paged, {
    label: `resource${matches.length === 1 ? '' : 's'}`,
    showViewToggle: true
  });

  if (count) count.textContent = `${matches.length} resource${matches.length === 1 ? '' : 's'} showing`;
  if (empty) empty.style.display = matches.length ? 'none' : 'block';
  grid.style.display = matches.length ? 'grid' : 'none';
}

function renderEducationCard(resource) {
  const topic = displayLabels(resource.topic, EDUCATION_TOPIC_LABELS) || 'Education';
  const typeKey = getEducationResourceTypeKey(resource);
  const type = getEducationResourceTypeLabel(resource);
  const level = displayLabels(resource.level, LEVEL_LABELS) || 'All Levels';
  const url = normalizeUrl(resource.resourceUrl || resource.url || resource.link || '');
  const title = resource.title || 'Untitled resource';
  const summary = String(resource.summary || resource.description || 'Curated wellness education resource.').trim();
  const author = getEducationAuthor(resource);
  const readTime = resource.readTime || estimateReadTime(resource);
  const sourceName = resource.sourceName || '';
  const imageUrl = resource.imageUrl || resource.photoUrl || resource.coverImageUrl || '';
  const imageAlt = resource.imageAlt || title;
  const typeMarker = EDUCATION_RESOURCE_TYPE_ICONS[typeKey] || type;
  const visual = imageUrl
    ? `<img src="${escapeHTML(normalizeUrl(imageUrl))}" alt="${escapeHTML(imageAlt)}">`
    : '<span class="education-leaf">⌁</span>';
  const sourceMeta = [sourceName && sourceName !== author ? sourceName : '', level].filter(Boolean).join(' • ');

  return `<article class="education-card blog-card education-card-type-${escapeHTML(typeKey)}">
    <a class="education-card-visual" ${url ? `href="${escapeHTML(url)}" target="_blank" rel="noopener"` : ''} aria-label="Open ${escapeHTML(title)}">
      ${visual}
      <span class="education-type-mark" aria-hidden="true">${escapeHTML(typeMarker)}</span>
    </a>
    <div class="education-card-body">
      <div class="education-card-meta-row">
        <span class="education-topic">${escapeHTML(topic)}</span>
        <span class="education-read-time">${escapeHTML(readTime)}</span>
      </div>
      <h3>${url ? `<a class="card-title-btn" href="${escapeHTML(url)}" target="_blank" rel="noopener">${escapeHTML(title)}</a>` : escapeHTML(title)}</h3>
      <div class="education-author-line">${escapeHTML(author)}</div>
      ${sourceMeta ? `<div class="education-source-line">${escapeHTML(sourceMeta)}</div>` : ''}
      <p class="card-desc">${escapeHTML(summary).slice(0, 210)}${summary.length > 210 ? '…' : ''}</p>
      <div class="education-card-footer">
        <span class="education-card-type-label">${escapeHTML(type)}</span>
        ${url ? `<a class="education-read-link" href="${escapeHTML(url)}" target="_blank" rel="noopener">Open →</a>` : `<span class="education-read-link muted">No link yet</span>`}
      </div>
    </div>
  </article>`;
}
