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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const [tracks, setTracks] = useState([]);

  // =========================
  // 🎧 SPOTIFY CONFIG
  // =========================
  const CLIENT_ID = "TON_CLIENT_ID";
  const CLIENT_SECRET = "TON_CLIENT_SECRET"; // ⚠️ nécessaire

  const getSpotifyToken = async () => {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(CLIENT_ID + ":" + CLIENT_SECRET),
      },
      body: "grant_type=client_credentials",
    });

    const data = await res.json();
    return data.access_token;
  };

  const searchSpotify = async (query) => {
    if (!query.trim()) return;

    try {
      const token = await getSpotifyToken();

      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(
          query
        )}&type=track&limit=5`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();
      setSearchResults(data.tracks.items || []);
    } catch (err) {
      console.log("Spotify error:", err);
    }
  };

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
  // ➕ ADD TRACK
  // =========================
  const addTrack = async () => {
    if (!title.trim()) return;

    await addDoc(colRef, {
      title,
      artist: artist || "Unknown",
      spotifyId: null,
      createdAt: Date.now(),
      votes: 0,
      votedBy: [],
    });

    setTitle("");
    setArtist("");
  };

  // =========================
  // 🎯 SELECT SPOTIFY TRACK
  // =========================
  const selectTrack = (track) => {
    setTitle(track.name);
    setArtist(track.artists?.[0]?.name || "");
    setSearchResults([]);
    setSearchQuery("");
  };

  // =========================
  // 👍 VOTE
  // =========================
  const handleVote = async (track) => {
    if (!username) return;

    const trackRef = doc(db, "tracks", track.id);

    const alreadyVoted = track.votedBy?.some((v) => v.id === userId);

    if (alreadyVoted) {
      await updateDoc(trackRef, {
        votes: Math.max((track.votes || 1) - 1, 0),
        votedBy: (track.votedBy || []).filter((v) => v.id !== userId),
      });
      return;
    }

    await updateDoc(trackRef, {
      votes: (track.votes || 0) + 1,
      votedBy: [...(track.votedBy || []), { id: userId, name: username }],
    });
  };

  // =========================
  // 🎨 UI
  // =========================
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>🎵 PLAYLIST</h1>

        {/* 🔎 SPOTIFY SEARCH */}
        <div style={styles.inputCol}>
          <input
            style={styles.input}
            placeholder="Rechercher sur Spotify..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              searchSpotify(e.target.value);
            }}
          />

          {searchResults.length > 0 && (
            <div style={styles.results}>
              {searchResults.map((t) => (
                <div
                  key={t.id}
                  style={styles.resultItem}
                  onClick={() => selectTrack(t)}
                >
                  <div style={{ fontWeight: "bold" }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {t.artists?.[0]?.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ➕ ADD TRACK */}
        <div style={styles.inputCol}>
          <input
            style={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre"
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
            const hasVoted = item.votedBy?.some((v) => v.id === userId);

            return (
              <div key={item.id} style={styles.itemRow}>
                <div style={styles.item}>
                  <div style={styles.titleText}>{item.title}</div>
                  <div style={styles.artistText}>{item.artist}</div>

                  {item.spotifyId && (
                    <a
                      href={`https://open.spotify.com/track/${item.spotifyId}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, color: "#1DB954" }}
                    >
                      ▶ Spotify
                    </a>
                  )}
                </div>

                {username && (
                  <button
                    style={{
                      ...styles.voteButton,
                      background: hasVoted ? "#ef4444" : "#2563eb",
                    }}
                    onClick={() => handleVote(item)}
                  >
                    {hasVoted ? "Annuler" : "Voter"}
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

// =========================
// 🎨 STYLES
// =========================
const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    background: "#f1f5f9",
    padding: 12,
    fontFamily: "Arial",
  },

  card: {
    width: "100%",
    maxWidth: 420,
  },

  title: {
    textAlign: "center",
    marginBottom: 20,
  },

  inputCol: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 16,
  },

  input: {
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ddd",
  },

  button: {
    padding: 10,
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "white",
    cursor: "pointer",
  },

  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    background: "white",
    padding: 10,
    borderRadius: 10,
  },

  item: {
    flex: 1,
  },

  titleText: {
    fontWeight: "bold",
  },

  artistText: {
    fontSize: 12,
    color: "#666",
  },

  voteButton: {
    padding: "6px 10px",
    borderRadius: 6,
    border: "none",
    color: "white",
    cursor: "pointer",
  },

  results: {
    background: "white",
    borderRadius: 8,
    border: "1px solid #ddd",
    maxHeight: 200,
    overflowY: "auto",
  },

  resultItem: {
    padding: 10,
    cursor: "pointer",
    borderBottom: "1px solid #eee",
  },
};
