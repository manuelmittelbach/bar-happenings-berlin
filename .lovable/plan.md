

## Connecter le projet à Supabase — Migration complète du backend

### Ce qui va changer
Toutes les données (événements, venues, catégories) actuellement en dur dans `mockData.ts` seront migrées vers des tables Supabase. Le frontend lira les données depuis la base de données au lieu du fichier local.

### Étape 1 — Créer les tables Supabase

**3 tables principales :**

```text
categories
├── id (text, PK)
├── label (text)
├── emoji (text)
├── color (text)

venues
├── id (text, PK)
├── name (text)
├── neighborhood (text)
├── address (text)
├── description (text)
├── image (text)
├── instagram (text, nullable)
├── website (text, nullable)
├── lat (float8)
├── lng (float8)

events
├── id (text, PK)
├── parent_id (text)
├── title (text)
├── venue_id (text, FK → venues.id)
├── venue (text) — nom dénormalisé pour affichage rapide
├── neighborhood (text)
├── address (text)
├── date (date)
├── start_time (text)
├── end_time (text, nullable)
├── category (text)
├── category_id (text, FK → categories.id)
├── tags (text[])
├── description (text)
├── price (text)
├── entry_info (text)
├── language (text)
├── recurrence (text)
├── url (text)
├── image (text, nullable)
├── summary (text, nullable)
├── interested_count (int, default 0)
├── featured (boolean, default false)
├── created_at (timestamptz, default now())
```

Toutes les tables auront **RLS activé** avec une policy **SELECT public** (données lisibles par tous, car c'est un site public). Les INSERT/UPDATE/DELETE seront restreints aux utilisateurs authentifiés (pour le futur dashboard organisateur).

### Étape 2 — Importer les données existantes

Un script d'insertion SQL migrera les ~8900 lignes de mock data (venues + events + categories) vers les tables Supabase.

### Étape 3 — Créer un hook React `useEvents`

Un nouveau hook `src/hooks/useEvents.ts` utilisera `@tanstack/react-query` + le client Supabase pour :
- Charger les événements avec filtres (date, catégorie, quartier, recherche)
- Charger les venues
- Charger les catégories
- Gérer le loading state et les erreurs

### Étape 4 — Mettre à jour les pages

- **`Index.tsx`** : remplacer `import { events } from "@/data/mockData"` par le hook `useEvents`
- **`Explore.tsx`** : idem
- **`EventDetail.tsx`** : charger l'événement par ID depuis Supabase
- **`EventDetailDialog.tsx`** : idem
- **`MapView.tsx`** : recevoir les données depuis le parent (déjà le cas)

### Étape 5 — Conserver mockData en fallback

Le fichier `mockData.ts` sera conservé mais ne sera plus importé par les pages principales. Il servira de référence et de fallback pendant le développement.

### Détails techniques

- Les noms de colonnes Supabase utilisent `snake_case` (ex: `start_time`, `venue_id`), un mapping sera fait côté client vers l'interface `BarlinEvent` existante
- Les `neighborhoods` seront dérivés dynamiquement des venues (pas de table dédiée)
- La migration SQL sera exécutée via l'outil de migration Supabase intégré

