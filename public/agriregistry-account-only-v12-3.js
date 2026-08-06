/* AGRIREGISTRY_ACCOUNT_ONLY_V12_3 */
(() => {
  "use strict";

  const TOOLBAR_CLASS = "agriregistry-account-toolbar-v123";
  const UNIT_CLASS = "agriregistry-account-unit-v123";
  const CARD_CLASS = "agriregistry-account-card-v123";
  const COPY_CLASS = "agriregistry-account-copy-v123";
  const NAME_CLASS = "agriregistry-account-name-v123";
  const EMAIL_CLASS = "agriregistry-account-email-v123";
  const AVATAR_CLASS = "agriregistry-account-avatar-v123";
  const LOGOUT_CLASS = "agriregistry-account-logout-v123";

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

    return actions(root).find((element) => {
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

    return ancestorChain(registry)
      .filter((candidate) =>
        required.every((action) => candidate.contains(action)),
      )
      .filter((candidate) => {
        const rect = candidate.getBoundingClientRect();

        return (
          rect.top < 320 &&
          rect.height >= 60 &&
          rect.height <= 220 &&
          rect.width >= Math.min(window.innerWidth * 0.68, 900)
        );
      })[0] || null;
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

  function findProfileCard(toolbar, emailElement) {
    let current = emailElement;

    for (let depth = 0; depth < 9; depth += 1) {
      const parent = current.parentElement;

      if (!parent || !toolbar.contains(parent)) break;

      const rect = parent.getBoundingClientRect();
      const text = parent.textContent || "";
      const hasEmail = EMAIL_PATTERN.test(text);
      const hasAction = actions(parent).length >= 1;

      current = parent;

      if (
        hasEmail &&
        hasAction &&
        rect.width >= 110 &&
        rect.width <= 480 &&
        rect.height >= 42 &&
        rect.height <= 105
      ) {
        break;
      }
    }

    return current;
  }

  function clearClasses() {
    document
      .querySelectorAll(
        [
          `.${TOOLBAR_CLASS}`,
          `.${UNIT_CLASS}`,
          `.${CARD_CLASS}`,
          `.${COPY_CLASS}`,
          `.${NAME_CLASS}`,
          `.${EMAIL_CLASS}`,
          `.${AVATAR_CLASS}`,
          `.${LOGOUT_CLASS}`,
        ].join(","),
      )
      .forEach((element) => {
        element.classList.remove(
          TOOLBAR_CLASS,
          UNIT_CLASS,
          CARD_CLASS,
          COPY_CLASS,
          NAME_CLASS,
          EMAIL_CLASS,
          AVATAR_CLASS,
          LOGOUT_CLASS,
        );
      });
  }

  function markAvatar(card) {
    const candidates = Array.from(
      card.querySelectorAll("img, svg, span, div"),
    ).filter(visible);

    const avatar = candidates.find((element) => {
      const rect = element.getBoundingClientRect();
      const text = normalize(element.textContent);

      return (
        rect.width >= 32 &&
        rect.width <= 70 &&
        rect.height >= 32 &&
        rect.height <= 70 &&
        (
          /^[a-z]{1,3}$/i.test(text) ||
          element.tagName.toLowerCase() === "img"
        )
      );
    }) || null;

    avatar?.classList.add(AVATAR_CLASS);
  }

  function markLogout(card) {
    const logout = actions(card).find((element) => {
      const hint = actionHint(element);

      return (
        hint.includes("logout") ||
        hint.includes("log out") ||
        hint.includes("sign out")
      );
    }) || actions(card)[actions(card).length - 1] || null;

    logout?.classList.add(LOGOUT_CLASS);
  }

  function markNameAndEmail(card, emailElement) {
    emailElement.classList.add(EMAIL_CLASS);

    const emailMatch = (
      emailElement.textContent || ""
    ).match(EMAIL_PATTERN);

    if (emailMatch) {
      emailElement.setAttribute("title", emailMatch[0]);
    }

    const candidates = Array.from(
      card.querySelectorAll("span, p, div"),
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
        const aText = (a.textContent || "").trim();
        const bText = (b.textContent || "").trim();

        return bText.length - aText.length;
      });

    const name = candidates[0] || null;
    name?.classList.add(NAME_CLASS);

    const copy =
      name &&
      name.parentElement === emailElement.parentElement
        ? name.parentElement
        : emailElement.parentElement;

    copy?.classList.add(COPY_CLASS);

    if (name) {
      name.setAttribute(
        "title",
        (name.textContent || "").trim(),
      );
    }
  }

  function apply() {
    clearClasses();

    const toolbar = findToolbar();
    if (!toolbar) return;

    const emailElement = smallestEmailElement(toolbar);
    if (!emailElement) return;

    const card = findProfileCard(toolbar, emailElement);
    if (!card) return;

    const unit =
      directUnit(card, toolbar) ||
      card;

    toolbar.classList.add(TOOLBAR_CLASS);
    unit.classList.add(UNIT_CLASS);
    card.classList.add(CARD_CLASS);

    markAvatar(card);
    markLogout(card);
    markNameAndEmail(card, emailElement);

    requestAnimationFrame(() => {
      toolbar.scrollLeft = toolbar.scrollWidth;
    });
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
