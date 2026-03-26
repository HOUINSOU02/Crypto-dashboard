# MARKET. Crypto Dashboard

Un tableau de bord minimaliste et élégant pour suivre le marché des cryptomonnaies en temps réel. Cette application utilise React et l'API publique de CoinGecko pour fournir des données de prix et des graphiques historiques.

## ✨ Fonctionnalités

- **Fear & Greed Index** : Visualisez le sentiment global du marché (données Alternative.me).
- **Mode Comparaison** : Superposez deux actifs sur le même graphique pour analyser les corrélations.
- **Support Multi-devise** : Basculez instantanément entre l'affichage en USD et en EUR.
- **Données en Temps Réel** : Prix et variations sur 24h mis à jour automatiquement toutes les 60 secondes.
- **Graphiques Dynamiques** : Visualisation des tendances sur 7, 30 ou 90 jours avec des transitions fluides (Recharts).
- **Recherche Intégrée** : Possibilité d'ajouter n'importe quelle cryptomonnaie via la barre de recherche utilisant l'API CoinGecko.
- **Optimisation des Performances** : 
    - **Cache intelligent** : Les données des graphiques sont mises en cache pendant 5 minutes pour éviter de saturer l'API (Rate Limiting).
    - **Indicateur d'état** : Un badge "⚡ CACHE" ou "• DIRECT" indique la provenance des données.
- **Persistance des Données** : Votre liste personnalisée de cryptomonnaies est sauvegardée dans le `localStorage` du navigateur.
- **Interface Moderne** : Design sombre (Dark Mode) avec une typographie soignée (*Syne* et *IBM Plex Mono*).

## 🚀 Installation et Démarrage

### Prérequis
- Node.js (v18.0.0 ou supérieur)
- npm

### Instructions
1. Clonez le projet ou téléchargez les fichiers.
2. Ouvrez un terminal dans le dossier `d:\crypto`.
3. Installez les dépendances :
   ```bash
   npm install
   ```
4. Lancez l'application en mode développement :
   ```bash
   npm run dev
   ```
5. Accédez à l'application via l'URL affichée dans le terminal (généralement `http://localhost:5173`).

## 🛠️ Stack Technique

- **Frontend** : React 18
- **Tooling** : Vite
- **Graphiques** : Recharts
- **API** : CoinGecko (Plan Demo gratuit)
- **Stylisation** : CSS-in-JS (Inline styles)

## ⚠️ Notes sur l'API

Ce projet utilise la version gratuite de l'API CoinGecko. Celle-ci impose des limites de requêtes (Rate Limits). Si vous voyez un message d'erreur réseau, veuillez patienter une minute avant de rafraîchir. Le système de cache implémenté aide à minimiser ce risque.

---

**MARKET.** — Développé par **Luky HOUINSOU**