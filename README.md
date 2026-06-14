[![foundry-shield]][foundry-url]
![Discord](https://img.shields.io/discord/748601513835888682?logo=discord&label=Discord&link=https%3A%2F%2Fdiscord.gg%2Fptufvtt)
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![All Release Downloads](https://img.shields.io/github/downloads/dylanpiera/Foundry-Pokemon-Tabletop-United-System/total.svg)]()

# PTR System
The Pokemon Tabletop Reunited system for FoundryVTT is a continuation of the Pokemon Tabletop United system, with balance changes, and new content, created with FoundryVTT in mind.

Feel free to open an issue or join our [Discord Server](https://discord.gg/ptrfvtt) for any questions & feedback.

## Contributing Content
To contribute content, please message @dylan.is.super.ok on Discord for contributor access to this repository. You can contribute either directly via Git (with a branch + pull request), or with the Content Sync system in this dev build.

## How to Install
#### Dev Build (V13)
If you would like to use this fast-releasing dev build with Content Sync features, import the following manifest into foundry:
```
https://github.com/righthandofvecna/fvtt-ptr/releases/latest/download/system.json
```

#### Release Build (V13)
If you would like to use the latest stable build, just import the following manifest into foundry: 
```
https://github.com/pokemon-tabletop-reunited/ptr1e/releases/latest/download/system.json
```

#### Legacy Build (V12)
If you would like to use the latest build for Foundry v12, just import the following manifest into foundry: 
```
https://github.com/righthandofvecna/fvtt-ptr/releases/download/4.3.7/system.json
```

#### PTU 1.05 (V10 - Not Recommended)
If you're looking for the Non-PTR version you can install the [PTU Branch](https://github.com/pokemon-tabletop-reunited/ptr1e/tree/PTU-1.05)
Please note that this branch is no longer receiving updates and is only compatible with Foundry v10.


## 🚨 Changes From Stable 🚨
- [Improve logic for "Show In Token Panel"](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/965)
- Money and Item reward system post-combat
- [@CompSearch Enricher fixes](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/964)
- Initial Foundry v14 compatibility
- Add button for applying effects from non-roll or attack-roll-only items/moves
- Added Instant Change Rule Element (automated Potions with it)
- [Added Heal On Damage Dealt Rule](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/934)
- [Make Features Nest Without Requiring Update](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/960)
- [Make Dragging Pokemon into Folders Work To Update Flags](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/954)
- Add visible Slug field to Reference items
- [Fixed Inability to Import Pokemon](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/948)
- Added "Form" field to the species item header
- Added editable Dex entry field
- [Added "Tapped" indicator on stats](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/953)
- Don't auto-focus the token panel on update
- [Don't allow Pokemon to level up past their level cap without a warning](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/952)
- Don't fail to evolve if no image is found
- Display Maximum Controllable Level Range
- Fixed Exp Awarding Logic
- [Added "Reset Custom Frequency" button](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/944)
- Added (sluggified) keywords as item roll options
- [Added Reminder Rule Element type](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/867)
- [Added Modifications section to Grant Item rule](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/942)
- [Chat Messages: Show Domains/Selectors and Roll Options](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/941)
- [Automated Animations Integration Improvements](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/943)
- [Added a system for restricting items by "Content Set"](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/932)
- [Added fallback support for webm token images](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/933)
- [Added PokeDex updates to the token scan action](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/935)
- Updated the Rulebook Journal with WarforgedWordsmith's updates
- [Support Journals in the content-sync system](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/936)
- [Item Piles Compatibility Fix](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/443)
- Dev Option to allow Unlinked Tokens - NOT currently ready to test in a live world. Turn on at your own risk
- Add a system for showing content devs if a move has been automated in system (and searching by that in the compendium browser)
- Added new roll options (`self:spdef:stage:2`) for more automation (and automated Defensive Charm with them)
- Removed the range field for action points (so scrolling on the character sheet doesn't edit your action point total accidentally)
- [Fixed a bug that was turning features in the token panel back on automatically](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/899)
- Re-added the AP cost field for feats and edges
- Fixed a bug that meant that half the stage change effects were excluded from the compendium
- [Token panel improvements - Undock and resize, pokedex button](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/924)
- [Dragging moves directly off species sheets](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/893)
- [Improving the daily pokemon training sheet](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/920)
- Fixed overhealing due to clearing injuries bug
- [Fine tuned the advancement reminder settings - exclude NPCs and other people's pokemon](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/926)
- Finished adding the proper UI editors for all of the remaining Rule Element types
- Added a user setting to disable the Advancement Pending indicator in the sidebar
- [Improved the Frequency Tracking UI, added house rule settings](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/912)
- Added a GM Control panel (accessible via the little shield icon on the right, in the sidebar controls) for resetting move frequencies and healing all actors
- Added a new system for formulaic Damage Bases (work-in-progress)
- Display type effectiveness in the token panel
- [Added automatic Frequency tracking for moves, abilities, etc](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/878)
- [Boss multiple-initiatives now don't fail to roll](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/903)
- [On Level-Up, increase current HP by max HP difference](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/850)
- [Adds Advancement pending indicator](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/901)
- [Add Capabilities tab to the Compendium Browser](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/898) - you still need to enable it in the compendium browser settings
- [Dragging Items onto a Character Sheet now works the first time](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/892)
- [Temporary effects are now removed after combat ends](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/902)
- Made the Weather panel not have disabled controls
- Added a "minimize" button to the token panel, which persists per user
- [Make Type and Value of the "Effectiveness" rule element resolve injected properties](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/888)
- [Add XP awarding automation post-combat](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/881)
- [Let "Flat Modifier" rule elements access its own injected item properties](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/880)
- Redesigned Token Panel moved from Top Right to Bottom Right (near old position) beneath the sidebar
- Add `move:super-effective` and `move:not-very-effective` Roll Options
- Fix rolling a skill while targeting a pokemon
- Add mega sprites and mega stones
- Push To Chat On Left Click From Token Panel
- [Fixed Keywords in Species Compendium Browser Tab](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/875)
- [Add Capabilities and Edges Tab to Token Panel](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/871)
- [Optional Contest Tabs](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/869)
- [Tab Scroll Position Not Being Lost On Edit](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/859)
- [Drag Ruler Coloring Based On Move Speed](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/858)
- [Purchasing Item Increases Quantity By Current Quantity](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/854)
- [Throwing Pokeballs to Catch Should Reduce Quantity](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/848)
- [Save Button on Character Sheet Triggering On Submit](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/846)
- [Tagify Not Defined Error](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/844)
- [Flat Bonuses Adding Twice](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/840)
- [Habitat and Egg Group Search in Compendium](https://github.com/pokemon-tabletop-reunited/ptr1e/issues/841)
- The addition of a basic Github-Foundry Item Sync system ("Commit to Github")
- Building out the Github-Foundry Item Sync system a bit more (auto-stages linked items, enforces them being in the compendium)
- Grey-on-grey text in chat fixed
- Tagify Dropdown Text Color Black
- Compendium Browser "Moves" tab loading
- **Lots of content fixes**

## 🐛 Still-Active Bugs 🐛
[Open Issues Not Fixed In Dev](https://github.com/pokemon-tabletop-reunited/ptr1e/issues?q=is%3Aissue%20state%3Aopen%20-label%3A%22fixed%20in%20dev%22)

## Links & Recommendations
- [Quick Insert](https://gitlab.com/fvtt-modules-lab/quick-insert) is an amazing addon that allows you to drag & drop all over the place even more easily. We 1000% recommend using their module in conjuncture with our system!
- [Pokemon Assets](https://github.com/righthandofvecna/pokemon-assets) adds a bunch of Pokemon-specific automation and overworld sprites!
- [Wiki](https://1e.ptr.wiki)

## Special Thanks
* [cswendrowski](https://github.com/cswendrowski) for starting this project!
* https://www.theworldofpokemon.com/ for their amazing pokedex entries 
* The Amazing People and their amazing feedback, over at the [PTR Dev Server](https://discord.gg/ptrfvtt)

## Copyright
Pokémon © 2002-2023 Pokémon. © 1995-2023 Nintendo/Creatures Inc./GAME FREAK inc. TM, ® and Pokémon character names are trademarks of Nintendo.
No copyright or trademark infringement is intended in using Pokémon content for the PTU for FoundryVTT System.

[foundry-shield]: https://img.shields.io/badge/Foundry-v13.348-success
[foundry-url]: https://foundryvtt.com/
[forks-shield]: https://img.shields.io/github/forks/dylanpiera/Foundry-Pokemon-Tabletop-United-System.svg
[forks-url]: https://github.com/dylanpiera/Foundry-Pokemon-Tabletop-United-System/network/members
[stars-shield]: https://img.shields.io/github/stars/dylanpiera/Foundry-Pokemon-Tabletop-United-System.svg
[stars-url]: https://github.com/dylanpiera/Foundry-Pokemon-Tabletop-United-System/stargazers
[issues-shield]: https://img.shields.io/github/issues/dylanpiera/Foundry-Pokemon-Tabletop-United-System.svg
[issues-url]: https://github.com/dylanpiera/Foundry-Pokemon-Tabletop-United-System/issues
