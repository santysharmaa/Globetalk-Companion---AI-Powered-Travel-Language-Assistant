document.addEventListener('DOMContentLoaded', function () {

    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const selectedLanguageSpan = document.getElementById('selected-language');
    const languageList = document.getElementById('language-list');
    const phraseCategories = document.querySelectorAll('.cat-btn');
    const quickPhrases = document.querySelectorAll('.quick-phrase');
    const clearChatButton = document.getElementById('clear-chat');
    const toggleVoiceButton = document.getElementById('toggle-voice');
    const savePhrasesButton = document.getElementById('save-phrases');
    const savedPhrasesModal = document.getElementById('saved-phrases-modal');
    const closeModalButton = document.getElementById('close-modal');
    const savedPhrasesList = document.getElementById('saved-phrases-list');
    const addLanguageBtn = document.getElementById('add-language-btn');
    const customLanguageInput = document.getElementById('custom-language');
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const exportPhrasesBtn = document.getElementById('export-phrases-btn');
    const micButton = document.getElementById('mic-button');
    const toastContainer = document.getElementById('toast-container');

    let GEMINI_API_KEY = localStorage.getItem('geminiApiKey') || '';
    let currentLanguage = 'Spanish';
    let voiceEnabled = true;
    let savedPhrases = JSON.parse(localStorage.getItem('savedPhrases')) || [];
    let isDarkMode = localStorage.getItem('darkMode') === 'true';
    let isListening = false;
    let recognition = null;

    if (isDarkMode) {
        document.documentElement.classList.add('dark');
        themeIcon.classList.replace('fa-moon', 'fa-sun');
    }

    showWelcome();
    updateSavedPhrasesList();

    // Live getter — includes dynamically added buttons (bug fix)
    function getAllLangButtons() {
        return languageList.querySelectorAll('.lang-btn');
    }

    // Language selection via event delegation
    languageList.addEventListener('click', function (e) {
        const btn = e.target.closest('.lang-btn');
        if (!btn) return;
        setActiveLanguage(btn.getAttribute('data-lang'), btn);
    });

    // Add custom language
    addLanguageBtn.addEventListener('click', addCustomLanguage);
    customLanguageInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') addCustomLanguage();
    });

    function addCustomLanguage() {
        const customLang = customLanguageInput.value.trim();
        if (!customLang) return;
        const existing = [...getAllLangButtons()].find(
            b => b.getAttribute('data-lang').toLowerCase() === customLang.toLowerCase()
        );
        if (existing) {
            setActiveLanguage(existing.getAttribute('data-lang'), existing);
            customLanguageInput.value = '';
            return;
        }
        const btn = document.createElement('button');
        btn.className = 'lang-btn';
        btn.setAttribute('data-lang', customLang);
        btn.innerHTML = `🌐 ${customLang}`;
        const inputWrap = customLanguageInput.parentElement;
        languageList.insertBefore(btn, inputWrap);
        setActiveLanguage(customLang, btn);
        customLanguageInput.value = '';
    }

    phraseCategories.forEach(cat => {
        cat.addEventListener('click', function () {
            askForPhraseCategory(this.getAttribute('data-category'));
        });
    });

    quickPhrases.forEach(phrase => {
        phrase.addEventListener('click', function () {
            userInput.value = this.textContent.replace(/^[^\w]+/, '').trim();
            sendMessage();
        });
    });

    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    clearChatButton.addEventListener('click', function () {
        chatMessages.innerHTML = '';
        showWelcome();
    });

    toggleVoiceButton.addEventListener('click', function () {
        voiceEnabled = !voiceEnabled;
        this.innerHTML = voiceEnabled
            ? '<i class="fas fa-volume-up mr-1"></i>Voice: On'
            : '<i class="fas fa-volume-mute mr-1"></i>Voice: Off';
        showToast(`Voice ${voiceEnabled ? 'enabled' : 'disabled'}`, 'info');
    });

    savePhrasesButton.addEventListener('click', () => savedPhrasesModal.classList.remove('hidden'));
    closeModalButton.addEventListener('click', () => savedPhrasesModal.classList.add('hidden'));
    savedPhrasesModal.addEventListener('click', e => {
        if (e.target === savedPhrasesModal) savedPhrasesModal.classList.add('hidden');
    });

    themeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        localStorage.setItem('darkMode', isDarkMode);
        document.documentElement.classList.toggle('dark');
        themeIcon.classList.replace(
            isDarkMode ? 'fa-moon' : 'fa-sun',
            isDarkMode ? 'fa-sun' : 'fa-moon'
        );
    });

    settingsBtn.addEventListener('click', () => {
        apiKeyInput.value = localStorage.getItem('geminiApiKey') || '';
        settingsModal.classList.remove('hidden');
    });
    closeSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
    settingsModal.addEventListener('click', e => {
        if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });

    saveSettingsBtn.addEventListener('click', () => {
        const newKey = apiKeyInput.value.trim();
        if (newKey) { localStorage.setItem('geminiApiKey', newKey); GEMINI_API_KEY = newKey; }
        else { localStorage.removeItem('geminiApiKey'); GEMINI_API_KEY = ''; }
        settingsModal.classList.add('hidden');
        showToast('Settings saved!', 'success');
    });

    exportPhrasesBtn.addEventListener('click', () => {
        if (savedPhrases.length === 0) { showToast('No phrases to export', 'info'); return; }
        let csv = 'Language,Phrase,Date\n';
        savedPhrases.forEach(p => {
            csv += `"${p.language}","${p.text.replace(/"/g, '""')}","${p.date}"\n`;
        });
        const link = document.createElement('a');
        link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
        link.download = 'globetalk_phrases.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Phrases exported!', 'success');
    });

    // Voice input
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SR();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onstart = () => { isListening = true; micButton.classList.add('listening'); showToast('Listening…', 'info'); };
        recognition.onresult = e => { userInput.value = e.results[0][0].transcript; };
        recognition.onerror = e => { isListening = false; micButton.classList.remove('listening'); showToast('Mic error: ' + e.error, 'error'); };
        recognition.onend = () => {
            isListening = false;
            micButton.classList.remove('listening');
            if (userInput.value.trim()) sendMessage();
        };
        micButton.addEventListener('click', () => {
            if (isListening) { recognition.stop(); }
            else { recognition.lang = getLanguageCode(currentLanguage); recognition.start(); }
        });
    } else {
        micButton.addEventListener('click', () => showToast('Speech recognition not supported', 'error'));
    }

    // ── Core functions ──

    function setActiveLanguage(language, clickedBtn) {
        getAllLangButtons().forEach(b => b.classList.remove('active'));
        if (clickedBtn) clickedBtn.classList.add('active');
        currentLanguage = language;
        selectedLanguageSpan.textContent = language;
        chatMessages.innerHTML = '';
        showWelcome();
    }

    function showWelcome() {
        const greetings = {
            Spanish: '¡Hola', French: 'Bonjour', Italian: 'Ciao',
            German: 'Hallo', Japanese: 'こんにちは', Mandarin: '你好',
            Arabic: 'مرحباً', Portuguese: 'Olá'
        };
        const greeting = greetings[currentLanguage] || '👋 Hello';
        addBotMessage(`${greeting}! I'm your GlobeTalk travel assistant. I'm ready to help you with essential **${currentLanguage}** phrases for your journey. Try a quick phrase above or ask me anything! 🌍`, true);
    }

    function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;
        addUserMessage(message);
        userInput.value = '';
        const loadingId = addLoadingIndicator();
        callGeminiAPI(message, currentLanguage).then(resp => {
            removeLoadingIndicator(loadingId);
            addBotMessage(resp);
        }).catch(() => {
            removeLoadingIndicator(loadingId);
            addBotMessage('Sorry, I ran into an error. Please check your connection and try again.');
        });
    }

    function askForPhraseCategory(category) {
        addUserMessage(`Show me common ${category} phrases in ${currentLanguage}`);
        const loadingId = addLoadingIndicator();
        callGeminiAPI(
            `Show me 5 essential ${category} phrases for travelers in ${currentLanguage}. For each one provide: the phrase in ${currentLanguage}, a simple phonetic pronunciation, and the English translation. Format clearly with numbers.`,
            currentLanguage
        ).then(resp => {
            removeLoadingIndicator(loadingId);
            addBotMessage(resp);
        }).catch(() => {
            removeLoadingIndicator(loadingId);
            addBotMessage('Sorry, I ran into an error. Please try again.');
        });
    }

    function addUserMessage(text) {
        const wrap = document.createElement('div');
        wrap.className = 'user-msg-wrap';
        wrap.innerHTML = `<div class="user-bubble">${escapeHtml(text)}</div>`;
        chatMessages.appendChild(wrap);
        scrollToBottom();
    }

    function addBotMessage(message, isWelcome = false) {
        const wrap = document.createElement('div');
        wrap.className = 'bot-msg-wrap';

        let html = message;
        try {
            if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
                const parseFn = typeof marked.parse === 'function' ? marked.parse : marked;
                html = DOMPurify.sanitize(parseFn(message));
            }
        } catch (e) { /* fallback */ }

        const actions = isWelcome ? '' : `
            <div class="bubble-actions">
                <button class="bubble-action-btn save-btn-msg"><i class="fas fa-bookmark"></i> Save</button>
                <button class="bubble-action-btn speak-btn-msg"><i class="fas fa-volume-up"></i> Speak</button>
                <button class="bubble-action-btn copy-btn-msg"><i class="fas fa-copy"></i> Copy</button>
            </div>`;

        wrap.innerHTML = `
            <div class="bot-bubble-outer">
                <div class="bot-avatar"><i class="fas fa-robot"></i></div>
                <div>
                    <div class="bot-bubble">
                        <div class="bot-content">${html}</div>
                        ${actions}
                    </div>
                </div>
            </div>`;

        chatMessages.appendChild(wrap);
        scrollToBottom();

        if (!isWelcome) {
            wrap.querySelector('.save-btn-msg').addEventListener('click', function () {
                savePhrase(message, currentLanguage);
                this.innerHTML = '<i class="fas fa-check"></i> Saved';
                this.disabled = true;
                showToast('Phrase saved!', 'success');
            });
            wrap.querySelector('.speak-btn-msg').addEventListener('click', function () {
                speakText(wrap.querySelector('.bot-content').textContent);
            });
            wrap.querySelector('.copy-btn-msg').addEventListener('click', function () {
                navigator.clipboard.writeText(wrap.querySelector('.bot-content').textContent)
                    .then(() => showToast('Copied!', 'success'));
            });

            if (voiceEnabled) {
                const tmp = document.createElement('div');
                tmp.innerHTML = html;
                speakText(tmp.textContent);
            }
        }
    }

    function addLoadingIndicator() {
        const id = 'loading-' + Date.now();
        const wrap = document.createElement('div');
        wrap.className = 'bot-msg-wrap';
        wrap.id = id;
        wrap.innerHTML = `
            <div class="bot-bubble-outer">
                <div class="bot-avatar"><i class="fas fa-robot"></i></div>
                <div class="bot-bubble">
                    <div class="loading-dots"><span></span><span></span><span></span></div>
                </div>
            </div>`;
        chatMessages.appendChild(wrap);
        scrollToBottom();
        return id;
    }

    function removeLoadingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function savePhrase(text, language) {
        savedPhrases.push({ id: Date.now(), text, language, date: new Date().toLocaleDateString() });
        localStorage.setItem('savedPhrases', JSON.stringify(savedPhrases));
        updateSavedPhrasesList();
    }

    function updateSavedPhrasesList() {
        if (savedPhrases.length === 0) {
            savedPhrasesList.innerHTML = '<p class="empty-msg text-center py-6">No saved phrases yet</p>';
            return;
        }
        savedPhrasesList.innerHTML = '';
        [...savedPhrases].reverse().forEach(phrase => {
            const item = document.createElement('div');
            item.className = 'saved-item';
            item.innerHTML = `
                <div class="flex-1 min-w-0">
                    <p class="saved-lang">${phrase.language}</p>
                    <p class="saved-text">${escapeHtml(phrase.text.substring(0, 120))}${phrase.text.length > 120 ? '…' : ''}</p>
                    <p class="saved-date">${phrase.date}</p>
                </div>
                <div class="flex gap-1">
                    <button class="icon-btn speak-s" title="Speak"><i class="fas fa-volume-up text-xs"></i></button>
                    <button class="icon-btn del-s" title="Delete"><i class="fas fa-trash text-xs"></i></button>
                </div>`;
            item.querySelector('.speak-s').addEventListener('click', () => speakText(phrase.text));
            item.querySelector('.del-s').addEventListener('click', () => {
                savedPhrases = savedPhrases.filter(p => p.id !== phrase.id);
                localStorage.setItem('savedPhrases', JSON.stringify(savedPhrases));
                updateSavedPhrasesList();
            });
            savedPhrasesList.appendChild(item);
        });
    }

    function speakText(text) {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        const voices = speechSynthesis.getVoices();
        const voice = voices.find(v => v.lang.startsWith(getLanguageCode(currentLanguage)));
        if (voice) utt.voice = voice;
        speechSynthesis.speak(utt);
    }

    function getLanguageCode(language) {
        return {
            'Spanish': 'es', 'French': 'fr', 'Italian': 'it', 'German': 'de',
            'Japanese': 'ja', 'Mandarin': 'zh', 'Arabic': 'ar', 'Portuguese': 'pt'
        }[language] || 'en';
    }

    if ('speechSynthesis' in window) {
        speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
        speechSynthesis.getVoices();
    }

    async function callGeminiAPI(message, language) {
        if (!GEMINI_API_KEY) {
            return `⚠️ **No API key configured.**\n\nClick the ⚙️ **Settings** button in the top-right corner to enter your Gemini API key.\nGet a free key at [Google AI Studio](https://aistudio.google.com/apikey).`;
        }

        const prompt = `You are GlobeTalk, a friendly and expert travel language assistant.
The user wants to learn phrases in ${language}.
Provide accurate translations, simple phonetic pronunciation guides, and brief cultural tips when relevant.
Keep responses practical, well-formatted with markdown, and focused on travel scenarios.

User: ${message}`;

        try {
            const resp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                }
            );

            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                console.error('Gemini HTTP error:', resp.status, errData);
                if (resp.status === 400 || resp.status === 403) {
                    return `⚠️ **Invalid API key.** Go to ⚙️ Settings and enter a valid key from [Google AI Studio](https://aistudio.google.com/apikey).`;
                }
                return `Sorry, I hit an error (HTTP ${resp.status}). Please try again.`;
            }

            const data = await resp.json();
            if (data.error) return 'API error: ' + (data.error.message || 'Unknown');
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                return data.candidates[0].content.parts[0].text;
            }
            return "I couldn't generate a response. Please rephrase your question.";
        } catch (err) {
            console.error('Gemini call failed:', err);
            return "Connection error. Please check your internet and try again.";
        }
    }

    function showToast(message, type = 'info') {
        const t = document.createElement('div');
        t.className = `toast toast-${type}`;
        const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
        t.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
        toastContainer.appendChild(t);
        setTimeout(() => { t.classList.add('fade-out'); setTimeout(() => t.remove(), 300); }, 3000);
    }

    function escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});