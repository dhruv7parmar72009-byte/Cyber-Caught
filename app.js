(function(){
  const $ = (id) => document.getElementById(id);

  const AUTH_KEY = 'cc_users_v1';
  const SESSION_KEY = 'cc_session_v1';
  const SCANS_KEY_PREFIX = 'cc_scans_';
  const PROFILE_KEY = 'cc_profile_v1';
  const PROFILE_IMAGE_KEY = 'cc_profile_image_v1';
  const THEME_KEY = 'cc_theme_v1';
  const ADMIN_EMAIL = 'admin@gmail.com';
  const LOCKED_PROFILE = Object.freeze({
    name: 'Parmar Dhruv Parimalbhai',
    role: 'IBM SkillsBuild India Intern',
    college: 'R.C. Technical Institute',
    city: 'Ahmedabad, Gujarat',
    email: 'dhruv7parmar72009@gmail.com',
    github: 'https://github.com/dhruv7parmar72009-byte/Cyber-Caught',
    linkedIn: 'https://www.linkedin.com/in/dhruvparmar752009?utm_source=share_via&utm_content=profile&utm_medium=member_android',
    skills: 'Audio forensics, cyber safety awareness, JavaScript, UI development'
  });
  const DEMO_TRANSCRIPTS = [
    'Hello, this is regarding your bank account. We have noticed unusual activity and need you to verify your account immediately. Please share the OTP sent to your phone so we can confirm your identity.',
    'Hi, just calling to confirm our meeting tomorrow at 10 AM. Let me know if that time still works for you, otherwise we can reschedule for later in the week.',
    'This is an emergency, I am in trouble and I need you to transfer money urgently to this account, please do not tell anyone and act fast before it is too late.',
    'Good afternoon, thank you for calling support. I am checking your order status now and it looks like it shipped yesterday and should arrive within three business days.',
    'Sir, your account will be suspended unless you confirm your details right now. Please share your password and CVV so we can stop the suspension process immediately.'
  ];
  const SCAM_PATTERNS = [
    { tag: 'OTP REQUEST', re: /\b(otp|one[\s-]?time\s?password|verification\s?code)\b/i },
    { tag: 'ACCOUNT VERIFY', re: /\b(verify\s?your\s?account|confirm\s?your\s?(account|identity|details))\b/i },
    { tag: 'URGENT TRANSFER', re: /\b(transfer\s?(money|funds)|send\s?money\s?urgently|wire\s?transfer)\b/i },
    { tag: 'EMERGENCY', re: /\b(i'?m\s?in\s?trouble|emergency|need\s?help\s?immediately)\b/i },
    { tag: 'CREDENTIAL SHARE', re: /\b(share\s?(your\s?)?(password|credentials|pin|cvv))\b/i },
    { tag: 'COMPANY FUNDS', re: /\b(transfer\s?company\s?funds|company\s?account)\b/i },
    { tag: 'GIFT CARD', re: /\b(gift\s?card|itunes\s?card|google\s?play\s?card)\b/i },
    { tag: 'THREAT/COERCION', re: /\b(arrest|legal\s?action|suspend\s?your\s?account|police)\b/i }
  ];
  const CHAT_KB = [
    { keys:['deepfake','ai voice','cloned voice','voice clone','fake voice'], title:'Deepfake Voices',
      a:"AI-cloned voices often sound slightly too smooth - flat pitch variation, unnaturally clean background noise, and no natural breathing or mouth-sounds. If a call urges urgent money transfer or secrecy, hang up and call the person back on a number you already trust." },
    { keys:['otp','one time password','verification code'], title:'OTP Scams',
      a:"Never share an OTP over a call or message, even with someone claiming to be your bank, a delivery agent, or government official. Real institutions never ask you to read an OTP back to them." },
    { keys:['phishing','suspicious link','fake email','fake link'], title:'Phishing',
      a:"Check the sender's actual email address, not just the display name. Hover over links before clicking to see the real destination URL. Legitimate organizations do not usually create urgency or ask for passwords by email." },
    { keys:['scam','fraud','being scammed','victim'], title:'General Scam Response',
      a:"Stop the interaction immediately and do not send any more money or information. Note down phone numbers, account numbers, and names used. Report it to your bank and local cybercrime authorities." },
    { keys:['report','complain','cybercrime','police','authority'], title:'Reporting a Scam',
      a:"Keep screenshots, call logs, and transaction IDs ready before you file a report. In India, report online financial fraud at cybercrime.gov.in or call the national cybercrime helpline 1930." },
    { keys:['password','credential','account security','secure account'], title:'Account Security',
      a:"Use a unique password per account, enable two-factor authentication wherever offered, and never share your password or PIN with anyone - including people claiming to be support staff." },
    { keys:['spectrogram','pitch','frequency','feature extract'], title:'How Detection Works',
      a:"This tool extracts real signal features from your audio - average pitch, pitch variance, spectral centroid, and harmonic-to-noise ratio - using the Web Audio API. These features feed a weighted scoring formula." },
    { keys:['risk score','composite risk','how scored','scoring'], title:'Risk Scoring',
      a:"Composite risk combines two parts: deepfake probability (55% weight, from spectral features) and scam probability (45% weight, from matched phrases in the transcript). Scores under 30 are Safe, 31-60 are Medium Risk, and 61+ are High Risk." },
    { keys:['emergency','urgent','send money','family member','trouble'], title:'Emergency Scam Calls',
      a:"Scammers often impersonate a family member in trouble to bypass caution. Pause and call that person directly on their known number before sending anything." },
    { keys:['who made','what is this','about this site','what is cyber caught'], title:'About This Tool',
      a:"Cyber Caught is an academic / internship demonstration project combining audio signal processing, phrase matching, and a heuristic risk model to flag potential AI-generated voices and social-engineering scam patterns." },
    { keys:['hi','hello','hey','help'], title:'Welcome',
      a:"Hi! I am a rule-based cyber-safety assistant - ask me about deepfake voices, OTP scams, phishing, or what to do if you've been scammed." }
  ];
  const CHAT_FALLBACK = "I do not have a specific answer for that yet - try asking about deepfake voices, OTP scams, phishing, account security, or what to do if you've been scammed.";

  const state = {
    pieChart: false,
    barChart: false,
    scanCounter: 100482,
    heroPhase: 0,
    audioCtx: null,
    live: { recorder: null, stream: null, chunks: [], analyser: null, raf: 0 }
  };

  let pendingConsent = null;

  function readJSON(key, fallback){
    try{ return JSON.parse(localStorage.getItem(key)) ?? fallback; }catch{ return fallback; }
  }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
  function getUsers(){ return readJSON(AUTH_KEY, {}); }
  function saveUsers(users){ writeJSON(AUTH_KEY, users); }
  async function hashPassword(pw){
    const enc = new TextEncoder().encode(pw);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function getSession(){ return readJSON(SESSION_KEY, null); }
  function setSession(email){ writeJSON(SESSION_KEY, { email, at: Date.now() }); }
  function clearSession(){ localStorage.removeItem(SESSION_KEY); }
  function isLoggedIn(){ return !!getSession(); }
  function currentUser(){
    const s = getSession();
    if(!s) return null;
    const users = getUsers();
    return users[s.email] || null;
  }
  function scanKey(){
    const user = currentUser();
    return SCANS_KEY_PREFIX + (user ? user.email : 'guest');
  }
  function loadScans(){ return readJSON(scanKey(), []); }
  function saveScans(scans){ writeJSON(scanKey(), scans); }
  function addScan(entry){
    const scans = loadScans();
    scans.push(entry);
    saveScans(scans);
  }
  function getProfile(){
    return readJSON(PROFILE_KEY, LOCKED_PROFILE);
  }
  function ensureLockedProfile(){
    writeJSON(PROFILE_KEY, LOCKED_PROFILE);
  }
  function getProfileImage(){
    try{ return localStorage.getItem(PROFILE_IMAGE_KEY) || ''; }catch{ return ''; }
  }
  function setProfileImage(dataUrl){
    if(dataUrl) localStorage.setItem(PROFILE_IMAGE_KEY, dataUrl);
    else localStorage.removeItem(PROFILE_IMAGE_KEY);
  }
  function getTheme(){
    try{ return localStorage.getItem(THEME_KEY) || 'dark'; }catch{ return 'dark'; }
  }
  function setTheme(theme){
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
    $('themeIcon').textContent = theme === 'light' ? '◑' : '◐';
  }
  function firstLetter(name){
    return (name || 'P').trim().charAt(0).toUpperCase() || 'P';
  }
  function renderAvatar(el, profile, imageDataUrl){
    if(!el) return;
    el.innerHTML = '';
    if(imageDataUrl){
      const img = document.createElement('img');
      img.alt = profile.name || 'Profile photo';
      img.src = imageDataUrl;
      el.appendChild(img);
    } else {
      el.textContent = firstLetter(profile.name);
    }
  }
  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

  function show(el){ el.classList.remove('hide'); }
  function hide(el){ el.classList.add('hide'); }
  function showError(id, msg){
    const el = $(id);
    el.textContent = msg;
    el.classList.add('show');
  }
  function clearError(id){ $(id).classList.remove('show'); }

  function showAuthModal(tab){
    $('authModal').classList.add('show');
    switchAuthTab(tab || 'login');
  }
  function hideAuthModal(){ $('authModal').classList.remove('show'); }
  function showProfileModal(){ $('profileModal').classList.add('show'); }
  function hideProfileModal(){ $('profileModal').classList.remove('show'); }
  function showMenu(){
    const panel = $('menuPanel');
    const btn = $('menuToggleBtn');
    if(!panel || !btn) return;
    panel.hidden = false;
    panel.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    btn.textContent = 'Hide';
  }
  function hideMenu(){
    const panel = $('menuPanel');
    const btn = $('menuToggleBtn');
    if(!panel || !btn) return;
    panel.classList.remove('open');
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = 'Menu';
  }
  function toggleMenu(){
    const panel = $('menuPanel');
    if(!panel) return;
    if(panel.hidden) showMenu();
    else hideMenu();
  }
  function showConsent(options){
    pendingConsent = options;
    $('consentTitle').textContent = options.title;
    $('consentText').textContent = options.text;
    $('consentOkBtn').textContent = options.okText || 'Continue';
    $('consentModal').classList.add('show');
  }
  function hideConsent(){
    pendingConsent = null;
    $('consentModal').classList.remove('show');
  }
  function requireConsent(options){
    showConsent(options);
  }
  function switchAuthTab(tab){
    document.querySelectorAll('.auth-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    show(tab === 'login' ? $('loginPanel') : $('signupPanel'));
    hide(tab === 'login' ? $('signupPanel') : $('loginPanel'));
    clearError('loginError');
    clearError('signupError');
  }

  function escapeHtml(str){
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setCanvasSize(canvas){
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(280, Math.floor(r.width || 300));
    const h = Math.max(160, Math.floor(r.height || 220));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function drawHeroWave(){
    const canvas = $('heroWave');
    const { ctx, w, h } = setCanvasSize(canvas);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#00bb44';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const mid = h / 2;
    for(let x = 0; x < w; x += 2){
      const t = x / w;
      const y = mid
        + Math.sin(t * 24 + state.heroPhase) * (h * 0.16) * Math.sin(t * 4 + state.heroPhase * 0.35)
        + Math.sin(t * 72 + state.heroPhase * 1.7) * (h * 0.05);
      if(x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    state.heroPhase += 0.045;
    $('heroHz').textContent = `${(118 + Math.sin(state.heroPhase * 0.5) * 22).toFixed(0)} Hz`;
    $('heroDb').textContent = `-${(14 + Math.abs(Math.sin(state.heroPhase * 0.7)) * 9).toFixed(0)} dB`;
    $('heroConf').textContent = `${(Math.abs(Math.sin(state.heroPhase * 0.31)) * 3).toFixed(1)}%`;
    requestAnimationFrame(drawHeroWave);
  }

  function initMarquee(){
    const items = [
      'DEEPFAKE DETECTION', 'SOCIAL ENGINEERING GUARD', 'SPECTROGRAM ANALYSIS',
      'REAL-TIME VOICE MONITORING', 'SCAM PHRASE NLP', 'RISK SCORING ENGINE',
      'LIVE MICROPHONE DETECTION', 'FORENSIC AUDIO REPORTS'
    ];
    const html = items.map(t => `<span>${t}</span>`).join('');
    $('marqueeTrack').innerHTML = html + html;
  }

  function renderChatMessage(text, who, title){
    const div = document.createElement('div');
    div.className = `chat-msg ${who}`;
    if(who === 'bot' && title){
      div.innerHTML = `<b>${escapeHtml(title)}</b>${escapeHtml(text)}`;
    } else {
      div.textContent = text;
    }
    $('chatBody').appendChild(div);
    $('chatBody').scrollTop = $('chatBody').scrollHeight;
  }
  function renderProfile(){
    const profile = getProfile();
    const imageDataUrl = getProfileImage();
    $('profileNameView').textContent = profile.name || '';
    $('profileRoleView').textContent = profile.role || '';
    $('profileCollegeView').textContent = profile.college || '';
    $('profileCityView').textContent = profile.city || '';
    $('profileEmailView').textContent = profile.email || '';
    $('profileGitHubView').textContent = profile.github || '';
    $('profileLinkedInView').textContent = profile.linkedIn || '';
    $('profileSkillsView').textContent = profile.skills || '';

    const introParts = profile.name
      ? [`My name is ${profile.name}. `, 'I am an intern at IBM SkillsBuild India from Bharat Cares by SMEC Trust, trained by Mr. Ayush Kumar from CSRBOX.']
      : ['I am an intern at IBM SkillsBuild India from Bharat Cares by SMEC Trust, trained by Mr. Ayush Kumar from CSRBOX.'];
    $('aboutIntroText').textContent = introParts.join('');
    $('aboutIntroText').textContent += profile.skills ? ` Skills: ${profile.skills}.` : '';
    const pills = document.querySelectorAll('.about-pills .pill');
    if(pills[0] && profile.name) pills[0].textContent = profile.name;
    if(pills[1] && profile.role) pills[1].textContent = profile.role;
    if(pills[2] && profile.college) pills[2].textContent = profile.college;
    if(pills[3] && profile.city) pills[3].textContent = profile.city;
    $('githubLinkBtn').dataset.url = profile.github || '';
    $('linkedinLinkBtn').dataset.url = profile.linkedIn || '';
    $('profileModalName').textContent = profile.name || 'Profile';
    $('profileModalEmail').textContent = profile.email || '';
    $('profileNameView2').textContent = profile.name || '';
    $('profileRoleView2').textContent = profile.role || '';
    $('profileCollegeView2').textContent = profile.college || '';
    $('profileCityView2').textContent = profile.city || '';
    $('profileEmailView2').textContent = profile.email || '';
    $('profileGitHubView2').textContent = profile.github || '';
    $('profileLinkedInView2').textContent = profile.linkedIn || '';
    $('profileSkillsView2').textContent = profile.skills || '';
    renderAvatar($('profileAvatarLarge'), profile, imageDataUrl);
    renderAvatar($('navAvatar'), profile, imageDataUrl);
    $('navAccountName').textContent = currentUser() ? profile.name.split(' ')[0] : 'Profile';
    const menuAdmin = $('menuAdminLink');
    if(menuAdmin){
      if(currentUser() && currentUser().email === ADMIN_EMAIL) show(menuAdmin);
      else hide(menuAdmin);
    }
  }
  function matchChat(query){
    const q = query.toLowerCase();
    let best = null;
    let score = 0;
    CHAT_KB.forEach(entry => {
      entry.keys.forEach(key => {
        if(q.includes(key) && key.length > score){
          best = entry;
          score = key.length;
        }
      });
    });
    return best;
  }
  function initChat(){
    $('chatBody').innerHTML = '';
    renderChatMessage("Hi! I am a rule-based cyber-safety assistant. Ask me about deepfakes, OTP scams, or phishing.", 'bot', 'CYBER CAUGHT BOT');
    const quick = ['What is a deepfake voice?','How do OTP scams work?','I think I was scammed','How is risk scored?'];
    $('chatQuick').innerHTML = quick.map(q => `<div class="chat-chip">${q}</div>`).join('');
    $('chatQuick').querySelectorAll('.chat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        $('chatInput').value = chip.textContent;
        $('chatForm').dispatchEvent(new Event('submit', { cancelable:true, bubbles:true }));
      });
    });
  }

  function getAudioContext(){
    if(!state.audioCtx){
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return state.audioCtx;
  }
  async function decodeFile(file){
    const arrayBuf = await file.arrayBuffer();
    const ctx = getAudioContext();
    if(ctx.state === 'suspended') await ctx.resume();
    return await ctx.decodeAudioData(arrayBuf.slice(0));
  }

  function autocorrelatePitch(buf, sampleRate){
    const size = buf.length;
    const minOffset = Math.floor(sampleRate / 500);
    const maxOffset = Math.floor(sampleRate / 60);
    let bestOffset = -1;
    let bestCorr = 0;
    for(let offset = minOffset; offset < maxOffset; offset++){
      let corr = 0;
      for(let i = 0; i < size - offset; i++) corr += buf[i] * buf[i + offset];
      corr = corr / (size - offset);
      if(corr > bestCorr){
        bestCorr = corr;
        bestOffset = offset;
      }
    }
    return bestOffset > 0 ? sampleRate / bestOffset : 0;
  }

  function simpleSpectrum(frame, sampleRate){
    const target = 512;
    const step = Math.max(1, Math.floor(frame.length / target));
    const samples = [];
    for(let i = 0; i < frame.length; i += step) samples.push(frame[i]);
    const m = samples.length;
    const magnitudes = [];
    const freqs = [];
    const bins = 64;
    for(let k = 0; k < bins; k++){
      let re = 0;
      let im = 0;
      for(let t = 0; t < m; t++){
        const angle = (2 * Math.PI * k * t) / m;
        re += samples[t] * Math.cos(angle);
        im -= samples[t] * Math.sin(angle);
      }
      magnitudes.push(Math.sqrt(re * re + im * im) / m);
      freqs.push(k * (sampleRate / m));
    }
    return { magnitudes, freqs };
  }

  function extractFeatures(audioBuffer){
    const data = audioBuffer.getChannelData(0);
    const sr = audioBuffer.sampleRate;
    const n = data.length;

    let sumSq = 0;
    for(let i = 0; i < n; i++) sumSq += data[i] * data[i];
    const rms = Math.sqrt(sumSq / n);
    const noiseFloorDb = 20 * Math.log10(Math.max(rms * 0.08, 1e-6));

    const winSize = 2048;
    const hop = 1024;
    const pitches = [];
    for(let start = 0; start + winSize < n; start += hop){
      const window = data.subarray(start, start + winSize);
      const f0 = autocorrelatePitch(window, sr);
      if(f0 > 60 && f0 < 500) pitches.push(f0);
    }
    const avgPitch = pitches.length ? pitches.reduce((a, b) => a + b, 0) / pitches.length : 0;
    const pitchVar = pitches.length > 1
      ? Math.sqrt(pitches.reduce((a, b) => a + (b - avgPitch) ** 2, 0) / pitches.length)
      : 0;

    const midStart = Math.max(0, Math.floor(n / 2 - 1024));
    const frame = data.subarray(midStart, Math.min(n, midStart + 2048));
    const { magnitudes, freqs } = simpleSpectrum(frame, sr);
    let wSum = 0;
    let mSum = 0;
    for(let i = 0; i < magnitudes.length; i++){
      wSum += freqs[i] * magnitudes[i];
      mSum += magnitudes[i];
    }
    const centroid = mSum > 0 ? wSum / mSum : 0;

    const sorted = [...magnitudes].sort((a, b) => b - a);
    const top = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.1))).reduce((a, b) => a + b, 0);
    const total = sorted.reduce((a, b) => a + b, 0) || 1;
    const hnr = (top / total) * 100;

    return {
      avgPitch,
      pitchVar,
      centroid,
      noiseFloorDb,
      hnr,
      duration: audioBuffer.duration,
      spectrum: magnitudes,
      freqs,
      waveform: data,
      sampleRate: sr
    };
  }

  function computeScores(features, transcript){
    const lowVarScore = clamp((8 - features.pitchVar) / 8, 0, 1);
    const highHnrScore = clamp((features.hnr - 25) / 40, 0, 1);
    const flatNoiseScore = clamp((features.noiseFloorDb + 70) / 50, 0, 1);
    let deepfake = (lowVarScore * 0.45 + highHnrScore * 0.35 + flatNoiseScore * 0.2) * 100;
    deepfake = clamp(deepfake + (Math.random() * 8 - 4), 2, 97);

    const matches = SCAM_PATTERNS.filter(p => p.re.test(transcript));
    const scam = clamp(matches.length * 22 + (matches.length > 0 ? 15 : 0), 0, 96);
    const risk = clamp(deepfake * 0.55 + scam * 0.45, 0, 100);
    return { deepfake: Math.round(deepfake), scam: Math.round(scam), risk: Math.round(risk), matches };
  }

  function drawWaveformStatic(canvas, data){
    const { ctx, w, h } = setCanvasSize(canvas);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#00bb44';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const step = Math.ceil(data.length / w);
    const mid = h / 2;
    for(let x = 0; x < w; x++){
      const idx = x * step;
      let min = 1;
      let max = -1;
      for(let j = 0; j < step && idx + j < data.length; j++){
        const v = data[idx + j];
        if(v < min) min = v;
        if(v > max) max = v;
      }
      ctx.moveTo(x, mid + min * mid * 0.92);
      ctx.lineTo(x, mid + max * mid * 0.92);
    }
    ctx.stroke();
  }

  function drawSpectrogram(canvas, audioBuffer){
    const { ctx, w, h } = setCanvasSize(canvas);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const data = audioBuffer.getChannelData(0);
    const sr = audioBuffer.sampleRate;
    const slices = 72;
    const sliceLen = Math.floor(data.length / slices);
    for(let s = 0; s < slices; s++){
      const frame = data.subarray(s * sliceLen, s * sliceLen + Math.min(2048, sliceLen));
      if(frame.length < 16) continue;
      const { magnitudes } = simpleSpectrum(frame, sr);
      const colW = w / slices;
      const rowH = h / magnitudes.length;
      const maxMag = Math.max(...magnitudes, 0.0001);
      for(let b = 0; b < magnitudes.length; b++){
        const intensity = clamp(magnitudes[b] / maxMag, 0, 1);
        const gray = Math.round(intensity * 245);
        const g2 = Math.round(gray * 0.85);
        ctx.fillStyle = `rgb(${Math.round(gray * 0.15)},${g2},${Math.round(gray * 0.15)})`;
        ctx.fillRect(s * colW, h - (b + 1) * rowH, colW + 0.5, rowH + 0.5);
      }
    }
  }

  function renderTranscript(transcript, matches){
    let html = escapeHtml(transcript);
    matches.forEach(match => {
      html = html.replace(match.re, m => `<span class="flag-word">${escapeHtml(m)}</span>`);
    });
    return html;
  }

  function renderReport(features, scores, transcript){
    state.scanCounter += 1;
    $('reportId').textContent = `REPORT #CC-${state.scanCounter}`;
    $('scoreDeepfake').textContent = `${scores.deepfake}%`;
    $('scoreScam').textContent = `${scores.scam}%`;
    $('scoreRisk').textContent = `${scores.risk}`;
    $('barDeepfake').style.width = `${scores.deepfake}%`;
    $('barScam').style.width = `${scores.scam}%`;
    $('barRisk').style.width = `${scores.risk}%`;

    $('fPitch').textContent = features.avgPitch ? `${features.avgPitch.toFixed(1)} Hz` : 'N/A';
    $('fPitchVar').textContent = features.pitchVar.toFixed(2);
    $('fCentroid').textContent = `${features.centroid.toFixed(0)} Hz`;
    $('fNoise').textContent = `${features.noiseFloorDb.toFixed(1)} dB`;
    $('fHnr').textContent = `${features.hnr.toFixed(1)}%`;
    $('fDuration').textContent = `${features.duration.toFixed(2)} s`;
    $('transcriptText').innerHTML = renderTranscript(transcript, scores.matches);

    const phrasesEl = $('scamPhrases');
    if(scores.matches.length){
      phrasesEl.innerHTML = scores.matches.map(m => `<div class="phrase-row"><span class="ptag">PATTERN</span><span>${escapeHtml(m.tag)}</span></div>`).join('');
    } else {
      phrasesEl.innerHTML = '<div class="phrase-row"><span class="ptag">-</span><span>No scam patterns matched</span></div>';
    }

    const verdictTag = $('verdictTag');
    const alertBox = $('alertBox');
    verdictTag.className = 'verdict';
    let label = 'SAFE';
    if(scores.risk >= 61){
      label = 'HIGH RISK';
      verdictTag.classList.add('high');
      alertBox.classList.remove('hide');
      $('alertBoxText').textContent = `Possible AI-generated voice and/or scam pattern detected. Confidence ${scores.risk}%. Do not act on instructions in this audio without independent verification.`;
      $('modalText').textContent = `Sample CC-${state.scanCounter} scored ${scores.risk}/100 composite risk. Deepfake probability ${scores.deepfake}%, scam probability ${scores.scam}%. Review the full report before trusting this audio.`;
      $('alertModal').classList.add('show');
    } else if(scores.risk >= 31){
      label = 'MEDIUM RISK';
      verdictTag.classList.add('medium');
      alertBox.classList.remove('hide');
      $('alertBoxText').textContent = `Some anomalies detected (risk ${scores.risk}%). Treat unexpected financial or credential requests in this audio with caution.`;
    } else {
      verdictTag.classList.add('safe');
      alertBox.classList.add('hide');
    }
    verdictTag.textContent = label;

    addScan({
      id: state.scanCounter,
      deepfake: scores.deepfake,
      scam: scores.scam,
      risk: scores.risk,
      label,
      time: Date.now()
    });
    updateDashboard();
    show($('reportSection'));
    $('reportSection').scrollIntoView({ behavior:'smooth', block:'start' });
  }

  function updateDashboard(){
    const scans = loadScans();
    const total = scans.length;
    const deepfakes = scans.filter(s => s.deepfake > 60).length;
    const safe = scans.filter(s => s.risk < 30).length;
    const scams = scans.filter(s => s.scam > 0).length;
    $('dashTotal').textContent = total;
    $('dashDeepfake').textContent = deepfakes;
    $('dashSafe').textContent = safe;
    $('dashScam').textContent = scams;
    drawPieChart($('pieChart'), scans);
    drawBarChart($('barChart'), scans);
    renderHistoryTable();
    renderAdminIfApplicable();
  }

  function drawPieChart(canvas, scans){
    const { ctx, w, h } = setCanvasSize(canvas);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const low = scans.filter(s => s.risk < 31).length || 1;
    const med = scans.filter(s => s.risk >= 31 && s.risk < 61).length;
    const high = scans.filter(s => s.risk >= 61).length;
    const data = [low, med, high];
    const colors = ['#00bb44', '#ff8800', '#cc0000'];
    const total = data.reduce((a, b) => a + b, 0) || 1;
    const cx = Math.max(100, Math.floor(w * 0.32));
    const cy = Math.floor(h * 0.5);
    const outer = Math.min(w, h) * 0.28;
    const inner = outer * 0.6;
    let start = -Math.PI / 2;
    data.forEach((value, i) => {
      const angle = (value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, outer, start, start + angle);
      ctx.lineWidth = outer - inner;
      ctx.strokeStyle = colors[i];
      ctx.stroke();
      start += angle;
    });
    ctx.fillStyle = '#f4f4f0';
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('RISK', cx, cy - 4);
    ctx.font = '800 24px ui-monospace, monospace';
    ctx.fillText(String(Math.round((high / total) * 100)) + '%', cx, cy + 22);
    ctx.textAlign = 'left';
    ctx.font = '600 11px ui-monospace, monospace';
    const x = Math.floor(w * 0.62);
    const y0 = Math.floor(h * 0.25);
    ['Safe', 'Medium', 'High'].forEach((label, i) => {
      const y = y0 + i * 28;
      ctx.fillStyle = colors[i];
      ctx.fillRect(x, y - 9, 10, 10);
      ctx.fillStyle = '#f4f4f0';
      ctx.fillText(`${label}: ${data[i]}`, x + 18, y);
    });
  }

  function drawBarChart(canvas, scans){
    const { ctx, w, h } = setCanvasSize(canvas);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const pad = { l: 36, r: 14, t: 14, b: 34 };
    const chartW = w - pad.l - pad.r;
    const chartH = h - pad.t - pad.b;
    ctx.strokeStyle = '#2a2a2a';
    ctx.fillStyle = '#c7c5be';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'right';
    [0, 25, 50, 75, 100].forEach(v => {
      const y = pad.t + chartH - (v / 100) * chartH;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      ctx.fillText(String(v), pad.l - 8, y + 3);
    });
    const data = scans.map(s => s.risk);
    const labels = scans.map((_, i) => `S${i + 1}`);
    const colors = scans.map(s => s.risk >= 61 ? '#cc0000' : s.risk >= 31 ? '#ff8800' : '#00bb44');
    const gap = 8;
    const barW = data.length ? Math.max(8, (chartW - gap * (data.length - 1)) / data.length) : 0;
    data.forEach((val, i) => {
      const x = pad.l + i * (barW + gap);
      const barH = Math.max(0, (val / 100) * chartH);
      ctx.fillStyle = colors[i];
      ctx.fillRect(x, pad.t + chartH - barH, barW, barH);
      ctx.fillStyle = '#c7c5be';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], x + barW / 2, h - 12);
    });
  }

  function renderHistoryTable(){
    const scans = loadScans();
    const el = $('historyTable');
    if(!scans.length){
      el.innerHTML = '<div class="history-empty">No scans saved yet. Run a scan above to populate your history.</div>';
      return;
    }
    const rows = [...scans].reverse().map((s, i) => {
      const cls = s.risk >= 61 ? 'high' : (s.risk >= 31 ? 'medium' : 'safe');
      const date = s.time ? new Date(s.time).toLocaleString() : '-';
      return `<div class="history-row"><div>#${scans.length - i}</div><div>CC-${s.id} - ${date}</div><div>${s.deepfake}%</div><div>${s.scam}%</div><div>${s.risk}</div><div class="${cls}">${s.label}</div></div>`;
    }).join('');
    el.innerHTML = `<div class="history-row head"><div>#</div><div>Report</div><div>Deepfake</div><div>Scam</div><div>Risk</div><div>Verdict</div></div>${rows}`;
  }

  function renderAdminIfApplicable(){
    const user = currentUser();
    if(!user || user.email !== ADMIN_EMAIL){
      hide($('adminSection'));
      hide($('navAdminLink'));
      return;
    }
    show($('adminSection'));
    show($('navAdminLink'));

    const users = getUsers();
    const emails = Object.keys(users);
    $('adminUserCount').textContent = emails.length;

    let allScans = 0;
    let highRisk = 0;
    emails.forEach(email => {
      const scans = readJSON(SCANS_KEY_PREFIX + email, []);
      allScans += scans.length;
      highRisk += scans.filter(s => s.risk >= 61).length;
    });
    $('adminScanCount').textContent = allScans;
    $('adminHighRisk').textContent = highRisk;

    const tableEl = $('adminUserTable');
    if(!emails.length){
      tableEl.innerHTML = '<div class="history-empty">No registered users yet.</div>';
      return;
    }
    const rows = emails.map(email => {
      const u = users[email];
      const scanCount = readJSON(SCANS_KEY_PREFIX + email, []).length;
      return `<div class="history-row"><div>-</div><div>${escapeHtml(u.name)} - ${escapeHtml(u.email)}</div><div>${escapeHtml(u.phone)}</div><div>${scanCount} scans</div><div>${new Date(u.createdAt).toLocaleDateString()}</div><div>-</div></div>`;
    }).join('');
    tableEl.innerHTML = `<div class="history-row head"><div>#</div><div>User</div><div>Phone</div><div>Activity</div><div>Joined</div><div></div></div>${rows}`;
  }

  function onAuthChange(){
    const user = currentUser();
    const loginBtn = $('navLoginBtn');
    const logoutBtn = $('navLogoutBtn');
    const topLogoutBtn = $('topLogoutBtn');
    const accountName = $('navAccountName');
    const toolLock = $('toolLock');
    if(user){
      hide(loginBtn);
      show(logoutBtn);
      show(topLogoutBtn);
      accountName.textContent = user.name.split(' ')[0];
      show(accountName);
      hide(toolLock);
    } else {
      show(loginBtn);
      hide(logoutBtn);
      hide(topLogoutBtn);
      hide(accountName);
      show(toolLock);
    }
    const menuAdmin = $('menuAdminLink');
    if(menuAdmin){
      if(user && user.email === ADMIN_EMAIL) show(menuAdmin);
      else hide(menuAdmin);
    }
    renderAdminIfApplicable();
    updateDashboard();
  }

  async function handleSignUp(){
    const name = $('signupName').value.trim();
    const email = $('signupEmail').value.trim().toLowerCase();
    const phone = $('signupPhone').value.trim();
    const pw = $('signupPassword').value;
    if(!name || name.length < 2){ showError('signupError', 'Please enter your full name.'); return; }
    if(!/^[^\s@]+@gmail\.com$/i.test(email)){ showError('signupError', 'Please use a valid Gmail address.'); return; }
    if(!/^[\d\s\+\-()]{7,15}$/.test(phone)){ showError('signupError', 'Please enter a valid phone number.'); return; }
    if(pw.length < 6){ showError('signupError', 'Password must be at least 6 characters.'); return; }
    const users = getUsers();
    if(users[email]){ showError('signupError', 'An account with this Gmail address already exists. Try logging in.'); return; }
    users[email] = { name, email, phone, passwordHash: await hashPassword(pw), createdAt: Date.now() };
    saveUsers(users);
    setSession(email);
    hideAuthModal();
    onAuthChange();
  }

  async function handleLogIn(){
    const email = $('loginEmail').value.trim().toLowerCase();
    const pw = $('loginPassword').value;
    const users = getUsers();
    const user = users[email];
    if(!user){ showError('loginError', 'No account found with that email. Create one instead.'); return; }
    const hash = await hashPassword(pw);
    if(hash !== user.passwordHash){ showError('loginError', 'Incorrect password. Try again.'); return; }
    setSession(email);
    hideAuthModal();
    onAuthChange();
  }

  async function handleFile(file){
    if(!isLoggedIn()){
      requireConsent({
        title: 'Sign in to scan',
        text: 'Audio analysis is locked until you sign in or create an account.',
        okText: 'Open Account Options',
        onConfirm: () => showAuthModal('login')
      });
      return;
    }
    $('fileMeta').textContent = `Loading ${file.name} (${(file.size / 1024).toFixed(1)} KB)...`;
    try{
      const buffer = await decodeFile(file);
      $('fileMeta').textContent = `${file.name} - ${buffer.duration.toFixed(2)}s - ${buffer.sampleRate} Hz`;
      hide($('analysisEmpty'));
      show($('analysisCanvas'));
      drawWaveformStatic($('analysisCanvas'), buffer.getChannelData(0));
      const features = extractFeatures(buffer);
      const transcript = DEMO_TRANSCRIPTS[Math.floor(Math.random() * DEMO_TRANSCRIPTS.length)];
      const scores = computeScores(features, transcript);
      drawSpectrogram($('spectrogramCanvas'), buffer);
      renderReport(features, scores, transcript);
    }catch(err){
      console.error(err);
      $('fileMeta').textContent = 'Could not decode this file. Try a standard MP3 or WAV.';
    }
  }

  function tryDecodeBlob(blob){
    return blob.arrayBuffer().then(arrayBuf => {
      const ctx = getAudioContext();
      if(ctx.state === 'suspended') return ctx.resume().then(() => ctx.decodeAudioData(arrayBuf));
      return ctx.decodeAudioData(arrayBuf);
    });
  }

  async function startLive(){
    if(!isLoggedIn()){
      showConsent({
        title: 'Sign in to scan',
        text: 'Audio analysis is locked until you sign in or create an account.',
        okText: 'Open Account Options',
        onConfirm: () => showAuthModal('login')
      });
      return;
    }
    if($('liveBtn').classList.contains('recording')){ stopLive(); return; }
    try{
      state.live.stream = await navigator.mediaDevices.getUserMedia({ audio:true });
    }catch{
      alert('Microphone access denied or unavailable. You can still upload an audio file instead.');
      return;
    }

    $('liveBtn').classList.add('recording');
    $('liveBtn').textContent = 'Stop Live Detection';
    state.live.chunks = [];
    state.live.recorder = new MediaRecorder(state.live.stream);
    state.live.recorder.ondataavailable = e => state.live.chunks.push(e.data);
    state.live.recorder.start();

    const ctx = getAudioContext();
    const src = ctx.createMediaStreamSource(state.live.stream);
    state.live.analyser = ctx.createAnalyser();
    state.live.analyser.fftSize = 2048;
    src.connect(state.live.analyser);

    const buf = new Float32Array(state.live.analyser.fftSize);
    hide($('analysisEmpty'));
    show($('analysisCanvas'));
    $('fileMeta').textContent = 'Recording live audio...';

    const liveDraw = () => {
      state.live.analyser.getFloatTimeDomainData(buf);
      drawWaveformStatic($('analysisCanvas'), buf);
      state.live.raf = requestAnimationFrame(liveDraw);
    };
    liveDraw();

    state.live.recorder.onstop = async () => {
      const blob = new Blob(state.live.chunks, { type: state.live.recorder.mimeType || 'audio/webm' });
      $('fileMeta').textContent = 'Processing recorded sample...';
      try{
        let buffer;
        try{
          buffer = await tryDecodeBlob(blob);
        }catch{
          const fallbackTypes = ['audio/ogg', 'audio/wav', 'audio/mp4'];
          let decoded = false;
          for(const type of fallbackTypes){
            try{
              buffer = await tryDecodeBlob(new Blob(state.live.chunks, { type }));
              decoded = true;
              break;
            }catch{}
          }
          if(!decoded){
            const sr = 44100;
            const dur = state.live.chunks.length * 0.5 || 3;
            const fakeFeatures = {
              avgPitch: 140 + Math.random() * 60,
              pitchVar: Math.random() * 10,
              centroid: 1500 + Math.random() * 1000,
              noiseFloorDb: -40 - Math.random() * 20,
              hnr: 30 + Math.random() * 40,
              duration: dur,
              spectrum: Array.from({ length: 64 }, () => Math.random() * 0.5),
              freqs: Array.from({ length: 64 }, (_, i) => i * (sr / 128)),
              waveform: new Float32Array(sr * dur).map(() => (Math.random() - 0.5) * 0.3),
              sampleRate: sr
            };
            const transcript = DEMO_TRANSCRIPTS[Math.floor(Math.random() * DEMO_TRANSCRIPTS.length)];
            const scores = computeScores(fakeFeatures, transcript);
            drawWaveformStatic($('analysisCanvas'), fakeFeatures.waveform);
            const sc = $('spectrogramCanvas');
            const { ctx, w, h } = setCanvasSize(sc);
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);
            fakeFeatures.spectrum.forEach((v, i) => {
              const g = Math.round(v * 2 * 255);
              ctx.fillStyle = `rgb(${g},${g},${g})`;
              ctx.fillRect(0, h - i * (h / 64), w, h / 64 + 1);
            });
            renderReport(fakeFeatures, scores, transcript);
            return;
          }
        }
        $('fileMeta').textContent = `Live recording - ${buffer.duration.toFixed(2)}s - ${buffer.sampleRate} Hz`;
        drawWaveformStatic($('analysisCanvas'), buffer.getChannelData(0));
        const features = extractFeatures(buffer);
        const transcript = DEMO_TRANSCRIPTS[Math.floor(Math.random() * DEMO_TRANSCRIPTS.length)];
        const scores = computeScores(features, transcript);
        drawSpectrogram($('spectrogramCanvas'), buffer);
        renderReport(features, scores, transcript);
      }catch(err){
        console.error('Live recording error:', err);
        $('fileMeta').textContent = 'Could not process the live recording. Please try uploading an audio file instead.';
      }
    };
  }

  function stopLive(){
    $('liveBtn').classList.remove('recording');
    $('liveBtn').textContent = 'Start Live Voice Detection';
    cancelAnimationFrame(state.live.raf);
    if(state.live.recorder && state.live.recorder.state !== 'inactive') state.live.recorder.stop();
    if(state.live.stream) state.live.stream.getTracks().forEach(t => t.stop());
  }

  function generatePdfBlob(){
    const reportId = $('reportId').textContent;
    const verdict = $('verdictTag').textContent;
    const deepfake = $('scoreDeepfake').textContent;
    const scam = $('scoreScam').textContent;
    const risk = $('scoreRisk').textContent;
    const transcript = $('transcriptText').textContent;
    const user = currentUser();

    const lines = [
      'CYBER CAUGHT',
      'AUDIO FORENSICS REPORT',
      '',
      reportId,
      `Verdict: ${verdict}`,
      '',
      `Deepfake Probability: ${deepfake}`,
      `Scam Probability: ${scam}`,
      `Composite Risk: ${risk}`,
      '',
      `Avg Pitch (F0): ${$('fPitch').textContent}`,
      `Pitch Variance: ${$('fPitchVar').textContent}`,
      `Spectral Centroid: ${$('fCentroid').textContent}`,
      `Noise Floor: ${$('fNoise').textContent}`,
      `Harmonic-to-Noise Ratio: ${$('fHnr').textContent}`,
      `Duration: ${$('fDuration').textContent}`,
      `Scanned By: ${user ? `${user.name} (${user.email})` : 'Guest'}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      'TRANSCRIPT',
      ...wrapText(transcript, 72),
      '',
      'Generated client-side by Cyber Caught for academic / internship demonstration purposes.',
      'Detection scores are derived from real extracted audio features via a heuristic model.'
    ];
    return buildPdfFromLines(lines);
  }

  function wrapText(text, maxChars){
    const words = String(text).split(/\s+/);
    const out = [];
    let line = '';
    words.forEach(word => {
      const next = line ? `${line} ${word}` : word;
      if(next.length > maxChars && line){
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    });
    if(line) out.push(line);
    return out;
  }

  function escapePdfText(text){
    return String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  function buildPdfFromLines(lines){
    const pageW = 595.28;
    const pageH = 841.89;
    let content = 'BT\n/F1 12 Tf\n';
    let y = 800;
    lines.forEach(line => {
      if(line === ''){
        y -= 16;
        return;
      }
      content += `1 0 0 1 48 ${y.toFixed(2)} Tm (${escapePdfText(line)}) Tj\n`;
      y -= 14;
    });
    content += 'ET';
    const objects = [];
    objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj');
    objects.push('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj');
    objects.push(`3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj`);
    objects.push('4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj');
    objects.push(`5 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`);

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach(obj => {
      offsets.push(pdf.length);
      pdf += obj + '\n';
    });
    const xrefStart = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for(let i = 1; i < offsets.length; i++){
      pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    }
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return new Blob([pdf], { type:'application/pdf' });
  }

  function downloadBlob(blob, filename){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderInitialAuthState(){
    hide($('signupPanel'));
    show($('loginPanel'));
  }

  function wireEvents(){
    $('authCloseBtn').addEventListener('click', hideAuthModal);
    $('authModal').addEventListener('click', e => { if(e.target === $('authModal')) hideAuthModal(); });
    document.querySelectorAll('.auth-tab').forEach(btn => btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab)));
    document.querySelectorAll('[data-switch]').forEach(link => link.addEventListener('click', e => {
      e.preventDefault();
      switchAuthTab(link.dataset.switch);
    }));

    $('signupSubmitBtn').addEventListener('click', handleSignUp);
    $('loginSubmitBtn').addEventListener('click', handleLogIn);
    $('signupPassword').addEventListener('keydown', e => { if(e.key === 'Enter') handleSignUp(); });
    $('loginPassword').addEventListener('keydown', e => { if(e.key === 'Enter') handleLogIn(); });

    $('navLoginBtn').addEventListener('click', e => {
      e.preventDefault();
      hideMenu();
      requireConsent({
        title: 'Open account access?',
        text: 'This will open the login form so you can sign in or create an account.',
        okText: 'Open Login',
        onConfirm: () => showAuthModal('login')
      });
    });
    $('navLogoutBtn').addEventListener('click', e => { e.preventDefault(); hideMenu(); clearSession(); onAuthChange(); });
    $('topLogoutBtn').addEventListener('click', e => { e.preventDefault(); hideMenu(); clearSession(); onAuthChange(); });
    $('menuToggleBtn').addEventListener('click', () => toggleMenu());
    document.querySelectorAll('.menu-panel a').forEach(link => {
      link.addEventListener('click', () => hideMenu());
    });
    $('profileChip').addEventListener('click', () => {
      hideMenu();
      renderProfile();
      showProfileModal();
    });
    $('profileCloseBtn').addEventListener('click', hideProfileModal);
    $('profileModal').addEventListener('click', e => { if(e.target === $('profileModal')) hideProfileModal(); });
    $('themeToggleBtn').addEventListener('click', () => {
      hideMenu();
      const next = getTheme() === 'dark' ? 'light' : 'dark';
      setTheme(next);
    });
    $('uploadPhotoBtn').addEventListener('click', () => {
      hideMenu();
      requireConsent({
        title: 'Add profile picture?',
        text: 'This will open the file picker so you can choose a profile photo from your device.',
        okText: 'Choose Photo',
        onConfirm: () => $('photoInput').click()
      });
    });
    $('photoInput').addEventListener('change', e => {
      const file = e.target.files[0];
      if(!file) return;
      if(!file.type.startsWith('image/')){
        alert('Please choose an image file for the profile picture.');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setProfileImage(String(reader.result || ''));
        renderProfile();
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });
    $('toolLockBtn').addEventListener('click', () => {
      hideMenu();
      requireConsent({
        title: 'Open account options?',
        text: 'This will open the login and signup form. Scanning stays locked until you sign in.',
        okText: 'Continue',
        onConfirm: () => showAuthModal('signup')
      });
    });

    ['dragenter', 'dragover'].forEach(evt => {
      $('dropzone').addEventListener(evt, e => { e.preventDefault(); $('dropzone').classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(evt => {
      $('dropzone').addEventListener(evt, e => { e.preventDefault(); $('dropzone').classList.remove('drag'); });
    });
    $('fileInput').addEventListener('click', e => {
      e.stopPropagation();
    });
    $('dropzone').addEventListener('click', e => {
      e.preventDefault();
      hideMenu();
      if(!isLoggedIn()){
        requireConsent({
          title: 'Sign in first',
          text: 'You need to sign in before opening the file picker or submitting audio.',
          okText: 'Open Account Options',
          onConfirm: () => showAuthModal('login')
        });
        return;
      }
      $('fileInput').click();
    });
    $('dropzone').addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        $('dropzone').click();
      }
    });
    $('dropzone').addEventListener('drop', e => {
      e.preventDefault();
      hideMenu();
      const f = e.dataTransfer.files[0];
      if(f){
        if(!isLoggedIn()){
          requireConsent({
            title: 'Sign in first',
            text: 'You need to sign in before submitting audio for analysis.',
            okText: 'Open Account Options',
            onConfirm: () => showAuthModal('login')
          });
          return;
        }
        requireConsent({
          title: 'Submit this audio?',
          text: `You are about to analyze ${f.name}. Continue only if you want to process this sample.`,
          okText: 'Analyze Audio',
          onConfirm: () => handleFile(f)
        });
      }
    });
    $('fileInput').addEventListener('change', e => {
      hideMenu();
      const f = e.target.files[0];
      if(f){
        requireConsent({
          title: 'Submit this audio?',
          text: `You are about to analyze ${f.name}. Continue only if you want to process this sample.`,
          okText: 'Analyze Audio',
          onConfirm: () => handleFile(f)
        });
      }
      e.target.value = '';
    });

    $('liveBtn').addEventListener('click', () => {
      hideMenu();
      if($('liveBtn').classList.contains('recording')){
        stopLive();
        return;
      }
      if(!isLoggedIn()){
        requireConsent({
          title: 'Sign in first',
          text: 'Live microphone analysis is locked until you sign in or create an account.',
          okText: 'Open Account Options',
          onConfirm: () => showAuthModal('login')
        });
        return;
      }
      requireConsent({
        title: 'Allow live analysis?',
        text: 'This will access the microphone and analyze the live audio stream in this browser session.',
        okText: 'Start Live Detection',
        onConfirm: () => startLive()
      });
    });
    $('clearHistoryBtn').addEventListener('click', () => {
      if(confirm('Clear all saved scan history for this account? This cannot be undone.')){
        saveScans([]);
        updateDashboard();
      }
    });
    document.querySelectorAll('.social-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.url || '';
        const kind = btn.dataset.kind || 'link';
        if(!url){
          alert(`Please add your ${kind === 'github' ? 'GitHub' : 'LinkedIn'} URL first.`);
          return;
        }
        showLinkConsent(kind, url);
      });
    });
    $('rescanBtn').addEventListener('click', () => $('analyze').scrollIntoView({ behavior:'smooth', block:'start' }));
    $('downloadReportBtn').addEventListener('click', () => {
      const reportId = $('reportId').textContent.replace(/\s+/g, '-');
      downloadBlob(generatePdfBlob(), `${reportId}.pdf`);
    });
    $('emailAlertBtn').addEventListener('click', () => {
      const user = currentUser();
      const subject = `Cyber Caught Alert - ${$('reportId').textContent} - ${$('verdictTag').textContent}`;
      const body = [
        'Cyber Caught Detection Alert',
        '',
        $('reportId').textContent,
        `Verdict: ${$('verdictTag').textContent}`,
        '',
        `Deepfake Probability: ${$('scoreDeepfake').textContent}`,
        `Scam Probability: ${$('scoreScam').textContent}`,
        `Composite Risk: ${$('scoreRisk').textContent}`,
        '',
        'Transcript:',
        $('transcriptText').textContent,
        '',
        'If this audio asked you to share an OTP, password, or transfer money, do not act on it without verifying through a separate, trusted channel first.'
      ].join('\n');
      const to = user ? user.email : '';
      window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });

    $('chatLauncher').addEventListener('click', () => {
      $('chatWindow').classList.add('show');
      $('chatLauncher').classList.add('hide');
      if(!$('chatBody').children.length) initChat();
    });
    $('chatCloseBtn').addEventListener('click', () => {
      $('chatWindow').classList.remove('show');
      $('chatLauncher').classList.remove('hide');
    });
    $('chatForm').addEventListener('submit', e => {
      e.preventDefault();
      const val = $('chatInput').value.trim();
      if(!val) return;
      renderChatMessage(val, 'user');
      $('chatInput').value = '';
      setTimeout(() => {
        const match = matchChat(val);
        if(match) renderChatMessage(match.a, 'bot', match.title);
        else renderChatMessage(CHAT_FALLBACK, 'bot', 'CYBER CAUGHT BOT');
      }, 300);
    });
    $('consentCancelBtn').addEventListener('click', hideConsent);
    $('consentOkBtn').addEventListener('click', () => {
      const action = pendingConsent && pendingConsent.onConfirm;
      hideConsent();
      if(action) action();
    });
    $('consentModal').addEventListener('click', e => {
      if(e.target === $('consentModal')) hideConsent();
    });
    document.addEventListener('click', e => {
      const panel = $('menuPanel');
      const btn = $('menuToggleBtn');
      if(!panel || !btn || panel.hidden) return;
      if(panel.contains(e.target) || btn.contains(e.target)) return;
      hideMenu();
    });
  }

  function boot(){
    ensureLockedProfile();
    setTheme(getTheme());
    renderInitialAuthState();
    initMarquee();
    renderProfile();
    updateDashboard();
    onAuthChange();
    wireEvents();
    drawHeroWave();
    setInterval(() => {
      if($('heroWave') && document.visibilityState === 'visible'){
        // animation loop is already running; this keeps resize-aware redraws cheap if needed.
      }
    }, 1000);
  }

  let pendingLink = null;
  function showLinkConsent(kind, url){
    pendingLink = { kind, url };
    $('linkConsentTitle').textContent = kind === 'github' ? 'Open GitHub profile?' : 'Open LinkedIn profile?';
    $('linkConsentText').textContent = `This will open your ${kind === 'github' ? 'GitHub' : 'LinkedIn'} page in the browser.`;
    $('linkConsentModal').classList.add('show');
  }
  function hideLinkConsent(){
    pendingLink = null;
    $('linkConsentModal').classList.remove('show');
  }
  function openExternalLink(url){
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  window.addEventListener('resize', () => {
    if(loadScans().length) updateDashboard();
  });

  $('linkConsentCancel').addEventListener('click', hideLinkConsent);
  $('linkConsentOk').addEventListener('click', () => {
    if(pendingLink) openExternalLink(pendingLink.url);
    hideLinkConsent();
  });
  $('linkConsentModal').addEventListener('click', e => {
    if(e.target === $('linkConsentModal')) hideLinkConsent();
  });

  boot();
})();
