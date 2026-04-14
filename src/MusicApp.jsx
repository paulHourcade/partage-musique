import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "./firebase";
import { Link } from "react-router-dom";
import {
  fetchSpotifyProfile,
  getSpotifyAccessToken,
  handleSpotifyCallback,
  loginWithSpotify,
  logoutSpotify,
} from "./spotifyAuth";

import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
  limit,
  setDoc,
  updateDoc,
} from "firebase/firestore";

// =========================
// ⚙️ Constantes globales de l'application
// =========================
// ADMIN_PIN : code local permettant d'activer les contrôles admin.
// SHOW_SUGGESTIONS : active ou masque le module de suggestions avancées.
const ADMIN_PIN = "1234";
const SHOW_SUGGESTIONS = false;

export default function MusicApp() {
  // =========================
  // 🎵 États principaux de l'application
  // =========================
  // Toute la logique de la playlist, du lecteur Spotify et de l'interface
  // est centralisée dans ce composant principal.
  // =========================
  // 📦 Playlist et état partagé
  // =========================
  // On charge d'abord le cache local pour garder un affichage rapide,
  // puis Firestore reprend la main via les listeners temps réel.
  const [tracks, setTracks] = useState(() => {
    try {
      const cached = localStorage.getItem("sharedQueueCache");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [historyTracks, setHistoryTracks] = useState([]);
  const [sharedPlayerState, setSharedPlayerState] = useState(null);

  const [addError, setAddError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [playerError, setPlayerError] = useState("");

  const [spotifyPlayer, setSpotifyPlayer] = useState(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerDeviceId, setPlayerDeviceId] = useState(null);
  const [playerReconnectKey, setPlayerReconnectKey] = useState(0);
  const [playerConnecting, setPlayerConnecting] = useState(false);

  const [isPaused, setIsPaused] = useState(true);
  const [currentPlayback, setCurrentPlayback] = useState(null);
  const [currentPlaybackPosition, setCurrentPlaybackPosition] = useState(0);
  const [currentPlaybackDuration, setCurrentPlaybackDuration] = useState(0);

  const [playbackQueue, setPlaybackQueue] = useState([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);

  // =========================
  // 🔎 Recherche Spotify
  // =========================
  // Ces états pilotent la recherche de morceaux, l'affichage des résultats
  // et la sélection du titre qui sera ajouté à la file.
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSpotifyTrackData, setSelectedSpotifyTrackData] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsFilter, setSuggestionsFilter] = useState("");

  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [previewingUrl, setPreviewingUrl] = useState("");
  const [recentlyAddedIds, setRecentlyAddedIds] = useState([]);

  // =========================
  // 🔐 Authentification Spotify
  // =========================
  // Token OAuth + profil Spotify du compte connecté pour piloter la lecture.
  const [spotifyToken, setSpotifyToken] = useState(() => getSpotifyAccessToken());
  const [spotifyUser, setSpotifyUser] = useState(null);
  const [spotifyAuthLoading, setSpotifyAuthLoading] = useState(true);

  // =========================
  // 👑 Mode admin / menus / sécurité locale
  // =========================
  // Le statut admin est mémorisé localement tant que l'utilisateur ne le quitte pas.
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => {
    return localStorage.getItem("isSpotifyAdmin") === "true";
  });
  const [showPinModal, setShowPinModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSpotifyMenu, setShowSpotifyMenu] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  const [deletingId, setDeletingId] = useState(null);
  const [, setNow] = useState(Date.now());

  // =========================
  // 👤 Identité utilisateur locale
  // =========================
  // username : nom d'affichage visible dans l'app
  // userId : identifiant local unique servant aussi de clé Firestore pour l'utilisateur.
  const [usernameInput, setUsernameInput] = useState("");
  const [username] = useState(() => localStorage.getItem("username") || "");
  const [userId] = useState(() => {
    let id = localStorage.getItem("userId");
    if (!id) {
      id = Math.random().toString(36).substring(2, 15);
      localStorage.setItem("userId", id);
    }
    return id;
  });

  const [swipeX, setSwipeX] = useState({});
  const [touchStartX, setTouchStartX] = useState({});
  const [touchCurrentX, setTouchCurrentX] = useState({});
  const [trackToDelete, setTrackToDelete] = useState(null);


  // =========================
  // 🧠 Refs techniques
  // =========================
  // On stocke ici des références persistantes qui ne doivent pas provoquer
  // de rerender : timers, player, état courant, verrouillages, etc.
  const audioPreviewRef = useRef(null);
  const spotifyTimeoutRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const lastTrackIdRef = useRef(null);
  const autoplayLockRef = useRef(false);
  const manualPlayRef = useRef(false);
  const historyLoggedTrackRef = useRef(null);
  const launchInFlightRef = useRef(false);
  const playbackQueueRef = useRef([]);
  const currentQueueIndexRef = useRef(-1);
  const autoplayEnabledRef = useRef(true);
  const isAdminUnlockedRef = useRef(false);
  const playerDeviceIdRef = useRef(null);
  const playerReadyRef = useRef(false);
  const tracksRef = useRef([]);

  // =========================
  // 🗂️ Références Firestore mémorisées
  // =========================
  // useMemo évite de recréer les références à chaque rendu.
  const tracksCollectionRef = useMemo(() => collection(db, "tracks"), []);
  const currentUserDocRef = useMemo(() => doc(db, "users", userId), [userId]);
  const historyCollectionRef = useMemo(() => collection(db, "playHistory"), []);
  const playerStateDocRef = useMemo(() => doc(db, "appState", "playerState"), []);
  const historyQueryRef = useMemo(
    () => query(historyCollectionRef, orderBy("playedAt", "desc"), limit(30)),
    [historyCollectionRef]
  );

  // =========================
  // 🔄 Synchronisation temps réel de la playlist
  // =========================
  useEffect(() => {
    const unsub = onSnapshot(
      tracksCollectionRef,
      (snapshot) => {
        const freshTracks = snapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));
        setTracks(freshTracks);
      },
      (error) => {
        console.error("tracks onSnapshot error:", error);
        setPlayerError("Impossible de synchroniser la playlist en temps réel");
      }
    );

    return () => unsub();
  }, [tracksCollectionRef]);

  // =========================
  // 🕘 Chargement de l'historique des musiques jouées
  // =========================
  useEffect(() => {
    const unsub = onSnapshot(historyQueryRef, (snapshot) => {
      const freshHistory = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));
      setHistoryTracks(freshHistory);
    });

    return () => unsub();
  }, [historyQueryRef]);

  // =========================
  // 👤 Création / mise à jour du profil utilisateur Firestore
  // =========================
useEffect(() => {
  if (!username || !userId) return;

  const syncUser = async () => {
    try {
      await setDoc(
        currentUserDocRef,
        {
          userId,
          name: username,
          isAdmin: isAdminUnlocked,
          connectedAt: Date.now(),
          lastSeen: Date.now(),
          isConnected: true,
          forceLogoutAt: null,
        },
        { merge: true }
      );
    } catch (err) {
      console.error("user sync error:", err);
    }
  };

  syncUser();
}, [username, userId, isAdminUnlocked, currentUserDocRef]);

  // =========================
  // 💓 Heartbeat utilisateur
  // =========================
  // On met à jour lastSeen régulièrement pour savoir qui a été actif récemment.
  useEffect(() => {
  if (!username || !userId) return;

  const interval = setInterval(async () => {
    try {
      await updateDoc(currentUserDocRef, {
        lastSeen: Date.now(),
        isConnected: true,
        isAdmin: isAdminUnlocked,
      });
    } catch (err) {
      console.error("lastSeen update error:", err);
    }
  }, 60000);

  return () => clearInterval(interval);
}, [username, userId, isAdminUnlocked, currentUserDocRef]);


// =========================
  // 🚪 Marquage de déconnexion navigateur
  // =========================
  // Lors d'une fermeture d'onglet ou d'un démontage, on signale l'utilisateur
  // comme non connecté dans Firestore.
