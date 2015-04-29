/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * This file tests the "devtools.inspector.mdnDocsTooltip.enabled" preference,
 * that we use to disable the MDN tooltip in the Inspector.
 *
 * The desired behavior is:
 * - if the preference is true, show the "Show MDN Docs" context menu item
 * - if the preference is false, don't show the item
 * - listen for changes to the pref, so we can show/hide the item dynamically
 *
 * Here's what the test does:
 * 1. set "devtools.inspector.mdnDocsTooltip.enabled" to true
 * 2. inspect an element
 * 3. click a property name in the rule view
 *   -> check that we see the MDN context menu item
 * 4. set "devtools.inspector.mdnDocsTooltip.enabled" to false
 * 5. click a property name in the rule view
 *   -> check that we do not see the MDN context menu item
 * 6. close the Inspector
 * 7. inspect an element
 * 8. click a property name in the rule view
 *   -> check that we do not see the MDN context menu item
 * 9. set "devtools.inspector.mdnDocsTooltip.enabled" to true
 * 10. click a property name in the rule view
 *   -> check that we see the MDN context menu item
 */

"use strict";

const { PrefObserver } = devtools.require("devtools/styleeditor/utils");
const PROPERTYNAME = "color";
const PREF_ENABLE_MDN_DOCS_TOOLTIP = "devtools.inspector.mdnDocsTooltip.enabled";
const PROPERTY_NAME_CLASS = "ruleview-propertyname";

const TEST_DOC = `
<html>
  <body>
    <div style="color: red">
      Test pref to enable the "Show MDN Docs" context menu option
    </div>
  </body>
</html>`;

add_task(function* () {

  info("Ensure the pref is true to begin with");
  let initial = Services.prefs.getBoolPref(PREF_ENABLE_MDN_DOCS_TOOLTIP);
  if (initial != true) {
    setBooleanPref(PREF_ENABLE_MDN_DOCS_TOOLTIP, true);
  }

  yield addTab("data:text/html;charset=utf8," + encodeURIComponent(TEST_DOC));

  let {inspector, view} = yield openRuleView();
  yield selectNode("div", inspector);
  yield testMdnContextMenuItemVisibility(view, true);

  yield setBooleanPref(PREF_ENABLE_MDN_DOCS_TOOLTIP, false);
  yield testMdnContextMenuItemVisibility(view, false);

  info("Close the Inspector");
  let target = TargetFactory.forTab(gBrowser.selectedTab);
  yield gDevTools.closeToolbox(target);

  ({inspector, view} = yield openRuleView());
  yield selectNode("div", inspector);
  yield testMdnContextMenuItemVisibility(view, false);

  yield setBooleanPref(PREF_ENABLE_MDN_DOCS_TOOLTIP, true);
  yield testMdnContextMenuItemVisibility(view, true);

  info("Ensure the pref is reset to its initial value");
  let eventual = Services.prefs.getBoolPref(PREF_ENABLE_MDN_DOCS_TOOLTIP);
  if (eventual != initial) {
    setBooleanPref(PREF_ENABLE_MDN_DOCS_TOOLTIP, initial);
  }
});

/**
 * Set a boolean pref, and wait for the pref observer to
 * trigger, so that code listening for the pref change
 * has had a chance to update itself.
 *
 * @param pref {string} Name of the pref to change
 * @param state {boolean} Desired value of the pref.
 *
 * Note that if the pref already has the value in `state`,
 * then the prefObserver will not trigger. So you should only
 * call this function if you know the pref's current value is
 * not `state`.
 */
function* setBooleanPref(pref, state) {
  let oncePrefChanged = promise.defer();
  let prefObserver = new PrefObserver("devtools.");
  prefObserver.on(pref, oncePrefChanged.resolve);
  info("Set the pref " + pref + " to: " + state);
  Services.prefs.setBoolPref(pref, state);
  info("Wait for prefObserver to call back so the UI can update");
  yield oncePrefChanged.promise;
  prefObserver.off(pref, oncePrefChanged.resolve);
}

/**
 * Test whether the MDN tooltop context menu item is visible when it should be.
 *
 * @param view The rule view
 * @param shouldBeVisible {boolean} Whether we expect the context
 * menu item to be visible or not.
 */
function* testMdnContextMenuItemVisibility(view, shouldBeVisible) {
  let message = shouldBeVisible? "shown": "hidden";
  info("Test that MDN context menu item is " + message);

  let root = rootElement(view);
  let node = root.querySelector("." + PROPERTY_NAME_CLASS).firstChild;
  info("Set " + node + " as popupNode");
  view.doc.popupNode = node;

  info("Update context menu state");
  view._contextMenuUpdate();
  let isVisible = !view.menuitemShowMdnDocs.hidden;
  is(isVisible, shouldBeVisible,
     "The MDN context menu item is " + message);
}

/**
 * Returns the root element for the rule view.
 */
let rootElement = view => (view.element) ? view.element : view.styleDocument;
