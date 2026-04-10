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
  // 👆 SWIPE (amélioré avec inertie)
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
          moveX: (moveX - item.startX) * 0.9, // 🔥 ralentissement = effet plus smooth
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

    await removeTrack(trackToDelete);
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
          <input style={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du son" />
          <input style={styles.input} value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artiste" />
          <button style={styles.button} onClick={addTrack}>Ajouter</button>
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
                  transform: `translateX(${swipeX[item.id]?.moveX || 0}px)`,
                  transition: "transform 0.3s ease-out", // 🔥 swipe smooth
                  animation: "fadeIn 0.4s ease", // 🔥 apparition des tracks
                }}
                onTouchStart={(e) => handleTouchStart(e, item.id)}
                onTouchMove={(e) => handleTouchMove(e, item.id)}
                onTouchEnd={() => handleTouchEnd(item.id)}
              >

                {/* 👍 VOTES */}
                <div
                  style={styles.voteBox}
                  onClick={() => setSelectedTrack(item)}
                >
                  <span style={{
                    display: "inline-block",
                    transition: "transform 0.2s",
                    transform: hasVoted ? "scale(1.3)" : "scale(1)" // 🔥 effet pop vote
                  }}>
                    👍
                  </span>
                  <span>{item.votes || 0}</span>
                </div>

                {/* TRACK */}
                <div style={styles.item}>
                  <div>
                    <div style={styles.titleText}>{item.title}</div>
                    <div style={styles.artistText}>{item.artist}</div>
                  </div>
                </div>

                {/* VOTE BUTTON */}
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
        <div style={{ ...styles.modalOverlay, animation: "fadeIn 0.2s" }}>
          <div style={{ ...styles.modal, animation: "zoomIn 0.2s" }}>
            <p>Supprimer cette musique ?</p>
            <button style={styles.cancelBtn} onClick={() => setTrackToDelete(null)}>Annuler</button>
            <button style={styles.deleteBtn} onClick={confirmDelete}>Supprimer</button>
          </div>
        </div>
      )}

      {/* VOTE MODAL */}
      {selectedTrack && (
        <div style={{ ...styles.modalOverlay, animation: "fadeIn 0.2s" }}>
          <div style={{ ...styles.modal, animation: "zoomIn 0.2s" }}>
            <button style={styles.closeBtn} onClick={() => setSelectedTrack(null)}>✕</button>
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

      {/* 🔥 ANIMATIONS CSS */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0 }
          to { opacity: 1 }
        }

        @keyframes zoomIn {
          from { transform: scale(0.9); opacity: 0 }
          to { transform: scale(1); opacity: 1 }
        }
      `}</style>

    </div>
  );
}
