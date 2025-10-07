// PKCE helper for Spotify Authorization Code with PKCE
import * as Crypto from 'expo-crypto';
import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';

// Ensure web browser session is properly finalized on web only
try {
  if (Platform.OS === 'web') {
    // Dynamic require to avoid native module resolution on Android/iOS when runtime not ready
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const WebBrowser = require('expo-web-browser');
    WebBrowser?.maybeCompleteAuthSession?.();
  }
} catch (e) {
  // No-op: module may be unavailable during initial runtime; safe to ignore on native
}

// Generates a random code verifier
export async function generateCodeVerifier(length = 64) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let value = '';
  for (let i = 0; i < length; i++) {
    value += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return value;
}

export async function sha256Base64(input) {
  // Return base64 encoded SHA256 digest of input
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    input,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
}

export async function buildAuthorizeUrl({ clientId, redirectUri, scopes }) {
  const codeVerifier = await generateCodeVerifier();
  const digestBase64 = await sha256Base64(codeVerifier);
  const codeChallenge = digestBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    scope: scopes.join(' ')
  });
  return { url: `https://accounts.spotify.com/authorize?${params.toString()}`, codeVerifier };
}

export async function openAuthSession(authUrl, redirectUri) {
  const result = await AuthSession.startAsync({ authUrl, returnUrl: redirectUri });
  return result;
}
