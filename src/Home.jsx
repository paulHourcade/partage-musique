import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>🎧 Partage Musique</h1>

        <div style={styles.buttons}>
          <Link to="/app1" style={styles.button}>App 1</Link>
          <Link to="/app2" style={styles.button}>App 2</Link>
          <Link to="/app3" style={styles.button}>App 3</Link>
          <Link to="/app4" style={styles.button}>App 4</Link>
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
    background: "#0b1220",
    fontFamily: "Arial, sans-serif",
    color: "white",
  },
  container: {
    textAlign: "center",
  },
  title: {
    fontSize: 40,
    marginBottom: 40,
  },
  buttons: {
    display: "grid",
    gap: 16,
    width: 200,
    margin: "0 auto",
  },
  button: {
    textDecoration: "none",
    padding: "14px",
    borderRadius: 12,
    background: "#1DB954",
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
};
