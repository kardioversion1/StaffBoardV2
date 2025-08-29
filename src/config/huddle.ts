export interface HuddleItem {
  id: string;
  label: string;
  section: string;
  required?: boolean;
}

export const DEFAULT_HUDDLE_ITEMS: HuddleItem[] = [
  { id: 'staffing_ok', label: 'Staffing adequate', section: 'Staffing & Assignments', required: true },
  { id: 'ops_status', label: 'Imaging/Lab/IT status good', section: 'Operational Status' },
  { id: 'psych_sitter', label: 'Psych/sitter coverage', section: 'Operational Status' },
  { id: 'stroke_ready', label: 'Stroke/TNK pathway ready', section: 'Time-Critical Protocols' },
  { id: 'stemi_ready', label: 'STEMI/PCI pathway ready', section: 'Time-Critical Protocols' },
  { id: 'sepsis_watch', label: 'Open sepsis orders', section: 'Time-Critical Protocols' },
  // An escalation path outlines who to contact when an issue needs additional assistance.
  { id: 'escalation_ok', label: 'Escalation path confirmed', section: 'Comms & Escalation' },
  { id: 'announcements', label: 'Announcements covered', section: 'Comms & Escalation' },
];
