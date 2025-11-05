# Code Signing Guide (Windows first)

This guide explains how to set up code signing for Knurl on Windows. It covers choosing and obtaining a code‑signing certificate, preparing your machine, signing the built artifacts (the app EXE and installer), and verifying signatures. Linux/macOS notes are stubbed at the end; we’ll expand them next.

Note: Do not commit private keys or certificate files to the repository. Use secure secret storage (e.g., a password vault, cloud KMS, or CI secrets) and follow least‑privilege practices.


## 1) Choose a Certificate Type and Provider

You have two primary options for Windows code signing:

- EV Code Signing (Extended Validation)
  - Pros: Immediate SmartScreen trust in most cases, hardware token (HSM) based keys, stronger vetting.
  - Cons: More expensive, requires physical USB token (or HSM), more setup friction and harder to use in CI.
- OV Code Signing (Organization Validation)
  - Pros: More affordable, receives trust over time as the reputation builds.
  - Cons: May show SmartScreen warnings initially; private key typically stored in a PFX file.

Common providers: DigiCert, Sectigo, SSL.com, GlobalSign, Certum. Choose one that fits your compliance and budget.

What you’ll need for issuance:
- Legal entity info (organization name, address, phone)
- Government or business registration documents
- A publicly listed phone number (or the ability to verify a listed number)
- For EV: identity checks and a shipping address for the hardware token


## 2) Generate a CSR and Key (OV PFX path)

If you opt for OV and want to manage your key as a file (PFX/P12), generate a private key and CSR. Some CAs offer in‑browser CSR generation; otherwise you can use OpenSSL.

Example (OpenSSL, 3072‑bit RSA):

```bash
# Generate private key
openssl genrsa -out org-codesign.key 3072

# Generate CSR (adjust subject to your entity)
openssl req -new -sha256 \
  -key org-codesign.key \
  -out org-codesign.csr \
  -subj "/C=US/ST=CA/L=City/O=Org, Inc./CN=Org, Inc. Code Signing"
```

Submit the CSR to your CA and complete the validation steps. When issued, you’ll receive a certificate (and chain). Convert to a PFX for use with SignTool:

```bash
# Combine end‑entity cert + chain into a PFX. You’ll set an export password.
openssl pkcs12 -export \
  -in code_signing.crt \
  -inkey org-codesign.key \
  -certfile chain.crt \
  -out codesign.pfx
```

EV certificates usually arrive on a hardware token. CSR/key handling differs; follow your CA’s instructions and token middleware. You’ll typically identify the cert by subject name or thumbprint in the Windows cert store when signing.


## 3) Install Tools on Windows

- Install the Windows 10/11 SDK, which includes `signtool.exe`.
  - Quick way: install Visual Studio Build Tools and select “Windows SDK”.
- Ensure `signtool.exe` is on `PATH` (e.g., `C:\Program Files (x86)\Windows Kits\10\bin\<version>\x64`).

Timestamp servers (RFC 3161):
- DigiCert: `http://timestamp.digicert.com`
- Sectigo: `http://timestamp.sectigo.com`
- GlobalSign: `http://timestamp.globalsign.com/scripts/timstamp.dll`

Prefer `/tr` (RFC 3161) with `/td sha256`.


## 4) Build Artifacts

Build a release with Tauri (Windows):

```bash
yarn install
yarn tauri build
```

Artifacts (paths may vary slightly by version/arch):
- Installer (NSIS): `src-tauri/target/release/bundle/nsis/knurl_<version>_x64-setup.exe`
- App EXE: `src-tauri/target/release/knurl.exe` (or under bundle dir depending on config)

If in doubt, inspect `src-tauri/target/release/bundle/` after the build.


## 5) Sign with a PFX file (OV)

Use `signtool.exe` with your PFX and password. Sign both the app EXE and the installer EXE.

```powershell
# Example: sign app EXE
signtool sign `
  /f C:\secrets\codesign\codesign.pfx `
  /p $Env:CODESIGN_PFX_PASSWORD `
  /fd sha256 `
  /tr http://timestamp.digicert.com `
  /td sha256 `
  /v `
  "C:\path\to\src-tauri\target\release\knurl.exe"

# Example: sign installer
signtool sign `
  /f C:\secrets\codesign\codesign.pfx `
  /p $Env:CODESIGN_PFX_PASSWORD `
  /fd sha256 `
  /tr http://timestamp.digicert.com `
  /td sha256 `
  /v `
  "C:\path\to\src-tauri\target\release\bundle\nsis\knurl_<version>_x64-setup.exe"
