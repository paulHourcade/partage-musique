export default async function handler(req, res) {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: "Missing query" });
  }

  try {
    const tokenResponse = await fetch(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(
              process.env.SPOTIFY_CLIENT_ID +
                ":" +
                process.env.SPOTIFY_CLIENT_SECRET
            ).toString("base64"),
        },
        body: "grant_type=client_credentials",
      }
    );

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(500).json({ error: "No access token" });
    }

    const spotifyRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=5`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data = await spotifyRes.json();

    return res.status(200).json(data.tracks?.items || []);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Spotify error" });
  }
}