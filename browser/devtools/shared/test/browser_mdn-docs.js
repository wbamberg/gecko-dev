/* vim: set ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const MDN_DOCS_TOOLTIP_FRAME = "chrome://browser/content/devtools/mdn-docs-frame.xhtml";
const TEST_MDN_BASE_URL = "http://example.com/browser/browser/devtools/shared/test/";

const {CssDocsTooltip} = require("devtools/shared/widgets/Tooltip");
const {setBaseUrl, MdnDocsWidget} = devtools.require("devtools/shared/widgets/MdnDocsWidget");

add_task(function*() {
  setBaseUrl(TEST_MDN_BASE_URL);

  yield promiseTab("about:blank");
  let [host, win, doc] = yield createHost("bottom", MDN_DOCS_TOOLTIP_FRAME);

  info("Checking that the markup is created in the parent");

  let widget = new MdnDocsWidget(win.document);

  yield widget.loadCssDocs("html-mdn-css-property.html");

  checkTooltipContents({
    propertyName: "html-mdn-css-property.html",
    summary: "A summary of the property.",
    syntax: "/* The part we want   */\nthis: is-the-part-we-want"
  });

  function checkTooltipContents(expected) {
    checkNodeValue(doc, 
                   "#property-name",
                   expected.propertyName,
                   "Property name is correct");

    checkNodeValue(doc, 
                   "#summary",
                   expected.summary,
                   "Summary is correct");

    checkNodeValue(doc, 
                   "#syntax",
                   expected.syntax,
                   "Syntax is correct");
  }


  host.destroy();
  gBrowser.removeCurrentTab();
});

function checkNodeValue(document, id, expected, message) {
  let node = document.querySelector(id);
  is(node.textContent, expected, message);
}

