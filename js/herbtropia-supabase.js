// ============================================
// HERBTROPIA — SUPABASE ACCOUNTS FOUNDATION
// Sprint 6: role-aware dashboard, display names, newsletter account sync, logged-in favorite sync
// ============================================

(function () {
  const QUIZ_STORAGE_KEY = 'herbtropia_wellness_match';
  const FAVORITES_STORAGE_KEY = 'herbtropia_saved_items_v1';

  function isConfigured() {
    return Boolean(
      window.HERBTROPIA_SUPABASE_ENABLED &&
      window.HERBTROPIA_SUPABASE_URL &&
      window.HERBTROPIA_SUPABASE_ANON_KEY &&
      !String(window.HERBTROPIA_SUPABASE_URL).includes('PASTE_') &&
      !String(window.HERBTROPIA_SUPABASE_ANON_KEY).includes('PASTE_') &&
      window.supabase &&
      typeof window.supabase.createClient === 'function'
    );
  }

  let clientInstance = null;

  function getClient() {
    if (!isConfigured()) return null;
    if (!clientInstance) {
      clientInstance = window.supabase.createClient(
        window.HERBTROPIA_SUPABASE_URL,
        window.HERBTROPIA_SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      );
    }
    return clientInstance;
  }

  function qs(selector) {
    return document.querySelector(selector);
  }

  function escapeHTML(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function slugify(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'item';
  }

  function getLocalQuizResults() {
    try {
      return JSON.parse(localStorage.getItem(QUIZ_STORAGE_KEY) || 'null');
    } catch (error) {
      console.warn('Could not read local quiz results.', error);
      return null;
    }
  }

  function getLocalFavorites() {
    try {
      const saved = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      console.warn('Could not read local favorites.', error);
      return [];
    }
  }

  function setStatus(message, type = 'info') {
    const status = qs('[data-auth-status]');
    if (!status) return;
    status.textContent = message || '';
    status.dataset.statusType = type;
  }

  function setAccountStatus(message, type = 'info') {
    const status = qs('[data-account-status]');
    if (!status) return;
    status.textContent = message || '';
    status.dataset.statusType = type;
  }

  function splitFullName(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    return {
      firstName: parts.shift() || '',
      lastName: parts.join(' ')
    };
  }

  function getProfileDisplayName(profile, user) {
    const name = String(profile?.display_name || '').trim();
    if (name) return name;
    const firstLast = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
    if (firstLast) return firstLast;
    const metadataName = String(user?.user_metadata?.full_name || '').trim();
    if (metadataName) return metadataName;
    const firstName = String(user?.user_metadata?.first_name || '').trim();
    if (firstName) return firstName;
    return String(user?.email || '').split('@')[0] || 'Herbtropia Member';
  }

  async function submitNewsletterSignupFromAccount(user, profile) {
    if (!user || !user.email) return { ok: false, reason: 'missing email' };

    const profileStatus = String(profile?.newsletter_status || '').toLowerCase();
    if (profileStatus === 'subscribed' || profileStatus === 'submitted') {
      return { ok: false, reason: 'already submitted' };
    }

    const firstName = profile?.first_name || user.user_metadata?.first_name || splitFullName(profile?.display_name || user.user_metadata?.full_name).firstName || '';
    const lastName = profile?.last_name || user.user_metadata?.last_name || splitFullName(profile?.display_name || user.user_metadata?.full_name).lastName || '';
    const name = [firstName, lastName].filter(Boolean).join(' ').trim() || profile?.display_name || '';

    const accountRole = profile?.role === 'practitioner' || profile?.role === 'admin' ? 'practitioner' : 'user';
    const accountType = accountRole === 'practitioner' ? 'Practitioner / Wellness Business' : 'Wellness Seeker';
    const welcomeTemplateKey = accountRole === 'practitioner' ? 'ACCOUNT_WELCOME_PRACTITIONER' : 'ACCOUNT_WELCOME_SEEKER';

    const payload = {
      id: `account-newsletter-${user.id}`,
      type: 'newsletter',
      email: user.email,
      firstName,
      lastName,
      name,
      interests: accountType,
      source: 'Herbtropia Account Signup',
      submissionType: 'account',
      accountRole,
      accountType,
      welcomeTemplateKey,
      createdAt: new Date().toISOString(),
      status: 'Subscribed'
    };

    try {
      if (typeof window.submitToBackend === 'function') {
        await window.submitToBackend(payload);
      } else if (window.HERBTROPIA_CONFIG?.API_URL) {
        await fetch(window.HERBTROPIA_CONFIG.API_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
      } else {
        return { ok: false, reason: 'missing backend bridge' };
      }
      return { ok: true };
    } catch (error) {
      console.warn('Account newsletter signup failed.', error);
      return { ok: false, error };
    }
  }

  async function markNewsletterSubmitted(user, status = 'submitted') {
    const client = getClient();
    if (!client || !user) return;
    const { error } = await client
      .from('profiles')
      .update({
        newsletter_status: status,
        newsletter_source: 'Herbtropia Account Signup',
        newsletter_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);
    if (error) console.warn('Could not update newsletter profile status.', error);
  }

  async function getSession() {
    const client = getClient();
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) {
      console.warn('Could not get Supabase session.', error);
      return null;
    }
    return data.session || null;
  }

  async function getUser() {
    const client = getClient();
    if (!client) return null;
    const { data, error } = await client.auth.getUser();
    if (error) {
      console.warn('Could not get Supabase user.', error);
      return null;
    }
    return data.user || null;
  }

  async function signInWithMagicLink(email, role, profileData = {}) {
    const client = getClient();
    if (!client) {
      throw new Error('Supabase is not configured yet. Open /js/supabase-config.js and add your project URL + anon key, then set HERBTROPIA_SUPABASE_ENABLED to true.');
    }

    const safeRole = role === 'practitioner' ? 'practitioner' : 'user';
    const firstName = String(profileData.firstName || '').trim();
    const lastName = String(profileData.lastName || '').trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    const redirectTo = `${window.location.origin}/account/?role=${encodeURIComponent(safeRole)}`;
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
        data: {
          requested_role: safeRole,
          first_name: firstName,
          last_name: lastName,
          full_name: fullName
        }
      }
    });

    if (error) throw error;
    return true;
  }

  async function signOut() {
    const client = getClient();
    if (!client) return;
    await client.auth.signOut();
    window.location.href = '/login/';
  }

  async function fetchProfile(userId) {
    const client = getClient();
    if (!client || !userId) return null;
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Could not fetch profile.', error);
      return null;
    }
    return data;
  }

  async function upsertProfile(user, profileData = {}) {
    const client = getClient();
    if (!client || !user) return null;

    const roleParam = new URLSearchParams(window.location.search).get('role') || '';
    const requestedRole = profileData.role || user.user_metadata?.requested_role || roleParam || 'user';
    const safeRole = requestedRole === 'practitioner' ? 'practitioner' : 'user';
    const existing = await fetchProfile(user.id);
    const metadataFirst = user.user_metadata?.first_name || '';
    const metadataLast = user.user_metadata?.last_name || '';
    const metadataFull = user.user_metadata?.full_name || '';
    const parsed = splitFullName(metadataFull);
    const firstName = profileData.first_name || profileData.firstName || existing?.first_name || metadataFirst || parsed.firstName || '';
    const lastName = profileData.last_name || profileData.lastName || existing?.last_name || metadataLast || parsed.lastName || '';
    const displayName = profileData.display_name || existing?.display_name || [firstName, lastName].filter(Boolean).join(' ').trim() || metadataFull || user.email?.split('@')[0] || '';

    const payload = {
      id: user.id,
      email: user.email,
      first_name: firstName,
      last_name: lastName,
      display_name: displayName,
      role: existing?.role === 'admin' ? 'admin' : (existing?.role || safeRole),
      newsletter_status: existing?.newsletter_status || 'pending',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await client
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function syncQuizResults(user) {
    const client = getClient();
    if (!client || !user) return { synced: false, reason: 'missing client/user' };
    const quiz = getLocalQuizResults();
    if (!quiz || !quiz.condition) return { synced: false, reason: 'no quiz results' };

    const payload = {
      user_id: user.id,
      condition: quiz.condition,
      support_type: quiz.supportType || quiz.support_type || 'all',
      location_preference: quiz.locationPreference || quiz.location_preference || 'both',
      budget: quiz.budget || '',
      email: quiz.email || user.email || '',
      completed_at: quiz.completedAt || quiz.completed_at || new Date().toISOString(),
      raw_payload: quiz
    };

    const { error } = await client
      .from('wellness_match_results')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) throw error;
    return { synced: true };
  }

  async function syncFavorites(user) {
    const client = getClient();
    if (!client || !user) return { synced: false, count: 0 };
    const favorites = getLocalFavorites();
    if (!favorites.length) return { synced: false, count: 0 };

    const rows = favorites.map(item => ({
      user_id: user.id,
      item_key: item.key || item.id || `${item.type || 'item'}:${slugify(item.title || '')}`,
      item_type: item.type || 'item',
      title: item.title || 'Saved item',
      meta: item.meta || '',
      url: item.url || '',
      saved_at: item.savedAt || new Date().toISOString()
    }));

    const { error } = await client
      .from('favorites')
      .upsert(rows, { onConflict: 'user_id,item_key' });

    if (error) throw error;
    return { synced: true, count: rows.length };
  }

  async function fetchDashboardData(user) {
    const client = getClient();
    if (!client || !user) return { favorites: [], quiz: null, practitionerProfile: null };

    const [favoritesResult, quizResult, practitionerResult] = await Promise.all([
      client.from('favorites').select('*').eq('user_id', user.id).order('saved_at', { ascending: false }),
      client.from('wellness_match_results').select('*').eq('user_id', user.id).maybeSingle(),
      client.from('practitioner_profiles').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(1).maybeSingle()
    ]);

    return {
      favorites: favoritesResult.data || [],
      quiz: quizResult.data || null,
      practitionerProfile: practitionerResult.data || null
    };
  }

  function renderFavoriteCards(items) {
    if (!items || !items.length) {
      return '<div class="account-empty-card"><p>No saved items have been synced to your account yet.</p><a href="/saved/" class="btn-outline-dark">View browser saves</a></div>';
    }

    return `<div class="account-card-grid">${items.map(item => {
      const url = item.url || '';
      const external = url && !url.startsWith('/');
      return `<article class="account-mini-card">
        <span class="card-badge">${escapeHTML(item.item_type || 'Saved')}</span>
        <h3>${escapeHTML(item.title || 'Saved item')}</h3>
        ${item.meta ? `<p>${escapeHTML(item.meta)}</p>` : ''}
        ${url ? `<a class="card-action secondary" href="${escapeHTML(url)}" ${external ? 'target="_blank" rel="noopener"' : ''}>Open</a>` : ''}
      </article>`;
    }).join('')}</div>`;
  }

  function renderQuizCard(quiz) {
    if (!quiz || !quiz.condition) {
      return '<div class="account-empty-card"><p>No Wellness Match Quiz result has been synced yet.</p><a href="/wellness-match/" class="btn-primary">Take the Quiz <span class="arrow">→</span></a></div>';
    }

    return `<article class="account-feature-card">
      <span class="card-badge">Wellness Match</span>
      <h3>${escapeHTML(labelizeTitle(quiz.condition))}</h3>
      <p>Your account is currently matched around ${escapeHTML(labelizeTitle(quiz.condition).toLowerCase())}.</p>
      <div class="recommended-pill-row">
        ${quiz.support_type ? `<span class="recommended-pill">${escapeHTML(labelizeTitle(quiz.support_type))}</span>` : ''}
        ${quiz.location_preference ? `<span class="recommended-pill">${escapeHTML(labelizeTitle(quiz.location_preference))}</span>` : ''}
        ${quiz.budget ? `<span class="recommended-pill">${escapeHTML(labelizeTitle(quiz.budget))}</span>` : ''}
      </div>
      <div class="card-actions">
        <a class="card-action" href="/recommended/?condition=${escapeHTML(quiz.condition)}">View Recommendations</a>
        <a class="card-action secondary" href="/wellness-match/">Retake Quiz</a>
      </div>
    </article>`;
  }

  function renderPractitionerStatus(profile, role) {
    const panel = qs('[data-practitioner-tools-panel]');
    const container = qs('[data-practitioner-status]');
    if (!container) return;

    if (role !== 'practitioner' && role !== 'admin') {
      if (panel) panel.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    if (panel) panel.style.display = '';

    if (!profile) {
      container.innerHTML = `<div class="account-empty-card"><p>You do not have a practitioner profile draft connected to this account yet.</p><a href="/practitioner-onboarding/" class="btn-primary">Start Practitioner Profile <span class="arrow">→</span></a></div>`;
      return;
    }

    container.innerHTML = `<article class="account-feature-card">
      <span class="card-badge">${escapeHTML(profile.status || 'draft')}</span>
      <h3>${escapeHTML(profile.listing_name || 'Practitioner Profile')}</h3>
      <p>${escapeHTML(profile.bio || 'Your practitioner profile has been saved.')}</p>
      <div class="card-actions">
        <a class="card-action" href="/practitioner-onboarding/">Edit Profile</a>
      </div>
    </article>`;
  }

  function labelizeTitle(value) {
    return String(value || '')
      .split('-')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  async function renderAccountPage() {
    const client = getClient();
    if (!client) {
      setAccountStatus('Supabase is not configured yet. Add your Supabase URL and anon key in /js/supabase-config.js.', 'error');
      return;
    }

    setAccountStatus('Loading your account...', 'info');
    const user = await getUser();

    if (!user) {
      const signedOut = qs('[data-account-signed-out]');
      if (signedOut) signedOut.style.display = 'block';
      const signedIn = qs('[data-account-signed-in]');
      if (signedIn) signedIn.style.display = 'none';
      setAccountStatus('You are not signed in yet.', 'info');
      return;
    }

    const signedOut = qs('[data-account-signed-out]');
    if (signedOut) signedOut.style.display = 'none';
    const signedIn = qs('[data-account-signed-in]');
    if (signedIn) signedIn.style.display = 'block';

    let profile = await fetchProfile(user.id);
    if (!profile) {
      try {
        profile = await upsertProfile(user, {});
      } catch (error) {
        setAccountStatus(error.message || 'Could not create your account profile.', 'error');
        return;
      }
    }

    const displayName = getProfileDisplayName(profile, user);
    const displayNameTarget = qs('[data-account-display-name]');
    if (displayNameTarget) displayNameTarget.textContent = displayName;
    const emailTarget = qs('[data-account-email]');
    if (emailTarget) emailTarget.textContent = user.email || '';
    const roleTarget = qs('[data-account-role]');
    if (roleTarget) roleTarget.textContent = profile.role === 'practitioner' ? 'Practitioner / Wellness Business' : (profile.role === 'admin' ? 'Admin' : 'Wellness Seeker');

    try {
      await syncQuizResults(user);
      await syncFavorites(user);
      const newsletterResult = await submitNewsletterSignupFromAccount(user, profile);
      if (newsletterResult.ok) {
        await markNewsletterSubmitted(user, 'submitted');
        profile.newsletter_status = 'submitted';
      }
    } catch (error) {
      console.warn('Local sync warning:', error);
    }

    const dashboardData = await fetchDashboardData(user);
    const quizContainer = qs('[data-account-quiz]');
    if (quizContainer) quizContainer.innerHTML = renderQuizCard(dashboardData.quiz);
    const favoritesContainer = qs('[data-account-favorites]');
    if (favoritesContainer) favoritesContainer.innerHTML = renderFavoriteCards(dashboardData.favorites);
    renderPractitionerStatus(dashboardData.practitionerProfile, profile.role);

    setAccountStatus('Account loaded. Your local quiz, saved items, and newsletter status have been synced when available.', 'success');
  }

  async function handlePractitionerProfileSubmit(event) {
    event.preventDefault();
    const client = getClient();
    if (!client) {
      alert('Supabase is not configured yet.');
      return;
    }

    const user = await getUser();
    if (!user) {
      window.location.href = '/login/?next=practitioner';
      return;
    }

    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const original = button ? button.innerHTML : '';
    if (button) {
      button.disabled = true;
      button.innerHTML = 'Saving profile...';
    }

    try {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      await upsertProfile(user, {
        role: 'practitioner',
        display_name: data.contact_name || data.listing_name || '',
        first_name: splitFullName(data.contact_name || '').firstName,
        last_name: splitFullName(data.contact_name || '').lastName
      });
      const payload = {
        user_id: user.id,
        status: data.status || 'draft',
        listing_name: data.listing_name || '',
        contact_name: data.contact_name || '',
        email: data.email || user.email || '',
        category: data.category || '',
        service_format: data.service_format || '',
        wellness_focus: data.wellness_focus || '',
        city: data.city || '',
        state: data.state || '',
        bio: data.bio || '',
        services: data.services || '',
        booking_link: data.booking_link || '',
        website: data.website || '',
        instagram: data.instagram || '',
        updated_at: new Date().toISOString()
      };

      const { error } = await client
        .from('practitioner_profiles')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;
      setStatus('Profile saved. You can return to your account dashboard.', 'success');
    } catch (error) {
      console.warn('Could not save practitioner profile.', error);
      setStatus(error.message || 'Could not save profile.', 'error');
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = original;
      }
    }
  }

  async function initPractitionerOnboardingPage() {
    const form = qs('#practitionerProfileForm');
    if (!form) return;

    const user = await getUser();
    if (user) {
      const emailInput = qs('#practitionerEmail');
      if (emailInput && !emailInput.value) emailInput.value = user.email || '';
    }

    form.addEventListener('submit', handlePractitionerProfileSubmit);
  }

  function initLoginPage() {
    const form = qs('#magicLinkForm');
    if (!form) return;

    if (!isConfigured()) {
      setStatus('Supabase is not configured yet. Add your Supabase URL + anon key in /js/supabase-config.js, then set HERBTROPIA_SUPABASE_ENABLED to true.', 'error');
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const formData = new FormData(form);
      const email = String(formData.get('email') || '').trim();
      const firstName = String(formData.get('firstName') || '').trim();
      const lastName = String(formData.get('lastName') || '').trim();
      const role = String(formData.get('role') || 'user').trim();
      const button = form.querySelector('button[type="submit"]');
      const original = button ? button.innerHTML : '';

      if (!email) {
        setStatus('Please enter your email address.', 'error');
        return;
      }

      if (!firstName) {
        setStatus('Please enter at least your first name so your Herbtropia profile does not display as only an email address.', 'error');
        return;
      }

      if (button) {
        button.disabled = true;
        button.innerHTML = 'Sending magic link...';
      }

      try {
        await signInWithMagicLink(email, role, { firstName, lastName });
        setStatus('Check your inbox. Your Herbtropia sign-in link is on the way.', 'success');
        form.reset();
      } catch (error) {
        console.warn('Magic link error:', error);
        setStatus(error.message || 'Could not send magic link.', 'error');
      } finally {
        if (button) {
          button.disabled = false;
          button.innerHTML = original;
        }
      }
    });
  }

  function initAuthAwareButtons() {
    document.addEventListener('click', function (event) {
      const signOutButton = event.target.closest('[data-sign-out]');
      if (!signOutButton) return;
      event.preventDefault();
      signOut();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initAuthAwareButtons();
    const page = document.body.dataset.page;
    if (page === 'login') initLoginPage();
    if (page === 'account') renderAccountPage();
    if (page === 'practitioner-onboarding') initPractitionerOnboardingPage();
  });



  async function syncFavoriteAction(action, favorite) {
    const client = getClient();
    if (!client || !favorite) return { ok: false, reason: 'missing client/favorite' };
    const user = await getUser();
    if (!user) return { ok: false, reason: 'not signed in' };

    const key = favorite.key || favorite.id || `${favorite.type || 'item'}:${slugify(favorite.title || '')}`;

    if (action === 'remove') {
      const { error } = await client
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('item_key', key);
      if (error) throw error;
      return { ok: true, action: 'remove' };
    }

    const row = {
      user_id: user.id,
      item_key: key,
      item_type: favorite.type || 'item',
      title: favorite.title || 'Saved item',
      meta: favorite.meta || '',
      url: favorite.url || '',
      saved_at: favorite.savedAt || new Date().toISOString()
    };

    const { error } = await client
      .from('favorites')
      .upsert(row, { onConflict: 'user_id,item_key' });
    if (error) throw error;
    return { ok: true, action: 'save' };
  }

  async function syncCurrentLocalFavoriteState(key) {
    const favorite = getLocalFavorites().find(item => item.key === key || item.id === key);
    try {
      if (favorite) {
        await syncFavoriteAction('save', favorite);
      } else {
        await syncFavoriteAction('remove', { key, id: key });
      }
    } catch (error) {
      console.warn('Could not sync favorite action to Supabase.', error);
    }
  }

  window.HerbtropiaSupabase = {
    getClient,
    getSession,
    getUser,
    signOut,
    syncQuizResults,
    syncFavorites,
    submitNewsletterSignupFromAccount,
    syncFavoriteAction,
    syncCurrentLocalFavoriteState,
    renderAccountPage
  };
})();
