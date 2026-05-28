import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useIsNative } from "@/hooks/useIsNative";

export default function Impressum() {
  const navigate = useNavigate();
  const isNative = useIsNative();
  return (
    <div className="flex-1">
      <div className={`container max-w-2xl pb-16 ${isNative ? "pt-4" : "pt-16"}`}>
        {isNative && (
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 p-2 -ml-2 mb-6 text-foreground active:opacity-60 hover:opacity-70 transition-opacity"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">Back</span>
          </button>
        )}
        <h1 className="heading-display text-xl sm:text-2xl md:text-3xl lg:text-4xl mb-8">Impressum</h1>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
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
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">Kontakt</h2>
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
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
              Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
            </h2>
            <p>Manuel Mittelbach, Ackerstraße 14, 10115 Berlin</p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
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
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">Haftung für Inhalte</h2>
            <p>
              Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten
              nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als
              Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
              Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
              Tätigkeit hinweisen.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">Haftung für Links</h2>
            <p>
              Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen
              Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr
              übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder
              Betreiber der Seiten verantwortlich.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
              Urheberrecht & Bildnachweise
            </h2>
            <p className="mb-2">
              Bilder zu einzelnen Bars stammen entweder direkt von der jeweiligen Bar (Upload durch
              die vertretungsberechtigte Person über die Bar-Account-Funktion) oder werden
              automatisiert aus den Vorschaubild-Metadaten (<code className="font-mono text-xs">og:image</code>) der
              offiziellen Bar-Websites übernommen. In beiden Fällen gehen wir davon aus, dass die
              Veröffentlichung im Sinne der Bar erfolgt und die jeweilige Bar die erforderlichen
              Nutzungsrechte hält.
            </p>
            <p>
              Bar-Betreiber:innen, die über die Plattform eigene Bilder hochladen, sichern uns mit
              dem Upload zu, dass sie die hierfür erforderlichen Rechte besitzen und uns das Recht
              einräumen, die Bilder zur Bewerbung der Bar auf Inside Bars öffentlich zugänglich zu
              machen. Sie stellen uns insoweit von Ansprüchen Dritter frei.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
              Take-Down / Beschwerden zu Bildrechten
            </h2>
            <p className="mb-2">
              Solltest du Rechteinhaber:in eines Bildes sein, das ohne deine Zustimmung auf Inside
              Bars angezeigt wird, kontaktiere uns bitte formlos unter{" "}
              <a
                href="mailto:hello@insidebars.co"
                className="text-foreground underline underline-offset-2 hover:text-accent transition-colors"
              >
                hello@insidebars.co
              </a>{" "}
              mit folgenden Angaben:
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-2">
              <li>URL des Bildes bzw. der Bar-Seite, auf der es erscheint</li>
              <li>Nachweis der Inhaberschaft (z. B. Original-Datei, Veröffentlichungsquelle)</li>
              <li>Kontaktdaten für Rückfragen</li>
            </ul>
            <p>
              Wir prüfen jede Meldung zeitnah und entfernen das beanstandete Bild bei berechtigtem
              Interesse in der Regel innerhalb von 48 Stunden ab Eingang der vollständigen Meldung.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
