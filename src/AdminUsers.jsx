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

  const [swipeX, setSwipeX] = useState({});
  const [touchStartX, setTouchStartX] = useState({});
  const [touchCurrentX, setTouchCurrentX] = useState({});
  const [userToDelete, setUserToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

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
  const currentUserDocRef = useMemo(() => doc(db, "users", userId), [userId]);

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
    const isCurrentUser = user.id === userId;

    return (
      <div key={user.id} style={styles.swipeWrapper}>
        <div style={styles.userRow}>
          <div style={styles.userAvatar}>
            {(user.name || "?").charAt(0).toUpperCase()}
          </div>

          <div style={styles.userContent}>
            <div style={styles.userNameRow}>
              <div style={styles.userName}>
                {user.name || "Sans nom"} {isCurrentUser ? "(toi)" : ""}
              </div>

              <div
                style={{
                  ...styles.statusBadge,
                  ...(user.isConnected ? styles.statusOnline : styles.statusOffline),
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: user.isConnected ? "#22c55e" : "#ef4444",
                    display: "inline-block",
                  }}
                />
                {user.isConnected ? "Connecté" : "Hors ligne"}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1>Utilisateurs</h1>
        {users.map((u) => renderUserItem(u))}
        <Link to="/">Retour</Link>
      </div>
    </div>
  );
}

const styles = {
  page: { padding: 20 },
  card: {},
  swipeWrapper: {},
  userRow: { display: "flex", gap: 10 },
  userAvatar: { width: 40, height: 40, background: "#1DB954" },
  userContent: { flex: 1 },
  userNameRow: { display: "flex", justifyContent: "space-between" },
  userName: {},
  statusBadge: { padding: 6, borderRadius: 999, fontSize: 11 },
  statusOnline: {},
  statusOffline: {},
};
