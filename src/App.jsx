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
  // 🎧 SPOTIFY CONFIG
  // =========================
  const CLIENT_ID = "ffb0cceefeff4104b72ab24ff0ad3d40"; // 

  // =========================
  // 🔎 SEARCH SPOTIFY TRACK
  // =========================
  const searchSpotifyTrack = async (title, artist) => {
    try {
      // 🔑 récupération token Spotify
      const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": "Basic " + btoa(CLIENT_ID + ":"),
        },
        body: "grant_type=client_credentials",
      });

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // 🔎 recherche du titre + artiste
      const searchRes = await fetch(
        `https://api.spotify.com/v1/search?q=${title} ${artist}&type=track&limit=1`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = await searchRes.json();

      // 🎯 retourne l'id du premier résultat
      return data.tracks.items[0]?.id || null;

    } catch (err) {
      console.log("Erreur Spotify:", err);
      return null;
    }
  };

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
  // ➕ ADD TRACK + SPOTIFY
  // =========================
  const addTrack = async () => {
    if (!title.trim()) return;

    // 🔎 récupération spotifyId automatique
    const spotifyId = await searchSpotifyTrack(title, artist);

    await addDoc(colRef, {
      title,
      artist: artist || "Unknown",
      spotifyId: spotifyId || null, // 🔥 stocké en base
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
            <div>👤 {username}</div>
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
              <div key={item.id} style={styles.itemRow}>

                {/* 👍 */}
                <div
                  style={{
                    ...styles.voteBox,
                    transform: animVotes[item.id] ? "scale(1.3)" : "scale(1)",
                  }}
                  onClick={() => setSelectedTrack(item)}
                >
                  👍 {item.votes || 0}
                </div>

                {/* TRACK */}
                <div style={styles.item}>
                  <div style={styles.titleText}>{item.title}</div>
                  <div style={styles.artistText}>{item.artist}</div>

                  {/* 🎧 BOUTON SPOTIFY */}
                  {item.spotifyId && (
                    <a
                      href={`https://open.spotify.com/track/${item.spotifyId}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, color: "#1DB954" }}
                    >
                      ▶ Écouter sur Spotify
                    </a>
                  )}
                </div>

                {/* VOTE */}
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

const styles = {
  page: { padding: 20 },
  card: { maxWidth: 400, margin: "auto" },
};
