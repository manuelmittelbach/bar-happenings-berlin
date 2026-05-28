import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useIsNative } from "@/hooks/useIsNative";

export default function Datenschutz() {
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
        <h1 className="heading-display text-xl sm:text-2xl md:text-3xl lg:text-4xl mb-8">Datenschutzerklärung</h1>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
              1. Verantwortlicher
            </h2>
            <p>
              Verantwortlich für die Datenverarbeitung auf dieser Website ist:
              <br />
              Manuel Mittelbach, Ackerstraße 14, 10115 Berlin, Deutschland
              <br />
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
              2. Erhebung und Speicherung personenbezogener Daten
            </h2>
            <p className="mb-2">
              <strong className="text-foreground">Beim Besuch der Website:</strong> Wir verwenden
              keine Cookies oder Tracking-Tools für Marketing- oder Analysezwecke. Technisch
              notwendiger lokaler Speicher (localStorage / sessionStorage) wird ausschließlich für
              die Funktion der Seite genutzt (z. B. Login-Session, UI-Zustand). Eine
              Einwilligungspflicht nach § 25 Abs. 2 TTDSG besteht hierfür nicht.
            </p>
            <p className="mb-2">
              <strong className="text-foreground">Bei Registrierung als Nutzer:in:</strong> Wir
              verarbeiten ausschließlich deine E-Mail-Adresse und ein verschlüsseltes Passwort.
              Weitere Angaben (z. B. Name) erheben wir nicht.
            </p>
            <p className="mb-2">
              <strong className="text-foreground">Bei Registrierung als Bar-Betreiber:in:</strong>{" "}
              Zusätzlich verarbeiten wir Vor- und Nachname der vertretungsberechtigten Person sowie
              Angaben zur Bar (Name, Adresse, ggf. Website, Instagram-Handle und Telefonnummer).
              Diese Daten benötigen wir, um die Bar-Inhaberschaft zu prüfen und Events deiner Bar
              veröffentlichen zu können.
            </p>
            <p>
              Rechtsgrundlage in beiden Fällen: Art. 6 Abs. 1 lit. b DSGVO (Erfüllung eines
              Vertrags bzw. vorvertragliche Maßnahmen).
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
              3. Auftragsverarbeitung – Supabase
            </h2>
            <p>
              Authentifizierung, Datenbank und Datei-Speicherung werden über Supabase Inc. (970
              Toa Payoh North #07-04, Singapore 318992) bereitgestellt. Die Daten werden
              ausschließlich in der EU gehostet (Region: Irland, AWS eu-west-1). Mit Supabase
              besteht ein Auftragsverarbeitungsvertrag (AVV) gemäß Art. 28 DSGVO. Rechtsgrundlage:
              Art. 6 Abs. 1 lit. b DSGVO.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
              4. Karten-Daten (OpenFreeMap / OpenStreetMap)
            </h2>
            <p>
              Auf der Karten-Seite werden Kartenkacheln von OpenFreeMap geladen. Dabei kann die
              IP-Adresse an den Kartenanbieter übermittelt werden, was für die Auslieferung der
              Kacheln technisch erforderlich ist. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO
              (berechtigtes Interesse an einer funktionsfähigen Kartenanzeige).
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
              5. Speicherdauer
            </h2>
            <p>
              Account-Daten speichern wir, solange dein Account besteht. Auf Anfrage löschen wir
              dein Konto und die zugehörigen personenbezogenen Daten, soweit keine gesetzlichen
              Aufbewahrungspflichten entgegenstehen.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
              6. Deine Rechte
            </h2>
            <p>
              Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung
              (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20)
              und Widerspruch (Art. 21). Wende dich dazu an{" "}
              <a
                href="mailto:hello@insidebars.co"
                className="text-foreground underline underline-offset-2 hover:text-accent transition-colors"
              >
                hello@insidebars.co
              </a>
              . Außerdem steht dir ein Beschwerderecht bei der zuständigen Aufsichtsbehörde zu
              (für Berlin: Berliner Beauftragte für Datenschutz und Informationsfreiheit).
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
              7. Änderungen dieser Erklärung
            </h2>
            <p>
              Wir passen diese Datenschutzerklärung an, wenn sich die rechtliche Lage oder unsere
              Datenverarbeitung ändert. Es gilt jeweils die zum Zeitpunkt deines Besuchs
              veröffentlichte Fassung.
            </p>
          </section>

          <p className="pt-4 text-xs text-muted-foreground/60">Stand: April 2026</p>
        </div>
      </div>
    </div>
  );
}