```

Tips:
- Always include a timestamp (`/tr` + `/td sha256`).
- You can repeat `signtool sign` to “dual sign” if needed (rare now; SHA‑256 is standard).


## 6) Sign with a Hardware Token (EV)

With EV certificates, the private key lives on a token. Install the token’s middleware. Then reference the cert by subject name or thumbprint in the Windows cert store.

Find thumbprint:
1. Open `certlm.msc` (Local Computer) or `certmgr.msc` (Current User), locate the code signing cert under `Personal`.
2. View Details → Thumbprint. Remove spaces when using in commands.

Example using subject name:

```powershell
signtool sign `
  /n "Org, Inc." `
  /fd sha256 `
  /tr http://timestamp.digicert.com `
  /td sha256 `
  /v `
  "C:\path\to\src-tauri\target\release\knurl.exe"
```

Example using thumbprint:

```powershell
signtool sign `
  /sha1 ABCDEF1234567890ABCDEF1234567890ABCDEF12 `
  /fd sha256 `
  /tr http://timestamp.digicert.com `
  /td sha256 `
  /v `
  "C:\path\to\src-tauri\target\release\bundle\nsis\knurl_<version>_x64-setup.exe"
```

If you have both user/machine stores, you might need `/sm` (machine store) or `/s My` to specify a store.


## 7) Verify Signatures

```powershell
signtool verify /pa /v "C:\path\to\knurl.exe"
signtool verify /pa /v "C:\path\to\knurl_<version>_x64-setup.exe"
```

Look for a successful chain to a trusted root and a valid RFC 3161 timestamp.


## 8) CI (GitHub Actions) sketch (Windows Runner)

If you choose OV (PFX), you can sign in CI on a Windows runner. Store secrets in GitHub Actions Secrets:
- `CODESIGN_PFX_BASE64` (base64‑encoded PFX file)
- `CODESIGN_PFX_PASSWORD`

Example job step (post‑build):

```yaml
- name: Restore PFX to disk
  shell: pwsh
  run: |
    $pfxBytes = [Convert]::FromBase64String("${{ secrets.CODESIGN_PFX_BASE64 }}")
    New-Item -ItemType Directory -Force -Path "$Env:USERPROFILE\\codesign" | Out-Null
    [IO.File]::WriteAllBytes("$Env:USERPROFILE\\codesign\\codesign.pfx", $pfxBytes)

- name: Sign artifacts
  shell: pwsh
  env:
    CODESIGN_PFX_PASSWORD: ${{ secrets.CODESIGN_PFX_PASSWORD }}
  run: |
    $signtool = "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\**\\x64\\signtool.exe"
    $signtool = (Get-ChildItem $signtool | Select-Object -First 1).FullName
    & "$signtool" sign /f "$Env:USERPROFILE\\codesign\\codesign.pfx" /p "$Env:CODESIGN_PFX_PASSWORD" /fd sha256 /tr http://timestamp.digicert.com /td sha256 /v "src-tauri\\target\\release\\bundle\\nsis\\knurl_*_x64-setup.exe"
```

EV tokens generally don’t work well in hosted CI. If you need EV in CI, consider a dedicated self‑hosted runner with USB token passthrough, or a cloud signing service/HSM that integrates with SignTool.


## 9) Developer Test Certificates (local only)

You can test the signing flow locally with a self‑signed code signing cert. This will not confer SmartScreen trust but is useful to validate the pipeline.

PowerShell example:

```powershell
# Create a test code‑signing certificate in CurrentUser\My
$cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Knurl Test" -KeyAlgorithm RSA -KeyLength 3072 -HashAlgorithm SHA256 -CertStoreLocation Cert:\CurrentUser\My

# Sign a file using subject name
signtool sign /n "Knurl Test" /fd sha256 /tr http://timestamp.digicert.com /td sha256 /v "C:\path\to\knurl.exe"
```


## 10) SmartScreen Reputation

- OV: SmartScreen reputation accumulates over time as more users install your signed binaries. Initial warnings are normal.
- EV: Typically avoids SmartScreen warnings from the start due to the stronger identity assurance and hardware‑backed key.


## 11) Tips and Gotchas

- Always timestamp (`/tr` + `/td sha256`), or the signature can become invalid when the cert expires.
- Keep private keys secure. Prefer HSM/token for production if viable.
- Sign every user‑downloaded executable: portable EXEs, installers, update patchers.
- If you change your organization name, you’ll need a new certificate.
- If using OpenSSL keys + issued certs, make sure the chain is complete when exporting PFX (`-certfile chain.crt`).


---

## Linux (stub)

- Common approaches: 
  - Package manager signatures (e.g., .deb/.rpm via GPG), 
  - AppImage signing with `appimage-sign`/`gpg`, 
  - Flatpak (ostree) signatures handled by Flathub or your repo.
- We’ll document distro‑specific signing once targets are finalized.

## macOS (stub)

- Requires an Apple Developer account ($99/year).
- Create a “Developer ID Application” certificate in Apple Keychain.
- Use `codesign` to sign the app bundle and binaries, then `productsign` (or `xcrun notarytool` for notarization):
  - `codesign --deep --force --options runtime --sign "Developer ID Application: Org, Inc." <app>`
  - Submit for notarization with `notarytool`, then staple the ticket.
- We’ll provide a detailed, Tauri‑specific walkthrough in a follow‑up.

