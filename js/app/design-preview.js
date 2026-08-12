(function initializeDesignPreview(global) {
  const params = new URLSearchParams(global.location.search);
  const isLegacyDesign = params.get("design") === "legacy";

  if (!isLegacyDesign) {
    global.document.documentElement.classList.add("design-v2");
  }

  global.__designPreviewMode = isLegacyDesign ? "legacy" : "v2";
})(window);
