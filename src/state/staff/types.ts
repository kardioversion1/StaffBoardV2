export type Staff = {
  id: string;
  name?: string;
  first?: string;
  last?: string;
  rf?: number;
  role: 'nurse' | 'tech';
  type: import('@/domain/lexicon').NurseType;
  active?: boolean;
  notes?: string;
  prefDay?: boolean;
  prefNight?: boolean;
  eligibleRoles?: ('charge' | 'triage' | 'admin')[];
  defaultZone?: string;
  dtoEligible?: boolean;
};
