"""Windows single-instance guard so two Saveo processes cannot share local state."""

import ctypes
import sys

_mutex_handle = None


def acquire_mutex(name: str = r"Local\Saveo_SingleInstance") -> bool:
    """Return False when another process already owns the named mutex.

    On non-Windows platforms this is a no-op so development/tests still run.
    The first handle is kept alive for the life of the process.
    """
    global _mutex_handle
    if sys.platform != "win32":
        return True
    try:
        from ctypes import wintypes

        kernel32 = ctypes.windll.kernel32
        kernel32.CreateMutexW.restype = wintypes.HANDLE
        kernel32.CreateMutexW.argtypes = [wintypes.LPVOID, wintypes.BOOL, wintypes.LPCWSTR]

        handle = kernel32.CreateMutexW(None, False, name)
        if not handle:
            return True  # never block startup because the API failed
        if kernel32.GetLastError() == 183:  # ERROR_ALREADY_EXISTS
            kernel32.CloseHandle(handle)
            return False
        _mutex_handle = handle
        return True
    except Exception:
        return True


def focus_existing_window() -> bool:
    """Bring the running Saveo window to the foreground, if one exists."""
    if sys.platform != "win32":
        return False
    try:
        user32 = ctypes.windll.user32
        hwnd = user32.FindWindowW(None, "Saveo")
        if hwnd:
            user32.ShowWindow(hwnd, 9)  # SW_RESTORE
            user32.SetForegroundWindow(hwnd)
            return True
    except Exception:
        pass
    return False


def notify_already_running():
    """Fall back to a small native prompt when no window could be focused."""
    try:
        ctypes.windll.user32.MessageBoxW(None, "Saveo is already running.", "Saveo", 0x40)
    except Exception:
        print("Saveo is already running.")
