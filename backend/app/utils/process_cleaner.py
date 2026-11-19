import socket
import subprocess
import platform
import os
import signal

def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    """Checks whether a TCP port is currently occupied."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0

def kill_process_on_port(port: int):
    """
    Terminates dangling or orphaned processes holding a given port on Windows.
    Prevents zombie process collisions from previous runs (SREDA AI pattern).
    """
    if platform.system() != "Windows":
        return

    try:
        # Find PID using netstat
        cmd = f'netstat -ano | findstr :{port}'
        output = subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.DEVNULL)
        lines = output.strip().split("\n")
        
        current_pid = os.getpid()
        for line in lines:
            parts = line.strip().split()
            if len(parts) >= 5 and "LISTENING" in parts:
                pid = int(parts[-1])
                if pid != current_pid and pid > 4:
                    # Terminate orphan process
                    subprocess.run(["taskkill", "/F", "/PID", str(pid)], capture_output=True)
    except Exception:
        pass
