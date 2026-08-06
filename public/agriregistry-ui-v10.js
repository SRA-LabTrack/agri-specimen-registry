/* AGRIREGISTRY_UI_V10 */
(() => {
  "use strict";

  const PENDING_KEY = "agriregistry-login-animation-pending-v10";
  const LOGO_KEY = "agriregistry-login-animation-logo-v10";
  const TOOLBAR_CLASS = "agriregistry-v10-toolbar";
  const knownLabels = [
    "registry",
    "import excel",
    "add specimen",
    "updates",
    "full screen",
    "exit full screen",
    "minimize",
    "exit",
    "online",
  ];

  let initialized = false;
  let loginWasVisible = false;
  let loginAttemptArmed = false;
  let animationShownForTransition = false;

  const normalize = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const visible = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0;
  };

  const compactText = (element) => normalize(element?.textContent);

  function allActions() {
    return Array.from(document.querySelectorAll("button, a, [role='button']"))
      .filter(visible);
  }

  function findAction(label, root = document) {
    const target = normalize(label);
    return Array.from(root.querySelectorAll("button, a, [role='button']"))
      .find((element) => compactText(element) === target) || null;
  }

  function toolbarScore(element) {
    const text = compactText(element);
    let score = 0;
    for (const label of knownLabels) {
      if (text.includes(label)) score += 1;
    }
    return score;
  }

  function ancestors(element) {
    const result = [];
    let current = element;
    while (current && current !== document.documentElement) {
      result.push(current);
      current = current.parentElement;
    }
    return result;
  }

  function lowestCommonAncestor(elements) {
    if (!elements.length) return null;
    const firstAncestors = ancestors(elements[0]);
    return firstAncestors.find((candidate) =>
      elements.every((element) => candidate.contains(element)),
    ) || null;
  }

  function findTopLogo(referenceElements) {
    const referenceRect = referenceElements[0]?.getBoundingClientRect();
    const images = Array.from(document.querySelectorAll("img"))
      .filter(visible)
      .filter((image) => {
        const hint = normalize(`${image.alt || ""} ${image.src || ""}`);
        return hint.includes("agri") || hint.includes("logo");
      })
      .filter((image) => image.getBoundingClientRect().top < 320);

    if (!images.length) return null;
    if (!referenceRect) return images[0];

    return images.sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      const distanceA = Math.abs(rectA.top - referenceRect.top);
      const distanceB = Math.abs(rectB.top - referenceRect.top);
      return distanceA - distanceB;
    })[0];
  }

  function findToolbar() {
    const seeds = [
      findAction("Registry"),
      findAction("Add specimen"),
      findAction("Updates"),
      findAction("Minimize"),
      findAction("Exit full screen") || findAction("Full screen"),
    ].filter(Boolean);

    if (seeds.length < 3) return null;

    const logo = findTopLogo(seeds);
    const lcaElements = logo ? [...seeds, logo] : seeds;
    let candidate = lowestCommonAncestor(lcaElements);

    if (
      candidate instanceof HTMLElement &&
      candidate !== document.body &&
      candidate.getBoundingClientRect().height < 360
    ) {
      return candidate;
    }

    const candidates = new Set();
    for (const seed of seeds) {
      let current = seed;
      for (let depth = 0; current && depth < 10; depth += 1) {
        if (current instanceof HTMLElement && current !== document.body) {
          if (toolbarScore(current) >= 4) candidates.add(current);
        }
        current = current.parentElement;
      }
    }

    return Array.from(candidates)
      .sort((a, b) => {
        const scoreDifference = toolbarScore(b) - toolbarScore(a);
        if (scoreDifference !== 0) return scoreDifference;
        const areaA = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
        const areaB = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
        return areaB - areaA;
      })[0] || null;
  }

  function topLevelUnit(element, toolbar) {
    if (!element || !toolbar) return null;
    let unit = element;
    while (unit.parentElement && unit.parentElement !== toolbar) {
      unit = unit.parentElement;
    }
    return unit;
  }

  function itemUnit(element, toolbar, actionsRoot) {
    const boundary = actionsRoot && actionsRoot.contains(element)
      ? actionsRoot
      : toolbar;

    let unit = element;
    while (unit.parentElement && unit.parentElement !== boundary) {
      unit = unit.parentElement;
    }
    return unit;
  }

  function markControl(toolbar, labels, key, actionsRoot) {
    const labelList = Array.isArray(labels) ? labels : [labels];
    const action = labelList
      .map((label) => findAction(label, toolbar))
      .find(Boolean);

    if (!action) return null;

    action.classList.add("agriregistry-v10-control");
    action.setAttribute("title", action.textContent.trim());

    const unit = itemUnit(action, toolbar, actionsRoot) || action;
    unit.classList.add("agriregistry-v10-item", `agriregistry-v10-item-${key}`);
    return { action, unit };
  }

  function markActionsContainer(toolbar, registryAction) {
    if (!registryAction) return null;
    let current = registryAction.parentElement;
    let best = null;

    while (current && current !== toolbar) {
      if (toolbarScore(current) >= 5) best = current;
      current = current.parentElement;
    }

    if (best) {
      best.classList.add("agriregistry-v10-actions");
      return best;
    }

    const unit = topLevelUnit(registryAction, toolbar);
    if (unit && unit !== registryAction && toolbarScore(unit) >= 4) {
      unit.classList.add("agriregistry-v10-actions");
      return unit;
    }

    return toolbar;
  }

  function findStatusAction(toolbar, addAction, updatesAction) {
    const controls = Array.from(
      toolbar.querySelectorAll("button, a, [role='button']"),
    ).filter(visible);

    const explicit = controls.find((control) => {
      const hint = normalize(
        `${control.textContent || ""} ${control.getAttribute("aria-label") || ""} ${control.getAttribute("title") || ""}`,
      );
      return /online|offline copy ready|syncing|connected|disconnected/.test(hint);
    });

    if (explicit) return explicit;

    const addIndex = controls.indexOf(addAction);
    const updatesIndex = controls.indexOf(updatesAction);
    if (addIndex >= 0 && updatesIndex > addIndex + 1) {
      return controls[addIndex + 1];
    }

    return null;
  }

  function updateStatusCopy(statusAction) {
    if (!statusAction) return;

    const hint = normalize(
      `${statusAction.textContent || ""} ${statusAction.getAttribute("aria-label") || ""} ${statusAction.getAttribute("title") || ""}`,
    );

    let primary = "Online";
    let secondary = "Offline copy ready";

    if (/syncing|uploading|downloading/.test(hint)) {
      primary = "Syncing";
      secondary = "Saving changes";
    } else if (/disconnected|offline(?! copy ready)|no connection/.test(hint)) {
      primary = "Offline";
      secondary = "Local copy ready";
    } else if (/error|failed/.test(hint)) {
      primary = "Sync issue";
      secondary = "Open to retry";
    }

    statusAction.dataset.v10StatusPrimary = primary;
    statusAction.dataset.v10StatusSecondary = secondary;
    statusAction.setAttribute("title", `${primary} â€” ${secondary}`);
  }

  function markProfile(toolbar, actionsRoot) {
    const candidates = Array.from(toolbar.querySelectorAll("div, section, aside"))
      .filter(visible)
      .filter((element) => {
        const text = compactText(element);
        const hasEmail = /\S+@\S+\.\S+/.test(element.textContent || "");
        const hasAvatar = Boolean(
          element.querySelector("img, [class*='avatar'], [class*='Avatar']"),
        );
        return hasEmail && (hasAvatar || text.length < 160);
      })
      .sort((a, b) => {
        const areaA = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
        const areaB = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
        return areaA - areaB;
      });

    const profile = candidates[0] || null;
    if (!profile) return;

    const unit = itemUnit(profile, toolbar, actionsRoot) || profile;
    unit.classList.add("agriregistry-v10-profile");

    Array.from(unit.querySelectorAll("*"))
      .filter((element) => /\S+@\S+\.\S+/.test(element.textContent || ""))
      .forEach((element) => element.classList.add("agriregistry-v10-email"));
  }

  function markToolbar() {
    const toolbar = findToolbar();
    if (!toolbar) return false;

    toolbar.classList.add(TOOLBAR_CLASS);

    const logo = findTopLogo([
      findAction("Registry", toolbar),
      findAction("Add specimen", toolbar),
    ].filter(Boolean));

    if (logo && toolbar.contains(logo)) {
      const logoUnit = topLevelUnit(logo, toolbar) || logo;
      logoUnit.classList.add("agriregistry-v10-logo");
    }

    const registryAction = findAction("Registry", toolbar) ||
      findAction("Add specimen", toolbar);
    const actionsRoot = markActionsContainer(toolbar, registryAction);

    const registry = markControl(toolbar, "Registry", "registry", actionsRoot);
    const importExcel = markControl(toolbar, "Import Excel", "import", actionsRoot);
    const addSpecimen = markControl(toolbar, "Add specimen", "add", actionsRoot);
    const updates = markControl(toolbar, "Updates", "updates", actionsRoot);
    const fullScreen = markControl(
      toolbar,
      ["Exit full screen", "Full screen"],
      "fullscreen",
      actionsRoot,
    );
    const minimize = markControl(toolbar, "Minimize", "minimize", actionsRoot);
    const exit = markControl(toolbar, "Exit", "exit", actionsRoot);

    const statusAction = findStatusAction(
      toolbar,
      addSpecimen?.action,
      updates?.action,
    );

    if (statusAction) {
      statusAction.classList.add(
        "agriregistry-v10-control",
        "agriregistry-v10-status",
      );
      const statusUnit = itemUnit(statusAction, toolbar, actionsRoot) || statusAction;
      statusUnit.classList.add("agriregistry-v10-item");
      if (statusUnit !== statusAction) {
        statusUnit.classList.add("agriregistry-v10-item-status");
      }
      updateStatusCopy(statusAction);
    }

    markProfile(toolbar, actionsRoot);

    void importExcel;
    void fullScreen;
    void minimize;
    void exit;
    return true;
  }

  function findLoginForm() {
    return Array.from(document.querySelectorAll("form"))
      .find((form) =>
        visible(form) && Boolean(form.querySelector("input[type='password']")),
      ) || null;
  }

  function loginViewVisible() {
    const password = document.querySelector("input[type='password']");
    return Boolean((password && visible(password)) || findLoginForm());
  }

  function findLogoNear(element) {
    if (!element) return "";

    let current = element;
    for (let depth = 0; current && depth < 7; depth += 1) {
      const images = Array.from(current.querySelectorAll?.("img") || []);
      const logo = images.find((image) => {
        const hint = normalize(`${image.alt || ""} ${image.src || ""}`);
        return hint.includes("agri") || hint.includes("logo");
      }) || images[0];

      if (logo?.src) return logo.src;
      current = current.parentElement;
    }

    return "";
  }

  function armLoginAnimation(form) {
    loginAttemptArmed = true;
    animationShownForTransition = false;

    try {
      sessionStorage.setItem(PENDING_KEY, "1");
      const logo = findLogoNear(form);
      if (logo) sessionStorage.setItem(LOGO_KEY, logo);
    } catch {
      // Continue with in-memory state when storage is unavailable.
    }
  }

  function ensureLoginCredit() {
    const form = findLoginForm();
    if (!form) return;

    const parent = form.parentElement || form;
    if (parent.querySelector(".agriregistry-v10-login-credit")) return;

    const credit = document.createElement("div");
    credit.className = "agriregistry-v10-login-credit";
    credit.textContent = "Powered by Luntian";
    parent.appendChild(credit);
  }

  function pendingLoginAnimation() {
    try {
      return sessionStorage.getItem(PENDING_KEY) === "1";
    } catch {
      return loginAttemptArmed;
    }
  }

  function dashboardIsReady() {
    const registry = findAction("Registry");
    const addSpecimen = findAction("Add specimen");
    return Boolean((registry || addSpecimen) && !loginViewVisible());
  }

  function getStoredLogo() {
    try {
      return sessionStorage.getItem(LOGO_KEY) || "";
    } catch {
      return "";
    }
  }

  function clearPendingAnimation() {
    loginAttemptArmed = false;
    try {
      sessionStorage.removeItem(PENDING_KEY);
      sessionStorage.removeItem(LOGO_KEY);
    } catch {
      // Nothing to clear.
    }
  }

  function showLoginAnimation(force = false) {
    if (!dashboardIsReady()) return false;
    if (!force && !pendingLoginAnimation()) return false;
    if (document.getElementById("agriregistry-v10-login-splash")) return false;
    if (animationShownForTransition) return false;

    animationShownForTransition = true;
    const storedLogo = getStoredLogo();
    clearPendingAnimation();

    const splash = document.createElement("div");
    splash.id = "agriregistry-v10-login-splash";
    splash.setAttribute("aria-hidden", "true");

    const toolbar = findToolbar();
    const logoSource = storedLogo ||
      toolbar?.querySelector(".agriregistry-v10-logo img, img")?.src ||
      "";

    const escapedLogo = logoSource
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const logoMarkup = escapedLogo
      ? `<img src="${escapedLogo}" alt="AgriRegistry logo">`
      : '<span class="agriregistry-v10-leaf-mark" aria-hidden="true"></span>';

    const sprouts = [10, 22, 36, 64, 78, 90]
      .map((left, index) =>
        `<span class="agriregistry-v10-sprout" style="--sprout-left:${left}%;--sprout-delay:${index * 75}ms"></span>`,
      )
      .join("");

    splash.innerHTML = `
      ${sprouts}
      <div class="agriregistry-v10-splash-card">
        <div class="agriregistry-v10-logo-shell">${logoMarkup}</div>
        <div class="agriregistry-v10-splash-title">AgriRegistry</div>
        <div class="agriregistry-v10-splash-subtitle">Powered by Luntian</div>
      </div>
    `;

    document.body.appendChild(splash);

    requestAnimationFrame(() => {
      splash.classList.add("agriregistry-v10-visible");
    });

    window.setTimeout(() => {
      splash.classList.add("agriregistry-v10-exit");
    }, 1900);

    window.setTimeout(() => {
      splash.remove();
    }, 2300);

    return true;
  }

  function formFromEventTarget(target) {
    if (!(target instanceof Element)) return findLoginForm();
    return target.closest("form") || findLoginForm();
  }

  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target;
      if (form instanceof HTMLFormElement && form.querySelector("input[type='password']")) {
        armLoginAnimation(form);
      }
    },
    true,
  );

  document.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target instanceof Element
        ? event.target.closest("button, [role='button'], input[type='submit']")
        : null;
      if (!target) return;

      const form = formFromEventTarget(target);
      if (form?.querySelector("input[type='password']")) {
        armLoginAnimation(form);
      }
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter") return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const form = formFromEventTarget(target);
      if (form?.querySelector("input[type='password']")) {
        armLoginAnimation(form);
      }
    },
    true,
  );

  document.addEventListener(
    "input",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== "password") return;
      loginWasVisible = true;
      animationShownForTransition = false;
    },
    true,
  );

  let scheduled = false;
  const refresh = () => {
    if (scheduled) return;
    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;

      const hasLogin = loginViewVisible();
      if (!initialized) {
        initialized = true;
        loginWasVisible = hasLogin;
      } else if (hasLogin) {
        loginWasVisible = true;
        animationShownForTransition = false;
      }

      markToolbar();
      ensureLoginCredit();

      const transitionedFromLogin = loginWasVisible && !hasLogin && dashboardIsReady();
      const pendingAndReady = pendingLoginAnimation() && dashboardIsReady();

      if (transitionedFromLogin || pendingAndReady) {
        showLoginAnimation(transitionedFromLogin);
        loginWasVisible = false;
      }
    });
  };

  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  window.addEventListener("resize", refresh, { passive: true });
  window.addEventListener("pageshow", refresh, { passive: true });
  document.addEventListener("DOMContentLoaded", refresh, { once: true });
  refresh();
})();
