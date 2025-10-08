# Track ID 400 Error Fix Summary

## Problem
When attempting to play tracks from playlists, the app was sending Firebase internal IDs (e.g., `-O_Pc65ffydCDpn619cc`) to Spotify's API, which only accepts 22-character alphanumeric Spotify track IDs or `spotify:track:<id>` URIs.

## Root Cause
The `getTrackId()` helper function in `playerSlice.js` was checking `track.id` before `track.spotify_id`. Since database song records have both:
- `id`: Firebase push key (starts with `-`)
- `spotify_id`: Actual Spotify track ID (22 alphanumeric chars)

The function was incorrectly picking the Firebase ID.

## Changes Made

### Frontend Changes

#### 1. `store/slices/playerSlice.js` - Line 38
**Changed ID extraction priority:**
```javascript
// BEFORE (incorrect - picks Firebase ID first)
const getTrackId = (track) => track?.id ?? track?.spotify_id ?? ...

// AFTER (correct - picks Spotify ID first)
const getTrackId = (track) => track?.spotify_id ?? track?.spotifyId ?? track?.id ?? ...
```

#### 2. `store/slices/playerSlice.js` - Line 39-48 (normalizeTrack function)
**Added automatic Spotify URI construction:**
```javascript
const normalizeTrack = (track) => {
  if (!track) return null;
  const id = getTrackId(track);
  const previewUrl = track.preview_url ?? track.previewUrl ?? track.previewURL ?? track.preview;
  let uri = track.uri ?? track.spotify_uri ?? track.spotifyUri ?? track.spotifyURI ?? null;
  
  // NEW: Construct Spotify URI from ID if missing
  if (!uri && id && !id.startsWith('-')) {
    uri = id.startsWith('spotify:') ? id : `spotify:track:${id}`;
  }
  
  return {
    ...track,
    id: id ?? track?.id ?? null,
    preview_url: previewUrl ?? null,
    uri,
  };
};
```

### Backend Changes

#### 3. `controllers/playbackHistoryController.js` - validateTrack function
**Added Spotify ID format validation:**
```javascript
function validateTrack(track){
  if(!track || !track.id || !track.name) throw new Error('track.id and track.name required');
  
  // NEW: Validate Spotify ID format
  const isSpotifyUri = track.id?.startsWith('spotify:track:');
  const isSpotifyId = /^[a-zA-Z0-9]{22}$/.test(track.id);
  
  if (!isSpotifyUri && !isSpotifyId) {
    throw new Error(`Invalid Spotify track ID format: ${track.id}. Expected 22-char alphanumeric ID or spotify:track: URI`);
  }
}
```

#### 4. `controllers/spotifyPlaybackController.js` - exports.play
**Added URI format validation before API calls:**
```javascript
exports.play = async (req,res) => {
  try {
    const userId = await getUserId(req);
    const { uris, context_uri, position_ms, device_id } = req.body || {};
    
    // NEW: Validate Spotify URI format
    if (uris && Array.isArray(uris)) {
      for (const uri of uris) {
        if (!uri.startsWith('spotify:track:')) {
          return res.status(400).json({ 
            message: `Invalid Spotify URI format: ${uri}. Expected spotify:track:<id>` 
          });
        }
      }
    }
    
    // ... rest of function
  }
}
```

## Enhanced Logging Added

To diagnose the 400 error issue, extensive logging has been added:

**Frontend:**
- `playerSlice.js` - `normalizeTrack()` logs original ID, spotify_id, extracted ID, and URI
- `playlistSlice.js` - Logs received songs and warns if spotify_id is missing
- `adapters/index.js` - `RestRemoteAdapter.load()` logs track details and validates URIs

**Backend:**
- `song.js` - Warns when songs are missing spotify_id field
- `spotifyPlaybackController.js` - Logs all play requests and validates URI format

## Debugging Steps

1. **Restart both frontend and backend:**
   ```powershell
   # In Backend terminal
   npm start
   
   # In Frontend terminal (or restart Expo Go)
   npm start
   ```

2. **Try to play a song and check console logs:**
   - Look for `🔄 [normalizeTrack]` - shows if spotify_id is extracted correctly
   - Look for `🎵 [RestRemoteAdapter]` - shows final URI being sent
   - Look for `📤 [Playback][play]` - shows data sent to Spotify API
   - Look for `⚠️` warnings - indicates missing spotify_id in database

3. **Common Issues:**
   - If logs show `originalId: "-O_xxx"` but `spotifyId: null` → Database songs missing spotify_id field
   - If logs show `finalUris: ["spotify:track:-O_xxx"]` → Track normalization failed
   - If backend shows `Firebase ID detected in URI` → Frontend validation failed

## Testing
1. Restart the frontend app (close Expo Go and restart)
2. Navigate to any playlist
3. Click on a song to play it
4. **Check console/terminal logs for detailed debugging info**
5. Verify that playback starts without 400 errors

## Expected Behavior
- ✅ Tracks from database playlists should now play correctly
- ✅ Spotify API receives valid track IDs/URIs (22 alphanumeric chars)
- ✅ Backend validates and rejects invalid ID formats early
- ✅ Clear error messages if invalid IDs are detected
- ✅ Detailed console logs show data flow through the system

## ID Format Reference
| Type | Format | Example | Valid for Spotify API? |
|------|--------|---------|----------------------|
| Spotify Track ID | 22 alphanumeric chars | `6rqhFgbbKwnb9MLmUQDhG6` | ✅ Yes |
| Spotify Track URI | `spotify:track:<id>` | `spotify:track:6rqhFgbbKwnb9MLmUQDhG6` | ✅ Yes |
| Firebase ID | Push key (starts with `-`) | `-O_Pc65ffydCDpn619cc` | ❌ No |

## Related Files
- `Frontend/store/slices/playerSlice.js`
- `Backend/controllers/playbackHistoryController.js`
- `Backend/controllers/spotifyPlaybackController.js`
- `Backend/models/song.js`
