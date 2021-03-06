const Cu = Components.utils;
const Ci = Components.interfaces;

const { Services } = Cu.import("resource://gre/modules/Services.jsm");

// Load a duplicated copy of the jsm to prevent messing with the currently running one
let scope = {};
Services.scriptloader.loadSubScript("resource://gre/modules/Screenshot.jsm", scope);
const { Screenshot } = scope;

let index = -1;
function next() {
  index++;
  if (index >= steps.length) {
    assert.ok(false, "Shouldn't get here!");
    return;
  }
  try {
    steps[index]();
  } catch(ex) {
    assert.ok(false, "Caught exception: " + ex);
  }
}

let steps = [
  function getScreenshot() {
    let screenshot = Screenshot.get();
    assert.ok(screenshot instanceof Ci.nsIDOMFile,
              "Screenshot.get() returns a File");
    next();
  },

  function endOfTest() {
    sendAsyncMessage("finish");
  }
];

next();
