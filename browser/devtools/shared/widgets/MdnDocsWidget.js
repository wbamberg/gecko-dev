/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This file contains functions to retrieve docs content from
 * MDN (developer.mozilla.org) for particular items, and to display
 * the content in a tooltip.
 *
 * At the moment it only supports fetching content for CSS properties,
 * but it might support other types of content in the future
 * (Web APIs, for example).
 *
 * It's split into two parts:
 *
 * - functions like getCssDocs that just fetch content from MDN,
 * without any constraints on what to do with the content. If you
 * don't want to embed the content in some custom way, use this.
 *
 * - the MdnDocsWidget class, that manages and updates a tooltip
 * document whose content is taken from MDN. If you want to embed
 * the content in a tooltip, use this in conjunction with Tooltip.js.
 */

"use strict";

const {Cc, Cu, Ci} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Promise.jsm");

// see https://developer.mozilla.org/en-US/docs/MDN/Kuma/API#Document_parameters
const URL_POSTFIX = "?raw&macros";
var BASE_MDN_PAGE = "https://developer.mozilla.org/docs/Web/CSS/";
const BROWSER_WINDOW = 'navigator:browser';

/**
 * Test whether a node is all whitespace.
 *
 * @return {boolean}
 * True if the node all whitespace, otherwise false.
 */
function isAllWhitespace(node) {
  return !(/[^\t\n\r ]/.test(node.textContent));
}

/**
 * Test whether a node is a comment or whitespace node.
 *
 * @return {boolean}
 * True if the node is a comment node or is all whitespace, otherwise false.
 */
function isIgnorable(node) {
  return (node.nodeType == 8) || // A comment node
         ((node.nodeType == 3) && isAllWhitespace(node)); // text node, all ws
}

/**
 * Get the next node, skipping comments and whitespace.
 *
 * @return {node}
 * The next sibling node that is not a comment or whitespace, or null if
 * there isn't one.
 */
function nodeAfter(sib) {
  while ((sib = sib.nextSibling)) {
    if (!isIgnorable(sib)) return sib;
  }
  return null;
}

/**
 * Test whether the argument `node` is a node whose tag is `tagName`.
 *
 * @param {node} node
 * The code to test. May be null.
 *
 * @param {string} tagName
 * The tag name to test against.
 *
 * @return {boolean}
 * True if the node is not null and has the tag name `tagName`,
 * otherwise false.
 */
function hasTagName(node, tagName) {
  return node && node.tagName &&
         node.tagName.toLowerCase() == tagName.toLowerCase();
}

/**
 * Given an MDN page, get the "summary" portion.
 *
 * This is the textContent of the first non-whitespace
 * element in the #Summary section of the document.
 *
 * It's expected to be a <P> element.
 *
 * @param {Document} mdnDocument
 * The document in which to look for the "summary" section.
 *
 * @return {string}
 * The summary section as a string, or null if it could not be found.
 */
function getSummary(mdnDocument) {
  let summary = mdnDocument.getElementById("Summary");
  if (!hasTagName(summary, "H2")) {
    return null;
  }

  let firstParagraph = nodeAfter(summary);
  if (!hasTagName(firstParagraph, "P")) {
    return null;
  }

  return firstParagraph.textContent;
}

/**
 * Given an MDN page, get the "syntax" portion.
 *
 * First, this attempts to get the section of the page
 * with the ID "simplesyntax". Eventually, we hope that all
 * MDN pages will identify syntax examples using the ID,
 * but they don't, yet.
 *
 * If the page does not contain this
 * ID, we return the textContent of the second
 * non-whitespace node in the #Syntax section of the document.
 *
 * Both the first and second nodes are expected to be <PRE> nodes.
 *
 * @param {Document} mdnDocument
 * The document in which to look for the "syntax" section.
 *
 * @return {string}
 * The syntax section as a string, or null if it could not be found.
 */
function getSyntax(mdnDocument) {
  let syntaxSummary = mdnDocument.getElementById("simplesyntax");
  if (syntaxSummary) {
    return syntaxSummary.textContent;
  }

  let syntax = mdnDocument.getElementById("Syntax");
  if (!hasTagName(syntax, "H2")) {
    return null;
  }

  let firstParagraph = nodeAfter(syntax);
  if (!hasTagName(firstParagraph, "PRE")) {
    return null;
  }

  let secondParagraph = nodeAfter(firstParagraph);
  if (!hasTagName(secondParagraph, "PRE")) {
    return null;
  }

  return secondParagraph.textContent;
}

