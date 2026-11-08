/**
 * Service codes (Tester feedback 2026-11-08): every service a farmer can
 * request carries a fixed code, written on the booking, so service KPIs,
 * data and finance reports can count and charge by service.
 */
export const SERVICE_CODES: Record<string, string> = {
  Registration: 'NGS-REG',
  Treatment: 'NGS-HLT',
  Stocktaking: 'NGS-STK',
  Linkage: 'NGS-LNK',
  Tagging: 'NGS-TAG',
  Consultation: 'NGS-ADV',
  Vaccination: 'NGS-VAC',
  'Follow-up': 'NGS-FUP',
  'Artificial Insemination': 'NGS-AI',
};

/** The services offered when a farmer asks Ngaren to handle a record. */
export const NGAREN_SERVICES = ['Registration', 'Treatment', 'Stocktaking'];

export const serviceCode = (service: string): string => SERVICE_CODES[service.trim()] ?? 'NGS-OTH';

/** "NGS-REG, NGS-HLT" for a booking's services. */
export const serviceCodes = (services: string[]): string => [...new Set(services.map(serviceCode))].join(', ');
