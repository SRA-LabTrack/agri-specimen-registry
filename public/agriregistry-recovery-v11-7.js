/* AGRIREGISTRY_STABILITY_RECOVERY_V11_7 */
(() => {
  "use strict";

  const restorePage = () => {
    document
      .querySelectorAll("[data-agriregistry-v116-original]")
      .forEach((element) => {
        element.removeAttribute("data-agriregistry-v116-original");
      });

    document
      .querySelectorAll(".agriregistry-v11-fixed-toolbar-ancestor")
      .forEach((element) => {
        element.classList.remove(
          "agriregistry-v11-fixed-toolbar-ancestor",
        );

        for (const property of [
          "transform",
          "translate",
          "rotate",
          "scale",
          "filter",
          "perspective",
          "contain",
          "content-visibility",
          "will-change",
          "clip-path",
          "overflow",
          "overflow-x",
          "overflow-y",
        ]) {
          element.style.removeProperty(property);
        }
      });

    document
      .querySelectorAll(
        [
          ".agriregistry-v11-fixed-toolbar",
          ".agriregistry-v11-viewport-fixed",
        ].join(","),
      )
      .forEach((element) => {
        element.classList.remove(
          "agriregistry-v11-fixed-toolbar",
          "agriregistry-v11-viewport-fixed",
        );

        for (const property of [
          "position",
          "inset",
          "top",
          "left",
          "right",
          "bottom",
          "width",
          "min-width",
          "max-width",
          "height",
          "min-height",
          "max-height",
          "margin",
          "transform",
          "translate",
          "rotate",
          "scale",
          "z-index",
        ]) {
          element.style.removeProperty(property);
        }
      });

    document.getElementById("agriregistry-v116-toolbar")?.remove();
  };

  restorePage();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", restorePage, {
      once: true,
    });
  }

  window.addEventListener("pageshow", restorePage, {
    passive: true,
  });

  window.setTimeout(restorePage, 50);
  window.setTimeout(restorePage, 300);
})();
