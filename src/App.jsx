import { useEffect, useState } from "react";
import { db } from "./firebase";

// 🔌 Firestore
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc, // ⭐ AJOUT POUR LE VOTE
} from "firebase/firestore";

export default function App() {

  // =========================
  // 🎯 INPUT STATES
  // =========================
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [tracks, setTracks] = useState([]);

  // =========================
  // 👆 SWIPE STATE
  // =========================
  const [swipeX, setSwipeX] = useState({});

  // =========================
  // 🔥 FIREBASE CONFIG
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
  // 👆 SWIPE START
  // =========================
  const handleTouchStart = (e, id) => {
    const startX = e.touches[0].clientX;

    setSwipeX((prev) => ({
      ...prev,
      [id]: { startX, moveX: 0 },
    }));
  };

  // =========================
  // 👉 SWIPE MOVE
  // =========================
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

  // =========================
  // ✋ SWIPE END
  // =========================
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
  // 👍 VOTE (NEW)
  // =========================
  const handleVote = async (id, currentVotes) => {
    const trackRef = doc(db, "tracks", id);

    await updateDoc(trackRef, {
      votes: (currentVotes || 0) + 1,
    });
  };

  // =========================
  // 🎨 UI
  // =========================
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>🎵 PLAYLIST</h1>

        {/* =========================
            📝 INPUTS
        ========================= */}
        <div style={styles.inputCol}>
          <input
            style={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre du son"
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
            📋 LISTE
        ========================= */}
        <div style={styles.list}>
          {tracks.map((item) => (
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

              {/* 👍 VOTES VISUELS */}
              <div style={styles.voteBox}>
                <span style={styles.voteIcon}>👍</span>
                <span style={styles.voteCount}>{item.votes || 0}</span>
              </div>

              {/* 🎵 CONTENU */}
              <div style={styles.item}>
                <div>
                  <div style={styles.titleText}>{item.title}</div>
                  <div style={styles.artistText}>{item.artist}</div>
                </div>
              </div>

              {/* 🟢 BOUTON VOTE */}
              <button
                style={styles.voteButton}
                onClick={() => handleVote(item.id, item.votes)}
              >
                Voter
              </button>

            </div>
          ))}
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
    display: "flex",
    justifyContent: "space-between",
    padding: 10,
    background: "#fafafa",
    borderRadius: 10,
  },

  titleText: { fontWeight: "bold", fontSize: 14 },
  artistText: { fontSize: 11, color: "#666" },

  voteBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: 40,
  },

  voteIcon: { fontSize: 14 },
  voteCount: { fontSize: 12, fontWeight: "bold" },

  voteButton: {
    padding: "6px 10px",
    border: "none",
    background: "#2563eb",
    color: "white",
    borderRadius: 8,
    fontSize: 12,
    cursor: "pointer",
  },
};
