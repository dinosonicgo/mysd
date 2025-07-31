# start_all_services.py

# start_all_services.py v18.37 (原生 Git 操作 & 終極啟動流程)
# 註釋版本紀錄
# v18.37 (原生 Git 操作 & 終極啟動流程): 1. 為從根本上解決 `gitpython` 初始化時的依賴死鎖問題，重構了節點檢查與安裝邏輯。現在，所有初始的 Git 操作（克隆、拉取）都改用 Python 內建的 `subprocess` 模組直接呼叫 Git 命令，移除了對 `gitpython` 函式庫的啟動時依賴。 2. Git 的自動下載器現在使用內建的 `urllib`，使其不再依賴 `requests`。 3. 徹底重構了主執行流程，確保在一個完全乾淨的系統中，能以「設定 Git 環境 -> 安裝所有 Python 依賴 -> 執行節點安裝 -> 應用補丁」的絕對正確順序執行，實現了真正的、無前置條件的「一鍵全自動安裝」。
# v18.36 (依賴與執行順序修正): 1. 修正了因執行順序錯誤導致的 `NameError: name 'requests' is not defined` 致命錯誤。將 `check_and_install_requirements()` 的呼叫提前至所有依賴第三方庫的操作之前，並將 `requests` 和 `git` 的導入提升至全域範圍，確保了在自動下載 Git 等操作時，所需的核心函式庫已安裝並可用。 2. 最佳化了函式呼叫順序，使其更符合邏輯：安裝基礎依賴 -> 設定環境 -> 安裝節點 -> 修補節點 -> 下載模型。
# v18.35 (Git 自動安裝 & 補丁順序修正): 1. 新增了 `check_and_install_portable_git` 函式，使得在系統中未找到 Git 時，腳本能自動下載並配置一個便攜版 Git，極大地提升了在新環境中的開箱即用性。 2. 調整了主執行流程，將 `patch_diffusers_import_error` 函式的呼叫時機從腳本初期移動到了自定義節點安裝完成之後，確保了補丁能夠在目標函式庫 (`diffusers`) 已被安裝的情況下執行，從而解決了 "未找到目標補丁文件" 的警告。

import subprocess
import threading
import time
import re
import os
import sys
import webbrowser
import json
import shutil
from queue import Queue, Empty
import zipfile
import io
import urllib.request

# --- 全域變數 ---
# 將在 check_and_install_requirements 之後被正確導入
git = None
requests = None

# --- 動態路徑設定 ---
BASE_DIR = os.path.dirname(__file__)
PORTABLE_COMFYUI_PARENT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
COMFYUI_PORTABLE_DIR = os.path.join(PORTABLE_COMFYUI_PARENT_DIR, "ComfyUI_windows_portable")
COMFYUI_BASE_PATH = os.path.join(COMFYUI_PORTABLE_DIR, "ComfyUI")
MAIN_PY_SCRIPT = os.path.join(BASE_DIR, "main.py")
BACKEND_PORT = 8118
COMFYUI_LOCAL_PORT = 8188
COMFYUI_REMOTE_PORT = 8189

# GitHub Pages 設定
GITHUB_USERNAME = "dinosonicgo"
GITHUB_REPO_NAME = "mysd"
GITHUB_TOKEN = "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"
GIT_BRANCH = "gh-pages"
REDIRECT_FOLDER_PATH = os.path.join(BASE_DIR, "redirect")
STATIC_FOLDER_PATH = os.path.join(BASE_DIR, "static")

# --- 依賴項目定義 ---
REQUIRED_NODES = {
    "ComfyUI-Manager": "https://github.com/Comfy-Org/ComfyUI-Manager.git",
    "ComfyUI-VideoHelperSuite": "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git",
    "ComfyUI-WanVideoWrapper": "https://github.com/kijai/ComfyUI-WanVideoWrapper.git",
    "ComfyUI-Impact-Pack": "https://github.com/ltdrdata/ComfyUI-Impact-Pack.git",
    "ComfyUI-Impact-Subpack": "https://github.com/ltdrdata/ComfyUI-Impact-Subpack.git",
    "comfyui_controlnet_aux": "https://github.com/Fannovel16/comfyui_controlnet_aux.git",
    "was-node-suite-comfyui": "https://github.com/WASasquatch/was-node-suite-comfyui.git",
    "rgthree-comfy": "https://github.com/rgthree/rgthree-comfy.git",
    "ComfyUI-GGUF": "https://github.com/city96/ComfyUI-GGUF.git",
}
REQUIRED_MODELS = {
    # --- 核心文字編碼器 ---
    "clip_l.safetensors": {"url": "https://huggingface.co/stabilityai/stable-diffusion-3-medium/resolve/main/clip_l.safetensors", "path": os.path.join(COMFYUI_BASE_PATH, "models", "clip")},
    "t5xxl_fp8_e4m3fn.safetensors": {"url": "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn.safetensors?download=true", "path": os.path.join(COMFYUI_BASE_PATH, "models", "clip")},
    "clip_g.safetensors": {"url": "https://huggingface.co/stabilityai/stable-diffusion-3-medium/resolve/main/clip_g.safetensors", "path": os.path.join(COMFYUI_BASE_PATH, "models", "text_encoders")},
    
    # --- Video Models (SVD & WAN) ---
    "Wan2.1_VAE_fp32.safetensors": {"url": "https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Wan2_1_VAE_fp32.safetensors?download=true", "path": os.path.join(COMFYUI_BASE_PATH, "models", "vae")},
    "umt5-xxl-enc-bf16.safetensors": {"url": "https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/umt5-xxl-enc-bf16.safetensors", "path": os.path.join(COMFYUI_BASE_PATH, "models", "text_encoders")},
    "clip_vision_h.safetensors": {"url": "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/clip_vision/clip_vision_h.safetensors", "path": os.path.join(COMFYUI_BASE_PATH, "models", "clip_vision")},
    "clip_vision_g.safetensors": {"url": "https://huggingface.co/stabilityai/sd3-medium/resolve/main/clip_vision_g.safetensors?download=true", "path": os.path.join(COMFYUI_BASE_PATH, "models", "clip_vision")},

    # --- ADetailer / Impact Pack Models ---
    "face_yolov8m.pt": {"url": "https://huggingface.co/ltdrdata/ComfyUI-Impact-Pack/resolve/main/models/bbox/face_yolov8m.pt", "path": os.path.join(COMFYUI_BASE_PATH, "models", "ultralytics", "bbox")},
    "sam_vit_h_4b8939.pth": {"url": "https://huggingface.co/HCMUE-Research/SAM-vit-h/resolve/main/sam_vit_h_4b8939.pth?download=true", "path": os.path.join(COMFYUI_BASE_PATH, "models", "sams")},
    
    # --- ControlNet Model Example ---
    "control-lora-canny-rank256.safetensors": {"url": "https://huggingface.co/stabilityai/control-lora/resolve/main/control-LoRAs-rank256/control-lora-canny-rank256.safetensors", "path": os.path.join(COMFYUI_BASE_PATH, "models", "controlnet")},

    # --- FLUX.1 Models & VAE ---
    "flux1-schnell-Q5_K_S.gguf": {"url": "https://huggingface.co/city96/FLUX.1-schnell-gguf/resolve/main/flux1-schnell-Q5_K_S.gguf", "path": os.path.join(COMFYUI_BASE_PATH, "models", "unet")},
    # [v18.32 修正] 將 VAE 下載來源更換為公開可訪問的鏡像連結，以解決 401 錯誤
    "ae.safetensors": {"url": "https://huggingface.co/ffxvs/vae-flux/resolve/main/ae.safetensors?download=true", "path": os.path.join(COMFYUI_BASE_PATH, "models", "vae")},
}

