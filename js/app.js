// static/js/app.js

/**
 * v18.1 (服務整合與持久化): [重大架構重構] 1. 實現了按需啟動 AI 聊天服務的完整前端邏輯，包括呼叫新的 system_api 來啟動、檢查和停止服務。 2. 引入了 localStorage 來持久化 client_id，確保 Web 使用者在關閉瀏覽器後仍能保留身份和聊天記錄。 3. 將所有 gemini 相關的變數和元素 ID 重命名為更通用的 chat，以適應新的 AI Lover 服務。 4. 整合了 AI Lover 的指令系統，為新的指令按鈕（初始設定、世界觀等）添加了事件監聽和 Modal 彈窗邏輯。
 * v17.21 (在線狀態即時檢測): [根本性修正] 徹底重構了裝置在線狀態的檢測機制。不再依賴 `config.json` 中會過時的時間戳，而是在每次頁面載入時，透過新的 `checkDeviceStatus` 函式主動、並行地向每個裝置的 URL 發送即時的 API 請求（Ping）。這確保了無論何時刷新頁面，裝置的在線/離線狀態都能被準確地即時反映，從根本上解決了裝置運行超過5分鐘後被誤判為離線的問題。
 * v17.20 (FLUX 按需下載): 1. [功能新增] 實作了 FLUX 依賴模型的按需下載功能。在 `initialize` 時會先呼叫新的 `fetchDependencyStatus` 函式從後端獲取依賴模型的存在狀態。 2. [邏輯重構] 重構了 `createModelCard` 中的點擊事件，當偵測到使用者選擇 FLUX 模型時，會觸發 `handleFluxModelSelection` 檢查。 3. [UX 整合] 如果依賴模型缺失，會彈出包含檔案大小的確認框。同意後，`startDependencyDownload` 函式將呼叫後端 API 開始下載，並利用新增的 `dependency-download-modal` 和 WebSocket 連線來顯示即時進度，下載成功後再自動選定模型，實現了完整的按需下載閉環。
 */

