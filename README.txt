AURUM HEALTH — CORRECTED COLLEGE PROJECT VERSION

SETUP
1. Extract this ZIP into a new folder.
2. Open Command Prompt in that folder.
3. Run: node server.js
4. Open: http://localhost:3000
5. Register a demo account or log in.

WHAT WAS PRESERVED
- Original Home dashboard content (except the four Home shortcut cards requested for removal).
- Aurum Health lotus logo and app name on Home.
- Original five-tab navigation: Home, Records, Care, Emergency, Profile.
- Original Care, Emergency, Scan and Report screens.
- Original login, profile and design assets.

REQUESTED CHANGES
- Removed only the Scan Report hero and Records/Care/Emergency shortcut tiles from Home.
- Records now contains a medical document upload form, an all-records list, view/delete actions, a Scan & Understand entry point, and an Insurance Details form with optional document attachment.
- Uploaded PDFs/images (up to 6 MB) are stored locally in data/uploads and listed for the signed-in demo account.

IMPORTANT DEMO LIMITATIONS
- The scanner screen is a visual demonstration; it does not perform real camera capture, OCR, or AI medical interpretation.
- Use sample files and sample insurance information only. This is not a secure medical-record system.
- No real emergency calls are placed.

To retain data when replacing an earlier copy, copy its data/db.json and data/uploads folder into this version's data folder before starting it.

ADDITIONAL FUNCTIONAL CARE FEATURES
- Follow-up reminders are saved to the local database, appear in Care, and can be marked complete by selecting the reminder card.
- Due-time browser notifications are scheduled while the Care page is open (browser notification permission is required).
- Upcoming appointments can be added, viewed, and exported to a calendar using the existing Add to Calendar control (.ics file).
- The existing consultation-preparation checklist saves its checked state to the local database and restores it when reopened.
- The Metformin dose status is saved per day and restored when Care is opened again.
- The existing Vitamin D3 Remind control creates a saved follow-up reminder.
- Appointment reminders can notify the user one day before an appointment if the app remains open.

NOTIFICATION NOTE
Browser notifications depend on browser permission and the Care page remaining open. This demo does not run background notifications when the browser/server is closed.

REPAIRED INTERACTIONS + UPDATED COLOUR PALETTE
- Fixed the login click interception so the Login form reaches the backend and a successful login opens Home. The Create demo account action also registers and signs in.
- The Scan screen now opens the device file picker (and requests the camera on supported mobile browsers) and saves the selected image/PDF into Records.
- Records upload, list, view, delete, insurance details save, and insurance-document view are connected to the local API.
- Care reminders and appointments are saved per account; reminder cards can be marked complete, appointments can be opened as calendar files, and the consultation checklist and daily Metformin status persist.
- Profile Edit Profile, Change Security Password, Family Vault add/remove, and Log Out controls are connected.
- The Report screen downloads a text summary, copies its summary, and opens the latest saved record when View Full PDF is selected. Its CBC interpretation remains example content for the college demonstration.
- Applied a consistent golden, lavender, and dark-green palette using a shared stylesheet without changing the screen structure or navigation.

TESTING
- JavaScript syntax checks passed for server.js, app-client.js, and all inline page scripts.
- Local API smoke tests passed for registration/login, records upload, insurance, reminders, appointments, preparation checklist, medication log, family members, and password update.
- The scanner accepts local file/camera input, but automatic OCR or AI diagnosis is not included. Browser-level interaction testing was blocked in this environment; please run the included steps on your computer and check the screens in Chrome.

HOME DASHBOARD UI REVISION
- Reworked Home into three clear sections: Medicine Reminders, Appointments, and Recent Activity.
- Added clean in-page forms for creating medicine reminders and appointments (instead of browser prompt pop-ups).
- Medicine reminders continue to use the saved /api/reminders data and can be marked Taken / reopened.
- Appointment cards continue to show upcoming visits and support Add to Calendar and View Details.
- Recent Activity is assembled from the signed-in user's saved reminders, appointments, and medical records.
- Added a Premium feature panel at the bottom with Pre-consultation Prep and Family Health Vault, showing illustrative pricing from ₹49/month.
- Updated Home styling with forest green, lavender surfaces, and restrained gold accents; the other screens and existing APIs were left in place.