/**
 * Fetch an MDN page.
 *
 * @param {string} pageUrl
 * URL of the page to fetch.
 *
 * @return {promise}
 * The promise is resolved with the page as an XML document.
 *
 * The promise is rejected with an error message if
 * we could not load the page.
 */
function getMdnPage(pageUrl) {
  let deferred = Promise.defer();

  let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

  xhr.addEventListener("load", onLoaded, false);
  xhr.addEventListener("error", onError, false);

  xhr.open("GET", pageUrl);
  xhr.responseType = "document";
  xhr.send();

  function onLoaded(e) {
    if (xhr.status != 200) {
      deferred.reject({page: pageUrl, status: xhr.status});
    }
    else {
      deferred.resolve(xhr.responseXML);
    }
  }

  function onError(e) {
    deferred.reject({page: pageUrl, status: xhr.status});
  }

  return deferred.promise;
}

function makeDocsPageUrl(propertyName) {
  return BASE_MDN_PAGE + propertyName;
}

/**
 * Use a different URL for MDN pages. Used only for testing.
 *
 * @param {string} baseUrl
 * The baseURL to use.
 */
function setBaseUrl(baseUrl) {
  BASE_MDN_PAGE = baseUrl;
}

/**
 * Gets some docs for the given CSS property.
 * Loads an MDN page for the property and gets some
 * information about the property.
 *
 * @param {string} cssProperty
 * The property for which we want docs.
 *
 * @return {promise}
 * The promise is resolved with an object containing:
 * - summary: a short summary of the property
 * - syntax: some example syntax
 *
 * The promise is rejected with an error message if
 * we could not load the page.
 */
function getCssDocs(cssProperty) {
  let deferred = Promise.defer();
  let pageUrl = makeDocsPageUrl(cssProperty) + URL_POSTFIX;

  getMdnPage(pageUrl).then(parseDocsFromResponse, handleRejection);

  function parseDocsFromResponse(responseDocument) {
    let theDocs = {};
    theDocs.summary = getSummary(responseDocument);
    theDocs.syntax = getSyntax(responseDocument);
    deferred.resolve(theDocs);
  }

  function handleRejection(e) {
    deferred.reject(e.status);
  }

  return deferred.promise;
}

/**
 * A quick and dirty syntax highlighter for CSS declarations.
 *
 * @param {Document} document
 * A document, which we use for constructing DOM nodes.
 *
 * @param {Node} syntaxSection
 * A DOM node, which will be the host for the marked-up syntax section.
 *
 * @param {string} syntaxText
 * The syntax to parse, as a string.
 *
 * @returns Node
 * The syntax section, with all its children added.
 *
 * This function turns the string in syntaxText into a collection of DOM
 * nodes, which are inserted as children of syntaxSection.
 *
 * The DOM nodes it inserts represent:
 * - CSS comments, which are inserted as TEXT nodes
 * - CSS declarations, which are inserted as:
 *   - SPAN: propertyName
 *   - TEXT: ": "
 *   - SPAN: propertValue
 *   - TEXT: any trailing ";" and spaces
 * The SPAN nodes have CSS classes applied which will give them distinct colors.
 * The colors are chosen to match the colors in the Inspector's rule view.
 *
 * This function has the following goals and non-goals:
 * - it aims to parse CSS comments correctly, not putting any additional
 * constraints on how you comment up your example.
 * - it takes a very simplistic approach to parsing declarations. It simply:
 *  - removes any trailing ";" and whitespace and calls this a postfix
 *  - splits the remainder at the first ":". Treats the first half
 *  of this as name and the second half as value.
 *  - creates: [name | ": " | value | postfix]
 * - it doesn't try to validate the CSS at all. If your CSS is invalid the
 * syntax highlighting might not work (but the function should not crash)
 * - it doesn't try to distinguish different data types for values.
 */
