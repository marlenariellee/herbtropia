/**
 * HERBTROPIA DIRECTORY BETA — REVIEW WORKFLOW BACKEND
 * ----------------------------------------------------
 * This script turns a Google Sheet into a lightweight backend:
 * 1. Practitioner/event forms append to Google Sheets with status = Pending Review.
 * 2. Submitters receive an immediate thank-you / under-review email.
 * 3. Herbtropia receives an admin review notification.
 * 4. Public website reads only rows where status = Approved.
 * 5. When you change status to Approved or Rejected in the Sheet, the submitter receives a follow-up email.
 * 6. Newsletter signups are collected through the separate newsletter page.
 */

const ADMIN_EMAIL = 'herbtropiaco@gmail.com';
const REVIEW_TURNAROUND = 'within 24 hours';
const UPLOAD_FOLDER_NAME = 'Herbtropia Directory Uploads';

const SHEETS = {
  practitioner: 'Practitioners',
  event: 'Events',
  newsletter: 'Newsletter'
};

const STATUS_OPTIONS = ['Pending Review', 'Approved', 'Rejected', 'Needs Edits', 'Hidden', 'Archived'];

const COMMON_REVIEW_FIELDS = [
  'id', 'type', 'status', 'submittedAt', 'statusUpdatedAt', 'reviewedAt', 'reviewNotes',
  'submitterConfirmationSent', 'approvedEmailSent', 'rejectedEmailSent'
];

const PRACTITIONER_FIELDS = [
  ...COMMON_REVIEW_FIELDS,
  'name', 'businessName', 'category', 'serviceFormat', 'addressLine', 'city', 'state', 'zip',
  'serviceAreas', 'additionalLocations', 'priceRange', 'wellnessFocus', 'serviceTags',
  'services', 'bio', 'website', 'bookingLink', 'instagram', 'photoUrl', 'photoDriveFileId',
  'email', 'phone', 'acceptingClients', 'visibilityInterest', 'wellnessCourtInterest', 'wellnessCourtNotes'
];

const EVENT_FIELDS = [
  ...COMMON_REVIEW_FIELDS,
  'eventName', 'organizerName', 'eventDate', 'startTime', 'city', 'state', 'category',
  'format', 'serviceAreas', 'additionalLocations', 'costType', 'price', 'venue', 'audience',
  'eventFocus', 'description', 'eventLink', 'imageUrl', 'imageDriveFileId', 'email', 'recurring',
  'submissionChannels', 'socialFeatureType', 'eventSocialHandles', 'featureDeadline',
  'socialCaptionNotes', 'reviewInterest', 'reviewAcknowledgement'
];

const NEWSLETTER_FIELDS = [
  'id', 'email', 'name', 'interests', 'source', 'submissionType', 'businessOrEvent', 'createdAt', 'status', 'brevoSynced', 'brevoContactId', 'brevoSyncedAt', 'brevoSyncError'
];

function doPost(e) {
  const data = parseBody_(e);

  // Honeypot spam protection. Real users never fill this field.
  if (data.website_confirm) {
    return output_({ ok: true, ignored: true });
  }

  if (data.type === 'newsletter') {
    return handleNewsletterSignup_(data);
  }

  const brevoResult = syncNewsletterToBrevo_(data);

  data.brevoSynced = brevoResult.ok ? 'Yes' : 'No';
  data.brevoContactId = brevoResult.contactId || '';
  data.brevoSyncedAt = brevoResult.ok ? new Date().toISOString() : '';
  data.brevoSyncError = brevoResult.error || '';

  const type = data.type === 'event' ? 'event' : 'practitioner';
  data.type = type;
  data.id = data.id || Utilities.getUuid();
  data.status = 'Pending Review';
  data.submittedAt = data.submittedAt || new Date().toISOString();
  data.statusUpdatedAt = data.statusUpdatedAt || '';
  data.reviewedAt = data.reviewedAt || '';
  data.reviewNotes = data.reviewNotes || '';
  data.submitterConfirmationSent = data.submitterConfirmationSent || '';
  data.approvedEmailSent = data.approvedEmailSent || '';
  data.rejectedEmailSent = data.rejectedEmailSent || '';

  saveUploadedImage_(type, data);

  const fields = type === 'event' ? EVENT_FIELDS : PRACTITIONER_FIELDS;
  const sheetName = type === 'event' ? SHEETS.event : SHEETS.practitioner;
  const sheet = getOrCreateSheet_(sheetName, fields);
  const row = fields.map(field => data[field] || '');
  const rowNumber = sheet.getLastRow() + 1;
  sheet.appendRow(row);

  sendAdminNotification_(type, data, rowNumber);

  if (sendSubmitterConfirmation_(type, data)) {
    setCellByHeader_(sheet, rowNumber, 'submitterConfirmationSent', 'Yes');
  }

  if (type === 'event') {
  hbSendInPersonReviewInterestIfNeeded_(data);
  }

  return output_({ ok: true, status: 'Pending Review', id: data.id });
}

