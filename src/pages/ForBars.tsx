import { Link } from "react-router-dom";
import { ArrowRight, Megaphone, BarChart3, Users, Zap } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const benefits = [
  { icon: Megaphone, title: "Reach locals", description: "Your events appear in front of people actively looking for things to do tonight in Berlin." },
  { icon: Zap, title: "Publish in minutes", description: "A simple form, no tech skills required. Add your event and it goes live instantly." },
  { icon: Users, title: "Build your crowd", description: "See who's interested, answer questions, and grow a community around your venue." },
  { icon: BarChart3, title: "Track engagement", description: "See how many people viewed your events and expressed interest." },
];

export default function ForBars() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-foreground text-background">
          <div className="container py-20 md:py-28">
            <div className="max-w-2xl">
              <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
                Your bar does great things.
                <br />
                <span className="font-light opacity-70">Let people know about it.</span>
              </h1>
              <p className="mt-6 text-lg text-background/60 leading-relaxed max-w-lg">
                Inside Bars helps small independent bars and venues in Berlin share their events with people who actually care about local culture.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  to="/publish"
                  className="inline-flex items-center gap-2 h-12 px-6 bg-accent text-accent-foreground rounded-sm font-medium text-sm hover:bg-accent/90 transition-colors"
                >
                  Publish your first event <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center h-12 px-6 border border-background/20 text-background rounded-sm font-medium text-sm hover:bg-background/10 transition-colors"
                >
                  Create account
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="border-b border-border">
          <div className="container py-16">
            <h2 className="heading-display text-2xl md:text-3xl mb-10">Why venues use Inside Bars</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {benefits.map((b) => (
                <div key={b.title} className="space-y-3">
                  <div className="w-10 h-10 rounded-sm bg-muted flex items-center justify-center">
                    <b.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-heading text-base font-semibold">{b.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-b border-border">
          <div className="container py-16">
            <h2 className="heading-display text-2xl md:text-3xl mb-10">How it works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { step: "01", title: "Create your venue account", desc: "Sign up with your bar name and basic details. Takes 2 minutes." },
                { step: "02", title: "Publish an event", desc: "Fill in the event details — title, date, category, description. Done." },
                { step: "03", title: "Reach your audience", desc: "Your event appears on Inside Bars and locals discover it when browsing." },
              ].map((s) => (
                <div key={s.step} className="space-y-3">
                  <span className="font-heading text-4xl font-bold text-muted-foreground/30">{s.step}</span>
                  <h3 className="font-heading text-base font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section>
          <div className="container py-16 text-center">
            <h2 className="heading-display text-2xl md:text-3xl mb-4">Ready to get started?</h2>
            <p className="text-muted-foreground mb-8">It's free. It's simple. It's made for bars like yours.</p>
            <Link
              to="/publish"
              className="inline-flex items-center gap-2 h-12 px-8 bg-foreground text-background rounded-sm font-medium text-sm hover:bg-foreground/90 transition-colors"
            >
              Publish your first event <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
