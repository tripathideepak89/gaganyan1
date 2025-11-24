export const airlineWebsiteMap: { [carrierCode: string]: string } = {
  // Asia-Pacific
  '6E': 'https://www.goindigo.in/',
  'AI': 'https://www.airindia.com/',
  'BR': 'https://www.evaair.com/',
  'CA': 'https://www.airchina.us/',
  'CX': 'https://www.cathaypacific.com/',
  'CZ': 'https://www.csair.com/',
  'GA': 'https://www.garuda-indonesia.com/',
  'JL': 'https://www.jal.co.jp/',
  'KE': 'https://www.koreanair.com/',
  'MH': 'https://www.malaysiaairlines.com/',
  'MU': 'https://us.ceair.com/',
  'NH': 'https://www.ana.co.jp/',
  'NZ': 'https://www.airnewzealand.com/',
  'OZ': 'https://flyasiana.com/',
  'PR': 'https://www.philippineairlines.com/',
  'QF': 'https://www.qantas.com/',
  'SG': 'https://www.spicejet.com/',
  'SQ': 'https://www.singaporeair.com/',
  'TG': 'https://www.thaiairways.com/',
  'UK': 'https://www.airvistara.com/',
  'VA': 'https://www.virginaustralia.com/',
  'VN': 'https://www.vietnamairlines.com/',

  // Europe
  'AF': 'https://www.airfrance.us/',
  'AY': 'https://www.finnair.com/',
  'BA': 'https://www.britishairways.com/',
  'DY': 'https://www.norwegian.com/',
  'EI': 'https://www.aerlingus.com/',
  'FR': 'https://www.ryanair.com/',
  'IB': 'https://www.iberia.com/',
  'KL': 'https://www.klm.com/',
  'LH': 'https://www.lufthansa.com/',
  'LO': 'https://www.lot.com/',
  'LX': 'https://www.swiss.com/',
  'OS': 'https://www.austrian.com/',
  'PC': 'https://www.flypgs.com/',
  'SK': 'https://www.flysas.com/',
  'SN': 'https://www.brusselsairlines.com/',
  'TP': 'https://www.flytap.com/',
  'TK': 'https://www.turkishairlines.com/',
  'U2': 'https://www.easyjet.com/',
  'VS': 'https://www.virginatlantic.com/',
  'W6': 'https://wizzair.com/',

  // North America
  'AA': 'https://www.aa.com/',
  'AC': 'https://www.aircanada.com/',
  'AM': 'https://aeromexico.com/',
  'AS': 'https://www.alaskaair.com/',
  'B6': 'https://www.jetblue.com/',
  'DL': 'https://www.delta.com/',
  'F9': 'https://www.flyfrontier.com/',
  'HA': 'https://www.hawaiianairlines.com/',
  'NK': 'https://www.spirit.com/',
  'UA': 'https://www.united.com/',
  'WN': 'https://www.southwest.com/',
  'WS': 'https://www.westjet.com/',

  // South America
  'AV': 'https://www.avianca.com/',
  'CM': 'https://www.copaair.com/',
  'LA': 'https://www.latamairlines.com/',
  
  // Middle East & Africa
  'EK': 'https://www.emirates.com/',
  'ET': 'https://www.ethiopianairlines.com/',
  'EY': 'https://www.etihad.com/',
  'KQ': 'https://www.kenya-airways.com/',
  'MS': 'https://www.egyptair.com/',
  'QR': 'https://www.qatarairways.com/',
  'RJ': 'https://www.rj.com/',
  'SA': 'https://www.flysaa.com/',
  'SV': 'https://www.saudia.com/',
};

export const getAirlineBookingUrl = (
    carrierCode: string, 
    origin?: string, 
    destination?: string, 
    departureDate?: string, 
    returnDate?: string
): string => {
  const baseUrl = airlineWebsiteMap[carrierCode.toUpperCase()];
  if (baseUrl) {
    const url = new URL(baseUrl);
    url.searchParams.append('utm_source', 'travelbilli_ai_travel');
    url.searchParams.append('utm_medium', 'referral');
    return url.toString();
  }

  // Fallback to Google Flights deep link
  if (origin && destination && departureDate) {
    let fltParam = `${origin}.${destination}.${departureDate}`;
    if (returnDate) {
      fltParam += `*${destination}.${origin}.${returnDate}`;
    }
    return `https://www.google.com/flights#flt=${fltParam}`;
  }
  
  // Last resort fallback
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