function doGet(e) {
  setupSheets_();
  const payload = {
    ok: true,
    practitioners: getApprovedRows_(SHEETS.practitioner),
    events: getApprovedRows_(SHEETS.event)
  };

  const callback = e && e.parameter && e.parameter.callback;
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(payload) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return output_(payload);
}

function setupSheets_() {
  const practitionerSheet = getOrCreateSheet_(SHEETS.practitioner, PRACTITIONER_FIELDS);
  const eventSheet = getOrCreateSheet_(SHEETS.event, EVENT_FIELDS);
  getOrCreateSheet_(SHEETS.newsletter, NEWSLETTER_FIELDS);
  applyStatusValidation_(practitionerSheet);
  applyStatusValidation_(eventSheet);
}

/**
 * Run this once after setup if you want approval/rejection emails to send automatically
 * when you change a row's status in Google Sheets.
 */
function createInstallableTriggers_() {
  const ss = SpreadsheetApp.getActive();
  const triggers = ScriptApp.getProjectTriggers();
  const alreadyExists = triggers.some(trigger => trigger.getHandlerFunction() === 'handleStatusEdit_');
  if (!alreadyExists) {
    ScriptApp.newTrigger('handleStatusEdit_')
      .forSpreadsheet(ss)
      .onEdit()
      .create();
  }
}

function handleStatusEdit_(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  const type = sheetName === SHEETS.event ? 'event' : sheetName === SHEETS.practitioner ? 'practitioner' : '';
  if (!type) return;

  const row = e.range.getRow();
  if (row <= 1) return;

  const headers = getHeaders_(sheet);
  const statusCol = getHeaderIndex_(headers, 'status') + 1;
  if (e.range.getColumn() !== statusCol) return;

  const status = String(e.range.getValue() || '').trim();
  const statusLower = status.toLowerCase();
  if (statusLower !== 'approved' && statusLower !== 'rejected') return;

  const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = rowToObject_(headers, values);
  data.status = status;

  const sentField = statusLower === 'approved' ? 'approvedEmailSent' : 'rejectedEmailSent';
  if (String(data[sentField] || '').toLowerCase() === 'yes') return;

  const sent = statusLower === 'approved'
    ? sendApprovedEmail_(type, data)
    : sendRejectedEmail_(type, data);

  if (sent) {
    setCellByHeader_(sheet, row, sentField, 'Yes');
    setCellByHeader_(sheet, row, 'reviewedAt', new Date().toISOString());
    setCellByHeader_(sheet, row, 'statusUpdatedAt', new Date().toISOString());
  }
}

function getOrCreateSheet_(name, fields) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  const width = Math.max(fields.length, sheet.getLastColumn() || fields.length);
  const firstRow = sheet.getRange(1, 1, 1, width).getValues()[0];
  const hasHeaders = firstRow.some(Boolean);
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, fields.length).setValues([fields]);
    sheet.setFrozenRows(1);
  } else {
    const existing = firstRow.filter(Boolean).map(String);
    const missing = fields.filter(field => existing.indexOf(field) === -1);
    if (missing.length) {
      sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
    }
  }
  return sheet;
}

function applyStatusValidation_(sheet) {
  const headers = getHeaders_(sheet);
  const index = getHeaderIndex_(headers, 'status');
  if (index < 0) return;
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(STATUS_OPTIONS, true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, index + 1, Math.max(999, sheet.getMaxRows() - 1), 1).setDataValidation(rule);
}