document.addEventListener('DOMContentLoaded', async () => {

    // --- 元素選擇器 (通用) ---
    const getById = (id) => document.getElementById(id);
    const navChat = getById('nav-chat');
    const navComfyUI = getById('nav-comfyui');
    const chatPage = getById('chat-page');
    const comfyUIPage = getById('comfyui-page');
    const pages = [chatPage, comfyUIPage];
    const navLinks = [navChat, navComfyUI];

    // --- 元素選擇器 (AI 聊天) ---
    const chatStartBtn = getById('chat-start-btn');
    const chatStartSpinner = getById('chat-start-spinner');
    const chatStartupStatus = getById('chat-startup-status');
    const chatStartupContainer = getById('chat-startup-container');
    const chatInterfaceContainer = getById('chat-interface-container');
    const chatWindow = getById('chat-window');
    const chatInputForm = getById('chat-input-form');
    const chatInput = getById('chat-input');
    const chatSendBtn = getById('chat-send-btn');
    const chatBtnSetup = getById('chat-btn-setup');
    const chatBtnWorldview = getById('chat-btn-worldview');
    const chatBtnAisettings = getById('chat-btn-aisettings');
    const chatBtnSystem = getById('chat-btn-system');
    const chatBtnClear = getById('chat-btn-clear');
    const chatModalEl = getById('chat-modal');
    let bsChatModal = null;
    const chatModalTitle = getById('chat-modal-title');
    const chatModalTextarea = getById('chat-modal-textarea');
    const chatModalSaveBtn = getById('chat-modal-save-btn');


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
        adetailer_steps: getById('comfy-adetailer-steps'),
        denoise: getById('comfy-denoise'),
        vae: getById('comfy-vae-select'),
    };
// --- 元素選擇器 (ComfyUI - 參數設定) ---
    const comfySelectedModelName = getById('comfy-selected-model-name');
    const selectedLoraListContainer = getById('selected-lora-list-container');
    const comfyRandomSeedBtn = getById('comfy-random-seed-btn');
    const comfyGenerateBtn = getById('comfy-generate-btn');
    const comfySpinner = getById('comfy-generate-spinner');
    const comfyStatusText = getById('comfy-status-text');
    const comfyResultImage = getById('comfy-result-image');
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

    // --- 元素選擇器 (ComfyUI - 繪圖遮罩) ---
    const drawMaskBtn = getById('draw-mask-btn');
    const inpaintCanvasModalEl = getById('inpaint-canvas-modal');
    let bsInpaintCanvasModal = null;
    const inpaintCanvas = getById('inpaint-canvas');
    const inpaintBrushSizeSlider = getById('inpaint-brush-size');
    const inpaintBrushSizeLabel = getById('inpaint-brush-size-label');
    const inpaintClearCanvasBtn = getById('inpaint-clear-canvas-btn');
    const inpaintSaveMaskBtn = getById('inpaint-save-mask-btn');
    let inpaintCtx = null;

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
    


    // --- 進度條元素 ---
    const comfyProgressContainer = getById('comfy-progress-container');
    const comfyProgressBar = getById('comfy-progress-bar');
    const comfyProgressText = getById('comfy-progress-text');
    
    let comfyStatusWs = null;

    // --- 元素選擇器 (圖片/影片 Modal) ---
    const imageModal = getById('image-modal');
    const modalImage = getById('modal-image');
    const modalCloseBtn = getById('modal-close-btn');
    const modalPrevBtn = getById('modal-prev-btn');
    const modalNextBtn = getById('modal-next-btn');
    const modalDownloadBtn = getById('modal-download-btn');
    const modalParams = {
        model: getById('modal-model'),
        vae: getById('modal-vae'),
        lora_list: getById('modal-lora-list'),
        img2img_info: getById('modal-img2img-info'),
        source_image: getById('modal-source-image'),
        denoise: getById('modal-denoise'),
        controlnet_info: getById('modal-controlnet-info'),
        controlnet_model: getById('modal-controlnet-model'),
        controlnet_preprocessor: getById('modal-controlnet-preprocessor'),
        controlnet_strength: getById('modal-controlnet-strength'),
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
    const negativePromptSetGuroBtn = getById('negative-prompt-set-guro-btn');
    const fixedPromptSetDefaultBtn = getById('fixed-prompt-set-default-btn');
    const fixedPromptSetDetailedBtn = getById('fixed-prompt-set-detailed-btn'); // [v1.1 新增]

    // --- 元素選擇器 (模型下載) ---
    const downloadModelForm = getById('download-model-form');
    const modelFilterCheckboxes = document.querySelectorAll('.model-filter-checkbox');
    const dependencyDownloadModalEl = getById('dependency-download-modal');
    let bsDependencyDownloadModal = null;

    // --- 元素選擇器 (GM 登入) ---
    const gmLoginIcon = getById('gm-login-icon');
    const gmLoginForm = getById('gm-login-form');
    const gmPasswordInput = getById('gm-password-input');
    const gmLoginError = getById('gm-login-error');
    const userStatusDisplay = getById('user-status-display');
    const deviceSelectorDropdown = getById('device-selector-dropdown');
    const deviceSelectionList = getById('device-selection-list');
    let bsGmLoginModal = null;

    // --- 元素選擇器 (歷史紀錄) ---
    const historyLoadingIndicator = document.createElement('div');
    historyLoadingIndicator.id = 'history-loading-indicator';
    historyLoadingIndicator.className = 'text-center text-muted p-3 col-12';
    historyLoadingIndicator.style.display = 'none';

    // --- 狀態變數 ---
    let userContext = { user_type: 'local' };
    let activeDeviceUrl = window.location.origin;
    let localDeviceId = 'local_pc';
    let sharedConfig = { devices: {} };
    let img2imgState = { source_image: null, inpaint_mask: null, source_image_data: null };
    let controlnetState = { controlnet_image: null };
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
    let dependencyModelsStatus = {};
    let chatWs = null;
    let clientId = '';
    let deviceHistoryCache = {};
    let currentHistoryObserver = null;





    // 繪圖遮罩狀態變數
    let isDrawing = false;
    let brushSize = 20;
    let lastX = 0;
    let lastY = 0;

    // 總進度條相關狀態變數
    let totalExpectedSteps = 0;
    let accumulatedSteps = 0;
    let currentNodeTotalSteps = 0;
    let isNewNodeProgress = true;
    
    let downloadWs = null;

// --- 預設提示詞常數 ---
    const DEFAULT_NEGATIVE_PROMPT_GENERAL = "(worst quality, bad quality:1.2), lowres, jpeg artifacts, glitch, cropped,\nbad anatomy, deformed, mutated, ugly, disfigured, long body, bad hands, missing fingers, extra digit, fewer digits, conjoined, very displeasing,\nmodern, recent, old, oldest, cartoon, graphic, text, painting, crayon, graphite, abstract, sketch,\nsignature, watermark, username, simple background";
    const DEFAULT_NEGATIVE_PROMPT_GURO = "(worst quality, bad quality:1.2), lowres, jpeg artifacts, glitch, cropped,\nmodern, recent, old, oldest, cartoon, graphic, text, painting, crayon, graphite, abstract, sketch,\nsignature, watermark, username, simple background";
    const DEFAULT_FIXED_PROMPT = "非常美麗的眼睛，完美傑作，8K，UHD，大光圈，最高畫質";
    const DETAILED_FIXED_PROMPT = "非常美麗的眼睛，（傑作：1.2），（最高品質：1.2），（超精細細節：1.1），（8k：1.1），高解析度，超高解析度，令人難以置信的精細，複雜細節，銳利對焦，精細描繪，電影級光影，景深，散景";
// --- 預設提示詞常數 ---

// 中文註釋：fetchWithUserContext函式開始
// 函式功能：使用使用者上下文標頭發起 fetch 請求，並允許覆寫基礎 URL
// v18.2 (CORS 修正): [功能擴展] 新增了第三個可選參數 `baseUrl`。如果提供了此參數，函式將使用它來建構請求的 URL，而不是依賴全域的 `activeDeviceUrl`。此修改是為了解決 `checkDeviceStatus` 函式需要向多個不同的遠端 URL 發送請求的問題，使其能夠重用此核心請求函式。
// v18.1 (服務整合與持久化): [重大架構重構] 1. 實現了按需啟動 AI 聊天服務的完整前端邏輯，包括呼叫新的 system_api 來啟動、檢查和停止服務。 2. 引入了 localStorage 來持久化 client_id，確保 Web 使用者在關閉瀏覽器後仍能保留身份和聊天記錄。 3. 將所有 gemini 相關的變數和元素 ID 重命名為更通用的 chat，以適應新的 AI Lover 服務。 4. 整合了 AI Lover 的指令系統，為新的指令按鈕（初始設定、世界觀等）添加了事件監聽和 Modal 彈窗邏輯。
    async function fetchWithUserContext(path, options = {}, baseUrl = null) {
        const urlSource = baseUrl || activeDeviceUrl;
        if (!urlSource) {
            throw new Error("沒有可用的裝置 URL。請確保已選擇一個在線裝置。");
        }
        const fullUrl = new URL(path, urlSource).href;
        const headers = new Headers(options.headers || {});
        headers.append('X-User-Type', userContext.user_type);
        options.headers = headers;
        return fetch(fullUrl, options);
    }
// 函式功能：使用使用者上下文標頭發起 fetch 請求，並允許覆寫基礎 URL
// 中文註釋：fetchWithUserContext函式結束
    
// 中文註釋：checkDeviceStatus函式開始
// 函式功能：即時檢測指定裝置的在線狀態
// v18.2 (CORS 修正): [根本性修正] 將此函式內部原生的 `fetch` 呼叫，替換為對 `fetchWithUserContext` 的呼叫。通過傳入 `device.url` 作為 `baseUrl`，確保了狀態檢測請求（心跳請求）與應用程式內所有其他 API 請求使用完全相同的標頭和 CORS 策略。這從根本上解決了因請求不一致而在跨來源場景下（GitHub Pages -> Cloudflare）導致的 CORS 錯誤，從而能夠準確判斷裝置是否在線。
// v17.21 (在線狀態即時檢測): [根本性修正] 徹底重構了裝置在線狀態的檢測機制。不再依賴 `config.json` 中會過時的時間戳，而是在每次頁面載入時，透過新的 `checkDeviceStatus` 函式主動、並行地向每個裝置的 URL 發送即時的 API 請求（Ping）。這確保了無論何時刷新頁面，裝置的在線/離線狀態都能被準確地即時反映，從根本上解決了裝置運行超過5分鐘後被誤判為離線的問題。
// v17.20 (FLUX 按需下載): 1. [功能新增] 實作了 FLUX 依賴模型的按需下載功能。在 `initialize` 時會先呼叫新的 `fetchDependencyStatus` 函式從後端獲取依賴模型的存在狀態。 2. [邏輯重構] 重構了 `createModelCard` 中的點擊事件，當偵測到使用者選擇 FLUX 模型時，會觸發 `handleFluxModelSelection` 檢查。 3. [UX 整合] 如果依賴模型缺失，會彈出包含檔案大小的確認框。同意後，`startDependencyDownload` 函式將呼叫後端 API 開始下載，並利用新增的 `dependency-download-modal` 和 WebSocket 連線來顯示即時進度，下載成功後再自動選定模型，實現了完整的按需下載閉環。
    async function checkDeviceStatus(device) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 秒超時

        try {
            // [v18.2 修正] 改為使用 fetchWithUserContext 以確保請求一致性
            const response = await fetchWithUserContext(
                '/api/comfyui/device_id', 
                {
                    signal: controller.signal,
                    cache: 'no-store'
                },
                device.url // 將裝置的特定 URL 作為 baseUrl 傳入
            );
            clearTimeout(timeoutId);
            return response.ok ? 'online' : 'offline';
        } catch (error) {
            clearTimeout(timeoutId);
            // 瀏覽器開發者工具 (F12) 的 Console 中可能會顯示詳細的 CORS 錯誤
            console.error(`檢查裝置 ${device.url} 狀態失敗:`, error);
            return 'offline';
        }
    }
// 函式功能：即時檢測指定裝置的在線狀態
// 中文註釋：checkDeviceStatus函式結束



// 中文註釋：switchDevice函式開始
// 函式功能：處理切換到指定裝置的邏輯
    async function switchDevice(deviceId) {
        if (!sharedConfig.devices[deviceId] || sharedConfig.devices[deviceId].status !== 'online') {
            alert(`裝置 ${deviceId} 目前不在線或無法連接。`);
            return;
        }
        
        console.log(`正在切換到裝置: ${deviceId}`);
        
        activeDeviceUrl = sharedConfig.devices[deviceId].url;
        localStorage.setItem('gm_last_device', deviceId);
        
        updateDeviceSelectorUI(deviceId);
        
        document.body.style.cursor = 'wait';
        
        await reloadDataForActiveDevice();
        
        document.body.style.cursor = 'default';
        console.log(`已成功切換到 ${deviceId}。`);
    }
// 函式功能：處理切換到指定裝置的邏輯
// 中文註釋：switchDevice函式結束
    
// 中文註釋：reloadDataForActiveDevice函式開始
// 函式功能：為當前啟用的裝置重新載入所有相關資料
    async function reloadDataForActiveDevice() {
        console.log(`正在為當前裝置 ${activeDeviceUrl} 重新載入所有資料...`);
        
        await Promise.all([
            fetchAndPopulateCheckpoints(),
            fetchAndPopulateControlNetResources(),
            fetchAndPopulateSamplers(),
            fetchAndPopulateVAEs(),
            fetchDependencyStatus(),
            checkChatServiceStatus() // 檢查聊天服務狀態
        ]);
    
        await loadSettings();
    
        await initializeHistory();
    
        console.log("資料重新載入完成。");
    }
// 函式功能：為當前啟用的裝置重新載入所有相關資料
// 中文註釋：reloadDataForActiveDevice函式結束





// 中文註釋：loadSharedConfigAndInitialize函式開始
// 函式功能：載入共享設定檔並初始化應用程式
    async function loadSharedConfigAndInitialize() {
        try {
            // [v18.3 修正] 添加時間戳以繞過瀏覽器和 CDN 的快取，確保每次都獲取最新的 config.json
            const response = await fetch(`${GITHUB_CONFIG_URL}?t=${new Date().getTime()}`);
            if (!response.ok) throw new Error('無法從 GitHub 獲取共享設定檔。');
            sharedConfig = await response.json();

            console.log("正在並行檢測所有裝置的即時狀態...");
            const statusChecks = Object.entries(sharedConfig.devices).map(async ([id, device]) => {
                const status = await checkDeviceStatus(device);
                sharedConfig.devices[id].status = status;
            });
            await Promise.all(statusChecks);
            console.log("裝置即時狀態檢測完成。");

        } catch (error) {
            console.error(error);
            if(userStatusDisplay) userStatusDisplay.textContent = '錯誤: 無法載入遠端設定';
        }

        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        if (isLocal) {
            console.log("偵測到本地訪問，強制設為一般使用者模式。");
            userContext.user_type = 'local';
            activeDeviceUrl = window.location.origin; // [v2.2 核心修正] 確保本地模式下 URL 被正確初始化
            localStorage.removeItem('user_type');
            localStorage.removeItem('gm_last_device');
            try {
                const deviceResponse = await fetchWithUserContext('/api/comfyui/device_id');
                const data = await deviceResponse.json();
                localDeviceId = data.device_id || 'local_pc';
            } catch (e) {
                console.error("無法獲取本地 device_id", e);
            }
            updateDeviceSelectorUI(localDeviceId);
            await reloadDataForActiveDevice();

        } else { // 遠端訪問 (GitHub Pages)
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
                    await switchDevice(targetDevice); // switchDevice 內部會設定好 activeDeviceUrl
                } else {
                    updateDeviceSelectorUI(null);
                    alert('目前沒有任何遠端裝置在線。');
                }
            } else { // 非 GM 的遠端訪問者
                 if(userStatusDisplay) userStatusDisplay.textContent = '請登入 GM 以使用遠端功能';
                 if(deviceSelectorDropdown) deviceSelectorDropdown.style.display = 'none';
                 if(comfyGenerateBtn) comfyGenerateBtn.disabled = true;
            }
        }
    }
// 函式功能：載入共享設定檔並初始化應用程式
// 中文註釋：loadSharedConfigAndInitialize函式結束

// 中文註釋：updateDeviceSelectorUI函式開始
// 函式功能：更新裝置選擇器和使用者狀態的 UI 顯示
    function updateDeviceSelectorUI(currentDeviceId) {
        if (!userStatusDisplay || !gmLoginIcon) return;
    
        if (userContext.user_type === 'gm') {
            gmLoginIcon.innerHTML = '<i class="bi bi-unlock-fill text-warning"></i>';
            gmLoginIcon.title = '已登入為 GM - 點擊登出';
            
            if (deviceSelectorDropdown) deviceSelectorDropdown.style.display = 'block';
            if (userStatusDisplay) userStatusDisplay.textContent = `GM @ ${currentDeviceId || '未選擇'}`;
            
            if (deviceSelectionList) {
                const deviceIds = Object.keys(sharedConfig.devices);
                deviceSelectionList.innerHTML = '';
                if (deviceIds.length > 0) {
                    deviceIds.forEach(id => {
                        const device = sharedConfig.devices[id];
                        const isOnline = device.status === 'online';

                        const li = document.createElement('li');
                        const a = document.createElement('a');
                        a.className = `dropdown-item device-select-btn ${currentDeviceId === id ? 'active' : ''}`;
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
                        await switchDevice(newDeviceId);
                    });
                });
            }
        } else {
            userStatusDisplay.textContent = `本地裝置: ${localDeviceId}`;
            gmLoginIcon.innerHTML = '<i class="bi bi-lock"></i>';
            gmLoginIcon.title = 'GM 登入';
            if (deviceSelectorDropdown) deviceSelectorDropdown.style.display = 'none';
        }
    }
