export interface HuddleItem {
  id: string;
  label: string;
  section: string;
  required?: boolean;
}

export const DEFAULT_HUDDLE_ITEMS: HuddleItem[] = [
  { id: 'staffing_ok', label: 'Staffing adequate', section: 'Staffing & Assignments', required: true },
  { id: 'relief_plan', label: 'Relief/break coverage set', section: 'Staffing & Assignments' },
  { id: 'bed_flow', label: 'Admit bed flow aligned', section: 'Throughput & Beds' },
  { id: 'ems_status', label: 'EMS/diversion status reviewed', section: 'Throughput & Beds' },
  { id: 'ops_status', label: 'Imaging/Lab/IT status good', section: 'Operational Status' },
  { id: 'psych_sitter', label: 'Psych/sitter coverage', section: 'Operational Status' },
  { id: 'code_ready', label: 'Code/airway/blood ready', section: 'Safety & Equipment', required: true },
  { id: 'isolation_ok', label: 'Isolation/neg pressure OK', section: 'Safety & Equipment' },
  { id: 'stroke_ready', label: 'Stroke/TNK pathway ready', section: 'Time-Critical Protocols' },
  { id: 'stemi_ready', label: 'STEMI/PCI pathway ready', section: 'Time-Critical Protocols' },
  { id: 'sepsis_watch', label: 'Sepsis bundle watchouts', section: 'Time-Critical Protocols' },
  { id: 'trauma_plan', label: 'Trauma activation plan', section: 'Time-Critical Protocols' },
  { id: 'roles_named', label: 'Roles named (Charge/Triage/Code)', section: 'Comms & Escalation', required: true },
  { id: 'escalation_ok', label: 'Escalation path confirmed', section: 'Comms & Escalation' },
  { id: 'announcements', label: 'Announcements covered', section: 'Comms & Escalation' },
];
