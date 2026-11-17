import argparse
import os
import re
import subprocess
import sys

def parse_semver(v):
    m = re.match(r"^(\d+)\.(\d+)\.(\d+)", v.strip().lstrip("v"))
    if m:
        return (int(m.group(1)), int(m.group(2)), int(m.group(3)))
    return (0, 0, 0)

def format_semver(t):
    return f"{t[0]}.{t[1]}.{t[2]}"

def get_highest_version():
    candidates = []
    
    # 1. Read VERSION file
    if os.path.exists("VERSION"):
        try:
            with open("VERSION", "r", encoding="utf-8") as f:
                c = f.read().strip()
                if c:
                    candidates.append(c)
        except Exception:
            pass

    # 2. Fetch git tags
    try:
        subprocess.run(["git", "fetch", "--tags", "--force"], capture_output=True, text=True)
        tags_out = subprocess.check_output(["git", "tag", "-l", "v*"], text=True)
        for t in tags_out.splitlines():
            t = t.strip()
            if t:
                candidates.append(t)
    except Exception:
        pass

    if not candidates:
        candidates = ["1.4.15"]

    highest = max(candidates, key=parse_semver)
    return parse_semver(highest)

def get_version_code():
    try:
        out = subprocess.check_output(["git", "rev-list", "--count", "HEAD"], text=True).strip()
        code = int(out)
        return max(code, 15)
    except Exception:
        return 16

def main():
    parser = argparse.ArgumentParser(description="Calculate Saveo version for automated releases")
    parser.add_argument("--event", default=os.getenv("GITHUB_EVENT_NAME", "push"))
    parser.add_argument("--ref-type", default=os.getenv("GITHUB_REF_TYPE", "branch"))
    parser.add_argument("--ref-name", default=os.getenv("GITHUB_REF_NAME", "main"))
    parser.add_argument("--custom-tag", default="")
    args = parser.parse_args()

    version_clean = ""
    tag_name = ""

    # Priority 1: Manual workflow_dispatch with custom tag
    if args.custom_tag and args.custom_tag.strip():
        tag_name = args.custom_tag.strip()
        version_clean = tag_name.lstrip("v")
    # Priority 2: Pushed git tag
    elif args.ref_type == "tag" and args.ref_name.startswith("v"):
        tag_name = args.ref_name.strip()
        version_clean = tag_name.lstrip("v")
    # Priority 3: Push / Merge to main -> AUTO-INCREMENT PATCH
    else:
        major, minor, patch = get_highest_version()
        new_patch = patch + 1
        version_clean = f"{major}.{minor}.{new_patch}"
        tag_name = f"v{version_clean}"

    version_code = get_version_code()

    # Output to stdout and GitHub Output file if in CI
    print(f"Calculated Version: {version_clean}")
    print(f"Calculated Tag: {tag_name}")
    print(f"Calculated Android VersionCode: {version_code}")

    github_output = os.getenv("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as f:
            f.write(f"version={version_clean}\n")
            f.write(f"tag={tag_name}\n")
            f.write(f"version_code={version_code}\n")

if __name__ == "__main__":
    main()
