

## Correction : les événements ne s'affichent pas

### Cause du problème
Dans `Index.tsx`, le `useMemo` qui calcule les événements filtrés oublie `allEvents` dans son tableau de dépendances (ligne 63). Quand les données arrivent de Supabase de manière asynchrone, le memo ne se recalcule pas car il ne "voit" pas le changement de `allEvents`.

### Correction

**Fichier : `src/pages/Index.tsx`, ligne 63**

Ajouter `allEvents` au tableau de dépendances du `useMemo` :

```typescript
}, [allEvents, searchQuery, activeCategory, activeNeighborhood, activeDate, activeEntry, today, tomorrow]);
```

C'est un fix d'une seule ligne. Les données existent (356 événements futurs), elles ne sont simplement pas recalculées quand elles arrivent du réseau.

