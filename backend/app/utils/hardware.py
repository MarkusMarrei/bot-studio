import os
import sys
import shutil
import platform
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional

# Official llama.cpp release binaries (cross-platform matrix)
LLAMA_CPP_TAG = "b4500"
LLAMA_RELEASES = {
    # Windows
    ("Windows", "AMD64", "vulkan"): f"https://github.com/ggerganov/llama.cpp/releases/download/{LLAMA_CPP_TAG}/llama-{LLAMA_CPP_TAG}-bin-win-vulkan-x64.zip",
    ("Windows", "AMD64", "cuda"): f"https://github.com/ggerganov/llama.cpp/releases/download/{LLAMA_CPP_TAG}/llama-{LLAMA_CPP_TAG}-bin-win-cuda-cu12.4-x64.zip",
    ("Windows", "AMD64", "cpu"): f"https://github.com/ggerganov/llama.cpp/releases/download/{LLAMA_CPP_TAG}/llama-{LLAMA_CPP_TAG}-bin-win-avx2-x64.zip",
    
    # Linux
    ("Linux", "x86_64", "vulkan"): f"https://github.com/ggerganov/llama.cpp/releases/download/{LLAMA_CPP_TAG}/llama-{LLAMA_CPP_TAG}-bin-ubuntu-x64.zip",
    ("Linux", "x86_64", "cpu"): f"https://github.com/ggerganov/llama.cpp/releases/download/{LLAMA_CPP_TAG}/llama-{LLAMA_CPP_TAG}-bin-ubuntu-x64.zip",
    
    # macOS
    ("Darwin", "arm64", "metal"): f"https://github.com/ggerganov/llama.cpp/releases/download/{LLAMA_CPP_TAG}/llama-{LLAMA_CPP_TAG}-bin-macos-arm64.zip",
    ("Darwin", "x86_64", "cpu"): f"https://github.com/ggerganov/llama.cpp/releases/download/{LLAMA_CPP_TAG}/llama-{LLAMA_CPP_TAG}-bin-macos-x64.zip",
}

