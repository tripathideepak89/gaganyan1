export const airlineWebsiteMap: { [carrierCode: string]: string } = {
  'AA': 'https://www.aa.com/', 'DL': 'https://www.delta.com/', 'UA': 'https://www.united.com/',
  'WN': 'https://www.southwest.com/', 'B6': 'https://www.jetblue.com/', 'AS': 'https://www.alaskaair.com/',
  'NK': 'https://www.spirit.com/', 'F9': 'https://www.flyfrontier.com/', 'HA': 'https://www.hawaiianairlines.com/',
  'LH': 'https://www.lufthansa.com/', 'BA': 'https://www.britishairways.com/', 'AF': 'https://www.airfrance.us/',
  'KL': 'https://www.klm.com/', 'EK': 'https://www.emirates.com/', 'QR': 'https://www.qatarairways.com/',
  'SQ': 'https://www.singaporeair.com/', 'CX': 'https://www.cathaypacific.com/', 'NH': 'https://www.ana.co.jp/',
  'JL': 'https://www.jal.co.jp/', 'KE': 'https://www.koreanair.com/', 'EY': 'https://www.etihad.com/',
  'TK': 'https://www.turkishairlines.com/',
};

export const getAirlineBookingUrl = (carrierCode: string): string => {
  const baseUrl = airlineWebsiteMap[carrierCode.toUpperCase()];
  if (baseUrl) {
    const url = new URL(baseUrl);
    url.searchParams.append('utm_source', 'travelbilli_ai_travel');
    url.searchParams.append('utm_medium', 'referral');
    return url.toString();
  }
  return `https://www.google.com/search?q=${encodeURIComponent(carrierCode + ' airline booking')}`;
};

export const formatISODuration = (isoDuration: string): string => {
  if (!isoDuration) return '';
  const matches = isoDuration.match(/PT(\d+H)?(\d+M)?/);
  if (!matches) return '';
  const hours = matches[1] ? parseInt(matches[1].slice(0, -1), 10) : 0;
  const minutes = matches[2] ? parseInt(matches[2].slice(0, -1), 10) : 0;
  
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
};
