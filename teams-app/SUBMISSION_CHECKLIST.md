# Teams App Store Submission Checklist
## Resubmission for Ticket #5330350 — manifest v1.0.5

## Pre-submission setup (do this BEFORE updating Partner Center)

### 1. Side-load the app into Microsoft's test tenant (Path A)
- Sign in to Teams Admin Center as `admin@M365x34009223.onmicrosoft.com` (creds in the validator's email).
- Upload `teams-app.zip` (manifest v1.0.5) as a custom app for the org.
- Confirm `adelev@M365x34009223.onmicrosoft.com` can see "Boon Coaching" under Apps > Built for your org.
- This is what unblocks the validator's "couldn't test end-to-end" complaint.

### 2. Verify the Boon portal test account
- Confirm `alex.simmons@boon-health.com` / `BoonTeams2026Review!` still works at https://my.boon-health.com.
- Confirm Settings page shows BOTH "Connect Slack" and "Connect Microsoft Teams" buttons after the portal deploy ships.

## Partner Center Updates

### Notes for certification
Open `PARTNER_CENTER_NOTES.txt` in this directory and paste the entire body into the "Notes for certification" field under Product overview > Review and publish > Additional certification info.

### Test credentials (Partner Center, NOT email)
Per validator request, do NOT email creds. Submit them via Partner Center in the notes block (already included in `PARTNER_CENTER_NOTES.txt`).

### Packages
Upload `teams-app.zip` from this directory (manifest v1.0.5)

### Properties
Developer name: **Boon Coaching**

### Marketplace Listings

**Short description:**
Coaching nudges and action reminders from Boon

**Long description:**
Receive coaching nudges, action item reminders, goal check-ins, and session prep notifications directly in Microsoft Teams from your Boon coaching program.

In order to use this app, you need to have an active Boon Coaching account. Please visit https://www.boon-health.com/contact or contact support@boon-health.com for more details.

Sign up: https://www.boon-health.com
Get started: https://www.boon-health.com/teams-support
Contact us: support@boon-health.com
Help: https://www.boon-health.com/teams-support

**Screenshots:** Take screenshots of bot in Teams showing welcome message, nudge card, button interaction. Add captions to each.

**Icons:** Upload `color.png` (192x192) and `outline.png` (32x32) from this directory.

### App Compliance
Start Publisher Attestation in M365 App Compliance Program

### Optional (good-to-fix)
- Mobile screenshots
- Short demo video
- publisherDocsUrl already set in manifest -> https://www.boon-health.com/teams-support

## IMPORTANT
Do NOT resubmit via Partner Center until Microsoft confirms via email.
