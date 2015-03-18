/* vim: set ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const {CssDocsTooltip} = require("devtools/shared/widgets/Tooltip");
const {setBaseUrl, MdnDocsWidget} = devtools.require("devtools/shared/widgets/MdnDocsWidget");

const {Cc, Cu, Ci} = require("chrome");
Cu.import("resource://gre/modules/Promise.jsm");

// frame to load the tooltip into
const MDN_DOCS_TOOLTIP_FRAME = "chrome://browser/content/devtools/mdn-docs-frame.xhtml";

/**
 * Test properties
 *
 * In the real tooltip, a CSS property name is used to look up an MDN page
 * for that property.
 * In the test code, the names defined here are used to look up a page
 * served by the test server. We have different properties to test
 * different ways that the docs pages might be constructed, including errors
 * like pages that don't include docs where we expect.
 */
const BASIC_TESTING_PROPERTY = "html-mdn-css-basic-testing.html";
const SYNTAX_BY_ID = "html-mdn-css-syntax-id.html";
const NO_SUMMARY = "html-mdn-css-no-summary.html";
const NO_SYNTAX = "html-mdn-css-no-syntax.html";
const NO_SUMMARY_OR_SYNTAX = "html-mdn-css-no-summary-or-syntax.html";

add_task(function*() {
  setBaseUrl(TEST_URI_ROOT);

  yield promiseTab("about:blank");
  let [host, win, doc] = yield createHost("bottom", MDN_DOCS_TOOLTIP_FRAME);
  let widget = new MdnDocsWidget(win.document);

  // test all the basics
  yield testTheBasics(widget);

  // test a page that doesn't exist
  yield testNonExistentPage(widget);

  // test a page that identifies the syntax section with an ID
  yield testSyntaxById(widget);

  // test a page with no summary
  yield testNoSummary(widget);

  // test a page with no syntax
  yield testNoSyntax(widget);

  // test a page without summary or syntax
  yield testNoSummaryOrSyntax(widget);

  //info("Destroying the widget");
  //w.destroy();
  //is(container.children.length, 0, "All nodes have been removed");

  host.destroy();
  gBrowser.removeCurrentTab();

});

/**
 * Test all the basics
 * - initial content, before docs have loaded, is as expected
 * - throbber is set before docs have loaded
 * - contents are as expected after docs have loaded
 * - throbber is gone after docs have loaded
 * - mdn link text is correct and onclick behavior is correct
 */
function* testTheBasics(widget) {
  info("Test all the basic functionality in the widget");
  let doc = widget.tooltipDocument;

  info("Get the widget state before docs have loaded");
  let promise = widget.loadCssDocs(BASIC_TESTING_PROPERTY);

  info("Check initial contents before docs have loaded");
  checkTooltipContents(doc, {
    propertyName: BASIC_TESTING_PROPERTY,
    summary: "",
    syntax: ""
  });

  // throbber is set
  checkNodeHasClass(doc, "#property-info", "devtools-throbber", "Throbber is set");

  info("Now let the widget finish loading");
  yield promise;

  info("Check contents after docs have loaded");
  checkTooltipContents(doc, {
    propertyName: BASIC_TESTING_PROPERTY,
    summary: "A summary of the property.",
    syntax: "/* The part we want   */this: is-the-part-we-want"
  });

  // throbber is gone
  checkNodeHasNotClass(doc, "#property-info", "devtools-throbber", "Throbber is not set");

  info("Check that MDN link text is correct and onclick behavior is correct");
  yield checkMdnLink(BASIC_TESTING_PROPERTY, widget);

  function* checkMdnLink(testProperty, widget) {
    let mdnLink = widget.tooltipDocument.querySelector("#visit-mdn-page");
    is(mdnLink.href, TEST_URI_ROOT + testProperty, "MDN link href is correct");

    let uri = yield checkLinkClick(mdnLink);
    is(uri, TEST_URI_ROOT + testProperty, "MDN link click behavior is correct");
  }

  /**
   * Clicking the "Visit MDN Page" in the tooltip panel
   * should open a new browser tab with the page loaded.
   *
   * To test this we'll listen for a new tab opening, and
   * when it does, add a listener to that new tab to tell
   * us when it has loaded.
   *
   * Then we click the link.
   *
   * In the tab's load listener, we'll resolve the promise
   * with the URI, which is expected to match the href
   * in the orginal link.
   *
   *
   * One complexity is that when you open a new tab,
   * "about:blank" is first loaded into the tab before the
   * actual page. So we ignore that load event, and keep
   * listening until "load" is triggered for a different URI.
   */
  function checkLinkClick(link) {

    function loadListener(e) {
      let tab = e.target;
      var browser = getBrowser().getBrowserForTab(tab);
      var uri = browser.currentURI.spec;
      // this is horrible, and it's because when we open a new tab
      // "about:blank: is first loaded into it, before the actual
      // document we want to load.
      if (uri != "about:blank") {
        tab.removeEventListener("load", loadListener);
        gBrowser.removeTab(tab);
        deferred.resolve(uri);
      }
    }

    function newTabListener(e) {
      gBrowser.tabContainer.removeEventListener("TabOpen", newTabListener);
      var tab = e.target;
      tab.addEventListener("load", loadListener, false);
    }

    let deferred = Promise.defer();
    gBrowser.tabContainer.addEventListener("TabOpen", newTabListener, false);
    link.click();
    return deferred.promise;
  }

}

function* testNonExistentPage(widget) {
  info("Test a property for which we don't have a page");
  yield widget.loadCssDocs("i-dont-exist.html");
  checkTooltipContents(widget.tooltipDocument, {
    propertyName: "i-dont-exist.html",
    summary: "Could not load docs page.",
    syntax: ""
  });
}

function* testSyntaxById(widget) {
  info("Test a property whose syntax section is specified using an ID");
  yield widget.loadCssDocs(SYNTAX_BY_ID);
  checkTooltipContents(widget.tooltipDocument, {
    propertyName: SYNTAX_BY_ID,
    summary: "A summary of the property.",
    syntax: "/* The part we want   */this: is-the-part-we-want"
  });
}

function* testNoSummary(widget) {
  info("Test a property whose page doesn't have a summary");
  yield widget.loadCssDocs(NO_SUMMARY);
  checkTooltipContents(widget.tooltipDocument, {
    propertyName: NO_SUMMARY,
    summary: "",
    syntax: "/* The part we want   */this: is-the-part-we-want"
  });
}

function* testNoSyntax(widget) {
  info("Test a property whose page doesn't have a syntax");
  yield widget.loadCssDocs(NO_SYNTAX);
  checkTooltipContents(widget.tooltipDocument, {
    propertyName: NO_SYNTAX,
    summary: "A summary of the property.",
    syntax: ""
  });
}

function* testNoSummaryOrSyntax(widget) {
  info("Test a property whose page doesn't have a summary or a syntax");
  yield widget.loadCssDocs(NO_SUMMARY_OR_SYNTAX);
  checkTooltipContents(widget.tooltipDocument, {
    propertyName: NO_SUMMARY_OR_SYNTAX,
    summary: "",
    syntax: ""
  });
}

/*
 * Utility functions to check content of the tooltip.
 */

function checkNodeValue(doc, id, expected, message) {
  let node = doc.querySelector(id);
  is(node.textContent, expected, message);
}

function checkNodeHasClass(doc, id, className, message) {
  let node = doc.querySelector(id);
  ok(node.classList.contains(className), message);
}

function checkNodeHasNotClass(doc, id, className, message) {
  let node = doc.querySelector(id);
  ok(!node.classList.contains(className), message);
}

function checkTooltipContents(doc, expected) {

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



