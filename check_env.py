"""
Pre-Installation Check
"""

import os
import sys
import socket
import subprocess
import glob

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WHEELS_DIR = os.path.join(BASE_DIR, "offline_packages", "wheels")
if not os.path.exists(WHEELS_DIR):
    alt_wheels = os.path.join(BASE_DIR, "wheels")
    if os.path.exists(alt_wheels):
        WHEELS_DIR = alt_wheels

CONFIG_FILE = os.path.join(BASE_DIR, "python_env.bat")
REQ_FILE = os.path.join(BASE_DIR, "requirements.txt")

REQUIRED_MODULES = [
    ("fastapi", "FastAPI"),
    ("uvicorn", "Uvicorn"),
    ("pydantic", "Pydantic"),
    ("reportlab", "ReportLab"),
    ("pypdf", "PyPDF"),
]

def check_internet(timeout=2.5):
    for host, port in [("pypi.org", 443), ("1.1.1.1", 53), ("8.8.8.8", 53)]:
        try:
            s = socket.create_connection((host, port), timeout=timeout)
            s.close()
            return True
        except (OSError, socket.timeout):
            continue
    return False

def get_installed_pythons():
    found = []
    seen = set()

    def add_candidate(path, label=""):
        if not path:
            return
        clean_path = os.path.normpath(path)
        if clean_path.lower() in seen:
            return
        if os.path.isfile(clean_path):
            try:
                res = subprocess.run(
                    [clean_path, "-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro} ({sys.maxsize > 2**32 and 64 or 32}-bit)')"],
                    capture_output=True, text=True, timeout=3
                )
                if res.returncode == 0:
                    found.append({"path": clean_path, "version": res.stdout.strip(), "label": label})
                    seen.add(clean_path.lower())
            except Exception:
                pass

    add_candidate(sys.executable, "Current")

    for cmd in ["python", "py"]:
        try:
            res = subprocess.run(["where", cmd], capture_output=True, text=True, shell=True)
            if res.returncode == 0:
                for line in res.stdout.strip().splitlines():
                    add_candidate(line.strip(), f"PATH ({cmd})")
        except Exception:
            pass

    search_dirs = [
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "Python"),
        os.environ.get("ProgramFiles", "C:\\Program Files"),
        os.path.join(os.environ.get("ProgramFiles", "C:\\Program Files"), "Python"),
        os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)"),
        "C:\\",
    ]

    for base in search_dirs:
        if not os.path.exists(base):
            continue
        try:
            for item in os.listdir(base):
                if item.lower().startswith("python"):
                    exe = os.path.join(base, item, "python.exe")
                    if os.path.isfile(exe):
                        add_candidate(exe, "Directory")
        except Exception:
            pass

    return found

def check_missing_modules():
    missing = []
    for mod_name, label in REQUIRED_MODULES:
        try:
            __import__(mod_name)
        except ImportError:
            missing.append((mod_name, label))
    return missing

def check_offline_wheels_compatibility(py_version_info):
    if not os.path.exists(WHEELS_DIR):
        return False, "offline_packages/wheels folder missing"

    wheels = glob.glob(os.path.join(WHEELS_DIR, "*.whl"))
    if not wheels:
        return False, "No wheels in folder"

    major = py_version_info[0]
    minor = py_version_info[1]
    expected_tag = f"cp{major}{minor}"

    has_exact_tag = any(expected_tag in os.path.basename(w) for w in wheels)
    has_universal_only = all("none-any" in os.path.basename(w) for w in wheels)

    if has_exact_tag or has_universal_only:
        return True, f"Matches {expected_tag}"
    else:
        found_tags = set()
        for w in wheels:
            for part in os.path.basename(w).split("-"):
                if part.startswith("cp") and len(part) in (5, 6):
                    found_tags.add(part)
        tags_str = ", ".join(sorted(found_tags)) if found_tags else "none"
        return False, f"Bundled wheels are for ({tags_str}), current Python is {major}.{minor}"

def save_python_env(python_path):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        f.write(f"@echo off\nset \"PYTHON_EXE={python_path}\"\n")

