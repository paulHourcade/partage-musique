// AdminUsers.jsx (avec voyant en ligne/hors ligne)

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "./firebase";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const ADMIN_PIN = "1234";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [usernameInput, setUsernameInput] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const [username] = useState(() => localStorage.getItem("username") || "");
  const [userId] = useState(() => {
    let id = localStorage.getItem("userId");
    if (!id) {
      id = Math.random().toString(36).substring(2, 15);
      localStorage.setItem("userId", id);
    }
    return id;
  });

  const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => {
    return localStorage.getItem("isSpotifyAdmin") === "true";
  });

  const usersCollectionRef = useMemo(() => collection(db, "users"), []);
  const usersQueryRef = useMemo(
    () => query(usersCollectionRef, orderBy("lastSeen", "desc")),
    [usersCollectionRef]
  );

  useEffect(() => {
    const unsub = onSnapshot(usersQueryRef, (snapshot) => {
      const freshUsers = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));
      setUsers(freshUsers);
    });

    return () => unsub();
  }, [usersQueryRef]);

  const renderUserItem = (user) => {
    return (
      <div key={user.id} style={styles.userRow}>
        <div style={styles.userAvatar}>
          {(user.name || "?").charAt(0).toUpperCase()}
        </div>

        <div style={styles.userContent}>
          <div style={styles.userNameRow}>
            <div style={styles.userName}>
              {user.name || "Sans nom"}
            </div>

            <div
              style={{
                ...styles.statusBadge,
                ...(user.isConnected
                  ? styles.statusOnline
                  : styles.statusOffline),
              }}
            >
              <span
                style={{
                  ...styles.statusDot,
                  background: user.isConnected ? "#22c55e" : "#ef4444",
                }}
              />
              {user.isConnected ? "En ligne" : "Hors ligne"}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.appTitle}>Utilisateurs</h1>

        <div style={styles.list}>
          {users.map((user) => renderUserItem(user))}
        </div>

        <Link to="/" style={styles.homeReturnButton}>
          ⬅️ Retour à l’accueil
        </Link>
      </div>

      {toastMessage && <div style={styles.toast}>{toastMessage}</div>}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    background: "#0b1220",
    padding: 20,
    color: "white",
  },
  card: {
    width: "100%",
    maxWidth: 500,
  },
  appTitle: {
    fontSize: 26,
    marginBottom: 20,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  userRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#111827",
    padding: 12,
    borderRadius: 16,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: "#1DB954",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
  },
  userContent: {
    flex: 1,
  },
  userNameRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userName: {
    fontWeight: "bold",
  },
  statusBadge: {
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "bold",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  statusOnline: {
    background: "rgba(34,197,94,0.15)",
  },
  statusOffline: {
    background: "rgba(239,68,68,0.15)",
  },
  homeReturnButton: {
    display: "inline-block",
    marginTop: 20,
    padding: "10px 14px",
    borderRadius: 10,
    background: "#1f2937",
    color: "white",
    textDecoration: "none",
  },
  toast: {
    position: "fixed",
    bottom: 20,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#22c55e",
    padding: "10px 16px",
    borderRadius: 999,
  },
};
