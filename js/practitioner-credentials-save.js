
// Herbtropia provider profile + credential save handler.
// Use this on /practitioner-onboarding/ after Supabase CDN + /js/supabase-config.js.

(function () {
  function getStatusEl() {
    return document.querySelector('[data-auth-status]');
  }

  function setStatus(message, tone) {
    const el = getStatusEl();
    if (!el) return;
    el.textContent = message || '';
    el.className = 'auth-status';
    if (tone) el.classList.add(`auth-status-${tone}`);
  }

  function getSupabaseClient() {
    if (!window.supabase || !window.HERBTROPIA_SUPABASE_URL || !window.HERBTROPIA_SUPABASE_ANON_KEY) {
      throw new Error('Supabase is not configured on this page.');
    }
    return window.supabase.createClient(
      window.HERBTROPIA_SUPABASE_URL,
      window.HERBTROPIA_SUPABASE_ANON_KEY
    );
  }

  function getMultiValues(form, name) {
    return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(input => input.value);
  }

  function value(form, name) {
    return String(new FormData(form).get(name) || '').trim();
  }

  async function initProviderCredentialForm() {
    if (document.body.dataset.page !== 'practitioner-onboarding') return;

    const form = document.getElementById('practitionerProfileForm');
    if (!form) return;

    let client;
    try {
      client = getSupabaseClient();
    } catch (error) {
      setStatus(error.message, 'error');
      return;
    }

    const { data: userResult, error: userError } = await client.auth.getUser();
    const user = userResult && userResult.user;

    if (userError || !user) {
      setStatus('Please sign in before saving a provider profile.', 'error');
      return;
    }

    const emailInput = document.getElementById('practitionerEmail');
    if (emailInput && !emailInput.value) emailInput.value = user.email || '';

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const submitButton = form.querySelector('button[type="submit"]');
      const originalHTML = submitButton ? submitButton.innerHTML : '';
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = 'Saving profile...';
      }

      try {
        const payload = {
          user_id: user.id,
          status: value(form, 'status') || 'draft',
          listing_name: value(form, 'listing_name'),
          contact_name: value(form, 'contact_name'),
          email: value(form, 'email') || user.email || '',
          category: value(form, 'category'),
          service_format: value(form, 'service_format'),
          wellness_focus: value(form, 'wellness_focus'),
          city: value(form, 'city'),
          state: value(form, 'state'),
          bio: value(form, 'bio'),
          services: value(form, 'services'),
          booking_link: value(form, 'booking_link'),
          website: value(form, 'website'),
          instagram: value(form, 'instagram'),

          credential_types: getMultiValues(form, 'credential_types'),
          license_title: value(form, 'license_title'),
          license_number: value(form, 'license_number'),
          license_state: value(form, 'license_state'),
          licensing_board: value(form, 'licensing_board'),
          license_verification_url: value(form, 'license_verification_url'),
          certification_title: value(form, 'certification_title'),
          certification_issuer: value(form, 'certification_issuer'),
          certification_id: value(form, 'certification_id'),
          certification_verification_url: value(form, 'certification_verification_url'),
          credential_notes: value(form, 'credential_notes'),
          verification_requested: Boolean(form.querySelector('input[name="verification_requested"]:checked')),
          verification_consent: Boolean(form.querySelector('input[name="verification_consent"]:checked')),
          verification_status: form.querySelector('input[name="verification_requested"]:checked') ? 'requested' : 'not_requested',
          updated_at: new Date().toISOString()
        };

        const { error } = await client
          .from('practitioner_profiles')
          .upsert(payload, { onConflict: 'user_id' });

        if (error) throw error;

        setStatus('Your provider profile draft was saved. Herbtropia will review credential information before any verification language appears publicly.', 'success');
      } catch (error) {
        console.error('Provider profile save failed:', error);
        setStatus(error.message || 'Could not save provider profile right now.', 'error');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = originalHTML;
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', initProviderCredentialForm);
})();