class HardwareDetector:
    """
    Cross-platform hardware, GPU and accelerator detection for:
    - OS: Windows 10/11, Linux (Ubuntu/Debian/Arch/Fedora), macOS (Apple Silicon & Intel)
    - GPU: AMD (iGPU / dGPU), NVIDIA (GeForce/RTX), Intel (Iris Xe/Arc), Apple Metal
    - Acceleration: Vulkan, CUDA, Metal, AVX2 CPU Fallback
    """

    @staticmethod
    def get_os() -> str:
        return platform.system()  # 'Windows', 'Linux', 'Darwin'

    @staticmethod
    def get_arch() -> str:
        machine = platform.machine()
        if machine.lower() in ("amd64", "x86_64"):
            return "AMD64" if platform.system() == "Windows" else "x86_64"
        if machine.lower() in ("arm64", "aarch64"):
            return "arm64"
        return machine

    @classmethod
    def detect_gpus(cls) -> List[Dict[str, Any]]:
        gpus = []
        os_name = cls.get_os()

        # 1. Check NVIDIA via nvidia-smi (all platforms)
        nvidia_smi = shutil.which("nvidia-smi")
        if not nvidia_smi and os_name == "Windows":
            default_path = Path("C:/Program Files/NVIDIA Corporation/NVSMI/nvidia-smi.exe")
            if default_path.exists():
                nvidia_smi = str(default_path)

        if nvidia_smi:
            try:
                out = subprocess.check_output(
                    [nvidia_smi, "--query-gpu=name,memory.total,driver_version", "--format=csv,noheader,nounits"],
                    text=True,
                    timeout=3,
                    errors="ignore"
                )
                for line in out.splitlines():
                    parts = [p.strip() for p in line.split(",")]
                    if len(parts) >= 2:
                        gpus.append({
                            "vendor": "NVIDIA",
                            "name": parts[0],
                            "vram_mb": int(float(parts[1])),
                            "driver": parts[2] if len(parts) > 2 else "Unknown",
                            "accelerator": "cuda"
                        })
            except Exception:
                pass

        # 2. Check Windows Video Controllers (AMD, Intel, etc.)
        if os_name == "Windows":
            try:
                cmd = ["powershell", "-NoProfile", "-Command", "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM"]
                out = subprocess.check_output(cmd, text=True, timeout=4, errors="ignore")
                for line in out.splitlines():
                    line_s = line.strip()
                    if not line_s or line_s.startswith("Name") or line_s.startswith("----"):
                        continue
                    
                    lower = line_s.lower()
                    vendor = "Unknown"
                    if "amd" in lower or "radeon" in lower:
                        vendor = "AMD"
                    elif "intel" in lower or "iris" in lower or "arc" in lower:
                        vendor = "Intel"
                    elif "nvidia" in lower or "geforce" in lower:
                        vendor = "NVIDIA"

                    # Avoid duplicating NVIDIA if already found via nvidia-smi
                    if vendor == "NVIDIA" and any(g["vendor"] == "NVIDIA" for g in gpus):
                        continue

                    if vendor in ("AMD", "Intel", "NVIDIA"):
                        # Extract GPU name
                        name = line_s.split("   ")[0].strip()
                        gpus.append({
                            "vendor": vendor,
                            "name": name,
                            "vram_mb": 0,  # Shared / Dynamic VRAM for APU / iGPU
                            "accelerator": "vulkan"
                        })
            except Exception:
                pass

        # 3. Check Linux via lspci
        elif os_name == "Linux":
            lspci = shutil.which("lspci")
            if lspci:
                try:
                    out = subprocess.check_output([lspci], text=True, timeout=3, errors="ignore")
                    for line in out.splitlines():
                        lower = line.lower()
                        if "vga compatible controller" in lower or "3d controller" in lower or "display controller" in lower:
                            if "amd" in lower or "radeon" in lower:
                                gpus.append({"vendor": "AMD", "name": line.split(":")[-1].strip(), "accelerator": "vulkan"})
                            elif "intel" in lower:
                                gpus.append({"vendor": "Intel", "name": line.split(":")[-1].strip(), "accelerator": "vulkan"})
                except Exception:
                    pass

        # 4. Check macOS Apple Silicon
        elif os_name == "Darwin":
            if cls.get_arch() == "arm64":
                gpus.append({
                    "vendor": "Apple",
                    "name": "Apple Silicon GPU (Metal Unified Memory)",
                    "vram_mb": 0,
                    "accelerator": "metal"
                })

        return gpus

    @classmethod
    def check_vulkan_support(cls) -> bool:
        """Checks if Vulkan driver/runtime is present."""
        os_name = cls.get_os()
        if os_name == "Windows":
            system32 = Path(os.environ.get("SystemRoot", "C:\\Windows")) / "System32"
            return (system32 / "vulkan-1.dll").exists()
        elif os_name == "Linux":
            return bool(shutil.which("vulkaninfo") or Path("/usr/lib/libvulkan.so").exists() or Path("/usr/lib/x86_64-linux-gnu/libvulkan.so.1").exists())
        return False

    @classmethod
    def get_best_accelerator(cls) -> Dict[str, Any]:
        """
        Determines the optimal backend and GPU layer offload count (-ngl).
        """
        os_name = cls.get_os()
        arch = cls.get_arch()
        gpus = cls.detect_gpus()
        vulkan_ok = cls.check_vulkan_support()

        # macOS Apple Silicon -> Metal
        if os_name == "Darwin" and arch == "arm64":
            return {
                "backend": "metal",
                "accelerator_name": "Apple Metal (Unified Memory)",
                "ngl": 99,
                "gpu_name": "Apple Silicon",
                "zip_url": LLAMA_RELEASES.get(("Darwin", "arm64", "metal"))
            }

        # NVIDIA GPU found with CUDA -> CUDA
        nvidia_gpu = next((g for g in gpus if g.get("vendor") == "NVIDIA"), None)
        if nvidia_gpu:
            vram = nvidia_gpu.get("vram_mb", 0)
            ngl = 99 if vram >= 3500 else (24 if vram >= 2000 else 0)
            return {
                "backend": "cuda",
                "accelerator_name": f"NVIDIA CUDA ({nvidia_gpu.get('name')})",
                "ngl": ngl,
                "gpu_name": nvidia_gpu.get("name"),
                "zip_url": LLAMA_RELEASES.get((os_name, arch, "cuda"), LLAMA_RELEASES.get((os_name, arch, "vulkan")))
            }

        # AMD / Intel / other GPU with Vulkan -> Vulkan
        amd_or_intel = next((g for g in gpus if g.get("vendor") in ("AMD", "Intel")), None)
        if (amd_or_intel or vulkan_ok) and os_name in ("Windows", "Linux"):
            gpu_desc = amd_or_intel.get("name") if amd_or_intel else "Vulkan Compatible Device"
            vendor = amd_or_intel.get("vendor") if amd_or_intel else "GPU"
            return {
                "backend": "vulkan",
                "accelerator_name": f"Vulkan Hardware Acceleration ({vendor}: {gpu_desc})",
                "ngl": 99,  # Vulkan supports offloading all layers
                "gpu_name": gpu_desc,
                "zip_url": LLAMA_RELEASES.get((os_name, arch, "vulkan"), LLAMA_RELEASES.get((os_name, arch, "cpu")))
            }

        # CPU Fallback
        return {
            "backend": "cpu",
            "accelerator_name": f"CPU Multithreaded AVX2 ({platform.processor() or 'Standard CPU'})",
            "ngl": 0,
            "gpu_name": "CPU Fallback",
            "zip_url": LLAMA_RELEASES.get((os_name, arch, "cpu"), LLAMA_RELEASES.get(("Windows", "AMD64", "cpu")))
        }

    @classmethod
    def get_full_diagnostics(cls) -> Dict[str, Any]:
        """Complete diagnostics payload for API and frontend display."""
        os_name = cls.get_os()
        arch = cls.get_arch()
        gpus = cls.detect_gpus()
        best_acc = cls.get_best_accelerator()

        return {
            "os": os_name,
            "os_release": platform.release(),
            "os_version": platform.version(),
            "architecture": arch,
            "processor": platform.processor() or arch,
            "python_version": platform.python_version(),
            "gpus": gpus,
            "active_accelerator": best_acc["accelerator_name"],
            "backend": best_acc["backend"],
            "optimal_ngl": best_acc["ngl"],
            "download_url": best_acc["zip_url"]
        }
