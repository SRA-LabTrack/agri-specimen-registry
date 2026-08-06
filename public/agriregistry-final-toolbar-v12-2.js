/* AGRIREGISTRY_FINAL_TOOLBAR_V12_2 */
(() => {
  "use strict";

  const TOOLBAR_CLASS = "agriregistry-final-toolbar-v122";
  const ACTIONS_CLASS = "agriregistry-final-actions-v122";
  const CONTROL_CLASS = "agriregistry-final-control-v122";
  const ITEM_CLASS = "agriregistry-final-item-v122";
  const EMAIL_PATTERN =
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

  let frame = 0;
  let settleTimer = 0;

  const normalize = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const visible = (element) => {
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

  function actions(root = document) {
    return Array.from(
      root.querySelectorAll(
        "button, a, [role='button'], input[type='button'], input[type='submit']",
      ),
    ).filter(visible);
  }

  function hint(element) {
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

    return actions(root).find((element) => {
      const text = normalize(element.textContent);
      const description = hint(element);

      return targets.some(
        (target) =>
          text === target ||
          description === target ||
          description.includes(target),
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

    const candidates = ancestorChain(registry)
      .filter((candidate) =>
        required.every((action) => candidate.contains(action)),
      )
      .filter((candidate) => {
        const rect = candidate.getBoundingClientRect();

        return (
          rect.top < 320 &&
          rect.height >= 60 &&
          rect.height <= 220 &&
          rect.width >= Math.min(window.innerWidth * 0.68, 920)
        );
      });

    return candidates[0] || null;
  }

  function directUnit(element, boundary) {
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

  function findActionsRoot(toolbar) {
    const registry = findAction("Registry", toolbar);
    if (!registry) return toolbar;

    const required = [
      registry,
      findAction("Import Excel", toolbar),
      findAction("Add specimen", toolbar),
      findAction("Updates", toolbar),
    ].filter(Boolean);

    const candidates = ancestorChain(registry)
      .filter(
        (candidate) =>
          candidate !== toolbar &&
          toolbar.contains(candidate),
      )
      .filter((candidate) =>
        required.every((action) => candidate.contains(action)),
      )
      .filter((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return rect.height >= 52 && rect.height <= 170;
      });

    return candidates[0] || toolbar;
  }

  function clearCurrentClasses() {
    document
      .querySelectorAll(
        [
          `.${TOOLBAR_CLASS}`,
          `.${ACTIONS_CLASS}`,
          `.${CONTROL_CLASS}`,
          `.${ITEM_CLASS}`,
          ".agriregistry-final-logo-v122",
          ".agriregistry-final-status-v122",
          ".agriregistry-final-status-copy-v122",
          ".agriregistry-final-status-primary-v122",
          ".agriregistry-final-status-secondary-v122",
          ".agriregistry-final-profile-v122",
          ".agriregistry-final-profile-copy-v122",
          ".agriregistry-final-profile-name-v122",
          ".agriregistry-final-profile-email-v122",
          "[class*='agriregistry-final-item-'][class*='-v122']",
        ].join(","),
      )
      .forEach((element) => {
        Array.from(element.classList)
          .filter(
            (className) =>
              className.startsWith("agriregistry-final-") &&
              className.endsWith("-v122"),
          )
          .forEach((className) => {
            element.classList.remove(className);
          });
      });
  }

  function markLogo(toolbar, actionsRoot) {
    const images = Array.from(
      toolbar.querySelectorAll("img"),
    ).filter(visible);

    const logo = images.sort((a, b) => {
      const score = (image) => {
        const description = normalize(
          `${image.alt || ""} ${image.currentSrc || image.src || ""}`,
        );
        const rect = image.getBoundingClientRect();

        return (
          Number(/agri|registry|logo/.test(description)) * 20 +
          rect.width / 80
        );
      };

      return score(b) - score(a);
    })[0] || null;

    if (!logo) return;

    const boundary =
      actionsRoot !== toolbar &&
      !actionsRoot.contains(logo)
        ? toolbar
        : actionsRoot;

    const unit =
      directUnit(logo, boundary) ||
      directUnit(logo, toolbar) ||
      logo;

    unit.classList.add("agriregistry-final-logo-v122");
  }

  function markControl(
    toolbar,
    actionsRoot,
    labels,
    key,
  ) {
    const action = findAction(labels, toolbar);
    if (!action) return null;

    action.classList.add(CONTROL_CLASS);

    const boundary =
      actionsRoot.contains(action)
        ? actionsRoot
        : toolbar;

    const unit =
      directUnit(action, boundary) ||
      action;

    unit.classList.add(
      ITEM_CLASS,
      `agriregistry-final-item-${key}-v122`,
    );

    return { action, unit };
  }

  function findStatus(
    toolbar,
    addAction,
    updatesAction,
  ) {
    const controls = actions(toolbar);

    const explicit = controls.find((element) =>
      /online|offline copy ready|syncing|connected|disconnected/.test(
        hint(element),
      ),
    );

    if (explicit) return explicit;

    const addIndex = controls.indexOf(addAction);
    const updatesIndex = controls.indexOf(updatesAction);

    if (addIndex >= 0 && updatesIndex > addIndex + 1) {
      return controls[addIndex + 1];
    }

    return null;
  }

  function markStatus(
    toolbar,
    actionsRoot,
    addAction,
    updatesAction,
  ) {
    const status = findStatus(
      toolbar,
      addAction,
      updatesAction,
    );

    if (!status) return;

    status.classList.add(
      CONTROL_CLASS,
      "agriregistry-final-status-v122",
    );

    const boundary =
      actionsRoot.contains(status)
        ? actionsRoot
        : toolbar;

    const unit =
      directUnit(status, boundary) ||
      status;

    unit.classList.add(
      ITEM_CLASS,
      "agriregistry-final-item-status-v122",
    );

    const textElements = Array.from(
      status.querySelectorAll("span, p, div"),
    ).filter(visible);

    const onlineElement = textElements.find((element) =>
      /^(online|offline|syncing|sync issue)$/i.test(
        (element.textContent || "").trim(),
      ),
    );

    const secondaryElement = textElements.find((element) =>
      /offline copy ready|local copy ready|saving changes|open to retry/i.test(
        (element.textContent || "").trim(),
      ),
    );

    if (onlineElement || secondaryElement) {
      const copy =
        onlineElement?.parentElement === secondaryElement?.parentElement
          ? onlineElement.parentElement
          : onlineElement?.parentElement || secondaryElement?.parentElement;

      copy?.classList.add(
        "agriregistry-final-status-copy-v122",
      );
      onlineElement?.classList.add(
        "agriregistry-final-status-primary-v122",
      );
      secondaryElement?.classList.add(
        "agriregistry-final-status-secondary-v122",
      );
    }
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

  function markProfile(toolbar, actionsRoot) {
    const emailElement = smallestEmailElement(toolbar);
    if (!emailElement) return;

    let profile = emailElement;

    for (let depth = 0; depth < 8; depth += 1) {
      const parent = profile.parentElement;

      if (
        !parent ||
        !toolbar.contains(parent)
      ) {
        break;
      }

      const rect = parent.getBoundingClientRect();
      profile = parent;

      if (
        rect.width >= 145 &&
        rect.width <= 460 &&
        rect.height >= 42 &&
        rect.height <= 100 &&
        actions(parent).length >= 1
      ) {
        break;
      }
    }

    profile.classList.add(
      "agriregistry-final-profile-v122",
    );

    const profileBoundary =
      actionsRoot.contains(profile)
        ? actionsRoot
        : toolbar;

    const unit =
      directUnit(profile, profileBoundary);

    if (unit && unit !== profile) {
      unit.classList.add(
        ITEM_CLASS,
        "agriregistry-final-profile-v122",
      );
    }

    emailElement.classList.add(
      "agriregistry-final-profile-email-v122",
    );

    const emailMatch = (
      emailElement.textContent || ""
    ).match(EMAIL_PATTERN);

    if (emailMatch) {
      emailElement.setAttribute("title", emailMatch[0]);
    }

    const nameCandidates = Array.from(
      profile.querySelectorAll("span, p, div"),
    )
      .filter(visible)
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

    const nameElement = nameCandidates[0] || null;
    nameElement?.classList.add(
      "agriregistry-final-profile-name-v122",
    );

    const copy =
      nameElement &&
      nameElement.parentElement === emailElement.parentElement
        ? nameElement.parentElement
        : emailElement.parentElement;

    copy?.classList.add(
      "agriregistry-final-profile-copy-v122",
    );
  }

  function apply() {
    clearCurrentClasses();

    const toolbar = findToolbar();
    if (!toolbar) return;

    toolbar.classList.add(TOOLBAR_CLASS);

    const actionsRoot = findActionsRoot(toolbar);
    actionsRoot.classList.add(ACTIONS_CLASS);

    markLogo(toolbar, actionsRoot);

    markControl(
      toolbar,
      actionsRoot,
      "Registry",
      "registry",
    );
    markControl(
      toolbar,
      actionsRoot,
      "Import Excel",
      "import",
    );
    const add = markControl(
      toolbar,
      actionsRoot,
      "Add specimen",
      "add",
    );
    const updates = markControl(
      toolbar,
      actionsRoot,
      "Updates",
      "updates",
    );
    markControl(
      toolbar,
      actionsRoot,
      ["Exit full screen", "Full screen"],
      "fullscreen",
    );
    markControl(
      toolbar,
      actionsRoot,
      "Minimize",
      "minimize",
    );
    markControl(
      toolbar,
      actionsRoot,
      "Exit",
      "exit",
    );

    markStatus(
      toolbar,
      actionsRoot,
      add?.action,
      updates?.action,
    );

    markProfile(toolbar, actionsRoot);
  }

  function schedule() {
    if (frame) cancelAnimationFrame(frame);

    frame = requestAnimationFrame(() => {
      frame = 0;
      apply();
    });

    clearTimeout(settleTimer);
    settleTimer = window.setTimeout(apply, 180);
  }

  const observer = new MutationObserver(schedule);

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  window.addEventListener("resize", schedule, {
    passive: true,
  });
  window.addEventListener("pageshow", schedule, {
    passive: true,
  });

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      schedule,
      { once: true },
    );
  }

  window.setTimeout(apply, 0);
  window.setTimeout(apply, 120);
  window.setTimeout(apply, 500);
})();
