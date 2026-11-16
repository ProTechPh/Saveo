// Progressive enhancement: rewrite the download buttons to the latest release assets
// (installer for Windows, APK for Android) so visitors skip the release page. Without
// this file every link stays on the releases page.
(() => {
  const RELEASE_PAGE = "https://github.com/ProTechPh/Saveo/releases/latest";
  const API = "https://api.github.com/repos/ProTechPh/Saveo/releases/latest";

  const pickAsset = (release, ext) =>
    (release.assets || []).find((a) => a.name.toLowerCase().endsWith(ext))
      ?.browser_download_url || "";

  // exposed so the page check can prove the selection without network access
  window.__saveoPickAsset = pickAsset;

  const ua = navigator.userAgentData?.platform || navigator.userAgent || "";
  const visitor = /Android/i.test(ua) ? "android" : /Windows/i.test(ua) ? "windows" : "";

  fetch(API, { headers: { Accept: "application/vnd.github+json" } })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.status))))
    .then((release) => {
      const version = String(release.tag_name || "").replace(/^v/, "");
      document.querySelectorAll("[data-version]").forEach((el) => {
        if (version) el.textContent = `v${version}`;
      });

      document.querySelectorAll("[data-download]").forEach((link) => {
        const target = link.dataset.download || visitor;
        const url = target === "windows" ? pickAsset(release, ".exe")
          : target === "android" ? pickAsset(release, ".apk")
          : "";
        if (!url) return;
        link.href = url;
        link.title = `Saveo ${release.tag_name} ${target} download`;
        const label = link.querySelector("[data-download-label]");
        if (label && target === visitor && target === "windows") {
          label.textContent = "Download installer (.exe)";
        } else if (label && target === visitor && target === "android") {
          label.textContent = "Download APK";
        }
      });
    })
    .catch(() => {
      document.querySelectorAll("[data-download]").forEach((link) => {
        link.href = RELEASE_PAGE;
      });
    });
})();
