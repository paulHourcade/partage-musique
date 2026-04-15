import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "./firebase";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

function generateRoomCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function createUniqueRoomCode() {
  let attempts = 0;

  while (attempts < 10) {
    const code = generateRoomCode(6);
    const roomRef = doc(db, "rooms", code);

    const existing = await getDocs(
      query(collection(db, "rooms"), where("code", "==", code))
    );

    if (existing.empty) {
      return { code, roomRef };
    }

    attempts += 1;
  }

  throw new Error("Impossible de générer un code room unique.");
}

export default function CreateRoom() {
  const navigate = useNavigate();

  const [hostName, setHostName] = useState(() => {
    return localStorage.getItem("username") || "";
  });
  const [joinName, setJoinName] = useState(() => {
    return localStorage.getItem("username") || "";
  });

  const [roomName, setRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);

  const [createError, setCreateError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const pageTitle = useMemo(() => "Création room", []);

  async function handleCreateRoom() {
    setCreateError("");
    setSuccessMessage("");

    const trimmedHostName = hostName.trim();
    const trimmedRoomName = roomName.trim();

    if (!trimmedHostName) {
      setCreateError("Renseigne ton nom pour créer une room.");
      return;
    }

    if (!trimmedRoomName) {
      setCreateError("Renseigne un nom de room.");
      return;
    }

    try {
      setLoadingCreate(true);

      const { code, roomRef } = await createUniqueRoomCode();

      const hostId =
        localStorage.getItem("userId") ||
        Math.random().toString(36).substring(2, 15);

      localStorage.setItem("username", trimmedHostName);
      localStorage.setItem("userId", hostId);
      localStorage.setItem("currentRoomCode", code);
      localStorage.setItem("isSpotifyAdmin", "true");

      await setDoc(roomRef, {
        code,
        name: trimmedRoomName,
        createdAt: serverTimestamp(),
        createdBy: {
          id: hostId,
          name: trimmedHostName,
        },
        spotifyAdminUserId: hostId,
        spotifyAdminName: trimmedHostName,
        isActive: true,
        membersCount: 1,
      });

      await setDoc(doc(db, "rooms", code, "members", hostId), {
        id: hostId,
        name: trimmedHostName,
        role: "host",
        isAdmin: true,
        joinedAt: serverTimestamp(),
      });

      setSuccessMessage(`Room créée avec succès : ${code}`);

      navigate(`/app?room=${code}`);
    } catch (error) {
      console.error(error);
      setCreateError("Impossible de créer la room.");
    } finally {
      setLoadingCreate(false);
    }
  }

  async function handleJoinRoom() {
    setJoinError("");
    setSuccessMessage("");

    const trimmedJoinName = joinName.trim();
    const formattedCode = joinCode.trim().toUpperCase();

    if (!trimmedJoinName) {
      setJoinError("Renseigne ton nom pour rejoindre une room.");
      return;
    }

    if (!formattedCode) {
      setJoinError("Renseigne un code room.");
      return;
    }

    try {
      setLoadingJoin(true);

      const roomQuery = await getDocs(
        query(collection(db, "rooms"), where("code", "==", formattedCode))
      );

      if (roomQuery.empty) {
        setJoinError("Aucune room trouvée avec ce code.");
        return;
      }

      const roomData = roomQuery.docs[0].data();

      if (!roomData.isActive) {
        setJoinError("Cette room n'est plus active.");
        return;
      }

      const userId =
        localStorage.getItem("userId") ||
        Math.random().toString(36).substring(2, 15);

      localStorage.setItem("username", trimmedJoinName);
      localStorage.setItem("userId", userId);
      localStorage.setItem("currentRoomCode", formattedCode);
      localStorage.setItem("isSpotifyAdmin", "false");

      await setDoc(doc(db, "rooms", formattedCode, "members", userId), {
        id: userId,
        name: trimmedJoinName,
        role: "guest",
        isAdmin: false,
        joinedAt: serverTimestamp(),
      });

      setSuccessMessage(`Tu as rejoint la room : ${formattedCode}`);

      navigate(`/app?room=${formattedCode}`);
    } catch (error) {
      console.error(error);
      setJoinError("Impossible de rejoindre la room.");
    } finally {
      setLoadingJoin(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.glowTop} />
      <div style={styles.glowBottom} />

      <div style={styles.container}>
        <div style={styles.headerCard}>
          <div style={styles.emoji}>🏠</div>
          <div style={styles.title}>{pageTitle}</div>
          <div style={styles.subtitle}>
            Crée une soirée ou rejoins-en une avec un code.
          </div>
        </div>

        <div style={styles.grid}>
          <div style={styles.card}>
            <div style={styles.cardTitle}>Créer une room</div>

            <input
              style={styles.input}
              type="text"
              placeholder="Ton nom"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
            />

            <input
              style={styles.input}
              type="text"
              placeholder="Nom de la room"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />

            {createError ? <div style={styles.error}>{createError}</div> : null}

            <button
              style={styles.primaryButton}
              onClick={handleCreateRoom}
              disabled={loadingCreate}
            >
              {loadingCreate ? "Création..." : "Créer la room"}
            </button>
          </div>

          <div style={styles.card}>
            <div style={styles.cardTitle}>Rejoindre une room</div>

            <input
              style={styles.input}
              type="text"
              placeholder="Ton nom"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
            />

            <input
              style={styles.input}
              type="text"
              placeholder="Code room"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />

            {joinError ? <div style={styles.error}>{joinError}</div> : null}

            <button
              style={styles.secondaryButton}
              onClick={handleJoinRoom}
              disabled={loadingJoin}
            >
              {loadingJoin ? "Connexion..." : "Rejoindre la room"}
            </button>
          </div>
        </div>

        {successMessage ? <div style={styles.success}>{successMessage}</div> : null}

        <Link to="/" style={styles.backButton}>
          Retour accueil
        </Link>
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
  container: {
    maxWidth: 860,
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
    paddingTop: 30,
    paddingBottom: 30,
  },
  headerCard: {
    borderRadius: 28,
    padding: 28,
    marginBottom: 18,
    background:
      "linear-gradient(135deg, rgba(29,185,84,0.18), rgba(15,23,42,0.94), rgba(15,23,42,0.92))",
    border: "1px solid rgba(29,185,84,0.28)",
    boxShadow: "0 18px 50px rgba(29,185,84,0.14)",
    textAlign: "center",
  },
  emoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#dbeafe",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 16,
  },
  card: {
    borderRadius: 24,
    padding: 22,
    background: "rgba(15,23,42,0.82)",
    border: "1px solid rgba(148,163,184,0.16)",
    boxShadow: "0 14px 40px rgba(0,0,0,0.24)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(2,6,23,0.6)",
    color: "#f8fafc",
    outline: "none",
    fontSize: 15,
    boxSizing: "border-box",
  },
  primaryButton: {
    border: "none",
    borderRadius: 16,
    padding: "14px 16px",
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 15,
    cursor: "pointer",
    marginTop: 4,
  },
  secondaryButton: {
    border: "none",
    borderRadius: 16,
    padding: "14px 16px",
    background: "linear-gradient(135deg, #3b82f6, #2563eb)",
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 15,
    cursor: "pointer",
    marginTop: 4,
  },
  error: {
    color: "#fecaca",
    fontSize: 14,
    background: "rgba(127,29,29,0.28)",
    border: "1px solid rgba(248,113,113,0.25)",
    padding: 10,
    borderRadius: 12,
  },
  success: {
    marginTop: 16,
    color: "#dcfce7",
    fontSize: 14,
    background: "rgba(20,83,45,0.35)",
    border: "1px solid rgba(74,222,128,0.22)",
    padding: 12,
    borderRadius: 14,
    textAlign: "center",
  },
  backButton: {
    display: "inline-block",
    marginTop: 18,
    textDecoration: "none",
    color: "#f8fafc",
    background: "rgba(15,23,42,0.82)",
    border: "1px solid rgba(148,163,184,0.16)",
    padding: "12px 16px",
    borderRadius: 14,
    fontWeight: "bold",
  },
};