useEffect(() => {
  if (!username || !userId) return;

  const markDisconnected = async () => {
    try {
      await updateDoc(currentUserDocRef, {
        isConnected: false,
        lastSeen: Date.now(),
      });
    } catch (err) {
      console.error("disconnect mark error:", err);
    }
  };

  const handleBeforeUnload = () => {
    markDisconnected();
  };

  window.addEventListener("beforeunload", handleBeforeUnload);

  return () => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
    markDisconnected();
  };
}, [username, userId, currentUserDocRef]);

  // =========================
  // 👤 Déconnexion forcée depuis la page admin
  // =========================
  // Ce listener surveille le document Firestore de l'utilisateur courant.
  // Si un admin déclenche une déconnexion à distance, on nettoie la session locale
  // UNE seule fois, on neutralise le flag Firestore puis on redirige vers l'accueil.
  useEffect(() => {
    if (!userId) return;

    let handled = false;

    const unsub = onSnapshot(currentUserDocRef, async (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.data();

      if (data?.forceLogoutAt && !handled) {
        handled = true;

        try {
          await updateDoc(currentUserDocRef, {
            forceLogoutAt: null,
            isConnected: false,
            isAdmin: false,
          });
        } catch (err) {
          console.error("force logout cleanup error:", err);
        }

        localStorage.removeItem("username");
        localStorage.removeItem("isSpotifyAdmin");
        localStorage.removeItem("userId");
        localStorage.removeItem("sharedQueueCache");

        setIsAdminUnlocked(false);
        setSpotifyUser(null);
        setSpotifyToken(null);
        setShowPinModal(false);
        setShowUserMenu(false);
        setShowSpotifyMenu(false);
        setPinInput("");
        setPinError("");

        window.location.href = "/";
      }
    });

    return () => unsub();
  }, [currentUserDocRef, userId]);


  
  // =========================
  // 📡 État partagé du lecteur
  // =========================
  // Les autres utilisateurs peuvent lire l'état courant du player via Firestore.
  useEffect(() => {
    const unsub = onSnapshot(playerStateDocRef, (snapshot) => {
      if (snapshot.exists()) {
        setSharedPlayerState(snapshot.data());
      } else {
        setSharedPlayerState(null);
      }
    });

    return () => unsub();
  }, [playerStateDocRef]);

  // =========================
  // ↕️ Tri de la file d'attente
  // =========================
  // Tri prioritaire par position, puis par date d'ajout.
  const sortedTracks = useMemo(() => {
    return [...tracks].sort((a, b) => {
      const positionA =
        typeof a.position === "number" ? a.position : Number.MAX_SAFE_INTEGER;
      const positionB =
        typeof b.position === "number" ? b.position : Number.MAX_SAFE_INTEGER;

      if (positionA !== positionB) return positionA - positionB;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }, [tracks]);

  useEffect(() => {
    try {
      localStorage.setItem("sharedQueueCache", JSON.stringify(tracks));
    } catch {
      // ignore
    }
  }, [tracks]);

  useEffect(() => {
    playbackQueueRef.current = playbackQueue;
  }, [playbackQueue]);

  useEffect(() => {
    currentQueueIndexRef.current = currentQueueIndex;
  }, [currentQueueIndex]);

  useEffect(() => {
    autoplayEnabledRef.current = autoplayEnabled;
  }, [autoplayEnabled]);

  useEffect(() => {
    playerDeviceIdRef.current = playerDeviceId;
  }, [playerDeviceId]);

  useEffect(() => {
    playerReadyRef.current = playerReady;
  }, [playerReady]);

  useEffect(() => {
    isAdminUnlockedRef.current = isAdminUnlocked;
  }, [isAdminUnlocked]);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    if (playbackQueue.length === 0) return;

    const currentPlayingSpotifyId =
      playbackQueue[currentQueueIndex]?.spotifyId || currentPlayback?.id || null;
    if (!currentPlayingSpotifyId) return;

    const refreshedQueue = sortedTracks.filter((track) => track.spotifyId);
    const refreshedIndex = refreshedQueue.findIndex(
      (track) => track.spotifyId === currentPlayingSpotifyId
    );

    if (refreshedIndex === -1) return;

    const queueChanged =
      JSON.stringify(refreshedQueue.map((t) => t.id)) !==
      JSON.stringify(playbackQueue.map((t) => t.id));

    if (queueChanged) {
      setPlaybackQueue(refreshedQueue);
      setCurrentQueueIndex(refreshedIndex);
    }
  }, [sortedTracks, playbackQueue, currentQueueIndex, currentPlayback]);

  useEffect(() => {
    const initSpotifyAuth = async () => {
      try {
        let token = getSpotifyAccessToken();
        const params = new URLSearchParams(window.location.search);
        const hasCode = params.get("code");

        if (hasCode) {
          token = await handleSpotifyCallback();
          setSpotifyToken(token);
        }

        if (token) {
          const profile = await fetchSpotifyProfile(token);
          setSpotifyUser(profile);
        }
      } catch (err) {
        console.error("Spotify auth init error:", err);
        setSpotifyUser(null);
        setSpotifyToken(null);
      } finally {
        setSpotifyAuthLoading(false);
      }
    };

    initSpotifyAuth();
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(spotifyTimeoutRef.current);
      clearTimeout(toastTimeoutRef.current);
      clearTimeout(reconnectTimeoutRef.current);
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isPaused || !currentPlaybackDuration) return;

    const interval = setInterval(() => {
      setCurrentPlaybackPosition((prev) => {
        const next = prev + 1000;
        return next > currentPlaybackDuration ? currentPlaybackDuration : next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, currentPlaybackDuration]);

  const dominantArtistQuery = useMemo(() => {
    const artistCounts = {};
    const sourceTracks =
      historyTracks.slice(0, 3).length > 0
        ? historyTracks.slice(0, 3)
        : sortedTracks.slice(0, 3);

    sourceTracks.forEach((track) => {
      (track.artist || "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
        .forEach((name) => {
          artistCounts[name] = (artistCounts[name] || 0) + 1;
        });
    });

    return Object.entries(artistCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name)
      .join(" ");
  }, [historyTracks, sortedTracks]);

  const filteredSuggestions = useMemo(() => {
    const filter = suggestionsFilter.trim().toLowerCase();
    if (!filter) return suggestions;

    return suggestions.filter((item) => {
      const haystack = [
        item?.name || "",
        item?.album?.name || "",
        ...(item?.artists?.map((a) => a.name) || []),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(filter);
    });
  }, [suggestions, suggestionsFilter]);

  // =========================
  // 🛠️ Fonctions utilitaires d'affichage
  // =========================
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return "il y a un moment";

    const diffMs = Date.now() - timestamp;
    const diffSeconds = Math.max(Math.floor(diffMs / 1000), 0);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 10) return "à l’instant";
    if (diffSeconds < 60) return `il y a ${diffSeconds} seconde${diffSeconds > 1 ? "s" : ""}`;
    if (diffMinutes < 60) return `il y a ${diffMinutes} minute${diffMinutes > 1 ? "s" : ""}`;
    if (diffHours < 24) return `il y a ${diffHours} heure${diffHours > 1 ? "s" : ""}`;
    return `il y a ${diffDays} jour${diffDays > 1 ? "s" : ""}`;
  };

  const formatMs = (ms) => {
    const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const getTrackImage = (track) => {
    return track?.album?.images?.[0]?.url || track?.albumImage || track?.image || null;
  };

  const showToast = (message) => {
    clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(""), 2500);
  };

  // =========================
  // 🔐 Actions utilisateur / admin
  // =========================
  const handleLogin = () => {
    if (!usernameInput.trim()) return;
    const cleanName = usernameInput.trim();
    localStorage.setItem("username", cleanName);
    window.location.reload();
  };

  const unlockAdminMode = () => {
    if (pinInput.trim() !== ADMIN_PIN) {
      setPinError("Code PIN incorrect");
      return;
    }

    localStorage.setItem("isSpotifyAdmin", "true");
    setIsAdminUnlocked(true);
    setShowPinModal(false);
    setPinInput("");
    setPinError("");
    showToast("Mode admin activé");
  };

  const lockAdminMode = () => {
    localStorage.removeItem("isSpotifyAdmin");
    setIsAdminUnlocked(false);
    setShowPinModal(false);
    setPinInput("");
    setPinError("");
  };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // =========================
  // 📦 Helpers de construction d'objet pour l'état partagé
  // =========================
  const buildTrackPayload = (track) => {
    if (!track) return null;

    return {
      id: track.id || null,
      name: track.name || track.title || "",
      artists: Array.isArray(track.artists)
        ? track.artists
        : [{ name: track.artist || "Artiste inconnu" }],
      album: track.album || {
        images: track.albumImage ? [{ url: track.albumImage }] : [],
      },
    };
  };

  const buildSharedQueueSnapshot = (queue, queueIndex) => {
    const safeQueue = Array.isArray(queue) ? queue : [];
    const safeIndex = typeof queueIndex === "number" ? queueIndex : -1;

    const visibleQueue = safeQueue
      .slice(Math.max(safeIndex + 1, 0))
      .map((track, index) => ({
        order: index + 1,
        id: track.id,
        spotifyId: track.spotifyId || null,
        title: track.title || "Titre inconnu",
        artist: track.artist || "Artiste inconnu",
        albumImage: track.albumImage || null,
        addedBy: track.addedBy || "Inconnu",
        createdAt: track.createdAt || null,
        isCurrent: false,
      }));

    const currentTrack = safeIndex >= 0 ? safeQueue[safeIndex] : null;

    return {
      queueIndex: safeIndex,
      queueLength: safeQueue.length,
      queueTitle: currentTrack?.title || "",
      queue: visibleQueue,
    };
  };

  // =========================
  // ☁️ Synchronisation du player vers Firestore
  // =========================
  const syncSharedPlayerState = async (payload) => {
    try {
      await setDoc(
        playerStateDocRef,
        {
          ...payload,
          currentTrackSpotifyId:
            payload?.track?.id || payload?.currentTrackSpotifyId || null,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("shared player sync error:", err);
    }
  };

  const refreshSharedQueueFromTracks = async (
    trackList,
    sharedState = sharedPlayerState
  ) => {
    if (!isAdminUnlockedRef.current) return;

    const queueTracks = (Array.isArray(trackList) ? trackList : []).filter(
      (track) => track.spotifyId
    );

    const sharedTrackId =
      currentPlayback?.id ||
      sharedState?.currentTrackSpotifyId ||
      sharedState?.track?.id ||
      null;

    let queueIndex = -1;
    if (sharedTrackId) {
      queueIndex = queueTracks.findIndex(
        (track) => track.spotifyId === sharedTrackId
      );
    }

    const safeQueueIndex = queueTracks.length === 0 ? -1 : queueIndex;
    const liveTrack = safeQueueIndex >= 0 ? queueTracks[safeQueueIndex] : null;

    setPlaybackQueue(queueTracks);
    setCurrentQueueIndex(safeQueueIndex);

    await syncSharedPlayerState({
      isPaused: sharedState?.isPaused ?? isPaused,
      position: sharedState?.position ?? currentPlaybackPosition,
      duration: sharedState?.duration ?? currentPlaybackDuration,
      track: sharedState?.track || buildTrackPayload(liveTrack),
      currentTrackSpotifyId: sharedTrackId,
      ...buildSharedQueueSnapshot(queueTracks, safeQueueIndex),
    });
  };

  // =========================
  // 🕘 Historique et nettoyage des morceaux lus
  // =========================
  const addTrackToHistory = async (trackInfo) => {
    if (!trackInfo?.id) return;
    if (historyLoggedTrackRef.current === trackInfo.id) return;

    historyLoggedTrackRef.current = trackInfo.id;

    try {
      await addDoc(historyCollectionRef, {
        spotifyId: trackInfo.id,
        title: trackInfo.name || "Titre inconnu",
        artist:
          trackInfo.artists?.map((a) => a.name).join(", ") || "Artiste inconnu",
        albumImage: trackInfo.album?.images?.[0]?.url || null,
        playedAt: Date.now(),
      });
    } catch (err) {
      console.error("history add error:", err);
    }
  };

  const archiveAndRemoveTrack = async (track) => {
    if (!track) return false;

    if (track.spotifyId) {
      await addTrackToHistory({
        id: track.spotifyId,
        name: track.title,
        artists: [{ name: track.artist || "Artiste inconnu" }],
        album: { images: track.albumImage ? [{ url: track.albumImage }] : [] },
      });
    }

    if (!track.id) return false;

    try {
      await deleteDoc(doc(db, "tracks", track.id));

      const filteredTracks = tracksRef.current.filter((item) => item.id !== track.id);
      tracksRef.current = filteredTracks;
      setTracks(filteredTracks);
      setPlaybackQueue((prev) => prev.filter((item) => item.id !== track.id));

      try {
        localStorage.setItem("sharedQueueCache", JSON.stringify(filteredTracks));
      } catch {
        // ignore
      }

      if (isAdminUnlockedRef.current) {
        await refreshSharedQueueFromTracks(filteredTracks);
      }

      return true;
    } catch (err) {
      console.error("archiveAndRemoveTrack error:", err);
      setPlayerError("Impossible de retirer la musique jouée de la file d’attente");
      return false;
    }
  };

  const schedulePlayerReconnect = (reason = "") => {
    if (!isAdminUnlockedRef.current || !spotifyToken || !spotifyUser) return;

    clearTimeout(reconnectTimeoutRef.current);
    const nextAttempt = Math.min(reconnectAttemptsRef.current + 1, 5);
    reconnectAttemptsRef.current = nextAttempt;
    const delay = Math.min(1000 * nextAttempt, 5000);

    reconnectTimeoutRef.current = setTimeout(() => {
      setPlayerError(
        reason ? `Reconnexion Spotify... (${reason})` : "Reconnexion Spotify..."
      );
      setPlayerReady(false);
      setPlayerDeviceId(null);
      setSpotifyPlayer(null);
      setPlayerReconnectKey((prev) => prev + 1);
    }, delay);
  };

  // =========================
  // 🎧 Initialisation du Spotify Web Playback SDK
  // =========================
  useEffect(() => {
    if (!spotifyToken || !spotifyUser) return;

    let mounted = true;
    let createdPlayer = null;

    const loadSpotifySDK = () =>
      new Promise((resolve, reject) => {
        if (window.Spotify) {
          resolve();
          return;
        }

        const existingScript = document.getElementById("spotify-player-sdk");
        if (existingScript) {
          window.onSpotifyWebPlaybackSDKReady = () => resolve();
          return;
        }

        const script = document.createElement("script");
        script.id = "spotify-player-sdk";
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        script.onerror = () =>
          reject(new Error("Impossible de charger le SDK Spotify"));
        window.onSpotifyWebPlaybackSDKReady = () => resolve();
        document.body.appendChild(script);
      });

    const initPlayer = async () => {
      try {
        setPlayerError("");
        await loadSpotifySDK();
        if (!mounted || !window.Spotify) return;

        createdPlayer = new window.Spotify.Player({
          name: "Partage Musique Player",
          getOAuthToken: (cb) => cb(getSpotifyAccessToken()),
          volume: 0.6,
        });

        createdPlayer.addListener("ready", ({ device_id }) => {
          if (!mounted) return;
          reconnectAttemptsRef.current = 0;
          clearTimeout(reconnectTimeoutRef.current);
          setPlayerError("");
          setPlayerDeviceId(device_id);
          setPlayerReady(true);
        });

        createdPlayer.addListener("not_ready", ({ device_id }) => {
          if (!mounted) return;
          setPlayerReady(false);
          setPlayerDeviceId(null);
          schedulePlayerReconnect(
            device_id ? `device ${device_id} indisponible` : "player indisponible"
          );
        });

        createdPlayer.addListener("player_state_changed", async (state) => {
          if (!mounted || !state) return;

          setIsPaused(state.paused);

          const currentTrack = state.track_window?.current_track || null;
          const previousTrackId = lastTrackIdRef.current;
          const currentTrackId = currentTrack?.id || null;

          if (
            previousTrackId &&
            currentTrackId &&
            previousTrackId !== currentTrackId &&
            state.position < 5000
          ) {
            const finishedQueueTrack = playbackQueueRef.current.find(
              (track) => track.spotifyId === previousTrackId
            );

            if (finishedQueueTrack?.id) {
              await archiveAndRemoveTrack(finishedQueueTrack);
            } else {
              const previousTrack =
                state.track_window?.previous_tracks?.slice(-1)?.[0] || null;
              if (previousTrack?.id === previousTrackId) {
                await addTrackToHistory(previousTrack);
              }
            }
          }

          setCurrentPlayback(currentTrack);
          setCurrentPlaybackPosition(state.position || 0);
          setCurrentPlaybackDuration(currentTrack?.duration_ms || 0);

          if (currentTrackId) {
            lastTrackIdRef.current = currentTrackId;
          }

          await syncSharedPlayerState({
            isPaused: state.paused,
            position: state.position || 0,
            duration: currentTrack?.duration_ms || 0,
            track: currentTrack
              ? {
                  id: currentTrack.id || null,
                  name: currentTrack.name || "",
                  artists: currentTrack.artists || [],
                  album: currentTrack.album || null,
                }
              : null,
            ...buildSharedQueueSnapshot(
              playbackQueueRef.current,
              currentQueueIndexRef.current
            ),
          });

          if (manualPlayRef.current) {
            manualPlayRef.current = false;
            return;
          }

          const looksEnded =
            state.paused &&
            state.position === 0 &&
            previousTrackId &&
            currentTrackId === previousTrackId;

          if (
            autoplayEnabledRef.current &&
            looksEnded &&
            !autoplayLockRef.current &&
            playbackQueueRef.current.length > 0
          ) {
            autoplayLockRef.current = true;

            try {
              const finishedTrack =
                playbackQueueRef.current[currentQueueIndexRef.current];

              if (finishedTrack?.id) {
                await archiveAndRemoveTrack(finishedTrack);
              }

              const remainingQueue = playbackQueueRef.current.filter(
                (track) => track.id !== finishedTrack?.id
              );

              const nextTrack = remainingQueue[0];

              if (nextTrack?.spotifyId) {
                setPlaybackQueue(remainingQueue);
                setCurrentQueueIndex(0);
                setCurrentPlayback(null);
                setCurrentPlaybackPosition(0);
                setCurrentPlaybackDuration(0);
                lastTrackIdRef.current = nextTrack.spotifyId || null;

                await syncSharedPlayerState({
                  isPaused: false,
                  position: 0,
                  duration: 0,
                  track: buildTrackPayload(nextTrack),
                  currentTrackSpotifyId: nextTrack.spotifyId || null,
                  ...buildSharedQueueSnapshot(remainingQueue, 0),
                });

                await playSpotifyTrack(nextTrack.spotifyId, true);
              } else {
                setPlaybackQueue([]);
                setCurrentQueueIndex(-1);
                await syncSharedPlayerState({
                  isPaused: true,
                  position: 0,
                  duration: 0,
                  track: null,
                  currentTrackSpotifyId: null,
                  queueIndex: -1,
                  queueLength: 0,
                  queueTitle: "",
                  queue: [],
                });
              }
            } catch (err) {
              console.error("Autoplay error:", err);
            } finally {
              setTimeout(() => {
                autoplayLockRef.current = false;
              }, 1200);
            }
          }
        });

        createdPlayer.addListener("initialization_error", ({ message }) => {
          if (!mounted) return;
          const safeMessage = message || "Erreur d'initialisation Spotify";
          setPlayerError(safeMessage);
          if (
            String(safeMessage).toLowerCase().includes("4040") ||
            String(safeMessage).toLowerCase().includes("not found")
          ) {
            schedulePlayerReconnect(safeMessage);
          }
        });

        createdPlayer.addListener("authentication_error", ({ message }) => {
          if (!mounted) return;
          const safeMessage = message || "Erreur d'authentification Spotify";
          setPlayerError(safeMessage);
          if (
            String(safeMessage).toLowerCase().includes("4040") ||
            String(safeMessage).toLowerCase().includes("not found")
          ) {
            schedulePlayerReconnect(safeMessage);
          }
        });

        createdPlayer.addListener("account_error", ({ message }) => {
          if (!mounted) return;
          const safeMessage = message || "Compte Spotify incompatible";
          setPlayerError(safeMessage);
          if (
            String(safeMessage).toLowerCase().includes("4040") ||
            String(safeMessage).toLowerCase().includes("not found")
          ) {
            schedulePlayerReconnect(safeMessage);
          }
        });

        createdPlayer.addListener("playback_error", ({ message }) => {
          if (!mounted) return;
          const safeMessage = message || "Erreur de lecture Spotify";
          setPlayerError(safeMessage);
          if (
            String(safeMessage).toLowerCase().includes("4040") ||
            String(safeMessage).toLowerCase().includes("not found")
          ) {
            schedulePlayerReconnect(safeMessage);
          }
        });

        const connected = await createdPlayer.connect();

        if (!connected && mounted) {
          setPlayerError("Le player Spotify n'a pas pu se connecter");
          schedulePlayerReconnect("connexion impossible");
        }

        if (mounted) {
          setSpotifyPlayer(createdPlayer);
        }
      } catch (err) {
        if (!mounted) return;
        setPlayerError(err.message || "Impossible de lancer le player Spotify");
      }
    };

    initPlayer();

    return () => {
      mounted = false;
      if (createdPlayer) createdPlayer.disconnect();
    };
  }, [spotifyToken, spotifyUser, playerReconnectKey]);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
      if (!isAdminUnlockedRef.current || !spotifyPlayer) return;

      try {
        const state = await spotifyPlayer.getCurrentState();
        if (!state && spotifyToken && spotifyUser) {
          schedulePlayerReconnect("session Spotify perdue");
        }
      } catch {
        schedulePlayerReconnect("vérification échouée");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [spotifyPlayer, spotifyToken, spotifyUser]);

  // =========================
  // ✨ Suggestions automatiques
  // =========================
  const refreshSuggestions = async () => {
    if (!dominantArtistQuery) {
      setSuggestions([]);
      return;
    }

    try {
      setSuggestionsLoading(true);

      const res = await fetch(
        `/api/spotify-search?q=${encodeURIComponent(dominantArtistQuery)}`
      );
      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = JSON.parse(text);
      const existingIds = new Set(
        sortedTracks.map((track) => track.spotifyId).filter(Boolean)
      );

      const filtered = (Array.isArray(data) ? data : [])
        .filter((item) => item?.id && !existingIds.has(item.id))
        .slice(0, 6);

      setSuggestions(filtered);
    } catch (err) {
      console.error("suggestions error:", err);
      setSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  useEffect(() => {
    refreshSuggestions();
  }, [dominantArtistQuery, sortedTracks]);

  useEffect(() => {
    if (!isAdminUnlocked) return;

    refreshSharedQueueFromTracks(sortedTracks);
  }, [sortedTracks, isAdminUnlocked, currentPlayback?.id, sharedPlayerState?.track?.id]);

  useEffect(() => {
    if (!isAdminUnlocked || !currentPlayback) return;

    const interval = setInterval(() => {
      syncSharedPlayerState({
        isPaused,
        position: currentPlaybackPosition,
        duration: currentPlaybackDuration,
        track: currentPlayback
          ? {
              id: currentPlayback.id || null,
              name: currentPlayback.name || "",
              artists: currentPlayback.artists || [],
              album: currentPlayback.album || null,
            }
          : null,
        ...buildSharedQueueSnapshot(
          playbackQueueRef.current,
          currentQueueIndexRef.current
        ),
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [
    isAdminUnlocked,
    currentPlayback,
    currentPlaybackPosition,
    currentPlaybackDuration,
    isPaused,
  ]);

  useEffect(() => {
    if (!isAdminUnlocked) return;

    syncSharedPlayerState({
      isPaused,
      position: currentPlaybackPosition,
      duration: currentPlaybackDuration,
      track: currentPlayback
        ? {
            id: currentPlayback.id || null,
            name: currentPlayback.name || "",
            artists: currentPlayback.artists || [],
            album: currentPlayback.album || null,
          }
        : sharedPlayerState?.track || null,
      ...buildSharedQueueSnapshot(playbackQueue, currentQueueIndex),
    });
  }, [
    isAdminUnlocked,
    playbackQueue,
    currentQueueIndex,
    currentPlayback,
    currentPlaybackPosition,
    currentPlaybackDuration,
    isPaused,
  ]);

  // =========================
  // 🔎 Recherche Spotify via ton endpoint serveur
  // =========================
  const searchSpotify = async (queryText) => {
    if (!queryText || !queryText.trim()) {
      setSearchResults([]);
      setSearchError("");
      return;
    }

    try {
      setIsSearching(true);
      setSearchError("");

      const res = await fetch(
        `/api/spotify-search?q=${encodeURIComponent(queryText)}`
      );
      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = JSON.parse(text);
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Spotify error:", err);
      setSearchResults([]);
      setSearchError("Impossible de charger les résultats Spotify");
    } finally {
      setIsSearching(false);
    }
  };

  const getPlayableDeviceId = async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const freshDeviceId = playerDeviceIdRef.current || playerDeviceId;
      const freshReady = playerReadyRef.current || playerReady;

      if (freshDeviceId && freshReady) {
        return freshDeviceId;
      }

      if (spotifyPlayer) {
        try {
          await spotifyPlayer.activateElement();
          await spotifyPlayer.connect().catch(() => {});
        } catch (err) {
          console.error("wake player error:", err);
        }
      }

      await wait(700);
    }

    return playerDeviceIdRef.current || playerDeviceId || null;
  };

  // =========================
  // ▶️ Contrôle de lecture Spotify
  // =========================
  // Cette fonction transfère la lecture vers le bon device puis lance le morceau.
  const playSpotifyTrack = async (spotifyId, isAuto = false) => {
    if (launchInFlightRef.current) {
      return false;
    }

    if (!spotifyToken) {
      setPlayerError("Connecte d’abord ton compte Spotify");
      return false;
    }

    if (!spotifyId) {
      setPlayerError("Ce morceau n’a pas d’identifiant Spotify");
      return false;
    }

    launchInFlightRef.current = true;

    try {
      setPlayerError("");

      if (spotifyPlayer) {
        await spotifyPlayer.activateElement();
      }

      const playableDeviceId = await getPlayableDeviceId();

      if (!playableDeviceId) {
        schedulePlayerReconnect("lecteur Spotify indisponible");
        setPlayerError("Le lecteur Spotify n’est pas encore prêt");
        return false;
      }

      const transferRes = await fetch("https://api.spotify.com/v1/me/player", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${spotifyToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device_ids: [playableDeviceId],
          play: false,
        }),
      });

      if (!transferRes.ok) {
        const transferText = await transferRes.text();
        throw new Error(transferText || "Impossible de transférer la lecture");
      }

      const launchBody = JSON.stringify({
        uris: [`spotify:track:${spotifyId}`],
        position_ms: 0,
      });

      let launched = false;

      for (let attempt = 0; attempt < 4 && !launched; attempt += 1) {
        await wait(attempt === 0 ? 900 : 700);

        const playRes = await fetch(
          `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(
            playableDeviceId
          )}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${spotifyToken}`,
              "Content-Type": "application/json",
            },
            body: launchBody,
          }
        );

        if (!playRes.ok) {
          const playText = await playRes.text();
          if (attempt === 3) {
            throw new Error(playText || `Erreur Spotify ${playRes.status}`);
          }
          continue;
        }

        await wait(800);

        const confirmState = spotifyPlayer
          ? await spotifyPlayer.getCurrentState().catch(() => null)
          : null;

        const confirmId = confirmState?.track_window?.current_track?.id || null;

        if (confirmState && !confirmState.paused && confirmId === spotifyId) {
          launched = true;
          break;
        }

        if (attempt === 3) {
          const fallbackState = await fetch(
            "https://api.spotify.com/v1/me/player/currently-playing",
            {
              headers: {
                Authorization: `Bearer ${spotifyToken}`,
              },
            }
          )
            .then((res) => (res.ok ? res.json() : null))
            .catch(() => null);

          if (fallbackState?.item?.id === spotifyId && fallbackState?.is_playing) {
            launched = true;
            break;
          }
        }
      }

      if (!launched) {
        throw new Error("La lecture Spotify n’a pas démarré automatiquement");
      }

      if (!isAuto) {
        manualPlayRef.current = true;
      }

      lastTrackIdRef.current = spotifyId;
      return true;
    } catch (err) {
      console.error("playSpotifyTrack error:", err);
      const safeMessage = err.message || "Impossible de lancer la lecture Spotify";
      setPlayerError(safeMessage);

      if (
        String(safeMessage).toLowerCase().includes("4040") ||
        String(safeMessage).toLowerCase().includes("not found") ||
        String(safeMessage).toLowerCase().includes("device")
      ) {
        schedulePlayerReconnect(safeMessage);
      }

      return false;
    } finally {
      setTimeout(() => {
        launchInFlightRef.current = false;
      }, 1200);
    }
  };

  const playPlaylist = async () => {
    const queue = sortedTracks.filter((track) => track.spotifyId);

    if (queue.length === 0) {
      setPlayerError("Aucun morceau Spotify disponible dans la file d’attente");
      return;
    }

    const firstTrack = queue[0];
    setPlaybackQueue(queue);
    setCurrentQueueIndex(0);
    setCurrentPlayback(null);
    setCurrentPlaybackPosition(0);
    setCurrentPlaybackDuration(0);
    lastTrackIdRef.current = firstTrack.spotifyId || null;
    historyLoggedTrackRef.current = null;

    const started = await playSpotifyTrack(firstTrack.spotifyId);

    if (!started) {
      setPlayerError("La lecture n’a pas démarré, essaie à nouveau");
      return;
    }

    await syncSharedPlayerState({
      isPaused: false,
      position: 0,
      duration: 0,
      track: buildTrackPayload(firstTrack),
      currentTrackSpotifyId: firstTrack.spotifyId || null,
      ...buildSharedQueueSnapshot(queue, 0),
    });
  };

  const playNextTrack = async () => {
    if (playbackQueue.length === 0) {
      setPlayerError("Aucune file d’attente en cours");
      return;
    }

    const currentTrack =
      playbackQueue[currentQueueIndex >= 0 ? currentQueueIndex : 0];

    if (currentTrack?.id) {
      await archiveAndRemoveTrack(currentTrack);
    }

    const remainingQueue = playbackQueueRef.current.filter(
      (track) => track.id !== currentTrack?.id
    );
    const nextTrack = remainingQueue[0];

    if (!nextTrack?.spotifyId) {
      setPlaybackQueue([]);
      setCurrentQueueIndex(-1);

      await syncSharedPlayerState({
        isPaused: true,
        position: 0,
        duration: 0,
        track: null,
        queueIndex: -1,
        queueLength: 0,
        queueTitle: "",
        queue: [],
        currentTrackSpotifyId: null,
      });

      setPlayerError("Fin de file d’attente");
      return;
    }

    setPlaybackQueue(remainingQueue);
    setCurrentQueueIndex(0);
    setCurrentPlayback(null);
    setCurrentPlaybackPosition(0);
    setCurrentPlaybackDuration(0);
    lastTrackIdRef.current = nextTrack.spotifyId || null;

    await syncSharedPlayerState({
      isPaused: false,
      position: 0,
      duration: 0,
      track: buildTrackPayload(nextTrack),
      currentTrackSpotifyId: nextTrack.spotifyId || null,
      ...buildSharedQueueSnapshot(remainingQueue, 0),
    });

    await playSpotifyTrack(nextTrack.spotifyId);
  };

  const pausePlayback = async () => {
    try {
      if (!spotifyPlayer) return;
      await spotifyPlayer.pause();

      await syncSharedPlayerState({
        isPaused: true,
        position: currentPlaybackPosition,
        duration: currentPlaybackDuration,
        track: currentPlayback
          ? {
              id: currentPlayback.id || null,
              name: currentPlayback.name || "",
              artists: currentPlayback.artists || [],
              album: currentPlayback.album || null,
            }
          : null,
        ...buildSharedQueueSnapshot(playbackQueue, currentQueueIndex),
      });
    } catch {
      setPlayerError("Impossible de mettre en pause");
    }
  };

  const resumePlayback = async () => {
    try {
      if (!spotifyPlayer) return;
      await spotifyPlayer.resume();

      await syncSharedPlayerState({
        isPaused: false,
        position: currentPlaybackPosition,
        duration: currentPlaybackDuration,
        track: currentPlayback
          ? {
              id: currentPlayback.id || null,
              name: currentPlayback.name || "",
              artists: currentPlayback.artists || [],
              album: currentPlayback.album || null,
            }
          : null,
        ...buildSharedQueueSnapshot(playbackQueue, currentQueueIndex),
      });
    } catch {
      setPlayerError("Impossible de reprendre la lecture");
    }
  };

  // =========================
  // ➕ Ajout de morceaux dans la file
  // =========================
  const addSpotifyTrackToPlaylist = async (spotifyTrackData) => {
    if (!spotifyTrackData?.id) {
      setAddError("Sélectionne d’abord un morceau Spotify");
      return false;
    }

    const cleanTitle = (spotifyTrackData.name || "").trim();
    const cleanArtist =
      spotifyTrackData.artists?.map((a) => a.name).join(", ").trim() || "Unknown";

    if (!cleanTitle) return false;

    const normalizedTitle = cleanTitle.toLowerCase();
    const normalizedArtist = cleanArtist.toLowerCase();

    const alreadyExists = tracks.some((track) => {
      const sameSpotify =
        spotifyTrackData.id && track.spotifyId && track.spotifyId === spotifyTrackData.id;

      const sameManual =
        (track.title || "").trim().toLowerCase() === normalizedTitle &&
        (track.artist || "").trim().toLowerCase() === normalizedArtist;

      return sameSpotify || sameManual;
    });

    if (alreadyExists) {
      setAddError("Ce morceau est déjà dans la file d’attente");
      return false;
    }

    const maxPosition = tracks.reduce((acc, track) => {
      return typeof track.position === "number"
        ? Math.max(acc, track.position)
        : acc;
    }, -1);

    const newTrackData = {
      title: cleanTitle,
      artist: cleanArtist,
      spotifyId: spotifyTrackData.id || null,
      albumImage: spotifyTrackData?.album?.images?.[0]?.url || null,
      albumName: spotifyTrackData?.album?.name || null,
      createdAt: Date.now(),
      position: maxPosition + 1,
      votes: 0,
      votedBy: [userId].filter(Boolean),
      addedBy: username || "Inconnu",
    };

    try {
      const docRef = await addDoc(tracksCollectionRef, newTrackData);

      const optimisticTrack = { id: docRef.id, ...newTrackData };

      setTracks((prev) => {
        const exists = prev.some((track) => track.id === docRef.id);
        if (exists) return prev;

        const nextList = [...prev, optimisticTrack];
        return nextList.sort((a, b) => {
          const positionA =
            typeof a.position === "number" ? a.position : Number.MAX_SAFE_INTEGER;
          const positionB =
            typeof b.position === "number" ? b.position : Number.MAX_SAFE_INTEGER;

          if (positionA !== positionB) return positionA - positionB;
          return (a.createdAt || 0) - (b.createdAt || 0);
        });
      });

      if (isAdminUnlockedRef.current) {
        const nextTracks = [...tracks, optimisticTrack].sort((a, b) => {
          const positionA =
            typeof a.position === "number" ? a.position : Number.MAX_SAFE_INTEGER;
          const positionB =
            typeof b.position === "number" ? b.position : Number.MAX_SAFE_INTEGER;

          if (positionA !== positionB) return positionA - positionB;
          return (a.createdAt || 0) - (b.createdAt || 0);
        });

        refreshSharedQueueFromTracks(nextTracks);
      }

      setSearchQuery("");
      setSearchResults([]);
      setSelectedSpotifyTrackData(null);
      setSearchError("");
      setAddError("");

      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current.currentTime = 0;
      }

      setPreviewingUrl("");

      setRecentlyAddedIds((prev) => [...prev, docRef.id]);
      setTimeout(() => {
        setRecentlyAddedIds((prev) => prev.filter((id) => id !== docRef.id));
      }, 2200);

      showToast("Musique ajoutée à la file d’attente");
      return true;
    } catch (err) {
      console.error("addTrack error:", err);
      setAddError(err?.message || "Impossible d’ajouter le morceau");
      return false;
    }
  };

  const addTrack = async () => {
    await addSpotifyTrackToPlaylist(selectedSpotifyTrackData);
  };

  const selectSpotifyTrack = (track) => {
    setSelectedSpotifyTrackData(track);
    setSearchResults([]);
    setSearchQuery("");
    setSearchError("");
    setAddError("");
  };

  const handlePreview = (track) => {
    if (!track?.preview_url) return;

    const samePreview = previewingUrl === track.preview_url;

    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current.currentTime = 0;
    }

    if (samePreview) {
      setPreviewingUrl("");
      return;
    }

    const audio = new Audio(track.preview_url);
    audioPreviewRef.current = audio;
    audio.play().catch(() => {});
    audio.onended = () => setPreviewingUrl("");
    setPreviewingUrl(track.preview_url);
  };

  const removeTrack = async (id) => {
    await deleteDoc(doc(db, "tracks", id));
  };

  const confirmDelete = async () => {
    if (!trackToDelete) return;

    setDeletingId(trackToDelete);
    setTimeout(async () => {
      await removeTrack(trackToDelete);
      setDeletingId(null);
    }, 250);

    setTrackToDelete(null);
  };

  const handleTouchStart = (e, id) => {
    const x = e.touches[0].clientX;
    setTouchStartX((prev) => ({ ...prev, [id]: x }));
    setTouchCurrentX((prev) => ({ ...prev, [id]: x }));
  };

  const handleTouchMove = (e, id) => {
    const startX = touchStartX[id];
    if (startX == null) return;

    const currentX = e.touches[0].clientX;
    setTouchCurrentX((prev) => ({ ...prev, [id]: currentX }));

    const delta = currentX - startX;
    if (delta < 0) {
      setSwipeX((prev) => ({
        ...prev,
        [id]: Math.max(delta, -90),
      }));
    }
  };

  const handleTouchEnd = (id) => {
    const delta = (touchCurrentX[id] ?? 0) - (touchStartX[id] ?? 0);
    if (delta < -70) {
      setTrackToDelete(id);
    }

    setSwipeX((prev) => ({ ...prev, [id]: 0 }));
    setTouchStartX((prev) => ({ ...prev, [id]: null }));
    setTouchCurrentX((prev) => ({ ...prev, [id]: null }));
  };

  // =========================
  // 🔁 Réparation / réorganisation de la file
  // =========================
  const relaunchSpotifyPlayer = async () => {
    if (!isAdminUnlocked || !spotifyUser) return;

    try {
      setPlayerConnecting(true);
      setPlayerError("Reconnexion du lecteur...");

      if (spotifyPlayer) {
        await spotifyPlayer.disconnect();
      }
    } catch {
      // ignore
    } finally {
      setPlayerReady(false);
      setPlayerDeviceId(null);
      setSpotifyPlayer(null);
      setPlayerReconnectKey((prev) => prev + 1);

      setTimeout(() => setPlayerConnecting(false), 1200);
    }
  };

  const moveTrackToFront = async (trackId) => {
    if (!isAdminUnlocked) return;

    const currentList = [...sortedTracks];
    const sourceIndex = currentList.findIndex((track) => track.id === trackId);
    if (sourceIndex === -1) return;

    const liveSpotifyId =
      currentPlayback?.id ||
      sharedPlayerState?.currentTrackSpotifyId ||
      sharedPlayerState?.track?.id ||
      null;

    const liveIndex = liveSpotifyId
      ? currentList.findIndex((track) => track.spotifyId === liveSpotifyId)
      : -1;

    const targetIndex = liveIndex >= 0 ? liveIndex + 1 : 0;

    if (sourceIndex === targetIndex || sourceIndex === targetIndex - 1) return;

    const [moved] = currentList.splice(sourceIndex, 1);
    const safeTargetIndex = Math.min(targetIndex, currentList.length);
    currentList.splice(safeTargetIndex, 0, moved);

    const reordered = currentList.map((track, index) => ({
      ...track,
      position: index,
    }));

    setTracks(reordered);

    if (isAdminUnlockedRef.current) {
      await refreshSharedQueueFromTracks(reordered);
    }

    try {
      const batch = writeBatch(db);
      reordered.forEach((track) => {
        batch.update(doc(db, "tracks", track.id), { position: track.position });
      });
      await batch.commit();

      showToast(
        liveIndex >= 0
          ? "Musique déplacée juste après le morceau en cours"
          : "Musique déplacée en premier"
      );
    } catch (err) {
      console.error("moveTrackToFront error:", err);
      setPlayerError("Impossible de passer cette musique en premier");
    }
  };

  const moveTrackUp = async (trackId) => {
    if (!isAdminUnlocked) return;

    const currentList = [...sortedTracks];
    const sourceIndex = currentList.findIndex((track) => track.id === trackId);

    if (sourceIndex <= 0) return;

    [currentList[sourceIndex - 1], currentList[sourceIndex]] = [
      currentList[sourceIndex],
      currentList[sourceIndex - 1],
    ];

    const reordered = currentList.map((track, index) => ({
      ...track,
      position: index,
    }));

    setTracks(reordered);

    try {
      const batch = writeBatch(db);
      reordered.forEach((track) => {
        batch.update(doc(db, "tracks", track.id), { position: track.position });
      });
      await batch.commit();

      if (isAdminUnlockedRef.current) {
        await refreshSharedQueueFromTracks(reordered);
      }

      showToast("Musique remontée d’un cran");
    } catch (err) {
      console.error("moveTrackUp error:", err);
      setPlayerError("Impossible de remonter cette musique");
    }
  };

  const reinjectHistoryTrack = async (item) => {
    if (!item?.spotifyId) return;

    const syntheticTrack = {
      id: item.spotifyId,
      name: item.title,
      artists: [{ name: item.artist || "Artiste inconnu" }],
      album: {
        images: item.albumImage ? [{ url: item.albumImage }] : [],
      },
      preview_url: null,
    };

    await addSpotifyTrackToPlaylist(syntheticTrack);
  };


  // =========================
  // 🖼️ Fonctions de rendu d'éléments UI
  // =========================
  const renderHistoryItem = (item) => {
    const image = getTrackImage(item);

    // =========================
  // 🧩 Rendu principal de l'interface
  // =========================
  return (
      <div key={item.id} style={styles.historyRow}>
        {image ? (
          <img src={image} alt={item.title} style={styles.historyThumb} />
        ) : (
          <div style={styles.historyThumbPlaceholder}>♪</div>
        )}

        <div style={styles.historyContent}>
          <div style={styles.historyTitle}>{item.title}</div>
          <div style={styles.historyArtist}>{item.artist}</div>
          <div style={styles.historyMeta}>Passée {formatTimeAgo(item.playedAt)}</div>
        </div>

        <button
          style={styles.historyActionButton}
          onClick={() => reinjectHistoryTrack(item)}
          title="Ajouter à la file d’attente"
        >
          +
        </button>
      </div>
    );
  };

  const renderQueueTrackItem = (track, options = {}) => {
    const image = getTrackImage(track);
    const isAdminQueueItem = Boolean(options.isAdminQueueItem);
    const trackId = track.id || `${track.order}-${track.title}`;

    return (
      <div key={trackId} style={styles.swipeWrapper}>
        <div
          style={{
            ...styles.liveQueueItemRow,
            ...(recentlyAddedIds.includes(track.id) ? styles.liveQueueItemAdded : {}),
            transform: `translateX(${swipeX[trackId] || 0}px)`,
            opacity: deletingId === track.id ? 0.4 : 1,
          }}
          onTouchStart={
            isAdminQueueItem ? (e) => handleTouchStart(e, trackId) : undefined
          }
          onTouchMove={
            isAdminQueueItem ? (e) => handleTouchMove(e, trackId) : undefined
          }
          onTouchEnd={isAdminQueueItem ? () => handleTouchEnd(track.id) : undefined}
        >
          <div style={styles.liveQueueOrderBox}>
            {isAdminQueueItem && track.id && track.order > 1 ? (
              <button
                style={styles.upArrowButton}
                onClick={(e) => {
                  e.stopPropagation();
                  moveTrackUp(track.id);
                }}
                title="Remonter d’un cran"
              >
                ⬆️
              </button>
            ) : (
              <span style={styles.queueTopPlaceholder}>•</span>
            )}
          </div>

          <div style={styles.liveQueueMediaColumn}>
            {image ? (
              <img src={image} alt={track.title} style={styles.trackThumb} />
            ) : (
              <div style={styles.trackThumbPlaceholder}>♪</div>
            )}

            {isAdminQueueItem && track.id ? (
              <button
                style={styles.passFirstButtonUnderImage}
                onClick={(e) => {
                  e.stopPropagation();
                  moveTrackToFront(track.id);
                }}
              >
                Passer en premier
              </button>
            ) : null}
          </div>

          <div style={{ ...styles.item, alignItems: "center", justifyContent: "center" }}>
            <div style={styles.titleText}>{track.title}</div>
            <div style={styles.artistText}>{track.artist}</div>
            <div style={styles.liveQueueMeta}>
              {track.addedBy
                ? `Ajouté par : ${track.addedBy}${
                    track.createdAt ? ` · ${formatTimeAgo(track.createdAt)}` : ""
                  }`
                : "À venir dans la file d’attente"}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const displayedPlayback = currentPlayback || sharedPlayerState?.track || null;
  const displayedPlaybackPosition = currentPlayback
    ? currentPlaybackPosition
    : Math.min(
        (sharedPlayerState?.position || 0) +
          (!(sharedPlayerState?.isPaused) && sharedPlayerState?.updatedAt
            ? Math.max(Date.now() - sharedPlayerState.updatedAt, 0)
            : 0),
        sharedPlayerState?.duration || 0
      );
  const displayedPlaybackDuration = currentPlayback
    ? currentPlaybackDuration
    : sharedPlayerState?.duration || 0;
  const displayedProgressPercent = displayedPlaybackDuration
    ? Math.min((displayedPlaybackPosition / displayedPlaybackDuration) * 100, 100)
    : 0;

  const isVisitorView = !isAdminUnlocked && !spotifyUser;
  const currentQueueTrack =
    currentQueueIndex >= 0 ? playbackQueue[currentQueueIndex] : null;

  const displayedQueueIndex =
    !isVisitorView && (currentQueueTrack || isAdminUnlocked)
      ? currentQueueIndex
      : sharedPlayerState?.queueIndex ?? -1;

  const displayedQueueLength =
    !isVisitorView && (currentQueueTrack || isAdminUnlocked)
      ? playbackQueue.length
      : sharedPlayerState?.queueLength || 0;

  const displayedQueueTitle =
    (!isVisitorView ? currentQueueTrack?.title : "") ||
    sharedPlayerState?.queueTitle ||
    displayedPlayback?.name ||
    "";

  const displayedUpcomingQueue =
    !isVisitorView && (currentQueueTrack || isAdminUnlocked)
      ? playbackQueue
          .slice(Math.max(currentQueueIndex + 1, 0))
          .map((track, index) => ({
            id: track.id,
            order: index + 1,
            title: track.title,
            artist: track.artist,
            albumImage: track.albumImage || null,
            addedBy: track.addedBy || "Inconnu",
            createdAt: track.createdAt || null,
            isCurrent: false,
          }))
      : Array.isArray(sharedPlayerState?.queue) && sharedPlayerState.queue.length > 0
      ? sharedPlayerState.queue
      : displayedPlayback?.id
      ? sortedTracks
          .filter((track) => track.spotifyId && track.spotifyId !== displayedPlayback.id)
          .slice(0, 8)
          .map((track, index) => ({
            id: track.id,
            order: index + 1,
            title: track.title,
            artist: track.artist,
            albumImage: track.albumImage || null,
            addedBy: track.addedBy || "Inconnu",
            createdAt: track.createdAt || null,
            isCurrent: false,
          }))
      : [];

  const nowPlayingImage = getTrackImage(displayedPlayback);

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlowTop} />
      <div style={styles.backgroundGlowBottom} />

      <div style={styles.card}>
        <div style={styles.appHeader}>
          <div style={styles.titleRow}>
            <h1 style={styles.appTitle}>♪ Musique</h1>
          </div>

          <div style={styles.headerActions}>
            {!username ? (
              <div style={styles.loginBox}>
                <input
                  style={styles.smallInput}
                  placeholder="Ton nom"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                />
                <button style={styles.smallButton} onClick={handleLogin}>
                  OK
                </button>
              </div>
            ) : null}

            {username ? (
              <button
                style={styles.userMenuButton}
                onClick={() => setShowUserMenu(true)}
              >
                {isAdminUnlocked ? "👑" : "👤"} {username}
              </button>
            ) : null}
          </div>
        </div>

        {isAdminUnlocked && !spotifyUser && (
          <div style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={styles.sectionEyebrow}>Étape 1</div>
                <h2 style={styles.sectionTitle}>Connexion Spotify</h2>
              </div>
            </div>

            {spotifyAuthLoading ? (
              <div style={styles.infoText}>Connexion Spotify...</div>
            ) : (
              <button style={styles.spotifyButton} onClick={loginWithSpotify}>
                Se connecter à Spotify
              </button>
            )}
          </div>
        )}

        {isAdminUnlocked && spotifyUser && (
          <div style={styles.adminConnectedBar}>
            <button
              style={styles.spotifyUserBadgeCompact}
              onClick={() => setShowSpotifyMenu(true)}
            >
              <span style={styles.spotifyDot} />
              Spotify connecté : {spotifyUser.display_name || spotifyUser.id}
            </button>
          </div>
        )}
        {isAdminUnlocked && (
          <div style={{ ...styles.sectionCard, marginBottom: 26 }}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Contrôles</h2>
              </div>
            </div>
        
            <div style={styles.playerControlsBlock}>
              <div style={styles.playerControlsRow}>
                <button
                  style={styles.iconButtonPrimary}
                  onClick={playPlaylist}
                  disabled={!spotifyToken || !spotifyUser}
                >
                  ▶ Lire musique
                </button>
        
                <button
                  style={{
                    ...styles.iconButton,
                    ...(isPaused ? styles.iconButtonMuted : {}),
                  }}
                  onClick={pausePlayback}
                  disabled={!spotifyPlayer || isPaused}
                >
                  ⏸
                </button>
        
                <button
                  style={{
                    ...styles.iconButton,
                    ...styles.iconButtonAccent,
                    ...(!isPaused ? styles.iconButtonMuted : {}),
                  }}
                  onClick={resumePlayback}
                  disabled={!spotifyPlayer || !isPaused}
                >
                  ▶
                </button>
        
                <button
                  style={styles.iconButton}
                  onClick={playNextTrack}
                  disabled={!spotifyToken || !spotifyUser}
                >
                  ⏭
                </button>
              </div>
        
              <button
                style={styles.secondaryButton}
                onClick={() => setAutoplayEnabled((prev) => !prev)}
              >
                {autoplayEnabled
                  ? "Désactiver l’enchaînement automatique"
                  : "Activer l’enchaînement automatique"}
              </button>
            </div>
          </div>
        )}

        <div style={{ ...styles.sectionCard, marginBottom: 26 }}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionEyebrow}>Étape 2</div>
              <h2 style={styles.sectionTitle}>Lecture en cours</h2>
            </div>
          </div>

          <div
            style={{
              ...styles.nowPlayingCard,
              ...(displayedPlayback ? styles.nowPlayingCardActive : {}),
            }}
          >
            {nowPlayingImage ? (
              <img
                src={nowPlayingImage}
                alt={displayedPlayback?.name || "Pochette"}
                style={styles.nowPlayingImage}
              />
            ) : (
              <div style={styles.nowPlayingImagePlaceholder}>🎵</div>
            )}

            <div style={styles.nowPlayingContent}>
              <div style={styles.nowPlayingLabel}>
                <span style={styles.soundBars}>
                  <span style={{ ...styles.soundBar, height: 8, opacity: 0.75 }} />
                  <span style={{ ...styles.soundBar, height: 14 }} />
                  <span style={{ ...styles.soundBar, height: 10, opacity: 0.85 }} />
                </span>
                En cours
              </div>

              <div style={styles.nowPlayingTitle}>
                {displayedPlayback?.name || "Aucun morceau en lecture"}
              </div>

              <div style={styles.nowPlayingArtist}>
                {displayedPlayback?.artists?.map((a) => a.name).join(", ") ||
                  "En attente d’une lecture Spotify"}
              </div>

              <div style={styles.progressMeta}>
                <span>{formatMs(displayedPlaybackPosition)}</span>
                <span>{formatMs(displayedPlaybackDuration)}</span>
              </div>

              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressBarFill,
                    width: `${displayedProgressPercent}%`,
                  }}
                />
              </div>

              

              {displayedQueueLength > 0 && displayedQueueIndex >= 0 && (
                <div style={styles.queueInfoInline}>
                  File : {displayedQueueIndex + 1}/{displayedQueueLength} ·{" "}
                  {displayedQueueTitle}
                </div>
              )}
            </div>
          </div>

          {(playerConnecting || (!playerReady && isAdminUnlocked && spotifyUser)) && (
            <div style={styles.connectionStateBox}>
              {playerConnecting ? "Connexion du lecteur..." : "Reconnexion du lecteur..."}
            </div>
          )}

          {playerError && <div style={styles.errorText}>{playerError}</div>}

          {isAdminUnlocked && spotifyUser && playerError && (
            <button style={styles.relaunchButton} onClick={relaunchSpotifyPlayer}>
              Relancer Spotify
            </button>
          )}
        </div>

        <div
          style={{
            ...styles.sectionCard,
            marginTop: 26,
            boxShadow: "0 14px 44px rgba(0,0,0,0.34)",
          }}
        >
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionEyebrow}>Étape 3</div>
              <h2 style={styles.sectionTitle}>🔎 Recherche</h2>
            </div>
          </div>

          <div style={styles.inputCol}>
            <input
              style={styles.input}
              value={searchQuery}
              placeholder="Rechercher sur Spotify..."
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                setAddError("");

                clearTimeout(spotifyTimeoutRef.current);
                spotifyTimeoutRef.current = setTimeout(() => {
                  searchSpotify(value);
                }, 400);
              }}
            />

            {isSearching && <div style={styles.infoText}>Recherche en cours...</div>}
            {searchError && <div style={styles.errorText}>{searchError}</div>}

            {searchResults.length > 0 && (
              <div style={styles.results}>
                {searchResults.map((t) => (
                  <div
                    key={t.id}
                    style={styles.resultItem}
                    onClick={() => selectSpotifyTrack(t)}
                  >
                    {t.album?.images?.[0]?.url ? (
                      <img
                        src={t.album.images[0].url}
                        alt={t.name}
                        style={styles.resultThumb}
                      />
                    ) : (
                      <div style={styles.resultThumbPlaceholder}>♪</div>
                    )}

                    <div style={styles.resultText}>
                      <div style={styles.resultTitle}>{t.name}</div>
                      <div style={styles.resultArtist}>
                        {t.artists?.map((a) => a.name).join(", ")}
                      </div>
                      <div style={styles.resultAlbum}>
                        {t.album?.name || "Album inconnu"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedSpotifyTrackData && (
            <div style={styles.selectedSpotifyCard}>
              {selectedSpotifyTrackData.album?.images?.[0]?.url ? (
                <img
                  src={selectedSpotifyTrackData.album.images[0].url}
                  alt={selectedSpotifyTrackData.name}
                  style={styles.selectedSpotifyThumb}
                />
              ) : (
                <div style={styles.selectedSpotifyThumbPlaceholder}>♪</div>
              )}

              <div style={styles.selectedSpotifyContent}>
                <div style={styles.selectedSpotifyTitle}>
                  Morceau Spotify sélectionné
                </div>
                <div style={styles.selectedSpotifyMeta}>
                  {selectedSpotifyTrackData.name} ·{" "}
                  {selectedSpotifyTrackData.artists?.map((a) => a.name).join(", ")}
                </div>
              </div>

              <button
                style={{
                  ...styles.previewButton,
                  ...(!selectedSpotifyTrackData.preview_url
                    ? styles.previewButtonDisabled
                    : {}),
                }}
                onClick={() => handlePreview(selectedSpotifyTrackData)}
                disabled={!selectedSpotifyTrackData.preview_url}
              >
                {previewingUrl === selectedSpotifyTrackData.preview_url
                  ? "Stop extrait"
                  : "Écouter un extrait"}
              </button>
            </div>
          )}

          {addError && <div style={styles.errorText}>{addError}</div>}

          <button style={styles.button} onClick={addTrack}>
            Ajouter à la file d’attente
          </button>
        </div>

        {displayedUpcomingQueue.length > 0 && (
          <div style={styles.liveQueueCard}>
            <div style={styles.liveQueueHeader}>
              <div style={styles.liveQueueTitle}>File d’attente</div>
              <div style={styles.liveQueueCount}>
                {displayedUpcomingQueue.length} morceau
                {displayedUpcomingQueue.length > 1 ? "x" : ""}
              </div>
            </div>

            <div style={styles.liveQueueList}>
              {displayedUpcomingQueue
                .slice(0, 8)
                .map((track) =>
                  renderQueueTrackItem(track, { isAdminQueueItem: isAdminUnlocked })
                )}
            </div>

            <div style={styles.liveQueueHint}>
              {isAdminUnlocked
                ? "Glisse à gauche pour supprimer un morceau de la file d’attente."
                : "La file d’attente est synchronisée pour tous les utilisateurs."}
            </div>
          </div>
        )}

        {SHOW_SUGGESTIONS && (
          <div style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={styles.sectionEyebrow}>Suggestions</div>
                <h2 style={styles.sectionTitle}>Suggestions</h2>
              </div>

              <button
                style={styles.refreshButton}
                onClick={refreshSuggestions}
                disabled={suggestionsLoading}
              >
                ↻ Rafraîchir
              </button>
            </div>

            <input
              style={styles.input}
              value={suggestionsFilter}
              placeholder="Filtrer les suggestions..."
              onChange={(e) => setSuggestionsFilter(e.target.value)}
            />

            {suggestionsLoading && (
              <div style={styles.infoText}>Chargement des suggestions...</div>
            )}

            {!suggestionsLoading && filteredSuggestions.length === 0 && (
              <div style={styles.infoText}>
                Ajoute quelques morceaux pour générer des suggestions.
              </div>
            )}

            {filteredSuggestions.length > 0 && (
              <div style={styles.results}>
                {filteredSuggestions.map((t) => (
                  <div
                    key={t.id}
                    style={styles.resultItem}
                    onClick={() => selectSpotifyTrack(t)}
                  >
                    {t.album?.images?.[0]?.url ? (
                      <img
                        src={t.album.images[0].url}
                        alt={t.name}
                        style={styles.resultThumb}
                      />
                    ) : (
                      <div style={styles.resultThumbPlaceholder}>♪</div>
                    )}

                    <div style={styles.resultText}>
                      <div style={styles.resultTitle}>{t.name}</div>
                      <div style={styles.resultArtist}>
                        {t.artists?.map((a) => a.name).join(", ")}
                      </div>
                      <div style={styles.resultAlbum}>
                        {t.album?.name || "Album inconnu"}
                      </div>
                    </div>

                    <button
                      style={styles.suggestionAddButton}
                      onClick={async (e) => {
                        e.stopPropagation();
                        await addSpotifyTrackToPlaylist(t);
                      }}
                    >
                      Ajouter à la file d’attente
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={styles.sectionCard}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionEyebrow}>Étape 5</div>
              <h2 style={styles.sectionTitle}>Historique</h2>
            </div>

            <button
              style={styles.collapseButton}
              onClick={() => setHistoryExpanded((prev) => !prev)}
            >
              {historyExpanded ? "▾" : "▸"}
            </button>
          </div>

          {historyExpanded ? (
            historyTracks.length > 0 ? (
              <div style={styles.list}>
                {historyTracks.map((item) => renderHistoryItem(item))}
              </div>
            ) : (
              <div style={styles.infoText}>Aucune musique passée pour le moment.</div>
            )
          ) : null}
        </div>

        <Link to="/" style={styles.homeReturnModule}>
          <div style={styles.homeReturnButton}>⬅️ Retour à l’accueil</div>
        </Link>
      </div>

      {toastMessage && <div style={styles.toast}>{toastMessage}</div>}

      {showPinModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalTitle}>Code PIN admin</div>
            <div style={styles.modalText}>
              Entre le code PIN pour afficher les contrôles Spotify.
            </div>

            <input
              style={styles.input}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                setPinError("");
              }}
              placeholder="Code PIN"
            />

            {pinError && <div style={styles.errorText}>{pinError}</div>}

            <div style={styles.modalActions}>
              <button
                style={styles.modalCancel}
                onClick={() => {
                  setShowPinModal(false);
                  setPinInput("");
                  setPinError("");
                }}
              >
                Annuler
              </button>

              <button style={styles.modalConfirm} onClick={unlockAdminMode}>
                Valider
              </button>
            </div>
          </div>
        </div>
      )}

      {showUserMenu && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.popupHeader}>
              <div style={styles.modalTitle}>Compte</div>
              <button
                style={styles.popupCloseButton}
                onClick={() => setShowUserMenu(false)}
              >
                ✕
              </button>
            </div>

            <div style={styles.popupMenuList}>
              <button
                style={styles.popupMenuButton}
                onClick={() => {
                  localStorage.removeItem("username");
                  setShowUserMenu(false);
                  window.location.reload();
                }}
              >
                Déconnecter l’utilisateur
              </button>

              {!isAdminUnlocked ? (
                <button
                  style={styles.popupMenuButton}
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowPinModal(true);
                    setPinError("");
                  }}
                >
                  Passer admin
                </button>
              ) : (
                <button
                  style={styles.popupMenuButton}
                  onClick={() => {
                    lockAdminMode();
                    setShowUserMenu(false);
                  }}
                >
                  Quitter mode admin
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showSpotifyMenu && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.popupHeader}>
              <div style={styles.modalTitle}>Spotify</div>
              <button
                style={styles.popupCloseButton}
                onClick={() => setShowSpotifyMenu(false)}
              >
                ✕
              </button>
            </div>

            <div style={styles.popupMenuList}>
              <button
                style={styles.popupMenuButton}
                onClick={() => {
                  logoutSpotify();
                  setSpotifyToken(null);
                  setSpotifyUser(null);
                  setSpotifyPlayer(null);
                  setPlayerReady(false);
                  setPlayerDeviceId(null);
                  setCurrentPlayback(null);
                  setCurrentPlaybackPosition(0);
                  setCurrentPlaybackDuration(0);
                  clearTimeout(reconnectTimeoutRef.current);
                  reconnectAttemptsRef.current = 0;
                  setPlaybackQueue([]);
                  setCurrentQueueIndex(-1);
                  setShowSpotifyMenu(false);
                  syncSharedPlayerState({
                    isPaused: true,
                    position: 0,
                    duration: 0,
                    track: null,
                    queueIndex: -1,
                    queueLength: 0,
                    queueTitle: "",
                    queue: [],
                  });
                }}
              >
                Déconnecter Spotify
              </button>
            </div>
          </div>
        </div>
      )}

      {trackToDelete && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalTitle}>Confirmer la suppression</div>
            <div style={styles.modalText}>
              Tu veux vraiment supprimer ce morceau ?
            </div>

            <div style={styles.modalActions}>
              <button
                style={styles.modalCancel}
                onClick={() => setTrackToDelete(null)}
              >
                Annuler
              </button>

              <button style={styles.modalDelete} onClick={confirmDelete}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================
// 🎨 Styles inline de l'application
// =========================
const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    background:
      "radial-gradient(circle at top, rgba(29,185,84,0.16), transparent 24%), linear-gradient(180deg, #07110a 0%, #0b1220 40%, #06080d 100%)",
    padding: 18,
    fontFamily: "Arial, sans-serif",
    position: "relative",
    overflow: "hidden",
    color: "#f8fafc",
  },
  backgroundGlowTop: {
    position: "fixed",
    top: -120,
    left: -100,
    width: 280,
    height: 280,
    borderRadius: "50%",
    background: "rgba(29,185,84,0.12)",
    filter: "blur(60px)",
    pointerEvents: "none",
  },
  backgroundGlowBottom: {
    position: "fixed",
    bottom: -120,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: "50%",
    background: "rgba(59,130,246,0.10)",
    filter: "blur(70px)",
    pointerEvents: "none",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    position: "relative",
    zIndex: 1,
  },
  appHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "nowrap",
    minWidth: 0,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "nowrap",
    justifyContent: "flex-end",
    marginLeft: "auto",
    marginRight: 0,
    width: "auto",
  },
  appTitle: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.05,
    color: "#f8fafc",
  },
  sectionCard: {
    background: "rgba(15, 23, 42, 0.82)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    boxShadow: "0 10px 40px rgba(0,0,0,0.28)",
    backdropFilter: "blur(10px)",
  },
  adminConnectedBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    background: "rgba(15, 23, 42, 0.82)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    boxShadow: "0 10px 40px rgba(0,0,0,0.28)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  sectionEyebrow: {
    color: "#94a3b8",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
    fontWeight: "bold",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 20,
    color: "#f8fafc",
  },
  loginBox: {
    display: "flex",
    gap: 8,
    width: "100%",
    maxWidth: 220,
  },
  smallInput: {
    flex: 1,
    minWidth: 0,
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(15,23,42,0.8)",
    color: "#f8fafc",
    fontSize: 13,
    outline: "none",
  },
  smallButton: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "none",
    background: "#1DB954",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
  },
  adminGhostButton: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.20)",
    background: "rgba(15,23,42,0.82)",
    color: "#cbd5e1",
    cursor: "pointer",
    fontWeight: "bold",
  },
  userMenuButton: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(15,23,42,0.82)",
    color: "#e2e8f0",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: 13,
    marginLeft: "auto",
    maxWidth: 180,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  inputCol: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 12,
  },
  input: {
    padding: 13,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.18)",
    width: "100%",
    boxSizing: "border-box",
    fontSize: 14,
    background: "#0f172a",
    color: "#f8fafc",
    outline: "none",
  },
  button: {
    padding: 13,
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #1DB954, #16a34a)",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
    boxShadow: "0 8px 20px rgba(29,185,84,0.24)",
  },
  spotifyUserBadgeCompact: {
    background: "rgba(16, 185, 129, 0.12)",
    color: "#d1fae5",
    padding: "10px 12px",
    borderRadius: 14,
    fontSize: 13,
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: "1px solid rgba(16,185,129,0.24)",
    cursor: "pointer",
    width: "100%",
    justifyContent: "flex-start",
  },
  spotifyDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#1DB954",
    display: "inline-block",
    boxShadow: "0 0 12px rgba(29,185,84,0.7)",
  },
  spotifyButton: {
    padding: 14,
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #1DB954, #179443)",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
    width: "100%",
    fontSize: 15,
    boxShadow: "0 10px 28px rgba(29,185,84,0.26)",
  },
  spotifyLogoutButton: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "#0f172a",
    color: "#e2e8f0",
    cursor: "pointer",
    fontWeight: "bold",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  swipeWrapper: {
    overflow: "hidden",
    borderRadius: 16,
  },
  trackThumb: {
    width: 58,
    height: 58,
    borderRadius: 14,
    objectFit: "cover",
    flexShrink: 0,
  },
  trackThumbPlaceholder: {
    width: 58,
    height: 58,
    borderRadius: 14,
    background: "#1f2937",
    border: "1px solid rgba(148,163,184,0.16)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
    fontSize: 22,
    flexShrink: 0,
  },
  item: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  titleText: {
    fontWeight: "bold",
    fontSize: 15,
    color: "#f8fafc",
    textAlign: "center",
    width: "100%",
  },
  artistText: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 1,
    textAlign: "center",
    width: "100%",
  },
  results: {
    background: "#0f172a",
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.16)",
    maxHeight: 320,
    overflowY: "auto",
  },
  resultItem: {
    padding: 12,
    cursor: "pointer",
    borderBottom: "1px solid rgba(148,163,184,0.08)",
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "nowrap",
  },
  suggestionAddButton: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #1DB954, #179443)",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  resultThumb: {
    width: 50,
    height: 50,
    borderRadius: 12,
    objectFit: "cover",
    flexShrink: 0,
  },
  resultThumbPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 12,
    background: "#1f2937",
    border: "1px solid rgba(148,163,184,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
    fontSize: 18,
    flexShrink: 0,
  },
  resultText: {
    minWidth: 0,
    flex: 1,
    overflow: "hidden",
  },
  resultTitle: {
    fontWeight: "bold",
    color: "#f8fafc",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  resultArtist: {
    fontSize: 12,
    color: "#cbd5e1",
    marginTop: 2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  resultAlbum: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  infoText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  errorText: {
    fontSize: 12,
    color: "#fca5a5",
    marginTop: 10,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,0.72)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    zIndex: 999,
  },
  modal: {
    width: "100%",
    maxWidth: 360,
    background: "#0f172a",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
    border: "1px solid rgba(148,163,184,0.18)",
  },
  modalTitle: {
    fontWeight: "bold",
    fontSize: 18,
    marginBottom: 10,
    color: "#f8fafc",
  },
  modalText: {
    fontSize: 14,
    color: "#cbd5e1",
    marginBottom: 16,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 14,
  },
  modalCancel: {
    padding: "10px 13px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "#111827",
    color: "#f8fafc",
    cursor: "pointer",
  },
  modalConfirm: {
    padding: "10px 13px",
    borderRadius: 10,
    border: "none",
    background: "#1DB954",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
  },
  modalDelete: {
    padding: "10px 13px",
    borderRadius: 10,
    border: "none",
    background: "#dc2626",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
  },
  nowPlayingCard: {
    display: "flex",
    gap: 14,
    alignItems: "stretch",
    background:
      "linear-gradient(135deg, rgba(17,24,39,1), rgba(15,23,42,1), rgba(17,24,39,1))",
    color: "white",
    borderRadius: 18,
    padding: 14,
    boxShadow: "0 10px 25px rgba(0,0,0,0.24)",
    border: "1px solid rgba(148,163,184,0.12)",
    transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
  },
  nowPlayingImage: {
    width: 104,
    height: 104,
    borderRadius: 16,
    objectFit: "cover",
    flexShrink: 0,
  },
  nowPlayingImagePlaceholder: {
    width: 104,
    height: 104,
    borderRadius: 16,
    background: "rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 34,
    flexShrink: 0,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  nowPlayingContent: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 6,
  },
  nowPlayingLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#86efac",
    fontWeight: "bold",
  },
  soundBars: {
    display: "inline-flex",
    alignItems: "flex-end",
    gap: 3,
    height: 12,
    marginRight: 8,
    verticalAlign: "middle",
  },
  soundBar: {
    display: "inline-block",
    width: 3,
    height: 10,
    borderRadius: 999,
    background: "#86efac",
  },
  nowPlayingTitle: {
    fontWeight: "bold",
    fontSize: 18,
    lineHeight: 1.2,
    color: "#f8fafc",
  },
  nowPlayingArtist: {
    fontSize: 13,
    color: "#cbd5e1",
  },
  progressMeta: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 4,
  },
  progressBar: {
    height: 7,
    width: "100%",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #1DB954, #34d399)",
    boxShadow: "0 0 18px rgba(29,185,84,0.35)",
  },
  queueInfoInline: {
    marginTop: 4,
    fontSize: 12,
    color: "#d1fae5",
    fontWeight: "bold",
  },
  secondaryButton: {
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.16)",
    background: "#0f172a",
    color: "#e2e8f0",
    cursor: "pointer",
    fontWeight: "bold",
    width: "100%",
    marginTop: 12,
  },
  playerControlsBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  playerControlsRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    marginTop: 14,
  },
  iconButtonPrimary: {
    flex: 1,
    padding: "13px 12px",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #1DB954, #179443)",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
    boxShadow: "0 10px 24px rgba(29,185,84,0.24)",
  },
  iconButton: {
    minWidth: 52,
    height: 48,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.16)",
    background: "#0f172a",
    color: "#f8fafc",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: 18,
  },
  iconButtonAccent: {
    background: "rgba(29,185,84,0.10)",
    border: "1px solid rgba(29,185,84,0.24)",
  },
  iconButtonMuted: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  selectedSpotifyCard: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    background: "rgba(29,185,84,0.10)",
    color: "#d1fae5",
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    border: "1px solid rgba(29,185,84,0.18)",
  },
  selectedSpotifyThumb: {
    width: 54,
    height: 54,
    borderRadius: 12,
    objectFit: "cover",
    flexShrink: 0,
  },
  selectedSpotifyThumbPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 12,
    background: "#1f2937",
    border: "1px solid rgba(148,163,184,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
    fontSize: 18,
    flexShrink: 0,
  },
  selectedSpotifyContent: {
    minWidth: 0,
    flex: 1,
  },
  selectedSpotifyTitle: {
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 3,
    color: "#f0fdf4",
  },
  selectedSpotifyMeta: {
    fontSize: 12,
    lineHeight: 1.35,
    color: "#d1fae5",
  },
  previewButton: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(29,185,84,0.28)",
    background: "rgba(29,185,84,0.16)",
    color: "#f0fdf4",
    cursor: "pointer",
    fontWeight: "bold",
    whiteSpace: "nowrap",
  },
  previewButtonDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  historyRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#111827",
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.10)",
  },
  historyThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    objectFit: "cover",
    flexShrink: 0,
  },
  historyThumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 12,
    background: "#1f2937",
    border: "1px solid rgba(148,163,184,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
    fontSize: 18,
    flexShrink: 0,
  },
  historyContent: {
    minWidth: 0,
    flex: 1,
  },
  historyTitle: {
    fontWeight: "bold",
    color: "#f8fafc",
    fontSize: 14,
  },
  historyArtist: {
    fontSize: 12,
    color: "#cbd5e1",
    marginTop: 2,
  },
  historyMeta: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 4,
  },
  liveQueueCard: {
    marginTop: 18,
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(148,163,184,0.14)",
    borderRadius: 16,
    padding: 10,
  },
  liveQueueHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  liveQueueTitle: {
    fontSize: 12,
    color: "#d1fae5",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  liveQueueCount: {
    fontSize: 12,
    color: "#94a3b8",
  },
  liveQueueList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  liveQueueItemRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    justifyContent: "space-between",
    background: "#111827",
    padding: "13px 12px 13px 2px",
    borderRadius: 16,
    boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
    border: "1px solid rgba(148,163,184,0.10)",
  },
  liveQueueOrderBox: {
    minWidth: 36,
    marginLeft: -2,
    marginRight: -2,
    userSelect: "none",
    alignSelf: "stretch",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  upArrowButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(15,23,42,0.9)",
    color: "#f8fafc",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
  },
  queueTopPlaceholder: {
    fontSize: 20,
    lineHeight: 1,
    color: "rgba(134,239,172,0.4)",
  },
  liveQueueMediaColumn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  liveQueueMeta: {
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 1.4,
    width: "100%",
    wordBreak: "break-word",
    textAlign: "center",
    marginTop: 6,
    paddingTop: 2,
  },
  liveQueueHint: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 10,
  },
  passFirstButtonUnderImage: {
    width: 58,
    padding: "8px 6px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "#0f172a",
    color: "#e2e8f0",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: 10,
    lineHeight: 1.2,
    textAlign: "center",
  },
  refreshButton: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "#0f172a",
    color: "#e2e8f0",
    cursor: "pointer",
    fontWeight: "bold",
    whiteSpace: "nowrap",
  },
  collapseButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "#0f172a",
    color: "#f8fafc",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: 18,
    flexShrink: 0,
  },
  nowPlayingCardActive: {
    border: "1px solid rgba(29,185,84,0.78)",
    boxShadow: "0 0 0 1px rgba(29,185,84,0.22), 0 14px 32px rgba(29,185,84,0.16)",
  },
  liveQueueItemAdded: {
    border: "1px solid rgba(59,130,246,0.55)",
    boxShadow: "0 0 0 1px rgba(59,130,246,0.18), 0 0 18px rgba(59,130,246,0.12)",
  },
  historyActionButton: {
    padding: "9px 11px",
    borderRadius: 10,
    border: "1px solid rgba(29,185,84,0.24)",
    background: "rgba(29,185,84,0.12)",
    color: "#d1fae5",
    cursor: "pointer",
    fontWeight: "bold",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  relaunchButton: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(59,130,246,0.24)",
    background: "rgba(59,130,246,0.12)",
    color: "#dbeafe",
    cursor: "pointer",
    fontWeight: "bold",
    width: "100%",
    marginTop: 10,
  },
  connectionStateBox: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(59,130,246,0.10)",
    border: "1px solid rgba(59,130,246,0.18)",
    color: "#dbeafe",
    fontSize: 12,
    fontWeight: "bold",
  },
  toast: {
    position: "fixed",
    left: "50%",
    bottom: 26,
    transform: "translateX(-50%)",
    background: "rgba(16, 185, 129, 0.95)",
    color: "white",
    padding: "12px 18px",
    borderRadius: 999,
    fontWeight: "bold",
    boxShadow: "0 12px 30px rgba(0,0,0,0.24)",
    zIndex: 1200,
  },
  popupHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  popupCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "#111827",
    color: "#f8fafc",
    cursor: "pointer",
    fontWeight: "bold",
  },
  popupMenuList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  popupMenuButton: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(15,23,42,0.82)",
    color: "#f8fafc",
    cursor: "pointer",
    fontWeight: "bold",
    textAlign: "left",
  },
  homeReturnModule: {
    display: "flex",
    justifyContent: "center",
    textDecoration: "none",
    marginTop: 18,
    marginBottom: 24,
    borderRadius: 24,
    padding: 18,
    background: "rgba(15,23,42,0.82)",
    border: "1px solid rgba(148,163,184,0.16)",
    boxShadow: "0 14px 40px rgba(0,0,0,0.24)",
    color: "#f8fafc",
  },
  homeReturnBadge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "bold",
    color: "#d1fae5",
    background: "rgba(29,185,84,0.12)",
    border: "1px solid rgba(29,185,84,0.18)",
    marginBottom: 14,
  },
  homeReturnTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
  },
  homeReturnText: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 1.6,
    marginBottom: 18,
  },
  homeReturnButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 18px",
    borderRadius: 14,
    background: "linear-gradient(135deg, #1DB954, #16a34a)",
    color: "#ffffff",
    fontWeight: "bold",
    boxShadow: "0 10px 22px rgba(29,185,84,0.24)",
  },
};
