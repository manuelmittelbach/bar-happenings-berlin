import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function About() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container max-w-2xl py-16">
          <h1 className="heading-display text-4xl md:text-5xl mb-8">
            About Barlin<span className="text-accent">.</span>
          </h1>

          <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
            <p className="text-base text-foreground">
              Barlin is a simple idea: make it easy to find out what's happening tonight in Berlin's small, independent bars.
            </p>

            <p>
              Berlin's bar scene is one of the most vibrant and diverse in the world. Every night, dozens of small venues
              host live music, quiz nights, open mics, language exchanges, film screenings, board game evenings, and all
              kinds of community events. But most of these events are invisible — buried in Instagram stories, shared by
              word of mouth, or announced on a chalkboard outside the door.
            </p>

            <p>
              We built Barlin to change that. Not by creating another generic event marketplace, but by building a platform
              that feels local, curated, and true to the spirit of Berlin's independent bar culture.
            </p>

            <h2 className="font-heading text-xl text-foreground pt-4 uppercase">What we believe</h2>

            <ul className="space-y-2">
              <li>• Small bars are the cultural backbone of Berlin</li>
              <li>• The best events happen in rooms with less than 50 people</li>
              <li>• Discovery should feel like browsing, not shopping</li>
              <li>• Independent venues deserve better visibility tools</li>
              <li>• Community events don't need corporate platforms</li>
            </ul>

            <h2 className="font-heading text-xl text-foreground pt-4 uppercase">Who's behind this</h2>

            <p>
              Barlin is an independent project built by a small team in Berlin. We're regulars at the kind of bars
              we built this platform for — and we think they deserve more visibility.
            </p>

            <p>
              Questions, ideas, feedback? Drop us a line at{" "}
              <a href="mailto:hello@barlin.berlin" className="text-foreground underline underline-offset-2 hover:text-accent transition-colors">
                hello@barlin.berlin
              </a>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}