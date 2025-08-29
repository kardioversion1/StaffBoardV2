# StaffBoard Visual Interface Guide

## Header
The top header shows the current shift and date, a large clock, and action buttons to change the theme, open shift huddles or sign out, sync data, refresh, and reset the cache【F:src/ui/header.ts†L40-L55】

## Navigation Tabs
Below the header, tabs switch between major views: **Board**, **Builder**, **Settings**, and **History**. The Builder tab appears only when enabled by a feature flag【F:src/ui/tabs.ts†L19-L24】

## Board Tab
The Board presents the live staffing picture. The left column contains panels for the patient care team, nurse assignments, and a comments box【F:src/ui/board.ts†L82-L101】. The right column offers weather information, incoming patients with an add button, recently offgoing staff, and a read‑only physician schedule【F:src/ui/board.ts†L104-L124】

## Builder Tab
The Builder tab is used to prepare upcoming shifts. A roster panel with search appears on the left, while the right side lets you assign staff to patient care roles or zones and provides Save and Submit buttons to store or publish the draft【F:src/ui/builder.ts†L42-L69】

## Settings Tab
Settings combines roster management and display options. It includes a roster pane, areas for editing nurse details, general settings, display settings, and separate sections for widgets and a nurse type legend【F:src/ui/settings.ts†L31-L41】

## History Tab
The History tab provides access to past data. Navigation buttons switch between views for dates, individual nurses, and recorded huddles, with a CSV export button available on all views【F:src/history/index.ts†L17-L24】

### By Date
The calendar view lets you select a date, load or save snapshots, and export single days or ranges to CSV【F:src/history/CalendarView.ts†L30-L44】

### By Nurse
This view allows selecting a nurse, loading their recent shifts into a table, and exporting the results to CSV【F:src/history/NurseHistory.ts†L12-L21】

### Huddles
The huddle table lists saved huddle records with an export option for CSV output【F:src/history/HuddleTable.ts†L11-L20】
