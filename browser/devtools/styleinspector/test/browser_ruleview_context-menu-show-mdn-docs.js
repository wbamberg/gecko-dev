/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 http://creativecommons.org/publicdomain/zero/1.0/ */
"use strict";

const {setBaseUrl, MdnDocsWidget} = devtools.require("devtools/shared/widgets/MdnDocsWidget");

const PROPERTYNAME_SELECTOR = ".ruleview-propertyname";
const PROPERTYNAME = "color";

add_task(function* () {
  // Test is slow on Linux EC2 instances - Bug 1137765
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

  yield testIsContextMenuItemShownCorrectly(view);

  yield testShowMdnTooltip(view);

  yield clearCurrentNodeSelection(inspector);

});

function* testIsContextMenuItemShownCorrectly(view) {
  info("Test that the function used to show/hide the 'Show MDN Docs' context menu item is correct.");

  testIsPropertyNamePopupOnAllNodes(view);

}

/**
 * A function testing that _isPropertyNamePopup returns a correct value for all nodes
 * in the view.
 */
function testIsPropertyNamePopupOnAllNodes(view) {
  let root = rootElement(view);
  for (let node of iterateNodes(root)) {
    testIsPropertyNamePopupOnNode(view, node);
  }
}

function* testShowMdnTooltip(view) {
  setBaseUrl(TEST_URL_ROOT);

  let root = rootElement(view);
  let propertyNameSpan = root.querySelector(PROPERTYNAME_SELECTOR);
  if (view.doc) {
    view.doc.popupNode = propertyNameSpan.firstChild;
  }

  let cssDocs = view.tooltips.cssDocs;
  ok(cssDocs, "The rule-view has the expected cssDocs property");

  let cssDocsPanel = cssDocs.tooltip.panel;
  ok(cssDocsPanel, "The XUL panel for the cssDocs tooltip exists");

  let onShown = cssDocs.tooltip.once("shown");
  view._onShowMdnDocs();
  
  yield onShown;
  ok(true, "The cssDocs tooltip was shown");

  let tooltipDocument = cssDocs.tooltip.content.contentDocument;
  let h1 = tooltipDocument.getElementById("property-name");
  is(PROPERTYNAME, h1.textContent, "The CSS docs tooltip h1 is correct");
}

/**
 * Test result of _isPropertyNamePopup with given node.
 * @param object view
 *               A CSSRuleView.
 * @param Node node
 *             A node to check.
 */
function testIsPropertyNamePopupOnNode(view, node) {
  info("Testing node " + node);
  if (view.doc) {
    view.doc.popupNode = node;
  }
  else {
    view.popupNode = node;
  }

  let result = view._isPropertyNamePopup();
  let correct = isPropertyNameNode(node);

  is(result, correct, "_isPropertyNamePopup returned the expected value " + correct);
}

/**
 * Check if a node is a property name.
 */
function isPropertyNameNode(node) {
  return ((node.nodeType === node.TEXT_NODE) &&
          (node.textContent === "color"));
}

/**
 * A generator that iterates recursively trough all child nodes of baseNode.
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
