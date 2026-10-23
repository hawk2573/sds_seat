# Interface Extension Build — Lessons Learned

**Project:** Wedding Seating Plan
**Date:** 2026-04-10
**Skills repo:** [github.com/noamsay/airtable-interface-extension-skills](https://github.com/noamsay/airtable-interface-extension-skills)

> Ce document complète les skills (pas de duplication). Il capture ce que les skills ne couvrent pas : les erreurs réelles rencontrées, les comportements non-documentés du SDK, et les décisions d'architecture prises en situation.

---

## 1. Permissions Interface — la couche invisible

### Le problème

L'extension affichait "Read-only" et le drag & drop ne fonctionnait pas, alors que l'utilisateur était Owner de la base avec tous les droits.

### La cause

Airtable a **deux couches de permissions superposées** :
1. **Base-level** — le rôle de l'utilisateur (Owner, Creator, Editor…)
2. **Interface page-level** — chaque page Interface a des toggles **par table** : `Edit records inline`, `Create new records`, `Delete records`

Le SDK check les DEUX couches quand on appelle `hasPermissionToUpdateRecords()`. Par défaut, Airtable met souvent "Edit records inline" à **Disabled** sur les nouvelles tables.

### Comment l'éviter

- **Après chaque ajout de table** (surtout via MCP/API), aller dans l'Interface editor → sélectionner la page → activer `Edit records inline` pour les tables que l'extension doit modifier.
- **Documenter ce prérequis** dans le README de chaque extension livrée (section "Interface page permissions").
- **Le SDK ne distingue pas** "pas de permission base-level" vs "pas de permission page-level" — le message d'erreur est le même. Toujours vérifier page-level en premier.

### Signature de `hasPermissionToUpdateRecords`

| Appel | Comportement |
|-------|-------------|
| `table.hasPermissionToUpdateRecords()` (sans args) | Vérifie la permission **générique** — peut retourner `false` même si l'utilisateur a le droit d'éditer certains champs. **Trop strict dans les Interface Extensions.** |
| `table.hasPermissionToUpdateRecords([{fields: {[fieldId]: value}}])` | Vérifie la permission **pour cette opération précise**. **Toujours utiliser cette forme.** |

---

## 2. Hooks React + SDK — ne jamais appeler `useRecords(null)`

### Le problème

`TypeError: Cannot read properties of null (reading 'id')` à l'initialisation.

### La cause

`useRecords(table, options)` crashe si `table` est `null`. Dans les Interface Extensions, les custom properties ne sont pas forcément résolues au premier rendu — `customPropertyValueByKey.guestsTable` peut être `null` pendant un cycle.

### Le pattern correct

Séparer le composant en deux :

```
App()
├── Vérifie que toutes les config sont présentes
├── Si non → <ConfigMissing />
└── Si oui → <SeatingApp table={...} />   ← le useRecords est ICI, dans un enfant
                                              qui ne monte que quand tout est ready
```

**Règle générale** : jamais de hook SDK (`useRecords`, `useBase`) dans un composant qui peut se monter avec des données nulles. Toujours gater en amont.

---

## 3. Custom properties — `null` vs `undefined` et tables manquantes

### Le problème

`TypeError: Cannot read properties of null (reading 'id')` dans `convertBlockPageElementCustomPropertyToBlockInstallationPageElementCustomPropertyForAirtableInterface` — crash interne du SDK, pas de notre code.

### La cause

Quand on déclare une custom property de type `field` avec `table: null`, le convertisseur interne d'Airtable essaie de lire `.id` sur `null` et crashe.

### Le fix

1. Pour les `defaultValue` de type `table` : utiliser `undefined` (pas `null`) quand la table n'existe pas.
2. Pour les custom properties de type `field` : **ne pas les inclure du tout** dans le tableau si leur table parent n'est pas résolue. Construction conditionnelle du tableau de properties.

```javascript
const props = [{key: 'placesTable', type: 'table', defaultValue: placesTable}];
if (placesTable) {
    props.push({key: 'tableNumberField', type: 'field', table: placesTable, ...});
}
return props;
```

---

## 4. Schéma stale après mutation MCP

### Le problème

Après avoir créé la table Places via MCP, l'extension ne la voyait pas — `base.getTableByIdIfExists('tblsJD7PCV4IvY6rS')` retournait `null`.

### La cause

Le hot-reload du dev server rafraîchit le **code** mais pas le **schéma de la base** côté extension. `useBase()` retourne le schéma tel qu'il était au chargement de la page.

### Comment l'éviter

- Après toute mutation de schéma (création de table, ajout de champ) : **hard refresh de la page Interface** (`Cmd+Shift+R`).
- Ne pas confondre hot-reload code et refresh schéma — ce sont deux systèmes indépendants.

---

## 5. dnd-kit — les 3 pièges du drag & drop

### Piège 1 — refs séparés

Si le `useDroppable` ref et le `useDraggable` ref sont sur **deux divs imbriquées différentes**, dnd-kit calcule les coordonnées de collision sur des bounding boxes différentes. Le drag démarre mais le drop ne se déclenche pas.

**Fix** : fusionner les refs sur **un seul noeud DOM** :
```javascript
const setMergedRef = useCallback((node) => {
    setDropRef(node);
    setDragRef(node);
}, [setDropRef, setDragRef]);
```

### Piège 2 — `touch-action: none`

Sans `style={{touchAction: 'none'}}` sur l'élément draggable, le navigateur intercepte les gestes (scroll, sélection) avant que dnd-kit ne puisse capturer le `pointerdown`.

### Piège 3 — `pointer-events-none` sur les enfants

Les éléments internes à un siège (avatar, badges, label) interceptent les pointer events. Le listener `onPointerDown` du parent ne se déclenche pas. Solution : `className="pointer-events-none"` sur tous les enfants visuels.

---

## 6. Architecture — pourquoi la table de jonction Places

### L'approche initiale

Deux champs numériques (`Table Number`, `Seat Number`) directement sur la table Guests.

### Pourquoi on a changé

1. **Sièges vides non-représentables** — si un guest n'a pas de Table/Seat, il n'existe tout simplement pas dans le plan. Impossible de rendre 80 sièges dont 70 vides.
2. **L'assignation est une propriété du siège, pas du guest** — "la place T03-S4 est occupée par X" vs "X est à la table 3 siège 4". Le premier est plus naturel et plus facile à requêter.
3. **Swap atomique simplifié** — swap = mettre à jour le champ `Guest` sur 2 records Places (1 appel `updateRecordsAsync`). Avec l'ancien modèle : mettre à jour 4 champs sur 2 records Guests.
4. **Scalable** — si le client a plusieurs événements, chaque événement a son propre set de Places.

### Quand garder l'approche flat

Si le seul besoin est "afficher une liste de guests filtrée par table/siège" sans visualisation spatiale, les champs numériques suffisent. La table de jonction est utile quand les sièges existent indépendamment des guests.

---

## 7. `block set-api-key` et `block init` — non-interactif impossible

### Le problème

`block init` et `block set-api-key` sont des commandes **interactives** qui attendent un input stdin. Impossible de les lancer depuis un agent AI ou un script sans intervention humaine.

### Workaround actuel

1. Le consultant lance `block set-api-key` **manuellement dans son Terminal** et colle le PAT.
2. Ensuite, `block init` fonctionne en non-interactif (le PAT est stocké localement).

### Où le token est stocké

Fichier de config local sur le disque du consultant (`~/.config/@airtable/blocks-cli/` ou équivalent). Pas dans le Keychain macOS. Envoyé uniquement à `airtable.com` pour authentifier les commandes CLI. Jamais transmis à un tiers.

---

## 8. Builder Hub — "Interface" non visible pour certains utilisateurs

L'option "Interface" dans Create Extension du Builder Hub nécessite :
- **Plan Team** ou supérieur (pas Free, pas Plus)
- Rôle **Creator** ou **Owner** dans le workspace
- Pas de restriction admin Enterprise qui désactive les custom extensions

Si un consultant/client ne voit pas l'option : vérifier le plan du workspace en premier.

---

## 9. Chrome — "Not Secure" fantôme après dev server

### Le problème

Après avoir stoppé `block run`, Chrome continue d'afficher "Not Secure" sur airtable.com.

### La cause

Le dev server utilise `https://localhost:9000` avec un certificat auto-signé. Chrome met en cache une exception de sécurité dans le profil utilisateur. Même après l'arrêt du serveur, le profil garde la trace de la connexion non-sûre.

### Fix

1. **Quitter Chrome complètement** (`Cmd+Q`) et relancer. Suffisant dans 90% des cas.
2. Si ça persiste : `chrome://settings/content/all` → `airtable.com` → Delete all data.
3. **Test rapide** : navigation privée (`Cmd+Shift+N`). Si le warning n'apparaît pas en privé → c'est bien le profil, pas Airtable.

---

## 10. MCP Airtable — limites à connaître

| Contrainte | Valeur |
|-----------|--------|
| Max records par `create_records_for_table` | **10** |
| Max records par `update_records_for_table` | **10** |
| Rate limit sur les mutations | 15 appels / seconde |
| `list_tables_for_base` | Retourne le schéma sans les data (IDs des tables et fields) |
| `get_table_schema` | Retourne les options détaillées (choices des selects, precision des numbers) |
| Créer un champ linked record | Airtable crée automatiquement le champ reverse sur la table liée |

Pour seeder 80 records : **8 appels de 10** (pas 1 appel de 80).

---

## 11. Workflow recommandé pour un futur déploiement

```
1. Schema Discovery (MCP)
   └─ Vérifier le plan du workspace (Team+ requis)

2. Requirements & Planning
   └─ Identifier les tables en LECTURE vs ÉCRITURE
   └─ Si écriture → documenter la nécessité d'activer "Edit records inline"

3. Project Setup
   └─ `block set-api-key` = intervention humaine obligatoire
   └─ Builder Hub "Create Extension" = intervention humaine obligatoire

4. Code Generation
   └─ Custom properties : JAMAIS passer `table: null`, construire conditionnellement
   └─ Hook pattern : gater les hooks SDK dans des composants enfants
   └─ Drag & drop : dnd-kit avec refs fusionnés + touch-action + pointer-events-none

5. QA
   └─ TOUJOURS vérifier "Edit records inline" sur la page Interface avant de tester les writes
   └─ Refresh page Interface après toute mutation de schéma (pas juste hot-reload)
   └─ Tester en navigation privée pour isoler les problèmes browser vs extension

6. Handoff
   └─ README doit documenter le prérequis Interface page permissions
   └─ Zip = le plus simple, pas de dépendance GitHub
```

---

## 12. Références

- **Skills repo** : [github.com/noamsay/airtable-interface-extension-skills](https://github.com/noamsay/airtable-interface-extension-skills) — process complet en 6 étapes avec templates PRD, mockup, QA, README
- **SDK rules** : `wedding_seating_plan/.cursor/rules/interface-extensions.mdc` — référence officielle des hooks, imports, custom properties, CRUD, appearance
- **Tailwind config** : `wedding_seating_plan/tailwind.config.js` — tokens de design Airtable (couleurs, typo, shadows)
