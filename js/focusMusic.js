/* ============================================================
   THRIVE — Focus Music Engine
   Ambient sounds & user tracks for deep focus sessions
   ============================================================ */

const FocusMusic = (() => {

    // === GENRE LIBRARY ===
    const GENRES = [
        { id: 'rain',       name: 'Rain',        emoji: '🌧️', color: '#3B82F6' },
        { id: 'ocean',      name: 'Ocean Waves',  emoji: '🌊', color: '#06B6D4' },
        { id: 'forest',     name: 'Forest',       emoji: '🌲', color: '#10B981' },
        { id: 'wind',       name: 'Gentle Wind',  emoji: '🍃', color: '#84CC16' },
        { id: 'campfire',   name: 'Campfire',      emoji: '🔥', color: '#F59E0B' },
        { id: 'piano',      name: 'Soft Piano',    emoji: '🎹', color: '#8B5CF6' },
        { id: 'night',      name: 'Night Crickets',emoji: '🌙', color: '#6366F1' },
        { id: 'brown',      name: 'Brown Noise',   emoji: '🟤', color: '#92400E' },
        { id: 'white',      name: 'White Noise',   emoji: '⚪', color: '#9CA3AF' },
        { id: 'lofi',       name: 'Lo-Fi Beats',   emoji: '🎧', color: '#EC4899' },
        { id: 'thunder',    name: 'Thunder Storm',emoji: '⛈️', color: '#4338CA' },
        { id: 'birds',      name: 'Bird Song',     emoji: '🐦', color: '#22C55E' },
        { id: 'cafe',       name: 'Coffee Shop',   emoji: '☕', color: '#A16207' },
        { id: 'zen',        name: 'Zen Garden',    emoji: '🧘', color: '#14B8A6' },
    ];

    // === STATE ===
    let _audioCtx = null;
    let _currentGenre = null;
    let _currentTrack = null; // { type: 'ambient' | 'user', id, name, genre }
    let _isPlaying = false;
    let _volume = 0.5;
    let _ambientNodes = []; // active audio nodes for ambient
    let _userAudio = null;  // HTMLAudioElement for user tracks
    let _userTracks = [];   // loaded from IndexedDB
    let _currentUserIdx = -1;
    let _panelOpen = false;
    let _libraryOpen = false;
    let _activeView = 'player'; // 'player' | 'library' | 'upload'
    let _loopTimeout = null;
    let _fadeInterval = null;

    // === INIT ===
    function init() {
        renderMusicButton();
        wireEvents();
        loadUserTracks();
    }

    // === AUDIO CONTEXT ===
    function getCtx() {
        if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (_audioCtx.state === 'suspended') _audioCtx.resume();
        return _audioCtx;
    }

    // === PROCEDURAL AMBIENT SOUND GENERATORS ===
    function createNoiseBuffer(ctx, type = 'white', durationSec = 4) {
        const sr = ctx.sampleRate;
        const len = sr * durationSec;
        const buf = ctx.createBuffer(2, len, sr);
        for (let ch = 0; ch < 2; ch++) {
            const data = buf.getChannelData(ch);
            let last = 0;
            for (let i = 0; i < len; i++) {
                const white = Math.random() * 2 - 1;
                if (type === 'brown') {
                    last = (last + (0.02 * white)) / 1.02;
                    data[i] = last * 3.5;
                } else if (type === 'pink') {
                    // Voss-McCartney approximation
                    last = last * 0.95 + white * 0.05;
                    data[i] = (last + white) * 0.5;
                } else {
                    data[i] = white;
                }
            }
        }
        return buf;
    }

    function startAmbient(genreId) {
        stopAmbient();
        const ctx = getCtx();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.connect(ctx.destination);

        switch (genreId) {
            case 'rain': buildRain(ctx, gain); break;
            case 'ocean': buildOcean(ctx, gain); break;
            case 'forest': buildForest(ctx, gain); break;
            case 'wind': buildWind(ctx, gain); break;
            case 'campfire': buildCampfire(ctx, gain); break;
            case 'piano': buildPiano(ctx, gain); break;
            case 'night': buildNight(ctx, gain); break;
            case 'brown': buildNoise(ctx, gain, 'brown'); break;
            case 'white': buildNoise(ctx, gain, 'white'); break;
            case 'lofi': buildLofi(ctx, gain); break;
            case 'thunder': buildThunder(ctx, gain); break;
            case 'birds': buildBirds(ctx, gain); break;
            case 'cafe': buildCafe(ctx, gain); break;
            case 'zen': buildZen(ctx, gain); break;
            default: buildNoise(ctx, gain, 'white');
        }

        // Fade in
        gain.gain.linearRampToValueAtTime(_volume, ctx.currentTime + 2);
        _ambientNodes.push({ gain });
    }

    function buildRain(ctx, masterGain) {
        const buf = createNoiseBuffer(ctx, 'pink', 4);
        const src = ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 800;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 200;
        src.connect(hp).connect(lp).connect(masterGain);
        src.start();
        _ambientNodes.push({ src });

        // Drip layer
        const buf2 = createNoiseBuffer(ctx, 'white', 2);
        const src2 = ctx.createBufferSource();
        src2.buffer = buf2; src2.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q.value = 3;
        const g2 = ctx.createGain(); g2.gain.value = 0.15;
        src2.connect(bp).connect(g2).connect(masterGain);
        src2.start();
        _ambientNodes.push({ src: src2 });
    }

    function buildOcean(ctx, masterGain) {
        const buf = createNoiseBuffer(ctx, 'brown', 6);
        const src = ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 400;
        const lfo = ctx.createOscillator();
        lfo.type = 'sine'; lfo.frequency.value = 0.08;
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 250;
        lfo.connect(lfoGain).connect(lp.frequency);
        lfo.start();
        src.connect(lp).connect(masterGain);
        src.start();
        _ambientNodes.push({ src, lfo });
    }

    function buildForest(ctx, masterGain) {
        // Wind base
        const buf = createNoiseBuffer(ctx, 'pink', 4);
        const src = ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 600;
        const g1 = ctx.createGain(); g1.gain.value = 0.6;
        src.connect(lp).connect(g1).connect(masterGain);
        src.start();
        _ambientNodes.push({ src });

        // Bird chirps (periodic)
        scheduleBirds(ctx, masterGain);
    }

    function scheduleBirds(ctx, masterGain) {
        function chirp() {
            if (!_isPlaying || _currentGenre !== 'forest') return;
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            const baseFreq = 2000 + Math.random() * 3000;
            osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.4, ctx.currentTime + 0.08);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, ctx.currentTime + 0.15);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, ctx.currentTime);
            g.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.02);
            g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
            osc.connect(g).connect(masterGain);
            osc.start(); osc.stop(ctx.currentTime + 0.25);
            _loopTimeout = setTimeout(chirp, 1500 + Math.random() * 4000);
        }
        _loopTimeout = setTimeout(chirp, 500);
    }

    function buildWind(ctx, masterGain) {
        const buf = createNoiseBuffer(ctx, 'brown', 4);
        const src = ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 500;
        const lfo = ctx.createOscillator();
        lfo.type = 'sine'; lfo.frequency.value = 0.15;
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 300;
        lfo.connect(lfoGain).connect(lp.frequency);
        lfo.start();
        src.connect(lp).connect(masterGain);
        src.start();
        _ambientNodes.push({ src, lfo });
    }

    function buildCampfire(ctx, masterGain) {
        const buf = createNoiseBuffer(ctx, 'white', 2);
        const src = ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1.5;
        const g1 = ctx.createGain(); g1.gain.value = 0.3;
        src.connect(bp).connect(g1).connect(masterGain);
        src.start();
        _ambientNodes.push({ src });

        // Crackle layer
        const buf2 = createNoiseBuffer(ctx, 'white', 1);
        const src2 = ctx.createBufferSource();
        src2.buffer = buf2; src2.loop = true;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 3000;
        const g2 = ctx.createGain(); g2.gain.value = 0.08;
        src2.connect(hp).connect(g2).connect(masterGain);
        src2.start();
        _ambientNodes.push({ src: src2 });
    }

    function buildPiano(ctx, masterGain) {
        // Algorithmic gentle piano melody
        const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25]; // C4-C5
        const melodies = [
            [0, 4, 2, 5, 3, 7, 4, 2],
            [7, 5, 3, 4, 2, 0, 4, 5],
            [2, 4, 5, 7, 5, 4, 2, 0],
            [4, 7, 5, 2, 0, 4, 7, 5],
        ];
        let melIdx = 0;
        function playMelody() {
            if (!_isPlaying || _currentGenre !== 'piano') return;
            const melody = melodies[melIdx % melodies.length]; melIdx++;
            melody.forEach((noteIdx, i) => {
                const t = ctx.currentTime + i * 1.8;
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = notes[noteIdx];
                const env = ctx.createGain();
                env.gain.setValueAtTime(0, t);
                env.gain.linearRampToValueAtTime(0.12, t + 0.05);
                env.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
                osc.connect(env).connect(masterGain);
                osc.start(t); osc.stop(t + 1.7);
            });
            _loopTimeout = setTimeout(playMelody, melody.length * 1800 + 1000);
        }
        // Soft pad beneath
        const buf = createNoiseBuffer(ctx, 'brown', 4);
        const src = ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 200;
        const g = ctx.createGain(); g.gain.value = 0.2;
        src.connect(lp).connect(g).connect(masterGain);
        src.start();
        _ambientNodes.push({ src });
        playMelody();
    }

    function buildNight(ctx, masterGain) {
        // Base dark ambient
        const buf = createNoiseBuffer(ctx, 'brown', 4);
        const src = ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 300;
        const g = ctx.createGain(); g.gain.value = 0.5;
        src.connect(lp).connect(g).connect(masterGain);
        src.start();
        _ambientNodes.push({ src });

        // Cricket chirps
        function cricket() {
            if (!_isPlaying || _currentGenre !== 'night') return;
            const freq = 4000 + Math.random() * 1500;
            for (let j = 0; j < 3 + Math.floor(Math.random()*4); j++) {
                const osc = ctx.createOscillator();
                osc.type = 'sine'; osc.frequency.value = freq;
                const eg = ctx.createGain();
                const t = ctx.currentTime + j * 0.06;
                eg.gain.setValueAtTime(0, t);
                eg.gain.linearRampToValueAtTime(0.03, t + 0.01);
                eg.gain.linearRampToValueAtTime(0, t + 0.04);
                osc.connect(eg).connect(masterGain);
                osc.start(t); osc.stop(t + 0.05);
            }
            _loopTimeout = setTimeout(cricket, 800 + Math.random() * 2500);
        }
        _loopTimeout = setTimeout(cricket, 300);
    }

    function buildNoise(ctx, masterGain, type) {
        const buf = createNoiseBuffer(ctx, type, 4);
        const src = ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        src.connect(masterGain);
        src.start();
        _ambientNodes.push({ src });
    }

    function buildLofi(ctx, masterGain) {
        // Mellow beat
        const kickFreqs = [80, 60];
        function beat() {
            if (!_isPlaying || _currentGenre !== 'lofi') return;
            // Kick
            const osc = ctx.createOscillator();
            osc.frequency.setValueAtTime(150, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.2);
            const eg = ctx.createGain();
            eg.gain.setValueAtTime(0.25, ctx.currentTime);
            eg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.connect(eg).connect(masterGain);
            osc.start(); osc.stop(ctx.currentTime + 0.35);

            // Hi-hat
            setTimeout(() => {
                if (!_isPlaying) return;
                const buf = createNoiseBuffer(ctx, 'white', 0.1);
                const s = ctx.createBufferSource(); s.buffer = buf;
                const hp = ctx.createBiquadFilter();
                hp.type = 'highpass'; hp.frequency.value = 8000;
                const g = ctx.createGain();
                g.gain.setValueAtTime(0.05, ctx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
                s.connect(hp).connect(g).connect(masterGain);
                s.start(); s.stop(ctx.currentTime + 0.1);
            }, 400);

            _loopTimeout = setTimeout(beat, 900); // ~67 BPM
        }
        // Vinyl crackle
        const buf = createNoiseBuffer(ctx, 'white', 3);
        const src = ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 0.5;
        const g = ctx.createGain(); g.gain.value = 0.04;
        src.connect(bp).connect(g).connect(masterGain);
        src.start();
        _ambientNodes.push({ src });
        beat();

        // Chord pad
        const chords = [[261.63, 329.63, 392.00], [293.66, 349.23, 440.00], [329.63, 392.00, 493.88]];
        let ci = 0;
        function chord() {
            if (!_isPlaying || _currentGenre !== 'lofi') return;
            const c = chords[ci % chords.length]; ci++;
            c.forEach(f => {
                const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
                const e = ctx.createGain();
                e.gain.setValueAtTime(0, ctx.currentTime);
                e.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.3);
                e.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 3);
                e.gain.linearRampToValueAtTime(0, ctx.currentTime + 4);
                o.connect(e).connect(masterGain);
                o.start(); o.stop(ctx.currentTime + 4.2);
            });
            _loopTimeout = setTimeout(chord, 3600);
        }
        chord();
    }

    function buildThunder(ctx, masterGain) {
        // Heavy rain base
        buildRain(ctx, masterGain);
        // Periodic thunder rumble
        function rumble() {
            if (!_isPlaying || _currentGenre !== 'thunder') return;
            const buf = createNoiseBuffer(ctx, 'brown', 3);
            const src = ctx.createBufferSource(); src.buffer = buf;
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass'; lp.frequency.value = 150;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, ctx.currentTime);
            g.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 0.1);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3);
            src.connect(lp).connect(g).connect(masterGain);
            src.start(); src.stop(ctx.currentTime + 3.5);
            _loopTimeout = setTimeout(rumble, 8000 + Math.random() * 15000);
        }
        _loopTimeout = setTimeout(rumble, 3000);
    }

    function buildBirds(ctx, masterGain) {
        // Light wind
        const buf = createNoiseBuffer(ctx, 'pink', 4);
        const src = ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 400;
        const g = ctx.createGain(); g.gain.value = 0.3;
        src.connect(lp).connect(g).connect(masterGain);
        src.start();
        _ambientNodes.push({ src });
        // Multiple birds
        function bird() {
            if (!_isPlaying || _currentGenre !== 'birds') return;
            const calls = Math.floor(2 + Math.random() * 3);
            for (let i = 0; i < calls; i++) {
                const t = ctx.currentTime + i * (0.12 + Math.random() * 0.1);
                const f = 1800 + Math.random() * 4000;
                const osc = ctx.createOscillator(); osc.type = 'sine';
                osc.frequency.setValueAtTime(f, t);
                osc.frequency.exponentialRampToValueAtTime(f * (1 + Math.random() * 0.6), t + 0.06);
                osc.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.12);
                const eg = ctx.createGain();
                eg.gain.setValueAtTime(0, t);
                eg.gain.linearRampToValueAtTime(0.05, t + 0.015);
                eg.gain.linearRampToValueAtTime(0, t + 0.15);
                osc.connect(eg).connect(masterGain);
                osc.start(t); osc.stop(t + 0.18);
            }
            _loopTimeout = setTimeout(bird, 1000 + Math.random() * 3000);
        }
        _loopTimeout = setTimeout(bird, 200);
    }

    function buildCafe(ctx, masterGain) {
        // Brown noise murmur
        const buf = createNoiseBuffer(ctx, 'brown', 4);
        const src = ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.8;
        const g = ctx.createGain(); g.gain.value = 0.6;
        src.connect(bp).connect(g).connect(masterGain);
        src.start();
        _ambientNodes.push({ src });

        // Cup clink
        function clink() {
            if (!_isPlaying || _currentGenre !== 'cafe') return;
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 3500 + Math.random() * 2000;
            const eg = ctx.createGain();
            eg.gain.setValueAtTime(0.06, ctx.currentTime);
            eg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            osc.connect(eg).connect(masterGain);
            osc.start(); osc.stop(ctx.currentTime + 0.2);
            _loopTimeout = setTimeout(clink, 4000 + Math.random() * 8000);
        }
        _loopTimeout = setTimeout(clink, 2000);
    }

    function buildZen(ctx, masterGain) {
        // Tibetan bowl (sine with slow decay)
        const freqs = [174.61, 261.63, 329.63, 392.00, 523.25];
        let bi = 0;
        function bowl() {
            if (!_isPlaying || _currentGenre !== 'zen') return;
            const f = freqs[bi % freqs.length]; bi++;
            const osc = ctx.createOscillator();
            osc.type = 'sine'; osc.frequency.value = f;
            const osc2 = ctx.createOscillator();
            osc2.type = 'sine'; osc2.frequency.value = f * 2.01; // slight detune
            const eg = ctx.createGain();
            eg.gain.setValueAtTime(0, ctx.currentTime);
            eg.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.1);
            eg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 8);
            const eg2 = ctx.createGain();
            eg2.gain.setValueAtTime(0, ctx.currentTime);
            eg2.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.1);
            eg2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 6);
            osc.connect(eg).connect(masterGain);
            osc2.connect(eg2).connect(masterGain);
            osc.start(); osc.stop(ctx.currentTime + 9);
            osc2.start(); osc2.stop(ctx.currentTime + 7);
            _loopTimeout = setTimeout(bowl, 6000 + Math.random() * 5000);
        }
        // Soft pad
        const buf = createNoiseBuffer(ctx, 'brown', 4);
        const src = ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 200;
        const g = ctx.createGain(); g.gain.value = 0.25;
        src.connect(lp).connect(g).connect(masterGain);
        src.start();
        _ambientNodes.push({ src });
        bowl();
    }

    function stopAmbient() {
        clearTimeout(_loopTimeout); _loopTimeout = null;
        _ambientNodes.forEach(n => {
            try { if (n.src) n.src.stop(); } catch(e) {}
            try { if (n.lfo) n.lfo.stop(); } catch(e) {}
            try { if (n.gain) n.gain.disconnect(); } catch(e) {}
        });
        _ambientNodes = [];
    }

    // === USER TRACKS (IndexedDB) ===
    async function loadUserTracks() {
        try {
            const all = await ThriveDB.getAll('focusMusic');
            _userTracks = all || [];
        } catch(e) { _userTracks = []; }
    }

    async function addUserTrack(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                const track = {
                    id: 'fm_' + Date.now(),
                    name: file.name.replace(/\.[^/.]+$/, ''),
                    type: file.type,
                    data: reader.result, // base64
                    addedAt: Date.now()
                };
                await ThriveDB.put('focusMusic', track);
                _userTracks.push(track);
                resolve(track);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function removeUserTrack(id) {
        await ThriveDB.delete('focusMusic', id);
        _userTracks = _userTracks.filter(t => t.id !== id);
        if (_currentTrack && _currentTrack.id === id) stop();
    }

    function playUserTrack(track) {
        stopAll();
        if (_userAudio) { _userAudio.pause(); _userAudio = null; }
        _userAudio = new Audio(track.data);
        _userAudio.volume = _volume;
        _userAudio.loop = true;
        _userAudio.play().catch(e => console.warn('[FocusMusic] Play err:', e));
        _currentTrack = { type: 'user', id: track.id, name: track.name };
        _currentUserIdx = _userTracks.findIndex(t => t.id === track.id);
        _currentGenre = null;
        _isPlaying = true;
        updateUI();
    }

    // === CONTROLS ===
    function play(genreId) {
        stopAll();
        _currentGenre = genreId;
        _currentTrack = { type: 'ambient', id: genreId, name: GENRES.find(g => g.id === genreId)?.name || genreId };
        startAmbient(genreId);
        _isPlaying = true;
        updateUI();
    }

    function stop() {
        stopAmbient();
        if (_userAudio) { _userAudio.pause(); _userAudio.currentTime = 0; }
        _isPlaying = false;
        _currentTrack = null;
        _currentGenre = null;
        updateUI();
    }

    function stopAll() {
        stopAmbient();
        if (_userAudio) { _userAudio.pause(); _userAudio.currentTime = 0; _userAudio = null; }
    }

    function pauseMusic() {
        if (_currentTrack?.type === 'user' && _userAudio) {
            _userAudio.pause();
        } else if (_currentTrack?.type === 'ambient') {
            // Ambient can't truly pause, so fade to 0
            _ambientNodes.forEach(n => {
                if (n.gain) n.gain.gain.linearRampToValueAtTime(0, getCtx().currentTime + 0.5);
            });
        }
        _isPlaying = false;
        updateUI();
    }

    function resumeMusic() {
        if (_currentTrack?.type === 'user' && _userAudio) {
            _userAudio.play().catch(() => {});
        } else if (_currentTrack?.type === 'ambient') {
            _ambientNodes.forEach(n => {
                if (n.gain) n.gain.gain.linearRampToValueAtTime(_volume, getCtx().currentTime + 0.5);
            });
        }
        _isPlaying = true;
        updateUI();
    }

    function nextTrack() {
        if (_currentTrack?.type === 'user' && _userTracks.length > 0) {
            _currentUserIdx = (_currentUserIdx + 1) % _userTracks.length;
            playUserTrack(_userTracks[_currentUserIdx]);
        } else {
            // Cycle to next ambient genre
            const idx = GENRES.findIndex(g => g.id === _currentGenre);
            const next = GENRES[(idx + 1) % GENRES.length];
            play(next.id);
        }
    }

    function prevTrack() {
        if (_currentTrack?.type === 'user' && _userTracks.length > 0) {
            _currentUserIdx = (_currentUserIdx - 1 + _userTracks.length) % _userTracks.length;
            playUserTrack(_userTracks[_currentUserIdx]);
        } else {
            const idx = GENRES.findIndex(g => g.id === _currentGenre);
            const prev = GENRES[(idx - 1 + GENRES.length) % GENRES.length];
            play(prev.id);
        }
    }

    function setVolume(v) {
        _volume = Math.max(0, Math.min(1, v));
        if (_userAudio) _userAudio.volume = _volume;
        _ambientNodes.forEach(n => {
            if (n.gain) {
                try { n.gain.gain.linearRampToValueAtTime(_volume, getCtx().currentTime + 0.1); } catch(e) {}
            }
        });
        updateUI();
    }

    function seekUserTrack(pct) {
        if (_userAudio && _userAudio.duration) {
            _userAudio.currentTime = pct * _userAudio.duration;
        }
    }

    // Called by pomodoro when timer ends
    function onTimerEnd() {
        // Fade out over 3 seconds then stop
        if (_currentTrack?.type === 'user' && _userAudio) {
            const startVol = _userAudio.volume;
            let step = 0;
            _fadeInterval = setInterval(() => {
                step++;
                _userAudio.volume = Math.max(0, startVol * (1 - step/30));
                if (step >= 30) { clearInterval(_fadeInterval); stop(); }
            }, 100);
        } else {
            _ambientNodes.forEach(n => {
                if (n.gain) n.gain.gain.linearRampToValueAtTime(0, getCtx().currentTime + 3);
            });
            setTimeout(() => stop(), 3500);
        }
    }

    // === UI ===
    function renderMusicButton() {
        const overlay = document.getElementById('focus-overlay');
        if (!overlay) return;

        // Music floating button (top-right)
        const btn = document.createElement('button');
        btn.id = 'focus-music-btn';
        btn.className = 'focus-music-btn';
        btn.innerHTML = '🎵';
        btn.title = 'Focus Sounds';
        overlay.querySelector('.focus-content').prepend(btn);

        // Mini player bar (below button when playing)
        const miniBar = document.createElement('div');
        miniBar.id = 'focus-music-mini';
        miniBar.className = 'focus-music-mini hidden';
        miniBar.innerHTML = `
            <span class="fm-mini-name" id="fm-mini-name">—</span>
            <div class="fm-mini-controls">
                <button id="fm-mini-prev" class="fm-ctrl-btn" title="Previous">⏮</button>
                <button id="fm-mini-toggle" class="fm-ctrl-btn fm-play-btn" title="Play/Pause">▶</button>
                <button id="fm-mini-next" class="fm-ctrl-btn" title="Next">⏭</button>
            </div>
        `;
        overlay.querySelector('.focus-content').prepend(miniBar);

        // Full panel
        const panel = document.createElement('div');
        panel.id = 'focus-music-panel';
        panel.className = 'focus-music-panel hidden';
        panel.innerHTML = buildPanelHTML();
        overlay.querySelector('.focus-content').appendChild(panel);
    }

    function buildPanelHTML() {
        return `
            <div class="fm-panel-header">
                <h3 class="fm-panel-title">🎵 Focus Sounds</h3>
                <button id="fm-panel-close" class="fm-panel-close">✕</button>
            </div>

            <div class="fm-tabs">
                <button class="fm-tab active" data-tab="library">Library</button>
                <button class="fm-tab" data-tab="my-tracks">My Tracks</button>
            </div>

            <div class="fm-tab-content" id="fm-tab-library">
                <div class="fm-genre-grid">
                    ${GENRES.map(g => `
                        <button class="fm-genre-card" data-genre="${g.id}" style="--genre-color: ${g.color}">
                            <span class="fm-genre-emoji">${g.emoji}</span>
                            <span class="fm-genre-name">${g.name}</span>
                            <span class="fm-genre-play-icon">▶</span>
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="fm-tab-content hidden" id="fm-tab-my-tracks">
                <div class="fm-upload-area" id="fm-upload-area">
                    <input type="file" id="fm-file-input" accept="audio/*" multiple hidden>
                    <button id="fm-upload-btn" class="fm-upload-btn">
                        <span>📁</span> Add from Device
                    </button>
                </div>
                <div class="fm-user-list" id="fm-user-list"></div>
            </div>

            <div class="fm-now-playing hidden" id="fm-now-playing">
                <div class="fm-np-info">
                    <span class="fm-np-emoji" id="fm-np-emoji">🎵</span>
                    <div class="fm-np-details">
                        <span class="fm-np-name" id="fm-np-name">—</span>
                        <span class="fm-np-type" id="fm-np-type">Ambient</span>
                    </div>
                </div>
                <div class="fm-seek-container hidden" id="fm-seek-container">
                    <span class="fm-seek-time" id="fm-seek-cur">0:00</span>
                    <input type="range" class="fm-seek-bar" id="fm-seek-bar" min="0" max="100" value="0">
                    <span class="fm-seek-time" id="fm-seek-dur">0:00</span>
                </div>
                <div class="fm-controls">
                    <button id="fm-prev" class="fm-ctrl-btn" title="Previous">⏮</button>
                    <button id="fm-play-pause" class="fm-ctrl-btn fm-play-btn" title="Play/Pause">⏸</button>
                    <button id="fm-next" class="fm-ctrl-btn" title="Next">⏭</button>
                    <button id="fm-stop" class="fm-ctrl-btn fm-stop-btn" title="Stop">⏹</button>
                </div>
                <div class="fm-volume">
                    <span class="fm-vol-icon">🔊</span>
                    <input type="range" class="fm-vol-slider" id="fm-vol-slider" min="0" max="100" value="50">
                </div>
            </div>
        `;
    }

    function updateUI() {
        // Mini bar
        const miniBar = document.getElementById('focus-music-mini');
        const miniName = document.getElementById('fm-mini-name');
        const miniToggle = document.getElementById('fm-mini-toggle');
        const musicBtn = document.getElementById('focus-music-btn');

        if (_currentTrack) {
            if (miniBar) miniBar.classList.remove('hidden');
            if (miniName) miniName.textContent = _currentTrack.name;
            if (miniToggle) miniToggle.textContent = _isPlaying ? '⏸' : '▶';
            if (musicBtn) { musicBtn.classList.add('playing'); musicBtn.innerHTML = _isPlaying ? '🎶' : '🎵'; }
        } else {
            if (miniBar) miniBar.classList.add('hidden');
            if (musicBtn) { musicBtn.classList.remove('playing'); musicBtn.innerHTML = '🎵'; }
        }

        // Now Playing section in panel
        const np = document.getElementById('fm-now-playing');
        if (np) {
            if (_currentTrack) {
                np.classList.remove('hidden');
                const genre = GENRES.find(g => g.id === _currentGenre);
                document.getElementById('fm-np-emoji').textContent = genre?.emoji || '🎵';
                document.getElementById('fm-np-name').textContent = _currentTrack.name;
                document.getElementById('fm-np-type').textContent = _currentTrack.type === 'ambient' ? 'Ambient Sound' : 'Your Track';
                document.getElementById('fm-play-pause').textContent = _isPlaying ? '⏸' : '▶';

                // Show seek bar only for user tracks
                const seekC = document.getElementById('fm-seek-container');
                if (seekC) seekC.classList.toggle('hidden', _currentTrack.type !== 'user');
            } else {
                np.classList.add('hidden');
            }
        }

        // Genre cards active state
        document.querySelectorAll('.fm-genre-card').forEach(c => {
            c.classList.toggle('active', c.dataset.genre === _currentGenre && _isPlaying);
            c.querySelector('.fm-genre-play-icon').textContent = (c.dataset.genre === _currentGenre && _isPlaying) ? '⏸' : '▶';
        });

        // User track list
        renderUserTrackList();

        // Volume slider
        const vs = document.getElementById('fm-vol-slider');
        if (vs) vs.value = Math.round(_volume * 100);
    }

    function renderUserTrackList() {
        const list = document.getElementById('fm-user-list');
        if (!list) return;
        if (_userTracks.length === 0) {
            list.innerHTML = '<div class="fm-empty">No tracks added yet. Upload your favorite sounds!</div>';
            return;
        }
        list.innerHTML = _userTracks.map(t => `
            <div class="fm-user-item ${(_currentTrack?.id === t.id) ? 'active' : ''}" data-track-id="${t.id}">
                <span class="fm-user-emoji">🎵</span>
                <span class="fm-user-name">${t.name}</span>
                <div class="fm-user-actions">
                    <button class="fm-user-play" data-id="${t.id}" title="Play">${(_currentTrack?.id === t.id && _isPlaying) ? '⏸' : '▶'}</button>
                    <button class="fm-user-del" data-id="${t.id}" title="Remove">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    function togglePanel() {
        const panel = document.getElementById('focus-music-panel');
        if (!panel) return;
        _panelOpen = !_panelOpen;
        panel.classList.toggle('hidden', !_panelOpen);
        if (_panelOpen) updateUI();
    }

    // Seek bar updater
    function startSeekUpdater() {
        setInterval(() => {
            if (!_userAudio || !_isPlaying || _currentTrack?.type !== 'user') return;
            const bar = document.getElementById('fm-seek-bar');
            const cur = document.getElementById('fm-seek-cur');
            const dur = document.getElementById('fm-seek-dur');
            if (!bar || !_userAudio.duration) return;
            const pct = (_userAudio.currentTime / _userAudio.duration) * 100;
            bar.value = pct;
            cur.textContent = fmtTime(_userAudio.currentTime);
            dur.textContent = fmtTime(_userAudio.duration);
        }, 500);
    }

    function fmtTime(s) {
        const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
        return `${m}:${String(sec).padStart(2, '0')}`;
    }

    // === EVENTS ===
    function wireEvents() {
        // Music button
        document.addEventListener('click', e => {
            // Main music button
            if (e.target.closest('#focus-music-btn')) { togglePanel(); return; }

            // Panel close
            if (e.target.closest('#fm-panel-close')) { togglePanel(); return; }

            // Tabs
            const tab = e.target.closest('.fm-tab');
            if (tab) {
                document.querySelectorAll('.fm-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const tabId = tab.dataset.tab;
                document.getElementById('fm-tab-library').classList.toggle('hidden', tabId !== 'library');
                document.getElementById('fm-tab-my-tracks').classList.toggle('hidden', tabId !== 'my-tracks');
                return;
            }

            // Genre cards
            const gc = e.target.closest('.fm-genre-card');
            if (gc) {
                const gid = gc.dataset.genre;
                if (_currentGenre === gid && _isPlaying) pauseMusic();
                else play(gid);
                return;
            }

            // Mini controls
            if (e.target.closest('#fm-mini-toggle')) { _isPlaying ? pauseMusic() : resumeMusic(); return; }
            if (e.target.closest('#fm-mini-prev')) { prevTrack(); return; }
            if (e.target.closest('#fm-mini-next')) { nextTrack(); return; }

            // Panel controls
            if (e.target.closest('#fm-play-pause')) { _isPlaying ? pauseMusic() : resumeMusic(); return; }
            if (e.target.closest('#fm-prev')) { prevTrack(); return; }
            if (e.target.closest('#fm-next')) { nextTrack(); return; }
            if (e.target.closest('#fm-stop')) { stop(); return; }

            // Upload button
            if (e.target.closest('#fm-upload-btn')) { document.getElementById('fm-file-input').click(); return; }

            // User track play
            const uPlay = e.target.closest('.fm-user-play');
            if (uPlay) {
                const id = uPlay.dataset.id;
                if (_currentTrack?.id === id && _isPlaying) { pauseMusic(); }
                else {
                    const track = _userTracks.find(t => t.id === id);
                    if (track) playUserTrack(track);
                }
                return;
            }

            // User track delete
            const uDel = e.target.closest('.fm-user-del');
            if (uDel) {
                removeUserTrack(uDel.dataset.id);
                updateUI();
                return;
            }
        });

        // File input
        document.addEventListener('change', async e => {
            if (e.target.id === 'fm-file-input') {
                const files = Array.from(e.target.files);
                for (const f of files) {
                    if (f.type.startsWith('audio/')) {
                        await addUserTrack(f);
                        Utils.toast(`🎵 Added: ${f.name}`, 'success');
                    }
                }
                updateUI();
                e.target.value = '';
            }
        });

        // Volume slider
        document.addEventListener('input', e => {
            if (e.target.id === 'fm-vol-slider') {
                setVolume(parseInt(e.target.value) / 100);
            }
            if (e.target.id === 'fm-seek-bar') {
                seekUserTrack(parseInt(e.target.value) / 100);
            }
        });

        startSeekUpdater();
    }

    return { init, play, stop, pauseMusic, resumeMusic, onTimerEnd, setVolume };
})();