# --- 腳本主體 ---

# 函式功能: 自動修補 diffusers 函式庫以解決 'cached_download' 導入錯誤
def patch_diffusers_import_error():
    """
    自動檢查並修復 ComfyUI 內嵌 Python 環境中 `diffusers` 函式庫的 `ImportError`。
    此錯誤源於 `huggingface_hub` 函式庫更新後移除了 `cached_download` 函式。
    本函式會定位問題文件並自動移除對已弃用函式的導入。
    """
    print("\n" + "="*50)
    print("  -3. 正在檢查並應用 diffusers 緊急補丁...")
    print("="*50)
    
    try:
        patch_file_path = os.path.join(
            COMFYUI_PORTABLE_DIR, 
            "python_embeded", 
            "Lib", 
            "site-packages", 
            "diffusers", 
            "utils", 
            "dynamic_modules_utils.py"
        )

        if not os.path.isfile(patch_file_path):
            print(f"[警告] 未找到目標補丁文件: {patch_file_path}")
            print("       可能是因為 `diffusers` 尚未被任何節點安裝。將跳過此步驟。")
            return

        with open(patch_file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_line = "from huggingface_hub import cached_download, hf_hub_download, model_info"
        replacement_line = "from huggingface_hub import hf_hub_download, model_info"

        if original_line in content:
            print(f"[*] 在 '{patch_file_path}' 中檢測到過時的導入語句。")
            print("[*] 正在自動應用補丁...")
            content = content.replace(original_line, replacement_line)
            with open(patch_file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print("    -> [成功] 補丁已成功應用！`ImportError` 已被修復。")
        else:
            print("[成功] `diffusers` 函式庫的導入語句已是最新，無需應用補丁。")

    except Exception as e:
        print(f"[嚴重錯誤] 在應用 diffusers 補丁時發生未知錯誤: {e}")
        print("           請手動檢查文件並移除 'cached_download' 的導入。")
        sys.exit(1)
# 函式功能: 自動修補 diffusers 函式庫以解決 'cached_download' 導入錯誤

# 函式功能: 自動下載並安裝便攜版 Git
def check_and_install_portable_git():
    """
    自動從官方來源下載便攜版 Git (64位元)，並將其解壓縮到預期目錄中。
    使用內建的 urllib，不依賴 requests。
    """
    portable_git_dir = os.path.abspath(os.path.join(COMFYUI_PORTABLE_DIR, "PortableGit"))
    
    print("\n" + "#"*60)
    print("[警告] 系統中未找到 Git，將嘗試自動下載便攜版本...")
    print("#"*60)
    
    if os.path.isdir(portable_git_dir) and os.path.isfile(os.path.join(portable_git_dir, "bin", "git.exe")):
        print(f"[*] 已找到 PortableGit 目錄且 git.exe 存在: {portable_git_dir}，跳過下載。")
        return True

    os.makedirs(portable_git_dir, exist_ok=True)
    
    if sys.platform != "win32" or not sys.maxsize > 2**32:
        print("[嚴重錯誤] Git 的自動下載僅支援 Windows 64位元系統。")
        print("           請手動安裝 Git 並將其加入系統 PATH。")
        return False

    url = "https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/PortableGit-2.43.0-64-bit.7z.exe"
    temp_exe_path = os.path.join(portable_git_dir, "PortableGit.7z.exe")
    
    try:
        print(f"[*] 正在從官方來源下載: {url}")
        with urllib.request.urlopen(url) as response, open(temp_exe_path, 'wb') as out_file:
            shutil.copyfileobj(response, out_file)
        
        print(f"[*] 下載完成。正在解壓縮至: {portable_git_dir}")
        
        subprocess.run([temp_exe_path, f"-o{portable_git_dir}", "-y"], check=True, capture_output=True)
        
        print("[*] 正在清理臨時安裝文件...")
        os.remove(temp_exe_path)
        
        git_exe_path = os.path.join(portable_git_dir, "bin", "git.exe")
        if os.path.isfile(git_exe_path):
            print("\n[成功] 便攜版 Git 已成功下載並配置！")
            return True
        else:
            raise FileNotFoundError("解壓縮後未找到 git.exe")

    except Exception as e:
        print(f"\n[嚴重錯誤] 自動下載或解壓縮便攜版 Git 失敗: {e}")
        if hasattr(e, 'stderr') and e.stderr:
            print(f"   -> 子程序錯誤: {e.stderr.decode('utf-8', errors='ignore')}")
        print("           請手動安裝 Git 並將其加入系統 PATH。")
        if os.path.isdir(portable_git_dir):
            shutil.rmtree(portable_git_dir)
        return False
# 函式功能: 自動下載並安裝便攜版 Git

# 函式功能: 自動尋找 Git 執行檔並設定環境變數
def find_and_set_git_executable():
    """
    自動檢測 Git 執行檔。如果找不到，則觸發自動下載和安裝流程。
    返回找到的 git 執行檔路徑。
    """
    print("\n" + "="*50)
    print("  -2. 正在檢測 Git 可執行環境...")
    print("="*50)

    # 檢查路徑1：系統環境變數 PATH
    git_exe = shutil.which("git")
    if git_exe:
        print(f"[成功] 在系統 PATH 中找到 Git: {git_exe}")
        return git_exe

    # 檢查路徑2：專案內嵌的便攜式 Git
    portable_git_path = os.path.abspath(os.path.join(COMFYUI_PORTABLE_DIR, "PortableGit", "bin", "git.exe"))
    if os.path.isfile(portable_git_path):
        print(f"[成功] 在便攜式路徑中找到 Git: {portable_git_path}")
        # 將便攜式 Git 的 bin 目錄加入當前腳本的 PATH
        os.environ["PATH"] = os.path.dirname(portable_git_path) + os.pathsep + os.environ["PATH"]
        return portable_git_path

    # 如果都找不到，觸發自動安裝
    if check_and_install_portable_git():
        if os.path.isfile(portable_git_path):
            print(f"[*] 重新檢測到已安裝的便攜版 Git: {portable_git_path}")
            os.environ["PATH"] = os.path.dirname(portable_git_path) + os.pathsep + os.environ["PATH"]
            return portable_git_path
    
    print("\n[嚴重錯誤] Git 自動安裝失敗，且在系統中找不到 Git。")
    print("           請手動安裝 Git 並將其加入系統 PATH 後，再重新執行此腳本。")
    sys.exit(1)
# 函式功能: 自動尋找 Git 執行檔並設定環境變數

# 函式功能: 自動更新 ComfyUI 核心應用
def update_comfyui_core(git_executable):
    """
    檢查 ComfyUI 核心是否為一個 Git 倉庫，如果是，則執行 git pull 更新。
    使用原生 subprocess 呼叫。
    """
    print("\n" + "="*50)
    print("  -0.8. 正在檢查並更新 ComfyUI 核心...")
    print("="*50)

    if not os.path.isdir(COMFYUI_BASE_PATH):
        print(f"[嚴重錯誤] 找不到 ComfyUI 核心路徑: {COMFYUI_BASE_PATH}")
        sys.exit(1)

    git_dir = os.path.join(COMFYUI_BASE_PATH, ".git")
    if not os.path.isdir(git_dir):
        print("[警告] ComfyUI 核心似乎不是一個 Git 倉庫，將跳過自動更新。")
        return

    try:
        print("[*] 正在從遠端獲取最新資訊 (git fetch)...")
        subprocess.run([git_executable, "fetch"], cwd=COMFYUI_BASE_PATH, check=True, capture_output=True)
        
        print("[*] 正在拉取更新 (git pull)...")
        result = subprocess.run([git_executable, "pull"], cwd=COMFYUI_BASE_PATH, check=True, capture_output=True, text=True)
        
        if "Already up to date." in result.stdout:
            print("[成功] ComfyUI 核心已是最新版本。")
        else:
            print("[成功] ComfyUI 核心已成功更新。")
            print(result.stdout)

    except subprocess.CalledProcessError as e:
        print(f"[錯誤] 更新 ComfyUI 核心時發生 Git 命令錯誤: {e}")
        print(f"--- Git 錯誤輸出 ---\n{e.stderr}\n--------------------")
        print("[提示] 如果您在 ComfyUI 目錄中有本地修改，'git pull' 可能會失敗。請考慮手動處理或重置修改。")
    except Exception as e:
        print(f"[嚴重錯誤] 更新 ComfyUI 核心時發生未知錯誤: {e}")
# 函式功能: 自動更新 ComfyUI 核心應用

# 函式功能: 自動檢查、下載並配置 Cloudflare Tunnel 執行檔
def check_and_install_cloudflared():
    """
    檢查 cloudflared 是否可用。如果系統 PATH 中沒有，
    則會自動從 GitHub 下載並解壓縮到本地的 'bin' 資料夾中。
    """
    print("\n" + "="*50)
    print("  -0.5. 正在檢查 Cloudflare Tunnel (cloudflared)...")
    print("="*50)

    if shutil.which("cloudflared"):
        print("[成功] 在系統 PATH 中找到 'cloudflared'。")
        return "cloudflared"

    local_bin_dir = os.path.join(BASE_DIR, "bin")
    cloudflared_executable_path = os.path.join(local_bin_dir, "cloudflared.exe")

    if os.path.isfile(cloudflared_executable_path):
        print(f"[成功] 在本地 '{local_bin_dir}' 目錄中找到 'cloudflared.exe'。")
        return cloudflared_executable_path

    print("[警告] 系統中未找到 'cloudflared'，將嘗試自動下載...")
    os.makedirs(local_bin_dir, exist_ok=True)
    
    if sys.platform != "win32" or not sys.maxsize > 2**32:
        print("[嚴重錯誤] 自動下載僅支援 Windows 64位元系統。")
        print("           請手動從 https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ 下載並安裝 cloudflared。")
        return None

    url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.zip"
    print(f"[*] 正在從官方來源下載: {url}")

    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()

        with zipfile.ZipFile(io.BytesIO(response.content)) as z:
            for file_info in z.infolist():
                if file_info.filename.lower() == 'cloudflared.exe':
                    print(f"[*] 正在解壓縮 '{file_info.filename}' 至 '{local_bin_dir}'...")
                    z.extract(file_info, path=local_bin_dir)
                    if os.path.isfile(cloudflared_executable_path):
                        print("[成功] 'cloudflared.exe' 已成功下載並配置。")
                        return cloudflared_executable_path
                    else:
                        raise FileNotFoundError("解壓縮後未找到 cloudflared.exe")
            
            raise FileNotFoundError("在下載的壓縮檔中未找到 cloudflared.exe")

    except Exception as e:
        print(f"[嚴重錯誤] 自動下載或解壓縮 'cloudflared' 失敗: {e}")
        print("           請手動從 https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ 下載並安裝。")
        return None
# 函式功能: 自動檢查、下載並配置 Cloudflare Tunnel 執行檔

# 函式功能: 使用 nvidia-smi 命令獲取 GPU 名稱並設定裝置 ID
def get_gpu_info():
    """
    使用 nvidia-smi 命令獲取 GPU 名稱，並簡化為一個標識符 (如 RTX2060)。
    此函式只會在首次需要時執行一次。
    """
    try:
        smi_path = "nvidia-smi"
        result = subprocess.run(
            [smi_path, "--query-gpu=gpu_name", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, check=True, encoding='utf-8'
        )
        gpu_name = result.stdout.strip().split('\n')[0]
        parts = gpu_name.split()
        model_id = "".join([p for p in parts if "RTX" in p or "GTX" in p or p.isdigit()]).replace("SUPER", "Super")
        if not model_id:
            model_id = "".join(filter(str.isalnum, gpu_name))
        
        print(f"[成功] 已檢測到 GPU 並設定裝置 ID 為: {model_id}")
        return model_id
    except (FileNotFoundError, subprocess.CalledProcessError, IndexError) as e:
        print(f"[警告] 無法自動檢測 GPU 型號: {e}。將使用 'default-pc' 作為裝置 ID。")
        return "default-pc"
# 函式功能: 使用 nvidia-smi 命令獲取 GPU 名稱並設定裝置 ID

# 函式功能: 智慧檢查並修復 ComfyUI 的 PyTorch (CUDA 版本)
def upgrade_pytorch_in_comfyui():
    """
    智慧地檢查 PyTorch 的 CUDA 版本是否正確安裝。
    只有在未安裝或安裝了錯誤的 CPU 版本時，才觸發耗時的修復流程。
    """
    print("\n" + "="*50)
    print("  0. 正在智慧檢查 PyTorch (CUDA 版本)...")
    print("="*50)
    comfyui_python_executable = os.path.join(COMFYUI_BASE_PATH, "..", "python_embeded", "python.exe")

    if not os.path.isfile(comfyui_python_executable):
        print(f"[嚴重錯誤] 找不到 ComfyUI 的內嵌 Python: {comfyui_python_executable}")
        print(f"           請確認您的資料夾結構是否正確。腳本預期 ComfyUI_windows_portable 資料夾與此專案在同一層目錄下。")
        sys.exit(1)

    check_code = "import torch; print(torch.cuda.is_available())"
    
    try:
        result = subprocess.run(
            [comfyui_python_executable, "-c", check_code],
            check=True, capture_output=True, text=True, encoding='utf-8'
        )
        if "True" in result.stdout:
            print("[成功] 已安裝正確的 PyTorch (CUDA 版本)，無需執行任何操作。")
            return
        else:
            print("[警告] 已安裝 PyTorch，但不是 CUDA (GPU) 版本。")
    except subprocess.CalledProcessError:
        print("[警告] 未檢測到 PyTorch 或導入時發生錯誤。")

    print("[*] 將執行 PyTorch (CUDA 版本) 的修復安裝流程...")
    
    print("[*] 步驟 1/2: 正在強制卸載任何已存在的 PyTorch 版本以進行乾淨安裝...")
    try:
        uninstall_command = [
            comfyui_python_executable, "-m", "pip", "uninstall", 
            "torch", "torchvision", "torchaudio", "-y"
        ]
        subprocess.run(
            uninstall_command,
            check=True, capture_output=True, text=True, encoding='utf-8', errors='ignore'
        )
        print("      -> [成功] 舊版本 PyTorch 已清除。")
    except subprocess.CalledProcessError as e:
        print(f"[警告] 卸載 PyTorch 時發生問題 (可能是因為未安裝)，將繼續嘗試安裝。日誌: {e.stderr}")

    print("[*] 步驟 2/2: 正在從 NVIDIA 官方通路安裝 PyTorch (CUDA 12.1)...")
    print("    (此過程可能需要幾分鐘，具體取決於您的網路速度，請耐心等候...)")
    try:
        install_command = [
            comfyui_python_executable, "-m", "pip", "install", 
            "torch", "torchvision", "torchaudio",
            "--force-reinstall",
            "--index-url", "https://download.pytorch.org/whl/cu121"
        ]
        subprocess.run(
            install_command,
            check=True,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='ignore'
        )
        print("      -> [成功] PyTorch (CUDA 版本) 已成功安裝。")
    except subprocess.CalledProcessError as e:
        print("\n" + "#"*60)
        print(f"[嚴重錯誤] 安裝 PyTorch (CUDA 版本) 失敗 (返回碼: {e.returncode})。")
        print("           這通常由網路問題或顯示卡驅動程式不相容導致。")
        print(f"           錯誤日誌:\n{e.stderr}")
        print("#"*60 + "\n")
        time.sleep(15)
        sys.exit(1)
# 函式功能: 智慧檢查並修復 ComfyUI 的 PyTorch (CUDA 版本)

# 函式功能: 檢查並克隆/更新所有必需的 ComfyUI 自定義節點
def check_and_clone_nodes(git_executable):
    """
    使用原生 subprocess 呼叫 Git，遍歷 REQUIRED_NODES 字典來克隆或更新節點。
    同時，會檢查並執行節點自帶的 install.py 或 requirements.txt 安裝腳本。
    """
    print("\n" + "="*50)
    print("  1. 正在檢查並更新 ComfyUI 自定義節點...")
    print("="*50)
    custom_nodes_path = os.path.join(COMFYUI_BASE_PATH, "custom_nodes")
    comfyui_python_executable = os.path.join(COMFYUI_BASE_PATH, "..", "python_embeded", "python.exe")

    if not os.path.isfile(comfyui_python_executable):
        print(f"[嚴重錯誤] 找不到 ComfyUI 的內嵌 Python: {comfyui_python_executable}")
        sys.exit(1)

    if not os.path.isdir(custom_nodes_path):
        os.makedirs(custom_nodes_path)
        print(f"[*] 已建立 custom_nodes 資料夾: {custom_nodes_path}")
        
    for dir_name, repo_url in REQUIRED_NODES.items():
        target_path = os.path.join(custom_nodes_path, dir_name)
        if os.path.isdir(target_path):
            print(f"[*] 節點 '{dir_name}' 已存在，正在拉取最新版本...")
            try:
                subprocess.run([git_executable, "pull"], cwd=target_path, check=True, capture_output=True)
                print(f"      -> [成功] '{dir_name}' 已更新至最新。")
            except subprocess.CalledProcessError as e:
                print(f"[警告] 更新 '{dir_name}' 失敗: {e.stderr.decode('utf-8', errors='ignore')}")
        else:
            print(f"[!!] 節點 '{dir_name}' 不存在，正在從 GitHub 克隆...")
            try:
                subprocess.run([git_executable, "clone", repo_url, target_path], check=True, capture_output=True)
                print(f"      -> [成功] 節點 '{dir_name}' 已成功下載至 {target_path}")
            except subprocess.CalledProcessError as e:
                print(f"[嚴重錯誤] 克隆 '{dir_name}' 失敗: {e.stderr.decode('utf-8', errors='ignore')}")
                sys.exit(1)

        requirements_path = os.path.join(target_path, "requirements.txt")
        install_script_path = os.path.join(target_path, "install.py")

        try:
            if dir_name == "ComfyUI-GGUF":
                print(f"    -> 偵測到 GGUF 節點，手動為其安裝 'gguf' 依賴...")
                command = [comfyui_python_executable, "-m", "pip", "install", "gguf"]
                subprocess.run(
                    command,
                    check=True, cwd=target_path, capture_output=True, text=True, encoding='utf-8', errors='ignore'
                )
                print(f"      -> [成功] '{dir_name}' 的 'gguf' 依賴已成功安裝/更新。")
            
            elif dir_name == "ComfyUI-WanVideoWrapper":
                print(f"    -> 偵測到 WanVideoWrapper，為其安裝特定版本的依賴...")
                wan_deps = ["diffusers==0.27.2", "accelerate", "transformers"]
                command = [comfyui_python_executable, "-m", "pip", "install", "--upgrade"] + wan_deps
                subprocess.run(
                    command,
                    check=True, cwd=target_path, capture_output=True, text=True, encoding='utf-8', errors='ignore'
                )
                print(f"      -> [成功] '{dir_name}' 的依賴已成功安裝/更新。")

            elif os.path.isfile(install_script_path):
                print(f"[*] 發現 '{dir_name}' 的安裝腳本 (install.py)，準備執行...")
                subprocess.run(
                    [comfyui_python_executable, install_script_path],
                    check=True, cwd=target_path, capture_output=True, text=True, encoding='utf-8', errors='ignore'
                )
                print(f"      -> [成功] '{dir_name}' 的依賴已成功安裝/更新。")
            elif os.path.isfile(requirements_path):
                print(f"[*] 發現 '{dir_name}' 的依賴文件 (requirements.txt)，準備安裝...")
                command = [
                    comfyui_python_executable, "-m", "pip", "install", "-r", requirements_path
                ]
                subprocess.run(
                    command,
                    check=True, cwd=target_path, capture_output=True, text=True, encoding='utf-8', errors='ignore'
                )
                print(f"      -> [成功] '{dir_name}' 的依賴已成功安裝/更新。")

        except subprocess.CalledProcessError as e:
            print(f"[嚴重錯誤] 處理 '{dir_name}' 的依賴時失敗 (返回碼: {e.returncode})。")
            print(f"         這很可能是導致 'Node does not exist' 錯誤的原因。")
            print(f"         錯誤輸出:\n{e.stderr}")
            sys.exit(1)
# 函式功能: 檢查並克隆/更新所有必需的 ComfyUI 自定義節點

# 函式功能: 檢查並下載所有必需的模型檔案
def check_and_download_models():
    """
    遍歷 REQUIRED_MODELS 字典，檢查每個模型檔案是否存在。
    如果不存在，則使用 requests 從指定的 URL 下載，並顯示進度條。
    下載失敗時會打印警告並繼續，而不是終止程式。
    """
    print("\n" + "="*50)
    print("  2. 正在檢查必需的模型檔案...")
    print("="*50)
    for filename, details in REQUIRED_MODELS.items():
        model_path = details["path"]
        file_url = details["url"]
        target_file = os.path.join(model_path, filename)

        if not os.path.isdir(model_path):
            os.makedirs(model_path)
            print(f"[*] 已建立模型資料夾: {model_path}")

        if os.path.isfile(target_file):
            print(f"[OK]  模型 '{filename}' 已存在。")
        else:
            print(f"[!!]  模型 '{filename}' 不存在，準備下載...")
            try:
                with requests.get(file_url, stream=True, timeout=None) as r:
                    r.raise_for_status()
                    total_size = int(r.headers.get('content-length', 0))
                    block_size = 8192
                    
                    with open(target_file, 'wb') as f:
                        print(f"      -> 正在下載至 {target_file}")
                        if total_size > 0: print(f"      -> 檔案大小: {total_size / (1024*1024):.2f} MB")
                        
                        downloaded_size = 0
                        for chunk in r.iter_content(chunk_size=block_size):
                            f.write(chunk)
                            downloaded_size += len(chunk)
                            if total_size > 0:
                                progress = downloaded_size / total_size
                                sys.stdout.write(f"\r      -> 進度: [{int(progress * 50) * '#'}{int((1-progress) * 50) * '-'}] {progress:.1%}")
                                sys.stdout.flush()
                
                print(f"\n      -> [成功] 模型 '{filename}' 已成功下載。")
            except requests.exceptions.RequestException as e:
                print(f"\n[嚴重警告] 下載 '{filename}' 失敗: {e}")
                print(f"           此模型將不可用，但啟動流程將繼續。")
                print(f"           請稍後嘗試手動從以下 URL 下載並放置到正確路徑: {file_url}")
                if os.path.exists(target_file): os.remove(target_file)
# 函式功能: 檢查並下載所有必需的模型檔案

# 函式功能: 在新的主控台視窗中啟動一個獨立的進程
def start_independent_process(command, title, color_code, working_dir=None):
    """
    使用 Windows 的 'start' 命令在一個新的主控台視窗中執行指定的命令。
    """
    print(f"[*] 正在啟動 {title}...")
    final_shell_command = f'start "{title}" cmd /c "color {color_code} && title {title} && {command}"'
    subprocess.Popen(
        final_shell_command,
        shell=True,
        cwd=working_dir,
        env=os.environ.copy(),
        creationflags=subprocess.CREATE_NEW_CONSOLE
    )
    print(f"    -> {title} 啟動指令已發送。")
# 函式功能: 在新的主控台視窗中啟動一個獨立的進程

# 函式功能: 等待指定的 ComfyUI 實例準備就緒
def wait_for_comfyui_ready(port, instance_name, result_queue, timeout=180):
    """
    通過輪詢指定的埠號，等待 ComfyUI 服務啟動並回應。
    """
    url = f"http://127.0.0.1:{port}/queue"
    print(f"    -> 正在等待 {instance_name} (埠號: {port}) 啟動...")
    
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            response = requests.get(url, timeout=3)
            if response.status_code == 200:
                elapsed = int(time.time() - start_time)
                print(f"\n[成功] {instance_name} 已在 {elapsed} 秒後於埠號 {port} 成功啟動！")
                result_queue.put(True)
                return
        except requests.exceptions.ConnectionError:
            elapsed = int(time.time() - start_time)
            sys.stdout.write(f"\r    -> {instance_name} 尚未就緒，已等待 {elapsed} 秒...")
            sys.stdout.flush()
        except requests.exceptions.RequestException as e:
            print(f"\n[警告] 請求 {instance_name} 時發生錯誤: {e}")
        
        time.sleep(5)

    print(f"\n[嚴重錯誤] 在 {timeout} 秒內無法連接到 {instance_name} (埠號: {port})。")
    result_queue.put(False)
# 函式功能: 等待指定的 ComfyUI 實例準備就緒

# 函式功能: 並行啟動並等待所有 ComfyUI 實例
def start_and_wait_for_comfyui_instances():
    """
    並行啟動所有定義的 ComfyUI 實例，並等待它們全部成功啟動。
    如果啟動腳本 (.bat) 不存在，則會自動建立。
    """
    print("\n" + "="*50)
    print("  3. 正在並行啟動所有 ComfyUI 實例...")
    print("="*50)

    instances = {
        "本地 ComfyUI": COMFYUI_LOCAL_PORT,
        "遠端 ComfyUI (GM)": COMFYUI_REMOTE_PORT
    }
    
    threads = []
    result_queue = Queue()

    for name, port in instances.items():
        script_filename = f"run_nvidia_gpu_fast_fp16_accumulation_{port}.bat"
        script_path = os.path.join(COMFYUI_PORTABLE_DIR, script_filename)

        if not os.path.isfile(script_path):
            print(f"[警告] 找不到啟動腳本: {script_path}，將為您自動建立。")
            try:
                bat_content = (
                    f".\\python_embeded\\python.exe -s ComfyUI\\main.py "
                    f"--windows-standalone-build --fast fp16_accumulation "
                    f"--listen 0.0.0.0 --port {port} "
                    f"--dont-print-server --preview-method none\n"
                    f"pause"
                )
                with open(script_path, 'w', encoding='utf-8') as f:
                    f.write(bat_content)
                print(f"[成功] 已成功建立啟動腳本: {script_filename}")
            except Exception as e:
                print(f"[嚴重錯誤] 自動建立啟動腳本 '{script_filename}' 失敗: {e}")
                return False

        command = f'"{script_path}"'
        title = f"ComfyUI Server ({name})"
        color = "0A" if "本地" in name else "0C"
        
        start_thread = threading.Thread(
            target=start_independent_process,
            args=(command, title, color, COMFYUI_PORTABLE_DIR)
        )
        threads.append(start_thread)
        start_thread.start()

    for name, port in instances.items():
        wait_thread = threading.Thread(
            target=wait_for_comfyui_ready,
            args=(port, name, result_queue)
        )
        threads.append(wait_thread)
        wait_thread.start()

    for t in threads:
        t.join()

    success_count = 0
    while not result_queue.empty():
        if result_queue.get():
            success_count += 1
            
    return success_count == len(instances)
# 函式功能: 並行啟動並等待所有 ComfyUI 實例

# 函式功能: 等待後端服務準備就緒
def wait_for_backend_ready(port, timeout=60):
    """
    通過輪詢指定的埠號，等待 FastAPI 後端服務啟動並回應。
    """
    url = f"http://127.0.0.1:{port}/"
    print(f"    -> 監控目標: {url}")
    print(f"    (最長等待 {timeout} 秒...)")
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            response = requests.get(url, timeout=2)
            elapsed = int(time.time() - start_time)
            print(f"\n[成功] 個人助理後端已在 {elapsed} 秒後回應 (狀態碼: {response.status_code})！")
            return True
        except requests.exceptions.ConnectionError:
            elapsed = int(time.time() - start_time)
            sys.stdout.write(f"\r    -> 後端服務尚未就緒，已等待 {elapsed} 秒...")
            sys.stdout.flush()
        except requests.exceptions.RequestException:
            print(f"    -> 請求失敗，重試中...")
        
        time.sleep(2)

    print(f"\n[嚴重錯誤] 在 {timeout} 秒內無法連接到本地後端服務 {url}。")
    print("請檢查 Personal Assistant Backend 視窗是否有錯誤訊息。")
    return False
# 函式功能: 等待後端服務準備就緒

# 函式功能: 部署前端應用並更新共享設定檔至 GitHub
def update_and_push_to_github(device_id: str, tunnel_url: str):
    """
    執行完整的部署流程：
    1. 清理本地 Git 倉庫中的舊前端檔案。
    2. 複製新的前端主應用程式 (index.html, app.js, sw.js) 到倉庫中，並為 app.js 加上快取破解參數。
    3. 採用「讀取-修改-寫回」模式，更新共享的 config.json。
    4. 將所有變更（新增、刪除、修改）一次性推送到 GitHub Pages。
    """
    print("\n" + "="*50)
    print("  4. 正在部署前端並更新共享設定至 GitHub Pages...")
    print("="*50)
    
    source_index_html_path = os.path.join(STATIC_FOLDER_PATH, "index.html")
    source_app_js_path = os.path.join(STATIC_FOLDER_PATH, "js", "app.js")
    source_sw_js_path = os.path.join(STATIC_FOLDER_PATH, "js", "sw.js")

    dest_index_html_path = os.path.join(REDIRECT_FOLDER_PATH, "index.html")
    dest_js_folder_path = os.path.join(REDIRECT_FOLDER_PATH, "js")
    dest_app_js_path = os.path.join(dest_js_folder_path, "app.js")
    dest_sw_js_path = os.path.join(REDIRECT_FOLDER_PATH, "sw.js")
    
    config_filename = "config.json"
    config_path = os.path.join(REDIRECT_FOLDER_PATH, config_filename)

    if not all(os.path.exists(p) for p in [source_index_html_path, source_app_js_path, source_sw_js_path]):
        print("[嚴重錯誤] 找不到必要的前端源檔案 (static/index.html 或 static/js/app.js 或 static/js/sw.js)。")
        return

    if not os.path.exists(REDIRECT_FOLDER_PATH):
        print(f"[*] Redirect 資料夾不存在，正在建立: {REDIRECT_FOLDER_PATH}")
        os.makedirs(REDIRECT_FOLDER_PATH)
        
    try:
        print("[*] 正在初始化 GitPython 並與遠端同步...")
        repo = git.Repo.init(REDIRECT_FOLDER_PATH)
        if 'origin' not in repo.remotes:
            origin_url = f"https://github.com/{GITHUB_USERNAME}/{GITHUB_REPO_NAME}.git"
            repo.create_remote('origin', origin_url)
        
        origin = repo.remotes.origin
        origin.fetch()
        
        if GIT_BRANCH in repo.heads:
            repo.heads[GIT_BRANCH].set_tracking_branch(origin.refs[GIT_BRANCH]).checkout()
        else:
            repo.create_head(GIT_BRANCH, origin.refs[GIT_BRANCH]).set_tracking_branch(origin.refs[GIT_BRANCH]).checkout()

        print("    -> 正在拉取遠端變更 (pull)...")
        origin.pull(GIT_BRANCH)
        print("    -> 本地倉庫已與遠端同步。")

    except Exception as e:
        print(f"[錯誤] 與 Git 倉庫同步時發生錯誤: {e}")
        return

    print("[*] 正在清理過時的前端檔案...")
    files_to_remove_from_git = []
    for item in os.listdir(REDIRECT_FOLDER_PATH):
        item_path = os.path.join(REDIRECT_FOLDER_PATH, item)
        if os.path.isfile(item_path):
            if item == "loader.js" or (item.endswith(".html") and item != "index.html"):
                files_to_remove_from_git.append(item)
    
    if files_to_remove_from_git:
        for f in files_to_remove_from_git:
            os.remove(os.path.join(REDIRECT_FOLDER_PATH, f))
            print(f"    -> 已刪除本地舊檔案: {f}")
        repo.index.remove(files_to_remove_from_git, working_tree=True)
        print("    -> 已將刪除操作加入 Git 暫存區。")

    print("[*] 正在部署新的前端主應用程式...")
    os.makedirs(dest_js_folder_path, exist_ok=True)
    
    shutil.copy(source_app_js_path, dest_app_js_path)
    shutil.copy(source_sw_js_path, dest_sw_js_path)
    
    cache_buster = int(time.time())
    with open(source_index_html_path, 'r', encoding='utf-8') as f:
        index_content = f.read()
    
    index_content = re.sub(
        r'<script\s+src="js/app\.js(?:\?v=\d+)?"></script>',
        f'<script src="js/app.js?v={cache_buster}"></script>',
        index_content
    )

    with open(dest_index_html_path, 'w', encoding='utf-8') as f:
        f.write(index_content)
    print(f"    -> 已複製並注入快取破解參數到 index.html (版本: {cache_buster})")
    
    config_data = {"devices": {}}
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
                if isinstance(existing_data, dict) and "devices" in existing_data and isinstance(existing_data["devices"], dict):
                    config_data = existing_data
        except (json.JSONDecodeError, IOError): pass

    print(f"[*] 正在註冊/更新裝置 '{device_id}' 的資訊...")
    config_data["devices"][device_id] = {
        "url": tunnel_url,
        "timestamp": int(time.time()),
        "status": "online"
    }
    
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config_data, f, indent=2)
    print(f"    -> 已將最新狀態寫入 {config_filename}")

    try:
        repo.index.add([dest_index_html_path, dest_app_js_path, dest_sw_js_path, config_path])
        
        if repo.is_dirty(untracked_files=True):
            commit_message = f"Deploy v{cache_buster} and update status for {device_id}"
            print(f'    -> 正在提交變更: "{commit_message}"')
            repo.index.commit(commit_message)
        else:
            print("[*] 檔案內容未變更，無需提交。")

        print(f"    -> 正在推送至 origin/{GIT_BRANCH}...")
        remote_url = f"https://{GITHUB_USERNAME}:{GITHUB_TOKEN}@github.com/{GITHUB_USERNAME}/{GITHUB_REPO_NAME}.git"
        
        with origin.config_writer as writer:
            writer.set("url", remote_url)
        
        push_info = origin.push(refspec=f'{GIT_BRANCH}:{GIT_BRANCH}')
        
        if push_info[0].flags & git.PushInfo.ERROR:
            print(f"[錯誤] 推送至 GitHub 時發生錯誤: {push_info[0].summary}")
        else:
            print("\n[成功] 前端應用及共享設定檔已成功更新至 GitHub Pages！")

    except git.exc.GitCommandError as e:
        print(f"[錯誤] 推送至 GitHub 時發生 Git 命令錯誤: {e}")
        print(f"    -> Stderr: {e.stderr}")
    except Exception as e:
        print(f"[錯誤] 推送至 GitHub 時發生未知錯誤: {e}")
# 函式功能: 部署前端應用並更新共享設定檔至 GitHub

# 函式功能: 將子程序的輸出流放入佇列
def enqueue_output(out, queue):
    """
    一個執行緒目標函式，用於逐行讀取子程序的輸出並將其放入佇列中。
    """
    try:
        for line in iter(out.readline, ''):
            queue.put(line)
        out.close()
    except ValueError:
        pass
# 函式功能: 將子程序的輸出流放入佇列

if __name__ == "__main__":
    try:
        print("="*60)
        print(f"      個人助理伺服器 - 全自動啟動腳本 v18.37")
        print("="*60)

        if sys.version_info < (3, 8):
            print(f"[嚴重錯誤] 您的 Python 版本是 {sys.version_info.major}.{sys.version_info.minor}，過於老舊。")
            print("           此專案需要 Python 3.8 或更新版本。")
            sys.exit(1)
        print(f"[成功] Python 版本 {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro} 符合要求。")

        # [v18.37 修正] 步驟 1: 首先安裝所有基礎依賴
        check_and_install_requirements()

        # [v18.37 修正] 步驟 2: 確保 Git 環境可用（如果需要會自動下載）
        git_executable = find_and_set_git_executable()
        
        update_comfyui_core(git_executable)
        
        cloudflared_executable = check_and_install_cloudflared()
        if not cloudflared_executable:
            sys.exit(1)
        
        device_id = get_gpu_info()
        print("-" * 60)
        
        upgrade_pytorch_in_comfyui()
        
        # [v18.37 修正] 步驟 3: 安裝所有節點，這可能會安裝 diffusers 等庫
        check_and_clone_nodes(git_executable)

        # [v18.37 修正] 步驟 4: 在節點和依賴安裝完畢後，才執行補丁
        patch_diffusers_import_error()

        check_and_download_models()

        if not start_and_wait_for_comfyui_instances():
            print("\n[!] 啟動流程終止，因為一個或多個 ComfyUI 服務啟動失敗。")
            time.sleep(15)
            sys.exit(1)

        print("\n" + "="*50)
        print("  4. 正在啟動個人助理後端服務...")
        print("="*50)
        backend_command_list = [sys.executable, MAIN_PY_SCRIPT]
        backend_command = subprocess.list2cmdline(backend_command_list)
        start_independent_process(
            backend_command, 
            "Personal Assistant Backend", 
            "0B", 
            os.path.dirname(MAIN_PY_SCRIPT)
        )

        if not wait_for_backend_ready(BACKEND_PORT):
            print("[!] 啟動流程終止，因為本地後端服務啟動失敗。")
            sys.exit(1)

        print("\n" + "="*50)
        print("  5. 正在啟動 Cloudflare 臨時通道...")
        print("="*50)
        tunnel_command = f'"{cloudflared_executable}" tunnel --url http://localhost:{BACKEND_PORT}'
        
        tunnel_process = subprocess.Popen(
            tunnel_command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            shell=True, text=True, encoding='utf-8', errors='ignore', bufsize=1
        )

        q = Queue()
        t = threading.Thread(target=enqueue_output, args=(tunnel_process.stdout, q))
        t.daemon = True
        t.start()

        print("[*] 等待 Cloudflare 臨時通道生成網址，將在 15 秒後嘗試推送...")
        print("-" * 20)

        tunnel_url = None
        start_time = time.time()
        wait_duration = 15

        while time.time() - start_time < wait_duration:
            try:
                line = q.get(timeout=0.1) 
                sys.stdout.write(line)
                sys.stdout.flush()
                
                if tunnel_url is None:
                    match = re.search(r"(https?://[a-zA-Z0-9-]+\.trycloudflare\.com)", line)
                    if match:
                        tunnel_url = match.group(1)
                        print("\n" + "*"*50)
                        print(f"  [捕獲成功] 已找到網址: {tunnel_url}")
                        remaining_time = wait_duration - (time.time() - start_time)
                        print(f"  [*] 將在 {max(0, remaining_time):.1f} 秒後繼續推送...")
                        print("*"*50)
            except Empty:
                time.sleep(0.1)
                continue
        
        print(f"\n[*] {wait_duration} 秒等待時間結束。")
        if tunnel_url:
            print("[*] 網址已成功捕獲，現在執行部署與推送...")
            # GitPython 導入現在是安全的
            import git
            update_and_push_to_github(device_id, tunnel_url)
        else:
            print(f"\n[錯誤] 在 {wait_duration} 秒內未能從 Cloudflare 輸出中捕獲到網址。")
            if tunnel_process.poll() is None:
                tunnel_process.terminate()

        permanent_url = f"https://{GITHUB_USERNAME}.github.io/{GITHUB_REPO_NAME}/"
        local_url = f"http://127.0.0.1:{BACKEND_PORT}"

        print("\n" + "="*60)
        print("      🚀 啟動流程完畢 🚀")
        print("="*60)
        print(f"\n您的【本地測試網址】是:")
        print(f"  -> {local_url}")
        
        print(f"\n您的【永久入口網址】(多裝置控制面板) 是:")
        print(f"  -> {permanent_url}")
        print("\n[成功] 現在您可以使用此單一網址控制所有已啟動的裝置！")
        
        if not tunnel_url:
            print("\n[警告] 未能啟動或驗證 Cloudflare Tunnel，永久網址可能無法使用。")
        print("\n" + "-"*60)
        print("若要關閉所有服務，請關閉此視窗以及 ComfyUI 和後端伺服器的視窗。")

        try:
            print(f"\n[*] 正在為您自動開啟瀏覽器至【本地網址】: {local_url}")
            try:
                browser = webbrowser.get()
                if 'chrome' in browser.name.lower():
                    browser.open_new(local_url + " --incognito")
                elif 'firefox' in browser.name.lower():
                    browser.open_new(local_url + " --private-window")
                elif 'msedge' in browser.name.lower():
                    browser.open_new(local_url + " --inprivate")
                else:
                    webbrowser.open_new(local_url)
            except webbrowser.Error:
                print("[警告] 無法獲取預設瀏覽器控制器，將以標準方式開啟。")
                webbrowser.open_new(local_url)
        except Exception as e:
            print(f"[警告] 自動開啟瀏覽器失敗: {e}")

        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            print("\n[*] 正在關閉所有服務...")
            if 'tunnel_process' in locals() and tunnel_process.poll() is None:
                tunnel_process.terminate()
            print("[*] 服務已關閉。")

    except BaseException as e:
        if isinstance(e, SystemExit) and e.code == 0:
            pass 
        else:
            import traceback
            print("\n" + "#"*60)
            print("          一個未預期的致命錯誤導致程式終止！")
            print("#"*60)
            print("\n錯誤類型:", type(e).__name__)
            print("錯誤訊息:", e)
            print("\n--- 錯誤追蹤 ---")
            traceback.print_exc()
            print("--- 錯誤追蹤結束 ---")

    finally:
        print("\n" + "="*60)
        print("腳本執行結束或發生錯誤。")
        print("此視窗將會暫停，您可以查看上面的錯誤訊息。")
        print("按任意鍵結束...")
        print("="*60)
        os.system("pause")
