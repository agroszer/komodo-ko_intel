// Namespace definition
if(typeof(ko) == "undefined") { var ko = {}; }
if(typeof(ko.extensions) == "undefined") { ko.extensions = {}; }
if(typeof(ko.extensions.ko_intel) == "undefined") { ko.extensions.ko_intel = {}; }
ko.extensions.ko_intel.prefsDlg = {};

/**
 * ko_intel's preferences dialog JavaScript implementation
 */
(function() {

  /**
   * Contains array with ID of all elements of our prefspane
   * @type {array}
   */
  const PREFSPANE_ELMS_ID = [
                             "ko_intel-enable-completion-checkbox",
                             "ko_intel-completion-minwordlength",
                             "ko_intel-completion-ignore-case",
                             "ko_intel-completion-speed",
                             "ko_intel-completion-look-history",
                             "ko_intel-completion-items",
                             "ko_intel-enable-clipboard-checkbox",
                             "ko_intel-clipboard-items",
                             ];



  /**
   * Getter for preferences service.
   * @type {Components.interfaces.nsIPrefService}
   */
  this.__defineGetter__("prefSrv",
      function() {
        return Components.classes["@mozilla.org/preferences-service;1"].
                getService(Components.interfaces.nsIPrefService).
                getBranch("extensions.ko_intel.");
      });

  /**
   * Getter for enableko_intel preferences key.
   * @type {boolean}
   */
  this.__defineGetter__("enableko_intel",
      function() { return this.prefSrv.getBoolPref("enableko_intel"); });

  /**
   * Getter for enableCompletion preferences key.
   * @type {boolean}
   */
  this.__defineGetter__("enableCompletion",
      function() { return this.prefSrv.getBoolPref("enableCompletion"); });

  /**
   * Getter for enableCompletion preferences key.
   * @type {boolean}
   */
  this.__defineGetter__("enableClipboard",
      function() { return this.prefSrv.getBoolPref("enableClipboard"); });


  /**
   * Fired when is main (and single) pane of ko_intel's preferences dialog
   * loaded.
   */
  this.onPaneLoad = function()
  {
    this.updatePane();
  }; // end onPaneLoad()


  /**
   * Update prefspane
   */
  this.updatePane = function()
  {
    try {
      for(var i=0; i<PREFSPANE_ELMS_ID.length; i++) {
        var control = document.getElementById(PREFSPANE_ELMS_ID[i]);

        if(control) {
          if(this.enableko_intel) {
            if(control.hasAttribute("disabled"))
              control.removeAttribute("disabled");
          } else {
            control.setAttribute("disabled", "true");
          }
        } else {
          Components.utils.reportError("Unable to get UI control with ID '" +
                                       PREFSPANE_ELMS_ID[i] + ".");
        }
      }
    } catch(e) {
      Components.utils.reportError(e);
    }
  }; // end updatePane()
}).apply(ko.extensions.ko_intel.prefsDlg);
