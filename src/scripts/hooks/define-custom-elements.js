import { default as IconElement } from "../../module/apps/components/icon.js";

export const DefineCustomElements = {
  listen: () => {
    window.customElements.define(IconElement.tagName, IconElement);
  }
};

