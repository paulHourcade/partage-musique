import { useEffect, useState } from "react";
import { db } from "./firebase";

// 🔌 Import des fonctions Firebase (Firestore)
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
  // 🎯 STATES (données React)
  // =========================

  // 📝 Input titre
  const [title, setTitle] = useState("");

  // 🧑‍🎤 Input artiste
  const [artist, setArtist] = useState("");

  // 📦 Liste des musiques récupérées depuis Firebase
  const [tracks, setTracks] = useState([]);


  // =========================
  // 🔥 FIREBASE CONFIG
  // =========================

  // 📁 Référence à la collection "tracks" dans Firebase
  const colRef = collection(db, "tracks");

  // 📊 Requête : tri par date de création (du plus récent au plus ancien)
  const q = query(colRef, orderBy("createdAt", "desc"));


  // =========================
  // 📡 ÉCOUTE TEMPS RÉEL
  // =========================

  useEffect(() => {
    // 🔁 on écoute en temps réel les changements dans Firestore
    const unsub = onSnapshot(q, (snapshot) => {

      // 🔄 transformation des données Firebase → format utilisable
      setTracks(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
    });

    // 🧹 nettoyage du listener quand le composant se démonte
    return () => unsub();
  }, []);


  // =========================
  // ➕ FONCTION AJOUTER UN SON
  // =========================

  const addTrack = async () => {

    // 🚫 Empêche d’ajouter un champ vide
    if (!title.trim()) return;

    // 📥 Ajout dans Firebase
    await addDoc(colRef, {
      title,                       // 🎵 titre du morceau
      artist: artist || "Unknown", // 🧑‍🎤 artiste (fallback)
      createdAt: Date.now(),       // ⏱️ date de création
      votes: 0,                    // 👍 compteur de votes (prévu pour plus tard)
      votedBy: [],                 // 👤 liste des utilisateurs ayant voté
    });

    // 🔄 Reset des inputs après ajout
    setTitle("");
    setArtist("");
  };


  // =========================
  // ❌ FONCTION SUPPRIMER UN SON
  // =========================

  const removeTrack = async (id) => {
    await deleteDoc(doc(db, "tracks", id));
  };


  // =========================
  // 🎨 INTERFACE UTILISATEUR (UI)
  // =========================

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>🎵 Music Queue</h1>

        {/* =========================
            📝 INPUTS UTILISATEUR
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
            📋 LISTE DES MUSIQUES
        ========================= */}

        <div style={styles.list}>
          {tracks.length === 0 ? (
            <div style={styles.empty}>Aucun morceau</div>
          ) : (
            tracks.map((item, index) => (

            <div key={item.id} style={styles.itemRow}>
            
              {/* ❌ bouton suppression à gauche */}
              <button
                style={styles.delete}
                onClick={() => removeTrack(item.id)}
              >
                ✕
              </button>
            
              {/* 🎵 contenu principal */}
              <div style={styles.item}>
                <div style={styles.text}>
                  <div style={styles.titleText}>
                    {item.title}
                  </div>
                  <div style={styles.artistText}>
                    {item.artist || "Unknown"}
                  </div>
                </div>
            
                {/* 👍 votes à droite */}
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


// =========================
// 🎨 STYLES
// =========================

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f1f5f9",
    fontFamily: "Arial",
    padding: 12, // 🔥 réduit pour mobile
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
    flex: 1,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    border: "1px solid #eee",
    borderRadius: 10,
    background: "#fafafa",
  },

  itemRow: {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginBottom: 6,
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
