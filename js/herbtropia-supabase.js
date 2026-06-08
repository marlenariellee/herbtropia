// ============================================
// HERBTROPIA — Supabase Auth + Account Dashboard
// Drop-in replacement for /js/herbtropia-supabase.js
// ============================================
// What this does:
// - Handles magic-link login
// - Creates/updates the Supabase profiles row after confirmation
// - Renders /account/ so it does not stay stuck on "Loading account..."
// - Sends role-based account welcome data to Apps Script AFTER a confirmed session exists
// - Keeps marketing/newsletter opt-in separate from transactional account welcome emails

(function () {
  const PROFILE_STORAGE_KEY = 'herbtropia_pending_account_profile_v1';
  const ACCOUNT_WELCOME_SENT_PREFIX = 'herbtropia_account_welcome_sent_';
  const FAVORITES_STORAGE_KEY = 'herbtropia_saved_items_v1';
  const WELLNESS_MATCH_STORAGE_KEY = 'herbtropia_wellness_match';

  let client = null;

  function clean(value) {
    return String(value || '').trim();
  }

  function page() {
    const explicit = document.body?.dataset?.page || '';
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    if (explicit && explicit !== 'home') return explicit;
    if (path === '/login') return 'login';
    if (path === '/account') return 'account';
    if (path === '/practitioner-onboarding') return 'practitioner-onboarding';
    return explicit || '';
  }

  function isEnabled() {
    return window.HERBTROPIA_SUPABASE_ENABLED === true || window.HERBTROPIA_SUPABASE_ENABLED === 'true';
  }

  function getConfig() {
    return {
      enabled: isEnabled(),
      url: clean(window.HERBTROPIA_SUPABASE_URL).replace(/\/$/, ''),
      anonKey: clean(window.HERBTROPIA_SUPABASE_ANON_KEY)
    };
  }

  function validateConfig() {
    const config = getConfig();

    if (!config.enabled) {
      return { ok: false, message: 'Your account system is not configured yet. In /js/supabase-config.js, set HERBTROPIA_SUPABASE_ENABLED to true.' };
    }

    if (!config.url || !/^https:\/\/.+\.supabase\.co$/i.test(config.url)) {
      return { ok: false, message: 'Your Supabase URL is missing or malformed. It should look like https://your-project-ref.supabase.co' };
    }

    if (!config.anonKey || config.anonKey.length < 80) {
      return { ok: false, message: 'Your Supabase anon public key is missing or too short. Use the anon public key, not the service_role key.' };
    }

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      return { ok: false, message: 'The Supabase browser library did not load. Make sure the CDN script loads before /js/herbtropia-supabase.js.' };
    }

    return { ok: true, config };
  }

  function getClient() {
    if (client) return client;

    const validation = validateConfig();
    if (!validation.ok) throw new Error(validation.message);

    client = window.supabase.createClient(validation.config.url, validation.config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    });

    return client;
  }

  function statusEl() {
    return document.querySelector('[data-auth-status], #authMessage, #loginStatus, #accountAuthStatus, #supabaseStatus, [data-account-status]');
  }

  function setStatus(message, type = 'info') {
    const el = statusEl();
    if (!el) return;
    el.textContent = message || '';
    el.classList.remove('success', 'error', 'info');
    el.classList.add(type);
    el.style.display = message ? 'block' : 'none';
  }

  function setAccountStatus(message, type = 'info') {
    const el = document.querySelector('[data-account-status]');
    if (!el) return;
    el.textContent = message || '';
    el.classList.remove('success', 'error', 'info');
    el.classList.add(type);
    el.style.display = message ? 'block' : 'none';
  }

  function findField(form, selectors) {
    for (const selector of selectors) {
      const field = form?.querySelector(selector) || document.querySelector(selector);
      if (field) return field;
    }
    return null;
  }

  function getLoginForm() {
    return document.querySelector('#accountLoginForm, #loginForm, #magicLinkForm, form[data-auth-form]') ||
      (page() === 'login' ? document.querySelector('form') : null);
  }

  function readLoginForm(form) {
    const firstName = findField(form, ['[name="firstName"]', '#firstName', '#loginFirstName']);
    const lastName = findField(form, ['[name="lastName"]', '#lastName', '#loginLastName']);
    const email = findField(form, ['[name="email"]', '#email', '#loginEmail']);
    const accountType = findField(form, ['[name="accountType"]', '#accountType', '#loginAccountType']);
    const marketingOptIn = findField(form, ['[name="marketingOptIn"]', '[name="newsletterOptIn"]', '#marketingOptIn', '#newsletterOptIn', '[data-marketing-opt-in]']);

    return {
      firstName: clean(firstName?.value),
      lastName: clean(lastName?.value),
      email: clean(email?.value).toLowerCase(),
      accountType: clean(accountType?.value || 'wellness-seeker'),
      marketingOptIn: Boolean(marketingOptIn?.checked)
    };
  }

  function normalizeRole(accountType) {
    const value = clean(accountType).toLowerCase();
    if (value.includes('practitioner') || value.includes('provider') || value.includes('business')) return 'practitioner';
    return 'seeker';
  }

  function roleLabel(role) {
    return role === 'practitioner' ? 'Practitioner / Wellness Business' : 'Wellness Seeker';
  }

  function accountWelcomeTemplateKey(role) {
    return role === 'practitioner' ? 'ACCOUNT_WELCOME_PRACTITIONER' : 'ACCOUNT_WELCOME_SEEKER';
  }

  function savePendingProfile(profile) {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch (error) {
      console.warn('Could not save pending Herbtropia profile locally.', error);
    }
  }

  function getPendingProfile() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || 'null');
    } catch (error) {
      return null;
    }
  }

  function clearPendingProfile() {
    try {
      localStorage.removeItem(PROFILE_STORAGE_KEY);
    } catch (error) {}
  }

  function parseJSONStorage(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function humanAuthError(error) {
    const raw = error?.message || String(error || 'Unknown error');

    if (/failed to fetch/i.test(raw)) {
      return 'Failed to reach Supabase. Recheck the Project URL and anon public key in /js/supabase-config.js and make sure requests to supabase.co are not blocked.';
    }

    if (/invalid api key|jwt|apikey/i.test(raw)) {
      return 'Supabase rejected the key. Re-copy the anon public key from Supabase → Project Settings → API. Do not use the service_role key.';
    }

    if (/redirect/i.test(raw)) {
      return 'Supabase did not accept the redirect URL. Add http://127.0.0.1:5500/account/ and http://localhost:5500/account/ in Supabase Auth URL Configuration.';
    }

    return raw;
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonHTML = submitButton ? submitButton.innerHTML : '';

    try {
      const validation = validateConfig();
      if (!validation.ok) throw new Error(validation.message);

      const profile = readLoginForm(form);
      profile.role = normalizeRole(profile.accountType);

      if (!profile.email) throw new Error('Please enter your email address.');
      if (!/^\S+@\S+\.\S+$/.test(profile.email)) throw new Error('Please enter a valid email address.');

      savePendingProfile(profile);
      setStatus('Sending your secure login link...', 'info');

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = 'Sending...';
      }

      const sb = getClient();
      const redirectTo = `${window.location.origin}/account/`;

const authMode = form.dataset.authMode || document.body.dataset.page || 'login';
const isSignup = authMode === 'signup';

const signInOptions = {
  emailRedirectTo: `${window.location.origin}/account/`,
  shouldCreateUser: isSignup
};

if (isSignup) {
  signInOptions.data = {
    first_name: firstName || '',
    last_name: lastName || '',
    account_role: role || 'user',
    newsletter_opt_in: newsletterOptIn === true || newsletterOptIn === 'yes'
  };
}

const { error } = await supabase.auth.signInWithOtp({
  email,
  options: signInOptions
});

      if (error) throw error;

      setStatus('Magic link sent. Check your email, then open the link to access your Herbtropia account.', 'success');
    } catch (error) {
      console.error('Herbtropia login error:', error);
      setStatus(humanAuthError(error), 'error');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonHTML;
      }
    }
  }

  function initLoginPage() {
    const form = getLoginForm();
    if (!form) return;

    const validation = validateConfig();
    if (!validation.ok) {
      setStatus(validation.message, 'error');
      return;
    }

    if (form.dataset.herbtropiaAuthReady === 'true') return;
    form.dataset.herbtropiaAuthReady = 'true';
    form.addEventListener('submit', handleLoginSubmit);
    setStatus('', 'info');
  }

  async function getActiveSessionAndUser() {
    const sb = getClient();

    // Give detectSessionInUrl/PKCE a moment to process confirmation links on /account/.
    let { data: sessionData, error: sessionError } = await sb.auth.getSession();

    if (sessionError) {
      console.warn('Supabase getSession error:', sessionError);
    }

    let session = sessionData?.session || null;

    if (!session) {
      await new Promise(resolve => setTimeout(resolve, 350));
      const retry = await sb.auth.getSession();
      session = retry.data?.session || null;
    }

    if (session?.user) return { session, user: session.user };

    const { data: userData, error: userError } = await sb.auth.getUser();
    if (userError) {
      console.warn('Supabase getUser error:', userError);
    }

    return { session, user: userData?.user || null };
  }

  function profileFromUserAndPending(user, pending) {
    const metadata = user?.user_metadata || {};
    const firstName = pending?.firstName || metadata.first_name || '';
    const lastName = pending?.lastName || metadata.last_name || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || metadata.full_name || user?.email || '';
    const accountType = pending?.accountType || metadata.account_type || 'wellness-seeker';
    const role = pending?.role || metadata.role || normalizeRole(accountType);

    return {
      id: user.id,
      email: user.email,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      account_type: accountType,
      role,
      marketing_opt_in: Boolean(pending?.marketingOptIn || metadata.marketing_opt_in),
      updated_at: new Date().toISOString()
    };
  }

  async function upsertAndLoadProfile(user, pending) {
    const fallback = profileFromUserAndPending(user, pending);
    const sb = getClient();

    try {
      await sb.from('profiles').upsert(fallback, { onConflict: 'id' });

      const { data, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.warn('Could not load Herbtropia profile row:', error);
        return fallback;
      }

      return data || fallback;
    } catch (error) {
      console.warn('Could not upsert Herbtropia profile. Check Supabase profiles table/RLS policies.', error);
      return fallback;
    }
  }

  async function sendAccountWelcomeAfterConfirmation(user, profile, pending) {
    if (!user?.id || !profile?.email) return;

    const params = new URLSearchParams(window.location.search);
    const forceResend = params.get('resendWelcome') === '1';
    const sentKey = `${ACCOUNT_WELCOME_SENT_PREFIX}${user.id}`;

    if (!forceResend && localStorage.getItem(sentKey)) return;
    if (typeof window.submitToBackend !== 'function') return;

    const role = profile.role || normalizeRole(profile.account_type);
    const firstName = profile.first_name || pending?.firstName || '';
    const lastName = profile.last_name || pending?.lastName || '';
    const fullName = profile.full_name || [firstName, lastName].filter(Boolean).join(' ') || profile.email;

    try {
      await window.submitToBackend({
        type: 'account-signup',
        id: `account-${user.id}`,
        authUserId: user.id,
        source: 'Supabase Confirmed Account',
        status: 'Confirmed',
        email: profile.email,
        firstName,
        lastName,
        name: fullName,
        accountType: profile.account_type || roleLabel(role),
        accountRole: role,
        role,
        marketingOptIn: profile.marketing_opt_in ? 'yes' : 'no',
        welcomeTemplateKey: accountWelcomeTemplateKey(role),
        confirmedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });

      localStorage.setItem(sentKey, new Date().toISOString());
    } catch (error) {
      console.warn('Could not send account welcome payload to Apps Script.', error);
    }
  }

  function renderQuizSummary(container) {
    if (!container) return;
    const result = parseJSONStorage(WELLNESS_MATCH_STORAGE_KEY, null);
    if (!result || !result.condition) {
      container.innerHTML = '<p>You have not taken the Wellness Match Quiz yet.</p><a class="card-action" href="/wellness-match/">Take the Quiz</a>';
      return;
    }

    const label = (window.WELLNESS_CONDITION_LABELS && window.WELLNESS_CONDITION_LABELS[result.condition]) ||
      String(result.condition || '').replace(/-/g, ' ');

    container.innerHTML = `
      <div class="saved-quiz-card">
        <h3>${escapeHtml(label)}</h3>
        <p>Your current Wellness Match result is saved on this browser.</p>
        <div class="card-actions">
          <a class="card-action" href="/recommended/?condition=${encodeURIComponent(result.condition)}">View Recommendations</a>
          <a class="card-action secondary" href="/wellness-match/">Retake Quiz</a>
        </div>
      </div>
    `;
  }

  function renderFavorites(container) {
    if (!container) return;
    const items = parseJSONStorage(FAVORITES_STORAGE_KEY, []);
    if (!items.length) {
      container.innerHTML = '<p>No saved Herbtropia finds yet.</p><a class="card-action" href="/directory/">Browse Directory</a>';
      return;
    }

    container.innerHTML = `
      <div class="saved-card-grid">
        ${items.slice(0, 12).map(item => `
          <article class="saved-item-card">
            <span class="card-badge">${escapeHtml(item.type || 'saved')}</span>
            <h3>${escapeHtml(item.title || 'Saved item')}</h3>
            ${item.meta ? `<div class="card-meta">${escapeHtml(item.meta)}</div>` : ''}
            <div class="card-actions">
              ${item.url ? `<a class="card-action secondary" href="${escapeHtml(item.url)}">Open</a>` : ''}
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  function renderPractitionerTools(container, profile) {
    if (!container) return;
    container.innerHTML = `
      <p>Use this area to start or manage your Herbtropia provider presence.</p>
      <div class="card-actions">
        <a class="card-action" href="/submit-listing/">Submit a Listing</a>
        <a class="card-action secondary" href="/submit-event/">Submit an Event</a>
        <a class="card-action secondary" href="/practitioner-onboarding/">Create Profile Draft</a>
      </div>
      <p class="card-meta">Public listings and events are reviewed before publishing.</p>
    `;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showSignedOut() {
    const signedOut = document.querySelector('[data-account-signed-out]');
    const signedIn = document.querySelector('[data-account-signed-in]');
    if (signedOut) signedOut.style.display = '';
    if (signedIn) signedIn.style.display = 'none';
    setAccountStatus('');
  }

  function showSignedIn(profile) {
    const signedOut = document.querySelector('[data-account-signed-out]');
    const signedIn = document.querySelector('[data-account-signed-in]');
    const displayName = document.querySelector('[data-account-display-name]');
    const email = document.querySelector('[data-account-email]');
    const role = document.querySelector('[data-account-role]');
    const toolsPanel = document.querySelector('[data-practitioner-tools-panel]');

    if (signedOut) signedOut.style.display = 'none';
    if (signedIn) signedIn.style.display = '';
    if (displayName) displayName.textContent = profile.full_name || profile.email || 'Herbtropia Member';
    if (email) email.textContent = profile.email || '';
    if (role) role.textContent = roleLabel(profile.role || normalizeRole(profile.account_type));

    renderQuizSummary(document.querySelector('[data-account-quiz]'));
    renderFavorites(document.querySelector('[data-account-favorites]'));

    const isPractitioner = (profile.role || '').toLowerCase() === 'practitioner';
    if (toolsPanel) toolsPanel.style.display = isPractitioner ? '' : 'none';
    if (isPractitioner) renderPractitionerTools(document.querySelector('[data-practitioner-status]'), profile);

    setAccountStatus('');
  }

  async function initAccountPage() {
    const validation = validateConfig();
    if (!validation.ok) {
      setAccountStatus(validation.message, 'error');
      showSignedOut();
      return;
    }

    setAccountStatus('Loading account...', 'info');

    try {
      const { user } = await getActiveSessionAndUser();

      if (!user) {
        showSignedOut();
        return;
      }

      const pending = getPendingProfile();
      const profile = await upsertAndLoadProfile(user, pending);
      await sendAccountWelcomeAfterConfirmation(user, profile, pending);
      clearPendingProfile();
      showSignedIn(profile);

      const signOutButton = document.querySelector('[data-sign-out]');
      if (signOutButton && signOutButton.dataset.ready !== 'true') {
        signOutButton.dataset.ready = 'true';
        signOutButton.addEventListener('click', async () => {
          await getClient().auth.signOut();
          window.location.href = '/login/';
        });
      }
    } catch (error) {
      console.error('Herbtropia account load error:', error);
      setAccountStatus(humanAuthError(error), 'error');
      showSignedOut();
    }
  }

  async function getUser() {
    const { user } = await getActiveSessionAndUser();
    return user || null;
  }

  window.HerbtropiaSupabase = {
    getClient,
    getUser,
    getPendingProfile,
    clearPendingProfile,
    initAccountPage,
    signOut: async function () {
      await getClient().auth.signOut();
      window.location.href = '/login/';
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (page() === 'login') initLoginPage();
    if (page() === 'account') initAccountPage();
  });
})();
