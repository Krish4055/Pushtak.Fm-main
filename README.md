# Pushtak.fm — "Listen to Anything" Platform

> A calm, premium "listen to anything" web application and PWA designed for students and commuters. Turn any 500-page book, PDF, DOCX, TXT, or syllabus into natural audio chapters that never cut mid-sentence.

---

## 🚀 Gnani AI & Gemini Architecture

Pushtak.fm routes all AI model interactions through a secure server backend. **No API keys or sensitive credentials are ever exposed to the client browser.**

1. **Timbre v3.0 (TTS)**:
   - Endpoint: `POST https://api.vachana.ai/api/v1/tts/inference`
   - Header: `X-API-Key-ID: process.env.GNANI_API_KEY`
   - Model: `timbre-v3.0`
   - Output: 24,000 Hz, 1-channel, 16-bit linear PCM WAV.
   - Verified Voices: `Lakshmi` (default), `Vasudha`, `Shivani`, `Yashraj`, `Prakash`, `Avinash` (all speak all 10 Indian languages).
   - Audio Chunking & Joining: Chunks split at sentence boundaries to $\le 700$ characters, synthesized sequentially, PCM data concatenated, and returned as a single 44-byte WAV audio stream.
   - Cached in **IndexedDB** keyed by `hash(text + voice + language + speed)` to conserve API credits.

2. **Prisma v3.0 (STT)**:
   - Endpoint: `POST https://api.vachana.ai/stt/v3`
   - Header: `X-API-Key-ID: process.env.GNANI_API_KEY`
   - Model: `prisma-v3.0`, `language_code: indic-auto`
   - Client converts browser recordings to 16-bit mono WAV before sending, with automatic 30-second cutoff.

3. **Answers & Study Mode by Gemini**:
   - Grounded RAG Q&A strictly against retrieved book excerpts.
   - Generates 30-second recaps, 3-question interactive quizzes, and flashcards.

4. **Diagnostics Endpoint**:
   - `GET /api/diagnostics` runs a live test against both Timbre v3.0 and Prisma v3.0, reporting pass/fail, HTTP status, and error output.

---

## 📱 Spotify / YouTube Music Style Mobile Playback

Pushtak is built to behave like a native music streaming app on mobile devices:

1. **One Persistent Audio Element**:
   - A single `<audio id="pushtak-global-audio">` is created once and attached to the DOM.
   - Never creates new `Audio()` objects per chunk or section.
   - Ensures continuous background playback on mobile operating systems.

2. **Zero-Gap Track Transitions**:
   - While the current section plays, the NEXT section is synthesized, stitched, and cached in the background.
   - When the track ends or the user taps Next, the new source is loaded and played in the same event flow without dropping audio session focus.

3. **Full Media Session API (`navigator.mediaSession`)**:
   - **Metadata**: Title, artist (Book Title), album (`Pushtak`), and dynamically rendered 512x512 Canvas book cover artwork.
   - **Artwork Sizes**: 96x96, 128x128, 192x192, 256x256, 384x384, 512x512 PNGs.
   - **Action Handlers**: `play`, `pause`, `stop`, `seekbackward` (-15s), `seekforward` (+15s), `seekto` (scrubber), `previoustrack`, `nexttrack`.
   - **Position State**: Throttled to ~1 second for accurate lock-screen progress bar updates.
   - **Audio Interruption Resilience**: Automatically saves playback state on phone calls or headphone disconnection.

4. **Background & PWA Resilience**:
   - Position is persisted every 5 seconds, as well as on `visibilitychange`, `pagehide`, and `beforeunload`.
   - Wake Lock API is only engaged when the screen is visible and the user is actively reading along in text view.
   - When asking a question via voice, the book automatically pauses; once the answer is ready, a prominent "Resume book" action is presented.

---

## 🧪 Testing Notes & Instructions

### Prerequisites
Deploy to an **HTTPS** domain (or open the AI Studio Development/Preview HTTPS URL on your mobile device). Media Session, PWA Service Workers, and AudioContext require HTTPS.

### 1. Testing on Android (Chrome)
1. Open Pushtak on Chrome for Android over HTTPS.
2. Tap the Chrome menu (three dots) $\rightarrow$ **"Add to Home screen"** or **"Install app"**.
3. Open the installed Pushtak PWA from your home screen.
4. Tap **Play** on any book chapter.
5. Lock the phone screen.
6. Verify:
   - Lock screen displays the book title, section name, and dynamic terracotta cover artwork.
   - The scrubber progress bar advances accurately in real time.
   - Tapping **Pause / Play** on the lock screen immediately controls playback.
   - Tapping **Next / Previous** transitions cleanly to adjacent sections without waking the phone.
   - Pull down the Android notification shade: media notification controls work identically.
   - Connect Bluetooth earbuds (e.g. Galaxy Buds, Pixel Buds) $\rightarrow$ single-tap toggles pause/play, double-tap skips section.

### 2. Testing on iOS (Safari)
1. Open Pushtak in Safari on iPhone over HTTPS.
2. Tap the **Share** button $\rightarrow$ **"Add to Home Screen"**.
3. Launch Pushtak from your home screen.
4. Tap **Play** on a section.
5. Lock your iPhone or swipe up to go home.
6. Verify:
   - iOS Lock Screen / Dynamic Island displays the playback widget with the book cover and title.
   - Headphone controls (AirPods stem squeeze or Bluetooth button) toggle play/pause and skip tracks.

---

## ⚠️ Known Platform Limits

| Platform | Behavior & Limitation |
| :--- | :--- |
| **iOS Safari Lock Screen Widgets** | iOS displays either track skip buttons (`previoustrack`/`nexttrack`) or seek buttons (`seekbackward`/`seekforward`) on the compact lock screen widget based on system heuristic. In the full expanded widget, both are accessible. |
| **Mobile User Gesture Rule** | Both iOS and Android require an initial user tap before an app can play audio for the first time in a session. Once started, Pushtak maintains background session permissions across all section transitions without requiring further taps. |
| **Device Voice Fallback Mode** | If Gnani Timbre is temporarily unreachable and Pushtak falls back to device speech synthesis (`window.speechSynthesis`), OS lock-screen scrubbers and Bluetooth media controls are disabled by the OS, because speech synthesis does not expose a media session audio track. Pushtak shows an explicit toast when this fallback occurs. |
| **Low Power Mode / Battery Saver** | On aggressive battery saver settings, Android or iOS may suspend inactive background network tabs if no audio is actively playing. Pushtak overcomes this by pre-caching audio sections locally in IndexedDB before background playback begins. |
