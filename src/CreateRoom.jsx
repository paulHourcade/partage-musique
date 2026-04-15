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

  // =========================
  // USER (global style)
  // =========================
  const [username] = useState(
    () => localStorage.getItem("username") || "Invité"
  );

  const [userId] = useState(() => {
    let id = localStorage.getItem("userId");
    if (!id) {
      id = Math.random().toString(36).substring(2, 15);
      localStorage.setItem("userId", id);
    }
    return id;
  });

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isAdmin, setIsAdmin] = useState(
    () => localStorage.getItem("isSpotifyAdmin") === "true"
  );

  // =========================
  // ROOM STATES
  // =========================
  const [roomName, setRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
    throw new Error("Impossible de générer un code unique");
  };

  const goToRoom = (roomId, roomCode) => {
    localStorage.setItem("currentRoomCode", roomCode);
    navigate(`/app?room=${roomCode}`);
  };

  // =========================
  // CREATE ROOM
  // =========================
  const handleCreateRoom = async () => {
    setErrorMessage("");

    if (!roomName.trim()) {
      setErrorMessage("Donne un nom à la soirée.");
      return;
    }

    try {
      setIsCreating(true);

      const code = await findUniqueRoomCode();

      const roomRef = await addDoc(roomsCollectionRef, {
        name: roomName,
        code,
        hostUserId: userId,
        isActive: true,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, "rooms", roomRef.id, "members", userId), {
        userId,
        name: username,
        isAdmin: true,
        isHost: true,
        joinedAt: serverTimestamp(),
      });

      goToRoom(roomRef.id, code);
    } catch (e) {
      setErrorMessage("Erreur création room");
    } finally {
      setIsCreating(false);
    }
  };

  // =========================
  // JOIN ROOM
  // =========================
  const handleJoinRoom = async () => {
    setErrorMessage("");

    const cleanCode = normalizeCode(joinCode);

    if (cleanCode.length !== ROOM_CODE_LENGTH) {
      setErrorMessage("Code invalide");
      return;
    }

    try {
      setIsJoining(true);

      const q = query(roomsCollectionRef, where("code", "==", cleanCode));
      const snap = await getDocs(q);

      if (snap.empty) {
        setErrorMessage("Room introuvable");
        return;
      }

      const room = snap.docs[0];

      await setDoc(
        doc(db, "rooms", room.id, "members", userId),
        {
          userId,
          name: username,
          isAdmin: false,
          joinedAt: serverTimestamp(),
        },
        { merge: true }
      );

      goToRoom(room.id, cleanCode);
    } catch {
      setErrorMessage("Erreur connexion");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div style={styles.page}>

      {/* USER TOP RIGHT */}
      <div style={styles.topBar}>
        <div style={styles.userBox} onClick={() => setShowUserMenu(!showUserMenu)}>
          {isAdmin ? "👑" : "👤"} {username}
        </div>

        {showUserMenu && (
          <div style={styles.userMenu}>
            <div
              style={styles.userMenuItem}
              onClick={() => {
                localStorage.removeItem("username");
                window.location.reload();
              }}
            >
              Se déconnecter
            </div>
          </div>
        )}
      </div>

      <div style={styles.card}>
        <h1>Créer ou rejoindre une room</h1>

        <input
          style={styles.input}
          placeholder="Nom de la soirée"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
        />

        <button style={styles.button} onClick={handleCreateRoom}>
          {isCreating ? "Création..." : "Créer une soirée"}
        </button>

        <div style={styles.divider}>OU</div>

        <input
          style={styles.input}
          placeholder="CODE"
          value={joinCode}
          onChange={(e) => setJoinCode(normalizeCode(e.target.value))}
        />

        <button style={styles.button} onClick={handleJoinRoom}>
          {isJoining ? "Connexion..." : "Rejoindre"}
        </button>

        {errorMessage && <div style={styles.error}>{errorMessage}</div>}

        <Link to="/">Retour</Link>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#020617",
    color: "white",
  },
  card: {
    width: 400,
    padding: 30,
    background: "#0f172a",
    borderRadius: 20,
    textAlign: "center",
  },
  input: {
    width: "100%",
    padding: 12,
    marginTop: 10,
    borderRadius: 10,
    border: "none",
  },
  button: {
    width: "100%",
    padding: 12,
    marginTop: 10,
    borderRadius: 10,
    background: "#1DB954",
    color: "white",
    border: "none",
  },
  divider: {
    margin: 15,
  },
  error: {
    color: "red",
    marginTop: 10,
  },
  topBar: {
    position: "fixed",
    top: 20,
    right: 20,
  },
  userBox: {
    background: "#0f172a",
    padding: "10px 14px",
    borderRadius: 12,
    cursor: "pointer",
  },
  userMenu: {
    marginTop: 8,
    background: "#020617",
    borderRadius: 10,
  },
  userMenuItem: {
    padding: 10,
    cursor: "pointer",
  },
};
