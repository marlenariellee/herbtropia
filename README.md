# Herbtropia Directory Beta — Clean Launch + Newsletter Workflow

This package contains a clean Herbtropia launch version focused on:

- Practitioner Directory
- Events Directory
- Practitioner profile submissions
- Event submissions
- A separate newsletter signup page
- Google Sheets + Apps Script review workflow

## Public Site Structure

- `index.html` — homepage with simple brand description and four primary action cards
- `directory.html` — practitioner directory with filters and profile pop-ups
- `events.html` — events directory with filters and event pop-ups
- `practitioner-signup.html` — practitioner profile submission form
- `submit-event.html` — event submission form
- `newsletter.html` — standalone newsletter signup form
- `styles.css` — shared Herbtropia styling
- `script.js` — frontend filtering, forms, modals, mobile filters, newsletter signup
- `Code.gs` — Google Apps Script backend

## Review Workflow

Practitioner and event submissions are saved to Google Sheets as `Pending Review`.

They do not appear publicly on the website until you change their row status to `Approved`.

Supported statuses:

- Pending Review
- Approved
- Rejected
- Needs Edits
- Hidden
- Archived

The website only displays rows marked `Approved`.

## Email Workflow

When someone submits a practitioner or event form:

1. Their submission is saved to Google Sheets.
2. You receive an admin review notification.
3. They receive a thank-you email saying the submission is under review and they will receive a follow-up within 24 hours.

When you change the status to `Approved`, they receive an approval email.

When you change the status to `Rejected`, they receive a gentle rejection/update email.

## Newsletter Workflow

Newsletter signup is separate from the practitioner and event forms.

The newsletter page sends signups to a separate `Newsletter` tab in Google Sheets. The submitter receives a welcome email and you receive an admin notification.

## Google Apps Script Setup

1. Create a Google Sheet for Herbtropia submissions.
2. Open Extensions → Apps Script.
3. Paste the full `Code.gs` file into Apps Script.
4. Update `ADMIN_EMAIL` if needed.
5. Run `setupSheets_()` once.
6. Run `createInstallableTriggers_()` once so approval/rejection emails can send automatically when you update the status column.
7. Deploy as a Web App.
8. Copy the Web App URL.
9. Paste that URL into `HERBTROPIA_CONFIG.API_URL` in `script.js`.

## Image Uploads

Practitioner photos and event flyers are uploaded through the forms, saved to Google Drive, and stored as public image links in the Sheet.

Apps Script creates or uses this Drive folder:

`Herbtropia Directory Uploads`

## Practitioner Address Flow

The practitioner form now includes:

- Main address/practice location
- City
- State
- Zip code
- `+ Add another address` for additional practice locations
- Service areas for filtering

Additional addresses are saved into the Google Sheet through the `additionalLocations` field and shown on approved profiles.


## Logo Size Update

The navigation and footer logo styles were enlarged in `styles.css` so the Herbtropia branding is visible on desktop and mobile. The primary updates are in `.nav-logo img` and `.footer-logo img`.
