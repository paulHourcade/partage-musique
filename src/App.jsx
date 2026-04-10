import { useEffect, useState } from "react";
import { db } from "./firebase";


import {
  addDoc, 
  arrayUnion,
  arrayRemove ,
  collection,
  deleteDoc,
  doc,
  increment,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";

export default function App() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [tracks, setTracks] = useState([]);

  // 📦 collection Firestore
  const colRef = collection(db, "tracks");
  const q = query(colRef, orderBy("createdAt", "desc"));

  // 📡 realtime listener
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

// On récupère un ID unique par utilisateur pour l'empêcher de voter plusieurs fois 
const getUserId = () => {
  let id = localStorage.getItem("userId");

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("userId", id);
  }
  return id;
};
const userId = getUserId();
  

  // ➕ ajouter un son
  const addTrack = async () => {
    if (!title.trim()) return;

    await addDoc(colRef, {
      title,
      artist: artist || "Unknown",
      votes: 0,
      createdAt: Date.now(),
      votedBy: [],
      createdAt: Date.Now
    });

    setTitle("");
    setArtist("");
  };

  // ❌ supprimer
  const removeTrack = async (id) => {
    await deleteDoc(doc(db, "tracks", id));
  };

  // 👍 voter

const voteTrack = async (id) => {
  const ref = doc(db, "tracks", id);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const data = snap.data();
  const hasVoted = data.votedBy?.includes(userId);

  if (hasVoted) {
    // 👎 retirer vote
    await updateDoc(ref, {
      votes: increment(-1),
      votedBy: arrayRemove(userId),
    });
  } else {
    // 👍 ajouter vote
    await updateDoc(ref, {
      votes: increment(1),
      votedBy: arrayUnion(userId),
    });
  }
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
            placeholder="Artiste (optionnel)"
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
                <div>
                  <div style={{ fontWeight: "bold" }}>
                    {index + 1}. {item.title}
                  </div>

                  <div style={{ fontSize: 12, color: "#666" }}>
                    {item.artist}
                  </div>
                </div>

                <div style={styles.actions}>
                  <button onClick={() => voteTrack(item.id)}>
                    {item.votedBy?.includes(userId) ? "👎" : "👍"} {item.votes || 0}
                  </button>
                  <button
                    style={styles.delete}
                    onClick={() => removeTrack(item.id)}
                  >
                    ✕
                  </button>
                </div>
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
    alignItems: "center",
    padding: 12,
    border: "1px solid #eee",
    borderRadius: 10,
    background: "#fafafa",
  },

  actions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },

  vote: {
    border: "none",
    background: "#e2e8f0",
    padding: "6px 10px",
    borderRadius: 8,
    cursor: "pointer",
  },

  delete: {
    border: "none",
    background: "transparent",
    color: "red",
    cursor: "pointer",
    fontSize: 16,
  },

  empty: {
    textAlign: "center",
    color: "#888",
    padding: 20,
  },
};
