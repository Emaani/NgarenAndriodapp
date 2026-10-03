/**
 * Localization strings (robustness/usability: English-only is a barrier for
 * smallholders). This is the FOUNDATION: English is complete, Kiswahili is a
 * working demonstration locale, and the structure accepts Luganda / Runyankole
 * once native translators provide them (missing keys fall back to English, so a
 * partial locale is safe). Clinical / consent / legal copy is deliberately NOT
 * machine-translated — those keys stay English until professionally reviewed.
 */
export type Locale = 'en' | 'sw';

/** Locales offered in the language picker. Add entries as translations land. */
export const LOCALES: { code: Locale; label: string; english: string }[] = [
  { code: 'en', label: 'English', english: 'English' },
  { code: 'sw', label: 'Kiswahili', english: 'Swahili' },
];

type Dict = Record<string, string>;

const en: Dict = {
  'common.rate': 'Rate',
  'common.language': 'Language',
  'common.chooseLanguage': 'Choose your preferred language',
  'common.available': 'Available',
  'common.busy': 'Busy',
  'common.reviews': 'reviews',
  'findVet.title': 'Find a Vet',
  'findVet.subtitlePreferred': 'Your preferred vets, plus top-rated nearby',
  'findVet.subtitleTopRated': 'Top-rated vets within {km} km',
  'findVet.search': 'Search by name, clinic or specialty...',
  'findVet.emergency': 'Emergency call-out',
  'findVet.emergencySub': 'Alerts available vets near you right away.',
  'findVet.rateRecent': 'Rate your recent {label}',
  'findVet.within': 'Within',
  'findVet.preferred': 'Your preferred vets',
  'findVet.topRated': 'Top-rated near you',
  'findVet.noPreferred':
    'You haven’t chosen a preferred vet yet. Book a top-rated vet below and tap ★ on their profile to set them as your preferred provider — future bookings tie to their calendar.',
  'findVet.requestCallout': 'Request a Call-out',
  'findVet.book': 'Book',
  'findVet.request': 'Request',
  'findVet.visit': 'visit',
  'findVet.visits': 'visits',
  'findVet.noneTitle': 'No vets within range',
  'findVet.noneOtherTitle': 'No other vets within range',
};

// Kiswahili — demonstration locale. Common, non-clinical UI strings only.
const sw: Dict = {
  'common.rate': 'Kadiria',
  'common.language': 'Lugha',
  'common.chooseLanguage': 'Chagua lugha unayopendelea',
  'common.available': 'Anapatikana',
  'common.busy': 'Ana shughuli',
  'common.reviews': 'maoni',
  'findVet.title': 'Tafuta Daktari wa Mifugo',
  'findVet.subtitlePreferred': 'Madaktari wako pendwa, pamoja na bora walio karibu',
  'findVet.subtitleTopRated': 'Madaktari bora ndani ya km {km}',
  'findVet.search': 'Tafuta kwa jina, kliniki au utaalamu...',
  'findVet.emergency': 'Mwito wa dharura',
  'findVet.emergencySub': 'Hujulisha madaktari waliopo karibu nawe mara moja.',
  'findVet.rateRecent': 'Kadiria {label} zako za hivi karibuni',
  'findVet.within': 'Ndani ya',
  'findVet.preferred': 'Madaktari wako pendwa',
  'findVet.topRated': 'Bora walio karibu nawe',
  'findVet.noPreferred':
    'Bado hujachagua daktari pendwa. Weka miadi na daktari bora hapa chini, kisha gusa ★ kwenye wasifu wake ili umweke kama mtoa huduma wako pendwa — miadi yako ijayo itafungamana na kalenda yake.',
  'findVet.requestCallout': 'Omba Mwito',
  'findVet.book': 'Weka miadi',
  'findVet.request': 'Omba',
  'findVet.visit': 'ziara',
  'findVet.visits': 'ziara',
  'findVet.noneTitle': 'Hakuna madaktari katika eneo hili',
  'findVet.noneOtherTitle': 'Hakuna madaktari wengine katika eneo hili',
};

/** Missing keys in a non-English locale fall back to English automatically. */
export const DICTS: Record<Locale, Dict> = { en, sw: { ...en, ...sw } };