def interactive_fix(missing_modules, has_net, wheel_compat, wheel_msg):
    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    print("\n------------------------------------------------------------")
    print("  Pre-Installation Check")
    print("------------------------------------------------------------")
    print(f"  Python:      {sys.executable} ({py_ver})")
    print(f"  Internet:    {'Connected' if has_net else 'Disconnected (Air-gapped)'}")
    print(f"  Wheels:      {'OK' if wheel_compat else wheel_msg}")

    if missing_modules:
        print("  Missing:     " + ", ".join(lbl for _, lbl in missing_modules))
    print("------------------------------------------------------------")

    options = []
    if wheel_compat and os.path.exists(WHEELS_DIR):
        options.append(("offline_install", "Install from offline packages"))
    if has_net:
        options.append(("online_install", "Download and install from internet"))
    options.append(("switch_python", "Use another Python on this computer"))
    options.append(("manual_path", "Enter path to python.exe"))
    options.append(("exit", "Exit"))

    print("\nOptions:")
    for idx, (_, desc) in enumerate(options, start=1):
        print(f"  [{idx}] {desc}")

    choice = input(f"\nSelect [1-{len(options)}]: ").strip()
    try:
        choice_idx = int(choice) - 1
        if 0 <= choice_idx < len(options):
            action = options[choice_idx][0]
        else:
            return False
    except ValueError:
        return False

    if action == "offline_install":
        cmd = [sys.executable, "-m", "pip", "install", "--no-index", f"--find-links={WHEELS_DIR}", "-r", REQ_FILE]
        res = subprocess.run(cmd)
        return res.returncode == 0

    elif action == "online_install":
        cmd = [sys.executable, "-m", "pip", "install", "-r", REQ_FILE]
        res = subprocess.run(cmd)
        if res.returncode == 0:
            try:
                os.makedirs(WHEELS_DIR, exist_ok=True)
                subprocess.run([sys.executable, "-m", "pip", "download", "-r", REQ_FILE, "-d", WHEELS_DIR], capture_output=True)
            except Exception:
                pass
            return True
        return False

    elif action == "switch_python":
        py_list = get_installed_pythons()
        valid_py = [p for p in py_list if p["path"].lower() != sys.executable.lower()]
        if not valid_py:
            print("No other Python found. Install Python 3.11 64-bit or enter path manually.")
            input("\nPress Enter to continue...")
            return False
        print("\nFound Python versions:")
        for i, p in enumerate(valid_py, start=1):
            print(f"  [{i}] {p['version']} - {p['path']}")
        
        pick = input(f"\nSelect [1-{len(valid_py)}]: ").strip()
        try:
            p_idx = int(pick) - 1
            if 0 <= p_idx < len(valid_py):
                chosen = valid_py[p_idx]["path"]
                save_python_env(chosen)
                print(f"Saved to python_env.bat. Run setup.bat again.")
                return True
        except ValueError:
            pass
        return False

    elif action == "manual_path":
        entered = input("\nEnter path to python.exe: ").strip(' "\'')
        if os.path.isfile(entered):
            save_python_env(entered)
            print(f"Saved to python_env.bat. Run setup.bat again.")
            return True
        else:
            print(f"File not found: {entered}")
            return False

    return False

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "check"

    if mode == "quick_check":
        missing = check_missing_modules()
        sys.exit(1 if missing else 0)

    missing = check_missing_modules()
    has_net = check_internet()
    wheel_compat, wheel_msg = check_offline_wheels_compatibility(sys.version_info)

    if not missing:
        save_python_env(sys.executable)
        if mode != "silent":
            print("[OK] Dependencies verified.")
        sys.exit(0)

    if mode == "auto_repair":
        if wheel_compat and os.path.exists(WHEELS_DIR):
            res = subprocess.run([sys.executable, "-m", "pip", "install", "--no-index", f"--find-links={WHEELS_DIR}", "-r", REQ_FILE], capture_output=True)
            if res.returncode == 0:
                save_python_env(sys.executable)
                sys.exit(0)
        success = interactive_fix(missing, has_net, wheel_compat, wheel_msg)
        sys.exit(0 if success else 1)

    elif mode == "interactive":
        success = interactive_fix(missing, has_net, wheel_compat, wheel_msg)
        sys.exit(0 if success else 1)
    else:
        print("Missing dependencies:")
        for _, lbl in missing:
            print(f" - {lbl}")
        sys.exit(1)

if __name__ == "__main__":
    main()
