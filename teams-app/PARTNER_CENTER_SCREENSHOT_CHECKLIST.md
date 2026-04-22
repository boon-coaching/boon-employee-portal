# Partner Center Screenshot Checklist — v1.0.7 Resubmission

Microsoft's 2026-04-22 validation against v1.0.6 listed every Partner-Center-side fix as "implemented but no screenshots received." This cycle, send screenshots BEFORE resubmitting so the validator has everything they need to close those issues in the same pass they validate the Test-Blocker fix.

Use https://partner.microsoft.com/ > Marketplace offers > Boon Coaching (Product ID `ac42d19b-cd91-4d1b-8314-0b8a75b47e04`).

Name each file `pc-<number>-<slug>.png`.

## 1. Packages — v1.0.7 uploaded
**Path:** Product overview > Plan overview > Packages
**Capture:** the uploaded package row showing filename `boon-coaching-v1.0.7.zip` and manifest version `1.0.7`. Make sure the timestamp is visible.
**Closes issue:** proves the manifest version with the OAuth fix is live.

## 2. Marketplace listing — Short description (Issue #13)
**Path:** Product overview > Marketplace listings > en-us > Description
**Capture:** the Short description field showing the corrected copy that matches the manifest.
**Closes issue:** Must-Fix #13 (incorrect app name / short description mismatch).

## 3. Marketplace listing — Long description with hyperlinks (Issues #3, #12)
**Path:** same as above, Long description field.
**Capture:** full long description with Sign Up / Get Started / Help / Contact Us rendered as hyperlinks (HTML). Scroll and stitch two screenshots if needed.
**Closes issue:** Must-Fix #3 (long description guidelines) AND Good-to-Fix #12 (contact/help/signup hyperlinks).

## 4. Marketplace listing — Screenshots with captions (Issue #8)
**Path:** Product overview > Marketplace listings > en-us > Store images > Screenshots
**Capture:** the screenshots list showing all uploaded screenshots AND each caption field populated.
**Closes issue:** Must-Fix #8 (missing captions). This was flagged AGAIN on 2026-04-22 — do not submit without populated captions this time.

## 5. Marketplace listing — Icons (Issue #14)
**Path:** Product overview > Marketplace listings > en-us > Store images > Icons
**Capture:** Large (300x300) and Small (48x48) icons uploaded and matching the in-Teams manifest icons (`color.png` / `outline.png`).
**Closes issue:** Must-Fix #14 (icon/metadata mismatch).

## 6. Notes for certification
**Path:** Product overview > Review and publish > Additional certification info > Notes for certification
**Capture:** the notes field populated with the body from `PARTNER_CENTER_NOTES.txt` (v1.0.7). Make sure the TEST CREDENTIALS section is visible so they can confirm creds are in Partner Center (not email).

---

## Reply email attachment bundle (send BEFORE resubmit)

1. `boon-coaching-v1.0.7.zip` (at `~/boon-employee-portal/teams-app/`)
2. `certification-notes.pdf` (regenerate from updated notes if content changed)
3. `pc-01` through `pc-06` PNGs from above
4. Video recording (Good-to-Fix #9 + Test Blocker #6 ask) — screen capture of the full OAuth connect flow end to end. Target 60-90 seconds. Include: bot install → welcome card → portal Settings → Connect Microsoft Teams → MS sign-in → redirect with "Connected via Microsoft Teams" badge visible → bot responds to `hi` / `help` / random text → Adaptive Card button tap → confirmation card.

Do NOT attach: credentials in email (they're in PC notes), the old v1.0.5/v1.0.6 zips.
