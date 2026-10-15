"""
Automated Android APK Build Pipeline for RaiNOva
Compiles, dexes, packages, zip-aligns, and signs an installable Android APK
using the local Android SDK and Java toolchains.
"""

import os
import sys
import shutil
import zipfile
import subprocess

SDK_ROOT = r"C:\Users\Abusahil\AppData\Local\Android\Sdk"
BUILD_TOOLS_DIR = os.path.join(SDK_ROOT, "build-tools", "30.0.2")
ANDROID_JAR = os.path.join(SDK_ROOT, "platforms", "android-33", "android.jar")

AAPT2 = os.path.join(BUILD_TOOLS_DIR, "aapt2.exe")
ZIPALIGN = os.path.join(BUILD_TOOLS_DIR, "zipalign.exe")
D8_JAR = os.path.join(BUILD_TOOLS_DIR, "lib", "d8.jar")
APKSIGNER_JAR = os.path.join(BUILD_TOOLS_DIR, "lib", "apksigner.jar")

JAVA = r"C:\Users\Abusahil\AppData\Local\Programs\Eclipse Adoptium\jdk-11.0.30.7-hotspot\bin\java.exe"
KEYTOOL = r"C:\Users\Abusahil\AppData\Local\Programs\Eclipse Adoptium\jdk-11.0.30.7-hotspot\bin\keytool.exe"
JAVAC = r"C:\Users\Abusahil\AppData\Local\Programs\Eclipse Adoptium\jdk-11.0.30.7-hotspot\bin\javac.exe"

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
SRC_MAIN = os.path.join(PROJECT_ROOT, "src", "main")
RES_DIR = os.path.join(SRC_MAIN, "res")
MANIFEST_XML = os.path.join(SRC_MAIN, "AndroidManifest.xml")
JAVA_SRC = os.path.join(SRC_MAIN, "java", "com", "rainova", "app", "MainActivity.java")

BUILD_DIR = os.path.join(PROJECT_ROOT, "build")
INTERMEDIATES = os.path.join(BUILD_DIR, "intermediates")
COMPILED_RES = os.path.join(INTERMEDIATES, "compiled_res")
GEN_SRC = os.path.join(INTERMEDIATES, "gen")
BIN_CLASSES = os.path.join(INTERMEDIATES, "classes")
KEYSTORE_PATH = os.path.join(BUILD_DIR, "debug.keystore")

UNALIGNED_APK = os.path.join(INTERMEDIATES, "unaligned.apk")
ALIGNED_APK = os.path.join(INTERMEDIATES, "aligned.apk")
FINAL_APK = os.path.join(BUILD_DIR, "RaiNOva.apk")

def run_cmd(cmd, desc):
    print(f"\n[+] {desc}...")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"FAILED: {desc}")
        print("STDOUT:", result.stdout)
        print("STDERR:", result.stderr)
        sys.exit(result.returncode)
    else:
        if result.stdout.strip():
            print("   ", result.stdout.strip().replace("\n", "\n    "))
    return result

