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
  updateDoc,
} from "firebase/firestore";

export default function App() {

  // =========================
  // 🎯 INPUT STATES
  // =========================
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [tracks, setTracks] = useState([]);

  // =========================
  // 👤 USER ID LOCAL
  // =========================
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
  // ➕ ADD TRACK
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
  // ❌ DELETE TRACK
  // =========================
  const removeTrack = async (id) => {
    await deleteDoc(doc(db, "tracks", id));
  };

  // =========================
  // 👍 TOGGLE VOTE (VOTE / UNVOTE)
  // =========================
  const handleVote = async (track) => {
    const trackRef = doc(db, "tracks", track.id);

    const alreadyVoted = track.votedBy?.includes(userId);

    // =========================
    // ❌ RETRAIT DU VOTE
    // =========================
    if (alreadyVoted) {
      await updateDoc(trackRef, {
        votes: Math.max((track.votes || 1) - 1, 0),
        votedBy: (track.votedBy || []).filter((id) => id !== userId),
      });

      return;
    }

    // =========================
    // 👍 AJOUT DU VOTE
    // =========================
    await updateDoc(trackRef, {
      votes: (track.votes || 0) + 1,
      votedBy: [...(track.votedBy || []), userId],
    });
  };

  // =========================
  // 🎨 UI
  // =========================
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>🎵 PLAYLIST</h1>

        {/* INPUTS */}
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

        {/* LIST */}
        <div style={styles.list}>
          {tracks.map((item) => {

            const hasVoted = item.votedBy?.includes(userId);

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

                {/* CONTENT */}
                <div style={styles.item}>
                  <div>
                    <div style={styles.titleText}>{item.title}</div>
                    <div style={styles.artistText}>{item.artist}</div>
                  </div>
                </div>

                {/* VOTE BUTTON TOGGLE */}
                <button
                  style={{
                    ...styles.voteButton,
                    background: hasVoted ? "#ef4444" : "#2563eb",
                  }}
                  onClick={() => handleVote(item)}
                >
                  {hasVoted ? "Annuler vote" : "Voter"}
                </button>

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
};
