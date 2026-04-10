import { useEffect, useState } from "react";
import { db } from "./firebase";

import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";

export default function App() {

  // =========================
  // 🎵 INPUT MUSIQUE
  // =========================
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");

  // =========================
  // 📦 LISTE MUSIQUES
  // =========================
  const [tracks, setTracks] = useState([]);

  // =========================
  // 👤 AUTH SIMPLE (USER)
  // =========================
  const [usernameInput, setUsernameInput] = useState("");
  const [username, setUsername] = useState(() => {
    return localStorage.getItem("username") || "";
  });

  // 🆔 user unique local
  const [userId] = useState(() => {
    let id = localStorage.getItem("userId");

    if (!id) {
      id = Math.random().toString(36).substring(2, 15);
      localStorage.setItem("userId", id);
    }

    return id;
  });

  // =========================
  // 👆 SWIPE STATE
  // =========================
  const [swipeX, setSwipeX] = useState({});

  // =========================
  // 🔥 FIREBASE
  // =========================
  const colRef = collection(db, "tracks");
  const q = query(colRef, orderBy("createdAt", "desc"));

  // =========================
  // 📡 REALTIME LISTENER
  // =========================
  useEffect(() => {
    const unsub = onSnapshot(q, (snapshot) => {
      setTracks(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
    });

    return () => unsub();
  }, []);

  // =========================
  // 👤 VALIDATION USERNAME
  // =========================
  const handleLogin = () => {
    if (!usernameInput.trim()) return;

    setUsername(usernameInput);
    localStorage.setItem("username", usernameInput);
    setUsernameInput("");
  };

  // =========================
  // ➕ AJOUT MUSIQUE
  // =========================
  const addTrack = async () => {
    if (!title.trim()) return;

    await addDoc(colRef, {
      title,
      artist: artist || "Unknown",
      createdAt: Date.now(),
      votes: 0,
      votedBy: [],
    });

    setTitle("");
    setArtist("");
  };

  // =========================
  // ❌ SUPPRESSION
  // =========================
  const removeTrack = async (id) => {
    await deleteDoc(doc(db, "tracks", id));
  };

  // =========================
  // 👍 VOTE AVEC IDENTITÉ
  // =========================
  const handleVote = async (track) => {

    // 🚫 sécurité : pas connecté = pas de vote
    if (!username) return;

    const trackRef = doc(db, "tracks", track.id);

    const alreadyVoted = track.votedBy?.some(
      (v) => v.id === userId
    );

    // ❌ retirer vote
    if (alreadyVoted) {
      await updateDoc(trackRef, {
        votes: Math.max((track.votes || 1) - 1, 0),
        votedBy: (track.votedBy || []).filter(
          (v) => v.id !== userId
        ),
      });
      return;
    }

    // 👍 ajouter vote avec identité
    await updateDoc(trackRef, {
      votes: (track.votes || 0) + 1,
      votedBy: [
        ...(track.votedBy || []),
        {
          id: userId,
          name: username
        }
      ],
    });
  };

  // =========================
  // 👆 SWIPE DELETE
  // =========================
  const handleTouchStart = (e, id) => {
    const startX = e.touches[0].clientX;

    setSwipeX((prev) => ({
      ...prev,
      [id]: { startX, moveX: 0 },
    }));
  };

  const handleTouchMove = (e, id) => {
    const moveX = e.touches[0].clientX;

    setSwipeX((prev) => {
      const item = prev[id];
      if (!item) return prev;

      return {
        ...prev,
        [id]: {
          ...item,
          moveX: moveX - item.startX,
        },
      };
    });
  };

  const handleTouchEnd = (id) => {
    const item = swipeX[id];
    if (!item) return;

    if (item.moveX < -80) {
      removeTrack(id);
    }

    setSwipeX((prev) => ({
      ...prev,
      [id]: { startX: 0, moveX: 0 },
    }));
  };

  // =========================
  // 🎨 UI
  // =========================
  return (
    <div style={styles.page}>
      <div style={styles.card}>

        <h1 style={styles.title}>🎵 PLAYLIST</h1>

        {/* =========================
            👤 LOGIN BLOCK
        ========================= */}
        {!username ? (
          <div style={styles.loginBox}>
            <input
              style={styles.input}
              placeholder="Ton nom"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
            />

            <button style={styles.button} onClick={handleLogin}>
              Valider
            </button>
          </div>
        ) : (
          <div style={styles.loggedAs}>
            👤 Connecté en tant que <b>{username}</b>
          </div>
        )}

        {/* =========================
            📝 ADD TRACK
        ========================= */}
        <div style={styles.inputCol}>
          <input
            style={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre"
          />

          <input
            style={styles.input}
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artiste"
          />

          <button style={styles.button} onClick={addTrack}>
            Ajouter
          </button>
        </div>

        {/* =========================
            📋 LIST
        ========================= */}
        <div style={styles.list}>
          {tracks.map((item) => {

            const hasVoted = item.votedBy?.some(
              (v) => v.id === userId
            );

            return (
              <div
                key={item.id}
                style={{
                  ...styles.itemRow,
                  transform: `translateX(${swipeX[item.id]?.moveX || 0}px)`,
                  transition: "transform 0.2s",
                }}
                onTouchStart={(e) => handleTouchStart(e, item.id)}
                onTouchMove={(e) => handleTouchMove(e, item.id)}
                onTouchEnd={() => handleTouchEnd(item.id)}
              >

                {/* VOTES VISUELS */}
                <div style={styles.voteBox}>
                  <span>👍</span>
                  <span>{item.votes || 0}</span>
                </div>

                {/* CONTENU */}
                <div style={styles.item}>
                  <div>
                    <div style={styles.titleText}>{item.title}</div>
                    <div style={styles.artistText}>{item.artist}</div>

                    {/* 👥 QUI A VOTÉ */}
                    {item.votedBy?.length > 0 && (
                      <div style={styles.voters}>
                        {item.votedBy.map((v) => v.name).join(", ")}
                      </div>
                    )}
                  </div>
                </div>

                {/* 👍 BOUTON VOTE (UNIQUEMENT SI CONNECTÉ) */}
                {username && (
                  <button
                    style={{
                      ...styles.voteButton,
                      background: hasVoted ? "#ef4444" : "#2563eb",
                    }}
                    onClick={() => handleVote(item)}
                  >
                    {hasVoted ? "Annuler vote" : "Voter"}
                  </button>
                )}

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

/* =========================
🎨 STYLES
========================= */
const styles = {

  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f1f5f9",
    fontFamily: "Arial",
    padding: 12,
  },

  card: {
    width: "100%",
    maxWidth: 420,
    background: "white",
    borderRadius: 16,
    padding: 16,
  },

  title: { marginBottom: 20 },

  loginBox: {
    display: "flex",
    gap: 10,
    marginBottom: 15,
  },

  loggedAs: {
    fontSize: 12,
    marginBottom: 10,
    color: "#555",
  },

  inputCol: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 20,
  },

  input: {
    padding: 12,
    border: "1px solid #ddd",
    borderRadius: 10,
  },

  button: {
    padding: "12px 16px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 10,
  },

  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  itemRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },

  item: {
    flex: 1,
    padding: 10,
    background: "#fafafa",
    borderRadius: 10,
  },

  titleText: { fontWeight: "bold", fontSize: 14 },
  artistText: { fontSize: 11, color: "#666" },

  voteBox: {
    width: 40,
    textAlign: "center",
  },

  voteButton: {
    padding: "6px 10px",
    border: "none",
    color: "white",
    borderRadius: 8,
    fontSize: 12,
    cursor: "pointer",
  },

  voters: {
    fontSize: 10,
    color: "#666",
    marginTop: 4,
  },
};
