import comedy from './comedy.jpg';
import pubQuiz from './pub-quiz.jpg';
import languageExchange from './language-exchange.jpg';
import social from './social.jpg';
import singles from './singles.jpg';
import djMusic from './dj-music.jpg';
import liveMusic from './live-music.jpg';
import other from './other.jpg';

export const categoryImages: Record<string, string> = {
  'comedy': comedy,
  'pub-quiz': pubQuiz,
  'language-exchange': languageExchange,
  'social': social,
  'singles': singles,
  'dj-music': djMusic,
  'live-music': liveMusic,
  'other': other,
};

export function getCategoryImage(categoryId: string): string {
  return categoryImages[categoryId] || other;
}
