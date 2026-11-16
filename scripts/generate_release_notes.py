import sys
import os
import re

def main():
    tag = sys.argv[1] if len(sys.argv) > 1 else "v1.4.4"
    ver = tag.lstrip("v")
    
    notes = ""
    # Look for CHANGELOG.md in current directory or parent
    candidates = [
        "CHANGELOG.md",
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "CHANGELOG.md")
    ]
    for c in candidates:
        if os.path.exists(c):
            with open(c, "r", encoding="utf-8") as f:
                content = f.read()
            pattern = rf"##\s*\[?{re.escape(ver)}\]?[^\n]*\n(.*?)(?=\n##|\Z)"
            m = re.search(pattern, content, re.DOTALL)
            if m:
                notes = m.group(1).strip()
                break
    
    if not notes:
        notes = "- **Maintenance & Polish:** Engine and UI stability enhancements."

    # Verify if Saveo-Android.apk was compiled and is present in release assets
    has_apk = (
        os.path.exists("Saveo-Android.apk")
        or os.path.exists(os.path.join("release-assets", "Saveo-Android.apk"))
    )

    if has_apk:
        android_link = f"[Download Saveo-Android.apk](https://github.com/ProTechPh/Saveo/releases/download/{tag}/Saveo-Android.apk)"
    else:
        android_link = "⚠️ *Not generated in this build.* [Download validated APK (v1.3.5)](https://github.com/ProTechPh/Saveo/releases/download/v1.3.5/Saveo-Android.apk) · [All Releases](https://github.com/ProTechPh/Saveo/releases)"

    body = f"""### 🚀 What's New in this Release:
{notes}

---

### 🪟 Windows (Stable)

| Platform | Package | Direct Link |
| :--- | :--- | :--- |
| 🪟 **Windows 10 / 11** | **Setup Wizard (Recommended)** | [Download Saveo-Setup.exe](https://github.com/ProTechPh/Saveo/releases/download/{tag}/Saveo-Setup.exe) |
| 🪟 **Windows 10 / 11** | Standalone Portable ZIP | [Download Saveo-Windows-x64.zip](https://github.com/ProTechPh/Saveo/releases/download/{tag}/Saveo-Windows-x64.zip) |

*Tested on Windows 11. Run `Saveo-Setup.exe` for an effortless modern setup with Start Menu and Desktop shortcuts (no administrator rights needed). Or extract the portable zip and run `Saveo.exe`.*

---

### 🤖 Android (Experimental)

| Platform | Package | Direct Link |
| :--- | :--- | :--- |
| 🤖 **Android (7.0+)** | Standalone APK | {android_link} |

> [!WARNING]
> **Android is currently experimental:** The Android APK is provided for testing and community validation. Core download flows, storage paths, and UI interactions are under active development and may behave unexpectedly while mobile issues are being resolved.
"""
    output_path = "release_body.md"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(body)
    print(f"Generated {output_path} for {tag} successfully.")

if __name__ == "__main__":
    main()