function getApprovedRows_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  return values
    .map(row => rowToObject_(headers, row))
    .filter(item => String(item.status || '').trim().toLowerCase() === 'approved');
}

function rowToObject_(headers, row) {
  const obj = {};
  headers.forEach((header, index) => {
    if (!header) return;
    obj[String(header)] = row[index] instanceof Date ? row[index].toISOString() : row[index];
  });
  return obj;
}

function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function getHeaderIndex_(headers, name) {
  return headers.indexOf(name);
}

function setCellByHeader_(sheet, row, headerName, value) {
  const headers = getHeaders_(sheet);
  const index = getHeaderIndex_(headers, headerName);
  if (index < 0) return;
  sheet.getRange(row, index + 1).setValue(value);
}

function parseBody_(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {
      return e.parameter || {};
    }
  }
  return e.parameter || {};
}

function saveUploadedImage_(type, data) {
  const isEvent = type === 'event';
  const base64Key = isEvent ? 'imageBase64' : 'photoBase64';
  const fileNameKey = isEvent ? 'imageFileName' : 'photoFileName';
  const mimeTypeKey = isEvent ? 'imageMimeType' : 'photoMimeType';
  const urlKey = isEvent ? 'imageUrl' : 'photoUrl';
  const fileIdKey = isEvent ? 'imageDriveFileId' : 'photoDriveFileId';

  if (!data[base64Key]) return;

  const cleanBase64 = String(data[base64Key]).replace(/^data:.*;base64,/, '');
  const mimeType = data[mimeTypeKey] || 'image/jpeg';
  const originalName = sanitizeFileName_(data[fileNameKey] || (isEvent ? 'event-flyer.jpg' : 'practitioner-photo.jpg'));
  const fileName = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + originalName;
  const bytes = Utilities.base64Decode(cleanBase64);
  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  const folder = getUploadFolder_();
  const file = folder.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  data[urlKey] = 'https://drive.google.com/uc?export=view&id=' + file.getId();
  data[fileIdKey] = file.getId();

  delete data[base64Key];
  delete data[fileNameKey];
  delete data[mimeTypeKey];
}

function getUploadFolder_() {
  const folders = DriveApp.getFoldersByName(UPLOAD_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(UPLOAD_FOLDER_NAME);
}

function sanitizeFileName_(value) {
  return String(value || 'upload.jpg')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90);
}

function sendAdminNotification_(type, data, rowNumber) {
  const isEvent = type === 'event';
  const title = getTitle_(type, data);
  const sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const subject = `Review needed: Herbtropia ${isEvent ? 'event' : 'practitioner'} submission — ${title}`;
  const body = [
    `A new Herbtropia ${isEvent ? 'event' : 'practitioner'} submission needs review.`,
    '',
    `Status: Pending Review`,
    `Review timeline promised: ${REVIEW_TURNAROUND}`,
    `Row: ${rowNumber}`,
    `Name: ${title}`,
    `Email: ${data.email || ''}`,
    '',
    `Review Sheet: ${sheetUrl}`,
    '',
    'To publish this submission publicly, change status to Approved.',
    'To prevent it from publishing, change status to Rejected, Hidden, or Needs Edits.',
    '',
    'Submission details:',
    formatDataForEmail_(data)
  ].join('\n');

  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: subject,
    body: body
  });
}

function sendSubmitterConfirmation_(type, data) {
  if (!data.email) return false;
  const templateKey = type === 'event' ? 'EVENT_RECEIVED' : 'PRACTITIONER_RECEIVED';
const brevoResult = hbSendTemplateWithFallbackLog_(
  templateKey,
  data.email,
  data.name || data.organizerName || data.businessName || data.eventName || '',
  data
);

if (brevoResult.ok) return true;
  const isEvent = type === 'event';
  const title = getTitle_(type, data);
  const subject = `We received your Herbtropia ${isEvent ? 'event' : 'practitioner'} submission 🌿`;
  const htmlBody = `
    <p>Hi ${escapeHtml_(data.name || data.organizerName || 'there')},</p>
    <p>Thank you for submitting <strong>${escapeHtml_(title)}</strong> to Herbtropia.</p>
    <p>Your submission is now under review. During this beta phase, submissions are reviewed before they appear publicly on the website so we can confirm details, links, images, formatting, and overall fit for the directory.</p>
    <p>You’ll receive a follow-up email ${escapeHtml_(REVIEW_TURNAROUND)} once your submission has been approved or if it cannot be published at this time.</p>
    <p>With care,<br>Herbtropia</p>
  `;
  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    htmlBody: htmlBody,
    body: stripHtml_(htmlBody)
  });
  return true;
}

