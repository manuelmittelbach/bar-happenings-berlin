import comedy from './comedy.jpg';
import pubQuiz from './pub-quiz.jpg';
import languageExchange from './language-exchange.jpg';
import social from './social.jpg';
import singles from './singles.jpg';
import djMusic from './dj-music.jpg';
import liveMusic from './live-music.jpg';
import other from './other.jpg';
import karaoke from './karaoke.jpg';
import dragCabaret from './drag-cabaret.jpg';
import games from './games.jpg';
import sports from './sports.jpg';

export const categoryImages: Record<string, string> = {
  'comedy': comedy,
  'pub-quiz': pubQuiz,
  'language-exchange': languageExchange,
  'social': social,
  'singles': singles,
  'dj-music': djMusic,
  'live-music': liveMusic,
  'open-mic': comedy,
  'karaoke': karaoke,
  'drag-cabaret': dragCabaret,
  'games': games,
  'sports': sports,
  'screening': other,
  'other': other,
};

export function getCategoryImage(categoryId: string): string {
  return categoryImages[categoryId] || other;
}
