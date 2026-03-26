import { useState, useEffect, useCallback, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts";

/* ─── Config ─── */
const INITIAL_COINS = [
  { id: "bitcoin",  symbol: "BTC", name: "Bitcoin",  color: "#f7931a" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", color: "#627eea" },
  { id: "solana",   symbol: "SOL", name: "Solana",   color: "#9945ff" },
  { id: "binancecoin", symbol: "BNB", name: "BNB",   color: "#f0b90b" },
  { id: "ripple",   symbol: "XRP", name: "XRP",      color: "#00aae4" },
];

const API_BASE = "https://api.coingecko.com/api/v3";
const CHART_CACHE_TTL = 5 * 60 * 1000; // 5 minutes en millisecondes

/* ─── Helpers ─── */
const fmt = (n, cur = "usd") =>
  n >= 1000
    ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n)
    : new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n);

const fmtPct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const fmtDate = (ts) => new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

/* ─── Custom Tooltip ─── */
function ChartTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0f0f17",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 8,
      padding: "8px 14px",
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 12,
    }}>
      <p style={{ color: "#6b7280", marginBottom: 4 }}>{label}</p>
      <p style={{ color: "#f0f0f5", fontWeight: 500 }}>{fmt(payload[0].value, currency)}</p>
    </div>
  );
}

