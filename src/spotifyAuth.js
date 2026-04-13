const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = "https://partage-musique.vercel.app";
const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
];

function generateRandomString(length) {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest("SHA-256", data);
}

function base64encode(input) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function loginWithSpotify() {
  if (!CLIENT_ID) {
    throw new Error("VITE_SPOTIFY_CLIENT_ID manquant");
  }

  const verifier = generateRandomString(64);
  const challenge = base64encode(await sha256(verifier));
  const state = generateRandomString(16);

  localStorage.setItem("spotify_code_verifier", verifier);
  localStorage.setItem("spotify_auth_state", state);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
    scope: SCOPES.join(" "),
  });

  console.log("Spotify authorize redirect_uri =", REDIRECT_URI);
  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function handleSpotifyCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  if (error) {
    throw new Error(`Spotify auth error: ${error}`);
  }

  if (!code) return null;

  const savedState = localStorage.getItem("spotify_auth_state");
  const verifier = localStorage.getItem("spotify_code_verifier");

  if (!state || state !== savedState) {
    throw new Error("État OAuth invalide");
  }

  if (!verifier) {
    throw new Error("Code verifier manquant");
  }

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });

  console.log("Spotify token redirect_uri =", REDIRECT_URI);

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Spotify token error data:", data);
    throw new Error(
      data.error_description || data.error || "Impossible de récupérer le token Spotify"
    );
  }

  localStorage.setItem("spotify_access_token", data.access_token);

  if (data.refresh_token) {
    localStorage.setItem("spotify_refresh_token", data.refresh_token);
  }

  if (data.expires_in) {
    const expiresAt = Date.now() + data.expires_in * 1000;
    localStorage.setItem("spotify_expires_at", String(expiresAt));
  }

  window.history.replaceState({}, document.title, window.location.pathname);

  return data.access_token;
}

export function getSpotifyAccessToken() {
  return localStorage.getItem("spotify_access_token");
}

export function logoutSpotify() {
  localStorage.removeItem("spotify_access_token");
  localStorage.removeItem("spotify_refresh_token");
  localStorage.removeItem("spotify_expires_at");
  localStorage.removeItem("spotify_code_verifier");
  localStorage.removeItem("spotify_auth_state");
}

export async function fetchSpotifyProfile(token) {
  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data.error?.message || "Impossible de récupérer le profil Spotify"
    );
  }

  return data;
}
