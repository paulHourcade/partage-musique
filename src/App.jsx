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
  // 👆 SWIPE STATE
  // =========================
  const [swipeX, setSwipeX] = useState({});

  // =========================
  // ⚠️ MODAL DELETE STATE (NEW)
  // =========================
  const [trackToDelete, setTrackToDelete] = useState(null);

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

    /*Swipe → détecté
          ↓
    seuil dépassé ?
          ↓
    popup confirmation
          ↓
    oui → delete
    non → annule
  */
  
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

    // 🔥 si swipe suffisant vers la gauche
    if (item.moveX < -80) {
      // ⚠️ on ouvre la modal au lieu de supprimer direct
      setTrackToDelete(id);
    }

    // 🔄 reset swipe visuel
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
  // ❌ DELETE TRACK (FIREBASE)
  // =========================
  const removeTrack = async (id) => {
    await deleteDoc(doc(db, "tracks", id));
  };

  // =========================
  // 🧠 CONFIRM DELETE ACTION
  // =========================
  const confirmDelete = async () => {
    if (!trackToDelete) return;

    await removeTrack(trackToDelete);

    // fermeture modal
    setTrackToDelete(null);
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
          
            {/* 👍 VOTES (VISUEL) */}
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
        
          {/* 👍 VOTES À GAUCHE (remplace la croix) */}
          <div style={styles.voteBox}>
            <span style={styles.voteIcon}>👍</span>
            <span style={styles.voteCount}>{item.votes || 0}</span>
          </div>
        
          {/* 🎵 CONTENU PRINCIPAL */}
          <div style={styles.item}>
            <div>
              <div style={styles.titleText}>{item.title}</div>
              <div style={styles.artistText}>{item.artist}</div>
            </div>
          </div>
        
        </div>



          ))}
        </div>
      </div>

      {/* =========================
          ⚠️ MODAL CONFIRMATION
      ========================= */}
      {trackToDelete && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>

            <p>❌ Supprimer cette musique ?</p>

            <div style={styles.modalActions}>
              <button
                style={styles.cancelBtn}
                onClick={() => setTrackToDelete(null)}
              >
                Annuler
              </button>

              <button
                style={styles.deleteBtn}
                onClick={confirmDelete}
              >
                Supprimer
              </button>
            </div>

          </div>
        </div>
      )}
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
  votes: { fontWeight: "bold" },

  delete: {
    border: "none",
    background: "transparent",
    color: "red",
    fontSize: 16,
  },

  /* =========================
     MODAL
  ========================= */
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  modal: {
    background: "white",
    padding: 20,
    borderRadius: 12,
    textAlign: "center",
  },

  modalActions: {
    display: "flex",
    gap: 10,
    marginTop: 10,
    justifyContent: "center",
  },

  cancelBtn: {
    padding: 10,
    border: "none",
    background: "#ddd",
    borderRadius: 8,
  },

  deleteBtn: {
    padding: 10,
    border: "none",
    background: "red",
    color: "white",
    borderRadius: 8,
  },

  voteBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    marginRight: 6,
  },


    voteButton: {
    padding: "6px 10px",
    border: "none",
    background: "#2563eb",
    color: "white",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 12,
  },
  
  voteIcon: {
    fontSize: 14,
  },
  
  voteCount: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#111",
  },

};