// 函式功能：更新裝置選擇器和使用者狀態的 UI 顯示
// 中文註釋：updateDeviceSelectorUI函式結束

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
    if (navChat) navChat.addEventListener('click', (e) => { e.preventDefault(); switchPage('chat-page'); });
    if (navComfyUI) navComfyUI.addEventListener('click', (e) => { e.preventDefault(); switchPage('comfyui-page'); });

    // --- AI 聊天相關邏輯 ---
    function getClientId() {
        let id = localStorage.getItem('personal_assistant_user_id');
        if (!id) {
            id = `web-user-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
            localStorage.setItem('personal_assistant_user_id', id);
        }
        return id;
    }

    function addChatMessage(sender, text) {
        if (!chatWindow) return;
        const messageWrapper = document.createElement('div');
        messageWrapper.className = `chat-message-wrapper ${sender.toLowerCase()}-message`;
        
        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';
        
        let content;
        try {
            const data = JSON.parse(text);
            content = JSON.stringify(data, null, 2);
            messageBubble.style.whiteSpace = 'pre';
        } catch (e) {
            content = text;
        }
        
        messageBubble.textContent = content;
        
        messageWrapper.appendChild(messageBubble);
        chatWindow.appendChild(messageWrapper);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    function updateChatUI(isRunning) {
        if (isRunning) {
            chatStartupContainer.style.display = 'none';
            chatInterfaceContainer.style.display = 'block';
            chatInput.disabled = false;
            chatSendBtn.disabled = false;
            chatInput.placeholder = "請在這裡輸入訊息...";
        } else {
            chatStartupContainer.style.display = 'block';
            chatInterfaceContainer.style.display = 'none';
            chatInput.disabled = true;
            chatSendBtn.disabled = true;
            chatInput.placeholder = "請先啟動聊天服務";
            chatStartBtn.disabled = false;
            chatStartSpinner.style.display = 'none';
            chatStartupStatus.textContent = '';
        }
    }

    async function checkChatServiceStatus() {
        try {
            const response = await fetchWithUserContext('/api/system/chat_service_status');
            const data = await response.json();
            if (data.is_running) {
                updateChatUI(true);
                connectChatWebSocket();
            } else {
                updateChatUI(false);
            }
        } catch (error) {
            console.error('檢查聊天服務狀態失敗:', error);
            updateChatUI(false);
            chatStartupStatus.textContent = '錯誤: 無法連接到主伺服器。';
        }
    }
    
    async function startChatService() {
        chatStartBtn.disabled = true;
        chatStartSpinner.style.display = 'inline-block';
        chatStartupStatus.textContent = '正在啟動 AI 聊天服務，請稍候...';

        try {
            const response = await fetchWithUserContext('/api/system/start_chat_service', { method: 'POST' });
            const data = await response.json();
            
            if (response.ok && data.is_running) {
                chatStartupStatus.textContent = '服務已啟動，正在建立連線...';
                await new Promise(resolve => setTimeout(resolve, 1000)); // 等待一下確保服務完全就緒
                updateChatUI(true);
                connectChatWebSocket();
            } else {
                throw new Error(data.detail || '啟動服務失敗');
            }
        } catch (error) {
            console.error('啟動聊天服務失敗:', error);
            chatStartupStatus.textContent = `錯誤: ${error.message}`;
            chatStartBtn.disabled = false;
            chatStartSpinner.style.display = 'none';
        }
    }

    function connectChatWebSocket() {
        if (chatWs && chatWs.readyState !== WebSocket.CLOSED) {
            console.log("已有 WebSocket 連線，將其關閉。");
            chatWs.close();
        }
        
        const wsProtocol = activeDeviceUrl.startsWith('https:') ? 'wss:' : 'ws:';
        const wsHost = new URL(activeDeviceUrl).host;
        const wsUrl = `${wsProtocol}//${wsHost}/api/chat/ws/${clientId}`;

        chatWs = new WebSocket(wsUrl);

        chatWs.onopen = () => {
            console.log("已連接到 AI 聊天 WebSocket 端點。");
        };

        chatWs.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type && (data.type.startsWith('current_'))) {
                    // 這是設定回傳，由 modal 處理
                    handleSettingsResponse(data);
                } else {
                    addChatMessage('AI', event.data);
                }
            } catch (e) {
                addChatMessage('AI', event.data);
            }
        };

        chatWs.onclose = () => {
            console.log("AI 聊天 WebSocket 連線已中斷。");
            addChatMessage('SYSTEM', '與 AI 助理的連線已中斷。');
            checkChatServiceStatus();
        };

        chatWs.onerror = (error) => {
            console.error("AI 聊天 WebSocket 錯誤:", error);
            addChatMessage('SYSTEM', '連線時發生錯誤。');
        };
    }
    
    function sendChatMessage() {
        const message = chatInput.value.trim();
        if (message && chatWs && chatWs.readyState === WebSocket.OPEN) {
            addChatMessage('USER', message);
            chatWs.send(message);
            chatInput.value = '';
        }
    }

    function handleSettingsResponse(data) {
        const settingType = chatModalEl.dataset.settingType;
        let title = '';
        let content = '';
        let showModal = false;

        if (data.type === 'current_settings') {
            if (settingType === 'worldview') {
                title = '世界觀設定';
                content = data.world_settings;
                showModal = true;
            } else if (settingType === 'aisettings') {
                title = 'AI 規範 (性格與行為)';
                content = data.ai_settings;
                showModal = true;
            }
        } else if (data.type === 'current_system_settings' && settingType === 'system') {
            title = '自訂系統設置 (一號指令)';
            content = data.one_instruction;
            showModal = true;
        }
        
        if (showModal) {
            chatModalTitle.textContent = title;
            chatModalTextarea.value = content;
            if(bsChatModal) bsChatModal.show();
        }
    }

    function openChatModal(type) {
        if (chatWs && chatWs.readyState === WebSocket.OPEN) {
            chatModalEl.dataset.settingType = type;
            let command = '';
            if (type === 'system') {
                command = '/get_system_settings';
            } else {
                command = '/get_settings';
            }
            chatWs.send(command);
        } else {
            alert('尚未連接到聊天服務。');
        }
    }

    function saveChatSettings() {
        const type = chatModalEl.dataset.settingType;
        const content = chatModalTextarea.value; // 允許空內容
        
        let command = '';
        if (type === 'worldview') command = `/set_worldview ${content}`;
        else if (type === 'aisettings') command = `/set_aisettings ${content}`;
        else if (type === 'system') command = `/set_system_settings ${content}`;

        if (command && chatWs && chatWs.readyState === WebSocket.OPEN) {
            chatWs.send(command);
            if(bsChatModal) bsChatModal.hide();
        } else {
            alert('尚未連接到聊天服務，無法保存。');
        }
    }

    // --- ComfyUI 相關邏輯 (保持不變) ---

    function updateDenoiseDefault() {
        if (!comfyFormElements.denoise) return;
        const isImg2ImgMode = !!img2imgState.source_image;
        const isControlNetMode = enableControlnetSwitch && enableControlnetSwitch.checked;
        comfyFormElements.denoise.value = (isImg2ImgMode || isControlNetMode) ? 0.75 : 1.0;
    }

