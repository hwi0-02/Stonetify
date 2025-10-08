# 🔥 CRITICAL FIX: Track Playback 400 Error

## 🐛 Root Cause Identified

The 400 error was caused by **multiple layers of ID confusion**:

1. **Backend search endpoint** returned tracks with only `id` field, NOT `spotify_id`
2. **Frontend normalization** checked `track.id` BEFORE `track.spotify_id`
3. **Database songs** stored both Firebase `id` (e.g., `-O_Pc65ffydCDpn619cc`) and `spotify_id`
4. **Adapter** tried to construct URIs from Firebase IDs instead of Spotify IDs

## ✅ Complete Fix Applied

### 1. Backend: spotifyController.js - Search Results
**Problem:** Search results missing `spotify_id` field
```javascript
// BEFORE ❌
const tracks = response.data.tracks.items.map(item => ({
  id: item.id,
  name: item.name,
  artists: item.artists.map(artist => artist.name).join(', '),
  // ... missing spotify_id
}));

// AFTER ✅
const tracks = response.data.tracks.items.map(item => ({
  id: item.id,
  spotify_id: item.id,  // Explicit spotify_id field
  name: item.name,
  artist: item.artists.map(artist => artist.name).join(', '),  // Changed to 'artist' (singular)
  album: item.album.name,
  album_cover_url: item.album.images[1]?.url || item.album.images[0]?.url,
  preview_url: item.preview_url,
  duration_ms: item.duration_ms,  // Added
  uri: item.uri,  // Added Spotify URI
  external_url: item.external_urls?.spotify  // Added
}));
```

### 2. Frontend: playerSlice.js - ID Priority
**Problem:** Firebase ID chosen over Spotify ID
```javascript
// BEFORE ❌
const getTrackId = (track) => track?.id ?? track?.spotify_id ?? ...

// AFTER ✅
const getTrackId = (track) => track?.spotify_id ?? track?.spotifyId ?? track?.id ?? ...
```

### 3. Frontend: adapters/index.js - RestRemoteAdapter
**Problem:** Using track.id without filtering Firebase IDs
```javascript
// BEFORE ❌
const uris = track.uri ? [track.uri] : (track.id ? [`spotify:track:${track.id}`] : []);

// AFTER ✅
const spotifyId = track.spotify_id || track.spotifyId || (track.id && !track.id.startsWith('-') ? track.id : null);
const uris = track.uri ? [track.uri] : (spotifyId ? [`spotify:track:${spotifyId}`] : []);

// Added validation
if (uris[0].includes('-O_') || uris[0].startsWith('spotify:track:-')) {
  throw new Error(`Invalid track ID format detected: ${uris[0]}`);
}
```

### 4. Backend: playbackHistoryController.js - ID Validation
```javascript
// Added Spotify ID format validation
const isSpotifyUri = track.id?.startsWith('spotify:track:');
const isSpotifyId = /^[a-zA-Z0-9]{22}$/.test(track.id);

if (!isSpotifyUri && !isSpotifyId) {
  throw new Error(`Invalid Spotify track ID format: ${track.id}`);
}
```

### 5. Backend: spotifyPlaybackController.js - URI Validation
```javascript
// Validate URIs before sending to Spotify API
if (uris && Array.isArray(uris)) {
  for (const uri of uris) {
    if (!uri.startsWith('spotify:track:') && !uri.startsWith('spotify:episode:')) {
      return res.status(400).json({ message: 'Invalid Spotify URI format' });
    }
    
    // Check for Firebase ID patterns
    const trackId = uri.split(':')[2];
    if (trackId && (trackId.startsWith('-') || trackId.includes('_'))) {
      return res.status(400).json({ message: 'Firebase ID detected in URI' });
    }
  }
}
```

