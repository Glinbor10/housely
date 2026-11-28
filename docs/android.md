# The Android app (APK)

Housely is a web app (a PWA). The Android app is a thin shell around it: it opens the website of
production with Chrome, without the address bar, and it has its own icon. This is called a
**Trusted Web Activity (TWA)**.

## Why not a WebView

A WebView (the browser that apps embed) is the other common way to wrap a website. Housely does not use
it because **Google does not allow signing in with Google inside an embedded WebView**. A TWA runs in
Chrome itself, so signing in, the service worker (offline) and updates work exactly as on the website.
It also means the app never needs an update when the website changes: it always opens the latest one.

## What is an APK, and what is signing

An APK is the file that Android installs. Android refuses to install an app that is not **signed**: the
signature is made with a private key, and it proves that an update comes from the same author as the app
that is already installed. Three things follow:

- The key is created once and kept forever. If it is lost, the app can never be updated: people would
  have to uninstall it and install a new one.
- It is a secret. It is never committed to the repository: it lives in GitHub as encrypted secrets.
- Without the key a **debug APK** can still be built: it is signed with an automatic key that changes
  from one machine to another. It is good for trying the app, and never attached to a release.

## How the project is organized

```
android/                         the Gradle project
  app/build.gradle               versions, the website to open, signing (reads the key from secrets)
  app/src/main/AndroidManifest.xml    the only screen: LauncherActivity of androidbrowserhelper
  app/src/main/res/              icons (generated with `npm run icons:android`) and colors
.github/actions/build-android/   the steps that build the APK (shared by the two workflows)
.github/workflows/android.yml    builds an APK by hand, to try it without a release
.github/workflows/release-action.yml   the release also builds the signed APK and attaches it
public/.well-known/assetlinks.json     what hides the address bar (see below)
```

`androidbrowserhelper` (Google) does the work: it starts Chrome in TWA mode on the URL given in the
manifest. There is no Java or Kotlin code of ours.

### What hides the address bar: Digital Asset Links

Chrome only hides its address bar when it can prove that the website and the app belong to the same
person. The app says it in `build.gradle` (`asset_statements`) and the website says it back in
`https://housely-prod.web.app/.well-known/assetlinks.json`, with the package name and the **SHA-256
fingerprint of the signing key**. If they do not match (or the file is empty, like at the beginning) the
app still works, but it shows a thin address bar at the top.

## Creating the signing key (once)

You need a JDK for `keytool`. Run it in a safe folder that is **not** the repository:

```sh
keytool -genkeypair -v -keystore housely.keystore -alias housely -keyalg RSA -keysize 2048 -validity 10000
```

It asks for two passwords (the store and the key; they can be the same) and some data about you. Then:

1. **Keep a backup** of `housely.keystore` and the passwords in a password manager.
2. Encode the file and store it as a GitHub secret (the first command prints the value; copy it):

   ```sh
   base64 -w0 housely.keystore            # on macOS: base64 -i housely.keystore
   ```

   In the repository, **Settings → Secrets and variables → Actions → New repository secret**, create:

   | Secret                      | Value                              |
   | --------------------------- | ---------------------------------- |
   | `ANDROID_KEYSTORE_BASE64`   | the output of the `base64` command |
   | `ANDROID_KEYSTORE_PASSWORD` | the store password                 |
   | `ANDROID_KEY_ALIAS`         | `housely`                          |
   | `ANDROID_KEY_PASSWORD`      | the key password                   |

3. Get the fingerprint and put it in `public/.well-known/assetlinks.json`:

   ```sh
   keytool -list -v -keystore housely.keystore -alias housely | grep SHA256
   ```

   ```json
   [
     {
       "relation": ["delegate_permission/common.handle_all_urls"],
       "target": {
         "namespace": "android_app",
         "package_name": "io.github.glinbor10.housely",
         "sha256_cert_fingerprints": ["AA:BB:...:FF"]
       }
     }
   ]
   ```

## When it is built

The APK that people get is built **only by a release**, in the same run that deploys the website to
production, so the app and the website always go together. No pull request or merge builds one.

The app is a shell that opens the live website, so people always see the latest web; the APK is only
rebuilt so that its version matches the release.

Only the APK of the **latest** release is kept: once a release has attached its APK, the release workflow
removes the APK of every older release. The older releases and their tags stay.

## Trying it without a release

This is optional and only by hand; nothing runs it automatically.

**Actions → Android APK → Run workflow**, choose `ci` (or `production`) and, once the secrets exist,
tick _Sign it with the release key_. When it finishes, download the artifact `housely-android-ci`, which
is the APK. The CI build has another package name (`io.github.glinbor10.housely.ci`) and the label
_Housely CI_, so it can be installed next to the production one.

The summary of the run shows the SHA-256 fingerprint of the key that signed the APK.

## Installing it

1. Send the `.apk` to the phone (a message, a cable, a link to the release).
2. Open it. Android asks for permission to install apps from that source the first time.
3. Open Housely from the launcher. If there is a thin bar at the top, the fingerprint in
   `assetlinks.json` does not match the key that signed the APK.

## In a release

The release workflow has a job that builds the APK against production, with the version of the release,
and attaches it to the GitHub Release. If the `ANDROID_*` secrets are not set it only prints a warning:
a debug APK is never published.

The version code that Android needs is made from the version: `1.2.3` becomes `10203`.

## Download

Every release attaches the signed APK, named `housely-X.Y.Z-release.apk`, to its GitHub Release:
<https://github.com/Glinbor10/housely/releases/latest>

**In testing:** the signed APK may not open on some phones (nothing happens on tap, with Chrome installed).
Until the cause is found, the user manual sends people to install the app from Chrome.

The signing key and its passwords live outside the repository, on the owner's computer, and in the
`ANDROID_*` secrets. The key was replaced on 2026-11-14  before any APK was published.

## Building on your computer

Install JDK 17, the Android SDK (Android Studio brings it) and Gradle 8.14, then:

```sh
gradle -p android assembleDebug -PtwaHost=housely-ci.web.app -PappIdSuffix=.ci -PappLabel="Housely CI"
```

The APK is in `android/app/build/outputs/apk/debug/`.
