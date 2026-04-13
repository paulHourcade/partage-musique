import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div style={styles.page}>
      <div style={styles.glowTop} />
      <div style={styles.glowBottom} />

      <div style={styles.shell}>
        <div style={styles.stack}>
          <Link to="/app" style={{ ...styles.moduleCard, ...styles.musicAccessCard }}>
            <div style={styles.moduleEmoji}>🎵</div>
            <div style={styles.moduleTitle}>Accéder à l’appli musique</div>
            <div style={styles.moduleAction}>Ouvrir maintenant</div>
          </Link>

          <Link to="/admin-users" style={styles.moduleCard}>
            <div style={styles.moduleEmoji}>⚙️</div>
            <div style={styles.moduleTitle}>Administration</div>
            <div style={styles.moduleAction}>Accéder</div>
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
    maxWidth: 760,
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
  },
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    marginBottom: 18,
  },
  moduleCard: {
    textDecoration: "none",
    color: "#f8fafc",
    borderRadius: 26,
    padding: 24,
    minHeight: 150,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    background: "rgba(15,23,42,0.82)",
    border: "1px solid rgba(148,163,184,0.16)",
    boxShadow: "0 14px 40px rgba(0,0,0,0.24)",
  },
  musicAccessCard: {
    background:
      "linear-gradient(135deg, rgba(29,185,84,0.18), rgba(15,23,42,0.94), rgba(15,23,42,0.92))",
    border: "1px solid rgba(29,185,84,0.28)",
    boxShadow: "0 18px 50px rgba(29,185,84,0.14)",
  },
  moduleEmoji: {
    fontSize: 38,
    marginBottom: 14,
  },
  moduleTitle: {
    fontSize: 24,
    fontWeight: "bold",
    lineHeight: 1.2,
  },
  moduleAction: {
    marginTop: 18,
    fontWeight: "bold",
    color: "#d1fae5",
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
