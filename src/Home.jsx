import { Link } from "react-router-dom";

export default function Home() {
  const cards = [
    {
      title: "Ouvrir la playlist partagée",
      text: "Accède directement à ton appli actuelle pour ajouter, lire et gérer les morceaux.",
      to: "/app",
      kind: "primary",
      emoji: "🎧",
    },
    {
      title: "Administration",
      text: "Zone d’entrée vers la gestion Spotify, le mode admin et les contrôles du lecteur.",
      to: "/app",
      kind: "secondary",
      emoji: "⚙️",
    },
    {
      title: "Historique de la session",
      text: "Retrouve les morceaux passés et relance facilement une ambiance déjà jouée.",
      to: "/app",
      kind: "secondary",
      emoji: "🕘",
    },
    {
      title: "Suggestions et découverte",
      text: "Ajoute des sons rapidement depuis la recherche Spotify et les futures recommandations.",
      to: "/app",
      kind: "secondary",
      emoji: "✨",
    },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.glowTop} />
      <div style={styles.glowBottom} />

      <div style={styles.shell}>
        <div style={styles.heroCard}>
          <div style={styles.badge}>Partage Musique</div>
          <h1 style={styles.title}>Bienvenue</h1>
          <p style={styles.subtitle}>
            Une page d’accueil plus propre pour lancer ton appli, structurer les accès
            et préparer les prochaines évolutions.
          </p>

          <div style={styles.heroActions}>
            <Link to="/app" style={{ ...styles.button, ...styles.primaryButton }}>
              🎵 Accéder à l’appli
            </Link>
            <a href="#modules" style={{ ...styles.button, ...styles.secondaryButton }}>
              Voir les accès
            </a>
          </div>
        </div>

        <div id="modules" style={styles.grid}>
          {cards.map((card) => (
            <Link
              key={card.title}
              to={card.to}
              style={{
                ...styles.moduleCard,
                ...(card.kind === "primary" ? styles.moduleCardPrimary : {}),
              }}
            >
              <div style={styles.moduleEmoji}>{card.emoji}</div>
              <div style={styles.moduleTitle}>{card.title}</div>
              <div style={styles.moduleText}>{card.text}</div>
              <div style={styles.moduleAction}>
                {card.kind === "primary" ? "Ouvrir maintenant" : "Accéder"}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    position: "relative",
    overflow: "hidden",
    padding: 20,
    background:
      "radial-gradient(circle at top, rgba(29,185,84,0.14), transparent 24%), linear-gradient(180deg, #07110a 0%, #0b1220 45%, #06080d 100%)",
    fontFamily: "Arial, sans-serif",
    color: "#f8fafc",
  },
  glowTop: {
    position: "fixed",
    top: -120,
    left: -100,
    width: 280,
    height: 280,
    borderRadius: "50%",
    background: "rgba(29,185,84,0.12)",
    filter: "blur(60px)",
    pointerEvents: "none",
  },
  glowBottom: {
    position: "fixed",
    bottom: -120,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: "50%",
    background: "rgba(59,130,246,0.10)",
    filter: "blur(70px)",
    pointerEvents: "none",
  },
  shell: {
    width: "100%",
    maxWidth: 1080,
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
  },
  heroCard: {
    borderRadius: 30,
    padding: 28,
    background: "rgba(15,23,42,0.82)",
    border: "1px solid rgba(148,163,184,0.18)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.34)",
    backdropFilter: "blur(10px)",
    marginBottom: 20,
  },
  badge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "bold",
    color: "#d1fae5",
    background: "rgba(29,185,84,0.12)",
    border: "1px solid rgba(29,185,84,0.18)",
    marginBottom: 16,
  },
  title: {
    margin: 0,
    fontSize: 44,
    lineHeight: 1.02,
  },
  subtitle: {
    marginTop: 14,
    marginBottom: 24,
    maxWidth: 700,
    color: "#94a3b8",
    fontSize: 16,
    lineHeight: 1.7,
  },
  heroActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
  },
  moduleCard: {
    textDecoration: "none",
    color: "#f8fafc",
    borderRadius: 24,
    padding: 22,
    minHeight: 210,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    background: "rgba(15,23,42,0.82)",
    border: "1px solid rgba(148,163,184,0.16)",
    boxShadow: "0 14px 40px rgba(0,0,0,0.24)",
    transition: "transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease",
  },
  moduleCardPrimary: {
    background:
      "linear-gradient(135deg, rgba(29,185,84,0.18), rgba(15,23,42,0.92), rgba(15,23,42,0.9))",
    border: "1px solid rgba(29,185,84,0.28)",
    boxShadow: "0 16px 44px rgba(29,185,84,0.14)",
  },
  moduleEmoji: {
    fontSize: 34,
    marginBottom: 14,
  },
  moduleTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    lineHeight: 1.25,
  },
  moduleText: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 1.6,
    flex: 1,
  },
  moduleAction: {
    marginTop: 18,
    fontWeight: "bold",
    color: "#d1fae5",
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
