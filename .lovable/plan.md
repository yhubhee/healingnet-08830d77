
# Hospital Settings Page

## Overview
Add a comprehensive hospital settings page with four tabbed sections: Hospital Profile, Staff Roles, Departments, and Notification Preferences. This includes both the frontend partial (HTML with client-side JS) and the backend API route.

## What Gets Built

### 1. Frontend Partial -- `public/export/partials/hospital/settings.html`
A tabbed settings page following the existing pattern (queue-filter-btn tabs, tab-panel containers, fetch with credentials):

**Tab 1 -- Hospital Profile**
- Editable form: hospital name, address, phone, email, logo URL, website, operating hours, description
- Fetches current profile from API on load, submits updates via PUT

**Tab 2 -- Staff Roles**
- Table listing all hospital_staff with name, email, role, department, status
- Inline role dropdown to change a staff member's role (admin, receptionist, nurse, lab_tech, pharmacist, manager, medical_officer)
- Toggle to activate/deactivate staff
- "Add Staff" modal with registration form

**Tab 3 -- Departments**
- List of unique departments derived from hospital_staff and hospital_doctors
- Add/rename/remove department functionality
- Shows staff count per department

**Tab 4 -- Notification Preferences**
- Toggle switches for: new patient check-ins, appointment reminders, low stock pharmacy alerts, lab result completion, billing overdue, referral updates, emergency alerts
- Saves preferences per hospital via API

### 2. Backend Route -- `backend/routes/hospital/settings.js`
Endpoints (all protected by `requireHospitalAuth`; profile/staff management requires `requireHospitalAdmin`):

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/hospital/settings/profile` | Get hospital profile |
| PUT | `/api/hospital/settings/profile` | Update hospital profile |
| GET | `/api/hospital/settings/staff` | List all staff |
| POST | `/api/hospital/settings/staff` | Add new staff member |
| PUT | `/api/hospital/settings/staff/:id/role` | Change staff role |
| PUT | `/api/hospital/settings/staff/:id/status` | Toggle staff active status |
| GET | `/api/hospital/settings/departments` | List departments with counts |
| GET | `/api/hospital/settings/notifications` | Get notification prefs |
| PUT | `/api/hospital/settings/notifications` | Update notification prefs |

### 3. Database Addition
Add a `hospital_notification_preferences` table to `hospital-schema.sql`:
- `hospital_id`, `pref_key` (e.g. "new_checkin", "low_stock"), `enabled` (boolean)

### 4. Server Registration
Register the new settings route in `backend/server.js`.

## Technical Notes
- The sidebar already has the Settings link wired to the correct partial path -- no changes needed to `index.html`
- Tab switching will use the established `onclick="showSettingsTab('tabName', this)"` pattern with `queue-filter-btn` classes
- Staff password creation uses bcryptjs hashing, consistent with `auth.js`
- All fetch calls use `credentials: 'include'` for cookie-based JWT auth
