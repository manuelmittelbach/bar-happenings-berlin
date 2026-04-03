import monkeyBar from './monkey-bar.jpg';
import comedyCafe from './comedy-cafe.jpg';
import badehaus from './badehaus.jpg';
import weekendClub from './weekend-club.jpg';
import spaceMeduza from './space-meduza.jpg';
import donau115 from './donau115.jpg';
import alteKantine from './alte-kantine.jpg';
import zBar from './z-bar.jpg';
import belushis from './belushis.jpg';
import fluxbau from './fluxbau.jpg';
import cosmicComedy from './cosmic-comedy.jpg';
import honeyLou from './honey-lou.jpg';
import tipsyBear from './tipsy-bear.jpg';
import theCastle from './the-castle.jpg';

const venueImages: Record<string, string> = {
  'v-monkey-bar': monkeyBar,
  'v2': comedyCafe,
  'v7': badehaus,
  'v29': weekendClub,
  'v30': weekendClub,
  'v31': weekendClub,
  'v24': spaceMeduza,
  'v-donau115': donau115,
  'v8': alteKantine,
  'v-zbar': zBar,
  'v19': belushis,
  'v9': fluxbau,
  'v1': cosmicComedy,
  'v-honeylou': honeyLou,
  'v14': tipsyBear,
  'v-tipsybear': tipsyBear,
  'v-castle': theCastle,
};

export function getVenueImage(venueId: string): string | undefined {
  return venueImages[venueId];
}

export default venueImages;
