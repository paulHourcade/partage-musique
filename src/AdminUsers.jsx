// UPDATED AdminUsers - replace forceLogoutUser with kick logic

const kickUserFromRoom = async (targetUserId) => {
  try {
    await updateDoc(doc(db, "rooms", roomCode, "members", targetUserId), {
      removedFromRoomAt: Date.now(),
      isConnected: false,
    });
    showToast("Utilisateur éjecté de la room");
  } catch (err) {
    console.error("kick user error:", err);
  }
};

// 👉 In renderUserItem replace button:

<button
  style={styles.disconnectButtonInline}
  onClick={(e) => {
    e.stopPropagation();
    kickUserFromRoom(user.id);
  }}
>
  Éjecter
</button>
