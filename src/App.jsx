import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import MusicApp from "./MusicApp.jsx";
import Home from "./Home.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/app" element={<MusicApp />} />
        <Route path="*" element={<NotFound />} />
        <Route path="/app1" element={<App1 />} />
        <Route path="/app2" element={<App2 />} />
        <Route path="/app3" element={<App3 />} />
        <Route path="/app4" element={<App4 />} />
      </Routes>
    </BrowserRouter>
  );
}

function NotFound() {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.badge}>Erreur</div>
        <h1 style={styles.title}>Page introuvable</h1>
        <p style={styles.subtitle}>
          Cette page n’existe pas ou n’est plus disponible.
        </p>

        <div style={styles.actions}>
          <Link to="/" style={{ ...styles.button, ...styles.primaryButton }}>
            Retour à l’accueil
          </Link>
          <Link to="/app" style={{ ...styles.button, ...styles.secondaryButton }}>
            Ouvrir l’appli musique
          </Link>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    background:
      "radial-gradient(circle at top, rgba(29,185,84,0.16), transparent 22%), linear-gradient(180deg, #07110a 0%, #0b1220 45%, #06080d 100%)",
    fontFamily: "Arial, sans-serif",
    color: "#f8fafc",
  },
  card: {
    width: "100%",
    maxWidth: 560,
    borderRadius: 28,
    padding: 28,
    background: "rgba(15,23,42,0.82)",
    border: "1px solid rgba(148,163,184,0.18)",
    boxShadow: "0 18px 50px rgba(0,0,0,0.34)",
    backdropFilter: "blur(10px)",
    textAlign: "center",
  },
  badge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "bold",
    color: "#fca5a5",
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.18)",
    marginBottom: 16,
  },
  title: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.05,
  },
  subtitle: {
    marginTop: 14,
    marginBottom: 24,
    color: "#94a3b8",
    fontSize: 15,
    lineHeight: 1.6,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
  },
  button: {
    textDecoration: "none",
    borderRadius: 16,
    padding: "14px 18px",
    fontWeight: "bold",
    transition: "transform 0.15s ease",
  },
  primaryButton: {
    color: "white",
    background: "linear-gradient(135deg, #1DB954, #16a34a)",
    boxShadow: "0 10px 22px rgba(29,185,84,0.24)",
  },
  secondaryButton: {
    color: "#e2e8f0",
    background: "rgba(15,23,42,0.85)",
    border: "1px solid rgba(148,163,184,0.18)",
  },
};
