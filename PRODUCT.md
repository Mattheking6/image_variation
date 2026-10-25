# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Le propriétaire lui-même et la famille. Situation : jouer avec des photos de famille — les personnes et animaux du dossier `image/` (Bébé Hortense, Cousin Lewis, Dame Pétunia, Grand mère Anémone, Grand père Cornelius, Hannibal le Chat, Mélusine, Silex le chien) — pour découvrir ce qu'une image devient quand on la décompose.

## Product Purpose

Un jeu créatif : 8 paramètres déterministes (8 valeurs chacun, 16 777 216 combinaisons) transforment une image ; le but est de trouver **le** code qui donne « la bonne image ». C'est une devinette : explorer, comparer, et retrouver le code gagnant. La réussite, c'est résoudre (ou pouvoir rejouer) le code d'une image donnée.

## Positioning

Chaque variation a une identité : un code de 8 chiffres (1–8, un par paramètre), déterministe et partagé — même image + même code = exactement le même résultat, partout, toujours. Parce que l'espace est fini et que le code est court et humain, « trouver le bon code » fonctionne comme une devinette plutôt que comme une recherche infinie.

## Operating Context

Outil navigateur en une page : charger une image (bouton, glisser-déposer, Ctrl+V), régler les 8 paramètres aux curseurs ou aux boutons de valeur, lire/saisir le code de 8 chiffres (repris dans le hash de l'URL), choisir la résolution de travail (600/1000/1600 px), maintenir pour voir l'original, télécharger le résultat en PNG nommé avec le code.

À long terme, la page doit vivre en ligne : OVH (VPS ou webhosting), Scaleway en second choix, infrastructure décrite en Terraform — pas encore figé.

## Capabilities and Constraints

- 8 paramètres, chacun 1 à 8 ; ordre d'application fixe : déformation géométrique → flou gaussien → style artistique → postérisation → extraction des contours → recoloration → fragmentation → distortion numérique.
- Déterminisme strict : PRNG à graine fixée, pas de `Math.random` (`effects.js`). Même image + même code = résultat identique, toujours.
- Zéro dépendance, pas de build : HTML/CSS/JS vanilla, fonctionne ouvert en fichier local.
- Interface en français (`lang="fr"`, tous les libellés).
- **Non décidé** : les mécaniques exactes du jeu — qui pose la devinette (soi ou un défi à d'autres), comment la cible est définie, comment la solution est vérifiée et partagée.

## Brand Commitments

- Nom du produit : « Variations d'image ».
- Français comme langue de l'interface.

## Evidence on Hand

- `README.md` : documentation complète des 8 paramètres, des valeurs, du code et de l'ordre d'application.
- `image/` : 8 photos de famille/animaux + fichiers WIP (non versionnés) ; ce sont les sujets de travail du jeu.
- Aucun témoignage, capture publique, article ou asset de preuve. Les fichiers WIP sont des travaux en cours, pas des pièces finies.

## Product Principles

1. Le déterminisme est le produit : sans même-code-même-résultat, le code n'est pas un identifiant et la devinette ne tient pas.
2. Le code est l'interface du résultat : 8 chiffres courts sont la forme partageable et mémorisable d'une variation.
3. Le jeu avant la puissance : la joie est de découvrir « LA » variation, pas d'énumérer les 16,7 M de combinaisons.
4. Autonomie totale : pas de compte, pas de serveur pour jouer, pas de dépendance pour tourner.