def build():
    print("=" * 60)
    print("  RaiNOva Native Android APK Build Toolchain")
    print("=" * 60)

    # Clean / prepare intermediate directories
    if os.path.exists(INTERMEDIATES):
        shutil.rmtree(INTERMEDIATES)
    os.makedirs(COMPILED_RES, exist_ok=True)
    os.makedirs(GEN_SRC, exist_ok=True)
    os.makedirs(BIN_CLASSES, exist_ok=True)
    os.makedirs(BUILD_DIR, exist_ok=True)

    # 1. Compile resources with AAPT2
    run_cmd(
        f'"{AAPT2}" compile --dir "{RES_DIR}" -o "{COMPILED_RES}"',
        "Compiling Android Resources (AAPT2)"
    )

    # Collect compiled .flat files
    flat_files = [
        os.path.join(COMPILED_RES, f)
        for f in os.listdir(COMPILED_RES)
        if f.endswith(".flat")
    ]
    flat_args = " ".join([f'"{f}"' for f in flat_files])

    # 2. Link resources with AAPT2
    run_cmd(
        f'"{AAPT2}" link -I "{ANDROID_JAR}" --manifest "{MANIFEST_XML}" '
        f'--java "{GEN_SRC}" -o "{UNALIGNED_APK}" --auto-add-overlay {flat_args}',
        "Linking Resources & Generating R.java (AAPT2)"
    )

    # 3. Find generated R.java
    r_java = None
    for root, dirs, files in os.walk(GEN_SRC):
        for f in files:
            if f == "R.java":
                r_java = os.path.join(root, f)
                break
    if not r_java:
        print("ERROR: R.java was not generated.")
        sys.exit(1)

    # 4. Compile Java sources
    java_files = [f'"{r_java}"', f'"{JAVA_SRC}"']
    run_cmd(
        f'"{JAVAC}" -source 1.8 -target 1.8 -bootclasspath "{ANDROID_JAR}" '
        f'-d "{BIN_CLASSES}" {" ".join(java_files)}',
        "Compiling Java Sources (javac 1.8)"
    )

    # Collect .class files
    class_files = []
    for root, dirs, files in os.walk(BIN_CLASSES):
        for f in files:
            if f.endswith(".class"):
                class_files.append(os.path.join(root, f))

    # 5. Convert class files to Dalvik Executable (classes.dex)
    class_args = " ".join([f'"{c}"' for c in class_files])
    run_cmd(
        f'"{JAVA}" -cp "{D8_JAR}" com.android.tools.r8.D8 --release --output "{INTERMEDIATES}" --lib "{ANDROID_JAR}" {class_args}',
        "Converting Bytecode to classes.dex (d8)"
    )

    dex_file = os.path.join(INTERMEDIATES, "classes.dex")
    if not os.path.exists(dex_file):
        print("ERROR: classes.dex was not created.")
        sys.exit(1)

    # 6. Add classes.dex into unaligned.apk
    print("\n[+] Injecting classes.dex into APK package...")
    with zipfile.ZipFile(UNALIGNED_APK, "a", compression=zipfile.ZIP_DEFLATED) as apk_zip:
        apk_zip.write(dex_file, "classes.dex")
    print("    Injected classes.dex successfully.")

    # 7. Zipalign the APK to 4-byte boundaries
    if os.path.exists(ALIGNED_APK):
        os.remove(ALIGNED_APK)
    run_cmd(
        f'"{ZIPALIGN}" -v -p 4 "{UNALIGNED_APK}" "{ALIGNED_APK}"',
        "Optimizing 4-byte Page Alignment (zipalign)"
    )

    # 8. Generate debug keystore if not present
    if not os.path.exists(KEYSTORE_PATH):
        run_cmd(
            f'"{KEYTOOL}" -genkey -v -keystore "{KEYSTORE_PATH}" -alias androiddebugkey '
            f'-storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 '
            f'-dname "CN=Android Debug,O=Android,C=US"',
            "Generating Debug Keystore"
        )

    # 9. Sign APK with apksigner (v1 + v2 + v3 scheme signatures)
    if os.path.exists(FINAL_APK):
        os.remove(FINAL_APK)
    shutil.copyfile(ALIGNED_APK, FINAL_APK)

    run_cmd(
        f'"{JAVA}" -jar "{APKSIGNER_JAR}" sign --ks "{KEYSTORE_PATH}" --ks-pass pass:android '
        f'--ks-key-alias androiddebugkey --key-pass pass:android "{FINAL_APK}"',
        "Signing APK with v2/v3 Signatures (apksigner)"
    )

    # 10. Verify signature
    run_cmd(
        f'"{JAVA}" -jar "{APKSIGNER_JAR}" verify --verbose "{FINAL_APK}"',
        "Verifying APK Signature"
    )

    apk_size_mb = os.path.getsize(FINAL_APK) / (1024 * 1024)
    print("\n" + "=" * 60)
    print("  BUILD SUCCESSFUL!")
    print(f"  Artifact: {FINAL_APK}")
    print(f"  Size:     {apk_size_mb:.2f} MB")
    print(f"  Package:  com.rainova.app")
    print("=" * 60)

if __name__ == "__main__":
    build()
