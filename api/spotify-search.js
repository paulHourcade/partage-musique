let cachedSpotifyToken = null;
let cachedSpotifyTokenExpiresAt = 0;

async function getSpotifyAccessToken() {
  const now = Date.now();

  // Réutilise le token s'il est encore valide
  if (
    cachedSpotifyToken &&
    cachedSpotifyTokenExpiresAt &&
    now < cachedSpotifyTokenExpiresAt
  ) {
    return cachedSpotifyToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Spotify environment variables");
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: "grant_type=client_credentials",
  });

  const tokenText = await tokenResponse.text();

  let tokenData;
  try {
    tokenData = JSON.parse(tokenText);
  } catch {
    throw new Error(`Spotify token parse error: ${tokenText.slice(0, 300)}`);
  }

  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(
      `Spotify token error: ${JSON.stringify(tokenData).slice(0, 300)}`
    );
  }

  const expiresInMs = (tokenData.expires_in || 3600) * 1000;

  // Marge de sécurité de 60 secondes
  cachedSpotifyToken = tokenData.access_token;
  cachedSpotifyTokenExpiresAt = now + expiresInMs - 60000;

  return cachedSpotifyToken;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const rawQuery = req.query?.q;
  const q = typeof rawQuery === "string" ? rawQuery.trim() : "";

  if (!q) {
    return res.status(400).json({
      error: "Missing query",
    });
  }

  try {
    const accessToken = await getSpotifyAccessToken();

    const spotifyUrl =
      `https://api.spotify.com/v1/search` +
      `?q=${encodeURIComponent(q)}` +
      `&type=track` +
      `&limit=8`;

    const spotifyResponse = await fetch(spotifyUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const spotifyText = await spotifyResponse.text();

    let spotifyData;
    try {
      spotifyData = JSON.parse(spotifyText);
    } catch {
      return res.status(500).json({
        error: "Spotify search parse error",
        status: spotifyResponse.status,
        raw: spotifyText.slice(0, 500),
      });
    }

    if (!spotifyResponse.ok) {
      return res.status(spotifyResponse.status).json({
        error: "Spotify search error",
        status: spotifyResponse.status,
        details: spotifyData,
      });
    }

    const items = Array.isArray(spotifyData?.tracks?.items)
      ? spotifyData.tracks.items
      : [];

    const formattedResults = items.map((track) => ({
      id: track.id || null,
      name: track.name || "",
      artists: Array.isArray(track.artists)
        ? track.artists.map((artist) => ({
            id: artist.id || null,
            name: artist.name || "",
          }))
        : [],
      album: {
        id: track.album?.id || null,
        name: track.album?.name || null,
        images: Array.isArray(track.album?.images)
          ? track.album.images.map((img) => ({
              url: img.url,
              width: img.width,
              height: img.height,
            }))
          : [],
      },
      duration_ms: track.duration_ms || 0,
      explicit: Boolean(track.explicit),
      preview_url: track.preview_url || null,
      external_urls: {
        spotify: track.external_urls?.spotify || null,
      },
      uri: track.uri || null,
    }));

    return res.status(200).json(formattedResults);
  } catch (err) {
    console.error("spotify-search api error:", err);

    return res.status(500).json({
      error: "Server error",
      message: err.message || "Unknown server error",
    });
  }
}