function populatePropertySyntax(doc, syntaxSection, syntaxText) {

  function processDeclaration(declaration) {
    if (declaration.length === 0) {
      return;
    }

    let index = declaration.indexOf(":");
    if (index === -1) {
      // syntax error, add all of declaration as a text node
    }
    else {
      // remove a terminal ";" plus any trailing spaces, preserving them in a variable
      let declarationPostfixMatches = declaration.match(/;?( +)?$/);
      let declarationPostfix = declarationPostfixMatches? declarationPostfixMatches[0]: "";
      declaration = declaration.substring(0, declaration.length - declarationPostfix.length);

      // split name and value
      let propertyName = declaration.slice(0, index);
      let propertyValue = declaration.slice(index + 1, declaration.length);

      // create spans for name and value
      let propertyNameNode = doc.createElement("span");
      propertyNameNode.classList.add("theme-fg-color5");
      propertyNameNode.textContent = propertyName;
      syntaxSection.appendChild(propertyNameNode);

      let separator = doc.createTextNode(": ");
      syntaxSection.appendChild(separator);

      let propertyValueNode = doc.createElement("span");
      propertyValueNode.classList.add("theme-fg-color1");
      propertyValueNode.textContent = propertyValue;
      syntaxSection.appendChild(propertyValueNode);

      let terminator = doc.createTextNode(declarationPostfix);
      syntaxSection.appendChild(terminator);
    }
  }

  function processComment(comment) {
    // just a text node
    let textNode = doc.createTextNode(comment);
    syntaxSection.appendChild(textNode);
  }

  function processInCommentMode(inputString) {
    //-> look for comment termination
    //  -> if none, add this line as a comment, return true
    //  -> if there is one, add start of line to termination as a comment, return parseInNonCommentMode(string remainder)
    const COMMENT_CLOSER = "*/";
    let index = inputString.indexOf(COMMENT_CLOSER);
  
    if (index === -1) {
      // the string contained no comment closer
      // the whole string is a comment, and we are
      // still in comment mode
      processComment(inputString);
      return true;
    }
    else {
      // remainder is what's left after the end of the comment closer
      let remainder = inputString.slice(index + COMMENT_CLOSER.length, inputString.length);
      if (remainder.length === 0) {
        //the comment closer was at the end of the string
        processComment(inputString);
        return false;
      }
      else {
        // there is some non-comment after the comment closer
        processComment(inputString.slice(0, index + COMMENT_CLOSER.length));
        return processInNonCommentMode(remainder);
      }
    }
  }

  function processInNonCommentMode(inputString) {
    // -> look for comment opening
    //  -> if none, add this line as declaration, return false
    //  -> if one, add start of line to opening as a declaration, return parseInCommentMode(remainder)
    const COMMENT_OPENER = "/*";
    let index = inputString.indexOf(COMMENT_OPENER);

    if (index === -1) {
      // the string contained no comment opener
      // the whole string is a declaration, and we are
      // still in non-comment mode
      processDeclaration(inputString);
      return false;
    }
    else {
      // the string contained a comment opener.
      // the part before the comment opener is a declaration
      // then switch to comment mode and process the rest
      processDeclaration(inputString.slice(0, index));
      return processInCommentMode(inputString.slice(index, inputString.length));
    }
  }

  if (!syntaxText) {
    return;
  }

  let isInCommentMode = false;
  let lines = syntaxText.split("\n");

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (isInCommentMode) {
      isInCommentMode = processInCommentMode(line)
    }
    else {
      isInCommentMode = processInNonCommentMode(line)
    }

    let lineBreak = doc.createElement("br");
    syntaxSection.appendChild(lineBreak);
  }

  return syntaxSection;
}

/**
 * The MdnDocsWidget is used by tooltip code that needs to display docs
 * from MDN in a tooltip. The tooltip code loads a document that contains the
 * basic structure of a docs tooltip (loaded from mdn-docs-frame.xhtml),
 * and passes this document into the widget's constructor.
 *
 * In the constructor, the widget does some general setup that's not
 * dependent on the particular item we need docs for.
 *
 * After that, when the tooltip code needs to display docs for an item, it
 * asks the widget to retrieve the docs and update the document with them.
 *
 * @param {Document} tooltipDocument
 * A DOM document. The widget expects the document to have a particular
 * structure.
 */