// 函式功能：將當前介面上的所有參數設定儲存到後端
    async function saveSettings() {
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
            optimize_positive: comfyFormElements.optimize_positive ? comfyFormElements.optimize_positive.checked : false,
            ai_optimize: comfyFormElements.ai_optimize ? comfyFormElements.ai_optimize.checked : false,
            translate_negative: comfyFormElements.translate_negative ? comfyFormElements.translate_negative.checked : false,
            enable_adetailer: comfyFormElements.enable_adetailer ? comfyFormElements.enable_adetailer.checked : false,
            adetailer_positive_prompt: comfyFormElements.adetailer_positive_prompt ? comfyFormElements.adetailer_positive_prompt.value : '',
            translate_adetailer_positive: comfyFormElements.translate_adetailer_positive ? comfyFormElements.translate_adetailer_positive.checked : false,
            adetailer_steps: comfyFormElements.adetailer_steps && comfyFormElements.adetailer_steps.value ? parseInt(comfyFormElements.adetailer_steps.value, 10) : null,
            denoise: comfyFormElements.denoise ? comfyFormElements.denoise.value : 1.0,
            vae: comfyFormElements.vae ? comfyFormElements.vae.value : 'model_embedded'
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
// 函式功能：將當前介面上的所有參數設定儲存到後端

// 函式功能：從後端載入使用者先前的參數設定，並填充到介面對應的欄位中
    async function loadSettings() {
        try {
            const response = await fetchWithUserContext('/api/comfyui/settings');
            if (!response.ok) throw new Error('無法從伺服器獲取設定。');
            const settings = await response.json();
            
            if (settings.model) {
                comfyFormElements.model = settings.model;
                if (comfySelectedModelName) comfySelectedModelName.textContent = settings.model.split(/[\\/]/).pop();
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
            if (comfyFormElements.adetailer_steps) comfyFormElements.adetailer_steps.value = settings.adetailer_steps || '';
            
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
            }
            if (typeof settings.ai_optimize === 'boolean' && comfyFormElements.ai_optimize) {
                comfyFormElements.ai_optimize.checked = settings.ai_optimize;
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
            
            if (settings.vae && comfyFormElements.vae) {
                // 確保選項已經填充
                setTimeout(() => {
                    if (Array.from(comfyFormElements.vae.options).some(opt => opt.value === settings.vae)) {
                        comfyFormElements.vae.value = settings.vae;
                    }
                }, 100); // 短暫延遲以等待異步填充完成
            }

        } catch (error) {
            console.error("載入設定失敗，將使用預設值:", error.message);
            if(comfyFormElements.seed_behavior) comfyFormElements.seed_behavior.value = 'random';
            if(comfyRandomSeedBtn) comfyRandomSeedBtn.click();
        }
    }
// 函式功能：從後端載入使用者先前的參數設定，並填充到介面對應的欄位中
    
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
            reader.onload = (e) => { 
                if(previewElement) previewElement.src = e.target.result; 
                if (stateKey === 'source_image') {
                    img2imgState.source_image_data = e.target.result;
                    if(drawMaskBtn) drawMaskBtn.style.display = 'block';
                }
            };
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
        if (stateKey === 'source_image') {
            img2imgState.source_image_data = null;
            if(drawMaskBtn) drawMaskBtn.style.display = 'none';
        }
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

    function syncDenoiseValues(value) {
        const floatValue = parseFloat(value);
        if (comfyFormElements.denoise) comfyFormElements.denoise.value = floatValue.toFixed(2);
        if (img2imgDenoiseSlider) img2imgDenoiseSlider.value = floatValue;
        if (img2imgDenoiseValueLabel) img2imgDenoiseValueLabel.textContent = floatValue.toFixed(2);
    }

    if (comfyFormElements.denoise) comfyFormElements.denoise.addEventListener('input', (e) => syncDenoiseValues(e.target.value));
    if (img2imgDenoiseSlider) img2imgDenoiseSlider.addEventListener('input', (e) => syncDenoiseValues(e.target.value));

// 中文註釋：fetchAndPopulateCheckpoints函式開始
// 函式功能：從後端獲取 Checkpoint 模型列表，為其分配架構標識，並填充到模型選擇介面中
    async function fetchAndPopulateCheckpoints() {
        try {
            const checkpointsResponse = await fetchWithUserContext('/api/comfyui/checkpoints');
            if (!checkpointsResponse.ok) throw new Error(`無法獲取 Checkpoints: ${checkpointsResponse.statusText}`);
            let checkpoints = await checkpointsResponse.json();
            
            checkpoints = checkpoints.map(model => {
                const modelNameLower = model.name.toLowerCase();

                // [v18.16 修正] 移除前端對 qwen 路徑的特殊處理，直接使用後端提供的原始相對路徑
                const sdxlKeywords = ['sdxl', 'xl', 'il', 'noobai', 'nai', 'pony'];

                if (modelNameLower.includes('qwen')) {
                    model.architecture = 'qwen';
                    model.isQwen = true;
                } else if (modelNameLower.includes('flux')) {
                    model.architecture = modelNameLower.endsWith('.safetensors') ? 'flux_safetensors' : 'flux_gguf';
                } else if (modelNameLower.includes('sd3')) {
                    model.architecture = 'sd3';
                } else if (sdxlKeywords.some(keyword => modelNameLower.includes(keyword))) {
                    model.architecture = 'sdxl';
                } else {
                    model.architecture = 'sd15'; 
                }
                return model;
            });

            if (modelSelectionGrid) {
                modelSelectionGrid.innerHTML = '';
                checkpoints.forEach(model => modelSelectionGrid.appendChild(createModelCard(model, 'model')));
            }
            if (!comfyFormElements.model && checkpoints.length > 0) {
                comfyFormElements.model = checkpoints[0].name;
                comfyFormElements.model_architecture = checkpoints[0].architecture;
                if (comfySelectedModelName) comfySelectedModelName.textContent = checkpoints[0].name.split(/[\\/]/).pop();
            }
            await updateLoraListForModel(comfyFormElements.model);
        } catch (error) {
            if(comfyStatusText) { comfyStatusText.textContent = `錯誤: ${error.message}。`; comfyStatusText.classList.add('text-danger'); }
        }
    }
// 函式功能：從後端獲取 Checkpoint 模型列表，為其分配架構標識，並填充到模型選擇介面中
// 中文註釋：fetchAndPopulateCheckpoints函式結束



    async function fetchAndPopulateVAEs() {
        const vaeSelect = comfyFormElements.vae;
        if (!vaeSelect) return;

        try {
            const response = await fetchWithUserContext('/api/comfyui/vaes');
            if (!response.ok) throw new Error('無法獲取 VAE 列表');
            const vaes = await response.json();
            
            const currentValue = vaeSelect.value;
            vaeSelect.innerHTML = ''; // 清空現有選項

            // 添加預設選項
            const defaultOption = document.createElement('option');
            defaultOption.value = 'model_embedded';
            defaultOption.textContent = '使用模型內建 VAE (預設)';
            vaeSelect.appendChild(defaultOption);

            // 填充從 API 獲取的 VAE
            vaes.forEach(vaeName => {
                const option = document.createElement('option');
                option.value = vaeName;
                option.textContent = vaeName;
                vaeSelect.appendChild(option);
            });

            // 恢復之前選擇的值
            if (currentValue && vaes.includes(currentValue)) {
                vaeSelect.value = currentValue;
            } else {
                vaeSelect.value = 'model_embedded';
            }

        } catch (error) {
            console.error('填充 VAE 列表時出錯:', error);
            vaeSelect.innerHTML = `<option value="model_embedded">錯誤: ${error.message}</option>`;
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
                    option.value = proc.value;
                    option.textContent = proc.name;
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
        
        if (item.architecture) {
            card.dataset.architecture = item.architecture;
        }

        const isQwenModel = item.name.toLowerCase().includes('qwen');
        card.dataset.isQwen = isQwenModel;

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
            card.addEventListener('click', () => {
                if (item.architecture && item.architecture.startsWith('flux')) {
                    handleFluxModelSelection(item);
                } else {
                    selectModel(item);
                }
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

// 中文註釋：selectModel函式開始
// 函式功能：處理使用者在模型選擇介面中點擊選擇一個模型的操作
    async function selectModel(item) {
        /**
         * v2.0 (Qwen 安全提示): 當選擇 Qwen AIO 模型時，除了自動設定推薦參數外，
         *      還會在狀態欄顯示一條明確的警告訊息，告知使用者此模型的解析度已被
         *      後端強制鎖定在 512x512，以管理使用者預期並解釋為何高解析度設定無效。
         * v1.0 (Qwen AIO 支援): 新增了對 Qwen-Rapid-AIO-NSFW 模型的特別處理邏輯。
         */
        const newModel = item.name;
        const newArchitecture = item.architecture || 'sdxl';

        if (comfyFormElements.model !== newModel) {
            comfyFormElements.loras = [];
            renderSelectedLoras();
        }

        comfyFormElements.model = newModel;
        comfyFormElements.model_architecture = newArchitecture;
        if (comfySelectedModelName) comfySelectedModelName.textContent = newModel.split(/[\\/]/).pop();
        
        const newModelLower = newModel.toLowerCase();
        const isQwenAIONSFW = newModelLower.includes('qwen-rapid-aio-nsfw');
        const isGenericQwen = newModelLower.includes('qwen') && !isQwenAIONSFW;

        if (isQwenAIONSFW) {
            console.log('Qwen AIO NSFW 模式已啟用，正在自動設定推薦參數...');
            if (comfyFormElements.steps) comfyFormElements.steps.value = 4;
            if (comfyFormElements.cfg) comfyFormElements.cfg.value = 1.0;
            if (comfyFormElements.sampler_name) comfyFormElements.sampler_name.value = 'lcm';
            if (comfyFormElements.scheduler) comfyFormElements.scheduler.value = 'beta';
            
            comfyFormElements.loras = [{ name: 'qwen_anime_nsfw_lora.safetensors', weight: 0.85 }];
            renderSelectedLoras();
            
            // [v2.0 新增] 提供明確的前端提示
            if (comfyStatusText) {
                comfyStatusText.innerHTML = `
                    <div class="alert alert-warning small p-2" role="alert">
                        <i class="bi bi-exclamation-triangle-fill"></i>
                        <strong>Qwen AIO NSFW 模式已啟用:</strong> 為了穩定性，此模型的解析度已被後端強制鎖定為 <strong>512x512</strong>。
                    </div>
                `;
                comfyStatusText.classList.remove('text-danger', 'text-success');
            }

        } else if (isGenericQwen) {
            console.log('通用 Qwen 模式已啟用，參數已最佳化...');
            if (comfyFormElements.steps) comfyFormElements.steps.value = 8;
            if (comfyFormElements.cfg) comfyFormElements.cfg.value = 1.0;
            if (comfyFormElements.vae) comfyFormElements.vae.value = 'qwen_image_vae.safetensors';
            
            comfyFormElements.loras = [];
            renderSelectedLoras();
            
            if (comfyStatusText) {
                comfyStatusText.textContent = '通用 Qwen (GGUF) 模式已啟用。';
                comfyStatusText.classList.remove('text-danger');
                comfyStatusText.classList.add('text-success');
            }
        } else {
             // 如果切換到非 Qwen 模型，清除警告
            if (comfyStatusText && comfyStatusText.querySelector('.alert')) {
                comfyStatusText.innerHTML = '請在左側設定參數並點擊生成。';
            }
        }
        
        if (bsModelSelectionModal) bsModelSelectionModal.hide();
        await updateLoraListForModel(newModel);
    }
// 函式功能：處理使用者在模型選擇介面中點擊選擇一個模型的操作
// 中文註釋：selectModel函式結束

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

// 中文註釋：addHistoryItemToGrid函式開始
// 函式功能：創建單個歷史紀錄項目的 DOM 元素並將其附加到歷史網格中
    function addHistoryItemToGrid(item) {
        if (!comfyHistoryGrid) return;

        // 如果載入指示器存在，先移除它，我們會在所有項目添加完畢後再把它加到末尾
        const existingIndicator = getById('history-loading-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }

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
                // 從快取中找到正確的列表來計算索引
                const deviceId = userContext.user_type === 'gm' ? (Object.entries(sharedConfig.devices).find(([id, dev]) => dev.url === activeDeviceUrl)?.[0] || 'unknown_device') : localDeviceId;
                const currentList = deviceHistoryCache[deviceId] ? deviceHistoryCache[deviceId].items : [];
                currentModalIndex = currentList.findIndex(i => i.id === item.id);

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

        comfyHistoryGrid.appendChild(historyItemDiv);

        return historyItemDiv;
    }
// 函式功能：創建單個歷史紀錄項目的 DOM 元素並將其附加到歷史網格中
// 中文註釋：addHistoryItemToGrid函式結束




// 中文註釋：fetchHistory函式開始
// 函式功能：根據模式（初次、更舊、更新）從後端非同步獲取歷史紀錄
    async function fetchHistory(mode = 'initial') {
        if (isLoadingHistory && mode !== 'newer') return [];
        isLoadingHistory = true;

        if (mode !== 'newer' && historyLoadingIndicator) {
            historyLoadingIndicator.textContent = '正在載入...';
            historyLoadingIndicator.style.display = 'block';
        }

        const deviceId = userContext.user_type === 'gm' ? (Object.entries(sharedConfig.devices).find(([id, dev]) => dev.url === activeDeviceUrl)?.[0] || 'unknown_device') : localDeviceId;

        if (!deviceHistoryCache[deviceId]) {
            deviceHistoryCache[deviceId] = { items: [], hasMore: true };
        }
        const cache = deviceHistoryCache[deviceId];

        let url = '/api/comfyui/history?limit=30';
        if (mode === 'older' && cache.items.length > 0) {
            url += `&before_timestamp=${encodeURIComponent(cache.items[cache.items.length - 1].created_at)}`;
        } else if (mode === 'newer' && cache.items.length > 0) {
            url = `/api/comfyui/history?after_timestamp=${encodeURIComponent(cache.items[0].created_at)}`;
        }
        
        try {
            const response = await fetchWithUserContext(url);
            if (!response.ok) throw new Error(`無法獲取歷史紀錄: ${response.statusText}`);
            const items = await response.json();
            
            if (mode === 'newer') {
                cache.items.unshift(...items);
                if (items.length > 0) renderHistory(cache.items); // 只有在有新項目時才重新渲染整個列表
            } else {
                cache.items.push(...items);
                if (mode === 'initial') {
                    renderHistory(cache.items);
                }
            }
            
            if (mode !== 'newer') {
                cache.hasMore = items.length >= 30;
                if (!cache.hasMore) {
                    historyLoadingIndicator.textContent = '沒有更多紀錄了';
                    if (currentHistoryObserver) currentHistoryObserver.disconnect();
                }
            }
            return items;
        } catch (error) {
            console.error("獲取歷史紀錄失敗:", error);
            if (historyLoadingIndicator && mode !== 'newer') {
                historyLoadingIndicator.textContent = `錯誤: ${error.message}`;
            }
            return [];
        } finally {
            isLoadingHistory = false;
        }
    }
// 函式功能：根據模式（初次、更舊、更新）從後端非同步獲取歷史紀錄
// 中文註釋：fetchHistory函式結束

// 中文註釋：renderHistory函式開始
// 函式功能：根據模式處理傳入的歷史紀錄項目，並更新 currentHistoryList 和 DOM
    function renderHistory(items) {
        if (!comfyHistoryGrid) return;
        
        comfyHistoryGrid.innerHTML = '';
        
        if (!items || items.length === 0) {
            comfyHistoryGrid.innerHTML = '<p class="text-muted text-center col-12">沒有歷史紀錄。</p>';
            return;
        }

        const groupedByDate = {};
        items.forEach(item => {
            const date = new Date(item.created_at).toLocaleDateString();
            if (!groupedByDate[date]) {
                groupedByDate[date] = [];
            }
            groupedByDate[date].push(item);
        });

        // 按日期降序排序並渲染 (從新到舊)
        const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));

        sortedDates.forEach(date => {
            const header = document.createElement('div');
            header.className = 'history-date-header';
            header.textContent = date;
            comfyHistoryGrid.appendChild(header);
            
            groupedByDate[date].forEach(item => {
                addHistoryItemToGrid(item);
            });
        });
    }
// 函式功能：根據模式處理傳入的歷史紀錄項目，並更新 currentHistoryList 和 DOM
// 中文註釋：renderHistory函式結束






// 中文註釋：initializeHistory函式開始
// 函式功能：初始化歷史紀錄，包括首次載入資料和設定無限滾動的事件監聽器
    async function initializeHistory() {
        if (!comfyHistoryGrid) return;

        // [v3.0 效能優化] 中斷上一個裝置的觀察者
        if (currentHistoryObserver) {
            currentHistoryObserver.disconnect();
            currentHistoryObserver = null;
        }
        
        const deviceId = userContext.user_type === 'gm' ? (Object.entries(sharedConfig.devices).find(([id, dev]) => dev.url === activeDeviceUrl)?.[0] || 'unknown_device') : localDeviceId;

        // [v3.0 效能優化] 檢查裝置快取
        if (deviceHistoryCache[deviceId] && deviceHistoryCache[deviceId].items.length > 0) {
            console.log(`從快取載入 '${deviceId}' 的歷史紀錄...`);
            renderHistory(deviceHistoryCache[deviceId].items);
        } else {
            // 如果沒有快取，則從網路獲取
            await fetchHistory('initial');
        }
        
        applyPersistedHighlight();
        
        // [v3.0 行動裝置優化] 為當前裝置設定新的 IntersectionObserver
        setupIntersectionObserver();
    }
// 函式功能：初始化歷史紀錄，包括首次載入資料和設定無限滾動的事件監聽器
// 中文註釋：initializeHistory函式結束




// 中文註釋：setupIntersectionObserver函式開始
// 函式功能：設定 IntersectionObserver 以實現高效的無限滾動
    function setupIntersectionObserver() {
        if (currentHistoryObserver) currentHistoryObserver.disconnect();
        
        const deviceId = userContext.user_type === 'gm' ? (Object.entries(sharedConfig.devices).find(([id, dev]) => dev.url === activeDeviceUrl)?.[0] || 'unknown_device') : localDeviceId;
        const cache = deviceHistoryCache[deviceId];

        if (!cache || !cache.hasMore) {
            historyLoadingIndicator.textContent = '沒有更多紀錄了';
            historyLoadingIndicator.style.display = 'block';
            if(comfyHistoryGrid && !comfyHistoryGrid.contains(historyLoadingIndicator)) {
                comfyHistoryGrid.appendChild(historyLoadingIndicator);
            }
            return;
        }

        const options = {
            root: comfyHistoryGrid,
            rootMargin: '0px',
            threshold: 0.1
        };

        currentHistoryObserver = new IntersectionObserver(async (entries) => {
            if (entries[0].isIntersecting && !isLoadingHistory && cache.hasMore) {
                const newItems = await fetchHistory('older');
                // 將新獲取的項目附加到網格中
                newItems.forEach(item => {
                    const existingItem = comfyHistoryGrid.querySelector(`.history-item[data-item-id="${item.id}"]`);
                    if (!existingItem) {
                        const newItemElement = addHistoryItemToGrid(item);
                        // 將哨兵元素移到最後
                        comfyHistoryGrid.appendChild(historyLoadingIndicator);
                    }
                });
            }
        }, options);

        historyLoadingIndicator.textContent = '正在載入...';
        historyLoadingIndicator.style.display = 'block';
        if(comfyHistoryGrid) comfyHistoryGrid.appendChild(historyLoadingIndicator);
        currentHistoryObserver.observe(historyLoadingIndicator);
    }
// 函式功能：設定 IntersectionObserver 以實現高效的無限滾動
// 中文註釋：setupIntersectionObserver函式結束






// 中文註釋：deleteHistoryItem函式開始
// 函式功能：從後端和前端刪除指定的歷史紀錄項目
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

                // [v2.1 修正] 從當前裝置的快取中移除項目
                const deviceId = userContext.user_type === 'gm' ? (Object.entries(sharedConfig.devices).find(([id, dev]) => dev.url === activeDeviceUrl)?.[0] || 'unknown_device') : localDeviceId;
                if (deviceHistoryCache[deviceId]) {
                    deviceHistoryCache[deviceId].items = deviceHistoryCache[deviceId].items.filter(item => item.id !== id);
                    if (deviceHistoryCache[deviceId].items.length === 0) {
                         renderHistory([]); // 如果列表為空，重新渲染以顯示提示
                    }
                }
                 
            } else { 
                throw new Error(result.detail || '刪除失敗'); 
            }
        } catch (error) { 
            alert(`刪除失敗: ${error.message}`); 
        }
    }
// 函式功能：從後端和前端刪除指定的歷史紀錄項目
// 中文註釋：deleteHistoryItem函式結束
    
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
            if (!response.ok) {
                throw new Error(`無法獲取 VAPID 公鑰: ${response.statusText}`);
            }
            const data = await response.json();
            if (!data || !data.public_key) {
                throw new Error("後端返回的 VAPID 公鑰格式不正確。");
            }

            const applicationServerKey = urlBase64ToUint8Array(data.public_key);
            const subscription = await serviceWorkerRegistration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
            
            await fetchWithUserContext('/api/comfyui/save_subscription', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(subscription) 
            });
            console.log('已成功訂閱 Web Push 通知。');
        } catch (error) {
            console.error('訂閱 Web Push 通知失敗:', error);
        } finally {
            await updateNotificationUI();
        }
    }
    
    async function unsubscribeFromPush() {
        if (!serviceWorkerRegistration) return;
        try {
            const subscription = await serviceWorkerRegistration.pushManager.getSubscription();
            if (subscription) {
                await fetchWithUserContext('/api/comfyui/unsubscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: subscription.endpoint })
                });
                await subscription.unsubscribe();
                console.log('已成功取消訂閱 Web Push 通知。');
            }
        } catch (error) {
            console.error('取消訂閱 Web Push 通知失敗:', error);
        } finally {
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
            enableNotificationsBtn.style.display = 'block';
            return;
        }

        const permission = await navigator.permissions.query({ name: 'push', userVisibleOnly: true });
        if (permission.state === 'denied') {
            notificationStatusBadge.textContent = '已封鎖';
            notificationStatusBadge.className = 'badge bg-danger notification-status-badge';
            enableNotificationsBtn.disabled = true;
            enableNotificationsBtn.textContent = '權限已被封鎖';
            enableNotificationsBtn.style.display = 'block';
            return;
        }

        const subscription = await serviceWorkerRegistration.pushManager.getSubscription();
        if (!subscription) {
            notificationStatusBadge.textContent = '未啟用';
            notificationStatusBadge.className = 'badge bg-secondary notification-status-badge';
            enableNotificationsBtn.disabled = false;
            enableNotificationsBtn.textContent = '啟用通知';
            enableNotificationsBtn.className = 'btn btn-sm btn-outline-primary';
            enableNotificationsBtn.style.display = 'block';
            return;
        }

        try {
            const response = await fetchWithUserContext(`/api/comfyui/subscription_status?endpoint=${encodeURIComponent(subscription.endpoint)}`);
            const status = await response.json();
            if (status.exists && status.is_active) {
                notificationStatusBadge.textContent = '已啟用';
                notificationStatusBadge.className = 'badge bg-success notification-status-badge';
                enableNotificationsBtn.disabled = false;
                enableNotificationsBtn.textContent = '禁用通知';
                enableNotificationsBtn.className = 'btn btn-sm btn-outline-warning';
                enableNotificationsBtn.style.display = 'block';
            } else {
                notificationStatusBadge.textContent = '已禁用';
                notificationStatusBadge.className = 'badge bg-warning text-dark notification-status-badge';
                enableNotificationsBtn.disabled = false;
                enableNotificationsBtn.textContent = '重新啟用';
                enableNotificationsBtn.className = 'btn btn-sm btn-outline-success';
                enableNotificationsBtn.style.display = 'block';
            }
        } catch (error) {
            console.error('檢查訂閱狀態失敗:', error);
            notificationStatusBadge.textContent = '狀態未知';
            notificationStatusBadge.className = 'badge bg-dark notification-status-badge';
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
        
        accumulatedSteps = 0;
        currentNodeTotalSteps = 0;
        isNewNodeProgress = true;

        connectStatusWebSocket(promptId);
    }

