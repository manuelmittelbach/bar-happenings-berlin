export interface BarlinEvent {
  id: string;
  title: string;
  venue: string;
  venueId: string;
  neighborhood: string;
  address: string;
  date: string;
  startTime: string;
  endTime: string;
  category: string;
  tags: string[];
  summary: string;
  description: string;
  image: string;
  entryInfo: string;
  interestedCount: number;
  language: string;
  featured?: boolean;
}

export interface Venue {
  id: string;
  name: string;
  neighborhood: string;
  address: string;
  description: string;
  image: string;
  instagram?: string;
  website?: string;
}

export interface Question {
  id: string;
  author: string;
  text: string;
  date: string;
  replies: { author: string; text: string; date: string; isVenue?: boolean }[];
}

export const categories = [
  "Live Music", "DJ Sets", "Quiz Nights", "Games & Tournaments",
  "Language Exchange", "Cultural Meetups", "Comedy", "Open Mic",
  "Poetry", "Screenings", "Community Events", "Art & Creative",
  "Workshops", "Food & Drink Specials", "Social Hangouts", "Pop-up Events",
];

export const neighborhoods = [
  "Neukölln", "Kreuzberg", "Friedrichshain", "Wedding",
  "Prenzlauer Berg", "Mitte", "Schöneberg", "Charlottenburg", "Moabit",
];

const today = new Date();
const fmt = (d: Date) => d.toISOString().split("T")[0];
const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);
const in3 = new Date(today); in3.setDate(today.getDate() + 3);
const in4 = new Date(today); in4.setDate(today.getDate() + 4);
const in5 = new Date(today); in5.setDate(today.getDate() + 5);

