/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * This file tests the code that integrates the Style Inspector's rule view
 * with the MDN docs tooltip.
 *
 * If you display the context click on a property name in the rule view, you
 * should see a menu item "Show MDN Docs". If you click that item, the MDN
 * docs tooltip should be shown, containing docs from MDN for that property.
 * 
 * This file tests that:
 * - the context menu item is shown when it should be shown and hidden when
 * it should be hidden
 * - clicking the context menu item shows the tooltip
 * - pressing "Escape" while the tooltip is showing hides the tooltip
 */

"use strict";

const {setBaseCssDocsUrl} = devtools.require("devtools/shared/widgets/MdnDocsWidget");
Cu.import("resource://gre/modules/Promise.jsm");

const PROPERTYNAME_SELECTOR = ".ruleview-propertyname";
const PROPERTYNAME = "color";

add_task(function* () {
  // Test is slow on Linux EC2 instances - Bug 1137765
  // ???
  requestLongerTimeout(2);

  const TEST_DOC = '<html>                                              \
                      <body>                                            \
                        <div style="color: red">                        \
                          Test "Show MDN Docs" context menu option      \
                        </div>                                          \
                      </body>                                           \
                    </html>';

  yield addTab("data:text/html;charset=utf8," + encodeURIComponent(TEST_DOC));

  let {inspector, view} = yield openRuleView();
  yield selectNode("div", inspector);

  yield testMdnContextMenuItemVisibility(view);

  yield testShowAndHideMdnTooltip(view);

  yield clearCurrentNodeSelection(inspector);

});

/**
 * Test that the MDN context menu item is shown when it should be,
 * and hidden when it should be.
 *   - iterate through every node in the rule view
 *   - set that node as popupNode (the node that the context menu
 *   is shown for)
 *   - update the context menu's state
 *   - test that the MDN context menu item is hidden, or not,
 *   depending on popupNode
 */
function* testMdnContextMenuItemVisibility(view) {
  info("Test that MDN context menu item is shown only when it should be.");

  let root = rootElement(view);
  for (let node of iterateNodes(root)) {
    info("Setting " + node + " as popupNode");
    if (view.doc) {
      view.doc.popupNode = node;
    }
    else {
      view.popupNode = node;
    }

    info("Updating context menu state");
    view._contextMenuUpdate();
    let isVisible = !view.menuitemShowMdnDocs.hidden;
    let shouldBeVisible = isPropertyNameNode(node);
    let message = shouldBeVisible? "shown": "hidden";
    is(isVisible, shouldBeVisible,
       "The MDN context menu item is " + message);
  }
}

/**
 * Test that:
 *  - the MDN tooltip is shown when we click the context menu item
 *  - the tooltip's contents have been initialized (we don't fully
 *  test this here, as it's fully tested with the tooltip test code)
 *  - the tooltip is hidden when we press Escape
 */
function* testShowAndHideMdnTooltip(view) {
  setBaseCssDocsUrl(TEST_URL_ROOT);

  info("Setting the popupNode for the MDN docs tooltip");
  let root = rootElement(view);
  let propertyNameSpan = root.querySelector(PROPERTYNAME_SELECTOR);
  if (view.doc) {
    view.doc.popupNode = propertyNameSpan.firstChild;
  }
  view._contextMenuUpdate();

  let cssDocs = view.tooltips.cssDocs;

  info("Showing the MDN docs tooltip");
  let onShown = cssDocs.tooltip.once("shown");
  view.menuitemShowMdnDocs.click();
  yield onShown;
  ok(true, "The MDN docs tooltip was shown");

  info("Quick check that the tooltip contents are set");
  let tooltipDocument = cssDocs.tooltip.content.contentDocument;
  let h1 = tooltipDocument.getElementById("property-name");
  is(PROPERTYNAME, h1.textContent, "The MDN docs tooltip h1 is correct");

  info("Simulate pressing the 'Escape' key");
  let onHidden = cssDocs.tooltip.once("hidden");
  EventUtils.sendKey("escape");
  yield onHidden;
  ok(true, "The MDN docs tooltip was hidden on pressing 'escape'");
}

/**
 * Check if a node is a property name.
 */
function isPropertyNameNode(node) {
  return ((node.nodeType === node.TEXT_NODE) &&
          (node.textContent === "color"));
}

/**
 * A generator that iterates recursively through all child nodes of baseNode.
 */
function* iterateNodes(baseNode) {
  yield baseNode;

  for (let child of baseNode.childNodes) {
    yield* iterateNodes(child);
  }
}

/**
 * Returns the root element for the given view, rule or computed.
 */
let rootElement = view => (view.element) ? view.element : view.styleDocument;
