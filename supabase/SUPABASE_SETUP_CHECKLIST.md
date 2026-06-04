# Herbtropia Sprint 5 — Supabase Setup Checklist

## 1. Run the schema

Open Supabase → SQL Editor → New query → paste `herbtropia_supabase_schema.sql` → Run.

## 2. Copy your project keys

Open Supabase → Project Settings → API.

Copy:

- Project URL
- anon public key

Paste them into:

```js
/js/supabase-config.js
```

Then change:

```js
window.HERBTROPIA_SUPABASE_ENABLED = false;
```

to:

```js
window.HERBTROPIA_SUPABASE_ENABLED = true;
```

Never paste your `service_role` key into the website.

## 3. Add redirect URLs

Open Supabase → Authentication → URL Configuration.

Add these during local testing:

```text
http://127.0.0.1:5500/account/
http://localhost:5500/account/
```

Add these for production:

```text
https://herbtropia.com/account/
https://www.herbtropia.com/account/
```

If you later use `app.herbtropia.com`, add:

```text
https://app.herbtropia.com/account/
```

## 4. Install files

Add these folders/files to your project:

```text
js/supabase-config.js
js/herbtropia-supabase.js
login/index.html
account/index.html
practitioner-onboarding/index.html
```

Append the CSS from:

```text
patches/SPRINT_5_STYLES_APPEND.css
```

to the bottom of your real `styles.css`.

## 5. Test locally

Go to:

```text
/login/
```

Send a magic link to yourself.

Click the email link.

You should land on:

```text
/account/
```

Then test:

```text
/practitioner-onboarding/
```

## 6. What this sprint does not do yet

This sprint does not replace your existing Google Sheets approval system. Your public Directory, Events, and Education pages can stay exactly as they are.

This sprint starts the account database layer so future sprints can move favorites, quiz data, provider editing, and analytics into Supabase safely.
