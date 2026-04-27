export default function Impressum() {
  return (
    <div className="bg-muted/40 flex-1">
      <div className="container max-w-2xl py-16">
        <h1 className="heading-display text-4xl md:text-5xl mb-8">Impressum</h1>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
              Angaben gemäß § 5 DDG
            </h2>
            <p>
              Manuel Mittelbach
              <br />
              Ackerstraße 14
              <br />
              10115 Berlin
              <br />
              Deutschland
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-2">Kontakt</h2>
            <p>
              E-Mail:{" "}
              <a
                href="mailto:hello@insidebars.co"
                className="text-foreground underline underline-offset-2 hover:text-accent transition-colors"
              >
                hello@insidebars.co
              </a>
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
              Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
            </h2>
            <p>Manuel Mittelbach, Ackerstraße 14, 10115 Berlin</p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
              EU-Streitschlichtung
            </h2>
            <p>
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS)
              bereit:{" "}
              <a
                href="https://ec.europa.eu/consumers/odr/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2 hover:text-accent transition-colors"
              >
                https://ec.europa.eu/consumers/odr/
              </a>
              . Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-2">Haftung für Inhalte</h2>
            <p>
              Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten
              nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als
              Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
              Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
              Tätigkeit hinweisen.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-2">Haftung für Links</h2>
            <p>
              Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen
              Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr
              übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder
              Betreiber der Seiten verantwortlich.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
