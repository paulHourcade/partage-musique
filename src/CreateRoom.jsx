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

export default function CreateRoom() {
  const navigate = useNavigate();

  const [usernameInput, setUsernameInput] = useState(
    () => localStorage.getItem("username") || ""
  );
  const [username, setUsername] = useState(
    () => localStorage.getItem("username") || ""
  );

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
  const [createdRoomCode, setCreatedRoomCode] = useState("");
  const [copied, setCopied] = useState(false);

  const roomsCollectionRef = useMemo(() => collection(db, "rooms"), []);

  const normalizeCode = (value) =>
    String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, ROOM_CODE_LENGTH);

  const saveUsernameIfNeeded = () => {
    const cleanName = usernameInput.trim();
    if (!cleanName) return "";

    localStorage.setItem("username", cleanName);
    setUsername(cleanName);
    return cleanName;
  };

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

  const copyRoomCode = async () => {
    if (!createdRoomCode) return;

    try {
      await navigator.clipboard.writeText(createdRoomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const handleLocalLogin = () => {
    setErrorMessage("");
    setSuccessMessage("");

    const cleanName = usernameInput.trim();
    if (!cleanName) {
      setErrorMessage("Entre d’abord un prénom ou un pseudo.");
      return;
    }

    localStorage.setItem("username", cleanName);
    setUsername(cleanName);
    setSuccessMessage("Nom enregistré.");
  };

  const handleCreateRoom = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setCreatedRoomCode("");
    setCopied(false);

    const cleanName = saveUsernameIfNeeded();
    if (!cleanName) {
      setErrorMessage("Entre ton prénom avant de créer une soirée.");
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

      setCreatedRoomCode(uniqueCode);
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
    setCreatedRoomCode("");
    setCopied(false);

    const cleanName = saveUsernameIfNeeded();
    if (!cleanName) {
      setErrorMessage("Entre ton prénom avant de rejoindre une soirée.");
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
        <div style={styles.header}>
          <div style={styles.badge}>🎉 MODE SOIRÉE</div>
          <h1 style={styles.title}>Créer ou rejoindre une room</h1>
          <div style={styles.subtitle}>
            Une playlist collaborative en temps réel. Un code à partager. Une ambiance commune.
          </div>
        </div>

        <div style={styles.heroCard}>
          <div style={styles.heroLine}>
            <div style={styles.heroPill}>Host unique</div>
            <div style={styles.heroPill}>Code rapide</div>
            <div style={styles.heroPill}>Temps réel</div>
          </div>

          <div style={styles.heroTitle}>Lance la soirée en quelques secondes</div>
          <div style={styles.heroText}>
            Crée une room, partage le code avec tes amis, puis laisse tout le monde alimenter la file d’attente.
          </div>

          {createdRoomCode ? (
            <div style={styles.codeShowcase}>
              <div style={styles.codeShowcaseLabel}>Code de la soirée</div>
              <div style={styles.codeShowcaseValue}>{createdRoomCode}</div>
              <button style={styles.copyCodeButton} onClick={copyRoomCode}>
                {copied ? "Code copié" : "Copier le code"}
              </button>
            </div>
          ) : null}
        </div>

        <div style={styles.sectionCard}>
          <div style={styles.sectionTitle}>Ton nom dans la soirée</div>
          <div style={styles.sectionText}>
            C’est le nom qui sera affiché aux autres participants dans la room.
          </div>

          <div style={styles.row}>
            <input
              style={styles.input}
              placeholder="Ton prénom ou pseudo"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
            />
            <button style={styles.secondaryButton} onClick={handleLocalLogin}>
              Enregistrer
            </button>
          </div>

          <div style={styles.infoText}>
            Utilisateur actuel : {username ? username : "non défini"}
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
  header: {
    marginBottom: 18,
    textAlign: "center",
  },
  badge: {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: 999,
    background: "rgba(29,185,84,0.15)",
    color: "#86efac",
    fontWeight: "bold",
    marginBottom: 12,
    letterSpacing: 0.8,
    fontSize: 12,
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
    marginLeft: "auto",
    marginRight: "auto",
  },
  heroCard: {
    background:
      "linear-gradient(135deg, rgba(29,185,84,0.16), rgba(15,23,42,0.92), rgba(15,23,42,0.88))",
    border: "1px solid rgba(29,185,84,0.18)",
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
    boxShadow: "0 16px 50px rgba(0,0,0,0.30)",
    backdropFilter: "blur(14px)",
  },
  heroLine: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  heroPill: {
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#d1fae5",
    fontSize: 12,
    fontWeight: "bold",
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
    lineHeight: 1.15,
  },
  heroText: {
    color: "#dbeafe",
    lineHeight: 1.6,
    fontSize: 15,
    maxWidth: 620,
  },
  codeShowcase: {
    marginTop: 18,
    padding: 18,
    borderRadius: 22,
    background: "rgba(2,6,23,0.42)",
    border: "1px solid rgba(59,130,246,0.18)",
    textAlign: "center",
  },
  codeShowcaseLabel: {
    fontSize: 13,
    color: "#93c5fd",
    marginBottom: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  codeShowcaseValue: {
    fontSize: 34,
    letterSpacing: 8,
    fontWeight: "bold",
    color: "#f8fafc",
    marginBottom: 14,
  },
  copyCodeButton: {
    padding: "11px 16px",
    borderRadius: 14,
    border: "1px solid rgba(59,130,246,0.24)",
    background: "rgba(59,130,246,0.14)",
    color: "#dbeafe",
    cursor: "pointer",
    fontWeight: "bold",
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
  row: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
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
  secondaryButton: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.16)",
    background: "#0f172a",
    color: "#e2e8f0",
    cursor: "pointer",
    fontWeight: "bold",
  },
  infoText: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 10,
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
};
