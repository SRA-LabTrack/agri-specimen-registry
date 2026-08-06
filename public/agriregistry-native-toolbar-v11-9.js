/* AGRIREGISTRY_NATIVE_TOOLBAR_V11_9 */
(() => {
  "use strict";

  const TOOLBAR_CLASS = "agriregistry-native-toolbar-v119";
  const ROW_CLASS = "agriregistry-native-row-v119";
  const CONTROL_CLASS = "agriregistry-native-control-v119";
  const EMAIL_PATTERN =
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

  let scheduledFrame = 0;
  let settleTimer = 0;

  const normalize = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const isVisible = (element) => {
    if (!(element instanceof HTMLElement)) return false;

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  };

  function removeOldPatchEffects() {
    document.getElementById("agriregistry-v116-toolbar")?.remove();

    document
      .querySelectorAll("[data-agriregistry-v116-original]")
      .forEach((element) => {
        element.removeAttribute("data-agriregistry-v116-original");
      });

    const legacyClasses = [
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
    ];

    document.querySelectorAll("*").forEach((element) => {
      for (const className of legacyClasses) {
        element.classList.remove(className);
      }

      for (const attribute of [
        "data-v10-status-primary",
        "data-v10-status-secondary",
      ]) {
        element.removeAttribute(attribute);
      }
    });
  }

  function actionElements(root = document) {
    return Array.from(
      root.querySelectorAll(
        "button, a, [role='button'], input[type='button'], input[type='submit']",
      ),
    ).filter(isVisible);
  }

  function actionHint(element) {
    return normalize(
      [
        element.textContent,
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
        element.getAttribute("value"),
      ].join(" "),
    );
  }

  function findAction(labels, root = document) {
    const targets = (Array.isArray(labels) ? labels : [labels])
      .map(normalize);

    return actionElements(root).find((element) => {
      const text = normalize(element.textContent);
      const hint = actionHint(element);

      return targets.some(
        (target) =>
          text === target ||
          hint === target ||
          hint.includes(target),
      );
    }) || null;
  }

  function ancestorChain(element) {
    const chain = [];
    let current = element;

    while (
      current &&
      current !== document.body &&
      current !== document.documentElement
    ) {
      chain.push(current);
      current = current.parentElement;
    }

    return chain;
  }

  function containsRequiredActions(candidate, actions) {
    return actions.every(
      (action) => !action || candidate.contains(action),
    );
  }

  function findToolbar() {
    const registry = findAction("Registry");
    const importExcel = findAction("Import Excel");
    const addSpecimen = findAction("Add specimen");
    const updates = findAction("Updates");

    const required = [
      registry,
      importExcel,
      addSpecimen,
      updates,
    ].filter(Boolean);

    if (required.length < 3) return null;

    const optional = [
      findAction(["Exit full screen", "Full screen"]),
      findAction("Minimize"),
      actionElements().find(
        (element) => normalize(element.textContent) === "exit",
      ) || null,
    ];

    const actions = [...required, ...optional];

    const candidates = ancestorChain(registry)
      .filter((candidate) =>
        containsRequiredActions(candidate, actions),
      )
      .filter((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return (
          rect.top < 360 &&
          rect.height >= 60 &&
          rect.height <= 260 &&
          rect.width >= Math.min(window.innerWidth * 0.65, 850)
        );
      });

    return candidates[0] || null;
  }

  function directChildUnder(element, boundary) {
    if (!element || !boundary) return null;

    let current = element;
    while (
      current.parentElement &&
      current.parentElement !== boundary
    ) {
      current = current.parentElement;
    }

    return current;
  }

  function findRow(toolbar) {
    const controls = [
      findAction("Registry", toolbar),
      findAction("Import Excel", toolbar),
      findAction("Add specimen", toolbar),
      findAction("Updates", toolbar),
      findAction(["Exit full screen", "Full screen"], toolbar),
      findAction("Minimize", toolbar),
    ].filter(Boolean);

    const rowCandidates = ancestorChain(controls[0])
      .filter((candidate) => toolbar.contains(candidate))
      .filter((candidate) =>
        controls.every((control) => candidate.contains(control)),
      )
      .filter((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return rect.height >= 55 && rect.height <= 190;
      });

    const actionRow = rowCandidates[0] || null;
    if (!actionRow) return toolbar;

    const logoImage = Array.from(
      toolbar.querySelectorAll("img"),
    ).find(isVisible);

    const logoUnit = logoImage
      ? directChildUnder(logoImage, toolbar)
      : null;

    const actionUnit = directChildUnder(actionRow, toolbar);

    if (
      actionUnit &&
      logoUnit &&
      actionUnit !== logoUnit &&
      actionUnit.parentElement === toolbar &&
      logoUnit.parentElement === toolbar
    ) {
      toolbar.classList.add(ROW_CLASS);
      return toolbar;
    }

    actionRow.classList.add(ROW_CLASS);
    return actionRow;
  }

  function markLogo(toolbar, row) {
    const images = Array.from(
      toolbar.querySelectorAll("img"),
    ).filter(isVisible);

    const logoImage = images.sort((a, b) => {
      const score = (image) => {
        const hint = normalize(
          `${image.alt || ""} ${image.currentSrc || image.src || ""}`,
        );
        const rect = image.getBoundingClientRect();

        return (
          Number(/agri|registry|logo/.test(hint)) * 20 +
          Number(rect.width >= rect.height) * 3 +
          rect.width / 100
        );
      };

      return score(b) - score(a);
    })[0] || null;

    if (!logoImage) return;

    const logoUnit =
      directChildUnder(logoImage, row) ||
      directChildUnder(logoImage, toolbar) ||
      logoImage;

    logoUnit.classList.add(
      "agriregistry-native-logo-v119",
    );
  }

  function markControls(toolbar) {
    actionElements(toolbar).forEach((element) => {
      element.classList.add(CONTROL_CLASS);
    });
  }

  function markStatus(toolbar) {
    const controls = actionElements(toolbar);

    let status = controls.find((element) =>
      /online|offline copy ready|syncing|connected|disconnected/.test(
        actionHint(element),
      ),
    );

    if (!status) {
      const add = findAction("Add specimen", toolbar);
      const updates = findAction("Updates", toolbar);
      const addIndex = controls.indexOf(add);
      const updatesIndex = controls.indexOf(updates);

      if (addIndex >= 0 && updatesIndex > addIndex + 1) {
        status = controls[addIndex + 1];
      }
    }

    if (!status) return;

    status.classList.add(
      "agriregistry-native-status-v119",
    );

    const unit = directChildUnder(status, toolbar);
    unit?.classList.add(
      "agriregistry-native-status-v119",
    );
  }

  function smallestEmailElement(toolbar) {
    return Array.from(toolbar.querySelectorAll("*"))
      .filter((element) =>
        EMAIL_PATTERN.test(element.textContent || ""),
      )
      .sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();

        return (
          aRect.width * aRect.height -
          bRect.width * bRect.height
        );
      })[0] || null;
  }

  function markProfile(toolbar) {
    const emailElement = smallestEmailElement(toolbar);
    if (!emailElement) return;

    let profile = emailElement;

    for (let depth = 0; depth < 8; depth += 1) {
      const parent = profile.parentElement;
      if (!parent || !toolbar.contains(parent)) break;

      const rect = parent.getBoundingClientRect();
      profile = parent;

      if (
        rect.width >= 150 &&
        rect.width <= 440 &&
        rect.height >= 44 &&
        rect.height <= 100 &&
        actionElements(parent).length >= 1
      ) {
        break;
      }
    }

    profile.classList.add(
      "agriregistry-native-profile-v119",
    );

    const emailMatch = (
      emailElement.textContent || ""
    ).match(EMAIL_PATTERN);

    if (emailMatch) {
      emailElement.setAttribute(
        "data-agriregistry-native-email",
        "true",
      );
      emailElement.setAttribute("title", emailMatch[0]);
    }

    const nameCandidates = Array.from(
      profile.querySelectorAll("span, p, div"),
    )
      .filter(isVisible)
      .filter((element) => {
        const ownText = Array.from(element.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.nodeValue || "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        if (!ownText) return false;
        if (EMAIL_PATTERN.test(ownText)) return false;

        const normalized = normalize(ownText);

        return (
          ownText.length >= 3 &&
          ownText.length <= 90 &&
          /[a-z]/i.test(ownText) &&
          ![
            "logout",
            "log out",
            "sign out",
            "exit",
          ].includes(normalized)
        );
      })
      .sort((a, b) => {
        const aLength =
          (a.textContent || "").trim().length;
        const bLength =
          (b.textContent || "").trim().length;
        return bLength - aLength;
      });

    nameCandidates[0]?.setAttribute(
      "data-agriregistry-native-name",
      "true",
    );
  }

  function applyRepair() {
    removeOldPatchEffects();

    const toolbar = findToolbar();
    if (!toolbar) return;

    document
      .querySelectorAll(`.${TOOLBAR_CLASS}`)
      .forEach((element) => {
        if (element !== toolbar) {
          element.classList.remove(TOOLBAR_CLASS);
        }
      });

    toolbar.classList.add(TOOLBAR_CLASS);

    const row = findRow(toolbar);
    row.classList.add(ROW_CLASS);

    markLogo(toolbar, row);
    markControls(toolbar);
    markStatus(toolbar);
    markProfile(toolbar);
  }

  function scheduleRepair() {
    if (scheduledFrame) {
      cancelAnimationFrame(scheduledFrame);
    }

    scheduledFrame = requestAnimationFrame(() => {
      scheduledFrame = 0;
      applyRepair();
    });

    clearTimeout(settleTimer);
    settleTimer = window.setTimeout(
      applyRepair,
      180,
    );
  }

  const observer = new MutationObserver(
    scheduleRepair,
  );

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  window.addEventListener(
    "resize",
    scheduleRepair,
    { passive: true },
  );
  window.addEventListener(
    "pageshow",
    scheduleRepair,
    { passive: true },
  );

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      scheduleRepair,
      { once: true },
    );
  }

  window.setInterval(applyRepair, 1400);
  window.setTimeout(applyRepair, 0);
  window.setTimeout(applyRepair, 100);
  window.setTimeout(applyRepair, 500);
})();
