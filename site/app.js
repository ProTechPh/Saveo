// Progressive enhancement: on Windows, point the download buttons straight at the
// latest installer so visitors skip the release page. Without this file the page
// still works — every link falls back to the releases page.
(() => {
  const RELEASE_PAGE = "https://github.com/ProTechPh/Saveo/releases/latest";
  const API = "https://api.github.com/repos/ProTechPh/Saveo/releases/latest";

  const pickExe = (release) =>
    (release.assets || []).find((a) => /\.exe$/i.test(a.name))?.browser_download_url || "";

  // exposed so the page check can prove the selection without network access
  window.__saveoPickExe = pickExe;

  const isWindows = /Windows/i.test(
    navigator.userAgentData?.platform || navigator.userAgent || ""
  );

  fetch(API, { headers: { Accept: "application/vnd.github+json" } })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.status))))
    .then((release) => {
      const version = String(release.tag_name || "").replace(/^v/, "");
      document.querySelectorAll("[data-version]").forEach((el) => {
        if (version) el.textContent = `v${version}`;
      });

      const exe = pickExe(release);
      if (!isWindows || !exe) return;
      document.querySelectorAll("[data-download]").forEach((link) => {
        link.href = exe;
        link.title = `Saveo ${release.tag_name} installer (.exe)`;
      });
      document.querySelectorAll("[data-download-label]").forEach((el) => {
        el.textContent = "Download installer (.exe)";
      });
    })
    .catch(() => {
      document.querySelectorAll("[data-download]").forEach((link) => {
        link.href = RELEASE_PAGE;
      });
    });
})();
