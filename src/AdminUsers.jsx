
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "./firebase";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);

  const usersCollectionRef = useMemo(() => collection(db, "users"), []);
  const usersQueryRef = useMemo(
    () => query(usersCollectionRef, orderBy("lastSeen", "desc")),
    [usersCollectionRef]
  );

  useEffect(() => {
    const unsub = onSnapshot(usersQueryRef, (snapshot) => {
      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));
      setUsers(data);
    });

    return () => unsub();
  }, [usersQueryRef]);

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return "inconnu";

    const diffMs = Date.now() - timestamp;
    const diffSeconds = Math.max(Math.floor(diffMs / 1000), 0);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 10) return "à l’instant";
    if (diffSeconds < 60) return `il y a ${diffSeconds}s`;
    if (diffMinutes < 60) return `il y a ${diffMinutes} min`;
    if (diffHours < 24) return `il y a ${diffHours}h`;
    return `il y a ${diffDays}j`;
  };

  const forceLogoutUser = async (userId) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        forceLogoutAt: Date.now(),
        isConnected: false,
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Utilisateurs</h1>
            <div style={styles.subtitle}>
              Triés du plus récent au plus ancien
            </div>
          </div>

          <Link to="/" style={styles.back}>
            ⬅ Accueil
          </Link>
        </div>

        {users.length === 0 ? (
          <div style={styles.empty}>Aucun utilisateur</div>
        ) : (
          users.map((user) => (
            <div key={user.id} style={styles.card}>
              <div style={styles.left}>
                <div style={styles.name}>{user.name}</div>

                <div style={styles.meta}>
                  {user.isConnected ? "🟢 En ligne" : "⚫ Hors ligne"}
                </div>

                <div style={styles.meta}>
                  Dernière activité : {formatTimeAgo(user.lastSeen)}
                </div>

                <div style={styles.meta}>
                  Admin : {user.isAdmin ? "Oui" : "Non"}
                </div>
              </div>

              <button
                style={styles.button}
                onClick={() => forceLogoutUser(user.id)}
              >
                Déconnecter
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: 20,
    background: "#0b1220",
    color: "white",
    fontFamily: "Arial",
  },
  container: {
    maxWidth: 600,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 20,
    alignItems: "center",
  },
  title: {
    margin: 0,
    fontSize: 26,
  },
  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
  },
  back: {
    textDecoration: "none",
    color: "#94a3b8",
    fontSize: 14,
  },
  empty: {
    textAlign: "center",
    marginTop: 40,
    color: "#94a3b8",
  },
  card: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#1e293b",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  left: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  name: {
    fontWeight: "bold",
    fontSize: 16,
  },
  meta: {
    fontSize: 13,
    color: "#94a3b8",
  },
  button: {
    background: "#ef4444",
    border: "none",
    color: "white",
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
  },
};
