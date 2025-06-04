
        document.addEventListener('DOMContentLoaded', function() {
            const chatMessages = document.getElementById('chat-messages');
            const userInput = document.getElementById('user-input');
            const sendButton = document.getElementById('send-button');
            const selectedLanguageSpan = document.getElementById('selected-language');
            const languageButtons = document.querySelectorAll('.language-btn');
            const phraseCategories = document.querySelectorAll('.phrase-category');
            const quickPhrases = document.querySelectorAll('.quick-phrase');
            const clearChatButton = document.getElementById('clear-chat');
            const toggleVoiceButton = document.getElementById('toggle-voice');
            const savePhrasesButton = document.getElementById('save-phrases');
            const savedPhrasesModal = document.getElementById('saved-phrases-modal');
            const closeModalButton = document.getElementById('close-modal');
            const savedPhrasesList = document.getElementById('saved-phrases-list');
            const addLanguageBtn = document.getElementById('add-language-btn');
            const customLanguageInput = document.getElementById('custom-language');
            
            // Gemini API key
            const GEMINI_API_KEY = 'AIzaSyAIhillMZ963KFZrco06C5GmE-FKLFO_XM';
            
            // State variables
            let currentLanguage = 'Spanish';
            let voiceEnabled = true;
            let savedPhrases = JSON.parse(localStorage.getItem('savedPhrases')) || [];
            
            // Initialize saved phrases display
            updateSavedPhrasesList();
            
            // Event listeners
            sendButton.addEventListener('click', sendMessage);
            userInput.addEventListener('keypress', function(event) {
                if (event.key === 'Enter') {
                    sendMessage();
                }
            });
            
            // Language selection
            languageButtons.forEach(button => {
                button.addEventListener('click', function() {
                    const lang = this.getAttribute('data-lang');
                    setActiveLanguage(lang, this);
                });
            });
            
            // Add custom language
            addLanguageBtn.addEventListener('click', function() {
                const customLang = customLanguageInput.value.trim();
                if (customLang) {
                    // Create new button
                    const newLangBtn = document.createElement('button');
                    newLangBtn.className = 'language-btn w-full py-2 px-4 rounded-md bg-indigo-100 hover:bg-indigo-200 text-left';
                    newLangBtn.setAttribute('data-lang', customLang);
                    newLangBtn.innerHTML = `<i class="fas fa-globe mr-2"></i> ${customLang}`;
                    
                    // Add event listener
                    newLangBtn.addEventListener('click', function() {
                        const lang = this.getAttribute('data-lang');
                        setActiveLanguage(lang, this);
                    });
                    
                    // Insert before the custom input container
                    customLanguageInput.parentElement.parentElement.insertBefore(newLangBtn, customLanguageInput.parentElement);
                    
                    // Select the new language
                    setActiveLanguage(customLang, newLangBtn);
                    
                    // Clear input
                    customLanguageInput.value = '';
                }
            });
            
            // Phrase categories
            phraseCategories.forEach(category => {
                category.addEventListener('click', function() {
                    const categoryName = this.getAttribute('data-category');
                    askForPhraseCategory(categoryName);
                });
            });
            
            // Quick phrases
            quickPhrases.forEach(phrase => {
                phrase.addEventListener('click', function() {
                    const phraseText = this.textContent;
                    userInput.value = phraseText;
                    sendMessage();
                });
            });
            
            // Clear chat
            clearChatButton.addEventListener('click', function() {
                chatMessages.innerHTML = '';
                addBotMessage(`👋 I'm your travel language assistant. I can help you learn essential ${currentLanguage} phrases for your travels. Ask me how to say something or select a category above to get started!`);
            });
            
            // Toggle voice
            toggleVoiceButton.addEventListener('click', function() {
                voiceEnabled = !voiceEnabled;
                this.innerHTML = voiceEnabled ? 
                    '<i class="fas fa-volume-up mr-1"></i> Voice: On' : 
                    '<i class="fas fa-volume-mute mr-1"></i> Voice: Off';
            });
            
            // Saved phrases modal
            savePhrasesButton.addEventListener('click', function() {
                savedPhrasesModal.classList.remove('hidden');
            });
            
            closeModalButton.addEventListener('click', function() {
                savedPhrasesModal.classList.add('hidden');
            });
            
            // Close modal if clicking outside
            savedPhrasesModal.addEventListener('click', function(e) {
                if (e.target === savedPhrasesModal) {
                    savedPhrasesModal.classList.add('hidden');
                }
            });
            
            // Helper functions
            function setActiveLanguage(language, button) {
                // Update UI
                languageButtons.forEach(btn => btn.classList.remove('active'));
                if (button) button.classList.add('active');
                selectedLanguageSpan.textContent = language;
                
                // Update state
                currentLanguage = language;
                
                // Update welcome message
                chatMessages.innerHTML = '';
                addBotMessage(`👋 I'm your travel language assistant. I can help you learn essential ${currentLanguage} phrases for your travels. Ask me how to say something or select a category above to get started!`);
            }
            
            function sendMessage() {
                const message = userInput.value.trim();
                if (!message) return;
                
                // Add user message to chat
                addUserMessage(message);
                
                // Clear input
                userInput.value = '';
                
                // Add loading indicator
                const loadingId = addLoadingIndicator();
                
                // Call Gemini API
                callGeminiAPI(message, currentLanguage).then(response => {
                    // Remove loading indicator
                    removeLoadingIndicator(loadingId);
                    
                    // Add bot response
                    addBotMessage(response);
                }).catch(error => {
                    // Remove loading indicator
                    removeLoadingIndicator(loadingId);
                    
                    // Add error message
                    addBotMessage("Sorry, I encountered an error. Please try again later.");
                    console.error("API Error:", error);
                });
            }
            
            function askForPhraseCategory(category) {
                addUserMessage(`Show me common ${category} phrases in ${currentLanguage}`);
                
                // Add loading indicator
                const loadingId = addLoadingIndicator();
                
                // Call Gemini API
                callGeminiAPI(`Show me 5 essential ${category} phrases for travelers in ${currentLanguage}. Include the phrase in ${currentLanguage}, the pronunciation guide, and English translation.`, currentLanguage).then(response => {
                    // Remove loading indicator
                    removeLoadingIndicator(loadingId);
                    
                    // Add bot response
                    addBotMessage(response);
                }).catch(error => {
                    // Remove loading indicator
                    removeLoadingIndicator(loadingId);
                    
                    // Add error message
                    addBotMessage("Sorry, I encountered an error. Please try again later.");
                    console.error("API Error:", error);
                });
            }
            
            function addUserMessage(message) {
                const messageElement = document.createElement('div');
                messageElement.className = 'user-message p-4 ml-auto max-w-[80%] zoom-in';
                messageElement.innerHTML = `
                    <div class="flex items-start justify-end">
                        <div>
                            <p class="text-gray-700">${message}</p>
                        </div>
                        <div class="rounded-full bg-indigo-100 p-2 ml-3">
                            <i class="fas fa-user text-indigo-600"></i>
                        </div>
                    </div>
                `;
                chatMessages.appendChild(messageElement);
                scrollToBottom();
            }
            
            function addBotMessage(message) {
                const messageElement = document.createElement('div');
                messageElement.className = 'bot-message p-4 max-w-[80%] zoom-in';
                
                // Create save button for non-welcome messages
                const saveButton = !message.includes("👋 I'm your travel language assistant") ? 
                    `<button class="save-phrase-btn text-xs text-indigo-600 mt-2 hover:text-indigo-800">
                        <i class="fas fa-bookmark mr-1"></i> Save phrase
                    </button>` : '';
                
                // Add speak button for non-welcome messages
                const speakButton = !message.includes("👋 I'm your travel language assistant") ? 
                    `<button class="speak-phrase-btn text-xs text-indigo-600 mt-2 ml-3 hover:text-indigo-800">
                        <i class="fas fa-volume-up mr-1"></i> Speak
                    </button>` : '';
                
                messageElement.innerHTML = `
                    <div class="flex items-start">
                        <div class="rounded-full bg-indigo-100 p-2 mr-3">
                            <i class="fas fa-robot text-indigo-600"></i>
                        </div>
                        <div>
                            <p class="text-gray-700">${message}</p>
                            <div class="flex">
                                ${saveButton}
                                ${speakButton}
                            </div>
                        </div>
                    </div>
                `;
                chatMessages.appendChild(messageElement);
                scrollToBottom();
                
                // Add event listeners for save and speak buttons
                const saveBtns = messageElement.querySelectorAll('.save-phrase-btn');
                saveBtns.forEach(btn => {
                    btn.addEventListener('click', function() {
                        const phraseText = this.parentElement.previousElementSibling.textContent;
                        savePhrase(phraseText, currentLanguage);
                        this.innerHTML = '<i class="fas fa-check mr-1"></i> Saved';
                        this.disabled = true;
                    });
                });
                
                const speakBtns = messageElement.querySelectorAll('.speak-phrase-btn');
                speakBtns.forEach(btn => {
                    btn.addEventListener('click', function() {
                        const phraseText = this.parentElement.previousElementSibling.textContent;
                        speakText(phraseText);
                    });
                });
                
                // Auto-speak response if enabled
                if (voiceEnabled && !message.includes("👋 I'm your travel language assistant")) {
                    speakText(message);
                }
            }
            
            function addLoadingIndicator() {
                const id = 'loading-' + Date.now();
                const loadingElement = document.createElement('div');
                loadingElement.id = id;
                loadingElement.className = 'bot-message p-4 max-w-[80%] zoom-in';
                loadingElement.innerHTML = `
                    <div class="flex items-start">
                        <div class="rounded-full bg-indigo-100 p-2 mr-3">
                            <i class="fas fa-robot text-indigo-600"></i>
                        </div>
                        <div class="loading-dots mt-2">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                `;
                chatMessages.appendChild(loadingElement);
                scrollToBottom();
                return id;
            }
            
            function removeLoadingIndicator(id) {
                const loadingElement = document.getElementById(id);
                if (loadingElement) {
                    loadingElement.remove();
                }
            }
            
            function scrollToBottom() {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
            
            function savePhrase(phrase, language) {
                const phraseObj = {
                    id: Date.now(),
                    text: phrase,
                    language: language,
                    date: new Date().toLocaleDateString()
                };
                
                savedPhrases.push(phraseObj);
                localStorage.setItem('savedPhrases', JSON.stringify(savedPhrases));
                updateSavedPhrasesList();
            }
            
            function updateSavedPhrasesList() {
                if (savedPhrases.length === 0) {
                    savedPhrasesList.innerHTML = '<p class="text-gray-500 text-center py-4">No saved phrases yet</p>';
                    return;
                }
                
                savedPhrasesList.innerHTML = '';
                savedPhrases.forEach(phrase => {
                    const phraseElement = document.createElement('div');
                    phraseElement.className = 'border-b border-gray-200 pb-3';
                    phraseElement.innerHTML = `
                        <div class="flex justify-between items-start">
                            <div>
                                <p class="text-sm font-medium">${phrase.language}</p>
                                <p class="mt-1">${phrase.text}</p>
                                <p class="text-xs text-gray-500 mt-1">Saved on ${phrase.date}</p>
                            </div>
                            <div class="flex">
                                <button class="speak-saved-btn text-gray-500 hover:text-indigo-600 p-1" data-id="${phrase.id}">
                                    <i class="fas fa-volume-up"></i>
                                </button>
                                <button class="delete-saved-btn text-gray-500 hover:text-red-600 p-1 ml-1" data-id="${phrase.id}">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `;
                    savedPhrasesList.appendChild(phraseElement);
                    
                    // Add event listeners
                    phraseElement.querySelector('.speak-saved-btn').addEventListener('click', function() {
                        const id = this.getAttribute('data-id');
                        const phrase = savedPhrases.find(p => p.id == id);
                        if (phrase) {
                            speakText(phrase.text);
                        }
                    });
                    
                    phraseElement.querySelector('.delete-saved-btn').addEventListener('click', function() {
                        const id = this.getAttribute('data-id');
                        savedPhrases = savedPhrases.filter(p => p.id != id);
                        localStorage.setItem('savedPhrases', JSON.stringify(savedPhrases));
                        updateSavedPhrasesList();
                    });
                });
            }
            
            function speakText(text) {
                if ('speechSynthesis' in window) {
                    const utterance = new SpeechSynthesisUtterance(text);
                    // Try to find a voice that matches the current language
                    const voices = speechSynthesis.getVoices();
                    const langCode = getLanguageCode(currentLanguage);
                    const voice = voices.find(v => v.lang.startsWith(langCode));
                    if (voice) {
                        utterance.voice = voice;
                    }
                    speechSynthesis.speak(utterance);
                }
            }
            
            function getLanguageCode(language) {
                const langMap = {
                    'Spanish': 'es',
                    'French': 'fr',
                    'Italian': 'it',
                    'German': 'de',
                    'Japanese': 'ja',
                    'Mandarin': 'zh',
                    // Add more mappings as needed
                };
                return langMap[language] || 'en';
            }
            
            async function callGeminiAPI(message, language) {
                const prompt = `You are a helpful travel language assistant. 
                The user wants to learn phrases in ${language}. 
                Provide accurate translations, pronunciation guides (in simple phonetic form), and cultural context when relevant. 
                Keep responses concise and focused on practical travel situations.
                
                User query: ${message}`;
                
                try {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{ text: prompt }]
                            }]
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.error) {
                        console.error("API Error:", data.error);
                        return "Sorry, I encountered an error processing your request.";
                    }
                    
                    // Extract text from response
                    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
                        return data.candidates[0].content.parts[0].text;
                    } else {
                        return "Sorry, I couldn't generate a response. Please try a different phrase.";
                    }
                } catch (error) {
                    console.error("API Call Error:", error);
                    return "Sorry, I encountered an error connecting to the language service.";
                }
            }
            
            // Initialize voices for speech synthesis
            if ('speechSynthesis' in window) {
                speechSynthesis.onvoiceschanged = function() {
                    speechSynthesis.getVoices();
                };
            }
            
            // Get system voices when available
            window.speechSynthesis.getVoices();
        });
    