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
    <div style={{ padding: 20, color: "white" }}>
      <h1>Créer ou rejoindre une soirée</h1>

      <input
        placeholder="Ton prénom"
        value={usernameInput}
        onChange={(e) => setUsernameInput(e.target.value)}
      />
      <button onClick={handleLocalLogin}>Valider</button>

      <hr />

      <input
        placeholder="Nom de la soirée"
        value={roomName}
        onChange={(e) => setRoomName(e.target.value)}
      />
      <button onClick={handleCreateRoom}>
        {isCreating ? "Création..." : "Créer une soirée"}
      </button>

      <hr />

      <input
        placeholder="CODE"
        value={joinCode}
        onChange={(e) => setJoinCode(normalizeCode(e.target.value))}
      />
      <button onClick={handleJoinRoom}>
        {isJoining ? "Connexion..." : "Rejoindre"}
      </button>

      <Link to="/">Retour</Link>

      {errorMessage && <div style={{ color: "red" }}>{errorMessage}</div>}
      {successMessage && <div style={{ color: "green" }}>{successMessage}</div>}
    </div>
  );
}
