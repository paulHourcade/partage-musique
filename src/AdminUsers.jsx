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
    const unsub = onSnapshot(
      usersQueryRef,
      (snapshot) => {
        const freshUsers = snapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));
        setUsers(freshUsers);
      },
      (error) => {
        console.error("users onSnapshot error:", error);
      }
    );

    return () => unsub();
  }, [usersQueryRef]);

  useEffect(() => {
    if (!userId) return;

    const unsub = onSnapshot(currentUserDocRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();

      if (data?.forceLogoutAt) {
        localStorage.removeItem("username");
        localStorage.removeItem("isSpotifyAdmin");
        setShowUserMenu(false);
        setShowPinModal(false);
        setIsAdminUnlocked(false);
        window.location.reload();
      }
    });

    return () => unsub();
  }, [currentUserDocRef, userId]);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 2500);
  };

  const handleLogin = () => {
    if (!usernameInput.trim()) return;
    const cleanName = usernameInput.trim();
    localStorage.setItem("username", cleanName);
    window.location.reload();
  };

  const unlockAdminMode = async () => {
    if (pinInput.trim() !== ADMIN_PIN) {
      setPinError("Code PIN incorrect");
      return;
    }

    localStorage.setItem("isSpotifyAdmin", "true");
    setIsAdminUnlocked(true);
    setShowPinModal(false);
    setShowUserMenu(false);
    setPinInput("");
    setPinError("");

    try {
      await setDoc(
        currentUserDocRef,
        {
          isAdmin: true,
          lastSeen: Date.now(),
          isConnected: true,
        },
        { merge: true }
      );
    } catch (err) {
      console.error("admin sync error:", err);
    }

    showToast("Mode admin activé");
  };

  const lockAdminMode = async () => {
    localStorage.removeItem("isSpotifyAdmin");
    setIsAdminUnlocked(false);
    setShowUserMenu(false);
    setPinInput("");
    setPinError("");

    try {
      await setDoc(
        currentUserDocRef,
        {
          isAdmin: false,
          lastSeen: Date.now(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("admin remove sync error:", err);
    }
  };

  const logoutUser = async () => {
    try {
      await updateDoc(currentUserDocRef, {
        isConnected: false,
        lastSeen: Date.now(),
      });
    } catch (err) {
      console.error("logout user sync error:", err);
    }

    localStorage.removeItem("username");
    localStorage.removeItem("isSpotifyAdmin");
    setShowUserMenu(false);
    window.location.reload();
  };

  const forceLogoutUser = async (targetUserId) => {
    try {
      await updateDoc(doc(db, "users", targetUserId), {
        forceLogoutAt: Date.now(),
        isConnected: false,
      });
      showToast("Utilisateur déconnecté");
    } catch (err) {
      console.error("force logout error:", err);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    setDeletingId(userToDelete);
    setTimeout(async () => {
      try {
        await deleteDoc(doc(db, "users", userToDelete));
        showToast("Utilisateur supprimé");
      } catch (err) {
        console.error("delete user error:", err);
      } finally {
        setDeletingId(null);
      }
    }, 250);

    setUserToDelete(null);
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return "inconnu";

    const diffMs = Date.now() - timestamp;
    const diffSeconds = Math.max(Math.floor(diffMs / 1000), 0);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 10) return "à l’instant";
    if (diffSeconds < 60) {
      return `il y a ${diffSeconds} seconde${diffSeconds > 1 ? "s" : ""}`;
    }
    if (diffMinutes < 60) {
      return `il y a ${diffMinutes} minute${diffMinutes > 1 ? "s" : ""}`;
    }
    if (diffHours < 24) {
      return `il y a ${diffHours} heure${diffHours > 1 ? "s" : ""}`;
    }
    return `il y a ${diffDays} jour${diffDays > 1 ? "s" : ""}`;
  };

  const handleTouchStart = (e, id) => {
    const x = e.touches[0].clientX;
    setTouchStartX((prev) => ({ ...prev, [id]: x }));
    setTouchCurrentX((prev) => ({ ...prev, [id]: x }));
  };

  const handleTouchMove = (e, id) => {
    const startX = touchStartX[id];
    if (startX == null) return;

    const currentX = e.touches[0].clientX;
    setTouchCurrentX((prev) => ({ ...prev, [id]: currentX }));

    const delta = currentX - startX;
    if (delta < 0) {
      setSwipeX((prev) => ({
        ...prev,
        [id]: Math.max(delta, -90),
      }));
    }
  };

  const handleTouchEnd = (id) => {
    const delta = (touchCurrentX[id] ?? 0) - (touchStartX[id] ?? 0);
    if (delta < -70 && isAdminUnlocked) {
      setUserToDelete(id);
    }

    setSwipeX((prev) => ({ ...prev, [id]: 0 }));
    setTouchStartX((prev) => ({ ...prev, [id]: null }));
    setTouchCurrentX((prev) => ({ ...prev, [id]: null }));
  };

  const renderUserItem = (user) => {
    const isCurrentUser = user.id === userId;

    return (
      <div key={user.id} style={styles.swipeWrapper}>
        <div
          style={{
            ...styles.userRow,
            transform: `translateX(${swipeX[user.id] || 0}px)`,
            opacity: deletingId === user.id ? 0.4 : 1,
          }}
          onTouchStart={isAdminUnlocked ? (e) => handleTouchStart(e, user.id) : undefined}
          onTouchMove={isAdminUnlocked ? (e) => handleTouchMove(e, user.id) : undefined}
          onTouchEnd={isAdminUnlocked ? () => handleTouchEnd(user.id) : undefined}
        >
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
                }}
              >
                {user.isConnected ? "Connecté" : "Hors ligne"}
              </div>
            </div>

            <div style={styles.userMeta}>
              Dernière activité : {formatTimeAgo(user.lastSeen)}
            </div>

            <div style={styles.userMeta}>
              Admin : {user.isAdmin ? "Oui" : "Non"}
            </div>
          </div>

          {isAdminUnlocked ? (
            <button
              style={styles.disconnectButton}
              onClick={(e) => {
                e.stopPropagation();
                forceLogoutUser(user.id);
              }}
            >
              Déconnecter
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlowTop} />
      <div style={styles.backgroundGlowBottom} />

      <div style={styles.card}>
        <div style={styles.appHeader}>
          <div style={styles.titleRow}>
            <h1 style={styles.appTitle}>♪ Utilisateurs</h1>
          </div>

          <div style={styles.headerActions}>
            {!username ? (
              <div style={styles.loginBox}>
                <input
                  style={styles.smallInput}
                  placeholder="Ton nom"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                />
                <button style={styles.smallButton} onClick={handleLogin}>
                  OK
                </button>
              </div>
            ) : (
              <button
                style={styles.userMenuButton}
                onClick={() => setShowUserMenu(true)}
              >
                👤 {username}
              </button>
            )}
          </div>
        </div>

        <div style={styles.sectionCard}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionEyebrow}>Admin</div>
              <h2 style={styles.sectionTitle}>Liste des utilisateurs</h2>
            </div>
          </div>

          {users.length > 0 ? (
            <div style={styles.list}>
              {users.map((user) => renderUserItem(user))}
            </div>
          ) : (
            <div style={styles.infoText}>Aucun utilisateur trouvé.</div>
          )}

          <div style={styles.infoText}>
            Triés du plus récent au plus ancien.
          </div>
        </div>

        <div style={styles.homeReturnModule}>
          <Link to="/" style={styles.homeReturnButton}>
            ⬅️ Retour à l’accueil
          </Link>
        </div>
      </div>

      {toastMessage && <div style={styles.toast}>{toastMessage}</div>}

      {showUserMenu && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.popupHeader}>
              <div style={styles.modalTitle}>Compte</div>
              <button
                style={styles.popupCloseButton}
                onClick={() => setShowUserMenu(false)}
              >
                ✕
              </button>
            </div>

            <div style={styles.popupMenuList}>
              <button style={styles.popupMenuButton} onClick={logoutUser}>
                Déconnecter l’utilisateur
              </button>

              {!isAdminUnlocked ? (
                <button
                  style={styles.popupMenuButton}
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowPinModal(true);
                    setPinError("");
                  }}
                >
                  Passer admin
                </button>
              ) : (
                <button style={styles.popupMenuButton} onClick={lockAdminMode}>
                  Quitter mode admin
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showPinModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalTitle}>Code PIN admin</div>
            <div style={styles.modalText}>
              Entre le code PIN pour passer en mode admin.
            </div>

            <input
              style={styles.input}
              type="password"
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                setPinError("");
              }}
              placeholder="Code PIN"
            />

            {pinError && <div style={styles.errorText}>{pinError}</div>}

            <div style={styles.modalActions}>
              <button
                style={styles.modalCancel}
                onClick={() => {
                  setShowPinModal(false);
                  setPinInput("");
                  setPinError("");
                }}
              >
                Annuler
              </button>

              <button style={styles.modalConfirm} onClick={unlockAdminMode}>
                Valider
              </button>
            </div>
          </div>
        </div>
      )}

      {userToDelete && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalTitle}>Confirmer la suppression</div>
            <div style={styles.modalText}>
              Tu veux vraiment supprimer cet utilisateur ?
            </div>

            <div style={styles.modalActions}>
              <button
                style={styles.modalCancel}
                onClick={() => setUserToDelete(null)}
              >
                Annuler
              </button>

              <button style={styles.modalDelete} onClick={confirmDeleteUser}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    background:
      "radial-gradient(circle at top, rgba(29,185,84,0.16), transparent 24%), linear-gradient(180deg, #07110a 0%, #0b1220 40%, #06080d 100%)",
    padding: 18,
    fontFamily: "Arial, sans-serif",
    position: "relative",
    overflow: "hidden",
    color: "#f8fafc",
  },
  backgroundGlowTop: {
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
  backgroundGlowBottom: {
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
  card: {
    width: "100%",
    maxWidth: 520,
    position: "relative",
    zIndex: 1,
  },
  appHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "nowrap",
    minWidth: 0,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "nowrap",
    justifyContent: "flex-end",
    marginLeft: "auto",
    width: "auto",
  },
  appTitle: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.05,
    color: "#f8fafc",
  },
  sectionCard: {
    background: "rgba(15, 23, 42, 0.82)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    boxShadow: "0 10px 40px rgba(0,0,0,0.28)",
    backdropFilter: "blur(10px)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  sectionEyebrow: {
    color: "#94a3b8",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
    fontWeight: "bold",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 20,
    color: "#f8fafc",
  },
  loginBox: {
    display: "flex",
    gap: 8,
    width: "100%",
    maxWidth: 220,
  },
  smallInput: {
    flex: 1,
    minWidth: 0,
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(15,23,42,0.8)",
    color: "#f8fafc",
    fontSize: 13,
    outline: "none",
  },
  smallButton: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "none",
    background: "#1DB954",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
  },
  userMenuButton: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(15,23,42,0.82)",
    color: "#e2e8f0",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: 13,
    marginLeft: "auto",
    maxWidth: 180,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  swipeWrapper: {
    overflow: "hidden",
    borderRadius: 16,
  },
  userRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#111827",
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.10)",
    boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: "rgba(29,185,84,0.16)",
    border: "1px solid rgba(29,185,84,0.24)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#d1fae5",
    fontSize: 20,
    fontWeight: "bold",
    flexShrink: 0,
  },
  userContent: {
    minWidth: 0,
    flex: 1,
  },
  userNameRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  userName: {
    fontWeight: "bold",
    color: "#f8fafc",
    fontSize: 15,
  },
  userMeta: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
    lineHeight: 1.4,
  },
  statusBadge: {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "bold",
    whiteSpace: "nowrap",
  },
  statusOnline: {
    background: "rgba(16,185,129,0.12)",
    color: "#d1fae5",
    border: "1px solid rgba(16,185,129,0.24)",
  },
  statusOffline: {
    background: "rgba(148,163,184,0.12)",
    color: "#cbd5e1",
    border: "1px solid rgba(148,163,184,0.22)",
  },
  disconnectButton: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "none",
    background: "rgba(239,68,68,0.16)",
    color: "#fecaca",
    cursor: "pointer",
    fontWeight: "bold",
    flexShrink: 0,
  },
  infoText: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 10,
  },
  input: {
    padding: 13,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.18)",
    width: "100%",
    boxSizing: "border-box",
    fontSize: 14,
    background: "#0f172a",
    color: "#f8fafc",
    outline: "none",
  },
  errorText: {
    fontSize: 12,
    color: "#fca5a5",
    marginTop: 10,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,0.72)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    zIndex: 999,
  },
  modal: {
    width: "100%",
    maxWidth: 360,
    background: "#0f172a",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
    border: "1px solid rgba(148,163,184,0.18)",
  },
  modalTitle: {
    fontWeight: "bold",
    fontSize: 18,
    marginBottom: 10,
    color: "#f8fafc",
  },
  modalText: {
    fontSize: 14,
    color: "#cbd5e1",
    marginBottom: 16,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 14,
  },
  modalCancel: {
    padding: "10px 13px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "#111827",
    color: "#f8fafc",
    cursor: "pointer",
  },
  modalConfirm: {
    padding: "10px 13px",
    borderRadius: 10,
    border: "none",
    background: "#1DB954",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
  },
  modalDelete: {
    padding: "10px 13px",
    borderRadius: 10,
    border: "none",
    background: "#dc2626",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
  },
  popupHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  popupCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "#111827",
    color: "#f8fafc",
    cursor: "pointer",
    fontWeight: "bold",
  },
  popupMenuList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  popupMenuButton: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(15,23,42,0.82)",
    color: "#f8fafc",
    cursor: "pointer",
    fontWeight: "bold",
    textAlign: "left",
  },
  toast: {
    position: "fixed",
    left: "50%",
    bottom: 26,
    transform: "translateX(-50%)",
    background: "rgba(16, 185, 129, 0.95)",
    color: "white",
    padding: "12px 18px",
    borderRadius: 999,
    fontWeight: "bold",
    boxShadow: "0 12px 30px rgba(0,0,0,0.24)",
    zIndex: 1200,
  },
  homeReturnModule: {
    display: "flex",
    justifyContent: "flex-start",
    marginTop: 14,
    marginBottom: 20,
  },
  homeReturnButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "9px 12px",
    borderRadius: 12,
    background: "rgba(15,23,42,0.85)",
    border: "1px solid rgba(148,163,184,0.18)",
    color: "#e2e8f0",
    fontWeight: "bold",
    fontSize: 13,
    textDecoration: "none",
  },
};
