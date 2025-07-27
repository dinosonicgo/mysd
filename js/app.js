// static/js/app.js

/**
 * v16.0 (估算總進度條): 實現了估算總進度條功能。現在進度條不再因不同節點（如主 KSampler 和 FaceDetailer 的 KSampler）的執行而重置。腳本會根據批量大小和是否啟用臉部修復來預估一個總步數，並在收到進度回調時累加，提供一個從 0% 連續推進到 ~100% 的、更符合直覺的總體進度反饋。
 * v15.1 (致命錯誤修正): 將 comfyHistoryGrid 的宣告從 const 改為 let。解決了因在 initializeHistory 函式中重新賦值給常量，導致 TypeError 中斷整個 JS 初始化流程的問題，恢復了頁面所有按鈕的交互功能。
 * v15.0 (多裝置架構 v2): 完整的前端多裝置控制實現。
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- 元素選擇器 (通用) ---
    const getById = (id) => document.getElementById(id);
    const navGemini = getById('nav-gemini');
    const navComfyUI = getById('nav-comfyui');
    const geminiPage = getById('gemini-page');
    const comfyUIPage = getById('comfyui-page');
    const pages = [geminiPage, comfyUIPage];
    const navLinks = [navGemini, navComfyUI];

    // --- 元素選擇器 (Gemini) ---
    const geminiChatWindow = getById('gemini-chat-window');
    const geminiForm = getById('gemini-input-form');
    const geminiInput = getById('gemini-input');
    const geminiSendBtn = getById('gemini-send-btn');
    const geminiStartBtn = getById('gemini-start-btn');

    // --- 元素選擇器 (ComfyUI - 參數設定) ---
    const comfyFormElements = {
        model: null,
        model_architecture: 'sdxl',
        loras: [],
        positive_prompt: getById('comfy-positive-prompt'),
        negative_prompt: getById('comfy-negative-prompt'),
        fixed_prompt: getById('comfy-fixed-prompt'),
        fixed_prompt_prepend: getById('fixed-prompt-prepend'),
        fixed_prompt_append: getById('fixed-prompt-append'),
        seed: getById('comfy-seed'),
        seed_behavior: getById('comfy-seed-behavior'),
        batch_size: getById('comfy-batch-size'),
        steps: getById('comfy-steps'),
        cfg: getById('comfy-cfg'),
        sampler_name: getById('comfy-sampler-name'),
        scheduler: getById('comfy-scheduler'),
        optimize_positive: getById('comfy-optimize-positive-checkbox'),
        ai_optimize: getById('comfy-ai-optimize-checkbox'),
        translate_negative: getById('comfy-translate-negative-checkbox'),
        enable_adetailer: getById('comfy-enable-adetailer'),
        adetailer_positive_prompt: getById('comfy-adetailer-positive-prompt'),
        translate_adetailer_positive: getById('comfy-translate-adetailer-positive-checkbox'),
        denoise: getById('comfy-denoise'),
    };
    const comfySelectedModelName = getById('comfy-selected-model-name');
    const selectedLoraListContainer = getById('selected-lora-list-container');
    const comfyRandomSeedBtn = getById('comfy-random-seed-btn');
    const comfyGenerateBtn = getById('comfy-generate-btn');
    const comfySpinner = getById('comfy-generate-spinner');
    const comfyStatusText = getById('comfy-status-text');
    const comfyResultImage = getById('comfy-result-image');
    const comfyResultVideo = getById('comfy-result-video');
    let comfyHistoryGrid = getById('comfy-history-grid');
    const adetailerOptionsDiv = getById('adetailer-options');
    const positivePromptWarning = getById('comfy-positive-prompt-warning');
    
    // --- 元素選擇器 (ComfyUI - 圖像輸入) ---
    const img2imgTab = getById('img2img-tab');
    const img2imgFileInput = getById('img2img-file-input');
    const img2imgUploadArea = getById('img2img-upload-area');
    const img2imgPreviewContainer = getById('img2img-preview-container');
    const img2imgPreview = getById('img2img-preview');
    const img2imgFilename = getById('img2img-filename');
    const img2imgClearBtn = getById('img2img-clear-btn');
    const img2imgDenoiseSlider = getById('img2img-denoise-slider');
    const img2imgDenoiseValueLabel = getById('img2img-denoise-value-label');
    const maskFileInput = getById('mask-file-input');
    const maskUploadArea = getById('mask-upload-area');
    const maskPreviewContainer = getById('mask-preview-container');
    const maskPreview = getById('mask-preview');
    const maskFilename = getById('mask-filename');
    const maskClearBtn = getById('mask-clear-btn');

    // --- 元素選擇器 (ComfyUI - ControlNet) ---
    const controlnetTab = getById('controlnet-tab');
    const enableControlnetSwitch = getById('comfy-enable-controlnet');
    const controlnetOptionsContainer = getById('controlnet-options-container');
    const controlnetFileInput = getById('controlnet-file-input');
    const controlnetUploadArea = getById('controlnet-upload-area');
    const controlnetPreviewContainer = getById('controlnet-preview-container');
    const controlnetPreview = getById('controlnet-preview');
    const controlnetFilename = getById('controlnet-filename');
    const controlnetClearBtn = getById('controlnet-clear-btn');
    const controlnetModelSelect = getById('comfy-controlnet-model');
    const controlnetPreprocessorSelect = getById('comfy-controlnet-preprocessor');
    const controlnetStrengthSlider = getById('comfy-controlnet-strength');
    const controlnetStrengthValueLabel = getById('controlnet-strength-value-label');
    
    // --- 元素選擇器 (ComfyUI - 影片生成) ---
    const videoMainPrompt = getById('video-main-prompt');
    const videoOptimizePositiveCheckbox = getById('video-optimize-positive-checkbox');
    const videoAiOptimizeCheckbox = getById('video-ai-optimize-checkbox');
    const videoModelSelect = getById('video-model-select');
    const videoGenerationModeSelect = getById('video-generation-mode');
    const videoUploadContainer = getById('video-upload-container');
    const videoFileInput = getById('video-file-input');
    const videoUploadArea = getById('video-upload-area');
    const videoPreviewContainer = getById('video-preview-container');
    const videoPreview = getById('video-preview');
    const videoFilename = getById('video-filename');
    const videoClearBtn = getById('video-clear-btn');
    const videoFramesInput = getById('video-frames');
    const videoFpsInput = getById('video-fps');
    const videoMotionBucketInput = getById('video-motion-bucket');
    const videoAugmentationLevelSlider = getById('video-augmentation-level');
    const videoAugmentationLevelLabel = getById('video-augmentation-level-label');

    // --- 進度條元素 ---
    const comfyProgressContainer = getById('comfy-progress-container');
    const comfyProgressBar = getById('comfy-progress-bar');
    const comfyProgressText = getById('comfy-progress-text');
    
    let comfyStatusWs = null;

    // --- 元素選擇器 (圖片/影片 Modal) ---
    const imageModal = getById('image-modal');
    const modalImage = getById('modal-image');
    const modalVideo = getById('modal-video');
    const modalCloseBtn = getById('modal-close-btn');
    const modalPrevBtn = getById('modal-prev-btn');
    const modalNextBtn = getById('modal-next-btn');
    const modalDownloadBtn = getById('modal-download-btn');
    const modalParams = {
        model: getById('modal-model'),
        lora_list: getById('modal-lora-list'),
        img2img_info: getById('modal-img2img-info'),
        source_image: getById('modal-source-image'),
        denoise: getById('modal-denoise'),
        controlnet_info: getById('modal-controlnet-info'),
        controlnet_model: getById('modal-controlnet-model'),
        controlnet_preprocessor: getById('modal-controlnet-preprocessor'),
        controlnet_strength: getById('modal-controlnet-strength'),
        video_info: getById('modal-video-info'),
        svd_model: getById('modal-svd-model'),
        video_frames: getById('modal-video-frames'),
        video_fps: getById('modal-video-fps'),
        motion_bucket: getById('modal-motion-bucket'),
        augmentation_level: getById('modal-augmentation-level'),
        input_prompt_container: getById('modal-input-prompt-container'),
        input_prompt: getById('modal-input-prompt'),
        fixed_prompt_container: getById('modal-fixed-prompt-container'),
        fixed_prompt: getById('modal-fixed-prompt'),
        final_positive_prompt: getById('modal-final-positive-prompt'),
        negative_prompt: getById('modal-negative-prompt'),
        seed: getById('modal-seed'),
        steps: getById('modal-steps'),
        cfg: getById('modal-cfg'),
        sampler_name: getById('modal-sampler-name'),
        scheduler: getById('modal-scheduler'),
        optimization_mode: getById('modal-optimization-mode'),
    };
    
    // --- 元素選擇器 (模型/LoRA 選擇 Modal) ---
    const modelSelectionModal = getById('model-selection-modal');
    const modelSelectionGrid = getById('model-selection-grid');
    let bsModelSelectionModal = null;
    const loraSelectionModal = getById('lora-selection-modal');
    const loraSelectionGrid = getById('lora-selection-grid');
    const loraConfirmSelectionBtn = getById('lora-confirm-selection-btn');
    let bsLoraSelectionModal = null;

    // --- 元素選擇器 (通知 & 歷史紀錄管理) ---
    const notificationStatusBadge = getById('notification-status-badge');
    const enableNotificationsBtn = getById('enable-notifications-btn');
    const historyManagementBtns = getById('history-management-buttons');
    const historySelectionBtns = getById('history-selection-buttons');
    const historySelectBtn = getById('history-select-btn');
    const historyDeleteAllBtn = getById('history-delete-all-btn');
    const historySelectAllBtn = getById('history-select-all-btn');
    const historyBatchDownloadBtn = getById('history-batch-download-btn');
    const historyBatchDeleteBtn = getById('history-batch-delete-btn');
    const historyCancelSelectBtn = getById('history-cancel-select-btn');
    const historySelectionCount = getById('history-selection-count');
    const historySelectionCountDelete = getById('history-selection-count-delete');
    
    // --- 元素選擇器 (預設提示詞按鈕) ---
    const negativePromptSetDefaultBtn = getById('negative-prompt-set-default-btn');
    const fixedPromptSetDefaultBtn = getById('fixed-prompt-set-default-btn');

    // --- 元素選擇器 (模型下載) ---
    const downloadModelForm = getById('download-model-form');
    const modelFilterCheckboxes = document.querySelectorAll('.model-filter-checkbox');

    // --- 元素選擇器 (GM 登入) ---
    const gmLoginIcon = getById('gm-login-icon');
    const gmLoginForm = getById('gm-login-form');
    const gmPasswordInput = getById('gm-password-input');
    const gmLoginError = getById('gm-login-error');
    const userStatusDisplay = getById('user-status-display');
    const deviceSelectorDropdown = getById('device-selector-dropdown');
    const deviceSelectionList = getById('device-selection-list');
    let bsGmLoginModal = null;

    const historyLoadingIndicator = document.createElement('div');
    historyLoadingIndicator.id = 'history-loading-indicator';
    historyLoadingIndicator.className = 'text-center text-muted p-3 col-12';
    historyLoadingIndicator.style.display = 'none';

    // --- 狀態變數 ---
    let userContext = { user_type: 'local', device_id: 'local' };
    let activeDeviceUrl = window.location.origin; // 本地模式預設為當前網域
    let sharedConfig = { devices: {} };
    let img2imgState = { source_image: null, inpaint_mask: null };
    let controlnetState = { controlnet_image: null };
    let videoState = { source_image: null };
    let currentHistoryList = [];
    let currentModalIndex = -1;
    let touchStartX = 0;
    let touchEndX = 0;
    let isSelectionMode = false;
    let selectedItems = new Set();
    let tempSelectedLoras = new Set();
    let trackedPromptId = null; 
    let wasPreviouslyRunning = false;
    let serviceWorkerRegistration = null;
    let isLoadingHistory = false;
    let hasMoreHistory = true;
    const GM_PASSWORD = "781111";
    const GITHUB_CONFIG_URL = 'https://dinosonicgo.github.io/mysd/config.json';

    // [v16.0 修正] 新增總進度條相關狀態變數
    let totalExpectedSteps = 0;
    let accumulatedSteps = 0;
    let currentNodeTotalSteps = 0;
    let isNewNodeProgress = true;

    // --- 預設提示詞常數 ---
    const DEFAULT_NEGATIVE_PROMPT = "modern, recent, old, oldest, cartoon, graphic, text, painting, crayon, graphite, abstract, glitch, deformed, mutated, ugly, disfigured, long body, lowres, bad anatomy, bad hands, missing fingers, extra digit, fewer digits, cropped, very displeasing, (worst quality, bad quality:1.2), bad anatomy, sketch, jpeg artifacts, signature, watermark, username, signature, simple background, conjoined,";
    const DEFAULT_FIXED_PROMPT = "超非常精緻美麗的臉，超非常精緻美麗的眼睛，極度非常精緻的細節、UHD、完美傑作，最高畫質，大光圈，8K";

    // --- 核心函式: API 請求與使用者上下文 ---
    async function fetchWithUserContext(path, options = {}) {
        if (!activeDeviceUrl) {
            throw new Error("沒有可用的裝置 URL。請確保已選擇一個在線裝置。");
        }
        const fullUrl = new URL(path, activeDeviceUrl).href;
        const headers = new Headers(options.headers || {});
        headers.append('X-User-Type', userContext.user_type);
        headers.append('X-Device-ID', userContext.device_id);
        options.headers = headers;
        return fetch(fullUrl, options);
    }
    
    // --- 核心函式: 裝置切換與資料載入 ---
    async function switchDevice(deviceId) {
        if (!sharedConfig.devices[deviceId] || sharedConfig.devices[deviceId].status !== 'online') {
            alert(`裝置 ${deviceId} 目前不在線或無法連接。`);
            return;
        }
        
        console.log(`正在切換到裝置: ${deviceId}`);
        userContext.device_id = deviceId;
        activeDeviceUrl = sharedConfig.devices[deviceId].url;
        localStorage.setItem('gm_last_device', deviceId);
        
        updateDeviceSelectorUI();
        
        document.body.style.cursor = 'wait';
        
        await reloadDataForActiveDevice();
        
        document.body.style.cursor = 'default';
        console.log(`已成功切換到 ${deviceId}。`);
    }
    
    async function reloadDataForActiveDevice() {
        console.log(`正在為裝置 ${userContext.device_id} 重新載入所有資料...`);
        
        await Promise.all([
            fetchAndPopulateCheckpoints(),
            fetchAndPopulateControlNetResources(),
            fetchAndPopulateVideoModels(),
            fetchAndPopulateSamplers(),
            loadSettings(),
            initializeHistory()
        ]);
    
        console.log("資料重新載入完成。");
    }

    async function loadSharedConfigAndInitialize() {
        try {
            const response = await fetch(`${GITHUB_CONFIG_URL}?t=${new Date().getTime()}`);
            if (!response.ok) throw new Error('無法從 GitHub 獲取共享設定檔。');
            sharedConfig = await response.json();
        } catch (error) {
            console.error(error);
            if(userStatusDisplay) userStatusDisplay.textContent = '錯誤: 無法載入遠端設定';
        }

        userContext.user_type = localStorage.getItem('user_type') || 'local';
        
        if (userContext.user_type === 'gm') {
            const lastDevice = localStorage.getItem('gm_last_device');
            const onlineDevices = Object.keys(sharedConfig.devices).filter(id => sharedConfig.devices[id].status === 'online');
            
            let targetDevice = null;
            if (lastDevice && onlineDevices.includes(lastDevice)) {
                targetDevice = lastDevice;
            } else if (onlineDevices.length > 0) {
                targetDevice = onlineDevices[0];
            }

            if (targetDevice) {
                await switchDevice(targetDevice);
            } else {
                updateDeviceSelectorUI();
                alert('目前沒有任何遠端裝置在線。');
            }
        } else {
            userContext.device_id = localStorage.getItem('device_id') || 'local_pc';
            activeDeviceUrl = window.location.origin;
            updateDeviceSelectorUI();
            await reloadDataForActiveDevice();
        }
    }

    function updateDeviceSelectorUI() {
        if (!userStatusDisplay || !gmLoginIcon) return;
    
        if (userContext.user_type === 'gm') {
            gmLoginIcon.innerHTML = '<i class="bi bi-unlock-fill text-warning"></i>';
            gmLoginIcon.title = '已登入為 GM - 點擊登出';
            
            if (deviceSelectorDropdown) deviceSelectorDropdown.style.display = 'block';
            if (userStatusDisplay) userStatusDisplay.textContent = `GM @ ${userContext.device_id || '未選擇'}`;
            
            if (deviceSelectionList) {
                const deviceIds = Object.keys(sharedConfig.devices);
                deviceSelectionList.innerHTML = '';
                if (deviceIds.length > 0) {
                    deviceIds.forEach(id => {
                        const device = sharedConfig.devices[id];
                        const lastSeen = new Date(device.timestamp * 1000);
                        const isOnline = (new Date() - lastSeen) < 5 * 60 * 1000;
                        device.status = isOnline ? 'online' : 'offline';

                        const li = document.createElement('li');
                        const a = document.createElement('a');
                        a.className = `dropdown-item device-select-btn ${userContext.device_id === id ? 'active' : ''}`;
                        a.href = '#';
                        a.dataset.device = id;
                        a.innerHTML = `${id} <span class="badge bg-${isOnline ? 'success' : 'secondary'} float-end">${isOnline ? '在線' : '離線'}</span>`;
                        li.appendChild(a);
                        deviceSelectionList.appendChild(li);
                    });
                } else {
                    deviceSelectionList.innerHTML = '<li><a class="dropdown-item disabled" href="#">無可用裝置</a></li>';
                }
    
                deviceSelectionList.querySelectorAll('.device-select-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        const newDeviceId = e.target.closest('.device-select-btn').dataset.device;
                        if (userContext.device_id !== newDeviceId) {
                            await switchDevice(newDeviceId);
                        }
                    });
                });
            }
        } else {
            userStatusDisplay.textContent = '本地使用者';
            gmLoginIcon.innerHTML = '<i class="bi bi-lock"></i>';
            gmLoginIcon.title = 'GM 登入';
            if (deviceSelectorDropdown) deviceSelectorDropdown.style.display = 'none';
        }
    }

    // --- 頁面切換邏輯 ---
    function switchPage(pageIdToShow) {
        pages.forEach(page => { if(page) page.style.display = 'none'; });
        navLinks.forEach(link => { if(link) link.classList.remove('active'); });
        const pageToShow = document.getElementById(pageIdToShow);
        if (pageToShow) pageToShow.style.display = 'block';
        const navId = `nav-${pageIdToShow.replace('-page', '')}`;
        const activeNavLink = document.getElementById(navId);
        if (activeNavLink) activeNavLink.classList.add('active');
    }
    if (navGemini) navGemini.addEventListener('click', (e) => { e.preventDefault(); switchPage('gemini-page'); });
    if (navComfyUI) navComfyUI.addEventListener('click', (e) => { e.preventDefault(); switchPage('comfyui-page'); });


    // --- WebSocket Logic for Gemini ---
    let geminiWs = null;
    let currentGeminiBubble = null;
    function addMessageToChat(message, sender, isHtml = false) {
        if (!geminiChatWindow) return null;
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('chat-message', `${sender}-message`);
        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message-bubble');
        if (isHtml) {
            messageBubble.innerHTML = message;
        } else {
            messageBubble.innerText = message; 
        }
        messageWrapper.appendChild(messageBubble);
        geminiChatWindow.appendChild(messageWrapper);
        geminiChatWindow.scrollTop = geminiChatWindow.scrollHeight;
        if (sender === 'gemini') return messageBubble;
        return null;
    }
    function sendToGeminiSocket(payload) {
        if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.send(JSON.stringify(payload));
        }
    }
    function connectGeminiWebSocket() {
        if (!geminiChatWindow || !activeDeviceUrl) return;
        const wsProtocol = activeDeviceUrl.startsWith('https:') ? 'wss:' : 'ws:';
        const wsHost = new URL(activeDeviceUrl).host;
        const wsUrl = `${wsProtocol}//${wsHost}/api/gemini/ws`;

        if (geminiWs && geminiWs.readyState !== WebSocket.CLOSED) {
            geminiWs.close();
        }
        geminiWs = new WebSocket(wsUrl);
        geminiWs.onopen = () => console.log("已連接到 Gemini WebSocket 端點。");
        geminiWs.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'response') {
                    const messageText = msg.data;
                    if (messageText.includes('[GEMINI_ERROR]')) {
                        addMessageToChat(`<strong>後端錯誤:</strong><br>${messageText.replace('[GEMINI_ERROR]:', '')}`, 'gemini', true);
                        return;
                    }
                    if (currentGeminiBubble === null) currentGeminiBubble = addMessageToChat(messageText, 'gemini');
                    else currentGeminiBubble.innerText += messageText;
                    if(geminiChatWindow) geminiChatWindow.scrollTop = geminiChatWindow.scrollHeight;
                } else if (msg.type === 'status') {
                    if (msg.status === 'process_started') {
                        addMessageToChat("✅ Gemini CLI 已成功啟動，您可以開始對話了。", 'gemini');
                        if(geminiInput) {
                            geminiInput.disabled = false;
                            geminiInput.placeholder = "請在這裡輸入訊息...";
                        }
                        if(geminiSendBtn) geminiSendBtn.disabled = false;
                        if(geminiStartBtn) geminiStartBtn.disabled = false;
                    } else if (msg.status === 'error') {
                        addMessageToChat(`❌ <strong>啟動失敗:</strong><br>${msg.data}`, 'gemini', true);
                        if(geminiStartBtn) geminiStartBtn.disabled = false;
                    } else if (msg.status === 'connection_ready') {
                        if(geminiStartBtn) geminiStartBtn.disabled = false;
                        console.log("後端已準備就緒，可以啟動 Gemini。");
                    }
                }
            } catch (error) {
                console.error("解析 Gemini WebSocket 訊息時出錯:", error, "原始訊息:", event.data);
                if (currentGeminiBubble === null) currentGeminiBubble = addMessageToChat(event.data, 'gemini');
                else currentGeminiBubble.innerText += event.data;
                if(geminiChatWindow) geminiChatWindow.scrollTop = geminiChatWindow.scrollHeight;
            }
        };
        geminiWs.onclose = () => {
            addMessageToChat("與伺服器的連線已中斷。請重新整理頁面。", 'gemini');
            if(geminiInput) { geminiInput.disabled = true; geminiInput.placeholder = "已斷線"; }
            if(geminiSendBtn) geminiSendBtn.disabled = true;
            if(geminiStartBtn) geminiStartBtn.disabled = true;
        };
        geminiWs.onerror = (err) => {
            console.error("Gemini WebSocket 錯誤:", err);
            addMessageToChat("連線時發生錯誤，請檢查後端伺服器日誌。", 'gemini');
            if(geminiInput) { geminiInput.disabled = true; }
            if(geminiSendBtn) geminiSendBtn.disabled = true;
            if(geminiStartBtn) geminiStartBtn.disabled = true;
        };
    }
    if (geminiStartBtn) {
        geminiStartBtn.addEventListener('click', () => {
            geminiStartBtn.disabled = true;
            if(geminiChatWindow) geminiChatWindow.innerHTML = '';
            addMessageToChat("正在啟動 Gemini CLI 子程序，請稍候...", 'gemini');
            if(geminiInput) {
                geminiInput.disabled = true;
                geminiInput.placeholder = "正在啟動...";
            }
            if(geminiSendBtn) geminiSendBtn.disabled = true;
            connectGeminiWebSocket();
            setTimeout(() => sendToGeminiSocket({ command: "start" }), 500);
        });
    }
    if (geminiForm) {
        geminiForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const message = geminiInput.value.trim();
            if (message && geminiWs && geminiWs.readyState === WebSocket.OPEN) {
                addMessageToChat(message, 'user');
                currentGeminiBubble = null;
                sendToGeminiSocket({ command: "input", data: message });
                geminiInput.value = '';
            }
        });
    }

    // --- ComfyUI 相關邏輯 ---

    function updateDenoiseDefault() {
        if (!comfyFormElements.denoise) return;
        const isImg2ImgMode = !!img2imgState.source_image;
        const isControlNetMode = enableControlnetSwitch && enableControlnetSwitch.checked;
        comfyFormElements.denoise.value = (isImg2ImgMode || isControlNetMode) ? 0.75 : 1.0;
    }

    async function saveSettings() {
        const activeTabPane = document.querySelector('#control-panel-tab-content .tab-pane.active');
        const isVideoTabActive = activeTabPane && activeTabPane.id === 'tab-pane-video';
    
        const settings = {
            model: comfyFormElements.model,
            model_architecture: comfyFormElements.model_architecture,
            loras: comfyFormElements.loras,
            main_prompt: comfyFormElements.positive_prompt ? comfyFormElements.positive_prompt.value : '',
            negative_prompt: comfyFormElements.negative_prompt ? comfyFormElements.negative_prompt.value : '',
            fixed_prompt: comfyFormElements.fixed_prompt ? comfyFormElements.fixed_prompt.value : '',
            fixed_prompt_position: comfyFormElements.fixed_prompt_prepend && comfyFormElements.fixed_prompt_prepend.checked ? 'prepend' : 'append',
            seed: comfyFormElements.seed ? comfyFormElements.seed.value : 0,
            seed_behavior: comfyFormElements.seed_behavior ? comfyFormElements.seed_behavior.value : 'increment',
            batch_size: comfyFormElements.batch_size ? comfyFormElements.batch_size.value : 1,
            steps: comfyFormElements.steps ? comfyFormElements.steps.value : 20,
            cfg: comfyFormElements.cfg ? comfyFormElements.cfg.value : 8.0,
            sampler_name: comfyFormElements.sampler_name ? comfyFormElements.sampler_name.value : 'euler',
            scheduler: comfyFormElements.scheduler ? comfyFormElements.scheduler.value : 'normal',
            optimize_positive: isVideoTabActive ? (videoOptimizePositiveCheckbox ? videoOptimizePositiveCheckbox.checked : false) : (comfyFormElements.optimize_positive ? comfyFormElements.optimize_positive.checked : false),
            ai_optimize: isVideoTabActive ? (videoAiOptimizeCheckbox ? videoAiOptimizeCheckbox.checked : false) : (comfyFormElements.ai_optimize ? comfyFormElements.ai_optimize.checked : false),
            translate_negative: comfyFormElements.translate_negative ? comfyFormElements.translate_negative.checked : false,
            enable_adetailer: comfyFormElements.enable_adetailer ? comfyFormElements.enable_adetailer.checked : false,
            adetailer_positive_prompt: comfyFormElements.adetailer_positive_prompt ? comfyFormElements.adetailer_positive_prompt.value : '',
            translate_adetailer_positive: comfyFormElements.translate_adetailer_positive ? comfyFormElements.translate_adetailer_positive.checked : false,
            denoise: comfyFormElements.denoise ? comfyFormElements.denoise.value : 1.0,
            video_main_prompt: videoMainPrompt ? videoMainPrompt.value : '',
            video_params: {
                svd_model: videoModelSelect ? videoModelSelect.value : '',
                video_frames: videoFramesInput ? parseInt(videoFramesInput.value, 10) : 25,
                motion_bucket_id: videoMotionBucketInput ? parseInt(videoMotionBucketInput.value, 10) : 127,
                fps: videoFpsInput ? parseInt(videoFpsInput.value, 10) : 6,
                augmentation_level: videoAugmentationLevelSlider ? parseFloat(videoAugmentationLevelSlider.value) : 0.0
            }
        };

        try {
            await fetchWithUserContext('/api/comfyui/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
        } catch (error) {
            console.error('儲存設定到後端時發生錯誤:', error);
        }
    }

    async function loadSettings() {
        try {
            const response = await fetchWithUserContext('/api/comfyui/settings');
            if (!response.ok) throw new Error('無法從伺服器獲取設定。');
            const settings = await response.json();
            
            if (settings.model) {
                comfyFormElements.model = settings.model;
                if (comfySelectedModelName) comfySelectedModelName.textContent = settings.model;
            }
            if (settings.model_architecture) {
                comfyFormElements.model_architecture = settings.model_architecture;
            }

            if (Array.isArray(settings.loras)) {
                comfyFormElements.loras = settings.loras;
                renderSelectedLoras();
            }
            
            if (comfyFormElements.positive_prompt) comfyFormElements.positive_prompt.value = settings.main_prompt || '';
            if (comfyFormElements.negative_prompt) comfyFormElements.negative_prompt.value = settings.negative_prompt || '';
            if (comfyFormElements.fixed_prompt) comfyFormElements.fixed_prompt.value = settings.fixed_prompt || 'masterpiece, best quality,';
            if (comfyFormElements.adetailer_positive_prompt) comfyFormElements.adetailer_positive_prompt.value = settings.adetailer_positive_prompt || '';
            
            const savedPosition = settings.fixed_prompt_position || 'prepend';
            if (savedPosition === 'append' && comfyFormElements.fixed_prompt_append) {
                comfyFormElements.fixed_prompt_append.checked = true;
            } else if (comfyFormElements.fixed_prompt_prepend) {
                comfyFormElements.fixed_prompt_prepend.checked = true;
            }

            if (comfyFormElements.denoise) {
                const savedDenoise = settings.denoise !== null ? settings.denoise : 1.0;
                comfyFormElements.denoise.value = savedDenoise;
            }

            if (settings.seed && comfyFormElements.seed) comfyFormElements.seed.value = settings.seed;
            if (settings.seed_behavior && comfyFormElements.seed_behavior) {
                comfyFormElements.seed_behavior.value = settings.seed_behavior;
                comfyFormElements.seed_behavior.dispatchEvent(new Event('change'));
            }
            if (settings.batch_size && comfyFormElements.batch_size) comfyFormElements.batch_size.value = settings.batch_size;
            if (settings.steps && comfyFormElements.steps) comfyFormElements.steps.value = settings.steps;
            if (settings.cfg && comfyFormElements.cfg) comfyFormElements.cfg.value = settings.cfg;
            if (settings.sampler_name && comfyFormElements.sampler_name) comfyFormElements.sampler_name.value = settings.sampler_name;
            if (settings.scheduler && comfyFormElements.scheduler) comfyFormElements.scheduler.value = settings.scheduler;
            
            if (typeof settings.optimize_positive === 'boolean') {
                if (comfyFormElements.optimize_positive) {
                    comfyFormElements.optimize_positive.checked = settings.optimize_positive;
                    comfyFormElements.optimize_positive.dispatchEvent(new Event('change'));
                }
                if (videoOptimizePositiveCheckbox) {
                    videoOptimizePositiveCheckbox.checked = settings.optimize_positive;
                    videoOptimizePositiveCheckbox.dispatchEvent(new Event('change'));
                }
            }
            if (typeof settings.ai_optimize === 'boolean') {
                if (comfyFormElements.ai_optimize) comfyFormElements.ai_optimize.checked = settings.ai_optimize;
                if (videoAiOptimizeCheckbox) videoAiOptimizeCheckbox.checked = settings.ai_optimize;
            }

            if (typeof settings.translate_negative === 'boolean' && comfyFormElements.translate_negative) {
                comfyFormElements.translate_negative.checked = settings.translate_negative;
            }
            if (typeof settings.enable_adetailer === 'boolean' && comfyFormElements.enable_adetailer) {
                comfyFormElements.enable_adetailer.checked = settings.enable_adetailer;
                comfyFormElements.enable_adetailer.dispatchEvent(new Event('change'));
            }
            if (typeof settings.translate_adetailer_positive === 'boolean' && comfyFormElements.translate_adetailer_positive) {
                comfyFormElements.translate_adetailer_positive.checked = settings.translate_adetailer_positive;
            }
            
            if (videoMainPrompt) videoMainPrompt.value = settings.video_main_prompt || '';
            if (settings.video_params) {
                if(videoModelSelect) videoModelSelect.value = settings.video_params.svd_model || '';
                if(videoFramesInput) videoFramesInput.value = settings.video_params.video_frames || 25;
                if(videoMotionBucketInput) videoMotionBucketInput.value = settings.video_params.motion_bucket_id || 127;
                if(videoFpsInput) videoFpsInput.value = settings.video_params.fps || 6;
                if(videoAugmentationLevelSlider) {
                    const aug_level = settings.video_params.augmentation_level || 0.0;
                    videoAugmentationLevelSlider.value = aug_level;
                    videoAugmentationLevelSlider.dispatchEvent(new Event('input'));
                }
            }

        } catch (error) {
            console.error("載入設定失敗，將使用預設值:", error.message);
            if(comfyFormElements.seed_behavior) comfyFormElements.seed_behavior.value = 'random';
            if(comfyRandomSeedBtn) comfyRandomSeedBtn.click();
        }
    }
    
    async function updateLoraListForModel(modelName) {
        if (!modelName) return;
        if (!loraSelectionGrid) return;
        loraSelectionGrid.innerHTML = '<p class="text-muted">正在載入 LoRA 列表...</p>';
        try {
            const response = await fetchWithUserContext(`/api/comfyui/loras_by_model?model_name=${encodeURIComponent(modelName)}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `無法獲取 LoRAs: ${response.statusText}`);
            }
            const loras = await response.json();
            loraSelectionGrid.innerHTML = '';
            if (loras.length === 0) {
                loraSelectionGrid.innerHTML = '<p class="text-muted">未找到與當前模型類型匹配的 LoRA。</p>';
            } else {
                loras.forEach(lora => loraSelectionGrid.appendChild(createModelCard(lora, 'lora')));
            }
        } catch (error) {
            loraSelectionGrid.innerHTML = `<p class="text-danger">錯誤: ${error.message}</p>`;
        }
    }

    async function uploadImageToServer(file) {
        if (!file) return null;
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetchWithUserContext('/api/comfyui/upload_image', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || `伺服器錯誤: ${response.statusText}`);
            }
            const data = await response.json();
            return data.name;
        } catch (error) {
            alert(`圖片上傳失敗: ${error.message}`);
            return null;
        }
    }

    async function handleFileUpload(file, stateObject, previewElement, uploadArea, previewContainer, filenameElement, tabElement, stateKey) {
        if (!file) return;
        uploadArea.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-2">正在上傳...</p>';
        
        const filename = await uploadImageToServer(file);
        if (filename) {
            stateObject[stateKey] = filename;
            const reader = new FileReader();
            reader.onload = (e) => { if(previewElement) previewElement.src = e.target.result; };
            reader.readAsDataURL(file);
            
            if(uploadArea) uploadArea.style.display = 'none';
            if(previewContainer) previewContainer.style.display = 'block';
            if(filenameElement) filenameElement.textContent = file.name;
            if(tabElement) tabElement.classList.add('active-mode');
            updateDenoiseDefault();
        } else {
            resetFileUploadUI(stateObject, stateKey, uploadArea, previewContainer, previewElement, filenameElement, tabElement);
        }
    }

    function resetFileUploadUI(stateObject, stateKey, uploadArea, previewContainer, previewElement, filenameElement, tabElement, uploadText, subText) {
        stateObject[stateKey] = null;
        const inputElement = uploadArea.previousElementSibling;
        if(inputElement && inputElement.type === 'file') inputElement.value = '';

        if(uploadArea) {
            uploadArea.innerHTML = `<i class="bi bi-cloud-arrow-up-fill fs-1 text-secondary"></i><p class="mt-2 mb-0">${uploadText}</p><small class="text-muted">${subText}</small>`;
            uploadArea.style.display = 'block';
        }
        if(previewContainer) previewContainer.style.display = 'none';
        if(previewElement) previewElement.src = '#';
        if(filenameElement) filenameElement.textContent = '';
        if(tabElement) tabElement.classList.remove('active-mode');
        updateDenoiseDefault();
    }

    if(img2imgUploadArea) img2imgUploadArea.addEventListener('click', () => img2imgFileInput.click());
    if(img2imgFileInput) img2imgFileInput.addEventListener('change', (e) => handleFileUpload(e.target.files[0], img2imgState, img2imgPreview, img2imgUploadArea, img2imgPreviewContainer, img2imgFilename, img2imgTab, 'source_image'));
    if(img2imgClearBtn) img2imgClearBtn.addEventListener('click', () => resetFileUploadUI(img2imgState, 'source_image', img2imgUploadArea, img2imgPreviewContainer, img2imgPreview, img2imgFilename, img2imgTab, '點擊此處上傳圖片', '將啟用以圖生圖模式'));

    if(maskUploadArea) maskUploadArea.addEventListener('click', () => maskFileInput.click());
    if(maskFileInput) maskFileInput.addEventListener('change', (e) => handleFileUpload(e.target.files[0], img2imgState, maskPreview, maskUploadArea, maskPreviewContainer, maskFilename, null, 'inpaint_mask'));
    if(maskClearBtn) maskClearBtn.addEventListener('click', () => resetFileUploadUI(img2imgState, 'inpaint_mask', maskUploadArea, maskPreviewContainer, maskPreview, maskFilename, null, '點擊上傳遮罩', '白色區域為重繪部分'));

    if(controlnetUploadArea) controlnetUploadArea.addEventListener('click', () => controlnetFileInput.click());
    if(controlnetFileInput) controlnetFileInput.addEventListener('change', (e) => handleFileUpload(e.target.files[0], controlnetState, controlnetPreview, controlnetUploadArea, controlnetPreviewContainer, controlnetFilename, null, 'controlnet_image'));
    if(controlnetClearBtn) controlnetClearBtn.addEventListener('click', () => resetFileUploadUI(controlnetState, 'controlnet_image', controlnetUploadArea, controlnetPreviewContainer, controlnetPreview, controlnetFilename, null, '點擊上傳參考圖', ''));

    if(videoUploadArea) videoUploadArea.addEventListener('click', () => videoFileInput.click());
    if(videoFileInput) videoFileInput.addEventListener('change', (e) => handleFileUpload(e.target.files[0], videoState, videoPreview, videoUploadArea, videoPreviewContainer, videoFilename, null, 'source_image'));
    if(videoClearBtn) videoClearBtn.addEventListener('click', () => resetFileUploadUI(videoState, 'source_image', videoUploadArea, videoPreviewContainer, videoPreview, videoFilename, null, '點擊上傳初始圖片', ''));

    function syncDenoiseValues(value) {
        const floatValue = parseFloat(value);
        if (comfyFormElements.denoise) comfyFormElements.denoise.value = floatValue.toFixed(2);
        if (img2imgDenoiseSlider) img2imgDenoiseSlider.value = floatValue;
        if (img2imgDenoiseValueLabel) img2imgDenoiseValueLabel.textContent = floatValue.toFixed(2);
    }

    if (comfyFormElements.denoise) comfyFormElements.denoise.addEventListener('input', (e) => syncDenoiseValues(e.target.value));
    if (img2imgDenoiseSlider) img2imgDenoiseSlider.addEventListener('input', (e) => syncDenoiseValues(e.target.value));

    async function fetchAndPopulateCheckpoints() {
        try {
            const checkpointsResponse = await fetchWithUserContext('/api/comfyui/checkpoints');
            if (!checkpointsResponse.ok) throw new Error(`無法獲取 Checkpoints: ${checkpointsResponse.statusText}`);
            const checkpoints = await checkpointsResponse.json();
            
            if (modelSelectionGrid) {
                modelSelectionGrid.innerHTML = '';
                checkpoints.forEach(model => modelSelectionGrid.appendChild(createModelCard(model, 'model')));
            }
            if (!comfyFormElements.model && checkpoints.length > 0) {
                comfyFormElements.model = checkpoints[0].name;
                comfyFormElements.model_architecture = checkpoints[0].architecture;
                if (comfySelectedModelName) comfySelectedModelName.textContent = checkpoints[0].name;
            }
            await updateLoraListForModel(comfyFormElements.model);
        } catch (error) {
            if(comfyStatusText) { comfyStatusText.textContent = `錯誤: ${error.message}。`; comfyStatusText.classList.add('text-danger'); }
        }
    }

    async function fetchAndPopulateVideoModels() {
        try {
            const response = await fetchWithUserContext('/api/comfyui/video_models');
            if (!response.ok) throw new Error('無法獲取影片模型');
            const models = await response.json();
            if (videoModelSelect) {
                videoModelSelect.innerHTML = '';
                if (models.length === 0) {
                    videoModelSelect.innerHTML = '<option value="">未找到影片模型</option>';
                } else {
                    models.forEach(model => {
                        const option = document.createElement('option');
                        option.value = model;
                        option.textContent = model;
                        videoModelSelect.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('填充影片模型時出錯:', error);
            if (videoModelSelect) {
                videoModelSelect.innerHTML = `<option value="">錯誤: ${error.message}</option>`;
            }
        }
    }

    async function fetchAndPopulateControlNetResources() {
        try {
            const modelsResponse = await fetchWithUserContext('/api/comfyui/controlnet_models');
            if (!modelsResponse.ok) throw new Error('無法獲取 ControlNet 模型');
            const models = await modelsResponse.json();
            if (controlnetModelSelect) {
                controlnetModelSelect.innerHTML = '';
                models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model;
                    option.textContent = model;
                    controlnetModelSelect.appendChild(option);
                });
            }

            const preprocessorsResponse = await fetchWithUserContext('/api/comfyui/controlnet_preprocessors');
            if (!preprocessorsResponse.ok) throw new Error('無法獲取 ControlNet 預處理器');
            const preprocessors = await preprocessorsResponse.json();
            if (controlnetPreprocessorSelect) {
                controlnetPreprocessorSelect.innerHTML = '';
                preprocessors.forEach(proc => {
                    const option = document.createElement('option');
                    option.value = proc;
                    option.textContent = proc;
                    controlnetPreprocessorSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('填充 ControlNet 資源時出錯:', error);
            if (controlnetOptionsContainer) {
                controlnetOptionsContainer.innerHTML = `<p class="text-danger">錯誤: ${error.message}</p>`;
            }
        }
    }

    async function fetchAndPopulateSamplers() {
        const samplerSelect = comfyFormElements.sampler_name;
        const schedulerSelect = comfyFormElements.scheduler;
    
        if (!samplerSelect || !schedulerSelect) return;
    
        try {
            const [samplersRes, schedulersRes] = await Promise.all([
                fetchWithUserContext('/api/comfyui/samplers'),
                fetchWithUserContext('/api/comfyui/schedulers')
            ]);
    
            if (!samplersRes.ok || !schedulersRes.ok) {
                throw new Error('無法從後端獲取採樣器或排程器列表。');
            }
    
            const samplers = await samplersRes.json();
            const schedulers = await schedulersRes.json();
    
            const populateSelect = (selectElement, options) => {
                const currentValue = selectElement.value;
                selectElement.innerHTML = '';
                options.forEach(optionValue => {
                    const option = document.createElement('option');
                    option.value = optionValue;
                    option.textContent = optionValue;
                    selectElement.appendChild(option);
                });
                if (options.includes(currentValue)) {
                    selectElement.value = currentValue;
                }
            };
    
            populateSelect(samplerSelect, samplers);
            populateSelect(schedulerSelect, schedulers);
    
        } catch (error) {
            console.error("填充採樣器/排程器時出錯:", error);
        }
    }

    function createModelCard(item, type) {
        const card = document.createElement('div');
        card.className = 'model-card';
        card.dataset.itemName = item.name;
        
        const imgContainer = document.createElement('div');
        imgContainer.className = 'model-card-img-container';
        if (item.preview_url) {
            const img = document.createElement('img');
            img.src = new URL(item.preview_url, activeDeviceUrl).href;
            img.alt = item.name;
            img.onerror = () => { img.src = "https://via.placeholder.com/150x150.png?text=Preview+Error"; };
            imgContainer.appendChild(img);
        } else {
            imgContainer.innerHTML = `<i class="bi ${item.name === 'None' ? 'bi-slash-circle' : 'bi-image'}"></i>`;
        }
        
        const title = document.createElement('div');
        title.className = 'model-card-title';
        title.textContent = item.name.split(/[\\/]/).pop();
        
        card.append(imgContainer, title);
        
        if (type === 'model') {
            card.addEventListener('click', async () => {
                const newModel = item.name;
                if (comfyFormElements.model !== newModel) {
                    comfyFormElements.loras = [];
                    renderSelectedLoras();
                }
                comfyFormElements.model = newModel;
                comfyFormElements.model_architecture = item.architecture;
                if (comfySelectedModelName) comfySelectedModelName.textContent = newModel;
                if (bsModelSelectionModal) bsModelSelectionModal.hide();
                await updateLoraListForModel(newModel);
            });
        } else if (type === 'lora') {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input lora-card-checkbox';
            checkbox.checked = tempSelectedLoras.has(item.name);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) tempSelectedLoras.add(item.name);
                else tempSelectedLoras.delete(item.name);
            });
            card.appendChild(checkbox);
            card.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });
        }
        return card;
    }

    function renderSelectedLoras() {
        if (!selectedLoraListContainer) return;
        selectedLoraListContainer.innerHTML = '';
        if (comfyFormElements.loras.length === 0) {
            selectedLoraListContainer.innerHTML = '<p class="text-muted small">未選擇任何 LoRA。</p>';
            return;
        }
        
        comfyFormElements.loras.forEach((lora, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'd-flex align-items-center mb-2';
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'lora-name';
            nameSpan.textContent = lora.name.split(/[\\/]/).pop();
            nameSpan.title = lora.name;
            Object.assign(nameSpan.style, { flexGrow: '1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: '1rem' });

            const weightInput = document.createElement('input');
            weightInput.type = 'range';
            weightInput.className = 'form-range lora-weight';
            weightInput.min = 0;
            weightInput.max = 1.5;
            weightInput.step = 0.1;
            weightInput.value = lora.weight;
            
            const weightLabel = document.createElement('span');
            weightLabel.className = 'badge bg-secondary ms-2';
            weightLabel.textContent = lora.weight.toFixed(1);
            
            weightInput.addEventListener('input', () => {
                lora.weight = parseFloat(weightInput.value);
                weightLabel.textContent = lora.weight.toFixed(1);
            });
            
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn-close ms-2';
            removeBtn.addEventListener('click', () => {
                comfyFormElements.loras.splice(index, 1);
                renderSelectedLoras();
            });
            
            itemDiv.append(nameSpan, weightInput, weightLabel, removeBtn);
            selectedLoraListContainer.appendChild(itemDiv);
        });
    }

    function applyHighlightByIds(ids) {
        if (!comfyHistoryGrid || !ids || ids.length === 0) return;
        comfyHistoryGrid.querySelectorAll('.history-item.newly-generated').forEach(item => item.classList.remove('newly-generated'));
        ids.forEach(id => {
            const itemToHighlight = comfyHistoryGrid.querySelector(`.history-item[data-item-id="${id}"]`);
            if (itemToHighlight) itemToHighlight.classList.add('newly-generated');
        });
    }

    function applyPersistedHighlight() {
        const idsJson = localStorage.getItem('last_batch_ids');
        if (idsJson) {
            try {
                applyHighlightByIds(JSON.parse(idsJson));
                localStorage.removeItem('last_batch_ids');
            } catch (e) {
                console.error("解析高亮 ID 時出錯:", e);
                localStorage.removeItem('last_batch_ids');
            }
        }
    }

    function addHistoryItemToGrid(item, mode = 'append') {
        if (!comfyHistoryGrid) return;
        const itemDate = new Date(item.created_at).toLocaleDateString();
        let header = comfyHistoryGrid.querySelector(`.history-date-header[data-date="${itemDate}"]`);

        const historyItemDiv = document.createElement('div');
        historyItemDiv.className = 'history-item';
        historyItemDiv.dataset.itemId = item.id;
        historyItemDiv.dataset.historyItem = JSON.stringify(item);

        const fullItemUrl = new URL(item.url, activeDeviceUrl).href;

        let mediaElement;
        if (item.is_video) {
            mediaElement = document.createElement('video');
            mediaElement.src = fullItemUrl;
            mediaElement.muted = true;
            mediaElement.loop = true;
            mediaElement.preload = 'metadata';
            
            const playIcon = document.createElement('i');
            playIcon.className = 'bi bi-play-circle-fill video-play-icon';
            historyItemDiv.appendChild(playIcon);

        } else {
            mediaElement = document.createElement('img');
            mediaElement.src = fullItemUrl;
            mediaElement.alt = item.filename;
            mediaElement.loading = 'lazy';
        }
        
        const selectionOverlay = document.createElement('div');
        selectionOverlay.className = 'selection-overlay';
        selectionOverlay.innerHTML = `<i class="bi bi-check-circle-fill selection-icon"></i>`;
        
        historyItemDiv.addEventListener('click', () => {
            if (isSelectionMode) {
                toggleItemSelection(historyItemDiv, item.id);
            } else {
                currentModalIndex = currentHistoryList.findIndex(i => i.id === item.id);
                if (currentModalIndex !== -1) {
                    showImageInModal(currentModalIndex);
                }
            }
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '<i class="bi bi-trash-fill"></i>';
        deleteBtn.title = `刪除`;
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`確定要刪除這個項目嗎？`)) await deleteHistoryItem(item.id, historyItemDiv);
        });

        historyItemDiv.prepend(mediaElement);
        historyItemDiv.append(selectionOverlay, deleteBtn);

        const existingIndicator = comfyHistoryGrid.querySelector('#history-loading-indicator');
        if (existingIndicator) existingIndicator.remove();

        if (mode === 'prepend') {
            let firstElement = comfyHistoryGrid.firstChild;
            if (!header) {
                header = document.createElement('div');
                header.className = 'history-date-header';
                header.dataset.date = itemDate;
                header.textContent = itemDate;
                comfyHistoryGrid.insertBefore(header, firstElement);
            }
            header.after(historyItemDiv);
        } else {
            if (!header) {
                header = document.createElement('div');
                header.className = 'history-date-header';
                header.dataset.date = itemDate;
                header.textContent = itemDate;
                comfyHistoryGrid.appendChild(header);
            }
            comfyHistoryGrid.appendChild(historyItemDiv);
        }
        return historyItemDiv;
    }

    async function fetchHistory(mode = 'initial') {
        if (isLoadingHistory && mode !== 'newer') return [];
        isLoadingHistory = true;
        
        if (mode !== 'newer' && historyLoadingIndicator) {
            historyLoadingIndicator.textContent = '正在載入...';
            historyLoadingIndicator.style.display = 'block';
            if(comfyHistoryGrid) comfyHistoryGrid.appendChild(historyLoadingIndicator);
        }

        let url = '/api/comfyui/history?limit=30';
        if (mode === 'older' && currentHistoryList.length > 0) {
            url += `&before_timestamp=${encodeURIComponent(currentHistoryList[currentHistoryList.length - 1].created_at)}`;
        } else if (mode === 'newer' && currentHistoryList.length > 0) {
            url = `/api/comfyui/history?after_timestamp=${encodeURIComponent(currentHistoryList[0].created_at)}`;
        }
        
        try {
            const response = await fetchWithUserContext(url);
            if (!response.ok) throw new Error(`無法獲取歷史紀錄: ${response.statusText}`);
            const items = await response.json();
            renderHistory(items, mode);
            if (mode === 'older' || mode === 'initial') {
                hasMoreHistory = items.length >= 30;
                if (!hasMoreHistory && historyLoadingIndicator) {
                    historyLoadingIndicator.textContent = '沒有更多紀錄了';
                    if(comfyHistoryGrid) comfyHistoryGrid.appendChild(historyLoadingIndicator);
                } else if (historyLoadingIndicator) {
                    historyLoadingIndicator.style.display = 'none';
                }
            }
            return items;
        } catch (error) {
            console.error("獲取歷史紀錄失敗:", error);
            if (historyLoadingIndicator && mode !== 'newer') historyLoadingIndicator.textContent = `錯誤: ${error.message}`;
            return [];
        } finally {
            if (mode !== 'newer') isLoadingHistory = false;
        }
    }

    function renderHistory(items, mode) {
        if (!comfyHistoryGrid || !items) return;
        const placeholder = comfyHistoryGrid.querySelector('p.text-muted');
        if (placeholder) placeholder.remove();

        if (mode === 'initial') {
            comfyHistoryGrid.innerHTML = '';
            currentHistoryList = items;
        } else if (mode === 'older') {
            currentHistoryList.push(...items);
        } else if (mode === 'newer') {
            currentHistoryList.unshift(...items);
        }
        
        comfyHistoryGrid.innerHTML = '';
        const grouped = {};
        currentHistoryList.forEach(item => {
            const date = new Date(item.created_at).toLocaleDateString();
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push(item);
        });

        Object.keys(grouped).sort((a,b) => new Date(b) - new Date(a)).forEach(date => {
            const header = document.createElement('div');
            header.className = 'history-date-header';
            header.dataset.date = date;
            header.textContent = date;
            comfyHistoryGrid.appendChild(header);
            grouped[date].forEach(item => addHistoryItemToGrid(item, 'append'));
        });

        if (currentHistoryList.length === 0) {
            comfyHistoryGrid.innerHTML = '<p class="text-muted">沒有歷史紀錄。</p>';
            hasMoreHistory = false;
        }
    }

    async function initializeHistory() {
        if (!comfyHistoryGrid) return;
        comfyHistoryGrid.replaceWith(comfyHistoryGrid.cloneNode(true));
        comfyHistoryGrid = getById('comfy-history-grid');
        
        comfyHistoryGrid.addEventListener('scroll', async () => {
            if (isLoadingHistory || !hasMoreHistory) return;
            const { scrollTop, scrollHeight, clientHeight } = comfyHistoryGrid;
            if (scrollHeight - scrollTop - clientHeight < 400) await fetchHistory('older');
        });
        await fetchHistory('initial');
        applyPersistedHighlight();
    }

    async function deleteHistoryItem(id, elementToRemove) {
        try {
            const response = await fetchWithUserContext('/api/comfyui/history', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id })
            });
            const result = await response.json();
            if (response.ok) {
                const header = elementToRemove.previousElementSibling;
                elementToRemove.remove();
                if (header && header.classList.contains('history-date-header') && (!header.nextElementSibling || !header.nextElementSibling.classList.contains('history-item'))) {
                    header.remove();
                }
                currentHistoryList = currentHistoryList.filter(item => item.id !== id);
                if (currentHistoryList.length === 0) renderHistory([], 'initial'); 
            } else { 
                throw new Error(result.detail || '刪除失敗'); 
            }
        } catch (error) { 
            alert(`刪除失敗: ${error.message}`); 
        }
    }
    
    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
        return outputArray;
    }

    async function subscribeToPush() {
        try {
            const response = await fetchWithUserContext('/api/comfyui/vapid_public_key');
            const data = await response.json();
            const applicationServerKey = urlBase64ToUint8Array(data.public_key);
            const subscription = await serviceWorkerRegistration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
            await fetchWithUserContext('/api/comfyui/save_subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription) });
            console.log('已成功訂閱 Web Push 通知。');
            await updateNotificationUI();
        } catch (error) {
            console.error('訂閱 Web Push 通知失敗:', error);
            await updateNotificationUI();
        }
    }
    
    async function updateNotificationUI() {
        if (!notificationStatusBadge || !enableNotificationsBtn) return;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            notificationStatusBadge.textContent = '不支援';
            notificationStatusBadge.className = 'badge bg-dark notification-status-badge';
            enableNotificationsBtn.disabled = true;
            enableNotificationsBtn.textContent = '瀏覽器不支援';
            return;
        }
        const permission = await navigator.permissions.query({ name: 'push', userVisibleOnly: true });
        switch (permission.state) {
            case 'granted':
                notificationStatusBadge.textContent = '已啟用';
                notificationStatusBadge.className = 'badge bg-success notification-status-badge';
                enableNotificationsBtn.style.display = 'none';
                break;
            case 'denied':
                notificationStatusBadge.textContent = '已封鎖';
                notificationStatusBadge.className = 'badge bg-danger notification-status-badge';
                enableNotificationsBtn.disabled = true;
                enableNotificationsBtn.textContent = '已被封鎖';
                break;
            default:
                notificationStatusBadge.textContent = '點擊啟用';
                notificationStatusBadge.className = 'badge bg-warning text-dark notification-status-badge';
                enableNotificationsBtn.disabled = false;
                enableNotificationsBtn.style.display = 'block';
                break;
        }
    }

    const resetUI = () => {
        if (comfyGenerateBtn) comfyGenerateBtn.disabled = false;
        if(comfySpinner) comfySpinner.style.display = 'none';
        if(comfyProgressContainer) comfyProgressContainer.style.display = 'none';
        if(comfyStatusText) {
            if (!comfyStatusText.classList.contains('text-danger')) {
                 comfyStatusText.textContent = '請在左側設定參數並點擊生成。';
            }
            comfyStatusText.classList.remove('text-success');
            comfyStatusText.style.display = 'block';
        }
        trackedPromptId = null; 
    };

    function setGeneratingState(promptId) {
        if (!promptId) return;
        trackedPromptId = promptId; 
        if (comfyGenerateBtn) comfyGenerateBtn.disabled = true;
        if (comfySpinner) comfySpinner.style.display = 'inline-block';
        if (comfyStatusText) {
            comfyStatusText.textContent = '任務執行中，正在連接進度...';
            comfyStatusText.style.display = 'block';
            comfyStatusText.classList.remove('text-danger', 'text-success');
        }
        if (comfyProgressContainer) comfyProgressContainer.style.display = 'none';
        if (positivePromptWarning) positivePromptWarning.style.display = 'none';
        
        // [v16.0 修正] 初始化總進度條狀態
        accumulatedSteps = 0;
        currentNodeTotalSteps = 0;
        isNewNodeProgress = true;

        connectStatusWebSocket(promptId);
    }

    async function handleGenerateClick() {
        if (!comfyGenerateBtn || comfyGenerateBtn.disabled) return;
    
        const activeTabPane = document.querySelector('#control-panel-tab-content .tab-pane.active');
        const isVideoMode = activeTabPane && activeTabPane.id === 'tab-pane-video';
    
        if (!isVideoMode && !comfyFormElements.model) {
            alert('請先選擇一個 Checkpoint 模型！');
            return;
        }
        if (isVideoMode && (!videoModelSelect || !videoModelSelect.value)) {
            alert('請先選擇一個影片模型！');
            return;
        }
    
        comfyGenerateBtn.disabled = true;
        if (comfySpinner) comfySpinner.style.display = 'inline-block';
        if (comfyStatusText) {
            comfyStatusText.textContent = '正在提交任務...';
            comfyStatusText.style.display = 'block';
            comfyStatusText.classList.remove('text-danger', 'text-success');
        }
        if (comfyProgressContainer) comfyProgressContainer.style.display = 'none';
        if (positivePromptWarning) positivePromptWarning.style.display = 'none';
    
        await saveSettings();
    
        const payload = {
            model: comfyFormElements.model,
            model_architecture: comfyFormElements.model_architecture,
            loras: comfyFormElements.loras,
            main_prompt: isVideoMode ? '' : (comfyFormElements.positive_prompt ? comfyFormElements.positive_prompt.value.trim() : ''),
            video_main_prompt: isVideoMode ? (videoMainPrompt ? videoMainPrompt.value.trim() : '') : '',
            fixed_prompt: comfyFormElements.fixed_prompt ? comfyFormElements.fixed_prompt.value.trim() : '',
            fixed_prompt_position: comfyFormElements.fixed_prompt_prepend && comfyFormElements.fixed_prompt_prepend.checked ? 'prepend' : 'append',
            negative_prompt: comfyFormElements.negative_prompt ? comfyFormElements.negative_prompt.value.trim() : '',
            seed: comfyFormElements.seed ? parseInt(comfyFormElements.seed.value, 10) : 0,
            steps: comfyFormElements.steps ? parseInt(comfyFormElements.steps.value, 10) : 20,
            cfg: comfyFormElements.cfg ? parseFloat(comfyFormElements.cfg.value) : 8.0,
            sampler_name: comfyFormElements.sampler_name ? comfyFormElements.sampler_name.value : 'euler',
            scheduler: comfyFormElements.scheduler ? comfyFormElements.scheduler.value : 'normal',
            batch_size: comfyFormElements.batch_size ? parseInt(comfyFormElements.batch_size.value, 10) : 1,
            width: 1024,
            height: 1024,
            denoise: comfyFormElements.denoise ? parseFloat(comfyFormElements.denoise.value) : 1.0,
            source_image: img2imgState.source_image,
            inpaint_mask: img2imgState.inpaint_mask,
            optimize_positive: isVideoMode ? (videoOptimizePositiveCheckbox ? videoOptimizePositiveCheckbox.checked : false) : (comfyFormElements.optimize_positive ? comfyFormElements.optimize_positive.checked : false),
            ai_optimize: isVideoMode ? (videoAiOptimizeCheckbox ? videoAiOptimizeCheckbox.checked : false) : (comfyFormElements.ai_optimize ? comfyFormElements.ai_optimize.checked : false),
            translate_negative: comfyFormElements.translate_negative ? comfyFormElements.translate_negative.checked : false,
            seed_behavior: comfyFormElements.seed_behavior ? comfyFormElements.seed_behavior.value : 'increment',
            enable_adetailer: comfyFormElements.enable_adetailer ? comfyFormElements.enable_adetailer.checked : false,
            adetailer_positive_prompt: comfyFormElements.adetailer_positive_prompt ? comfyFormElements.adetailer_positive_prompt.value : '',
            translate_adetailer_positive: comfyFormElements.translate_adetailer_positive ? comfyFormElements.translate_adetailer_positive.checked : false,
            enable_controlnet: enableControlnetSwitch ? enableControlnetSwitch.checked : false,
            controlnet_model: controlnetModelSelect ? controlnetModelSelect.value : null,
            controlnet_preprocessor: controlnetPreprocessorSelect ? controlnetPreprocessorSelect.value : null,
            controlnet_strength: controlnetStrengthSlider ? parseFloat(controlnetStrengthSlider.value) : 1.0,
            controlnet_image: controlnetState.controlnet_image,
            is_video: isVideoMode,
            video_params: null
        };
    
        if (isVideoMode) {
            payload.video_params = {
                svd_model: videoModelSelect ? videoModelSelect.value : '',
                video_frames: videoFramesInput ? parseInt(videoFramesInput.value, 10) : 25,
                motion_bucket_id: videoMotionBucketInput ? parseInt(videoMotionBucketInput.value, 10) : 127,
                fps: videoFpsInput ? parseInt(videoFpsInput.value, 10) : 6,
                augmentation_level: videoAugmentationLevelSlider ? parseFloat(videoAugmentationLevelSlider.value) : 0.0
            };
            if (videoGenerationModeSelect && videoGenerationModeSelect.value === 'image-to-video') {
                payload.source_image = videoState.source_image;
            } else {
                payload.source_image = null;
            }
        }
        
        // [v16.0 修正] 計算總預期步數
        const mainSteps = payload.steps;
        const batchSize = payload.batch_size;
        const adetailerSteps = Math.floor(mainSteps * 0.4); // ADetailer 的 denoise 是 0.4
        totalExpectedSteps = mainSteps + (payload.enable_adetailer ? (adetailerSteps * batchSize) : 0);

        try {
            const response = await fetchWithUserContext('/api/comfyui/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
    
            if (!response.ok) {
                let errorMsg = `提交任務失敗，狀態碼: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.detail || `提交任務失敗: ${response.statusText}`;
                } catch (e) {}
                throw new Error(errorMsg);
            }
    
            const data = await response.json();
            if (data && data.prompt_id) {
                setGeneratingState(data.prompt_id);
            } else {
                throw new Error('後端成功響應，但未返回有效的 prompt_id。');
            }
    
        } catch (error) {
            console.error('生成流程出錯:', error);
            if (comfyStatusText) {
                comfyStatusText.textContent = `錯誤:\n${error.message}`;
                comfyStatusText.classList.add('text-danger');
            }
            resetUI();
        }
    }

    function connectStatusWebSocket(prompt_id) {
        if (comfyStatusWs && comfyStatusWs.readyState === WebSocket.OPEN) comfyStatusWs.close();
        
        const wsProtocol = activeDeviceUrl.startsWith('https:') ? 'wss:' : 'ws:';
        const wsHost = new URL(activeDeviceUrl).host;
        const wsUrl = `${wsProtocol}//${wsHost}/api/comfyui/ws/status/${prompt_id}`;

        comfyStatusWs = new WebSocket(wsUrl);
        let isFirstItem = true;

        comfyStatusWs.onopen = () => console.log(`已連接到狀態 WebSocket，監聽 Prompt ID: ${prompt_id}`);
        comfyStatusWs.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (trackedPromptId !== prompt_id) return;

            switch (message.type) {
                case 'progress':
                    const data = message.data;
                    
                    // [v16.0 修正] 總進度條邏輯
                    if (isNewNodeProgress) {
                        accumulatedSteps += currentNodeTotalSteps;
                        currentNodeTotalSteps = data.total_steps;
                        isNewNodeProgress = false;
                    }
                    if (data.current_step === data.total_steps) {
                        isNewNodeProgress = true;
                    }

                    const currentTotalProgress = accumulatedSteps + data.current_step;
                    const percent = totalExpectedSteps > 0 ? (currentTotalProgress / totalExpectedSteps) * 100 : 0;

                    if(comfyStatusText) comfyStatusText.style.display = 'none';
                    if(comfyProgressContainer) comfyProgressContainer.style.display = 'block';
                    if(comfyProgressBar) {
                        comfyProgressBar.style.width = `${Math.min(percent, 100)}%`;
                        comfyProgressBar.setAttribute('aria-valuenow', percent);
                    }
                    if(comfyProgressText) {
                        comfyProgressText.textContent = `總進度: ${currentTotalProgress} / ${totalExpectedSteps} (估算)`;
                    }
                    break;
                case 'item_generated':
                    const itemData = message.data;
                    const promptText = itemData.params?.positive_prompt || '';

                    if (promptText.includes("LOCAL_FALLBACK_USED:")) {
                        if (positivePromptWarning) {
                            positivePromptWarning.textContent = '警告：LLM 安全過濾已觸發，已使用本地翻譯作為後備。';
                            positivePromptWarning.style.display = 'block';
                        }
                    } else if (promptText.includes("TRANSLATION_FAILED:")) {
                         if (positivePromptWarning) {
                            positivePromptWarning.textContent = '錯誤：提示詞翻譯失敗，請檢查後端日誌。';
                            positivePromptWarning.style.display = 'block';
                        }
                    }

                    if (isFirstItem) {
                        const fullItemUrl = new URL(itemData.url, activeDeviceUrl).href;
                        if (itemData.is_video) {
                            if(comfyResultImage) comfyResultImage.style.display = 'none';
                            if(comfyResultVideo) {
                                comfyResultVideo.src = fullItemUrl;
                                comfyResultVideo.style.display = 'block';
                                comfyResultVideo.play();
                            }
                        } else {
                            if(comfyResultVideo) comfyResultVideo.style.display = 'none';
                            if(comfyResultImage) {
                                comfyResultImage.src = fullItemUrl;
                                comfyResultImage.style.display = 'block';
                            }
                        }
                        isFirstItem = false;
                    }
                    break;
                case 'all_complete': 
                    break;
                case 'error':
                    if(comfyStatusText) {
                        comfyStatusText.textContent = `錯誤: ${message.data.message}`;
                        comfyStatusText.classList.add('text-danger');
                    }
                    comfyStatusWs.close();
                    break;
            }
        };
        comfyStatusWs.onclose = (event) => console.log(`狀態 WebSocket (Prompt ID: ${prompt_id}) 已關閉。 Code: ${event.code}`);
        comfyStatusWs.onerror = (error) => {
            console.error(`狀態 WebSocket (Prompt ID: ${prompt_id}) 發生錯誤:`, error);
            if(comfyStatusText) {
                comfyStatusText.textContent = '進度監聽連線錯誤。';
                comfyStatusText.classList.add('text-danger');
            }
        };
    }

    async function pollQueueStatus() {
        try {
            const response = await fetchWithUserContext('/api/comfyui/queue/status');
            if (!response.ok) {
                if(wasPreviouslyRunning) resetUI();
                wasPreviouslyRunning = false;
                return;
            }
            const data = await response.json();
            if (data.is_running) {
                wasPreviouslyRunning = true;
                if (trackedPromptId !== data.prompt_id) setGeneratingState(data.prompt_id);
            } else {
                if (wasPreviouslyRunning) {
                    const newItems = await fetchHistory('newer');
                    resetUI();
                    if (newItems.length > 0) {
                        const newItemIds = newItems.map(item => item.id);
                        applyHighlightByIds(newItemIds);
                        localStorage.setItem('last_batch_ids', JSON.stringify(newItemIds));
                    }
                }
                wasPreviouslyRunning = false;
            }
        } catch (error) {
            console.error("輪詢佇列狀態時發生錯誤:", error);
            if(wasPreviouslyRunning) resetUI();
            wasPreviouslyRunning = false;
        }
    }

    function showImageInModal(index) {
        if (index < 0 || index >= currentHistoryList.length) return;
        currentModalIndex = index;
        const item = currentHistoryList[index];
        
        if (!item) {
            console.error("嘗試在燈箱中顯示一個無效的歷史紀錄項目。");
            return;
        }

        modalImage.style.display = 'none';
        modalVideo.style.display = 'none';
        modalVideo.pause();
        modalVideo.currentTime = 0;
        Object.values(modalParams).forEach(el => {
            if (el && el.style && (el.id.includes('-info') || el.id.includes('-container'))) {
                el.style.display = 'none';
            }
        });
        
        const fullItemUrl = new URL(item.url, activeDeviceUrl).href;

        if (item.is_video) {
            modalVideo.src = fullItemUrl;
            modalVideo.style.display = 'block';
            modalVideo.play();
        } else {
            modalImage.src = fullItemUrl;
            modalImage.style.display = 'block';
        }

        if (modalDownloadBtn) {
            modalDownloadBtn.href = fullItemUrl;
            modalDownloadBtn.download = item.filename ? item.filename.split(/[\\/]/).pop() : 'download';
        }

        const params = item.params || {};

        modalParams.model.textContent = params.model || '未知';
        
        modalParams.lora_list.innerHTML = '';
        if (params.loras && params.loras.length > 0) {
            const ul = document.createElement('ul');
            ul.className = 'list-unstyled mb-0';
            params.loras.forEach(lora => {
                const li = document.createElement('li');
                li.className = 'param-value';
                li.textContent = `${lora.name} (權重: ${lora.weight.toFixed(1)})`;
                ul.appendChild(li);
            });
            modalParams.lora_list.appendChild(ul);
        } else {
            modalParams.lora_list.innerHTML = '<p class="param-value">無</p>';
        }

        if (params.source_image && typeof params.denoise === 'number' && !item.is_video) {
            modalParams.source_image.textContent = params.source_image;
            modalParams.denoise.textContent = params.denoise;
            modalParams.img2img_info.style.display = 'block';
        }

        if (params.enable_controlnet) {
            modalParams.controlnet_model.textContent = params.controlnet_model || '未知';
            modalParams.controlnet_preprocessor.textContent = params.controlnet_preprocessor || '未知';
            modalParams.controlnet_strength.textContent = params.controlnet_strength || '未知';
            modalParams.controlnet_info.style.display = 'block';
        }

        if (item.is_video && params.video_params) {
            const vp = params.video_params;
            modalParams.svd_model.textContent = vp.svd_model || '未知';
            modalParams.video_frames.textContent = vp.video_frames || '未知';
            modalParams.video_fps.textContent = vp.fps || '未知';
            modalParams.motion_bucket.textContent = vp.motion_bucket_id || '未知';
            modalParams.augmentation_level.textContent = (vp.augmentation_level || 0.0).toFixed(2);
            modalParams.video_info.style.display = 'block';
        }

        modalParams.optimization_mode.textContent = params.optimization_mode || '無';
        
        const inputPrompt = item.is_video ? params.video_main_prompt : params.main_prompt;
        if (inputPrompt) {
            modalParams.input_prompt.textContent = inputPrompt;
            modalParams.input_prompt_container.style.display = 'block';
        }

        if (params.fixed_prompt) {
            modalParams.fixed_prompt.textContent = params.fixed_prompt;
            modalParams.fixed_prompt_container.style.display = 'block';
        }

        modalParams.final_positive_prompt.textContent = params.positive_prompt || '';
        modalParams.negative_prompt.textContent = params.negative_prompt || '';
        
        const otherParams = ['seed', 'steps', 'cfg', 'sampler_name', 'scheduler'];
        otherParams.forEach(key => {
            if (modalParams[key] && params[key] !== undefined) {
                modalParams[key].textContent = params[key];
            }
        });

        if (modalPrevBtn) modalPrevBtn.style.display = index > 0 ? 'block' : 'none';
        if (modalNextBtn) modalNextBtn.style.display = index < currentHistoryList.length - 1 ? 'block' : 'none';
        
        if (imageModal) imageModal.style.display = 'block';
    }

    function toggleSelectionMode(enable) {
        isSelectionMode = enable;
        if (comfyHistoryGrid) comfyHistoryGrid.classList.toggle('selection-mode', enable);
        if (historyManagementBtns) historyManagementBtns.style.display = enable ? 'none' : 'flex';
        if (historySelectionBtns) historySelectionBtns.style.display = enable ? 'flex' : 'none';
        if (!enable) {
            comfyHistoryGrid.querySelectorAll('.history-item.is-selected').forEach(el => el.classList.remove('is-selected'));
            selectedItems.clear();
            updateSelectionCount();
        }
    }

    function toggleItemSelection(element, itemId) {
        if (selectedItems.has(itemId)) {
            selectedItems.delete(itemId);
            element.classList.remove('is-selected');
        } else {
            selectedItems.add(itemId);
            element.classList.add('is-selected');
        }
        updateSelectionCount();
    }

    function updateSelectionCount() {
        const count = selectedItems.size;
        if (historySelectionCount) historySelectionCount.textContent = count;
        if (historySelectionCountDelete) historySelectionCountDelete.textContent = count;
        if (historyBatchDownloadBtn) historyBatchDownloadBtn.disabled = count === 0;
        if (historyBatchDeleteBtn) historyBatchDeleteBtn.disabled = count === 0;
    }

    async function initialize() {
        console.log('應用程式已初始化 v16.0');
        
        if ('serviceWorker' in navigator) {
            try {
                serviceWorkerRegistration = await navigator.serviceWorker.register('/static/js/sw.js');
            } catch (error) {
                console.error('Service Worker 註冊失敗:', error);
            }
        }
        await updateNotificationUI();
        
        if (enableNotificationsBtn) {
            enableNotificationsBtn.addEventListener('click', async () => {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') await subscribeToPush();
                await updateNotificationUI();
            });
        }
        
        await loadSharedConfigAndInitialize();
        
        setInterval(pollQueueStatus, 3000); 
        
        if (modelSelectionModal) bsModelSelectionModal = new bootstrap.Modal(modelSelectionModal);
        if (loraSelectionModal) bsLoraSelectionModal = new bootstrap.Modal(loraSelectionModal);
        const gmLoginModalEl = getById('gm-login-modal');
        if (gmLoginModalEl) bsGmLoginModal = new bootstrap.Modal(gmLoginModalEl);

        if (gmLoginIcon) {
            gmLoginIcon.addEventListener('click', () => {
                if (userContext.user_type === 'gm') {
                    if (confirm('您確定要登出 GM 身份嗎？')) {
                        localStorage.removeItem('user_type');
                        localStorage.removeItem('gm_last_device');
                        window.location.reload();
                    }
                } else {
                    if (bsGmLoginModal) bsGmLoginModal.show();
                }
            });
        }

        if (gmLoginForm) {
            gmLoginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (gmPasswordInput.value === GM_PASSWORD) {
                    localStorage.setItem('user_type', 'gm');
                    if (bsGmLoginModal) bsGmLoginModal.hide();
                    window.location.reload();
                } else {
                    if (gmLoginError) gmLoginError.style.display = 'block';
                }
            });
        }
        
        if(comfyGenerateBtn) comfyGenerateBtn.addEventListener('click', handleGenerateClick);
        if(comfyRandomSeedBtn) {
            comfyRandomSeedBtn.addEventListener('click', () => {
                if(comfyFormElements.seed) comfyFormElements.seed.value = Math.floor(Math.random() * 1000000000000000);
            });
        }
        if(comfyFormElements.seed_behavior) {
            comfyFormElements.seed_behavior.addEventListener('change', (e) => {
                const isRandom = e.target.value === 'random';
                if (comfyFormElements.seed) comfyFormElements.seed.disabled = isRandom;
                if (comfyRandomSeedBtn) comfyRandomSeedBtn.disabled = isRandom;
            });
            comfyFormElements.seed_behavior.dispatchEvent(new Event('change'));
        }

        if (comfyFormElements.enable_adetailer && adetailerOptionsDiv) {
            comfyFormElements.enable_adetailer.addEventListener('change', (e) => {
                adetailerOptionsDiv.style.display = e.target.checked ? 'block' : 'none';
            });
            comfyFormElements.enable_adetailer.dispatchEvent(new Event('change'));
        }

        if (comfyFormElements.optimize_positive && comfyFormElements.ai_optimize) {
            comfyFormElements.optimize_positive.addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                comfyFormElements.ai_optimize.disabled = !isEnabled;
                if (!isEnabled) {
                    comfyFormElements.ai_optimize.checked = false;
                }
            });
            comfyFormElements.optimize_positive.dispatchEvent(new Event('change'));
        }

        if (videoOptimizePositiveCheckbox && videoAiOptimizeCheckbox) {
            videoOptimizePositiveCheckbox.addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                videoAiOptimizeCheckbox.disabled = !isEnabled;
                if (!isEnabled) {
                    videoAiOptimizeCheckbox.checked = false;
                }
            });
            videoOptimizePositiveCheckbox.dispatchEvent(new Event('change'));
        }


        if (enableControlnetSwitch) {
            enableControlnetSwitch.addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                if (controlnetOptionsContainer) controlnetOptionsContainer.style.display = isEnabled ? 'block' : 'none';
                if (controlnetTab) controlnetTab.classList.toggle('active-mode', isEnabled);
                if (!isEnabled) resetFileUploadUI(controlnetState, 'controlnet_image', controlnetUploadArea, controlnetPreviewContainer, controlnetPreview, controlnetFilename, null, '點擊上傳參考圖', '');
                updateDenoiseDefault();
            });
        }
        if (controlnetStrengthSlider && controlnetStrengthValueLabel) {
            controlnetStrengthSlider.addEventListener('input', (e) => {
                controlnetStrengthValueLabel.textContent = parseFloat(e.target.value).toFixed(2);
            });
        }
        
        if (videoGenerationModeSelect) {
            videoGenerationModeSelect.addEventListener('change', (e) => {
                const showUpload = e.target.value === 'image-to-video';
                if (videoUploadContainer) videoUploadContainer.style.display = showUpload ? 'block' : 'none';
                if (!showUpload) resetFileUploadUI(videoState, 'source_image', videoUploadArea, videoPreviewContainer, videoPreview, videoFilename, null, '點擊上傳初始圖片', '');
            });
        }
        if (videoAugmentationLevelSlider && videoAugmentationLevelLabel) {
            videoAugmentationLevelSlider.addEventListener('input', (e) => {
                videoAugmentationLevelLabel.textContent = parseFloat(e.target.value).toFixed(2);
            });
        }


        if (modalCloseBtn) modalCloseBtn.addEventListener('click', () => { if (imageModal) imageModal.style.display = "none"; modalVideo.pause(); });
        if (imageModal) imageModal.addEventListener('click', (e) => { if (e.target === imageModal) { imageModal.style.display = "none"; modalVideo.pause();} });
        if (modalPrevBtn) modalPrevBtn.addEventListener('click', (e) => { e.stopPropagation(); showImageInModal(currentModalIndex - 1); });
        if (modalNextBtn) modalNextBtn.addEventListener('click', (e) => { e.stopPropagation(); showImageInModal(currentModalIndex + 1); });
        document.addEventListener('keydown', (e) => {
            if (imageModal && imageModal.style.display === 'block') {
                if (e.key === 'ArrowLeft') showImageInModal(currentModalIndex - 1);
                else if (e.key === 'ArrowRight') showImageInModal(currentModalIndex + 1);
                else if (e.key === 'Escape') modalCloseBtn.click();
            }
        });
        
        if (imageModal) {
            const modalContent = imageModal.querySelector('.image-modal-content-wrapper');
            if (modalContent) {
                 modalContent.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
                 modalContent.addEventListener('touchend', (e) => { touchEndX = e.changedTouches[0].screenX; handleSwipe(); }, { passive: true });
            }
        }
        function handleSwipe() {
            const swipeThreshold = 50;
            if (touchEndX < touchStartX - swipeThreshold) showImageInModal(currentModalIndex + 1);
            if (touchEndX > touchStartX + swipeThreshold) showImageInModal(currentModalIndex - 1);
        }

        if (imageModal) {
            imageModal.addEventListener('click', (e) => {
                if (e.target && e.target.classList.contains('copy-btn')) {
                    e.stopPropagation();
                    const btn = e.target;
                    const targetSelector = btn.dataset.clipboardTarget;
                    const targetElement = document.querySelector(targetSelector);
                    if (targetElement && targetElement.textContent) {
                        navigator.clipboard.writeText(targetElement.textContent).then(() => {
                            const originalIcon = btn.className;
                            btn.className = 'bi bi-check-lg text-success';
                            setTimeout(() => { btn.className = originalIcon; }, 1500);
                        }).catch(err => console.error('複製失敗:', err));
                    }
                }
            });
        }

        if (loraSelectionModal) {
            loraSelectionModal.addEventListener('show.bs.modal', () => {
                tempSelectedLoras.clear();
                comfyFormElements.loras.forEach(lora => tempSelectedLoras.add(lora.name));
                loraSelectionGrid.querySelectorAll('.model-card').forEach(card => {
                    const checkbox = card.querySelector('.lora-card-checkbox');
                    if (checkbox) checkbox.checked = tempSelectedLoras.has(card.dataset.itemName);
                });
            });
        }
        if (loraConfirmSelectionBtn) {
            loraConfirmSelectionBtn.addEventListener('click', () => {
                const newLoras = [];
                tempSelectedLoras.forEach(loraName => {
                    if (loraName === 'None') return;
                    const existingLora = comfyFormElements.loras.find(l => l.name === loraName);
                    newLoras.push(existingLora || { name: loraName, weight: 1.0 });
                });
                comfyFormElements.loras = newLoras;
                renderSelectedLoras();
                if (bsLoraSelectionModal) bsLoraSelectionModal.hide();
            });
        }

        if (historySelectBtn) historySelectBtn.addEventListener('click', () => toggleSelectionMode(true));
        if (historyCancelSelectBtn) historyCancelSelectBtn.addEventListener('click', () => toggleSelectionMode(false));
        if (historySelectAllBtn) historySelectAllBtn.addEventListener('click', () => {
            comfyHistoryGrid.querySelectorAll('.history-item').forEach(div => {
                const itemId = JSON.parse(div.dataset.historyItem).id;
                if (!selectedItems.has(itemId)) {
                    selectedItems.add(itemId);
                    div.classList.add('is-selected');
                }
            });
            updateSelectionCount();
        });
        if (historyDeleteAllBtn) historyDeleteAllBtn.addEventListener('click', async () => {
            if (confirm('確定要刪除所有歷史紀錄嗎？此操作不可復原！')) {
                await fetchWithUserContext('/api/comfyui/history/delete-all', { method: 'POST' });
                currentHistoryList = [];
                hasMoreHistory = false;
                renderHistory([], 'initial');
                toggleSelectionMode(false);
            }
        });
        if (historyBatchDeleteBtn) historyBatchDeleteBtn.addEventListener('click', async () => {
            if (selectedItems.size === 0) return;
            if (confirm(`確定要刪除選中的 ${selectedItems.size} 個項目嗎？`)) {
                const idsToDelete = Array.from(selectedItems);
                await fetchWithUserContext('/api/comfyui/history/batch-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: idsToDelete }) });
                const deletedIds = new Set(idsToDelete);
                comfyHistoryGrid.querySelectorAll('.history-item.is-selected').forEach(el => {
                    const header = el.previousElementSibling;
                    el.remove();
                    if (header && header.classList.contains('history-date-header') && (!header.nextElementSibling || !header.nextElementSibling.classList.contains('history-item'))) {
                        header.remove();
                    }
                });
                currentHistoryList = currentHistoryList.filter(item => !deletedIds.has(item.id));
                toggleSelectionMode(false);
            }
        });
        if (historyBatchDownloadBtn) historyBatchDownloadBtn.addEventListener('click', async () => {
            if (selectedItems.size === 0) return;
            const zip = new JSZip();
            historyBatchDownloadBtn.disabled = true;
            const promises = Array.from(selectedItems).map(itemId => {
                const itemDiv = comfyHistoryGrid.querySelector(`.history-item[data-item-id="${itemId}"]`);
                if (!itemDiv) return Promise.resolve();
                const item = JSON.parse(itemDiv.dataset.historyItem);
                const fullItemUrl = new URL(item.url, activeDeviceUrl).href;
                return fetch(fullItemUrl)
                    .then(response => {
                        if (!response.ok) throw new Error(`無法下載 ${item.filename}`);
                        return response.blob();
                    })
                    .then(blob => zip.file(item.filename.split(/[\\/]/).pop(), blob))
                    .catch(err => console.error(err));
            });
            await Promise.all(promises);
            zip.generateAsync({ type: "blob" }).then(content => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.download = `comfyui_history_${new Date().getTime()}.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                historyBatchDownloadBtn.disabled = false;
            });
        });

        if (negativePromptSetDefaultBtn && comfyFormElements.negative_prompt) {
            negativePromptSetDefaultBtn.addEventListener('click', () => {
                comfyFormElements.negative_prompt.value = DEFAULT_NEGATIVE_PROMPT;
            });
        }
        if (fixedPromptSetDefaultBtn && comfyFormElements.fixed_prompt) {
            fixedPromptSetDefaultBtn.addEventListener('click', () => {
                comfyFormElements.fixed_prompt.value = DEFAULT_FIXED_PROMPT;
            });
        }

        if (downloadModelForm) {
            downloadModelForm.addEventListener('submit', handleDownloadSubmit);
        }

        modelFilterCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', filterModels);
        });
    }
    
    initialize();
});

async function handleDownloadSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('#download-model-submit-btn');
    const spinner = form.querySelector('#download-model-spinner');
    const statusDiv = form.querySelector('#download-status');

    if (!submitBtn || !spinner || !statusDiv) return;

    submitBtn.disabled = true;
    spinner.style.display = 'inline-block';
    statusDiv.innerHTML = '<div class="alert alert-info">正在提交下載任務...</div>';

    const modelType = form.querySelector('#download-model-type').value;
    const modelUrl = form.querySelector('#download-model-url').value;
    const modelName = form.querySelector('#download-model-name').value;
    const previewFile = form.querySelector('#download-model-preview').files[0];

    let previewImageBase64 = null;

    if (previewFile) {
        try {
            previewImageBase64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(previewFile);
            });
        } catch (error) {
            statusDiv.innerHTML = `<div class="alert alert-danger">讀取預覽圖失敗: ${error.message}</div>`;
            submitBtn.disabled = false;
            spinner.style.display = 'none';
            return;
        }
    }

    const payload = {
        model_type: modelType,
        model_url: modelUrl,
        model_name: modelName,
        preview_image_base64: previewImageBase64
    };

    try {
        const response = await fetchWithUserContext('/api/comfyui/download_model', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok) {
            statusDiv.innerHTML = `<div class="alert alert-success">${result.message}</div>`;
            form.reset();
        } else {
            throw new Error(result.detail || '提交失敗');
        }
    } catch (error) {
        statusDiv.innerHTML = `<div class="alert alert-danger">錯誤: ${error.message}</div>`;
    } finally {
        submitBtn.disabled = false;
        spinner.style.display = 'none';
    }
}

function filterModels() {
    const modelSelectionGrid = document.getElementById('model-selection-grid');
    if (!modelSelectionGrid) return;

    const selectedFilters = Array.from(document.querySelectorAll('.model-filter-checkbox:checked')).map(cb => cb.value);
    const modelCards = modelSelectionGrid.querySelectorAll('.model-card');

    modelCards.forEach(card => {
        const modelName = card.dataset.itemName.toLowerCase();
        let show = false;
        if (selectedFilters.length === 0) {
            show = true;
        } else {
            show = selectedFilters.some(filter => {
                if (filter === 'sdxl' && modelName.includes('xl') && !modelName.includes('sd3')) return true;
                if (filter === 'sd3' && modelName.includes('sd3')) return true;
                if (filter === 'sd15' && !modelName.includes('xl') && !modelName.includes('sd3')) return true;
                if (filter === 'flux' && modelName.includes('flux')) return true;
                return false;
            });
        }
        card.style.display = show ? 'block' : 'none';
    });
}