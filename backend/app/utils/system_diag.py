import ctypes
import os
import platform
from typing import Dict, Any
from app.utils.hardware import HardwareDetector

def get_system_diagnostics() -> Dict[str, Any]:
    """
    Cross-platform system, GPU, memory, and accelerator diagnostics.
    Supports Windows 10/11, Linux, and macOS.
    """
    hw_info = HardwareDetector.get_full_diagnostics()

    diag = {
        "os": hw_info["os"],
        "platform_release": hw_info["os_release"],
        "os_version": hw_info["os_version"],
        "architecture": hw_info["architecture"],
        "processor": hw_info["processor"],
        "python_version": hw_info["python_version"],
        "total_ram_gb": 0.0,
        "avail_ram_gb": 0.0,
        "ram_load_percent": 0,
        "gpus": hw_info["gpus"],
        "active_accelerator": hw_info["active_accelerator"],
        "backend": hw_info["backend"],
        "optimal_ngl": hw_info["optimal_ngl"],
        "is_compatible_for_local_llm": False,
        "recommended_model_tier": "4B (Gemma-4-E4B Q4)"
    }

    # Memory detection
    if platform.system() == "Windows":
        try:
            from ctypes import wintypes
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", wintypes.DWORD),
                    ("dwMemoryLoad", wintypes.DWORD),
                    ("ullTotalPhys", ctypes.c_uint64),
                    ("ullAvailPhys", ctypes.c_uint64),
                    ("ullTotalPageFile", ctypes.c_uint64),
                    ("ullAvailPageFile", ctypes.c_uint64),
                    ("ullTotalVirtual", ctypes.c_uint64),
                    ("ullAvailVirtual", ctypes.c_uint64),
                    ("ullAvailExtendedVirtual", ctypes.c_uint64),
                ]
            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat)):
                diag["total_ram_gb"] = round(stat.ullTotalPhys / (1024 ** 3), 2)
                diag["avail_ram_gb"] = round(stat.ullAvailPhys / (1024 ** 3), 2)
                diag["ram_load_percent"] = stat.dwMemoryLoad
        except Exception:
            pass

    elif platform.system() == "Linux":
        try:
            with open("/proc/meminfo", "r") as f:
                meminfo = {}
                for line in f:
                    parts = line.split(":")
                    if len(parts) == 2:
                        meminfo[parts[0].strip()] = parts[1].strip()
                total_kb = float(meminfo.get("MemTotal", "0 kB").split()[0])
                avail_kb = float(meminfo.get("MemAvailable", "0 kB").split()[0])
                diag["total_ram_gb"] = round(total_kb / (1024 ** 2), 2)
                diag["avail_ram_gb"] = round(avail_kb / (1024 ** 2), 2)
                if diag["total_ram_gb"] > 0:
                    diag["ram_load_percent"] = int(100 * (1 - (diag["avail_ram_gb"] / diag["total_ram_gb"])))
        except Exception:
            pass

    elif platform.system() == "Darwin":  # macOS
        try:
            import subprocess
            out = subprocess.check_output(["sysctl", "-n", "hw.memsize"], text=True).strip()
            total_bytes = float(out)
            diag["total_ram_gb"] = round(total_bytes / (1024 ** 3), 2)
            diag["avail_ram_gb"] = round(diag["total_ram_gb"] * 0.6, 2)
            diag["ram_load_percent"] = 40
        except Exception:
            pass

    # Model tier recommendation
    avail_gb = diag["avail_ram_gb"]
    total_gb = diag["total_ram_gb"]
    if avail_gb >= 1.5 or hw_info["optimal_ngl"] > 0:
        diag["is_compatible_for_local_llm"] = True

    if hw_info["backend"] in ("cuda", "metal", "vulkan"):
        diag["recommended_model_tier"] = "4B (Gemma-4-E4B Q4 • GPU Accelerated)"
    elif total_gb >= 16:
        diag["recommended_model_tier"] = "4B (Gemma-4-E4B Q4 / Qwen-2.5-3B)"
    elif total_gb >= 8:
        diag["recommended_model_tier"] = "4B (Gemma-4-E4B Q4)"
    else:
        diag["recommended_model_tier"] = "Cloud / Zero-VRAM (OpenRouter/Groq)"

    return diag
