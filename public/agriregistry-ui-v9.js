/* AGRIREGISTRY_UI_V9 */
(() => {
  "use strict";

  const PENDING_KEY = "agriregistry-login-animation-pending-v9";
  const LOGO_KEY = "agriregistry-login-animation-logo-v9";
  const TOOLBAR_CLASS = "agriregistry-v9-toolbar";
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

  const normalize = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const visible = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };

  const compactText = (element) => normalize(element?.textContent);

  function findAction(label) {
    const target = normalize(label);
    return Array.from(document.querySelectorAll("button, a, [role='button']"))
      .find((element) => visible(element) && compactText(element) === target) || null;
  }

  function toolbarScore(element) {
    const text = compactText(element);
    let score = 0;
    for (const label of knownLabels) {
      if (text.includes(label)) score += 1;
    }
    return score;
  }

  function findToolbar() {
    const seeds = [
      findAction("Registry"),
      findAction("Add specimen"),
      findAction("Updates"),
      findAction("Minimize"),
    ].filter(Boolean);

    const candidates = new Set();

    for (const seed of seeds) {
      let current = seed;
      for (let depth = 0; current && depth < 9; depth += 1) {
        if (current instanceof HTMLElement && current !== document.body) {
          const score = toolbarScore(current);
          if (score >= 4) candidates.add(current);
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
        return areaA - areaB;
      })[0] || null;
  }

  function markClosestUnit(element, className, toolbar) {
    if (!element) return null;

    let unit = element;
    while (
      unit.parentElement &&
      unit.parentElement !== toolbar &&
      unit.parentElement.children.length <= 4
    ) {
      unit = unit.parentElement;
    }

    unit.classList.add(className);
    return unit;
  }

  function markToolbar() {
    const toolbar = findToolbar();
    if (!toolbar) return false;

    toolbar.classList.add(TOOLBAR_CLASS);

    const controls = Array.from(
      toolbar.querySelectorAll("button, a, [role='button']"),
    );

    for (const control of controls) {
      const text = compactText(control);
      control.classList.add("agriregistry-v9-control");

      if (
        text === "registry" ||
        text === "import excel" ||
        text === "add specimen" ||
        text === "updates"
      ) {
        control.classList.add("agriregistry-v9-nav-control");
      }

      if (
        text.includes("full screen") ||
        text === "minimize" ||
        text === "exit"
      ) {
        control.classList.add("agriregistry-v9-window-control");
        control.setAttribute("title", control.textContent.trim());
      }
    }

    const images = Array.from(toolbar.querySelectorAll("img"));
    const logoImage = images.find((image) => {
      const hint = normalize(`${image.alt} ${image.src}`);
      return hint.includes("agri") || hint.includes("logo");
    }) || images[0];

    if (logoImage) {
      markClosestUnit(logoImage, "agriregistry-v9-logo", toolbar);
    }

    const onlineElement = Array.from(toolbar.querySelectorAll("*"))
      .find((element) => compactText(element) === "online");

    if (onlineElement) {
      const statusUnit = markClosestUnit(
        onlineElement,
        "agriregistry-v9-status",
        toolbar,
      );

      if (statusUnit) {
        Array.from(statusUnit.querySelectorAll("*"))
          .filter((element) => compactText(element).includes("offline copy ready"))
          .forEach((element) =>
            element.classList.add("agriregistry-v9-status-note"),
          );
      }
    }

    const directChildren = Array.from(toolbar.children);
    const likelyProfile = directChildren
      .filter((child) => child instanceof HTMLElement)
      .filter((child) => !child.classList.contains("agriregistry-v9-logo"))
      .filter((child) => {
        const text = compactText(child);
        return !knownLabels.some((label) => text === label);
      })
      .reverse()
      .find((child) => {
        const hasAvatar = child.querySelector("img, [class*='avatar'], [class*='Avatar']");
        const hasShortName = compactText(child).length > 0 && compactText(child).length < 80;
        return Boolean(hasAvatar && hasShortName);
      });

    if (likelyProfile) {
      likelyProfile.classList.add("agriregistry-v9-profile");
    } else if (directChildren.length > 1) {
      const last = directChildren[directChildren.length - 1];
      if (last instanceof HTMLElement && !last.matches("button, a")) {
        last.classList.add("agriregistry-v9-profile");
      }
    }

    return true;
  }

  function findLoginForm() {
    return Array.from(document.querySelectorAll("form"))
      .find((form) =>
        visible(form) && Boolean(form.querySelector("input[type='password']")),
      ) || null;
  }

  function findLogoNear(element) {
    if (!element) return "";

    let current = element;
    for (let depth = 0; current && depth < 6; depth += 1) {
      const images = Array.from(current.querySelectorAll?.("img") || []);
      const logo = images.find((image) => {
        const hint = normalize(`${image.alt} ${image.src}`);
        return hint.includes("agri") || hint.includes("logo");
      }) || images[0];

      if (logo?.src) return logo.src;
      current = current.parentElement;
    }

    return "";
  }

  function armLoginAnimation(form) {
    try {
      sessionStorage.setItem(PENDING_KEY, "1");
      const logo = findLogoNear(form);
      if (logo) sessionStorage.setItem(LOGO_KEY, logo);
    } catch {
      // Storage may be unavailable in a restricted browser context.
    }
  }

  function ensureLoginCredit() {
    const form = findLoginForm();
    if (!form) return;

    const parent = form.parentElement || form;
    if (parent.querySelector(".agriregistry-v9-login-credit")) return;

    const credit = document.createElement("div");
    credit.className = "agriregistry-v9-login-credit";
    credit.textContent = "Powered by Luntian";
    parent.appendChild(credit);
  }

  function pendingLoginAnimation() {
    try {
      return sessionStorage.getItem(PENDING_KEY) === "1";
    } catch {
      return false;
    }
  }

  function dashboardIsReady() {
    const passwordInput = document.querySelector("input[type='password']");
    return Boolean(findToolbar() && (!passwordInput || !visible(passwordInput)));
  }

  function getStoredLogo() {
    try {
      return sessionStorage.getItem(LOGO_KEY) || "";
    } catch {
      return "";
    }
  }

  function clearPendingAnimation() {
    try {
      sessionStorage.removeItem(PENDING_KEY);
      sessionStorage.removeItem(LOGO_KEY);
    } catch {
      // Nothing to clear.
    }
  }

  function showLoginAnimation() {
    if (!pendingLoginAnimation() || !dashboardIsReady()) return;
    if (document.getElementById("agriregistry-v9-login-splash")) return;

    const storedLogo = getStoredLogo();
    clearPendingAnimation();

    const splash = document.createElement("div");
    splash.id = "agriregistry-v9-login-splash";
    splash.setAttribute("aria-hidden", "true");

    const logoSource = storedLogo || (() => {
      const toolbar = findToolbar();
      return toolbar?.querySelector("img")?.src || "";
    })();

    const logoMarkup = logoSource
      ? `<img src="${logoSource.replace(/"/g, "&quot;")}" alt="AgriRegistry logo">`
      : '<span class="agriregistry-v9-leaf-mark" aria-hidden="true"></span>';

    const sprouts = [12, 24, 38, 62, 76, 88]
      .map((left, index) =>
        `<span class="agriregistry-v9-sprout" style="--sprout-left:${left}%;--sprout-delay:${index * 75}ms"></span>`,
      )
      .join("");

    splash.innerHTML = `
      ${sprouts}
      <div class="agriregistry-v9-splash-card">
        <div class="agriregistry-v9-logo-shell">${logoMarkup}</div>
        <div class="agriregistry-v9-splash-title">AgriRegistry</div>
        <div class="agriregistry-v9-splash-subtitle">Powered by Luntian</div>
      </div>
    `;

    document.body.appendChild(splash);

    requestAnimationFrame(() => {
      splash.classList.add("agriregistry-v9-visible");
    });

    window.setTimeout(() => {
      splash.classList.add("agriregistry-v9-exit");
    }, 1850);

    window.setTimeout(() => {
      splash.remove();
    }, 2250);
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
    "click",
    (event) => {
      const target = event.target instanceof Element
        ? event.target.closest("button, [role='button'], input[type='submit']")
        : null;

      if (!target) return;

      const label = normalize(target.textContent || target.getAttribute("value"));
      if (!/(log in|login|sign in)/.test(label)) return;

      const form = target.closest("form") || findLoginForm();
      if (form?.querySelector("input[type='password']")) {
        armLoginAnimation(form);
      }
    },
    true,
  );

  let scheduled = false;
  const refresh = () => {
    if (scheduled) return;
    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      markToolbar();
      ensureLoginCredit();
      showLoginAnimation();
    });
  };

  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  window.addEventListener("resize", refresh, { passive: true });
  document.addEventListener("DOMContentLoaded", refresh, { once: true });
  refresh();
})();