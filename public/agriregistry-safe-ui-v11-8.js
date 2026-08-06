/* AGRIREGISTRY_SAFE_UI_V11_8 */
(() => {
  "use strict";

  const TOOLBAR_CLASS = "agriregistry-v118-toolbar";
  const PENDING_KEY = "agriregistry-login-animation-pending-v118";
  const LOGO_KEY = "agriregistry-login-animation-logo-v118";
  const EMAIL_PATTERN =
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

  let initialized = false;
  let loginWasVisible = false;
  let animationShown = false;
  let scheduled = 0;

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

  function removeBrokenPatchEffects() {
    document.getElementById("agriregistry-v116-toolbar")?.remove();

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

  function allActions(root = document) {
    return Array.from(
      root.querySelectorAll(
        "button, a, [role='button'], input[type='button'], input[type='submit']",
      ),
    ).filter(visible);
  }

  function findAction(labels, root = document) {
    const targets = (Array.isArray(labels) ? labels : [labels])
      .map(normalize);

    return allActions(root).find((element) => {
      const text = normalize(element.textContent);
      const hint = normalize(
        [
          element.getAttribute("aria-label"),
          element.getAttribute("title"),
          element.getAttribute("value"),
        ].join(" "),
      );

      return targets.some(
        (target) =>
          text === target ||
          hint === target ||
          hint.includes(target),
      );
    }) || null;
  }

  function ancestors(element) {
    const result = [];
    let current = element;

    while (
      current &&
      current !== document.body &&
      current !== document.documentElement
    ) {
      result.push(current);
      current = current.parentElement;
    }

    return result;
  }

  function lowestCommonAncestor(elements) {
    const valid = elements.filter(Boolean);
    if (!valid.length) return null;

    return ancestors(valid[0]).find((candidate) =>
      valid.every((element) => candidate.contains(element)),
    ) || null;
  }

  function findToolbar() {
    const existing = Array.from(
      document.querySelectorAll(`.${TOOLBAR_CLASS}`),
    ).find(visible);

    if (existing) return existing;

    const registry = findAction("Registry");
    const importExcel = findAction("Import Excel");
    const addSpecimen = findAction("Add specimen");
    const updates = findAction("Updates");
    const fullscreen =
      findAction("Exit full screen") ||
      findAction("Full screen");
    const minimize = findAction("Minimize");
    const exit = allActions().find((element) => {
      const text = normalize(element.textContent);
      return text === "exit";
    }) || null;

    const required = [
      registry,
      importExcel,
      addSpecimen,
      updates,
    ].filter(Boolean);

    if (required.length < 3) return null;

    let candidate = lowestCommonAncestor([
      ...required,
      fullscreen,
      minimize,
      exit,
    ]);

    if (!candidate) {
      candidate = lowestCommonAncestor(required);
    }

    if (!(candidate instanceof HTMLElement)) return null;

    const rect = candidate.getBoundingClientRect();
    if (
      rect.top > 360 ||
      rect.height < 55 ||
      rect.height > 270 ||
      rect.width < Math.min(window.innerWidth * 0.55, 720)
    ) {
      return null;
    }

    return candidate;
  }

  function topLevelUnit(element, boundary) {
    if (!element || !boundary) return null;

    let unit = element;
    while (unit.parentElement && unit.parentElement !== boundary) {
      unit = unit.parentElement;
    }

    return unit;
  }

  function markActionsRoot(toolbar, registryAction) {
    if (!registryAction) return toolbar;

    let current = registryAction.parentElement;
    let best = null;

    while (current && current !== toolbar) {
      const actionCount = allActions(current).length;
      if (actionCount >= 4) best = current;
      current = current.parentElement;
    }

    if (best) {
      best.classList.add("agriregistry-v118-actions");
      return best;
    }

    return toolbar;
  }

  function markItem(
    toolbar,
    actionsRoot,
    labels,
    key,
  ) {
    const action = findAction(labels, toolbar);
    if (!action) return null;

    action.classList.add("agriregistry-v118-control");
    action.setAttribute(
      "title",
      action.getAttribute("title") ||
        action.textContent?.trim() ||
        String(Array.isArray(labels) ? labels[0] : labels),
    );

    const boundary =
      actionsRoot && actionsRoot.contains(action)
        ? actionsRoot
        : toolbar;

    const unit =
      topLevelUnit(action, boundary) ||
      action;

    unit.classList.add(
      "agriregistry-v118-item",
      `agriregistry-v118-item-${key}`,
    );

    return { action, unit };
  }

  function findLogo(toolbar, actionsRoot) {
    const images = Array.from(
      toolbar.querySelectorAll("img, picture, svg"),
    ).filter((element) => {
      if (!visible(element)) return false;
      if (
        actionsRoot &&
        actionsRoot !== toolbar &&
        actionsRoot.contains(element)
      ) {
        return false;
      }

      const hint = normalize(
        [
          element.getAttribute("alt"),
          element.getAttribute("src"),
          element.getAttribute("aria-label"),
        ].join(" "),
      );

      return (
        hint.includes("agri") ||
        hint.includes("logo") ||
        element.tagName.toLowerCase() === "img"
      );
    });

    return images[0] || null;
  }

  function markLogo(toolbar, actionsRoot) {
    const logo = findLogo(toolbar, actionsRoot);
    if (!logo) return;

    const unit = topLevelUnit(logo, toolbar) || logo;
    unit.classList.add("agriregistry-v118-logo");
  }

  function statusCopyFor(action) {
    const hint = normalize(
      [
        action?.textContent,
        action?.getAttribute("aria-label"),
        action?.getAttribute("title"),
      ].join(" "),
    );

    if (
      navigator.onLine === false ||
      /disconnected|no connection|offline(?! copy ready)/.test(hint)
    ) {
      return ["Offline", "Local copy ready"];
    }

    if (/syncing|uploading|downloading|saving/.test(hint)) {
      return ["Syncing", "Saving changes"];
    }

    if (/error|failed/.test(hint)) {
      return ["Sync issue", "Open to retry"];
    }

    return ["Online", "Offline copy ready"];
  }

  function findStatusAction(
    toolbar,
    addAction,
    updatesAction,
  ) {
    const controls = allActions(toolbar);

    const explicit = controls.find((control) => {
      const hint = normalize(
        [
          control.textContent,
          control.getAttribute("aria-label"),
          control.getAttribute("title"),
        ].join(" "),
      );

      return /online|offline copy ready|syncing|connected|disconnected/.test(
        hint,
      );
    });

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
    const status = findStatusAction(
      toolbar,
      addAction,
      updatesAction,
    );

    if (!status) return;

    status.classList.add(
      "agriregistry-v118-control",
      "agriregistry-v118-status",
    );

    const boundary =
      actionsRoot && actionsRoot.contains(status)
        ? actionsRoot
        : toolbar;

    const unit =
      topLevelUnit(status, boundary) ||
      status;

    unit.classList.add(
      "agriregistry-v118-item",
      "agriregistry-v118-item-status",
    );

    let copy = status.querySelector(
      ".agriregistry-v118-status-copy",
    );

    if (!copy) {
      copy = document.createElement("span");
      copy.className = "agriregistry-v118-status-copy";
      copy.innerHTML = `
        <span class="agriregistry-v118-status-primary"></span>
        <span class="agriregistry-v118-status-secondary"></span>
      `;
      status.appendChild(copy);
    }

    const [primary, secondary] = statusCopyFor(status);
    copy.querySelector(
      ".agriregistry-v118-status-primary",
    ).textContent = primary;
    copy.querySelector(
      ".agriregistry-v118-status-secondary",
    ).textContent = secondary;

    status.setAttribute("title", `${primary} â€” ${secondary}`);
  }

  function smallestEmailElement(toolbar) {
    return Array.from(toolbar.querySelectorAll("*"))
      .filter((element) =>
        EMAIL_PATTERN.test(element.textContent || ""),
      )
      .sort((a, b) => {
        const areaA =
          a.getBoundingClientRect().width *
          a.getBoundingClientRect().height;
        const areaB =
          b.getBoundingClientRect().width *
          b.getBoundingClientRect().height;
        return areaA - areaB;
      })[0] || null;
  }

  function findProfileUnit(toolbar, actionsRoot) {
    const emailElement = smallestEmailElement(toolbar);
    if (!emailElement) return null;

    const boundary =
      actionsRoot && actionsRoot.contains(emailElement)
        ? actionsRoot
        : toolbar;

    let unit = emailElement;

    while (
      unit.parentElement &&
      unit.parentElement !== boundary
    ) {
      const parent = unit.parentElement;
      const rect = parent.getBoundingClientRect();
      const hasAction = allActions(parent).length > 0;
      const hasEmail = EMAIL_PATTERN.test(
        parent.textContent || "",
      );

      unit = parent;

      if (
        hasEmail &&
        hasAction &&
        rect.width <= 520
      ) {
        break;
      }
    }

    return unit;
  }

  function markProfile(toolbar, actionsRoot) {
    const unit = findProfileUnit(toolbar, actionsRoot);
    if (!unit) return;

    unit.classList.add("agriregistry-v118-profile");

    const emailElement = smallestEmailElement(unit);
    if (emailElement) {
      emailElement.classList.add(
        "agriregistry-v118-profile-copy",
      );

      Array.from(emailElement.querySelectorAll("*"))
        .filter((element) =>
          EMAIL_PATTERN.test(element.textContent || ""),
        )
        .forEach((element) => {
          element.classList.add(
            "agriregistry-v118-profile-email",
          );
        });

      if (
        EMAIL_PATTERN.test(emailElement.textContent || "")
      ) {
        emailElement.classList.add(
          "agriregistry-v118-profile-email",
        );
      }
    }

    const textElements = Array.from(
      unit.querySelectorAll("span, p, div"),
    )
      .filter((element) => {
        if (!visible(element)) return false;

        const ownText = Array.from(element.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.nodeValue || "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        if (!ownText) return false;
        if (EMAIL_PATTERN.test(ownText)) return false;

        const normalized = normalize(ownText);
        if (
          [
            "logout",
            "log out",
            "sign out",
            "exit",
          ].includes(normalized)
        ) {
          return false;
        }

        return (
          ownText.length >= 3 &&
          ownText.length <= 90 &&
          /[a-z]/i.test(ownText)
        );
      })
      .sort((a, b) => {
        const aText = a.textContent?.trim() || "";
        const bText = b.textContent?.trim() || "";
        return bText.length - aText.length;
      });

    textElements[0]?.classList.add(
      "agriregistry-v118-profile-name",
    );
  }

  function markToolbar() {
    const toolbar = findToolbar();
    if (!toolbar) return false;

    toolbar.classList.add(TOOLBAR_CLASS);

    const registry =
      findAction("Registry", toolbar) ||
      findAction("Add specimen", toolbar);

    const actionsRoot = markActionsRoot(
      toolbar,
      registry,
    );

    markLogo(toolbar, actionsRoot);

    const registryItem = markItem(
      toolbar,
      actionsRoot,
      "Registry",
      "registry",
    );
    const importItem = markItem(
      toolbar,
      actionsRoot,
      "Import Excel",
      "import",
    );
    const addItem = markItem(
      toolbar,
      actionsRoot,
      "Add specimen",
      "add",
    );
    const updatesItem = markItem(
      toolbar,
      actionsRoot,
      "Updates",
      "updates",
    );
    markItem(
      toolbar,
      actionsRoot,
      ["Exit full screen", "Full screen"],
      "fullscreen",
    );
    markItem(
      toolbar,
      actionsRoot,
      "Minimize",
      "minimize",
    );
    markItem(
      toolbar,
      actionsRoot,
      "Exit",
      "exit",
    );

    markStatus(
      toolbar,
      actionsRoot,
      addItem?.action,
      updatesItem?.action,
    );

    markProfile(toolbar, actionsRoot);

    void registryItem;
    void importItem;
    return true;
  }

  function findLoginForm() {
    return Array.from(document.querySelectorAll("form"))
      .find((form) =>
        visible(form) &&
        Boolean(form.querySelector("input[type='password']")),
      ) || null;
  }

  function loginViewVisible() {
    const password =
      document.querySelector("input[type='password']");

    return Boolean(
      (password && visible(password)) ||
      findLoginForm(),
    );
  }

  function findNearbyLogo(element) {
    let current = element;

    for (
      let depth = 0;
      current && depth < 7;
      depth += 1
    ) {
      const images = Array.from(
        current.querySelectorAll?.("img") || [],
      );

      const logo = images.find((image) => {
        const hint = normalize(
          `${image.alt || ""} ${image.src || ""}`,
        );

        return (
          hint.includes("agri") ||
          hint.includes("logo")
        );
      }) || images[0];

      if (logo?.src) return logo.src;
      current = current.parentElement;
    }

    return "";
  }

  function armLoginAnimation(form) {
    animationShown = false;

    try {
      sessionStorage.setItem(PENDING_KEY, "1");
      const logo = findNearbyLogo(form);
      if (logo) sessionStorage.setItem(LOGO_KEY, logo);
    } catch {
      // Storage may be unavailable in a restricted context.
    }
  }

  function ensureLoginCredit() {
    const form = findLoginForm();
    if (!form) return;

    const parent = form.parentElement || form;
    if (
      parent.querySelector(
        ".agriregistry-v118-login-credit",
      )
    ) {
      return;
    }

    const credit = document.createElement("div");
    credit.className = "agriregistry-v118-login-credit";
    credit.textContent = "Powered by Luntian";
    parent.appendChild(credit);
  }

  function dashboardReady() {
    return Boolean(
      (
        findAction("Registry") ||
        findAction("Add specimen")
      ) &&
      !loginViewVisible(),
    );
  }

  function pendingAnimation() {
    try {
      return sessionStorage.getItem(PENDING_KEY) === "1";
    } catch {
      return false;
    }
  }

  function showLoginAnimation() {
    if (!dashboardReady()) return;
    if (!pendingAnimation()) return;
    if (animationShown) return;
    if (
      document.getElementById(
        "agriregistry-v118-login-splash",
      )
    ) {
      return;
    }

    animationShown = true;

    let logoSource = "";
    try {
      logoSource =
        sessionStorage.getItem(LOGO_KEY) || "";
      sessionStorage.removeItem(PENDING_KEY);
      sessionStorage.removeItem(LOGO_KEY);
    } catch {
      // Continue with the text-only fallback.
    }

    if (!logoSource) {
      const toolbar = findToolbar();
      logoSource =
        toolbar?.querySelector(
          ".agriregistry-v118-logo img, img",
        )?.src || "";
    }

    const splash = document.createElement("div");
    splash.id = "agriregistry-v118-login-splash";
    splash.setAttribute("aria-hidden", "true");

    const escapedLogo = logoSource
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const logoMarkup = escapedLogo
      ? `<img src="${escapedLogo}" alt="AgriRegistry logo">`
      : "<span>ðŸŒ±</span>";

    splash.innerHTML = `
      <div class="agriregistry-v118-splash-card">
        <div class="agriregistry-v118-logo-shell">
          ${logoMarkup}
        </div>
        <div class="agriregistry-v118-splash-title">
          AgriRegistry
        </div>
        <div class="agriregistry-v118-splash-subtitle">
          Powered by Luntian
        </div>
      </div>
    `;

    document.body.appendChild(splash);

    requestAnimationFrame(() => {
      splash.classList.add(
        "agriregistry-v118-visible",
      );
    });

    window.setTimeout(() => {
      splash.classList.add(
        "agriregistry-v118-exit",
      );
    }, 1850);

    window.setTimeout(() => {
      splash.remove();
    }, 2250);
  }

  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target;

      if (
        form instanceof HTMLFormElement &&
        form.querySelector("input[type='password']")
      ) {
        armLoginAnimation(form);
      }
    },
    true,
  );

  document.addEventListener(
    "pointerdown",
    (event) => {
      const target =
        event.target instanceof Element
          ? event.target.closest(
              "button, [role='button'], input[type='submit']",
            )
          : null;

      const form =
        target?.closest("form") ||
        findLoginForm();

      if (
        form?.querySelector("input[type='password']")
      ) {
        armLoginAnimation(form);
      }
    },
    true,
  );

  function refresh() {
    removeBrokenPatchEffects();
    const hasLogin = loginViewVisible();

    if (!initialized) {
      initialized = true;
      loginWasVisible = hasLogin;
    } else if (hasLogin) {
      loginWasVisible = true;
      animationShown = false;
    }

    markToolbar();
    ensureLoginCredit();

    if (
      (
        loginWasVisible &&
        !hasLogin &&
        dashboardReady()
      ) ||
      (
        pendingAnimation() &&
        dashboardReady()
      )
    ) {
      showLoginAnimation();
      loginWasVisible = false;
    }
  }

  function scheduleRefresh() {
    if (scheduled) cancelAnimationFrame(scheduled);

    scheduled = requestAnimationFrame(() => {
      scheduled = 0;
      refresh();
    });
  }

  const observer = new MutationObserver(
    scheduleRefresh,
  );

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  window.addEventListener(
    "resize",
    scheduleRefresh,
    { passive: true },
  );
  window.addEventListener(
    "pageshow",
    scheduleRefresh,
    { passive: true },
  );
  window.addEventListener(
    "online",
    scheduleRefresh,
  );
  window.addEventListener(
    "offline",
    scheduleRefresh,
  );

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      scheduleRefresh,
      { once: true },
    );
  }

  window.setInterval(refresh, 1200);
  window.setTimeout(refresh, 0);
  window.setTimeout(refresh, 120);
  window.setTimeout(refresh, 500);
})();