function sendApprovedEmail_(type, data) {
  if (!data.email) return false;
  const templateKey = type === 'event' ? 'EVENT_APPROVED' : 'PRACTITIONER_APPROVED';
const brevoResult = hbSendTemplateWithFallbackLog_(
  templateKey,
  data.email,
  data.name || data.organizerName || data.businessName || data.eventName || '',
  data
);

if (brevoResult.ok) return true;
  const isEvent = type === 'event';
  const title = getTitle_(type, data);
  const subject = `Your Herbtropia ${isEvent ? 'event' : 'practitioner'} submission has been approved`;
  const htmlBody = `
    <p>Hi ${escapeHtml_(data.name || data.organizerName || 'there')},</p>
    <p>Good news — <strong>${escapeHtml_(title)}</strong> has been reviewed and approved for Herbtropia.</p>
    <p>Your ${isEvent ? 'event' : 'profile'} can now appear publicly in the Herbtropia ${isEvent ? 'events directory' : 'practitioner directory'}.</p>
    <p>Thank you for being part of the Herbtropia beta community.</p>
    <p>With care,<br>Herbtropia</p>
  `;
  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    htmlBody: htmlBody,
    body: stripHtml_(htmlBody)
  });
  return true;
}

function sendRejectedEmail_(type, data) {
  if (!data.email) return false;
  const templateKey = type === 'event' ? 'EVENT_REJECTED' : 'PRACTITIONER_REJECTED';
const brevoResult = hbSendTemplateWithFallbackLog_(
  templateKey,
  data.email,
  data.name || data.organizerName || data.businessName || data.eventName || '',
  data
);

if (brevoResult.ok) return true;
  const isEvent = type === 'event';
  const title = getTitle_(type, data);
  const subject = `Update on your Herbtropia ${isEvent ? 'event' : 'practitioner'} submission`;
  const notes = data.reviewNotes ? `<p><strong>Review note:</strong> ${escapeHtml_(data.reviewNotes)}</p>` : '';
  const htmlBody = `
    <p>Hi ${escapeHtml_(data.name || data.organizerName || 'there')},</p>
    <p>Thank you again for submitting <strong>${escapeHtml_(title)}</strong> to Herbtropia.</p>
    <p>After review, we are not able to publish this submission on the directory at this time. This may be due to missing details, formatting, fit, timing, or information that needs to be clarified before publishing.</p>
    ${notes}
    <p>If you believe something should be updated or reconsidered, you can reply to this email with additional information.</p>
    <p>With care,<br>Herbtropia</p>
  `;
  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    htmlBody: htmlBody,
    body: stripHtml_(htmlBody)
  });
  return true;
}

function handleNewsletterSignup_(data) {
  if (data.website_confirm) return output_({ ok: true, ignored: true });
  const email = String(data.email || '').trim().toLowerCase();
  if (!email) return output_({ ok: false, error: 'Email is required.' });

  const sheet = getOrCreateSheet_(SHEETS.newsletter, NEWSLETTER_FIELDS);
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const emailIndex = getHeaderIndex_(headers, 'email');
  const existing = values.findIndex(row => String(row[emailIndex] || '').trim().toLowerCase() === email);

  const item = {
    id: data.id || Utilities.getUuid(),
    email: email,
    name: data.name || '',
    interests: data.interests || '',
    source: data.source || 'Website Newsletter Page',
    submissionType: 'newsletter',
    businessOrEvent: '',
    createdAt: data.createdAt || new Date().toISOString(),
    status: 'Subscribed'
  };

  if (existing >= 0) {
    const rowNumber = existing + 2;
    setCellByHeader_(sheet, rowNumber, 'name', item.name || sheet.getRange(rowNumber, getHeaderIndex_(headers, 'name') + 1).getValue());
    setCellByHeader_(sheet, rowNumber, 'interests', item.interests);
    setCellByHeader_(sheet, rowNumber, 'status', 'Subscribed');
  } else {
    sheet.appendRow(NEWSLETTER_FIELDS.map(field => item[field] || ''));
  }

  sendNewsletterWelcome_(item);
  sendNewsletterAdminNotification_(item);
  return output_({ ok: true, status: 'Subscribed' });
}

