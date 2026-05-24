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
    const exportPhrasesBtn = document.getElementById('export-phrases-btn');
    const micButton = document.getElementById('mic-button');
    const toastContainer = document.getElementById('toast-container');

    let currentLanguage = 'Spanish';
    let voiceEnabled = true;
    let savedPhrases = JSON.parse(localStorage.getItem('savedPhrases')) || [];
    let isDarkMode = localStorage.getItem('darkMode') === 'true';
    let isListening = false;
    let recognition = null;
    let activeUtterance = null;
    
    let translatorInstance = null;
    let currentTranslatorLang = null;

    const categoryPhrases = {
        'Greetings': ['Hello', 'Good morning', 'How are you?', 'Nice to meet you', 'Goodbye'],
        'Emergencies': ['Help me!', 'Call the police', 'I need a doctor', 'Where is the hospital?', 'I lost my passport'],
        'Dining': ['A table for two, please', 'Can I see the menu?', 'I would like to order', 'Water, please', 'The bill, please'],
        'Transportation': ['Where is the train station?', 'I would like a ticket', 'How much is the fare?', 'Take me to the airport', 'Stop here, please'],
        'Accommodation': ['I have a reservation', 'Do you have any free rooms?', 'Is breakfast included?', 'My room key, please', 'I would like to check out'],
        'Shopping': ['How much does this cost?', 'Do you have this in a different size?', 'I would like to buy this', 'Can I pay by card?', 'Just looking, thank you'],
        'Directions': ['Where is the bathroom?', 'How do I get to the city center?', 'Is it far?', 'Go straight', 'Turn left', 'Turn right'],
        'Numbers': ['One, two, three', 'Four, five, six', 'Seven, eight, nine', 'Ten', 'Hundred']
    };

    if (isDarkMode) {
        document.documentElement.classList.add('dark');
        themeIcon.classList.replace('fa-moon', 'fa-sun');
    }

    showWelcome();
    updateSavedPhrasesList();
    initTranslator(currentLanguage);

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
        if (!voiceEnabled) stopSpeaking(false);
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
        initTranslator(language);
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
        callLocalTranslationAPI(message).then(resp => {
            removeLoadingIndicator(loadingId);
            addBotMessage(resp);
        }).catch(() => {
            removeLoadingIndicator(loadingId);
            addBotMessage('Sorry, I ran into an error translating locally. Please make sure the Chrome Translation API is enabled.');
        });
    }

    async function askForPhraseCategory(category) {
        addUserMessage(`Show me common ${category} phrases in ${currentLanguage}`);
        const phrases = categoryPhrases[category] || [];
        if (phrases.length === 0) return;
        
        const loadingId = addLoadingIndicator();
        try {
            let resultHtml = `**Common ${category} Phrases:**\n\n`;
            for (let i = 0; i < phrases.length; i++) {
                const englishPhrase = phrases[i];
                const translated = await callLocalTranslationAPI(englishPhrase);
                resultHtml += `${i + 1}. **${englishPhrase}**\n   &rarr; ${translated}\n\n`;
            }
            removeLoadingIndicator(loadingId);
            addBotMessage(resultHtml);
        } catch(e) {
            removeLoadingIndicator(loadingId);
            addBotMessage('Sorry, I ran into an error translating locally.');
        }
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
                <button class="bubble-action-btn stop-btn-msg"><i class="fas fa-volume-mute"></i> Stop</button>
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
            wrap.querySelector('.stop-btn-msg').addEventListener('click', function () {
                stopSpeaking();
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
                    <button class="icon-btn stop-s" title="Stop pronunciation"><i class="fas fa-volume-mute text-xs"></i></button>
                    <button class="icon-btn del-s" title="Delete"><i class="fas fa-trash text-xs"></i></button>
                </div>`;
            item.querySelector('.speak-s').addEventListener('click', () => speakText(phrase.text));
            item.querySelector('.stop-s').addEventListener('click', () => stopSpeaking());
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
        stopSpeaking(false);
        const utt = new SpeechSynthesisUtterance(text);
        activeUtterance = utt;
        utt.onend = () => {
            if (activeUtterance === utt) activeUtterance = null;
        };
        utt.onerror = () => {
            if (activeUtterance === utt) activeUtterance = null;
        };
        const voices = speechSynthesis.getVoices();
        const voice = voices.find(v => v.lang.startsWith(getLanguageCode(currentLanguage)));
        if (voice) utt.voice = voice;
        speechSynthesis.speak(utt);
    }

    function stopSpeaking(showNotification = true) {
        if (!('speechSynthesis' in window)) return;
        if (activeUtterance || window.speechSynthesis.speaking || window.speechSynthesis.pending) {
            window.speechSynthesis.cancel();
            activeUtterance = null;
            if (showNotification) showToast('Pronunciation stopped', 'info');
        }
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

    function updateAiStatus(text, statusType) {
        const aiStatusText = document.getElementById('ai-status-text');
        const aiStatusDot = document.getElementById('ai-status-dot');
        if(!aiStatusText || !aiStatusDot) return;
        
        aiStatusText.textContent = text;
        aiStatusDot.className = 'inline-block w-1.5 h-1.5 rounded-full';
        
        if(statusType === 'success') {
            aiStatusDot.classList.add('bg-green-400');
        } else if(statusType === 'error') {
            aiStatusDot.classList.add('bg-red-500');
        } else if(statusType === 'download') {
            aiStatusDot.classList.add('bg-yellow-400', 'animate-pulse');
        } else {
            aiStatusDot.classList.add('bg-indigo-400', 'animate-pulse');
        }
    }

    async function initTranslator(targetLangName) {
        const langCode = getLanguageCode(targetLangName);
        const TranslatorAPI = self.Translator || (self.ai && self.ai.translator) || self.translation;
        
        if (!TranslatorAPI) {
            updateAiStatus('Chrome API Not Supported', 'error');
            return false;
        }

        try {
            updateAiStatus('Checking local model...', 'info');
            let canTranslate = 'readily';
            
            if (TranslatorAPI.capabilities) {
                const caps = await TranslatorAPI.capabilities();
                canTranslate = caps.languagePairAvailable ? caps.languagePairAvailable('en', langCode) : caps.languageAvailable('en', langCode);
            } else if (TranslatorAPI.availability) {
                canTranslate = await TranslatorAPI.availability();
            }

            if (canTranslate === 'no') {
                updateAiStatus(`Language not supported locally`, 'error');
                return false;
            }

            if (canTranslate !== 'readily') {
                updateAiStatus('Downloading model...', 'download');
            }

            if (translatorInstance && currentTranslatorLang !== langCode) {
                if (translatorInstance.destroy) translatorInstance.destroy();
                translatorInstance = null;
            }

            if (!translatorInstance) {
                translatorInstance = await TranslatorAPI.create({
                    sourceLanguage: 'en',
                    targetLanguage: langCode
                });
                currentTranslatorLang = langCode;
            }

            updateAiStatus('Chrome Local AI Ready', 'success');
            return true;
        } catch (e) {
            console.error('Translation init error', e);
            updateAiStatus('Failed to load AI', 'error');
            return false;
        }
    }

    async function callLocalTranslationAPI(text) {
        if(!translatorInstance) {
            const initialized = await initTranslator(currentLanguage);
            if(!initialized) {
                return `⚠️ **Chrome Local AI Not Supported or Failed to Load.**\n\nEnsure you are using Google Chrome with the \`#translation-api\` flag enabled in \`chrome://flags\`.`;
            }
        }
        
        try {
            const translatedText = await translatorInstance.translate(text);
            return translatedText;
        } catch(e) {
            console.error('Translation failed', e);
            return "Local translation failed. Please try again.";
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
