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
} from "firebase/firestore";

export default function App() {

  // =========================
  // 🎯 STATES INPUTS
  // =========================
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [tracks, setTracks] = useState([]);

  // =========================
  // 👆 STATE SWIPE (NEW)
  // =========================
  // stocke le déplacement horizontal de chaque item
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
      [id]: {
        startX,
        moveX: 0,
      },
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

    // ❌ swipe gauche suffisant → delete
    if (item.moveX < -80) {
      removeTrack(id);
    }

    // 🔄 reset animation
    setSwipeX((prev) => ({
      ...prev,
      [id]: {
        startX: 0,
        moveX: 0,
      },
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
          {tracks.length === 0 ? (
            <div style={styles.empty}>Aucun morceau</div>
          ) : (
            tracks.map((item) => (
              
              // =========================
              // 📦 SWIPE ITEM
              // =========================
              <div
                key={item.id}
                style={{
                  ...styles.itemRow,

                  // 🎯 déplacement swipe
                  transform: `translateX(${swipeX[item.id]?.moveX || 0}px)`,

                  // 🎬 animation retour
                  transition: "transform 0.2s",
                }}

                // 👇 events tactile
                onTouchStart={(e) => handleTouchStart(e, item.id)}
                onTouchMove={(e) => handleTouchMove(e, item.id)}
                onTouchEnd={() => handleTouchEnd(item.id)}
              >

                {/* ❌ DELETE */}
                <button
                  style={styles.delete}
                  onClick={() => removeTrack(item.id)}
                >
                  ✕
                </button>

                {/* 🎵 CONTENT */}
                <div style={styles.item}>
                  <div style={styles.text}>
                    <div style={styles.titleText}>
                      {item.title}
                    </div>

                    <div style={styles.artistText}>
                      {item.artist || "Unknown"}
                    </div>
                  </div>

                  {/* 👍 VOTES */}
                  <div style={styles.votes}>
                    👍 {item.votes || 0}
                  </div>
                </div>

              </div>
            ))
          )}
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
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  },

  title: {
    marginBottom: 20,
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
    cursor: "pointer",
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
    marginBottom: 6,
  },

  item: {
    flex: 1,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    border: "1px solid #eee",
    borderRadius: 10,
    background: "#fafafa",
  },

  text: {
    display: "flex",
    flexDirection: "column",
  },

  titleText: {
    fontWeight: "bold",
    fontSize: 14,
  },

  artistText: {
    fontSize: 11,
    color: "#666",
  },

  votes: {
    fontWeight: "bold",
    fontSize: 13,
  },

  delete: {
    border: "none",
    background: "transparent",
    color: "red",
    cursor: "pointer",
    fontSize: 16,
    padding: 4,
  },

  empty: {
    textAlign: "center",
    color: "#888",
    padding: 20,
  },
};