function sendNewsletterWelcome_(data) {
  if (!data.email) return false;
  const brevoResult = hbSendTemplateWithFallbackLog_(
  'NEWSLETTER_WELCOME',
  data.email,
  data.name || '',
  data
);

if (brevoResult.ok) return true;
  const htmlBody = `
    <p>Hi ${escapeHtml_(data.name || 'there')},</p>
    <p>Thank you for joining the Herbtropia newsletter.</p>
    <p>You’ll receive updates about new practitioner listings, upcoming wellness events, curated wellness education, and Herbtropia community updates.</p>
    <p>With care,<br>Herbtropia</p>
  `;
  MailApp.sendEmail({
    to: data.email,
    subject: 'You’re on the Herbtropia newsletter list 🌿',
    htmlBody: htmlBody,
    body: stripHtml_(htmlBody)
  });
  return true;
}

function sendNewsletterAdminNotification_(data) {
  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: `New Herbtropia newsletter signup — ${data.email}`,
    body: [
      'A new person joined the Herbtropia newsletter.',
      '',
      `Name: ${data.name || ''}`,
      `Email: ${data.email || ''}`,
      `Interests: ${data.interests || ''}`,
      '',
      `Newsletter Sheet: ${SpreadsheetApp.getActiveSpreadsheet().getUrl()}`
    ].join('\n')
  });
}


function getTitle_(type, data) {
  return type === 'event'
    ? (data.eventName || data.organizerName || 'Event Submission')
    : (data.businessName || data.name || 'Practitioner Submission');
}

function formatDataForEmail_(data) {
  return Object.keys(data)
    .sort()
    .filter(key => !/Base64$/i.test(key))
    .map(key => `${key}: ${data[key]}`)
    .join('\n');
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function stripHtml_(html) {
  return String(html || '')
    .replace(/<br\s*\/?\>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

function output_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// BREVO NEWSLETTER API SYNC
// ============================================

const BREVO_API_BASE = 'https://api.brevo.com/v3';

function getBrevoApiKey_() {
  return PropertiesService.getScriptProperties().getProperty('BREVO_API_KEY');
}

function getBrevoNewsletterListId_() {
  const value = PropertiesService.getScriptProperties().getProperty('BREVO_NEWSLETTER_LIST_ID');
  return value ? Number(value) : null;
}

function splitFullName_(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return { firstName: '', lastName: '' };
  }

  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || ''
  };
}

function normalizeNewsletterInterests_(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ');
  }

  return String(value || '')
    .split(/[,|;]/)
    .map(item => item.trim())
    .filter(Boolean)
    .join(', ');
}

function todayDateOnly_() {
  return new Date().toISOString().slice(0, 10);
}