export const venues: Venue[] = [
  { id: "v1", name: "Kastanienbar", neighborhood: "Neukölln", address: "Weserstr. 42, 12045 Berlin", description: "A cozy corner bar on Weserstraße known for its eclectic live music program and handmade cocktails. Regulars and newcomers share the same worn wooden tables.", image: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=600&q=80" },
  { id: "v2", name: "Trinkhalle", neighborhood: "Kreuzberg", address: "Oranienstr. 185, 10999 Berlin", description: "Part dive bar, part cultural space. Trinkhalle hosts everything from punk shows to philosophy circles. Cash only, no pretense.", image: "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=600&q=80", instagram: "@trinkhalle_xberg" },
  { id: "v3", name: "Nebelhorn", neighborhood: "Friedrichshain", address: "Simon-Dach-Str. 9, 10245 Berlin", description: "A dimly lit neighborhood bar with an excellent vinyl selection and a stage that's hosted some of Berlin's best emerging acts.", image: "https://images.unsplash.com/photo-1525268323446-0505b6fe7778?w=600&q=80" },
  { id: "v4", name: "Zum Goldenen Hahn", neighborhood: "Wedding", address: "Müllerstr. 128, 13353 Berlin", description: "A Wedding institution since 2009. Equal parts kneipe and community center. They serve their own infused spirits and host a legendary quiz night.", image: "https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=600&q=80" },
  { id: "v5", name: "Lichtblick", neighborhood: "Prenzlauer Berg", address: "Kastanienallee 77, 10435 Berlin", description: "Small cinema-bar hybrid showing independent films and hosting thoughtful cultural events in a warm, book-lined space.", image: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&q=80" },
  { id: "v6", name: "Schwarzes Café", neighborhood: "Mitte", address: "Torstr. 66, 10119 Berlin", description: "A minimalist bar with maximal taste. Known for its rotating art exhibitions on the walls and experimental music on the speakers.", image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&q=80" },
  { id: "v7", name: "Pingpong Palast", neighborhood: "Kreuzberg", address: "Graefestr. 71, 10967 Berlin", description: "Three ping-pong tables, cheap beer, and a competitive spirit. Drop in for casual games or sign up for their weekly tournament.", image: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80" },
  { id: "v8", name: "Morgenrot", neighborhood: "Neukölln", address: "Sonnenallee 101, 12045 Berlin", description: "An anarchist-leaning café-bar with vegan food, a small library, and a calendar packed with community events and language exchanges.", image: "https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=600&q=80" },
];

export const events: BarlinEvent[] = [
  {
    id: "e1", title: "Acoustic Sessions: Strings & Things", venue: "Kastanienbar", venueId: "v1",
    neighborhood: "Neukölln", address: "Weserstr. 42, 12045 Berlin",
    date: fmt(today), startTime: "20:00", endTime: "23:00", category: "Live Music",
    tags: ["Live Music", "Acoustic", "Free Entry", "Neukölln", "Tonight"],
    summary: "Three local singer-songwriters share the small stage for an intimate evening of acoustic music, storytelling, and good beer.",
    description: "Join us for an evening of stripped-back acoustic music at Kastanienbar. Three Berlin-based singer-songwriters — Mara Lind, João Ferreira, and Nils Petersen — share the tiny stage for an intimate night of original songs, covers, and the kind of between-song stories that only happen in small rooms.\n\nExpect folk, indie, and a few unexpected covers. The bar serves handmade cocktails and a solid selection of local craft beers. Arrive early for a good seat — this one tends to fill up.\n\nNo tickets, no reservations, no pressure. Just good music in a good room.",
    image: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800&q=80",
    entryInfo: "Free Entry", interestedCount: 47, language: "English / German",
  },
  {
    id: "e2", title: "Tuesday Night Trivia", venue: "Zum Goldenen Hahn", venueId: "v4",
    neighborhood: "Wedding", address: "Müllerstr. 128, 13353 Berlin",
    date: fmt(today), startTime: "19:30", endTime: "22:00", category: "Quiz Nights",
    tags: ["Quiz", "Free Entry", "Wedding", "Tonight", "English"],
    summary: "Wedding's best pub quiz returns. Five rounds, weird categories, strong opinions. Teams of 2–6. Winner gets a bottle of the house special.",
    description: "The legendary Tuesday Trivia at Zum Goldenen Hahn. Five rounds of increasingly obscure questions spanning music, Berlin history, science, pop culture, and a wildcard round chosen by last week's winners.\n\nForm a team of 2–6 people or join a table of friendly strangers. The winning team gets a bottle of the bar's house-infused spirit. Second place gets bragging rights.\n\nQuiz starts sharp at 19:30. Get there by 19:00 to claim a table and order the surprisingly good currywurst.",
    image: "https://images.unsplash.com/photo-1606761568499-6d2451b23c66?w=800&q=80",
    entryInfo: "Free Entry", interestedCount: 62, language: "English",
  },
  {
    id: "e3", title: "Ping-Pong Showdown #23", venue: "Pingpong Palast", venueId: "v7",
    neighborhood: "Kreuzberg", address: "Graefestr. 71, 10967 Berlin",
    date: fmt(today), startTime: "18:00", endTime: "22:00", category: "Games & Tournaments",
    tags: ["Games", "Tournament", "Kreuzberg", "Tonight", "Pay at Venue"],
    summary: "Weekly ping-pong tournament with 32 slots, DJ soundtrack, and ice-cold Club-Mate prizes.",
    description: "It's showdown night at the Palast. Sign up for the bracket (32 slots, first come first served) or just watch from the sidelines with a beer. DJ Kühlschrank provides the soundtrack. Winner takes home a custom paddle and eternal glory.\n\nEntry fee: €3 for tournament players. Spectators free. Cash only at the bar.",
    image: "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=800&q=80",
    entryInfo: "€3 tournament fee", interestedCount: 38, language: "English / German",
  },
  {
    id: "e4", title: "Tandem Evening: Deutsch / English", venue: "Morgenrot", venueId: "v8",
    neighborhood: "Neukölln", address: "Sonnenallee 101, 12045 Berlin",
    date: fmt(today), startTime: "19:00", endTime: "21:30", category: "Language Exchange",
    tags: ["Language Exchange", "Social", "Free Entry", "Neukölln", "Tonight"],
    summary: "Casual language tandem for German and English speakers. Name tags, conversation prompts, and good vegan snacks.",
    description: "Whether you're brushing up your German or want to practice English with native speakers, this is the place. We match tandem partners at the beginning, provide conversation prompts if you need them, and let the evening flow naturally.\n\nMorgenrot serves vegan snacks and affordable drinks. The vibe is relaxed and welcoming — perfect if you're new to Berlin or just want to meet people outside your usual circle.",
    image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80",
    entryInfo: "Free Entry", interestedCount: 55, language: "German / English",
  },
  {
    id: "e5", title: "Vinyl & Vermouth: Deep Listening Night", venue: "Nebelhorn", venueId: "v3",
    neighborhood: "Friedrichshain", address: "Simon-Dach-Str. 9, 10245 Berlin",
    date: fmt(tomorrow), startTime: "20:00", endTime: "00:00", category: "DJ Sets",
    tags: ["DJ Sets", "Vinyl", "Friedrichshain", "Tomorrow"],
    summary: "DJ Rotkehlchen spins deep cuts from the Nebelhorn record shelf. Vermouth cocktails at half price until 22:00.",
    description: "No requests, no top 40, no phone screens glowing. Just DJ Rotkehlchen behind the bar digging through crates of jazz, krautrock, ambient, and leftfield electronics from the Nebelhorn's personal vinyl collection.\n\nThis is a listening session, not a dance party. Settle into a booth, order a vermouth (half price until 22:00), and let the music take you somewhere unexpected.",
    image: "https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=800&q=80",
    entryInfo: "Free Entry", interestedCount: 33, language: "English / German",
  },
  {
    id: "e6", title: "Open Mic: Anything Goes", venue: "Trinkhalle", venueId: "v2",
    neighborhood: "Kreuzberg", address: "Oranienstr. 185, 10999 Berlin",
    date: fmt(tomorrow), startTime: "20:30", endTime: "23:00", category: "Open Mic",
    tags: ["Open Mic", "Comedy", "Poetry", "Kreuzberg", "Tomorrow", "Free Entry"],
    summary: "Five-minute slots for musicians, poets, comedians, and anyone else who dares. Sign up at the bar from 20:00.",
    description: "Trinkhalle's open mic is one of Berlin's best-kept secrets. Five minutes on stage for whatever you want to share — songs, poems, stand-up, readings, rants, puppet shows. We've seen it all.\n\nSign-up opens at 20:00, first come first served (12 slots). The crowd is supportive, the beer is cheap, and the acoustics are surprisingly decent for a bar this size.",
    image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80",
    entryInfo: "Free Entry", interestedCount: 41, language: "English",
  },
  {
    id: "e7", title: "Short Film Night: Berlin Independent", venue: "Lichtblick", venueId: "v5",
    neighborhood: "Prenzlauer Berg", address: "Kastanienallee 77, 10435 Berlin",
    date: fmt(tomorrow), startTime: "21:00", endTime: "23:00", category: "Screenings",
    tags: ["Screenings", "Film", "Prenzlauer Berg", "Tomorrow", "Suggested Donation"],
    summary: "A curated selection of five short films by Berlin-based independent filmmakers. Discussion with directors after the screening.",
    description: "Lichtblick presents five short films (8–15 minutes each) from emerging Berlin-based filmmakers. This month's theme: 'Borders — visible and invisible.' After the screenings, grab a drink and join the Q&A with the directors.\n\nSuggested donation €3–5. All proceeds go to the filmmakers. Wine, beer, and homemade lemonade available at the bar.",
    image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80",
    entryInfo: "Suggested Donation €3–5", interestedCount: 28, language: "English / German",
  },
  {
    id: "e8", title: "Brush & Beer: Life Drawing Session", venue: "Schwarzes Café", venueId: "v6",
    neighborhood: "Mitte", address: "Torstr. 66, 10119 Berlin",
    date: fmt(dayAfter), startTime: "18:30", endTime: "21:00", category: "Workshops",
    tags: ["Workshops", "Art & Creative", "Mitte", "Pay at Venue"],
    summary: "Casual life drawing session with a live model. Materials provided. No experience needed. Just bring your curiosity and a thirst.",
    description: "Schwarzes Café hosts its monthly life drawing evening. A professional model will hold short and long poses while you sketch, paint, or doodle — whatever your level.\n\nAll basic materials provided (paper, charcoal, pencils). Feel free to bring your own supplies. A beer or glass of wine is included in the €8 entry fee.\n\nThis is a relaxed, no-judgment zone. Beginners are especially welcome.",
    image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80",
    entryInfo: "€8 incl. drink", interestedCount: 22, language: "English",
  },
  {
    id: "e9", title: "Board Game Social", venue: "Morgenrot", venueId: "v8",
    neighborhood: "Neukölln", address: "Sonnenallee 101, 12045 Berlin",
    date: fmt(dayAfter), startTime: "17:00", endTime: "21:00", category: "Games & Tournaments",
    tags: ["Games", "Social Hangouts", "Neukölln", "Free Entry"],
    summary: "Bring your own games or dive into our collection of 80+ board games. Vegan cake and affordable drinks.",
    description: "Every other Sunday, Morgenrot opens its shelves of 80+ board games. Settlers of Catan, Codenames, Azul, Wingspan, obscure German strategy games from the 90s — take your pick.\n\nCome solo and join a table, or bring your crew. The kitchen serves fresh vegan cake and the drinks are as affordable as ever. A perfect lazy afternoon in Neukölln.",
    image: "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=800&q=80",
    entryInfo: "Free Entry", interestedCount: 45, language: "German / English",
  },
  {
    id: "e10", title: "Poetry Slam: Wortgewitter", venue: "Trinkhalle", venueId: "v2",
    neighborhood: "Kreuzberg", address: "Oranienstr. 185, 10999 Berlin",
    date: fmt(in3), startTime: "20:00", endTime: "22:30", category: "Poetry",
    tags: ["Poetry", "Kreuzberg", "Free Entry", "German"],
    summary: "Berlin's feistiest poetry slam. Eight poets, one microphone, and an audience vote. Performed mainly in German.",
    description: "Wortgewitter returns to Trinkhalle with eight poets battling it out over two rounds. The audience decides who moves forward. Expect wordplay, politics, heartbreak, and a few laughs.\n\nPrimarily in German, but English pieces sometimes sneak in. Arrive early — this one always packs the house.",
    image: "https://images.unsplash.com/photo-1474631245212-32dc3c8310c6?w=800&q=80",
    entryInfo: "Free Entry", interestedCount: 51, language: "German",
  },
  {
    id: "e11", title: "Kombucha & Conversation", venue: "Kastanienbar", venueId: "v1",
    neighborhood: "Neukölln", address: "Weserstr. 42, 12045 Berlin",
    date: fmt(in4), startTime: "16:00", endTime: "19:00", category: "Social Hangouts",
    tags: ["Social Hangouts", "Community Events", "Neukölln", "Free Entry"],
    summary: "A sober-friendly social afternoon. Homemade kombucha, good conversation, and zero pressure.",
    description: "Not every bar event needs alcohol. Kastanienbar opens its doors early for a sober-friendly social afternoon featuring homemade kombucha, herbal teas, and sparkling water.\n\nThis is a space for people who want to socialize without the pressure of drinking. Conversation starters on each table, a chill playlist in the background, and a genuinely warm atmosphere.",
    image: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&q=80",
    entryInfo: "Free Entry", interestedCount: 19, language: "English / German",
  },
  {
    id: "e12", title: "Stand-Up in the Back Room", venue: "Zum Goldenen Hahn", venueId: "v4",
    neighborhood: "Wedding", address: "Müllerstr. 128, 13353 Berlin",
    date: fmt(in5), startTime: "21:00", endTime: "23:00", category: "Comedy",
    tags: ["Comedy", "Wedding", "Pay at Venue", "English"],
    summary: "Five comedians, one tiny back room, and absolutely no filter. English-language stand-up in Wedding.",
    description: "Zum Goldenen Hahn's back room fits about 40 people, making this one of Berlin's most intimate stand-up shows. Five comedians — a mix of Berlin regulars and visiting acts — each get 12 minutes to make you laugh, cringe, or both.\n\nLine-up announced on Instagram the day before. €5 at the door. Drinks at bar prices.",
    image: "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800&q=80",
    entryInfo: "€5 at the door", interestedCount: 36, language: "English",
  },
];

export const questions: Question[] = [
  {
    id: "q1", author: "Lisa M.", text: "Is there a table reservation option or is it first come first served?",
    date: "2 hours ago",
    replies: [
      { author: "Kastanienbar", text: "No reservations — just show up! We'd recommend arriving by 19:30 to grab a good spot.", date: "1 hour ago", isVenue: true },
    ],
  },
  {
    id: "q2", author: "Tom K.", text: "Can I bring my own instrument and ask to play a song?",
    date: "5 hours ago",
    replies: [
      { author: "Kastanienbar", text: "Not at this event, but check out our Open Mic night on Fridays — that's the one for you!", date: "4 hours ago", isVenue: true },
      { author: "Mara L.", text: "The open mic is great — highly recommend it!", date: "3 hours ago" },
    ],
  },
  {
    id: "q3", author: "Aisha R.", text: "Is the venue wheelchair accessible?",
    date: "1 day ago",
    replies: [
      { author: "Kastanienbar", text: "Yes, we have step-free access and an accessible bathroom. Let us know if you need anything specific and we'll make it work.", date: "22 hours ago", isVenue: true },
    ],
  },
];

export const getEventsForDate = (dateStr: string) => events.filter(e => e.date === dateStr);
export const getTodayEvents = () => getEventsForDate(fmt(today));
export const getTomorrowEvents = () => getEventsForDate(fmt(tomorrow));
export const getThisWeekEvents = () => events;
export const getEventById = (id: string) => events.find(e => e.id === id);
export const getVenueById = (id: string) => venues.find(v => v.id === id);
export const getEventsByVenue = (venueId: string) => events.filter(e => e.venueId === venueId);
export const getEventsByCategory = (cat: string) => events.filter(e => e.category === cat);
