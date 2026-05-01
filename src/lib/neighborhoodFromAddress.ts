// Single source of truth for valid Berlin neighborhoods. Add a PLZ here and
// the `Neighborhood` union type updates automatically — no second list to keep
// in sync.
const PLZ_MAP = {
	"10115": "Mitte", "10117": "Mitte", "10119": "Mitte", "10178": "Mitte", "10179": "Mitte",
	"10551": "Moabit", "10553": "Moabit", "10555": "Moabit", "10557": "Moabit", "10559": "Moabit",
	"10405": "Prenzlauer Berg", "10407": "Prenzlauer Berg", "10409": "Prenzlauer Berg",
	"10435": "Prenzlauer Berg", "10437": "Prenzlauer Berg", "10439": "Prenzlauer Berg",
	"10243": "Friedrichshain", "10245": "Friedrichshain", "10247": "Friedrichshain", "10249": "Friedrichshain",
	"10961": "Kreuzberg", "10963": "Kreuzberg", "10965": "Kreuzberg", "10967": "Kreuzberg",
	"10969": "Kreuzberg", "10997": "Kreuzberg", "10999": "Kreuzberg",
	"12043": "Neukölln", "12045": "Neukölln", "12047": "Neukölln", "12049": "Neukölln",
	"12051": "Neukölln", "12053": "Neukölln", "12055": "Neukölln", "12057": "Neukölln", "12059": "Neukölln",
	"12099": "Tempelhof", "12101": "Tempelhof", "12103": "Tempelhof", "12105": "Tempelhof",
	"12107": "Tempelhof", "12109": "Tempelhof",
	"10777": "Schöneberg", "10779": "Schöneberg", "10781": "Schöneberg", "10783": "Schöneberg",
	"10785": "Schöneberg", "10787": "Schöneberg", "10789": "Schöneberg",
	"10823": "Schöneberg", "10825": "Schöneberg", "10827": "Schöneberg", "10829": "Schöneberg",
	"10585": "Charlottenburg", "10587": "Charlottenburg", "10589": "Charlottenburg",
	"10623": "Charlottenburg", "10625": "Charlottenburg", "10627": "Charlottenburg", "10629": "Charlottenburg",
	"10707": "Charlottenburg", "10709": "Charlottenburg", "10711": "Charlottenburg", "10713": "Charlottenburg",
	"10715": "Charlottenburg", "10717": "Charlottenburg", "10719": "Charlottenburg",
	"14050": "Charlottenburg", "14052": "Charlottenburg", "14055": "Charlottenburg",
	"14057": "Charlottenburg", "14059": "Charlottenburg",
	"13347": "Wedding", "13349": "Wedding", "13351": "Wedding", "13353": "Wedding",
	"13355": "Wedding", "13357": "Wedding", "13359": "Wedding",
	"10317": "Lichtenberg", "10318": "Lichtenberg", "10319": "Lichtenberg",
	"10365": "Lichtenberg", "10367": "Lichtenberg", "10369": "Lichtenberg",
	"13051": "Lichtenberg", "13053": "Lichtenberg", "13055": "Lichtenberg",
	"13057": "Lichtenberg", "13059": "Lichtenberg",
	"13086": "Pankow", "13088": "Pankow", "13089": "Pankow",
	"13125": "Pankow", "13127": "Pankow", "13129": "Pankow",
	"13156": "Pankow", "13158": "Pankow", "13159": "Pankow",
	"13187": "Pankow", "13189": "Pankow",
	"12157": "Steglitz", "12159": "Steglitz", "12161": "Steglitz", "12163": "Steglitz",
	"12165": "Steglitz", "12167": "Steglitz", "12169": "Steglitz",
	"14193": "Steglitz", "14195": "Steglitz", "14197": "Steglitz", "14199": "Steglitz",
} as const;

type Neighborhood = (typeof PLZ_MAP)[keyof typeof PLZ_MAP];

const AMBIGUOUS: Record<string, { default: Neighborhood; streetOverrides: { pattern: RegExp; value: Neighborhood }[] }> = {
	"10315": {
		default: "Lichtenberg",
		streetOverrides: [
			{ pattern: /\b(boxhagener|simon-dach|warschauer|grünberger|revaler)\b/i, value: "Friedrichshain" },
		],
	},
};

export function deriveNeighborhood(street: string, postalCode: string): Neighborhood | "" {
	const plz = postalCode.trim();
	if (!/^\d{5}$/.test(plz)) return "";

	const ambiguous = AMBIGUOUS[plz];
	if (ambiguous) {
		for (const o of ambiguous.streetOverrides) {
			if (o.pattern.test(street)) return o.value;
		}
		return ambiguous.default;
	}

	return PLZ_MAP[plz] ?? "";
}

export function deriveNeighborhoodFromAddress(address: string): Neighborhood | "" {
	const match = address.match(/\b(\d{5})\b/);
	if (!match) return "";
	const plz = match[1];
	const street = address.slice(0, match.index ?? 0);
	return deriveNeighborhood(street, plz);
}
