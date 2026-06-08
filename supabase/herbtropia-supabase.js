/* ============================================
   HERBTROPIA — SUPABASE AUTH HOTFIX
   Replace /js/herbtropia-supabase.js with this file.

   Fixes:
   - Cannot read properties of undefined (reading 'signInWithOtp')
   - /login/ email-only magic link
   - /signup/ create account magic link
   - account page sign out
   - nav state update after sign in / sign out
   ============================================ */

(function () {
  'use strict';

  let client = null;

  function getStatusBox() {
    return document.querySelector('[data-auth-status]');
  }

  function showStatus(message, type = 'info') {
    const box = getStatusBox();
    if (!box) return;
    box.textContent = message || '';
    box.classList.remove('success', 'error', 'info');
    box.classList.add(type);
  }

  function getConfigValue(name) {
    return String(window[name] || '').trim();
  }

  function getSupabaseClient() {
    if (client) return client;

    const enabled = window.HERBTROPIA_SUPABASE_ENABLED !== false;
    const url = getConfigValue('HERBTROPIA_SUPABASE_URL').replace(/\/$/, '');
    const anonKey = getConfigValue('HERBTROPIA_SUPABASE_ANON_KEY');

    if (!enabled) {
      throw new Error('Supabase is disabled in /js/supabase-config.js.');
    }

    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
      throw new Error('Your Supabase URL is missing or malformed. It should look like https://your-project-ref.supabase.co');
    }

    if (!anonKey || anonKey.length < 40) {
      throw new Error('Your Supabase anon public key is missing or malformed.');
    }

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('The Supabase CDN did not load. Check that @supabase/supabase-js is loaded before /js/herbtropia-supabase.js.');
    }

    client = window.supabase.createClient(url, anonKey);
    window.herbtropiaSupabaseClient = client;
    return client;
  }

  function normalizeRole(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw.includes('practitioner') || raw.includes('provider') || raw.includes('business')) return 'practitioner';
    return 'wellness_seeker';
  }

  function getFormValue(formData, names, fallback = '') {
    for (const name of names) {
      const value = formData.get(name);
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return fallback;
  }

  function getNewsletterOptIn(formData) {
    const value = getFormValue(formData, ['newsletterOptIn', 'newsletter_opt_in', 'marketingOptIn', 'updatesOptIn'], '');
    return ['yes', 'true', 'on', '1'].includes(String(value).toLowerCase());
  }

  function setSubmitLoading(form, isLoading) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;

    if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
    button.disabled = isLoading;
    button.innerHTML = isLoading
      ? 'Sending...'
      : button.dataset.originalHtml;
  }

  async function handleMagicLinkSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = getFormValue(formData, ['email']).toLowerCase();

    if (!email) {
      showStatus('Please enter your email address.', 'error');
      return;
    }

    const authMode = form.dataset.authMode || document.body.dataset.page || 'login';
    const isSignup = authMode === 'signup';

    const firstName = getFormValue(formData, ['firstName', 'first_name', 'given_name']);
    const lastName = getFormValue(formData, ['lastName', 'last_name', 'family_name']);
    const role = normalizeRole(getFormValue(formData, ['role', 'accountRole', 'account_role', 'accountType', 'account_type'], 'wellness_seeker'));
    const newsletterOptIn = getNewsletterOptIn(formData);

    setSubmitLoading(form, true);
    showStatus('', 'info');

    try {
      const sb = getSupabaseClient();

      const signInOptions = {
        emailRedirectTo: `${window.location.origin}/account/`,
        shouldCreateUser: isSignup
      };

      if (isSignup) {
        signInOptions.data = {
          first_name: firstName,
          last_name: lastName,
          full_name: [firstName, lastName].filter(Boolean).join(' '),
          account_role: role,
          newsletter_opt_in: newsletterOptIn
        };
      }

      const { error } = await sb.auth.signInWithOtp({
        email,
        options: signInOptions
      });

      if (error) throw error;

      showStatus(
        isSignup
          ? 'Check your email to confirm your Herbtropia account.'
          : 'Check your email for your secure Herbtropia login link.',
        'success'
      );
    } catch (error) {
      console.error('Herbtropia auth error:', error);
      showStatus(error.message || 'Something went wrong sending the magic link.', 'error');
    } finally {
      setSubmitLoading(form, false);
    }
  }

  function getUserDisplayName(user) {
    const meta = user?.user_metadata || {};
    const fullName = meta.full_name || [meta.first_name, meta.last_name].filter(Boolean).join(' ');
    return fullName || user?.email || 'Herbtropia Member';
  }

  function getUserRoleLabel(user) {
    const role = normalizeRole(user?.user_metadata?.account_role || user?.user_metadata?.accountType || 'wellness_seeker');
    return role === 'practitioner' ? 'Practitioner / Wellness Business' : 'Wellness Seeker';
  }

  async function syncAccountWelcomeIfNeeded(user) {
    if (!user || !window.submitToBackend) return;

    const key = `herbtropia_account_synced_${user.id}`;
    if (localStorage.getItem(key) === 'yes') return;

    const meta = user.user_metadata || {};
    const role = normalizeRole(meta.account_role || meta.accountType || 'wellness_seeker');

    try {
      await window.submitToBackend({
        type: 'account-signup',
        id: user.id,
        email: user.email || '',
        firstName: meta.first_name || '',
        lastName: meta.last_name || '',
        name: getUserDisplayName(user),
        accountRole: role,
        accountType: role,
        newsletterOptIn: meta.newsletter_opt_in === true ? 'yes' : 'no',
        welcomeTemplateKey: role === 'practitioner' ? 'ACCOUNT_WELCOME_PRACTITIONER' : 'ACCOUNT_WELCOME_SEEKER',
        createdAt: new Date().toISOString(),
        source: 'Supabase Account Confirmation'
      });
      localStorage.setItem(key, 'yes');
    } catch (error) {
      console.warn('Could not sync account welcome payload yet.', error);
    }
  }

  async function renderAccountPage() {
    const isAccountPage = document.body.dataset.page === 'account' || window.location.pathname.replace(/\/+$/, '') === '/account';
    if (!isAccountPage) return;

    const status = document.querySelector('[data-account-status]');
    const signedOut = document.querySelector('[data-account-signed-out]');
    const signedIn = document.querySelector('[data-account-signed-in]');
    const displayName = document.querySelector('[data-account-display-name]');
    const emailEl = document.querySelector('[data-account-email]');
    const roleEl = document.querySelector('[data-account-role]');
    const practitionerTools = document.querySelector('[data-practitioner-tools]');

    try {
      const sb = getSupabaseClient();
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;

      const session = data?.session || null;
      const user = session?.user || null;

      if (!user) {
        if (status) status.textContent = 'You are not signed in yet.';
        if (signedOut) signedOut.hidden = false;
        if (signedIn) signedIn.hidden = true;
        return;
      }

      if (status) status.textContent = '';
      if (signedOut) signedOut.hidden = true;
      if (signedIn) signedIn.hidden = false;
      if (displayName) displayName.textContent = getUserDisplayName(user);
      if (emailEl) emailEl.textContent = user.email || '';
      if (roleEl) roleEl.textContent = getUserRoleLabel(user);

      const isPractitioner = normalizeRole(user.user_metadata?.account_role || '') === 'practitioner';
      if (practitionerTools) practitionerTools.hidden = !isPractitioner;

      await syncAccountWelcomeIfNeeded(user);

      if (typeof window.HerbtropiaUpdateAuthNavState === 'function') {
        window.HerbtropiaUpdateAuthNavState();
      }
    } catch (error) {
      console.error('Could not render Herbtropia account page:', error);
      if (status) status.textContent = error.message || 'Could not load account.';
    }
  }

  async function signOut() {
    try {
      const sb = getSupabaseClient();
      await sb.auth.signOut();
      if (typeof window.HerbtropiaUpdateAuthNavState === 'function') {
        window.HerbtropiaUpdateAuthNavState();
      }
      window.location.href = '/login/';
    } catch (error) {
      console.error('Could not sign out:', error);
      alert(error.message || 'Could not sign out.');
    }
  }

  function initAuthForms() {
    const form = document.getElementById('magicLinkForm');
    if (form && form.dataset.authReady !== 'true') {
      form.dataset.authReady = 'true';
      form.addEventListener('submit', handleMagicLinkSubmit);
    }

    document.querySelectorAll('[data-sign-out]').forEach((button) => {
      if (button.dataset.signOutReady === 'true') return;
      button.dataset.signOutReady = 'true';
      button.addEventListener('click', signOut);
    });
  }

  window.HerbtropiaSupabase = {
    getClient: getSupabaseClient,
    getUser: async function () {
      const sb = getSupabaseClient();
      const { data, error } = await sb.auth.getUser();
      if (error) return null;
      return data?.user || null;
    },
    signOut
  };

  document.addEventListener('DOMContentLoaded', function () {
    initAuthForms();
    renderAccountPage();
  });
})();
