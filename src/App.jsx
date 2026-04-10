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
  // 🎯 INPUT STATES
  // =========================
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [tracks, setTracks] = useState([]);

  // =========================
  // 🎬 ANIMATION STATES
  // =========================
  const [deletingId, setDeletingId] = useState(null);
  const [animVotes, setAnimVotes] = useState({});

  // =========================
  // 👤 AUTH
  // =========================
  const [usernameInput, setUsernameInput] = useState("");
  const [username, setUsername] = useState(() => {
    return localStorage.getItem("username") || "";
  });

  const [userId] = useState(() => {
    let id = localStorage.getItem("userId");

    if (!id) {
      id = Math.random().toString(36).substring(2, 15);
      localStorage.setItem("userId", id);
    }

    return id;
  });

  // =========================
  // 👆 SWIPE
  // =========================
  const [swipeX, setSwipeX] = useState({});

  // =========================
  // ⚠️ DELETE MODAL
  // =========================
  const [trackToDelete, setTrackToDelete] = useState(null);

  // =========================
  // 👀 VOTE MODAL
  // =========================
  const [selectedTrack, setSelectedTrack] = useState(null);

  // =========================
  // 🔥 FIREBASE
  // =========================
  const colRef = collection(db, "tracks");
  const q = query(colRef, orderBy("createdAt", "desc"));

  // =========================
  // 📡 REALTIME
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
  // 👤 LOGIN
  // =========================
  const handleLogin = () => {
    if (!usernameInput.trim()) return;

    setUsername(usernameInput);
    localStorage.setItem("username", usernameInput);
    setUsernameInput("");
  };

  // =========================
  // ➕ ADD TRACK
  // =========================
  const addTrack = async () => {
    if (!title.trim()) return;

    await addDoc(colRef, {
      title,
      artist: artist || "Unknown",
      spotifyId: "xxxxx", // 🔥 important
      createdAt: Date.now(),
      votes: 0,
      votedBy: [],
    });

    setTitle("");
    setArtist("");
  };

  // =========================
  // ❌ DELETE
  // =========================
  const removeTrack = async (id) => {
    await deleteDoc(doc(db, "tracks", id));
  };

  // =========================
  // 👍 VOTE
  // =========================
  const handleVote = async (track) => {
    if (!username) return;

    // 🎬 animation vote
    setAnimVotes((prev) => ({ ...prev, [track.id]: true }));
    setTimeout(() => {
      setAnimVotes((prev) => ({ ...prev, [track.id]: false }));
    }, 200);

    const trackRef = doc(db, "tracks", track.id);

    const alreadyVoted = track.votedBy?.some(
      (v) => v.id === userId
    );

    if (alreadyVoted) {
      await updateDoc(trackRef, {
        votes: Math.max((track.votes || 1) - 1, 0),
        votedBy: (track.votedBy || []).filter(
          (v) => v.id !== userId
        ),
      });
      return;
    }

    await updateDoc(trackRef, {
      votes: (track.votes || 0) + 1,
      votedBy: [
        ...(track.votedBy || []),
        { id: userId, name: username }
      ],
    });
  };

  // =========================
  // 👆 SWIPE
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
      setTrackToDelete(id);
    }

    setSwipeX((prev) => ({
      ...prev,
      [id]: { startX: 0, moveX: 0 },
    }));
  };

  // =========================
  // 🧠 CONFIRM DELETE
  // =========================
  const confirmDelete = async () => {
    if (!trackToDelete) return;

    setDeletingId(trackToDelete);

    setTimeout(async () => {
      await removeTrack(trackToDelete);
      setDeletingId(null);
    }, 300);

    setTrackToDelete(null);
  };

  // =========================
  // 🎨 UI
  // =========================
  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* LOGIN */}
        <div style={styles.topBar}>
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
              👤 {username}
            </div>
          )}
        </div>

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

            const hasVoted = item.votedBy?.some(
              (v) => v.id === userId
            );

            return (
              <div
                key={item.id}
                style={{
                  ...styles.itemRow,
                  transform: deletingId === item.id
                    ? "translateX(-100%) scale(0.9)"
                    : `translateX(${swipeX[item.id]?.moveX || 0}px)`,
                  opacity: deletingId === item.id ? 0 : 1,
                  transition: "all 0.3s ease",
                }}
                onTouchStart={(e) => handleTouchStart(e, item.id)}
                onTouchMove={(e) => handleTouchMove(e, item.id)}
                onTouchEnd={() => handleTouchEnd(item.id)}
              >

                <div
                  style={{
                    ...styles.voteBox,
                    transform: animVotes[item.id] ? "scale(1.3)" : "scale(1)",
                    transition: "transform 0.2s",
                  }}
                  onClick={() => setSelectedTrack(item)}
                >
                  👍 {item.votes || 0}
                </div>

                <div style={styles.item}>
                  <div>
                    <div style={styles.titleText}>{item.title}</div>
                    <div style={styles.artistText}>{item.artist}</div>
                  </div>
                </div>

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

      {/* DELETE MODAL */}
      {trackToDelete && (
        <div style={styles.modalOverlayAnimated}>
          <div style={styles.modalAnimated}>
            <p>Supprimer cette musique ?</p>

            <div style={{ display: "flex", gap: 10 }}>
              <button style={styles.cancelBtn} onClick={() => setTrackToDelete(null)}>
                Annuler
              </button>
              <button style={styles.deleteBtn} onClick={confirmDelete}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOTE MODAL */}
      {selectedTrack && (
        <div style={styles.modalOverlayAnimated}>
          <div style={styles.modalAnimated}>

            <button style={styles.closeBtn} onClick={() => setSelectedTrack(null)}>
              ✕
            </button>

            <h3>Votes</h3>

            {selectedTrack.votedBy?.length > 0 ? (
              selectedTrack.votedBy.map((v, i) => (
                <div key={i}>👤 {v.name}</div>
              ))
            ) : (
              <div>Aucun vote</div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#f1f5f9", padding: 12 },
  card: { width: "100%", maxWidth: 420, background: "white", borderRadius: 16, padding: 16 },
  topBar: { marginBottom: 10 },
  loginBox: { display: "flex", gap: 10 },
  title: { marginBottom: 20 },
  inputCol: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 },
  input: { padding: 12, border: "1px solid #ddd", borderRadius: 10 },
  button: { padding: "12px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: 10 },
  list: { display: "flex", flexDirection: "column", gap: 10 },

  itemRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    animation: "fadeSlideIn 0.3s ease",
  },

  item: { flex: 1, padding: 10, background: "#fafafa", borderRadius: 10 },
  titleText: { fontWeight: "bold", fontSize: 14 },
  artistText: { fontSize: 11, color: "#666" },

  voteBox: { width: 50, textAlign: "center", cursor: "pointer" },

  voteButton: { padding: "6px 10px", border: "none", color: "white", borderRadius: 8 },

  modalOverlayAnimated: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    animation: "fadeIn 0.2s ease",
  },

  modalAnimated: {
    background: "white",
    padding: 20,
    borderRadius: 12,
    width: 260,
    animation: "zoomIn 0.2s ease",
  },

  closeBtn: {
    fontSize: 28,
    color: "#ef4444",
    background: "transparent",
    border: "none",
    float: "right",
    cursor: "pointer",
  },

  cancelBtn: {
    flex: 1,
    padding: "12px",
    background: "#e5e7eb",
    border: "none",
    borderRadius: 10,
  },

  deleteBtn: {
    flex: 1,
    padding: "12px",
    background: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: 10,
  },
};