// 中文註釋：handleGenerateClick函式開始
// 函式功能：處理點擊「開始生成」按鈕的事件，收集所有參數並向後端發送生成請求
    async function handleGenerateClick() {
        if (!comfyGenerateBtn || comfyGenerateBtn.disabled) return;
    
        if (!comfyFormElements.model) {
            alert('請先選擇一個 Checkpoint 模型！');
            return;
        }
    
        // Qwen 模型參數的特殊處理
        const isQwenModel = comfyFormElements.model.toLowerCase().includes('qwen');
        if (isQwenModel) {
            // 在點擊生成時，再次確保 Qwen 的專用參數被設置
            console.log("Qwen 模型偵測到，正在強制設定最佳化參數...");
            if (comfyFormElements.steps) comfyFormElements.steps.value = 8;
            if (comfyFormElements.cfg) comfyFormElements.cfg.value = 1.0;
            // 注意：VAE 的選擇應在 selectModel 時處理，此處不再強制覆蓋，以尊重用戶可能的手動修改
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
    
        // 建立 payload，已移除所有影片相關欄位
        const payload = {
            model: comfyFormElements.model,
            model_architecture: comfyFormElements.model_architecture,
            loras: comfyFormElements.loras,
            main_prompt: comfyFormElements.positive_prompt ? comfyFormElements.positive_prompt.value.trim() : '',
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
            optimize_positive: comfyFormElements.optimize_positive ? comfyFormElements.optimize_positive.checked : false,
            ai_optimize: comfyFormElements.ai_optimize ? comfyFormElements.ai_optimize.checked : false,
            translate_negative: comfyFormElements.translate_negative ? comfyFormElements.translate_negative.checked : false,
            seed_behavior: comfyFormElements.seed_behavior ? comfyFormElements.seed_behavior.value : 'increment',
            enable_adetailer: comfyFormElements.enable_adetailer ? comfyFormElements.enable_adetailer.checked : false,
            adetailer_positive_prompt: comfyFormElements.adetailer_positive_prompt ? comfyFormElements.adetailer_positive_prompt.value : '',
            translate_adetailer_positive: comfyFormElements.translate_adetailer_positive ? comfyFormElements.translate_adetailer_positive.checked : false,
            adetailer_steps: comfyFormElements.adetailer_steps && comfyFormElements.adetailer_steps.value ? parseInt(comfyFormElements.adetailer_steps.value, 10) : null,
            enable_controlnet: enableControlnetSwitch ? enableControlnetSwitch.checked : false,
            controlnet_model: controlnetModelSelect ? controlnetModelSelect.value : null,
            controlnet_preprocessor: controlnetPreprocessorSelect ? controlnetPreprocessorSelect.value : null,
            controlnet_strength: controlnetStrengthSlider ? parseFloat(controlnetStrengthSlider.value) : 1.0,
            controlnet_image: controlnetState.controlnet_image,
            vae: comfyFormElements.vae.value
        };
        
        const mainSteps = payload.steps;
        const batchSize = payload.batch_size;
        const adetailerStepsPerImage = mainSteps;
        totalExpectedSteps = mainSteps + (payload.enable_adetailer ? (adetailerStepsPerImage * batchSize) : 0);

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
    
            const result = await response.json();
            if (result && result.prompt_id) {
                setGeneratingState(result.prompt_id);
            } else if (result && result.status === 'queued') {
                if (comfyStatusText) {
                    comfyStatusText.textContent = `✅ ${result.message}`;
                    comfyStatusText.classList.add('text-success');
                }
                if (comfySpinner) comfySpinner.style.display = 'inline-block';
            } else {
                throw new Error('後端響應格式不正確。');
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
// 函式功能：處理點擊「開始生成」按鈕的事件，收集所有參數並向後端發送生成請求
// 中文註釋：handleGenerateClick函式結束

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
                        comfyProgressText.textContent = `總進度 (估算): ${Math.min(percent, 100).toFixed(0)}%`;
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

// 中文註釋：showImageInModal函式開始
// 函式功能：在燈箱 (Modal) 中顯示指定索引的圖片或影片及其詳細資訊
    function showImageInModal(index) {
        // [v2.1 修正] 從快取中獲取當前裝置的正確歷史列表
        const deviceId = userContext.user_type === 'gm' ? (Object.entries(sharedConfig.devices).find(([id, dev]) => dev.url === activeDeviceUrl)?.[0] || 'unknown_device') : localDeviceId;
        const currentList = deviceHistoryCache[deviceId] ? deviceHistoryCache[deviceId].items : [];

        if (index < 0 || index >= currentList.length) return;
        currentModalIndex = index;
        const item = currentList[index];
        
        if (!item) {
            console.error("嘗試在燈箱中顯示一個無效的歷史紀錄項目。");
            return;
        }

        Object.values(modalParams).forEach(el => {
            if (el && el.style && (el.id.includes('-info') || el.id.includes('-container'))) {
                el.style.display = 'none';
            }
        });
        
        const fullItemUrl = new URL(item.url, activeDeviceUrl).href;
        modalImage.src = fullItemUrl;
        modalImage.style.display = 'block';

        if (modalDownloadBtn) {
            modalDownloadBtn.href = fullItemUrl;
            modalDownloadBtn.download = item.filename ? item.filename.split(/[\\/]/).pop() : 'download';
        }

        const params = item.params || {};

        modalParams.model.textContent = params.model ? params.model.split(/[\\/]/).pop() : '未知';

        if (params.vae && params.vae !== "model_embedded") {
            modalParams.vae.textContent = params.vae;
        } else {
            modalParams.vae.textContent = '模型內建';
        }
        
        modalParams.lora_list.innerHTML = '';
        if (params.loras && params.loras.length > 0) {
            const ul = document.createElement('ul');
            ul.className = 'list-unstyled mb-0';
            params.loras.forEach(lora => {
                const li = document.createElement('li');
                li.className = 'param-value';
                li.textContent = `${lora.name.split(/[\\/]/).pop()} (權重: ${lora.weight.toFixed(1)})`;
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
        if (modalNextBtn) modalNextBtn.style.display = index < currentList.length - 1 ? 'block' : 'none';
        
        if (imageModal) imageModal.style.display = 'block';
    }
// 函式功能：在燈箱 (Modal) 中顯示指定索引的圖片或影片及其詳細資訊
// 中文註釋：showImageInModal函式結束

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

    // 繪圖遮罩相關函式
    function initializeInpaintCanvas(imageSrc) {
        const img = new Image();
        img.onload = () => {
            const maxWidth = window.innerWidth * 0.8;
            const maxHeight = window.innerHeight * 0.7;
            let { width, height } = img;

            if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
            }
            if (height > maxHeight) {
                width *= maxHeight / height;
                height = maxHeight;
            }

            inpaintCanvas.width = width;
            inpaintCanvas.height = height;
            inpaintCtx.drawImage(img, 0, 0, width, height);
        };
        img.src = imageSrc;
    }

    function getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
    }
    
    function getTouchPos(canvas, touch) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        };
    }

    function drawOnCanvas(e) {
        if (!isDrawing) return;
        e.preventDefault();
        
        let currentPos;
        if (e.touches && e.touches[0]) {
            currentPos = getTouchPos(inpaintCanvas, e.touches[0]);
        } else {
            currentPos = getMousePos(inpaintCanvas, e);
        }

        const dist = Math.sqrt(Math.pow(currentPos.x - lastX, 2) + Math.pow(currentPos.y - lastY, 2));
        const angle = Math.atan2(currentPos.y - lastY, currentPos.x - lastX);

        for (let i = 0; i < dist; i += 2) {
            const x = lastX + (Math.cos(angle) * i);
            const y = lastY + (Math.sin(angle) * i);
            inpaintCtx.beginPath();
            inpaintCtx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
            inpaintCtx.fill();
        }

        [lastX, lastY] = [currentPos.x, currentPos.y];
    }

    async function handleDrawnMask(blob) {
        const dataUrl = URL.createObjectURL(blob);
        if (maskPreview) maskPreview.src = dataUrl;
        if (maskUploadArea) maskUploadArea.style.display = 'none';
        if (maskPreviewContainer) maskPreviewContainer.style.display = 'block';
        if (maskFilename) maskFilename.textContent = 'drawn_mask.png';

        const maskFile = new File([blob], "drawn_mask.png", { type: "image/png" });
        try {
            const filename = await uploadImageToServer(maskFile);
            if (filename) {
                img2imgState.inpaint_mask = filename;
                console.log('繪製的遮罩已成功上傳:', filename);
            } else {
                throw new Error('伺服器未返回有效的檔名。');
            }
        } catch (error) {
            alert(`繪製的遮罩上傳失敗: ${error.message}`);
            resetFileUploadUI(img2imgState, 'inpaint_mask', maskUploadArea, maskPreviewContainer, maskPreview, maskFilename, null, '點擊上傳遮罩', '白色區域為重繪部分');
        }
    }

    async function generateMaskAndUpload() {
        const originalImage = new Image();
        originalImage.onload = async () => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = originalImage.width;
            tempCanvas.height = originalImage.height;
            const tempCtx = tempCanvas.getContext('2d');

            tempCtx.fillStyle = 'black';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

            const drawnCanvas = inpaintCanvas;
            const drawnCtx = drawnCanvas.getContext('2d');
            const drawnImageData = drawnCtx.getImageData(0, 0, drawnCanvas.width, drawnCanvas.height);
            const data = drawnImageData.data;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] > 0) {
                    data[i] = 255;
                    data[i + 1] = 255;
                    data[i + 2] = 255;
                    data[i + 3] = 255;
                }
            }
            drawnCtx.putImageData(drawnImageData, 0, 0);

            tempCtx.drawImage(drawnCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
            
            tempCanvas.toBlob(async (blob) => {
                await handleDrawnMask(blob);
                if (bsInpaintCanvasModal) bsInpaintCanvasModal.hide();
            }, 'image/png');
        };
        originalImage.src = img2imgState.source_image_data;
    }
    
    function connectDownloadWebSocket(taskId, statusDiv) {
        if (downloadWs && downloadWs.readyState === WebSocket.OPEN) {
            downloadWs.close();
        }

        const wsProtocol = activeDeviceUrl.startsWith('https:') ? 'wss:' : 'ws:';
        const wsHost = new URL(activeDeviceUrl).host;
        const wsUrl = `${wsProtocol}//${wsHost}/api/comfyui/ws/download/status/${taskId}`;

        downloadWs = new WebSocket(wsUrl);

        downloadWs.onopen = () => {
            console.log(`已連接到下載 WebSocket，監聽任務 ID: ${taskId}`);
        };

        downloadWs.onmessage = (event) => {
            const message = JSON.parse(event.data);
            const data = message.data;

            switch (message.type) {
                case 'progress':
                    const percent = data.progress;
                    const downloadedMB = (data.downloaded / 1024 / 1024).toFixed(2);
                    const totalMB = (data.total / 1024 / 1024).toFixed(2);
                    statusDiv.innerHTML = `
                        <div class="progress" style="height: 20px;">
                            <div class="progress-bar" role="progressbar" style="width: ${percent}%;" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">${percent}%</div>
                        </div>
                        <div class="text-center small mt-1">${downloadedMB} MB / ${totalMB} MB</div>
                    `;
                    break;
                case 'complete':
                    statusDiv.innerHTML = `<div class="alert alert-success mt-2">${data.message}</div>`;
                    const submitBtn = document.getElementById('download-model-submit-btn');
                    if (submitBtn) submitBtn.disabled = false;
                    const spinner = document.getElementById('download-model-spinner');
                    if (spinner) spinner.style.display = 'none';
                    downloadWs.close();
                    break;
                case 'error':
                    statusDiv.innerHTML = `<div class="alert alert-danger mt-2">錯誤: ${data.message}</div>`;
                    const errorSubmitBtn = document.getElementById('download-model-submit-btn');
                    if (errorSubmitBtn) errorSubmitBtn.disabled = false;
                    const errorSpinner = document.getElementById('download-model-spinner');
                    if (errorSpinner) errorSpinner.style.display = 'none';
                    downloadWs.close();
                    break;
            }
        };

        downloadWs.onclose = () => {
            console.log(`下載 WebSocket (任務 ID: ${taskId}) 已關閉。`);
        };

        downloadWs.onerror = (error) => {
            console.error(`下載 WebSocket (任務 ID: ${taskId}) 發生錯誤:`, error);
            statusDiv.innerHTML = `<div class="alert alert-danger mt-2">進度監聽連線失敗。</div>`;
        };
    }

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

            if (response.ok && result.task_id) {
                statusDiv.innerHTML = `<div class="alert alert-info">${result.message}</div>`;
                form.reset();
                connectDownloadWebSocket(result.task_id, statusDiv);
            } else {
                throw new Error(result.detail || '提交失敗，未收到任務 ID。');
            }
        } catch (error) {
            statusDiv.innerHTML = `<div class="alert alert-danger">錯誤: ${error.message}</div>`;
            submitBtn.disabled = false;
            spinner.style.display = 'none';
        }
    }

    async function fetchDependencyStatus() {
        try {
            const response = await fetchWithUserContext('/api/comfyui/dependency_status');
            if (!response.ok) throw new Error('無法獲取依賴模型狀態');
            dependencyModelsStatus = await response.json();
        } catch (error) {
            console.error('獲取依賴模型狀態失敗:', error);
        }
    }

    async function handleFluxModelSelection(item) {
        let requiredModelKey = null;
        if (item.architecture === 'flux_safetensors') {
            requiredModelKey = 't5xxl_fp16.safetensors';
        } else if (item.architecture === 'flux_gguf') {
            requiredModelKey = 't5xxl_fp8_e4m3fn.safetensors';
        }

        if (requiredModelKey && dependencyModelsStatus[requiredModelKey] && !dependencyModelsStatus[requiredModelKey].exists) {
            const modelInfo = dependencyModelsStatus[requiredModelKey];
            const confirmation = confirm(
                `您選擇的 FLUX 模型需要一個額外的組件：\n\n` +
                `檔案: ${requiredModelKey}\n` +
                `大小: 約 ${modelInfo.size_gb} GB\n\n` +
                `這個組件是 FLUX 正常運作所必需的。您是否同意下載？`
            );

            if (confirmation) {
                await startDependencyDownload(requiredModelKey, item);
            }
        } else {
            await selectModel(item);
        }
    }

    async function startDependencyDownload(modelKey, originalSelectedItem) {
        if (bsModelSelectionModal) bsModelSelectionModal.hide();
        if (bsDependencyDownloadModal) bsDependencyDownloadModal.show();

        const statusDiv = document.getElementById('dependency-download-status');
        const closeBtn = document.getElementById('dependency-download-close-btn');
        if(closeBtn) closeBtn.disabled = true;
        if(statusDiv) statusDiv.innerHTML = '<div class="alert alert-info">正在提交下載請求...</div>';

        try {
            const response = await fetchWithUserContext('/api/comfyui/download_dependency', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model_key: modelKey })
            });

            const result = await response.json();
            if (!response.ok || !result.task_id) {
                throw new Error(result.detail || '提交下載請求失敗');
            }

            const taskId = result.task_id;
            const wsProtocol = activeDeviceUrl.startsWith('https:') ? 'wss:' : 'ws:';
            const wsHost = new URL(activeDeviceUrl).host;
            const wsUrl = `${wsProtocol}//${wsHost}/api/comfyui/ws/status/${taskId}`;
            
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                if(statusDiv) statusDiv.innerHTML = '<div class="alert alert-info">已連接到伺服器，等待下載開始...</div>';
            };

            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                const data = message.data;
                switch (message.type) {
                    case 'progress':
                        const percent = data.progress;
                        const downloadedMB = (data.downloaded / 1024 / 1024).toFixed(2);
                        const totalMB = (data.total / 1024 / 1024).toFixed(2);
                        if(statusDiv) statusDiv.innerHTML = `
                            <div class="progress" style="height: 20px;">
                                <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: ${percent}%;">${percent}%</div>
                            </div>
                            <div class="text-center small mt-1">${downloadedMB} MB / ${totalMB} MB</div>`;
                        break;
                    case 'complete':
                        if(statusDiv) statusDiv.innerHTML = `<div class="alert alert-success">${data.message}</div>`;
                        if(closeBtn) closeBtn.disabled = false;
                        dependencyModelsStatus[modelKey].exists = true;
                        ws.close();
                        setTimeout(async () => {
                            if (bsDependencyDownloadModal) bsDependencyDownloadModal.hide();
                            await selectModel(originalSelectedItem);
                        }, 1500);
                        break;
                    case 'error':
                        if(statusDiv) statusDiv.innerHTML = `<div class="alert alert-danger">錯誤: ${data.message}</div>`;
                        if(closeBtn) closeBtn.disabled = false;
                        ws.close();
                        break;
                }
            };

            ws.onerror = (error) => {
                console.error('依賴模型下載 WebSocket 錯誤:', error);
                if(statusDiv) statusDiv.innerHTML = `<div class="alert alert-danger">無法連接到下載進度伺服器。</div>`;
                if(closeBtn) closeBtn.disabled = false;
            };

        } catch (error) {
            if(statusDiv) statusDiv.innerHTML = `<div class="alert alert-danger">錯誤: ${error.message}</div>`;
            if(closeBtn) closeBtn.disabled = false;
        }
    }