### 6. Enhanced Logging
Added comprehensive logging throughout:
- ✅ `playerSlice.js` - normalizeTrack() logs ID extraction
- ✅ `playlistSlice.js` - Warns if songs missing spotify_id
- ✅ `adapters/index.js` - Logs track details before API calls
- ✅ `song.js` - Warns if database songs missing spotify_id
- ✅ `spotifyPlaybackController.js` - Logs all play requests

## 🧪 Testing Instructions

1. **Restart Backend:**
   ```powershell
   cd Backend
   npm start
   ```

2. **Restart Frontend:**
   ```powershell
   cd Frontend
   npm start
   # Or restart Expo Go app
   ```

3. **Test Flow:**
   - Open app and search for a song
   - Add song to a playlist
   - Navigate to playlist
   - Click on the song to play it
   - **Check console logs** for detailed info

4. **Expected Console Output:**
   ```
   🔄 [normalizeTrack] { originalId: '6rqhFgbbKwnb9MLmUQDhG6', spotifyId: '6rqhFgbbKwnb9MLmUQDhG6', ... }
   🎵 [RestRemoteAdapter] Loading track: { spotifyId: '6rqhFgbbKwnb9MLmUQDhG6', finalUris: ['spotify:track:6rqhFgbbKwnb9MLmUQDhG6'] }
   📤 [Playback][play] Sending to Spotify API: { uris: ['spotify:track:6rqhFgbbKwnb9MLmUQDhG6'] }
   ✅ [Playback][play] Success
   ```

## 🚫 Error Scenarios Handled

| Error Message | Meaning | Solution |
|--------------|---------|----------|
| `Invalid track ID format detected: spotify:track:-O_xxx` | Firebase ID in URI | Frontend validation catches this |
| `Firebase ID detected in URI` | Backend detected invalid ID | Backend validation rejects request |
| `Invalid Spotify track ID format: -O_xxx` | Non-Spotify ID sent to playback history | Backend validates format |
| `Track missing valid Spotify URI/ID` | Track has no usable ID | Check if spotify_id exists in DB |

## 📊 Data Flow

```
Search (Spotify API)
  ↓ spotify_id included
Frontend (SearchScreen)
  ↓ song.spotify_id
Backend (addSongToPlaylist)
  ↓ Creates Song with spotify_id
Database (songs table)
  ↓ Has both: id (Firebase) + spotify_id (Spotify)
Frontend (PlaylistDetailScreen)
  ↓ Receives songs with spotify_id
PlayerSlice (normalizeTrack)
  ↓ Extracts spotify_id (prioritized)
RestRemoteAdapter
  ↓ Constructs spotify:track:{spotify_id}
Backend (spotifyPlaybackController)
  ↓ Validates URI format
Spotify API
  ✅ Success!
```

## 🔍 Debugging Checklist

If 400 error still occurs, check:

- [ ] Console shows `🔄 [normalizeTrack]` with valid spotifyId
- [ ] Console shows `🎵 [RestRemoteAdapter]` with finalUris containing 22-char ID
- [ ] Backend logs show `📤 [Playback][play]` with valid URIs
- [ ] No `⚠️` warnings about missing spotify_id
- [ ] Database songs have both `id` and `spotify_id` fields
- [ ] Search results include `spotify_id` field

## 📝 Files Modified

**Backend:**
- `controllers/spotifyController.js` - Added spotify_id to search results
- `controllers/spotifyPlaybackController.js` - Added URI validation
- `controllers/playbackHistoryController.js` - Added ID format validation
- `models/song.js` - Added missing spotify_id warning

**Frontend:**
- `store/slices/playerSlice.js` - Changed ID priority, added logging
- `store/slices/playlistSlice.js` - Added spotify_id validation logging
- `adapters/index.js` - Fixed ID extraction, added validation

## ✨ Result

- ✅ Songs from search now include `spotify_id`
- ✅ Tracks prioritize `spotify_id` over Firebase `id`
- ✅ Invalid IDs caught at multiple layers
- ✅ Clear error messages for debugging
- ✅ Comprehensive logging for troubleshooting
