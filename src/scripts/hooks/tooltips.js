const TooltipManager = foundry.helpers.interaction.TooltipManager.implementation;

/**
 * A class responsible for orchestrating tooltips in the system.
 */
class TooltipsPTU {
  /* -------------------------------------------- */
  /*  Properties & Getters                        */
  /* -------------------------------------------- */

  /**
   * The currently registered observer.
   * @type {MutationObserver}
   */
  #observer;

  /**
   * The tooltip element.
   * @type {HTMLElement}
   */
  get tooltip() {
    return this.#tooltip;
  }

  #tooltip = document.getElementById("tooltip");

  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */

  /**
   * Initialize the mutation observer.
   */
  observe() {
    this.#observer?.disconnect();
    this.#observer = new MutationObserver(this._onMutation.bind(this));
    this.#observer.observe(this.tooltip, { attributeFilter: ["class"], attributeOldValue: true });
  }

  /* -------------------------------------------- */

  /**
   * Handle a mutation event.
   * @param {MutationRecord[]} mutationList  The list of changes.
   * @protected
   */
  _onMutation(mutationList) {
    let isActive = false;
    const tooltip = this.tooltip;
    for ( const { type, attributeName, oldValue } of mutationList ) {
      if ( (type === "attributes") && (attributeName === "class") ) {
        const difference = new Set(tooltip.classList).difference(new Set(oldValue?.split(" ")));
        if ( difference.has("active") ) isActive = true;
      }
    }
    if ( isActive ) this._onTooltipActivate();
  }

  /* -------------------------------------------- */

  /**
   * Handle tooltip activation.
   * @protected
   * @returns {Promise}
   */
  async _onTooltipActivate() {
    const { element } = game.tooltip;
    const { dataset } = element;
    const extras = dataset.tooltipExtras;
    const nearestThemed = element.closest(".themed") ?? element.ownerDocument.body;
    const [, theme] = nearestThemed.className.match(/(?:^|\s)(theme-\w+)/) ?? [];
    const isContentLink = element.classList.contains("content-link");
    const loading = this.tooltip.querySelector(".loading");
    const isSheetTooltip = loading?.dataset.uuid !== undefined;

    if ( isContentLink || isSheetTooltip ) {
      this.tooltip.classList.remove("theme-dark");
      this.tooltip.classList.add(theme ? theme : "theme-light");
    }

    // General content links
    if ( isContentLink ) {
      const doc = await fromUuid(game.tooltip.element.dataset.uuid);
      return this._onHoverContentLink(doc, { extras });
    }

    // Sheet-specific tooltips
    if ( isSheetTooltip ) {
      const doc = await fromUuid(loading.dataset.uuid);
      return this._onHoverContentLink(doc, { extras });
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle hovering over a content link and showing rich tooltips if possible.
   * @param {Document} doc             The document linked by the content link.
   * @param {object} [options={}]
   * @param {string} [options.extras]  Extra HTML displayed with the tooltip.
   * @returns {void}
   * @protected
   */
  async _onHoverContentLink(doc, { extras }={}) {
    // TODO: Need a way to ask the chat message how to resolve the UUID via a destroyed Item, but don't want to put chat
    //  message-specific logic here.
    if ( !doc ) return game.tooltip.deactivate();
    if ( extras ) extras = foundry.utils.cleanHTML(extras);
    const { content, classes } = await (doc.richTooltip?.({ extras }) ?? doc.system?.richTooltip?.({ extras }) ?? {});
    if ( !content ) return;
    this.tooltip.innerHTML = content;
    if ( classes?.length ) this.tooltip.classList.add(...classes);
    if (!game.tooltip.element) return;
    const { tooltipDirection } = game.tooltip.element.dataset;
    requestAnimationFrame(() => this._positionItemTooltip(tooltipDirection));
  }

  /* -------------------------------------------- */

  /**
   * Position a tooltip after rendering.
   * @param {string} [direction]  The direction to position the tooltip.
   * @protected
   */
  _positionItemTooltip(direction) {
    if ( !direction ) {
      direction = TooltipManager.TOOLTIP_DIRECTIONS.LEFT;
      game.tooltip._setAnchor(direction);
    }

    const pos = this.tooltip.getBoundingClientRect();
    const dirs = TooltipManager.TOOLTIP_DIRECTIONS;
    const { innerHeight, innerWidth } = this.tooltip.ownerDocument.defaultView;
    switch ( direction ) {
      case dirs.UP:
        if ( pos.y - TooltipManager.TOOLTIP_MARGIN_PX <= 0 ) direction = dirs.DOWN;
        break;
      case dirs.DOWN:
        if ( pos.y + this.tooltip.offsetHeight > innerHeight ) direction = dirs.UP;
        break;
      case dirs.LEFT:
        if ( pos.x - TooltipManager.TOOLTIP_MARGIN_PX <= 0 ) direction = dirs.RIGHT;
        break;
      case dirs.RIGHT:
        if ( pos.x + this.tooltip.offsetWidth > innerWidth ) direction = dirs.LEFT;
        break;
    }

    game.tooltip._setAnchor(direction);

    // Set overflowing styles for item tooltips.
    if ( this.tooltip.classList.contains("document-tooltip") ) {
      const description = this.tooltip.querySelector(".description");
      description?.classList.toggle("overflowing", description.clientHeight < description.scrollHeight);
    }
  }

  /* -------------------------------------------- */
  /*  Static Helpers                              */
  /* -------------------------------------------- */

  /**
   * Intercept middle-click listeners to prevent scrolling behavior inside a locked tooltip when attempting to lock
   * another tooltip.
   */
  static activateListeners() {
    document.addEventListener("pointerdown", event => {
      if ( (event.button === 1) && event.target.closest(".locked-tooltip") ) {
        event.preventDefault();
      }
    }, { capture: true });
  }
}

export const Tooltips = {
  listen() {
    Hooks.once("init", ()=>{
      CONFIG.PTU.tooltips = new TooltipsPTU();
    })
    Hooks.once("setup", ()=>{
      TooltipsPTU.activateListeners();
      CONFIG.PTU.tooltips.observe();

      // override foundry.applications.ux.TextEditor.implementation._createContentLink in a closure
      foundry.applications.ux.TextEditor.implementation._createContentLink = ((original)=>{
        return async (match, enrichmentOptions) => {
          const [type, target, hash, name] = match.slice(1, 5);
          const uuid = target.indexOf(" ") === -1 ? target : target.substring(0, target.indexOf(" "));
          const contentLink = await original.call(foundry.applications.ux.TextEditor, [null, type, uuid, hash, name], enrichmentOptions);
          // target may contain additional attributes in the form of `data-key-in-kebab="value"` we need to add as additional attributes
          const RE = /([^\s=]+)=["']?((?:.(?!["']?\s+(?:\S+)=|["']))+.)["']?/g;
          let submatch;
          while ((submatch = RE.exec(target)) !== null) {
            const key = submatch[1];
            const value = submatch[2];
            if (key && value && key.startsWith("data-")) contentLink.dataset[key.substring(5).replace(/-([a-z])/g, g => g[1].toUpperCase())] = value;
            else if (key && value) contentLink.setAttribute(key, value);
          }
          return contentLink;
        };
      })(foundry.applications.ux.TextEditor.implementation._createContentLink);
    })
  }
}