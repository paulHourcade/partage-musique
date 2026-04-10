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
  const [song, setSong] = useState("");
  const [queue, setQueue] = useState([]);

  const colRef = collection(db, "tracks");
  const q = query(colRef, orderBy("createdAt", "desc"));

  // 📡 écoute temps réel
  useEffect(() => {
    const unsub = onSnapshot(q, (snapshot) => {
      setQueue(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
    });

    return () => unsub();
  }, []);

  // ➕ ajouter un son
  const addSong = async () => {
    if (!song.trim()) return;

    await addDoc(colRef, {
      title: song,
      createdAt: Date.now(),
    });

    setSong("");
  };

  // ❌ supprimer
  const removeSong = async (id) => {
    await deleteDoc(doc(db, "tracks", id));
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>🎵 Music Queue</h1>

        <div style={styles.inputRow}>
          <input
            style={styles.input}
            value={song}
            onChange={(e) => setSong(e.target.value)}
            placeholder="Ajouter un son..."
            onKeyDown={(e) => e.key === "Enter" && addSong()}
          />

          <button style={styles.button} onClick={addSong}>
            Ajouter
          </button>
        </div>

        <div style={styles.list}>
          {queue.length === 0 ? (
            <div style={styles.empty}>Aucun morceau</div>
          ) : (
            queue.map((item, index) => (
              <div key={item.id} style={styles.item}>
                <span>
                  {index + 1}. {item.title}
                </span>

                <button
                  style={styles.delete}
                  onClick={() => removeSong(item.id)}
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

  inputRow: {
    display: "flex",
    gap: 10,
    marginBottom: 20,
  },

  input: {
    flex: 1,
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
