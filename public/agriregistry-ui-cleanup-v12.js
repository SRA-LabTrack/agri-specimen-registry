/* AGRIREGISTRY_UI_CLEANUP_V12
   Removes stale classes and inline styles left by prior toolbar experiments.
   It does not restyle or replace the application's own UI.
*/
(() => {
  "use strict";

  const staleClasses = [
    "agriregistry-v9-toolbar",
    "agriregistry-v9-actions",
    "agriregistry-v9-logo",
    "agriregistry-v9-control",
    "agriregistry-v9-profile",
    "agriregistry-v10-toolbar",
    "agriregistry-v10-actions",
    "agriregistry-v10-logo",
    "agriregistry-v10-control",
    "agriregistry-v10-status",
    "agriregistry-v10-profile",
    "agriregistry-v10-email",
    "agriregistry-v11-toolbar",
    "agriregistry-v11-actions",
    "agriregistry-v11-logo",
    "agriregistry-v11-control",
    "agriregistry-v11-status",
    "agriregistry-v11-profile",
    "agriregistry-v11-email",
    "agriregistry-v11-fixed-toolbar",
    "agriregistry-v11-viewport-fixed",
    "agriregistry-v11-fixed-toolbar-ancestor",
    "agriregistry-v118-toolbar",
    "agriregistry-v118-actions",
    "agriregistry-v118-logo",
    "agriregistry-v118-control",
    "agriregistry-v118-item",
    "agriregistry-v118-status",
    "agriregistry-v118-profile",
    "agriregistry-v118-profile-copy",
    "agriregistry-v118-profile-name",
    "agriregistry-v118-profile-email",
    "agriregistry-native-toolbar-v119",
    "agriregistry-native-row-v119",
    "agriregistry-native-logo-v119",
    "agriregistry-native-control-v119",
    "agriregistry-native-status-v119",
    "agriregistry-native-profile-v119",
  ];

  const staleAttributes = [
    "data-agriregistry-v116-original",
    "data-v10-status-primary",
    "data-v10-status-secondary",
    "data-agriregistry-native-name",
    "data-agriregistry-native-email",
  ];

  const staleInlineProperties = [
    "--agriregistry-v11-fixed-left",
    "--agriregistry-v11-fixed-top",
    "--agriregistry-v11-fixed-width",
    "--agriregistry-v11-toolbar-shift-x",
    "--agriregistry-v11-toolbar-viewport-width",
  ];

  function clean() {
    document.getElementById("agriregistry-v116-toolbar")?.remove();
    document.getElementById("agriregistry-v118-login-splash")?.remove();

    document.querySelectorAll("*").forEach((element) => {
      staleClasses.forEach((className) => {
        element.classList.remove(className);
      });

      staleAttributes.forEach((attribute) => {
        element.removeAttribute(attribute);
      });

      staleInlineProperties.forEach((property) => {
        element.style.removeProperty(property);
      });
    });
  }

  clean();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", clean, { once: true });
  }

  window.addEventListener("pageshow", clean, { passive: true });
  window.setTimeout(clean, 50);
  window.setTimeout(clean, 250);
})();