function syncNewsletterToBrevo_(data) {
  try {
    const apiKey = getBrevoApiKey_();
    const listId = getBrevoNewsletterListId_();

    if (!apiKey) {
      return {
        ok: false,
        contactId: '',
        error: 'Missing BREVO_API_KEY in Apps Script Properties.'
      };
    }

    if (!listId) {
      return {
        ok: false,
        contactId: '',
        error: 'Missing BREVO_NEWSLETTER_LIST_ID in Apps Script Properties.'
      };
    }

    const email = String(data.email || data.EMAIL || '').trim().toLowerCase();

    if (!email) {
      return {
        ok: false,
        contactId: '',
        error: 'Missing newsletter email.'
      };
    }

    const nameParts = splitFullName_(data.name || data.fullName || '');
    const interests = normalizeNewsletterInterests_(data.interests || data.interest || '');

    const payload = {
      email: email,
      attributes: {
        FIRSTNAME: nameParts.firstName,
        LASTNAME: nameParts.lastName,
        SOURCE: data.source || 'Website Newsletter Page',
        INTEREST: interests,
        CONTACT_TYPE: 'Newsletter Subscriber',
        SIGNUP_DATE: todayDateOnly_()
      },
      listIds: [listId],
      updateEnabled: true
    };

    const response = UrlFetchApp.fetch(`${BREVO_API_BASE}/contacts`, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'api-key': apiKey,
        'accept': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode >= 200 && statusCode < 300) {
      let parsed = {};
      try {
        parsed = responseText ? JSON.parse(responseText) : {};
      } catch (err) {
        parsed = {};
      }

      return {
        ok: true,
        contactId: parsed.id || '',
        error: ''
      };
    }

    return {
      ok: false,
      contactId: '',
      error: `Brevo error ${statusCode}: ${responseText}`
    };

  } catch (error) {
    return {
      ok: false,
      contactId: '',
      error: String(error && error.message ? error.message : error)
    };
  }
}

function createBrevoAttribute_(name, type) {
  const apiKey = getBrevoApiKey_();

  if (!apiKey) {
    throw new Error('Missing BREVO_API_KEY in Apps Script Properties.');
  }

  const response = UrlFetchApp.fetch(`${BREVO_API_BASE}/contacts/attributes/normal/${encodeURIComponent(name)}`, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'api-key': apiKey,
      'accept': 'application/json'
    },
    payload: JSON.stringify({ type: type }),
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();

  Logger.log(`${name}: ${statusCode} ${responseText}`);

  return {
    name: name,
    statusCode: statusCode,
    response: responseText
  };
}

function runSetupBrevoAttributes() {
  const attributes = [
    { name: 'FIRSTNAME', type: 'text' },
    { name: 'LASTNAME', type: 'text' },
    { name: 'SOURCE', type: 'text' },
    { name: 'INTEREST', type: 'text' },
    { name: 'CONTACT_TYPE', type: 'text' },
    { name: 'SIGNUP_DATE', type: 'date' }
  ];

  const results = attributes.map(attribute => {
    try {
      return createBrevoAttribute_(attribute.name, attribute.type);
    } catch (error) {
      return {
        name: attribute.name,
        statusCode: 'ERROR',
        response: String(error && error.message ? error.message : error)
      };
    }
  });

  Logger.log(JSON.stringify(results, null, 2));
  return results;
}

function runTestBrevoNewsletterSync() {
  const testData = {
    name: 'Test Subscriber',
    email: ADMIN_EMAIL,
    interests: 'events, new-practitioners',
    source: 'Apps Script Test'
  };

  const result = syncNewsletterToBrevo_(testData);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

// ============================================
// BREVO TRANSACTIONAL TEMPLATE EMAILS
// ============================================

function hbGetScriptProperty_(key, fallback) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  return value || fallback || '';
}

function hbGetBrevoApiKey_() {
  return hbGetScriptProperty_('BREVO_API_KEY', '');
}

function hbGetTemplateId_(templateKey) {
  const propertyKey = `BREVO_TEMPLATE_${templateKey}`;
  const raw = PropertiesService.getScriptProperties().getProperty(propertyKey);
  return raw ? Number(raw) : null;
}

function hbBrevoBaseUrl_() {
  return 'https://api.brevo.com/v3';
}

function hbSiteUrl_() {
  return hbGetScriptProperty_('SITE_URL', 'https://herbtropia.com').replace(/\/$/, '');
}

function hbSplitName_(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : ''
  };
}

function hbGetTitle_(data) {
  return data.businessName || data.eventName || data.name || data.organizerName || 'Herbtropia Submission';
}

