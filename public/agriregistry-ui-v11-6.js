/* AGRIREGISTRY_UI_V11_6_MIRROR_TOOLBAR */
(() => {
  "use strict";

  const MIRROR_ID = "agriregistry-v116-toolbar";
  const ORIGINAL_ATTR = "data-agriregistry-v116-original";
  const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

  let observer = null;
  let scheduled = 0;
  let refreshTimer = 0;

  const normalize = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const outsideMirror = (element) =>
    element &&
    !element.closest(`#${MIRROR_ID}`);

  function allActions(root = document) {
    return Array.from(
      root.querySelectorAll(
        "button, a, [role='button'], input[type='button'], input[type='submit']",
      ),
    ).filter(outsideMirror);
  }

  function actionHint(element) {
    return normalize(
      [
        element.textContent,
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
        element.getAttribute("name"),
        element.getAttribute("value"),
        element.id,
      ].join(" "),
    );
  }

  function findAction(labels, root = document, exact = true) {
    const targets = (Array.isArray(labels) ? labels : [labels])
      .map(normalize);

    const actions = allActions(root);

    const exactMatch = actions.find((element) => {
      const text = normalize(element.textContent);
      const hint = actionHint(element);
      return targets.some(
        (target) => text === target || hint === target,
      );
    });

    if (exactMatch || exact) return exactMatch || null;

    return actions.find((element) => {
      const hint = actionHint(element);
      return targets.some((target) => hint.includes(target));
    }) || null;
  }

  function findSemanticAction(key, root = document) {
    const definitions = {
      registry: ["registry"],
      import: ["import excel"],
      add: ["add specimen"],
      updates: ["updates", "check for updates"],
      fullscreen: ["exit full screen", "full screen", "fullscreen"],
      minimize: ["minimize", "minimise"],
      exit: ["exit", "close app", "close application"],
      logout: ["logout", "log out", "sign out"],
    };

    const labels = definitions[key] || [key];

    if (key === "exit") {
      return allActions(root).find((element) => {
        const text = normalize(element.textContent);
        const hint = actionHint(element);
        return (
          text === "exit" ||
          hint === "exit" ||
          hint.includes("close app") ||
          hint.includes("close application")
        ) && !hint.includes("full screen");
      }) || null;
    }

    return findAction(labels, root, false);
  }

  function commonAncestor(elements) {
    const valid = elements.filter(Boolean);
    if (!valid.length) return null;

    let current = valid[0];
    while (current && current !== document.body) {
      if (valid.every((element) => current.contains(element))) {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }

  function toolbarScore(element) {
    if (!(element instanceof HTMLElement)) return -Infinity;
    if (element.id === MIRROR_ID) return -Infinity;

    const text = normalize(element.textContent);
    const rect = element.getBoundingClientRect();
    const actionCount = allActions(element).length;

    let score = 0;
    if (text.includes("registry")) score += 20;
    if (text.includes("import excel")) score += 20;
    if (text.includes("add specimen")) score += 20;
    if (text.includes("updates")) score += 10;
    if (element.querySelector("img, picture")) score += 10;
    if (EMAIL_PATTERN.test(element.textContent || "")) score += 8;
    if (rect.top < 340) score += 10;
    if (rect.height > 45 && rect.height < 420) score += 12;
    if (actionCount >= 3 && actionCount <= 16) score += 12;
    score -= Math.min((rect.width * rect.height) / 250000, 16);

    return score;
  }

  function findOriginalToolbar() {
    const marked = Array.from(
      document.querySelectorAll(
        [
          ".agriregistry-v11-toolbar",
          ".agriregistry-v10-toolbar",
          "[data-agriregistry-toolbar]",
          `[${ORIGINAL_ATTR}='true']`,
        ].join(","),
      ),
    )
      .filter(outsideMirror)
      .filter((element) => element instanceof HTMLElement);

    if (marked.length) {
      return marked.sort(
        (a, b) => toolbarScore(b) - toolbarScore(a),
      )[0];
    }

    const actions = [
      findSemanticAction("registry"),
      findSemanticAction("import"),
      findSemanticAction("add"),
      findSemanticAction("updates"),
    ].filter(Boolean);

    const ancestor = commonAncestor(actions.slice(0, 3));
    if (ancestor && ancestor !== document.body) return ancestor;

    const candidates = new Set();
    for (const action of actions) {
      let current = action;
      for (
        let depth = 0;
        current && current !== document.body && depth < 12;
        depth += 1
      ) {
        if (current instanceof HTMLElement) candidates.add(current);
        current = current.parentElement;
      }
    }

    return Array.from(candidates)
      .filter((element) => {
        const text = normalize(element.textContent);
        return (
          text.includes("registry") &&
          text.includes("import excel") &&
          text.includes("add specimen")
        );
      })
      .sort((a, b) => toolbarScore(b) - toolbarScore(a))[0] || null;
  }

  function icon(paths, viewBox = "0 0 24 24") {
    return `
      <svg viewBox="${viewBox}" aria-hidden="true" focusable="false">
        ${paths}
      </svg>
    `;
  }

  const icons = {
    registry: icon(`
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>
      <path d="M8 7h8M8 11h8"/>
    `),
    import: icon(`
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
      <path d="M14 2v6h6"/>
      <path d="M8 13h8M8 17h8M10 9H8"/>
    `),
    add: icon(`
      <path d="M12 5v14M5 12h14"/>
    `),
    cloud: icon(`
      <path d="M17.5 19H7a5 5 0 1 1 1.7-9.7A7 7 0 0 1 22 12.5 4.5 4.5 0 0 1 17.5 19Z"/>
    `),
    updates: icon(`
      <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5"/>
      <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/>
    `),
    fullscreen: icon(`
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3"/>
      <path d="M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/>
    `),
    minimize: icon(`
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 21h3a2 2 0 0 0 2-2v-3"/>
      <path d="m3 8 5-5M21 16l-5 5"/>
    `),
    exit: icon(`
      <path d="M18 6 6 18M6 6l12 12"/>
    `),
    logout: icon(`
      <path d="M10 17l5-5-5-5"/>
      <path d="M15 12H3"/>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
    `),
    leaf: icon(`
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 18 2 18 2c1 5-1 10-5.2 12.4"/>
      <path d="M2 21c0-3 1.85-5.36 5.08-6.94C9.6 12.82 12.15 12 16 12"/>
    `),
  };

  function slot(className, content) {
    const element = document.createElement("div");
    element.className = `agri-v116-slot ${className}`;
    element.innerHTML = content;
    return element;
  }

  function makeAction(key, label, iconMarkup, primary = false) {
    const wrapper = slot(`agri-v116-${key}-slot`, "");
    const button = document.createElement("button");
    button.type = "button";
    button.className = primary ? "agri-v116-primary" : "";
    button.dataset.agriV116Action = key;
    button.innerHTML = `${iconMarkup}<span>${label}</span>`;
    button.setAttribute("aria-label", label);
    wrapper.appendChild(button);
    return wrapper;
  }

  function makeLogo() {
    const wrapper = slot("agri-v116-logo", "");
    wrapper.innerHTML = `
      <div class="agri-v116-logo-fallback">
        ${icons.leaf}
        <span>
          AgriRegistry
          <small>Powered by Luntian</small>
        </span>
      </div>
    `;
    return wrapper;
  }

  function makeSync() {
    const wrapper = slot("agri-v116-sync-slot", "");
    wrapper.innerHTML = `
      <div
        class="agri-v116-sync"
        role="button"
        tabindex="0"
        data-agri-v116-action="sync"
        aria-label="Synchronization status"
      >
        <span class="agri-v116-sync-icon">${icons.cloud}</span>
        <span class="agri-v116-sync-copy">
          <span class="agri-v116-sync-primary">Online</span>
          <span class="agri-v116-sync-secondary">Offline copy ready</span>
        </span>
      </div>
    `;
    return wrapper;
  }

  function makeAccount() {
    const wrapper = slot("agri-v116-account-slot", "");
    wrapper.innerHTML = `
      <div class="agri-v116-account agri-v116-account-unresolved">
        <span class="agri-v116-avatar">A</span>
        <span class="agri-v116-account-copy">
          <span class="agri-v116-account-name">Account</span>
          <span class="agri-v116-account-email"></span>
        </span>
        <button
          type="button"
          class="agri-v116-logout"
          data-agri-v116-action="logout"
          aria-label="Log out"
          title="Log out"
        >
          ${icons.logout}
        </button>
      </div>
    `;
    return wrapper;
  }

  function buildMirror() {
    let mirror = document.getElementById(MIRROR_ID);
    if (mirror) return mirror;

    mirror = document.createElement("nav");
    mirror.id = MIRROR_ID;
    mirror.setAttribute("aria-label", "AgriRegistry toolbar");

    mirror.append(
      makeLogo(),
      makeAction("registry", "Registry", icons.registry),
      makeAction("import", "Import Excel", icons.import),
      makeAction("add", "Add specimen", icons.add, true),
      makeSync(),
      makeAction("updates", "Updates", icons.updates),
      makeAction("fullscreen", "Exit full screen", icons.fullscreen),
      makeAction("minimize", "Minimize", icons.minimize),
      makeAction("exit", "Exit", icons.exit, true),
      makeAccount(),
    );

    mirror.addEventListener("click", handleMirrorClick);
    mirror.addEventListener("keydown", (event) => {
      const sync = event.target.closest("[data-agri-v116-action='sync']");
      if (
        sync &&
        (event.key === "Enter" || event.key === " ")
      ) {
        event.preventDefault();
        handleMirrorClick(event);
      }
    });

    document.body.appendChild(mirror);
    return mirror;
  }

  function invokeBridge(methodNames) {
    const bridges = [
      window.electronAPI,
      window.desktopAPI,
      window.api,
      window.bridge,
    ].filter(Boolean);

    for (const bridge of bridges) {
      for (const methodName of methodNames) {
        if (typeof bridge?.[methodName] === "function") {
          bridge[methodName]();
          return true;
        }
      }
    }

    return false;
  }

  async function fallbackAction(key) {
    if (key === "fullscreen") {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen?.();
        } else {
          await document.documentElement.requestFullscreen?.();
        }
      } catch {
        // The original app action remains the preferred path.
      }
      return;
    }

    if (key === "minimize") {
      invokeBridge([
        "minimize",
        "minimizeWindow",
        "windowMinimize",
      ]);
      return;
    }

    if (key === "exit") {
      const handled = invokeBridge([
        "close",
        "closeWindow",
        "quit",
        "exit",
        "closeApp",
      ]);
      if (!handled) window.close();
      return;
    }

    if (key === "updates") {
      invokeBridge([
        "checkForUpdates",
        "openUpdates",
        "showUpdates",
      ]);
    }
  }

  function findStatusAction(original) {
    const scope = original || document;
    const actions = allActions(scope);

    return actions.find((element) => {
      const hint = actionHint(element);
      return /online|offline copy ready|syncing|connected|disconnected/.test(
        hint,
      );
    }) || (() => {
      const add = findSemanticAction("add", scope);
      const updates = findSemanticAction("updates", scope);
      const addIndex = actions.indexOf(add);
      const updatesIndex = actions.indexOf(updates);

      if (addIndex >= 0 && updatesIndex > addIndex + 1) {
        return actions[addIndex + 1];
      }

      return null;
    })();
  }

  function findLogoutAction(original) {
    const semantic = findSemanticAction("logout", original || document);
    if (semantic) return semantic;

    const profile = findProfile(original);
    if (!profile?.root) return null;

    const actions = allActions(profile.root);
    return actions.find((element) => {
      const hint = actionHint(element);
      return /logout|log out|sign out/.test(hint);
    }) || actions[actions.length - 1] || null;
  }

  function actionForKey(key, original) {
    if (key === "sync") return findStatusAction(original);
    if (key === "logout") return findLogoutAction(original);
    return findSemanticAction(key, original || document) ||
      findSemanticAction(key, document);
  }

  async function handleMirrorClick(event) {
    const trigger = event.target.closest("[data-agri-v116-action]");
    if (!trigger) return;

    const key = trigger.dataset.agriV116Action;
    const original = findOriginalToolbar();
    const action = actionForKey(key, original);

    if (action) {
      action.click();
    } else {
      await fallbackAction(key);
    }

    window.setTimeout(scheduleRefresh, 80);
  }

  function findLogoImage(original) {
    const scope = original || document;
    const images = Array.from(scope.querySelectorAll("img"))
      .filter(outsideMirror);

    return images.sort((a, b) => {
      const aHint = normalize(
        `${a.alt || ""} ${a.currentSrc || a.src || ""}`,
      );
      const bHint = normalize(
        `${b.alt || ""} ${b.currentSrc || b.src || ""}`,
      );

      const aScore =
        Number(/agriregistry|agri.?registry|logo/.test(aHint)) * 20 +
        Number((a.naturalWidth || 0) > (a.naturalHeight || 0)) * 3;
      const bScore =
        Number(/agriregistry|agri.?registry|logo/.test(bHint)) * 20 +
        Number((b.naturalWidth || 0) > (b.naturalHeight || 0)) * 3;

      return bScore - aScore;
    })[0] || null;
  }

  function refreshLogo(mirror, original) {
    const logoSlot = mirror.querySelector(".agri-v116-logo");
    if (!logoSlot) return;

    const sourceImage = findLogoImage(original);
    if (!sourceImage) return;

    const existing = logoSlot.querySelector("img");
    const source =
      sourceImage.currentSrc ||
      sourceImage.getAttribute("src") ||
      "";

    if (existing && existing.getAttribute("src") === source) return;

    const image = document.createElement("img");
    image.alt = sourceImage.alt || "AgriRegistry";
    image.src = source;

    const srcset = sourceImage.getAttribute("srcset");
    const sizes = sourceImage.getAttribute("sizes");
    if (srcset) image.setAttribute("srcset", srcset);
    if (sizes) image.setAttribute("sizes", sizes);

    logoSlot.replaceChildren(image);
  }

  function visibleTextValues(root) {
    if (!root) return [];

    const values = [];
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
    );

    while (walker.nextNode()) {
      const value = String(walker.currentNode.nodeValue || "")
        .replace(/\s+/g, " ")
        .trim();

      if (value) values.push(value);
    }

    for (const element of root.querySelectorAll(
      "[aria-label], [title], [data-name], [data-email]",
    )) {
      for (const attribute of [
        "aria-label",
        "title",
        "data-name",
        "data-email",
      ]) {
        const value = element.getAttribute(attribute);
        if (value) values.push(value.trim());
      }
    }

    return values;
  }

  function findProfile(original) {
    const scopes = [original, document].filter(Boolean);

    let email = "";
    let emailElement = null;

    for (const scope of scopes) {
      const candidates = [
        scope,
        ...Array.from(scope.querySelectorAll("*")),
      ].filter(outsideMirror);

      for (const candidate of candidates) {
        const values = [
          candidate.textContent || "",
          candidate.getAttribute?.("aria-label") || "",
          candidate.getAttribute?.("title") || "",
          candidate.getAttribute?.("data-email") || "",
        ];

        const match = values.join(" ").match(EMAIL_PATTERN);
        if (match) {
          email = match[0];
          emailElement = candidate;
          break;
        }
      }

      if (email) break;
    }

    let root = emailElement;
    for (let depth = 0; root && depth < 7; depth += 1) {
      const text = root.textContent || "";
      const rect = root.getBoundingClientRect?.() || {
        width: 0,
        height: 0,
      };
      const hasAvatar =
        root.querySelector?.("img, svg") ||
        /^[A-Z]{1,3}$/i.test(normalize(text));
      const hasAction = allActions(root).length > 0;

      if (
        EMAIL_PATTERN.test(text) &&
        (hasAvatar || hasAction) &&
        rect.width < 620
      ) {
        break;
      }

      root = root.parentElement;
    }

    root = root || emailElement || original;

    const excluded = new Set([
      "registry",
      "import excel",
      "add specimen",
      "online",
      "offline",
      "offline copy ready",
      "updates",
      "exit full screen",
      "full screen",
      "minimize",
      "exit",
      "logout",
      "log out",
      "sign out",
    ]);

    const values = visibleTextValues(root)
      .map((value) => value.replace(EMAIL_PATTERN, "").trim())
      .filter(Boolean)
      .filter((value) => !excluded.has(normalize(value)))
      .filter((value) => /[a-z]/i.test(value))
      .filter((value) => value.length >= 3 && value.length <= 80)
      .filter((value) => !/powered by luntian/i.test(value))
      .filter((value) => !/agriregistry/i.test(value));

    const name =
      values
        .filter((value) => /\s/.test(value))
        .sort((a, b) => b.length - a.length)[0] ||
      values.sort((a, b) => b.length - a.length)[0] ||
      "Account";

    return { root, name, email };
  }

  function initialsFor(name) {
    const parts = String(name || "")
      .replace(/[^a-z0-9 ]/gi, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!parts.length) return "A";
    if (parts.length === 1) return parts[0][0].toUpperCase();

    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  function refreshAccount(mirror, original) {
    const account = mirror.querySelector(".agri-v116-account");
    const nameElement = mirror.querySelector(
      ".agri-v116-account-name",
    );
    const emailElement = mirror.querySelector(
      ".agri-v116-account-email",
    );
    const avatar = mirror.querySelector(".agri-v116-avatar");

    if (!account || !nameElement || !emailElement || !avatar) return;

    const profile = findProfile(original);
    nameElement.textContent = profile.name || "Account";
    emailElement.textContent = profile.email || "";
    emailElement.title = profile.email || "";
    avatar.textContent = initialsFor(profile.name);

    account.classList.toggle(
      "agri-v116-account-unresolved",
      !profile.email,
    );
  }

  function refreshSync(mirror, original) {
    const primary = mirror.querySelector(
      ".agri-v116-sync-primary",
    );
    const secondary = mirror.querySelector(
      ".agri-v116-sync-secondary",
    );

    if (!primary || !secondary) return;

    const originalStatus = findStatusAction(original);
    const hint = normalize(
      originalStatus
        ? [
            originalStatus.textContent,
            originalStatus.getAttribute("aria-label"),
            originalStatus.getAttribute("title"),
          ].join(" ")
        : "",
    );

    if (/syncing|preparing|updating/.test(hint)) {
      primary.textContent = "Syncing";
      secondary.textContent = "Preparing offline copy";
    } else if (
      navigator.onLine === false ||
      /disconnected|offline(?! copy ready)/.test(hint)
    ) {
      primary.textContent = "Offline";
      secondary.textContent = "Local copy ready";
    } else {
      primary.textContent = "Online";
      secondary.textContent = "Offline copy ready";
    }
  }

  function refreshFullscreenLabel(mirror) {
    const button = mirror.querySelector(
      "[data-agri-v116-action='fullscreen']",
    );
    if (!button) return;

    const label = button.querySelector("span");
    if (!label) return;

    const original = findSemanticAction("fullscreen");
    const originalText = normalize(original?.textContent);

    label.textContent =
      document.fullscreenElement ||
      originalText.includes("exit full screen")
        ? "Exit full screen"
        : "Full screen";
  }

  function hideOriginal(original) {
    document
      .querySelectorAll(`[${ORIGINAL_ATTR}='true']`)
      .forEach((element) => {
        if (element !== original) {
          element.removeAttribute(ORIGINAL_ATTR);
        }
      });

    if (original) {
      original.setAttribute(ORIGINAL_ATTR, "true");
    }
  }

  function refresh() {
    const mirror = buildMirror();
    const original = findOriginalToolbar();

    hideOriginal(original);
    refreshLogo(mirror, original);
    refreshSync(mirror, original);
    refreshAccount(mirror, original);
    refreshFullscreenLabel(mirror);
  }

  function scheduleRefresh() {
    if (scheduled) cancelAnimationFrame(scheduled);

    scheduled = requestAnimationFrame(() => {
      scheduled = 0;
      refresh();
    });

    clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refresh, 140);
  }

  function start() {
    if (!document.body) {
      window.setTimeout(start, 30);
      return;
    }

    buildMirror();
    refresh();

    observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "aria-label",
        "title",
        "class",
        "style",
        "data-email",
        "data-name",
      ],
    });

    window.addEventListener("resize", scheduleRefresh, {
      passive: true,
    });
    window.addEventListener("online", scheduleRefresh);
    window.addEventListener("offline", scheduleRefresh);
    document.addEventListener(
      "fullscreenchange",
      scheduleRefresh,
    );

    window.setInterval(refresh, 1000);
    window.setTimeout(refresh, 50);
    window.setTimeout(refresh, 300);
    window.setTimeout(refresh, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {
      once: true,
    });
  } else {
    start();
  }
})();
