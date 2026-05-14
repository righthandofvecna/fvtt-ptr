export const ItemPilesHooks = {
  listen() {
    Hooks.on("item-piles-preDropItemDetermined", function (a, b, dropData, d) {
      if (dropData?.item?.type != "item") {
        return false; // Cancel Item Piles dialogue if the dragged item is not a 'real' item.
      }
    });

    Hooks.on("item-piles-createItemPile", async function (created_token, options) {

      // check if the item pile being created is a pile or not (chest, vault, merchant are other possibilities)
      // let flags = created_token?.data?.actorData?.flags;

      // Set the name of the item pile to be either the name of the item, or a fallback generic name,
      // set the image (have to do it here, not earlier, since we can't do async fetches for item images
      // in time until the token exists), and set a flag in case Token Tooltip Alt is being used that 
      // marks the item pile as a token that should not have the usual tooltips.
      await created_token.update({
        "flags.token-tooltip-alt.noTooltip": true
      });

      // await created_token.data.actorData.items[0].update({ // TODO: Figure out how to update the actual items within the unlinked actor that get created here, since they don't trip the createItem hook
      //     "img": ( new_image )
      // });
    });

    Hooks.on("preCreateCombatant", function (actor, { actorId, hidden, sceneId, tokenId } = {}, metadata, userId) {
      if (!actor?.token?.flags?.["item-piles"]?.data?.enabled) return;

      // check if we're only selecting item piles
      const selected = game.canvas.tokens.placeables.filter(o => o.controlled).map(o => o.document);
      const selectedPiles = selected.filter((token) => token?.flags?.["item-piles"]?.data?.enabled);
      const allPiles = selected.length == selectedPiles.length;
      if (allPiles) return;
      // actor.token.object.release();
      if (selectedPiles[0]?.id === tokenId) {
        ui.notifications.info(`${selectedPiles.length} selected Item Pile${selectedPiles.length !== 1 ? "s" : ""} not added to combat!`);
      }
      return false;
    });

    // Why is this in the item piles compatibility file?
    Hooks.on("createItem", async function (ptu_item, options, id) {

      if ((game.userId != id) || (ptu_item?.type != "item")) { return true; }

      let item_name = ptu_item?.name ?? "Generic Item";
      item_name = item_name.replace("Thrown ", "").replace("Broken ", "");
      let item_current_img = ptu_item?.img;

      if ((item_current_img == "icons/svg/mystery-man.svg") || (item_current_img == "icons/svg/item-bag.svg") || (item_current_img == "systems/ptu/static/images/item_icons/generic item.webp")) {
        let new_image = await GetItemArt(item_name)

        console.log("preCreateItem: Default image detected, replacing with:");
        console.log(new_image);

        if (new_image != undefined) {
          // ptu_item.img = new_image;
          // ptu_item.data.img = new_image;
          await ptu_item.update({ "img": new_image });
        }
      }
    });

    Hooks.once("item-piles-ready", async () => {
      game.itempiles.API.addSystemIntegration({
        "VERSION": "1.0.1",

        // The actor class type is the type of actor that will be used for the default item pile actor that is created on first item drop.
        "ACTOR_CLASS_TYPE": "character",

        // The item quantity attribute is the path to the attribute on items that denote how many of that item that exists
        "ITEM_QUANTITY_ATTRIBUTE": "system.quantity",

        // The item price attribute is the path to the attribute on each item that determine how much it costs
        "ITEM_PRICE_ATTRIBUTE": "system.cost",

        // Item types and the filters actively remove items from the item pile inventory UI that users cannot loot, such as spells, feats, and classes
        "ITEM_FILTERS": [
          {
            "path": "type",
            "filters": "ability,capability,condition,contestmove,dexentry,edge,effect,feat,move,pokeball,pokeedge,reference,species,spiritaction"
          }
        ],

        "UNSTACKABLE_ITEM_TYPES": [],

        // Item similarities determines how item piles detect similarities and differences in the system
        "ITEM_SIMILARITIES": [],

        // Currencies in item piles is a versatile system that can accept actor attributes (a number field on the actor's sheet) or items (actual items in their inventory)
        // In the case of attributes, the path is relative to the "actor.system"
        // In the case of items, it is recommended you export the item with `.toObject()` and strip out any module data
        "CURRENCIES": [{
          "primary": true,
          "name": "Poké",
          "abbreviation": "{#}₽",
          "exchangeRate": 1,
          "data": {
            "path": "system.money",
          },
        }],
      });

      game.settings.set("item-piles", "hideActorHeaderButton", false);
    });
  }
}

export async function GetItemArt(item_name, type = ".webp") {

  const imgDirectoryPath = "systems/ptu/static/images/item_icons/";
  const customImgDirectoryPath = game.settings.get("ptu", "customItemIconDirectory");

  const basePath = imgDirectoryPath + (imgDirectoryPath.endsWith('/') ? '' : '/');
  const customBasePath = customImgDirectoryPath + (customImgDirectoryPath.endsWith('/') ? '' : '/');

  let clean_item_name = item_name.replace("é", "e").replace(":", "").toLowerCase();
  if (clean_item_name.includes("tm")) {
    clean_item_name = "tm";
  }

  let path = customBasePath + clean_item_name + type;
  let result = await fetch(path);

  if (result.status === 404) {
    path = customBasePath + clean_item_name + ".png";
    result = await fetch(path);
  }

  if (result.status === 404) {
    path = basePath + clean_item_name + type;
    result = await fetch(path);
  }

  if (result.status === 404) {
    path = basePath + clean_item_name + ".png";
    result = await fetch(path);
  }

  if (result.status === 404) {
    return undefined;
  }
  return path;
} 