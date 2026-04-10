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
} from "firebase/firestore";

export default function App() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [tracks, setTracks] = useState([]);

  const colRef = collection(db, "tracks");
  const q = query(colRef, orderBy("createdAt", "desc"));

  // 📡 écoute temps réel
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

  // ➕ ajouter un son
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

  // ❌ supprimer
  const removeTrack = async (id) => {
    await deleteDoc(doc(db, "tracks", id));
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>🎵 Music Queue</h1>

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

        {/* LISTE */}
        <div style={styles.list}>
          {tracks.length === 0 ? (
            <div style={styles.empty}>Aucun morceau</div>
          ) : (
            tracks.map((item, index) => (
              <div key={item.id} style={styles.item}>
                <span>
                  {index + 1}. {item.title} - {item.artist || "Unknown"}
                </span>

                <button
                  style={styles.delete}
                  onClick={() => removeTrack(item.id)}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* 🎨 STYLES */
const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f1f5f9",
    fontFamily: "Arial",
    padding: 20,
  },

  card: {
    width: "100%",
    maxWidth: 520,
    background: "white",
    borderRadius: 16,
    padding: 24,
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

  item: {
    display: "flex",
    justifyContent: "space-between",
    padding: 12,
    border: "1px solid #eee",
    borderRadius: 10,
    background: "#fafafa",
  },

  delete: {
    border: "none",
    background: "transparent",
    color: "red",
    cursor: "pointer",
  },

  empty: {
    textAlign: "center",
    color: "#888",
    padding: 20,
  },
};
