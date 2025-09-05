# StaffBoard Visual Interface Guide

## Header
The top header shows the current shift and date, a large clock, and action buttons to change the theme, open shift huddles or sign out, sync data, and refresh【F:src/ui/header.ts†L41-L55】. The Shift Huddle includes a "Completed By" field that lets you select a nurse or enter a name manually.

## Navigation Tabs
Below the header, tabs switch between major views: **Board**, **Next Shift**, **Settings**, and **History**【F:src/ui/tabs.ts†L18-L23】

## Board Tab
The Board presents the live staffing picture. The left column contains panels for the patient care team, nurse assignments, and a comments box【F:src/ui/board.ts†L82-L101】. The right column offers weather information, incoming patients with an add button, recently offgoing staff, and a read‑only physician schedule【F:src/ui/board.ts†L104-L124】

## Next Shift Tab
The Next Shift tab is used to prepare upcoming shifts. It currently provides placeholder controls for saving a draft and publishing it to the main board【F:src/ui/nextShift/NextShiftPage.ts†L1-L36】

## Settings Tab
Settings combines roster management and display options. It includes a roster pane, areas for editing nurse details, general settings, display settings, and separate sections for widgets and a nurse type legend【F:src/ui/settings.ts†L31-L41】

## History Tab
The History tab provides access to past data. Navigation buttons switch between views for dates, individual nurses, and recorded huddles, with a CSV export button available on all views【F:src/history/index.ts†L17-L24】

### By Date
The calendar view lets you select a date, load or save snapshots, and export single days or ranges to CSV【F:src/history/CalendarView.ts†L30-L44】

### By Nurse
This view allows selecting a nurse, loading their recent shifts into a table, and exporting the results to CSV【F:src/history/NurseHistory.ts†L12-L21】

### Huddles
The huddle table lists saved huddle records with all checklist items and notes for each entry, plus an export option for CSV output that opens cleanly in spreadsheet tools【F:src/history/HuddleTable.ts†L11-L33】【F:src/history/index.ts†L99-L123】
