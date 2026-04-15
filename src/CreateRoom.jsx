import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { db } from "./firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ADMIN_PIN = "1234";

export default function CreateRoom() {
  const navigate = useNavigate();

  const [username] = useState(() => localStorage.getItem("username") || "");
  const [userId] = useState(() => {
    let id = localStorage.getItem("userId");
    if (!id) {
      id = Math.random().toString(36).substring(2, 15);
      localStorage.setItem("userId", id);
    }
    return id;
  });

  const [roomName, setRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(
    () => localStorage.getItem("isSpotifyAdmin") === "true"
  );

  const roomsCollectionRef = useMemo(() => collection(db, "rooms"), []);

  const normalizeCode = (value) =>
    String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, ROOM_CODE_LENGTH);

  const generateRoomCode = () => {
    let code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
      const randomIndex = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
      code += ROOM_CODE_CHARS[randomIndex];
    }
    return code;
  };

  const findUniqueRoomCode = async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = generateRoomCode();

      const existingQuery = query(
        roomsCollectionRef,
        where("code", "==", candidate)
      );
      const existingSnapshot = await getDocs(existingQuery);

      if (existingSnapshot.empty) {
        return candidate;
      }
    }

    throw new Error("Impossible de générer un code de soirée unique");
  };

  const goToRoom = (roomId, roomCode) => {
    localStorage.setItem("activeRoomId", roomId);
    localStorage.setItem("currentRoomCode", roomCode);
    localStorage.setItem("activeRoomCode", roomCode);

    navigate(`/app?room=${encodeURIComponent(roomCode)}`);
  };

  const logoutUser = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("isSpotifyAdmin");
    setShowUserMenu(false);
    window.location.reload();
  };

  const unlockAdminMode = () => {
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
  };

  const lockAdminMode = () => {
    localStorage.removeItem("isSpotifyAdmin");
    setIsAdminUnlocked(false);
    setShowUserMenu(false);
    setShowPinModal(false);
    setPinInput("");
    setPinError("");
  };

  const handleCreateRoom = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    const cleanName = username;
    if (!cleanName) {
      setErrorMessage("Connecte d’abord un utilisateur avant de créer une soirée.");
      return;
    }

    const cleanRoomName = roomName.trim();
    if (!cleanRoomName) {
      setErrorMessage("Donne un nom à la soirée.");
      return;
    }

    try {
      setIsCreating(true);

      const uniqueCode = await findUniqueRoomCode();

      const roomDocRef = await addDoc(roomsCollectionRef, {
        name: cleanRoomName,
        code: uniqueCode,
        hostUserId: userId,
        spotifyOwnerUserId: userId,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(doc(db, "rooms", roomDocRef.id, "members", userId), {
        userId,
        name: cleanName,
        isHost: true,
        isAdmin: true,
        isConnected: true,
        joinedAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
      });

      setSuccessMessage(`Soirée créée avec le code ${uniqueCode}`);
      goToRoom(roomDocRef.id, uniqueCode);
    } catch (error) {
      console.error("create room error:", error);
      setErrorMessage(
        error?.message || "Impossible de créer la soirée pour le moment."
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    const cleanName = username;
    if (!cleanName) {
      setErrorMessage("Connecte d’abord un utilisateur avant de rejoindre une soirée.");
      return;
    }

    const cleanCode = normalizeCode(joinCode);
    if (cleanCode.length !== ROOM_CODE_LENGTH) {
      setErrorMessage(`Entre un code soirée de ${ROOM_CODE_LENGTH} caractères.`);
      return;
    }

    try {
      setIsJoining(true);

      const roomQuery = query(roomsCollectionRef, where("code", "==", cleanCode));
      const roomSnapshot = await getDocs(roomQuery);

      if (roomSnapshot.empty) {
        setErrorMessage("Aucune soirée trouvée avec ce code.");
        return;
      }

      const roomDoc = roomSnapshot.docs[0];
      const roomData = roomDoc.data();

      if (!roomData?.isActive) {
        setErrorMessage("Cette soirée n’est plus active.");
        return;
      }

      await setDoc(
        doc(db, "rooms", roomDoc.id, "members", userId),
        {
          userId,
          name: cleanName,
          isHost: roomData.hostUserId === userId,
          isAdmin: false,
          isConnected: true,
          joinedAt: serverTimestamp(),
          lastSeen: serverTimestamp(),
        },
        { merge: true }
      );

      setSuccessMessage(`Soirée trouvée : ${roomData.name}`);
      goToRoom(roomDoc.id, cleanCode);
    } catch (error) {
      console.error("join room error:", error);
      setErrorMessage(error?.message || "Impossible de rejoindre la soirée.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlowTop} />
      <div style={styles.backgroundGlowBottom} />
      <div style={styles.backgroundGlowCenter} />

      <div style={styles.card}>
        <div style={styles.appHeader}>
                    <div style={styles.headerActions}>
            {username ? (
              <button
                style={styles.userMenuButton}
                onClick={() => setShowUserMenu(true)}
              >
                {isAdminUnlocked ? "👑" : "👤"} {username}
              </button>
            ) : null}
          </div>
          <div style={styles.titleRow}>
            <div style={styles.header}>
              <h1 style={styles.title}>Créer ou rejoindre une room</h1>
            </div>
          </div>


        </div>

        <div style={styles.grid}>
          <div style={styles.sectionCard}>
            <div style={styles.badgeGreen}>Créer</div>
            <div style={styles.sectionTitle}>Nouvelle soirée</div>
            <div style={styles.sectionText}>
              Tu deviens host, un code est généré automatiquement, puis tu entres directement dans la room.
            </div>

            <input
              style={styles.input}
              placeholder="Nom de la soirée"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />

            <div style={styles.tipBox}>
              💡 Donne un nom simple et visible, par exemple “Anniv Paul” ou “Soirée Garage”.
            </div>

            <button
              style={styles.primaryButton}
              onClick={handleCreateRoom}
              disabled={isCreating}
            >
              {isCreating ? "Création..." : "Créer une soirée"}
            </button>
          </div>

          <div style={styles.sectionCard}>
            <div style={styles.badgeBlue}>Rejoindre</div>
            <div style={styles.sectionTitle}>Soirée existante</div>
            <div style={styles.sectionText}>
              Entre le code partagé par l’organisateur pour rejoindre la file d’attente.
            </div>

            <input
              style={{ ...styles.input, ...styles.codeInput }}
              placeholder="CODE"
              value={joinCode}
              onChange={(e) => setJoinCode(normalizeCode(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleJoinRoom();
                }
              }}
            />

            <div style={styles.joinHint}>Exemple : AB7K9Q</div>

            <button
              style={styles.primaryBlueButton}
              onClick={handleJoinRoom}
              disabled={isJoining}
            >
              {isJoining ? "Connexion..." : "Rejoindre la soirée"}
            </button>
          </div>
        </div>

        {errorMessage ? <div style={styles.errorBox}>{errorMessage}</div> : null}
        {successMessage ? <div style={styles.successBox}>{successMessage}</div> : null}

        <Link to="/" style={styles.homeLink}>
          ⬅️ Retour à l’accueil
        </Link>
      </div>

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
              inputMode="numeric"
              pattern="[0-9]*"
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
  backgroundGlowCenter: {
    position: "fixed",
    top: "30%",
    left: "50%",
    transform: "translateX(-50%)",
    width: 380,
    height: 380,
    borderRadius: "50%",
    background: "rgba(16,185,129,0.08)",
    filter: "blur(90px)",
    pointerEvents: "none",
  },
  card: {
    width: "100%",
    maxWidth: 780,
    position: "relative",
    zIndex: 1,
  },
  appHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
  header: {
    textAlign: "left",
  },
  title: {
    margin: 0,
    fontSize: 36,
    lineHeight: 1.08,
    color: "#f8fafc",
  },
  subtitle: {
    marginTop: 10,
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 640,
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 16,
  },
  sectionCard: {
    background: "rgba(15, 23, 42, 0.82)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    boxShadow: "0 10px 40px rgba(0,0,0,0.28)",
    backdropFilter: "blur(10px)",
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "bold",
    marginBottom: 10,
  },
  sectionText: {
    fontSize: 14,
    color: "#cbd5e1",
    lineHeight: 1.6,
    marginBottom: 14,
  },
  input: {
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.18)",
    width: "100%",
    boxSizing: "border-box",
    fontSize: 14,
    background: "#0f172a",
    color: "#f8fafc",
    outline: "none",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
  },
  codeInput: {
    textTransform: "uppercase",
    letterSpacing: 6,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "bold",
  },
  primaryButton: {
    width: "100%",
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    border: "none",
    background: "linear-gradient(135deg, #1DB954, #16a34a)",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
    boxShadow: "0 10px 24px rgba(29,185,84,0.24)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  },
  primaryBlueButton: {
    width: "100%",
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    border: "none",
    background: "linear-gradient(135deg, #3b82f6, #2563eb)",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
    boxShadow: "0 10px 24px rgba(59,130,246,0.24)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  },
  joinHint: {
    marginTop: 10,
    fontSize: 12,
    color: "#93c5fd",
    textAlign: "center",
    fontWeight: "bold",
  },
  tipBox: {
    marginTop: 12,
    padding: "12px 14px",
    borderRadius: 16,
    background: "rgba(29,185,84,0.08)",
    border: "1px solid rgba(29,185,84,0.12)",
    color: "#d1fae5",
    fontSize: 13,
    lineHeight: 1.5,
  },
  errorBox: {
    marginTop: 8,
    marginBottom: 14,
    padding: "12px 14px",
    borderRadius: 14,
    color: "#fecaca",
    background: "rgba(127,29,29,0.24)",
    border: "1px solid rgba(239,68,68,0.25)",
    fontWeight: "bold",
  },
  successBox: {
    marginTop: 8,
    marginBottom: 14,
    padding: "12px 14px",
    borderRadius: 14,
    color: "#d1fae5",
    background: "rgba(6,95,70,0.24)",
    border: "1px solid rgba(16,185,129,0.25)",
    fontWeight: "bold",
  },
  badgeGreen: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "bold",
    color: "#d1fae5",
    background: "rgba(29,185,84,0.12)",
    border: "1px solid rgba(29,185,84,0.18)",
    marginBottom: 12,
  },
  badgeBlue: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "bold",
    color: "#dbeafe",
    background: "rgba(59,130,246,0.12)",
    border: "1px solid rgba(59,130,246,0.18)",
    marginBottom: 12,
  },
  homeLink: {
    display: "inline-flex",
    marginTop: 6,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(15,23,42,0.85)",
    border: "1px solid rgba(148,163,184,0.18)",
    color: "#e2e8f0",
    fontWeight: "bold",
    fontSize: 13,
    textDecoration: "none",
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
  errorText: {
    fontSize: 12,
    color: "#fca5a5",
    marginTop: 10,
  },
};