function MdnDocsWidget(tooltipDocument) {
  this.tooltipDocument = tooltipDocument;

  // get the localized string for the link text
  let linkToMdn = tooltipDocument.getElementById("visit-mdn-page");
  linkToMdn.textContent = l10n.strings.GetStringFromName("docsTooltip.visitMDN");

  // listen for clicks and open in the browser window instead
  let browserWindow = Services.wm.getMostRecentWindow(BROWSER_WINDOW);
  linkToMdn.addEventListener("click", function(e) {
    e.stopPropagation();
    e.preventDefault();
    let link = e.target.href;
    browserWindow.gBrowser.addTab(link);
  });
}

MdnDocsWidget.prototype = {
  /**
   * This is called just before the tooltip is displayed, and is
   * passed the CSS property for which we want to display help.
   *
   * Its job is to make sure the document contains the docs
   * content for that CSS property.
   *
   * First, it initializes the document, setting the things it can
   * set synchronously, resetting the things it needs to get
   * asynchronously, and making sure the throbber is throbbing.
   *
   * Then it tries to get the content asynchronously, updating
   * the document with the content or with an error message.
   *
   * It returns immediately, so the caller can display the tooltip
   * without waiting for the asynch operation to complete.
   *
   * @param {string} propertyName
   * The name of the CSS property for which we need to display help.
   */
  loadCssDocs: function(propertyName) {

    /**
     * Do all the setup we can do synchronously, and get the document in
     * a state where it can be displayed while we are waiting for the
     * MDN docs content to be retrieved.
     */
    function initializeDocument(propertyName) {
      // set property name heading
      let propertyNameHeading = tooltipDocument.getElementById("property-name");
      propertyNameHeading.textContent = propertyName;

      // set link target
      let mdnLink = tooltipDocument.getElementById("visit-mdn-page");
      mdnLink.setAttribute("href", makeDocsPageUrl(propertyName));

      // clear docs summary and syntax
      let propertySummary = tooltipDocument.getElementById("summary");
      propertySummary.textContent = "";

      let propertySyntax = tooltipDocument.getElementById("syntax");
      propertySyntax.textContent = "";

      // show the throbber
      let propertyInfo = tooltipDocument.getElementById("property-info");
      propertyInfo.classList.add("devtools-throbber");
    }

    /**
     * This is called if we successfully got the docs content.
     * Finishes setting up the tooltip content, and disables the throbber.
     */
    function finalizeDocument({summary, syntax}) {
      // set docs summary and syntax
      let propertySummary = tooltipDocument.getElementById("summary");
      propertySummary.textContent = summary;

      // populate property syntax section
      let propertySyntaxSection = tooltipDocument.getElementById("syntax");
      let propertySyntaxContent = populatePropertySyntax(tooltipDocument, propertySyntaxSection, syntax);

      // hide the throbber
      let propertyInfo = tooltipDocument.getElementById("property-info");
      propertyInfo.classList.remove("devtools-throbber");

      deferred.resolve(this);
    }

    /**
     * This is called if we failed to get the docs content.
     * Sets the content to contain an error message, and disables the throbber.
     */
    function gotError(error) {
      let propertyNameHeading = tooltipDocument.getElementById("property-name");
      propertyNameHeading.textContent = propertyName;

      let propertySummary = tooltipDocument.getElementById("summary");
      propertySummary.textContent = l10n.strings.GetStringFromName("docsTooltip.loadDocsError");

      // hide the throbber
      let propertyInfo = tooltipDocument.getElementById("property-info");
      propertyInfo.classList.remove("devtools-throbber");

      // although gotError is called when there's an error, we have handled
      // the error, so call resolve not reject.
      deferred.resolve(this);
    }

    let deferred = Promise.defer();
    let tooltipDocument = this.tooltipDocument;

    initializeDocument(propertyName);
    getCssDocs(propertyName).then(finalizeDocument, gotError);

    return deferred.promise;
  }
}

/**
 * L10N utility class
 */
function L10N() {}
L10N.prototype = {};

let l10n = new L10N();

loader.lazyGetter(L10N.prototype, "strings", () => {
  return Services.strings.createBundle(
    "chrome://browser/locale/devtools/inspector.properties");
});

exports.setBaseUrl = setBaseUrl;
exports.getCssDocs = getCssDocs;
exports.MdnDocsWidget = MdnDocsWidget;
