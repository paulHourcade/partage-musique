// UPDATED MusicApp with kick-from-room handling
// Only showing modified parts for brevity - integrate into your file

// 🔁 Replace your force logout listener useEffect with this:

useEffect(() => {
  if (!userId) return;

  let handled = false;

  const unsub = onSnapshot(currentUserDocRef, async (snapshot) => {
    if (!snapshot.exists()) return;

    const data = snapshot.data();

    // 👉 NEW: kick from room
    if (data?.removedFromRoomAt && !handled) {
      handled = true;

      try {
        await updateDoc(currentUserDocRef, {
          removedFromRoomAt: null,
          isConnected: false,
        });
      } catch (err) {
        console.error("kick cleanup error:", err);
      }

      // ❗ on garde username et userId
      localStorage.removeItem("currentRoomCode");
      localStorage.removeItem("activeRoomId");
      localStorage.removeItem("activeRoomCode");

      // cache spécifique room
      localStorage.removeItem(`sharedQueueCache:${roomCode}`);

      window.location.href = "/";
    }

    // existing force logout kept if needed
    if (data?.forceLogoutAt && !handled) {
      handled = true;

      localStorage.removeItem("username");
      localStorage.removeItem("isSpotifyAdmin");

      window.location.href = "/";
    }
  });

  return () => unsub();
}, [currentUserDocRef, userId, roomCode]);