// 中文註釋：initialize函式開始
// 函式功能：應用程式的主初始化函式
    async function initialize() {
        console.log('應用程式已初始化 v18.1');
        
        clientId = getClientId();
        console.log(`客戶端 ID 已設定為: ${clientId}`);

        if ('serviceWorker' in navigator) {
            try {
                serviceWorkerRegistration = await navigator.serviceWorker.register('sw.js');
            } catch (error) {
                console.error('Service Worker 註冊失敗:', error);
            }
        }
        await updateNotificationUI();
        
        if (enableNotificationsBtn) {
            enableNotificationsBtn.addEventListener('click', async () => {
                const currentText = enableNotificationsBtn.textContent.trim();
                
                if (currentText === '禁用通知') {
                    await unsubscribeFromPush();
                } else {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        await subscribeToPush();
                    } else {
                        console.log('使用者拒絕了通知權限。');
                        await updateNotificationUI();
                    }
                }
            });
        }
        
        // [v2.0 核心修正] 呼叫全新的多裝置啟動流程
        await loadSharedConfigAndInitialize();
        
        setInterval(pollQueueStatus, 3000); 
        
        // --- 初始化 Bootstrap Modals ---
        if (modelSelectionModal) bsModelSelectionModal = new bootstrap.Modal(modelSelectionModal);
        if (loraSelectionModal) bsLoraSelectionModal = new bootstrap.Modal(loraSelectionModal);
        if (inpaintCanvasModalEl) bsInpaintCanvasModal = new bootstrap.Modal(inpaintCanvasModalEl);
        if (dependencyDownloadModalEl) bsDependencyDownloadModal = new bootstrap.Modal(dependencyDownloadModalEl);
        const gmLoginModalEl = getById('gm-login-modal');
        if (gmLoginModalEl) bsGmLoginModal = new bootstrap.Modal(gmLoginModalEl);
        if (chatModalEl) bsChatModal = new bootstrap.Modal(chatModalEl);

        // --- 事件監聽器 (與裝置無關的全域監聽) ---

        // 聊天
        if (chatStartBtn) chatStartBtn.addEventListener('click', startChatService);
        if (chatInputForm) chatInputForm.addEventListener('submit', (e) => { e.preventDefault(); sendChatMessage(); });
        if (chatBtnSetup) {
            chatBtnSetup.addEventListener('click', () => {
                const username = prompt('步驟 1/2: 請輸入您的名字：');
                if (!username || !username.trim()) return alert('使用者名稱不能為空。');
                const aiName = prompt('步驟 2/2: 請為您的 AI 戀人取一個名字：');
                if (!aiName || !aiName.trim()) return alert('AI 名稱不能為空。');
                if (chatWs && chatWs.readyState === WebSocket.OPEN) {
                    chatWs.send(`/setup ${username.trim()}|||${aiName.trim()}`);
                }
            });
        }
        if (chatBtnWorldview) chatBtnWorldview.addEventListener('click', () => openChatModal('worldview'));
        if (chatBtnAisettings) chatBtnAisettings.addEventListener('click', () => openChatModal('aisettings'));
        if (chatBtnSystem) chatBtnSystem.addEventListener('click', () => openChatModal('system'));
        if (chatBtnClear) {
            chatBtnClear.addEventListener('click', () => {
                if (confirm('確定要清除所有對話歷史和設定嗎？此操作不可復原！')) {
                    if (chatWs && chatWs.readyState === WebSocket.OPEN) {
                        chatWs.send('/clear_history');
                        chatWindow.innerHTML = ''; // 立即清除前端
                    }
                }
            });
        }
        if (chatModalSaveBtn) chatModalSaveBtn.addEventListener('click', saveChatSettings);

        // GM 登入
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
        
        // ComfyUI 全域控制
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
        
        // [v23.0 修正] 移除對 videoOptimizePositiveCheckbox 和 videoAiOptimizeCheckbox 的事件監聽，因為它們已被刪除
        
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
        
        // [v23.0 修正] 移除對影片生成相關 UI 元素的事件監聽
        
        if (modalCloseBtn) modalCloseBtn.addEventListener('click', () => { if (imageModal) imageModal.style.display = "none"; }); // [v23.0 修正] 移除對 modalVideo 的操作
        if (imageModal) imageModal.addEventListener('click', (e) => { if (e.target === imageModal) { imageModal.style.display = "none";} }); // [v23.0 修正] 移除對 modalVideo 的操作
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

        if (modalDownloadBtn) {
            modalDownloadBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const url = modalDownloadBtn.href;
                const filename = modalDownloadBtn.download;
                if (!url || url.endsWith('#') || !filename) return;

                const originalIconHTML = modalDownloadBtn.innerHTML;
                modalDownloadBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
                modalDownloadBtn.style.pointerEvents = 'none';

                try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`無法獲取檔案: ${response.status} ${response.statusText}`);
                    const blob = await response.blob();
                    const objectUrl = URL.createObjectURL(blob);
                    const tempLink = document.createElement('a');
                    tempLink.href = objectUrl;
                    tempLink.download = filename;
                    document.body.appendChild(tempLink);
                    tempLink.click();
                    document.body.removeChild(tempLink);
                    URL.revokeObjectURL(objectUrl);
                } catch (error) {
                    console.error("下載檔案時發生錯誤:", error);
                    alert(`下載失敗: ${error.message}`);
                } finally {
                    modalDownloadBtn.innerHTML = originalIconHTML;
                    modalDownloadBtn.style.pointerEvents = 'auto';
                }
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
        
        if (modelSelectionModal) {
            modelSelectionModal.addEventListener('show.bs.modal', async () => {
                if (modelSelectionGrid) modelSelectionGrid.innerHTML = '<p class="text-muted">正在刷新模型列表...</p>';
                await fetchAndPopulateCheckpoints();
            });
        }

        if (loraSelectionModal) {
            loraSelectionModal.addEventListener('show.bs.modal', async () => {
                tempSelectedLoras.clear();
                comfyFormElements.loras.forEach(lora => tempSelectedLoras.add(lora.name));
                await updateLoraListForModel(comfyFormElements.model);
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
        
        if (historyBatchDeleteBtn) {
            historyBatchDeleteBtn.addEventListener('click', async () => {
                if (selectedItems.size === 0) return;
                if (confirm(`確定要刪除選中的 ${selectedItems.size} 個項目嗎？`)) {
                    const idsToDelete = Array.from(selectedItems);
                    try {
                        const response = await fetchWithUserContext('/api/comfyui/history/batch-delete', {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({ ids: idsToDelete })
                        });
                        const result = await response.json();
                        if (!response.ok) throw new Error(result.detail || '批次刪除失敗');
                        
                        console.log(result.message);
                        if (result.details && result.details.errors && result.details.errors.length > 0) {
                            alert(`部分項目刪除失敗:\n${result.details.errors.join('\n')}`);
                        }

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

                    } catch (error) {
                         alert(`刪除時發生錯誤: ${error.message}`);
                    }
                }
            });
        }

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
                comfyFormElements.negative_prompt.value = DEFAULT_NEGATIVE_PROMPT_GENERAL;
            });
        }
        
        if (negativePromptSetGuroBtn && comfyFormElements.negative_prompt) {
            negativePromptSetGuroBtn.addEventListener('click', () => {
                comfyFormElements.negative_prompt.value = DEFAULT_NEGATIVE_PROMPT_GURO;
            });
        }

        // [v1.1 新增] 為"精細提示詞"按鈕綁定事件
        if (fixedPromptSetDetailedBtn && comfyFormElements.fixed_prompt) {
            fixedPromptSetDetailedBtn.addEventListener('click', () => {
                comfyFormElements.fixed_prompt.value = DETAILED_FIXED_PROMPT;
            });
        }

        if (fixedPromptSetDefaultBtn && comfyFormElements.fixed_prompt) {
            fixedPromptSetDefaultBtn.addEventListener('click', () => {
                comfyFormElements.fixed_prompt.value = DEFAULT_FIXED_PROMPT;
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

        if (drawMaskBtn) {
            drawMaskBtn.addEventListener('click', () => {
                if (img2imgState.source_image_data && bsInpaintCanvasModal) {
                    bsInpaintCanvasModal.show();
                } else {
                    alert('請先上傳一張以圖生圖的來源圖片。');
                }
            });
        }

        if (inpaintCanvasModalEl) {
            inpaintCanvasModalEl.addEventListener('shown.bs.modal', () => {
                if (img2imgState.source_image_data) {
                    initializeInpaintCanvas(img2imgState.source_image_data);
                }
            });
        }

        if (inpaintCanvas) {
            inpaintCtx = inpaintCanvas.getContext('2d');
            inpaintCtx.fillStyle = 'rgba(255, 255, 255, 1)';

            const startDrawing = (e) => {
                isDrawing = true;
                let pos;
                if (e.touches && e.touches[0]) {
                    pos = getTouchPos(inpaintCanvas, e.touches[0]);
                } else {
                    pos = getMousePos(inpaintCanvas, e);
                }
                [lastX, lastY] = [pos.x, pos.y];

                inpaintCtx.beginPath();
                inpaintCtx.arc(lastX, lastY, brushSize / 2, 0, Math.PI * 2);
                inpaintCtx.fill();
            };
            const stopDrawing = () => isDrawing = false;

            inpaintCanvas.addEventListener('mousedown', startDrawing);
            inpaintCanvas.addEventListener('mousemove', drawOnCanvas);
            inpaintCanvas.addEventListener('mouseup', stopDrawing);
            inpaintCanvas.addEventListener('mouseleave', stopDrawing);
            inpaintCanvas.addEventListener('touchstart', startDrawing, { passive: false });
            inpaintCanvas.addEventListener('touchmove', drawOnCanvas, { passive: false });
            inpaintCanvas.addEventListener('touchend', stopDrawing);
        }

        if (inpaintBrushSizeSlider) {
            inpaintBrushSizeSlider.addEventListener('input', (e) => {
                brushSize = e.target.value;
                if (inpaintBrushSizeLabel) inpaintBrushSizeLabel.textContent = brushSize;
            });
            brushSize = inpaintBrushSizeSlider.value;
            if (inpaintBrushSizeLabel) inpaintBrushSizeLabel.textContent = brushSize;
        }

        if (inpaintClearCanvasBtn) {
            inpaintClearCanvasBtn.addEventListener('click', () => {
                if (inpaintCtx) {
                    inpaintCtx.clearRect(0, 0, inpaintCanvas.width, inpaintCanvas.height);
                    initializeInpaintCanvas(img2imgState.source_image_data);
                }
            });
        }

        if (inpaintSaveMaskBtn) {
            inpaintSaveMaskBtn.addEventListener('click', generateMaskAndUpload);
        }
    }
// 中文註釋：initialize函式結束
    
    try {
        await initialize();
        console.log('初始化完成');
    } catch (error) {
        console.error('初始化過程中發生錯誤:', error);
    }
});

function isQwenModel(modelName) {
    return modelName.toLowerCase().includes('qwen') || modelName.toLowerCase().includes('diffusion_models/qwen');
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
                if (filter === 'sdxl' && modelName.includes('pony')) return true;
                if (filter === 'qwen' && modelName.includes('qwen')) return true;
                return false;
            });
        }
        card.style.display = show ? 'block' : 'none';
    });
}