/* ─── Price Card ─── */
function CoinCard({ coin, price, change24h, selected, onClick, currency }) {
  const isPos = change24h >= 0;
  return (
    <div onClick={onClick} style={{
      background: selected ? `${coin.color}12` : "#111118",
      border: `1px solid ${selected ? coin.color + "50" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 12,
      padding: "16px 18px",
      cursor: "pointer",
      transition: "all .2s",
      position: "relative",
      overflow: "hidden",
    }}>
      {selected && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: 2, background: coin.color,
          borderRadius: "2px 2px 0 0",
        }} />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: `${coin.color}20`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: coin.color,
            fontFamily: "'IBM Plex Mono', monospace",
          }}>
            {coin.symbol.slice(0, 2)}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f5", fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>{coin.symbol}</p>
            <p style={{ fontSize: 10, color: "#4b5563", fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>{coin.name}</p>
          </div>
        </div>
        <span style={{
          fontSize: 11,
          fontFamily: "'IBM Plex Mono', monospace",
          color: isPos ? "#34d399" : "#f87171",
          background: isPos ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
          padding: "3px 7px",
          borderRadius: 5,
          fontWeight: 500,
        }}>
          {change24h != null ? fmtPct(change24h) : "—"}
        </span>
      </div>
      <p style={{
        fontSize: 18,
        fontWeight: 700,
        fontFamily: "'IBM Plex Mono', monospace",
        color: "#f0f0f5",
        letterSpacing: "-0.02em",
      }}>
        {price != null ? fmt(price, currency) : "···"}
      </p>
    </div>
  );
}

/* ─── App ─── */
export default function App() {
  const [userCoins, setUserCoins] = useState(() => {
    try {
      const storedCoins = localStorage.getItem("userCoins");
      return storedCoins ? JSON.parse(storedCoins) : INITIAL_COINS;
    } catch (error) {
      console.error("Failed to load coins from localStorage:", error);
      return INITIAL_COINS;
    }
  });

  const [selected, setSelected] = useState(() => {
    // Initialise 'selected' avec la première crypto de 'userCoins' ou INITIAL_COINS si userCoins est vide
    return userCoins.length > 0 ? userCoins[0] : INITIAL_COINS[0];
  });

  const [currency, setCurrency]     = useState("usd");
  const [prices, setPrices]         = useState({});
  const [changes, setChanges]       = useState({});
  const [chartData, setChartData]   = useState([]);
  const [period, setPeriod]         = useState(7);
  const [loading, setLoading]       = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [chartTimestamp, setChartTimestamp] = useState(null);
  const chartCache = useRef(new Map()); // Cache pour les données de graphique
  const [error, setError]           = useState(null);

  // Search state
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [notifications, setNotifications] = useState([]);

  /* Fetch prices */
  const fetchPrices = useCallback(async () => {
    try {
      const ids = userCoins.map((c) => c.id).join(",");
      const res = await fetch(
        `${API_BASE}/simple/price?ids=${ids}&vs_currencies=${currency}&include_24hr_change=true`
      );
      if (!res.ok) throw new Error("API rate limit");
      const data = await res.json();
      const p = {}, ch = {};
      userCoins.forEach(({ id }) => {
        p[id]  = data[id]?.[currency];
        ch[id] = data[id]?.[`${currency}_24h_change`];
      });
      setPrices(p);
      setChanges(ch);
      setLastUpdate(new Date());
      setError(null);
    } catch (e) {
      setError("Limite API atteinte — actualisation dans 60s");
    }
  }, [userCoins, currency]);

  /* Fetch chart */
  const fetchChart = useCallback(async (coinId, days, cur) => {
    setError(null); // Clear previous errors when fetching new chart

    const cacheKey = `${coinId}-${days}-${cur}`;
    const cached = chartCache.current.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < CHART_CACHE_TTL)) {
      // Utiliser les données mises en cache si disponibles et non expirées
      setChartData(cached.data);
      setChartTimestamp(cached.timestamp);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/coins/${coinId}/market_chart?vs_currency=${cur}&days=${days}`
      );
      if (res.status === 429) throw new Error("Rate Limit");
      if (!res.ok) throw new Error("Network Error");

      const data = await res.json();
      const step = Math.max(1, Math.floor(data.prices.length / 60));
      setChartData(
        data.prices
          .filter((_, i) => i % step === 0)
          .map(([ts, price]) => ({ date: fmtDate(ts), price: Math.round(price * 100) / 100 }))
      );
    } catch (err) {
      setError(err.message === "Rate Limit" ? "Trop de requêtes — attendez 1 min" : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, [currency]);

  useEffect(() => { fetchPrices(); const t = setInterval(fetchPrices, 60000); return () => clearInterval(t); }, [fetchPrices]);
  useEffect(() => { fetchChart(selected.id, period, currency); }, [selected, period, currency, fetchChart]);

  // Effect to save userCoins to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("userCoins", JSON.stringify(userCoins));
    } catch (error) {
      console.error("Failed to save coins to localStorage:", error);
    }
  }, [userCoins]);

  /* Search Logic */
  const searchCoins = async (q) => {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    setIsSearching(true);
    try {
      const res = await fetch(`${API_BASE}/search?query=${q}`);
      const data = await res.json();
      setResults(data.coins.slice(0, 6));
    } catch (e) { console.error(e); }
    finally { setIsSearching(false); }
  };

  const addCoin = (coin) => {
    if (userCoins.find(c => c.id === coin.id)) {
      setQuery(""); setResults([]); return;
    }
    const notifId = Date.now();
    const newCoin = {
      id: coin.id,
      symbol: (coin.symbol || coin.api_symbol).toUpperCase(),
      name: coin.name,
      color: `hsl(${Math.random() * 360}, 70%, 60%)` // Couleur aléatoire élégante
    };
    setUserCoins(prev => [...prev, newCoin]);
    setSelected(newCoin);
    setQuery("");
    setResults([]);
    
    setNotifications(prev => [...prev, {
      id: notifId,
      message: `${newCoin.name} ajouté avec succès !`,
      color: newCoin.color
    }]);
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notifId));
    }, 3000);
  };

  const dismissNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const removeCoin = (e, id) => {
    e.stopPropagation();
    if (userCoins.length <= 1) return;
    const filtered = userCoins.filter(c => c.id !== id);
    setUserCoins(filtered);
    if (selected.id === id) setSelected(filtered[0]);
  };

  const totalPortfolioChange = userCoins.reduce((acc, c) => acc + (changes[c.id] || 0), 0) / userCoins.length;

  const handleRefresh = async () => {
    // Vider le cache des graphiques
    chartCache.current.clear();
    // Déclencher les deux mises à jour en parallèle
    await Promise.all([
      fetchPrices(),
      fetchChart(selected.id, period, currency)
    ]);
  };

  return (
    <div className="container-padding" style={{ background: "#08080f", minHeight: "100vh", fontFamily: "'Syne', sans-serif", padding: "28px 24px 60px" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;700&display=swap" />
      <style>{`
        @keyframes pulse-live {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes slide-up {
          from { transform: translate(-50%, 20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        @media (max-width: 768px) {
          .header-top { flex-direction: column !important; align-items: flex-start !important; gap: 24px; margin-bottom: 24px !important; }
          .search-bar { width: 100% !important; margin: 0 !important; }
          .currency-nav { margin-right: 0 !important; width: 100%; justify-content: space-between; margin-bottom: 12px; }
          .portfolio-stat { text-align: left !important; width: 100%; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px; }
          .chart-header { flex-direction: column !important; align-items: flex-start !important; gap: 16px; }
          .container-padding { padding: 16px 16px 40px !important; }
          .chart-box { padding: 16px !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className="header-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: error ? "#f87171" : "#34d399",
                  boxShadow: error ? "0 0 8px #f87171" : "0 0 8px #34d399",
                  animation: error ? "none" : "pulse-live 2s infinite ease-in-out"
                }} />
                <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", color: "#4b5563", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {error ? "offline" : "live"}
                </span>
              </div>
              
              <button 
                onClick={handleRefresh}
                disabled={loading}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6366f1",
                  cursor: "pointer",
                  fontSize: 10,
                  fontFamily: "'IBM Plex Mono',monospace",
                  textTransform: "uppercase",
                  padding: 0,
                  opacity: loading ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                <span style={{ fontSize: 14 }}>↻</span> rafraîchir
              </button>
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: "#f0f0f5", letterSpacing: "-0.03em", lineHeight: 1 }}>
              MARKET<span style={{ color: "#6366f1" }}>.</span>
            </h1>
            <p style={{ fontSize: 12, color: "#4b5563", fontFamily: "'IBM Plex Mono',monospace", marginTop: 4 }}>
              {lastUpdate ? `mis à jour ${lastUpdate.toLocaleTimeString("fr-FR")}` : "chargement..."}
            </p>
          </div>

          {/* Search Bar */}
          <div className="search-bar" style={{ position: "relative", width: 300, margin: "0 40px" }}>
            <input
              type="text"
              placeholder="Rechercher une crypto..."
              value={query}
              onChange={(e) => searchCoins(e.target.value)}
              style={{
                width: "100%",
                background: "#111118",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                padding: "10px 16px",
                color: "#f0f0f5",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 13,
                outline: "none"
              }}
            />
            {results.length > 0 && (
              <div style={{
                position: "absolute", top: "110%", left: 0, right: 0,
                background: "#111118", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, zIndex: 100, overflow: "hidden",
                boxShadow: "0 10px 25px rgba(0,0,0,0.5)"
              }}>
                {results.map(r => (
                  <div
                    key={r.id}
                    onClick={() => addCoin(r)}
                    style={{
                      padding: "10px 14px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 10,
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      transition: "background 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <img src={r.thumb} alt="" style={{ width: 18, height: 18, borderRadius: "50%" }} />
                    <span style={{ color: "#f0f0f5", fontSize: 12, fontWeight: 600 }}>{r.name}</span>
                    <span style={{ color: "#4b5563", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}>{r.symbol}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Currency Toggle */}
          <div className="currency-nav" style={{ display: "flex", gap: 4, background: "#111118", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 4, marginRight: 20 }}>
            {['usd', 'eur'].map((c) => (
              <button key={c} onClick={() => setCurrency(c)} style={{
                padding: "6px 12px",
                border: "none",
                borderRadius: 6,
                background: currency === c ? "#6366f1" : "transparent",
                color: currency === c ? "#fff" : "#4b5563",
                fontSize: 11,
                fontFamily: "'IBM Plex Mono',monospace",
                fontWeight: 700,
                cursor: "pointer",
                textTransform: "uppercase"
              }}>{c}</button>
            ))}
          </div>

          <div className="portfolio-stat" style={{ textAlign: "right" }}>
            <p style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", color: "#4b5563", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Variation moy. 24h
            </p>
            <p style={{
              fontSize: 28, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace",
              color: totalPortfolioChange >= 0 ? "#34d399" : "#f87171",
              letterSpacing: "-0.02em",
            }}>
              {Object.keys(changes).length ? fmtPct(totalPortfolioChange) : "···"}
            </p>
          </div>
        </div>

        {error && (
          <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, padding: "10px 16px", marginBottom: 20, fontSize: 12, color: "#f87171", fontFamily: "'IBM Plex Mono',monospace" }}>
            ⚠ {error}
          </div>
        )}

        {/* Cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
          gap: 10,
          marginBottom: 28
        }}>
          {userCoins.map((coin) => (
            <div key={coin.id} style={{ position: "relative" }}>
              <CoinCard
                coin={coin}
                price={prices[coin.id]}
                change24h={changes[coin.id]}
                selected={selected.id === coin.id}
                onClick={() => setSelected(coin)}
                currency={currency}
              />
              {userCoins.length > 1 && (
                <button
                  onClick={(e) => removeCoin(e, coin.id)}
                  style={{
                    position: "absolute", top: 8, right: 8, background: "none", border: "none",
                    color: "#4b5563", cursor: "pointer", fontSize: 14, opacity: 0.5
                  }}
                >✕</button>
              )}
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="chart-box" style={{
          background: "#0f0f17",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 14,
          padding: "24px 24px 16px",
        }}>
          <div className="chart-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                <p style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {selected.name}
                </p>
                {chartTimestamp && !loading && (
                  <span style={{
                    fontSize: 9,
                    fontFamily: "'IBM Plex Mono',monospace",
                    color: (Date.now() - chartTimestamp > 10000) ? "#6366f1" : "#4b5563",
                    background: (Date.now() - chartTimestamp > 10000) ? "rgba(99,102,241,0.1)" : "transparent",
                    padding: "2px 6px",
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                  }}>
                    {(Date.now() - chartTimestamp > 10000) ? "⚡ CACHE" : "• DIRECT"} ({new Date(chartTimestamp).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })})
                  </span>
                )}
              </div>
              <p style={{ fontSize: 26, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: "#f0f0f5", letterSpacing: "-0.02em" }}>
                {prices[selected.id] != null ? fmt(prices[selected.id]) : "···"}
                {changes[selected.id] != null && (
                  <span style={{ fontSize: 14, marginLeft: 12, color: changes[selected.id] >= 0 ? "#34d399" : "#f87171" }}>
                    {fmtPct(changes[selected.id])}
                  </span>
                )}
              </p>
            </div>

            {/* Period selector */}
            <div style={{ display: "flex", gap: 4, background: "#08080f", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: 4 }}>
              {[7, 30, 90].map((d) => (
                <button key={d} onClick={() => setPeriod(d)} style={{
                  padding: "6px 14px",
                  border: "none",
                  borderRadius: 6,
                  background: period === d ? selected.color + "20" : "transparent",
                  color: period === d ? selected.color : "#4b5563",
                  fontSize: 12,
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all .15s",
                  outline: period === d ? `1px solid ${selected.color}40` : "none",
                }}>
                  {d}J
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 260, position: "relative" }}>
            {loading && (
              <div style={{
                position: "absolute", inset: 0, zIndex: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(15,15,23,0.4)", backdropFilter: "blur(2px)",
                borderRadius: 8, transition: "all 0.3s"
              }}>
                <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: selected.color, letterSpacing: "0.2em" }}>
                  MISE À JOUR···
                </p>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={selected.color} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={selected.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#4b5563", fontSize: 10, fontFamily: "'IBM Plex Mono',monospace" }}
                  axisLine={false} tickLine={false}
                  interval={Math.floor(chartData.length / 5)}
                />
                <YAxis
                  tick={{ fill: "#4b5563", fontSize: 10, fontFamily: "'IBM Plex Mono',monospace" }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${currency === 'usd' ? '$' : '€'}${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                  width={55}
                />
                <Tooltip content={<ChartTooltip currency={currency} />} />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={selected.color}
                  strokeWidth={2}
                  fill="url(#grad)"
                  dot={false}
                  activeDot={{ r: 4, fill: selected.color, stroke: "#08080f", strokeWidth: 2 }}
                  isAnimationActive={true}
                  animationDuration={800}
                  animationEasing="ease-in-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "#2d2d3a", fontFamily: "'IBM Plex Mono',monospace" }}>
            Data: CoinGecko API (free tier)
          </span>
          <span style={{ fontSize: 11, color: "#2d2d3a", fontFamily: "'IBM Plex Mono',monospace" }}>
            MARKET. MADE BY Luky HOUINSOU
          </span>
        </div>
      </div>

      {/* Notification Toast */}
      <div style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column-reverse",
        gap: 8,
        zIndex: 1000,
        pointerEvents: "none"
      }}>
        {notifications.map(n => (
          <div key={n.id} style={{
            background: n.color,
            color: "white",
            padding: "10px 16px 10px 20px",
            borderRadius: 12,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 10px 25px rgba(0,0,0,0.4)",
            animation: "slide-up 0.3s ease-out",
            display: "flex",
            alignItems: "center",
            gap: 12,
            pointerEvents: "auto",
            backdropFilter: "blur(4px)",
            border: "1px solid rgba(255,255,255,0.1)"
          }}>
            <span>✨ {n.message}</span>
            <button 
              onClick={() => dismissNotification(n.id)}
              style={{
                background: "rgba(0,0,0,0.15)",
                border: "none",
                color: "white",
                borderRadius: "50%",
                width: 20,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: 10,
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.3)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.15)"}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
