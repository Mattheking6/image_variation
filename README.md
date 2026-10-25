# Variations d'image

Page web (HTML + JavaScript, sans dépendance) permettant de transformer une image à l'aide de **8 paramètres**, chacun pouvant prendre **8 valeurs**, soit 16 777 216 combinaisons possibles.

Tous les traitements sont **déterministes** : un même jeu de paramètres appliqué à la même image produit toujours exactement le même résultat.

## Utilisation

1. Ouvrir `index.html` dans un navigateur.
2. Charger une image (bouton « Charger une image », glisser-déposer ou Ctrl+V).
3. Régler les 8 paramètres avec les curseurs ou les boutons de valeur.

Autres fonctions :

- **Code** : les réglages sont résumés par un code de 8 chiffres (1 à 8), un chiffre par paramètre dans l'ordre ci-dessous. Le code peut être saisi directement et est repris dans l'URL (`index.html#11181111`).
- **Aléatoire** / **Réinitialiser** : tire une combinaison au hasard / revient aux valeurs par défaut.
- **Résolution** : taille de travail (600, 1000 ou 1600 px). Les effets sont proportionnels à la taille de l'image.
- **Maintenir pour voir l'original** : affiche temporairement l'image source.
- **Télécharger** : enregistre le résultat en PNG, nommé avec le code.

Code par défaut : `11181111` (aucune transformation visible).

## Les 8 paramètres

### 1. Fragmentation — *Découpage*

Découpe l'image en carrés ou en pièces de puzzle remises au mauvais endroit.

| Chiffre | Valeur | Description |
|:-:|---|---|
| 1 | Aucune | Image intacte |
| 2 | Carrés tournés | Grille de 6, environ un tiers des carrés pivotés sur place |
| 3 | Carrés échangés | Environ un tiers des carrés intervertis |
| 4 | Carrés mélangés | Grille de 9, tous les carrés mélangés et pivotés |
| 5 | Puzzle imparfait | Pièces de puzzle à tenons, quelques-unes mal placées |
| 6 | Puzzle mélangé | Toutes les pièces mal placées ou tournées |
| 7 | Cubes éparpillés | Carrés inclinés, en relief, sur fond sombre |
| 8 | Chaos | Environ 150 petites pièces de puzzle entièrement mélangées |

### 2. Recoloration — *Colorimétrie*

Réaffecte une couleur à chaque niveau de gris selon une palette (carte de dégradé). Fonctionne même sur une image en noir et blanc.

| Chiffre | Valeur | Palette |
|:-:|---|---|
| 1 | Aucune | Couleurs d'origine |
| 2 | Sépia | Brun → crème |
| 3 | Bleu / orange | Bleu nuit → bleu → orange → crème |
| 4 | Coucher de soleil | Violet → rose → orange → jaune |
| 5 | Thermique | Noir → bleu → magenta → rouge → jaune → blanc |
| 6 | Néon inversé | Ombres en cyan, lumières en magenta sombre |
| 7 | Arc-en-ciel | Un tour complet du cercle chromatique |
| 8 | Psychédélique | Trois tours du cercle chromatique |

### 3. Flou gaussien — *Structure*

Efface les détails et finit par faire disparaître les contours.

Valeurs : **0 · 1 · 2 · 4 · 8 · 16 · 32 · 64 px**

Le rayon est exprimé pour une image de 1000 px de côté et adapté proportionnellement à la résolution réelle.

### 4. Postérisation — *Rendu*

Réduit le nombre de niveaux de couleur et transforme les dégradés en aplats.

Valeurs : **2 · 3 · 4 · 6 · 8 · 12 · 16 · 32 niveaux** (défaut : 32)

### 5. Distorsion numérique — *Déformation*

Décale les canaux RVB, étire les pixels et introduit des décalages visuels.

| Chiffre | Valeur | Description |
|:-:|---|---|
| 1 | Aucune | — |
| 2 | RVB léger | Léger décalage des canaux rouge et bleu |
| 3 | Décalage horizontal | Bandes horizontales décalées |
| 4 | Décalage vertical | Bandes verticales décalées |
| 5 | Glitch | Décalages, permutations de canaux, blocs déplacés, lignes de balayage |
| 6 | Pixel sorting | Tri des pixels par luminosité sur chaque ligne |
| 7 | Ondulation | Ondulation horizontale différente pour chaque canal |
| 8 | Glitch extrême | Combinaison intense de tous les effets précédents |

### 6. Extraction des contours — *Formes*

Remplace progressivement les surfaces par leurs contours (dessin au trait noir sur blanc).

Valeurs : **0 % · 15 % · 30 % · 45 % · 60 % · 75 % · 90 % · 100 %**

### 7. Style artistique — *Texture*

Remplace le rendu photographique par un style visuel prédéfini (implémentation déterministe).

| Chiffre | Valeur | Description |
|:-:|---|---|
| 1 | Photographique | Aucun style |
| 2 | Photocopie | Noir et blanc très contrasté, grain |
| 3 | Bande dessinée | Contours encrés, aplats, trame de points |
| 4 | Peinture à l'huile | Filtre de Kuwahara, relief et coups de pinceau |
| 5 | Aquarelle | Couleurs diffuses, bords de pigment, texture papier |
| 6 | Cubisme | Facettes (cellules de Voronoï) décalées et ombrées |
| 7 | Mosaïque | Tesselles décalées avec joints |
| 8 | Tissage | Fils de trame et de chaîne entrecroisés |

### 8. Déformation géométrique — *Géométrie*

Déplace les pixels et modifie les formes, les proportions et la position des éléments.

| Chiffre | Valeur | Description |
|:-:|---|---|
| 1 | Aucune | — |
| 2 | Ondulation légère | Faible ondulation sinusoïdale |
| 3 | Ondulation forte | Ondulation plus ample et plus serrée |
| 4 | Vagues | Superposition de plusieurs vagues |
| 5 | Spirale | Tourbillon autour du centre |
| 6 | Bombement | Effet loupe au centre |
| 7 | Déformation en grille | Déplacement organique selon un bruit lissé |
| 8 | Déformation extrême | Vagues, bruit et spirale combinés |

## Ordre d'application

1. Déformation géométrique (8)
2. Flou gaussien (3)
3. Style artistique (7)
4. Postérisation (4)
5. Extraction des contours (6)
6. Recoloration (2)
7. Fragmentation (1)
8. Distorsion numérique (5)

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de la page |
| `style.css` | Mise en forme |
| `app.js` | Interface : paramètres, code, chargement, téléchargement |
| `effects.js` | Traitements d'image (pseudo-aléatoire à graine fixe, sans `Math.random`) |