function hbBuildEmailParams_(data) {
  const websiteUrl = hbSiteUrl_();
  const fullName = data.name || data.organizerName || data.businessName || '';
  const nameParts = hbSplitName_(fullName);

  return {
    firstName: nameParts.firstName || fullName || 'there',
    lastName: nameParts.lastName || '',
    name: fullName,
    businessName: data.businessName || '',
    eventName: data.eventName || '',
    organizerName: data.organizerName || '',
    title: hbGetTitle_(data),
    email: data.email || '',
    phone: data.phone || '',
    status: data.status || '',
    reviewNotes: data.reviewNotes || '',
    city: data.city || '',
    state: data.state || '',
    eventDate: data.eventDate || '',
    startTime: data.startTime || '',
    venue: data.venue || '',
    websiteUrl: websiteUrl,
    directoryUrl: `${websiteUrl}/directory.html`,
    eventsUrl: `${websiteUrl}/events.html`,
    newsletterUrl: `${websiteUrl}/newsletter.html`,
    practitionerSignupUrl: `${websiteUrl}/practitioner-signup.html`,
    submitEventUrl: `${websiteUrl}/submit-event.html`
  };
}

function hbSendBrevoTemplate_(templateKey, toEmail, toName, data) {
  try {
    const apiKey = hbGetBrevoApiKey_();

    if (!apiKey) {
      return {
        ok: false,
        error: 'Missing BREVO_API_KEY in Apps Script Properties.'
      };
    }

    const templateId = hbGetTemplateId_(templateKey);

    if (!templateId) {
      return {
        ok: false,
        error: `Missing template ID. Add BREVO_TEMPLATE_${templateKey} in Apps Script Properties.`
      };
    }

    if (!toEmail) {
      return {
        ok: false,
        error: `Missing recipient email for ${templateKey}.`
      };
    }

    const payload = {
      to: [
        {
          email: String(toEmail).trim(),
          name: toName || ''
        }
      ],
      templateId: templateId,
      params: hbBuildEmailParams_(data || {})
    };

    const response = UrlFetchApp.fetch(`${hbBrevoBaseUrl_()}/smtp/email`, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'api-key': apiKey,
        'accept': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode >= 200 && statusCode < 300) {
      return {
        ok: true,
        statusCode: statusCode,
        response: responseText
      };
    }

    return {
      ok: false,
      statusCode: statusCode,
      error: `Brevo email error ${statusCode}: ${responseText}`
    };

  } catch (error) {
    return {
      ok: false,
      error: String(error && error.message ? error.message : error)
    };
  }
}

function hbSendTemplateWithFallbackLog_(templateKey, toEmail, toName, data) {
  const result = hbSendBrevoTemplate_(templateKey, toEmail, toName, data);
  Logger.log(`${templateKey}: ${JSON.stringify(result)}`);
  return result;
}

function runTestNewsletterWelcomeTemplate() {
  const result = hbSendBrevoTemplate_(
    'NEWSLETTER_WELCOME',
    ADMIN_EMAIL,
    'Marlena',
    {
      name: 'Marlena',
      email: ADMIN_EMAIL,
      source: 'Apps Script Test'
    }
  );

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function runTestPractitionerReceivedTemplate() {
  const result = hbSendBrevoTemplate_(
    'PRACTITIONER_RECEIVED',
    ADMIN_EMAIL,
    'Marlena',
    {
      name: 'Marlena',
      businessName: 'Test Wellness Practice',
      email: ADMIN_EMAIL,
      city: 'Mesa',
      state: 'AZ'
    }
  );

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function runTestEventReceivedTemplate() {
  const result = hbSendBrevoTemplate_(
    'EVENT_RECEIVED',
    ADMIN_EMAIL,
    'Marlena',
    {
      organizerName: 'Marlena',
      eventName: 'Test Wellness Event',
      email: ADMIN_EMAIL,
      city: 'Phoenix',
      state: 'AZ',
      eventDate: '2026-06-01'
    }
  );

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function hbSendInPersonReviewInterestIfNeeded_(data) {
  const reviewInterest = String(data.reviewInterest || '').toLowerCase();

  const requestedReview =
    reviewInterest.includes('yes-review-in-person') ||
    reviewInterest.includes('media-pass-available') ||
    reviewInterest.includes('open-to-content-collab');

  if (!requestedReview) return false;

  const result = hbSendTemplateWithFallbackLog_(
    'IN_PERSON_REVIEW_INTEREST',
    data.email,
    data.organizerName || data.eventName || '',
    data
  );

  return result.ok;
}