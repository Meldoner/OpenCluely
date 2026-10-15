document.addEventListener('DOMContentLoaded', () => {    
    const logger = {
        info: (...args) => console.log('[SettingsWindowUI]', ...args)
    };

    const providerUI = new ProviderSettings(document.getElementById('aiProviderSettings'), undefined, {
        compact: true, speechContainer: document.getElementById('speechCredentials')
    });
    const dialogueLanguages = new GeminiTranscribeSettings(document.getElementById('dialogueLanguageFields'), () => saveSettings(), { global: true });
    const cloudflareWhisperInput = document.getElementById('cloudflareWhisperModel');
    const systemAudioDeviceInput = document.getElementById('systemAudioDevice');
    const vocabularyInput = document.getElementById('geminiTranscribeVocabulary');
    let vocabularySkill = null;
    let savedVocabulary = '';

    // Get DOM elements
    const closeButton = document.getElementById('closeButton');
    const quitButton = document.getElementById('quitButton');
    const speechProviderSelect = document.getElementById('speechProvider');
    let configuredSpeechProvider = 'whisper';
    const azureKeyInput = document.getElementById('azureKey');
    const azureRegionInput = document.getElementById('azureRegion');
    const whisperCommandInput = document.getElementById('whisperCommand');
    const whisperModelInput = document.getElementById('whisperModel');
    const whisperDeviceSelect = document.getElementById('whisperDevice');
    const whisperCaptureModeSelect = document.getElementById('whisperCaptureMode');
    const whisperResponseTargetSelect = document.getElementById('whisperResponseTarget');
    const whisperSegmentMsInput = document.getElementById('whisperSegmentMs');
    const windowGapInput = document.getElementById('windowGap');
    const codingLanguageSelect = document.getElementById('codingLanguage');
    const activeSkillSelect = document.getElementById('activeSkill');
    const iconGrid = document.getElementById('iconGrid');

    // Check if window.api exists
    if (!window.api) {
        console.error('window.api not available');
        return;
    }

    // Request current settings when window opens
    const requestCurrentSettings = () => {
        if (window.electronAPI && window.electronAPI.getSettings) {
            return window.electronAPI.getSettings().then(settings => {
                loadSettingsIntoUI(settings);
            }).catch(error => {
                console.error('Failed to get settings:', error);
            });
        }
    };

    // Close button handler
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            window.api.send('close-settings');
        });
    }

    // Quit button handler with multiple attempts
    if (quitButton) {
        quitButton.addEventListener('click', () => {
            try {
                // Try multiple ways to quit the app
                if (window.api && window.api.send) {
                    window.api.send('quit-app');
                }
                
                // Also try the electron API if available
                if (window.electronAPI && window.electronAPI.quit) {
                    window.electronAPI.quit();
                }
                
                // Fallback: close the window
                setTimeout(() => {
                    window.close();
                }, 500);
                
            } catch (error) {
                console.error('Error quitting app:', error);
                window.close();
            }
        });
    }

    // Function to load settings into UI
    const loadSettingsIntoUI = (settings) => {
        providerUI.load(settings);
        const vocabulary = settings.geminiTranscribeVocabulary ?? [];
        vocabularyInput.value = Array.isArray(vocabulary) ? vocabulary.join(', ') : vocabulary;
        savedVocabulary = vocabularyInput.value;
        vocabularySkill = settings.activeSkill || 'dsa';
        dialogueLanguages.load(settings.dialogueLanguages ?? settings.geminiTranscribeLanguages ?? []);
        if (cloudflareWhisperInput) cloudflareWhisperInput.value = settings.cloudflareWhisperModel || "@cf/openai/whisper";
        if (systemAudioDeviceInput) systemAudioDeviceInput.value = settings.systemAudioDevice || "";
        if (settings.speechProvider && speechProviderSelect) {
            configuredSpeechProvider = settings.speechProvider;
            speechProviderSelect.value = configuredSpeechProvider;
        }
        // Always set the input value, even if empty, so the user sees what's
        // currently configured (including env-derived defaults). Previously
        // empty strings were skipped which left stale UI values.
        if (azureKeyInput) azureKeyInput.value = settings.azureKey || '';
        if (azureRegionInput) azureRegionInput.value = settings.azureRegion || '';
        if (whisperCommandInput) whisperCommandInput.value = settings.whisperCommand || '';
        if (whisperModelInput) whisperModelInput.value = settings.whisperModel || '';
        if (whisperDeviceSelect) whisperDeviceSelect.value = settings.whisperDevice || 'auto';
        if (whisperCaptureModeSelect) whisperCaptureModeSelect.value = settings.whisperCaptureMode || 'vad';
        if (whisperResponseTargetSelect) whisperResponseTargetSelect.value = settings.whisperResponseTarget || 'both';
        if (whisperSegmentMsInput) whisperSegmentMsInput.value = settings.whisperSegmentMs || '';
        if (windowGapInput) windowGapInput.value = settings.windowGap || '';

        // Set C++ as default if no coding language is specified
        if (codingLanguageSelect) {
            codingLanguageSelect.value = settings.codingLanguage || 'cpp';
        }

        if (settings.activeSkill && activeSkillSelect) activeSkillSelect.value = settings.activeSkill;
        const skillLabel = activeSkillSelect.selectedOptions[0]?.textContent || vocabularySkill;
        document.getElementById('geminiVocabularyLabel').textContent = 'Technical vocabulary — ' + skillLabel;

        // Handle icon selection
        const selectedIcon = settings.selectedIcon || settings.appIcon;
        if (selectedIcon && iconGrid) {
            const iconOptions = iconGrid.querySelectorAll('.icon-option');
            iconOptions.forEach(option => {
                if (option.dataset.icon === selectedIcon) {
                    option.classList.add('selected');
                } else {
                    option.classList.remove('selected');
                }
            });
        }

        updateSpeechFieldStates();
    };

    // Load settings when window opens
    window.api.receive('load-settings', (settings) => {
        loadSettingsIntoUI(settings);
    });

    // Listen for settings window shown event
    if (window.electronAPI && window.electronAPI.receive) {
        window.electronAPI.receive('settings-window-shown', () => {
            requestCurrentSettings();
        });

    // Listen for coding language changes from other windows via helper
    window.electronAPI.onCodingLanguageChanged((event, data) => {
            if (data && data.language && codingLanguageSelect) {
                codingLanguageSelect.value = data.language;
                console.log('Language updated from overlay window:', data.language);
            }
    });
    window.electronAPI.onSkillChanged(() => requestCurrentSettings());
    }

    // Save settings helper function
    const saveSettings = async (options = {}) => {
        const settings = providerUI.values();
        settings.dialogueLanguages = dialogueLanguages.values();
        // The input still belongs to the previous profile during a skill change.
        // Send its scope explicitly so blur/change events cannot overwrite another glossary.
        if (vocabularySkill && vocabularyInput.value !== savedVocabulary) {
            settings.geminiTranscribeVocabulary = vocabularyInput.value;
            settings.geminiTranscribeVocabularySkill = vocabularySkill;
        }
        if (cloudflareWhisperInput) settings.cloudflareWhisperModel = cloudflareWhisperInput.value;
        if (systemAudioDeviceInput) settings.systemAudioDevice = systemAudioDeviceInput.value;
        if (speechProviderSelect) settings.speechProvider = speechProviderSelect.value;
        if (azureKeyInput) settings.azureKey = azureKeyInput.value;
        if (azureRegionInput) settings.azureRegion = azureRegionInput.value;
        if (whisperCommandInput) settings.whisperCommand = whisperCommandInput.value;
        if (whisperModelInput) settings.whisperModel = whisperModelInput.value;
        if (whisperDeviceSelect) settings.whisperDevice = whisperDeviceSelect.value;
        if (whisperCaptureModeSelect) settings.whisperCaptureMode = whisperCaptureModeSelect.value;
        if (whisperResponseTargetSelect) settings.whisperResponseTarget = whisperResponseTargetSelect.value;
        if (whisperSegmentMsInput) settings.whisperSegmentMs = whisperSegmentMsInput.value;
        if (windowGapInput) settings.windowGap = windowGapInput.value;
        if (codingLanguageSelect) settings.codingLanguage = codingLanguageSelect.value;
        if (options.activeSkill) settings.activeSkill = options.activeSkill;
        
        try {
            const result = await window.electronAPI.saveSettings(settings);
            if (!result.success) providerUI.status.textContent = result.error;
            else if (settings.geminiTranscribeVocabulary !== undefined && vocabularySkill === settings.geminiTranscribeVocabularySkill) {
                savedVocabulary = settings.geminiTranscribeVocabulary;
            }
            return result;
        } catch (error) {
            providerUI.status.textContent = error.message;
            return { success: false };
        }
    };

    const updateSpeechFieldStates = () => {
        if (speechProviderSelect) {
            const native = speechProviderSelect.querySelector('[value="gemini-live-audio"]');
            native.disabled = providerUI.provider.value !== 'gemini-live';
            if (native.disabled && configuredSpeechProvider === 'gemini-live-audio') configuredSpeechProvider = 'gemini-live';
            speechProviderSelect.value = configuredSpeechProvider;
        }
        const provider = speechProviderSelect ? speechProviderSelect.value : 'whisper';
        const audioAnswers = provider === 'gemini-live-audio';
        document.getElementById('geminiVocabularyFields').hidden = provider !== 'gemini-live';
        providerUI.setSpeechProvider(provider);
        document.getElementById('cloudflareSpeechFields').hidden = provider !== 'cloudflare';
        document.getElementById('geminiLiveSpeechFields').hidden = !['gemini-live', 'gemini-live-audio'].includes(provider);
        document.getElementById('geminiLiveSpeechFields').textContent = audioAnswers
            ? 'Gemini-3.8-Live receives computer audio, transcribes it and generates answers in the same session. Uses your Gemini API key. Stop recording to change the AI provider.'
            : 'Gemini-3.5-Transcribe Live streams computer audio to Google. Uses the Gemini API key and the global dialogue languages. Restart recording before the ten-minute limit.';

        // Show/hide provider-specific field groups instead of just disabling
        // them. This keeps the settings UI clean — only the relevant fields
        // for the selected provider are visible.
        const azureGroup = document.getElementById('azureFields');
        const whisperGroup = document.getElementById('whisperFields');
        const azureNote = document.getElementById('azureFieldsNote');

        if (azureGroup) {
            azureGroup.style.display = provider === 'azure' ? '' : 'none';
        }
        if (whisperGroup) {
            whisperGroup.style.display = ['whisper', 'cloudflare', 'gemini-live', 'gemini-live-audio'].includes(provider) ? '' : 'none';
        }
        if (azureNote) {
            azureNote.style.display = provider === 'azure' ? '' : 'none';
        }

        // Also toggle disabled attribute for any leftover direct field refs
        [azureKeyInput, azureRegionInput].forEach(input => {
            if (input) input.disabled = provider !== 'azure';
        });
        [whisperCommandInput, whisperModelInput, whisperDeviceSelect].forEach(input => {
            if (input) { input.disabled = provider !== 'whisper'; input.closest('.settings-item').hidden = provider !== 'whisper'; }
        });
        [whisperCaptureModeSelect, whisperResponseTargetSelect].forEach(input => {
            if (input) input.disabled = !['whisper', 'cloudflare', 'gemini-live', 'gemini-live-audio'].includes(provider);
        });
        [whisperSegmentMsInput].forEach(input => {
            if (input) { input.disabled = !['whisper', 'cloudflare'].includes(provider); input.closest('.settings-item').hidden = ['gemini-live', 'gemini-live-audio'].includes(provider); }
        });
    };

    providerUI.onChange = () => { updateSpeechFieldStates(); saveSettings(); };
    // Add event listeners for all inputs
    const inputs = [
        azureKeyInput,
        azureRegionInput,
        whisperCommandInput,
        whisperModelInput,
        whisperDeviceSelect,
        whisperCaptureModeSelect,
        whisperResponseTargetSelect,
        whisperSegmentMsInput,
        windowGapInput, cloudflareWhisperInput, systemAudioDeviceInput, vocabularyInput
    ];

    inputs.forEach(input => {
        if (input) {
            input.addEventListener('change', saveSettings);
            input.addEventListener('blur', saveSettings);
        }
    });

    if (speechProviderSelect) {
        speechProviderSelect.addEventListener('change', () => {
            configuredSpeechProvider = speechProviderSelect.value;
            updateSpeechFieldStates();
            saveSettings();
        });
    }

    // Language selection handler
    if (codingLanguageSelect) {
        codingLanguageSelect.addEventListener('change', (e) => {
            const lang = e.target.value;
            // use electronAPI so main broadcast is consistent
            if (window.electronAPI && window.electronAPI.saveSettings) {
                window.electronAPI.saveSettings({ codingLanguage: lang });
            } else {
                // fallback
                saveSettings();
            }
        });
    }

    // Skill selection handler
    if (activeSkillSelect) {
        activeSkillSelect.addEventListener('change', async () => {
            activeSkillSelect.disabled = true;
            try {
                const result = await saveSettings({ activeSkill: activeSkillSelect.value });
                if (result.success) await requestCurrentSettings();
                else activeSkillSelect.value = vocabularySkill;
            } finally {
                activeSkillSelect.disabled = false;
            }
        });
    }

    updateSpeechFieldStates();

    // Initialize icon grid with correct paths
    const initializeIconGrid = () => {
        if (!iconGrid) return;

        const icons = [
            { key: 'terminal', name: 'Terminal', src: './assests/icons/terminal.png' },
            { key: 'activity', name: 'Activity', src: './assests/icons/activity.png' },
            { key: 'settings', name: 'Settings', src: './assests/icons/settings.png' }
        ];

        iconGrid.innerHTML = '';

        icons.forEach(icon => {
            const iconElement = document.createElement('div');
            iconElement.className = 'icon-option';
            iconElement.dataset.icon = icon.key;
            
            const img = document.createElement('img');
            img.src = icon.src;
            img.alt = icon.name;
            img.onload = () => {
                logger.info('Icon loaded successfully:', icon.src);
            };
            img.onerror = () => {
                console.error('Failed to load icon:', icon.src);
                // Try alternative paths
                const altPaths = [
                    `./assests/${icon.key}.png`,
                    `./assets/icons/${icon.key}.png`,
                    `./assets/${icon.key}.png`
                ];
                
                let pathIndex = 0;
                const tryNextPath = () => {
                    if (pathIndex < altPaths.length) {
                        img.src = altPaths[pathIndex];
                        pathIndex++;
                    } else {
                        img.style.display = 'none';
                        console.error('All icon paths failed for:', icon.key);
                    }
                };
                
                img.onload = () => {
                    logger.info('Icon loaded with alternative path:', img.src);
                };
                
                img.onerror = tryNextPath;
                tryNextPath();
            };
            
            const label = document.createElement('div');
            label.textContent = icon.name;
            
            iconElement.appendChild(img);
            iconElement.appendChild(label);
            
            // Click handler for icon selection
            iconElement.addEventListener('click', () => {                
                // Remove selection from all icons
                iconGrid.querySelectorAll('.icon-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                
                // Add selection to clicked icon
                iconElement.classList.add('selected');
                
                // Save the selection - this should trigger the app icon change
                window.api.send('save-settings', { selectedIcon: icon.key });
                
                // Show visual feedback
                iconElement.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    iconElement.style.transform = 'scale(1)';
                }, 100);
            });
            
            iconGrid.appendChild(iconElement);
        });
    };

    // Initialize icon grid
    initializeIconGrid();

    // Request settings on load
    setTimeout(() => {
        requestCurrentSettings();
    }, 200);

    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            window.api.send('close-settings');
        }
    });
}); 
