import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div style={styles.page}>
      <div style={styles.glowTop} />
      <div style={styles.glowBottom} />

      <div style={styles.shell}>
        <div style={styles.heroCard}>
          <div style={styles.badge}>Accueil</div>
          <h1 style={styles.title}>♪ Musique</h1>
          <p style={styles.subtitle}>
            Choisis un espace pour lancer ton application principale, accéder à
            l’administration ou ouvrir tes pages de test.
          </p>
        </div>

        <div style={styles.mainGrid}>
          <Link to="/app" style={{ ...styles.mainCard, ...styles.musicCard }}>
            <div style={styles.mainCardTop}>
              <div style={styles.mainEmoji}>🎵</div>
              <div style={styles.mainTitle}>Ouvrir l’appli musique</div>
            </div>
            <div style={styles.mainText}>
              Accéder directement à la playlist partagée et à la lecture en cours.
            </div>
            <div style={styles.mainAction}>Ouvrir maintenant</div>
          </Link>

          <Link to="/admin-users" style={styles.adminCard}>
            <div style={styles.adminEmoji}>⚙️</div>
            <div style={styles.adminTitle}>Administration</div>
          </Link>
        </div>

        <div style={styles.appsSection}>
          <div style={styles.appsSectionTitle}>Espaces de test</div>

          <div style={styles.appsGrid}>
            <Link to="/app1" style={styles.appButton}>
              App 1
            </Link>
            <Link to="/app2" style={styles.appButton}>
              App 2
            </Link>
            <Link to="/app3" style={styles.appButton}>
              App 3
            </Link>
            <Link to="/app4" style={styles.appButton}>
              App 4
            </Link>
          </div>
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
    display: "flex",
    alignItems: "center",
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
    maxWidth: 980,
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
  },
  heroCard: {
    borderRadius: 32,
    padding: 30,
    background: "rgba(15,23,42,0.82)",
    border: "1px solid rgba(148,163,184,0.18)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.34)",
    backdropFilter: "blur(10px)",
    marginBottom: 22,
    textAlign: "center",
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
    fontSize: 46,
    lineHeight: 1,
  },
  subtitle: {
    marginTop: 16,
    marginBottom: 0,
    color: "#94a3b8",
    fontSize: 16,
    lineHeight: 1.7,
    maxWidth: 680,
    marginInline: "auto",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 2fr) minmax(220px, 1fr)",
    gap: 16,
    marginBottom: 18,
  },
  mainCard: {
    textDecoration: "none",
    color: "#f8fafc",
    borderRadius: 28,
    padding: 26,
    minHeight: 220,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    background: "rgba(15,23,42,0.82)",
    border: "1px solid rgba(148,163,184,0.16)",
    boxShadow: "0 14px 40px rgba(0,0,0,0.24)",
  },
  musicCard: {
    background:
      "linear-gradient(135deg, rgba(29,185,84,0.18), rgba(15,23,42,0.94), rgba(15,23,42,0.92))",
    border: "1px solid rgba(29,185,84,0.28)",
    boxShadow: "0 18px 50px rgba(29,185,84,0.14)",
  },
  mainCardTop: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  mainEmoji: {
    fontSize: 42,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: "bold",
    lineHeight: 1.1,
  },
  mainText: {
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 520,
  },
  mainAction: {
    marginTop: 18,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    padding: "14px 18px",
    borderRadius: 16,
    fontWeight: "bold",
    color: "#ffffff",
    background: "linear-gradient(135deg, #1DB954, #16a34a)",
    boxShadow: "0 10px 22px rgba(29,185,84,0.24)",
  },
  adminCard: {
    textDecoration: "none",
    color: "#f8fafc",
    borderRadius: 28,
    padding: 26,
    minHeight: 220,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    background: "rgba(15,23,42,0.82)",
    border: "1px solid rgba(148,163,184,0.16)",
    boxShadow: "0 14px 40px rgba(0,0,0,0.24)",
  },
  adminEmoji: {
    fontSize: 42,
    marginBottom: 16,
  },
  adminTitle: {
    fontSize: 24,
    fontWeight: "bold",
    lineHeight: 1.2,
  },
  appsSection: {
    borderRadius: 26,
    padding: 22,
    background: "rgba(15,23,42,0.78)",
    border: "1px solid rgba(148,163,184,0.14)",
    boxShadow: "0 12px 34px rgba(0,0,0,0.22)",
  },
  appsSectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#cbd5e1",
    marginBottom: 16,
    letterSpacing: 0.4,
  },
  appsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },
  appButton: {
    textDecoration: "none",
    padding: "16px 14px",
    borderRadius: 16,
    background: "rgba(15,23,42,0.9)",
    border: "1px solid rgba(148,163,184,0.18)",
    color: "#f8fafc",
    fontWeight: "bold",
    textAlign: "center",
    boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
  },
};
