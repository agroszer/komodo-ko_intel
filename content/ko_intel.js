/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is ko_intel extension.
 *
 * The Initial Developer of the Original Code is Ondrej Donek.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Ondrej Donek, <ondrejd@gmail.com> (Original Author)
 *   Adam Groszer, <agroszer@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

xtk.include("clipboard");

// taken from http://xregexp.com/xregexp.js
RegExp.escape = function(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}
function ko_intelFixedSizeStack(maxItems) {
    this.items = new Array();
    this.maxItems = maxItems ? maxItems : 100;
}

ko_intelFixedSizeStack.prototype = {
    push : function(item) {
        if (this.items.length >= this.maxItems) {
            this.items.splice(0, 1);
        }
        this.items.push(item);
    },

    pop : function() {
        return this.items.pop();
    },

    peek : function() {
        return this.items[this.items.length - 1];
    },

    get length() {
        return this.items.length;
    },

    clear : function() {
        this.items.splice(0, this.items.length);
    },

    resize : function(newSize) {
        this.maxItems = newSize;
    },

    remove : function(idx) {
        this.items.splice(idx, 1);
    },

    toString : function() {
        var arr = new Array();
        for (var i = 0; i < this.items.length; i++) {
            arr.push(i + ":" + this.items[i]);
        }
        return arr.join("\n");
    }
}

function ko_intelHash()
  {
      this.length = 0;
      this.items = new Array();
      for (var i = 0; i < arguments.length; i += 2) {
          if (typeof(arguments[i + 1]) != 'undefined') {
              this.items[arguments[i]] = arguments[i + 1];
              this.length++;
          }
      }

      this.removeItem = function(in_key)
      {
          var tmp_value;
          if (typeof(this.items[in_key]) != 'undefined') {
              this.length--;
              tmp_value = this.items[in_key];
              delete this.items[in_key];
          }

          return tmp_value;
      };

      this.getItem = function(in_key) {
          return this.items[in_key];
      };

      this.setItem = function(in_key, in_value)
      {
          if (typeof(in_value) != 'undefined') {
              if (typeof(this.items[in_key]) == 'undefined') {
                  this.length++;
              }

              this.items[in_key] = in_value;
          }

          return in_value;
      };

      this.hasItem = function(in_key)
      {
          return typeof(this.items[in_key]) != 'undefined';
      };
  }


// Namespace definition
if(typeof(ko) == "undefined") { var ko = {}; }
if(typeof(ko.extensions) == "undefined") { ko.extensions = {}; }
ko.extensions.ko_intel = {};

/**
 * ko_intel JavaScript implementation
 */
(function() {
  //completion constants, to be made preferences
  const KO_INTEL_MAX_COMPLETION_ITEMS = 12;

  //filesize limit -- long files just lock up
  const KO_INTEL_FILESIZELIMIT = 1024*1024;

  // Some variables
  var log          = ko.logging.getLogger("ko.extensions.ko_intel");
  var observerSvc  = Components.classes["@mozilla.org/observer-service;1"].
                     getService(Components.interfaces.nsIObserverService);


  //last word being completed
  var completionWord = null;

  //last inserted text
  var lastInsertedWord = null;

  //last completion positon (used for timer)
  var lastCompletionPos = '';

  //completion positon being shown on the treelist
  var completionsShown = '';
  var completionsShownAt = null;

  //completion timer
  var completionTimer = null;

  var clipboardHistory = null;
  var lastClipboardHistoryText = '';
  var clipboardHistoryCounter = 0;
  var clipboardTimer = null;

  const KO_INTEL_CLIPBOARD_HISTORY_LRU = false;
  const KO_INTEL_SEPARATORS = ' ./:';

  // ========================================================================
  // Preferences

  var prefSrv = Components.classes["@mozilla.org/preferences-service;1"].
      getService(Components.interfaces.nsIPrefService).
      getBranch("extensions.ko_intel.");

  this.prefs =
  {
    // Getters/Setters
    get enableko_intel() { return prefSrv.getBoolPref("enableko_intel"); },
    set enableko_intel(val) { prefSrv.setBoolPref("enableko_intel", val); },

    get enableCompletion() { return prefSrv.getBoolPref("enableCompletion"); },
    set enableCompletion(val) { prefSrv.setBoolPref("enableCompletion", val); },

    get enableClipboard() { return prefSrv.getBoolPref("enableClipboard"); },
    set enableClipboard(val) { prefSrv.setBoolPref("enableClipboard", val); },

    get completionMinWordLength() { return prefSrv.getIntPref("completionMinWordLength"); },
    set completionMinWordLength(val) { return prefSrv.setIntPref("completionMinWordLength", val); },

    get completionIgnoreCase() { return prefSrv.getBoolPref("completionIgnoreCase"); },
    set completionIgnoreCase(val) { return prefSrv.setBoolPref("completionIgnoreCase", val); },

    get completionSpeed() { return prefSrv.getIntPref("completionSpeed"); },
    set completionSpeed(val) { return prefSrv.setIntPref("completionSpeed", val); },

    get completionItems() { return prefSrv.getIntPref("completionItems"); },
    set completionItems(val) { return prefSrv.setIntPref("completionItems", val); },

    get completionLookHistory() { return prefSrv.getBoolPref("completionLookHistory"); },
    set completionLookHistory(val) { return prefSrv.setBoolPref("completionLookHistory", val); },

    get clipboardItems() { return prefSrv.getIntPref("clipboardItems"); },
    set clipboardItems(val) { return prefSrv.setIntPref("clipboardItems", val); },


    /**
     * Set preferences if not exist (ko_intel is running for first time).
     * Called from this.onLoad()
     */
    checkPrefs : function()
    {
      try {
        if(!prefSrv.prefHasUserValue("enableko_intel"))
          prefSrv.setBoolPref("enableko_intel", true);

        if(!prefSrv.prefHasUserValue("enableCompletion"))
          prefSrv.setBoolPref("enableCompletion", true);

        if(!prefSrv.prefHasUserValue("enableClipboard"))
          prefSrv.setBoolPref("enableClipboard", true);


        if(!prefSrv.prefHasUserValue("completionMinWordLength"))
          prefSrv.setIntPref("completionMinWordLength", 3);

        if(!prefSrv.prefHasUserValue("completionIgnoreCase"))
          prefSrv.setBoolPref("completionIgnoreCase", false);

        if(!prefSrv.prefHasUserValue("completionSpeed"))
          prefSrv.setIntPref("completionSpeed", 100);

        if(!prefSrv.prefHasUserValue("completionItems"))
          prefSrv.setIntPref("completionItems", KO_INTEL_MAX_COMPLETION_ITEMS);

        if(!prefSrv.prefHasUserValue("completionLookHistory"))
          prefSrv.setBoolPref("completionLookHistory", false);

        if(!prefSrv.prefHasUserValue("clipboardItems"))
          prefSrv.setIntPref("clipboardItems", KO_INTEL_MAX_COMPLETION_ITEMS);

      } catch (e) {
          log.exception(e);
      }


    } // end checkPrefs()
  };


  // ========================================================================


  /**
   * Prototype object for single ko_intel's treeitem
   *
   * @param aIndex {integer}
   * @param aLabel {string}
   * @param aFullPath {string}
   * @param aBaseName {string}
   * @param aIsDirty {boolean}
   * @param aType {string}
   */
  function ko_intelTreeitemPrototype(aIndex, aLabel, aFullPath, aBaseName,
                                 aIsDirty, aType, current)
  {
    this.index    = ko.extensions.ko_intel.indexMaker(aIndex);
    this.label    = aLabel;
    this.fullPath = aFullPath;
    this.baseName = aBaseName;
    this.isDirty  = aIsDirty;
    this.type     = aType;
    this.current  = current;
  }

  function ko_intelClipboardItemPrototype(text, usageCount, addIndex, current)
  {
    this.text       = text;
    this.usageCount = usageCount;
    this.addIndex   = addIndex;
    this.current    = current;
  }

  /**
   * Helper prototype object for tree sorting
   *
   * @type Object
   */
  var ko_intelTreesortHelper = {
    /**
     * Contains name of currently sorted column.
     * @type {string}
     */
    mCol : "",

    /**
     * Holds sort direction: -1 is descending, 0 is natural, 1 is ascending.
     * Meaned as private.
     * @type {integer}
     */
    mDirection : 0,

    /**
     * Returns string representing currently used direction
     * @param {string}
     */
    get mDirectionStr(){ return (this.mDirection == 1) ? "ascending" : "descending"; },

    /**
     * Holds count of tree items to examine if tree's row count is changed from
     * last sort (if we can use simple array reverse).
     * @type {integer}
     */
    mFastIndex : 0,

    /**
     * Method for performing sorting.
     * @param {object}
     * @param {object}
     * @returns {integer}
     */
    sort : function(aX, aY) {
      var isIndex = (this.mCol.indexOf("-tree-position-col") > 0) ? true : false;
      var x = (isIndex) ? parseInt(aX.index) : aX.label;
      var y = (isIndex) ? parseInt(aY.index) : aY.label;

      if(x > y) return 1;
      if(x < y) return -1;

      return 0;
    }
  };

  // return all open views to check by intellisense
  this.getAllOpenDocumentViews = function() {
        var views = [];
        try {
            var windows = ko.windowManager.getWindows();

            for (var i in windows) {
                var w = windows[i];

                //var arr = w.ko.views.manager.topView.getDocumentViews(true);

                //this one should be in recently used order:
                arr = w.ko.views.manager.topView.viewhistory._recentViews;
                for (var j in arr) {
                    var view = arr[j];
                    try {
                        if (view != null && view.scimoz != null) {
                            views.push(view.scimoz);
                        }
                    }
                    catch (e) {
                        //just in case there's no scimoz attr, skip this
                    }
                }
            }
        } catch (e) {
            log.exception(e);
        }
        return views;
    };

  this.getWord = function() {
      try {
          var sm = ko.views.manager.currentView.scimoz;
          var curinsert = sm.currentPos;
          var lineno = sm.lineFromPosition(curinsert);
          var startofLinePos = sm.positionFromLine(lineno);
          var line = sm.getTextRange(startofLinePos, curinsert);

          var ml = ko.extensions.ko_intel.prefs.completionMinWordLength;
          var myregexp;
          var words;
          if (KO_INTEL_SEPARATORS) {
            myregexp = new RegExp("(\\w+["+KO_INTEL_SEPARATORS+"]?\\w{0,"+(ml-1)+"})$", "gm");
            words = line.match(myregexp);
            if (words) {
              return words[0];
            }
          }

          myregexp = new RegExp("(\\w{"+ml+",})$", "gm");
          words = line.match(myregexp);
          if (words) {
            return words[0];
          } else {
            return '';
          }
      } catch (e) {
          log.exception(e);
      }
      return '';
  };

  // return words to complete the prefix at curpos
  this.getCompletion = function(completionIgnoreCase, curpos) {
    var rv = new Array();

    try {
        timeSvc = Components.classes["@activestate.com/koTime;1"].
            getService(Components.interfaces.koITime);

        var startTime = timeSvc.time();

        var word = ko.extensions.ko_intel.getWord();
        var fullword = ko.interpolate.getWordUnderCursor();

        if (word.length < ko.extensions.ko_intel.prefs.completionMinWordLength) {
            ko.extensions.ko_intel.completionWord = '';
            return rv;
            }

        ko.extensions.ko_intel.completionWord = word;

        var options;
        if (completionIgnoreCase) {
          options = "gim";
        } else {
          options = "gm";
        }

        word = RegExp.escape(word);
        var myregexp = new RegExp("\\b" + word + "\\w+\\b", options);

        var sm = ko.views.manager.currentView.scimoz;
        var maxItems = ko.extensions.ko_intel.prefs.completionItems;

        words = new ko_intelHash();

        function addWord(w) {
            if ((w != "") && (!words.hasItem(w)) && w != fullword) {
                words.setItem(w,1);
            }
        }

        // maybe use myregexp.exec
        if (sm.textLength < KO_INTEL_FILESIZELIMIT) {
            var wbefore = sm.getTextRange(0, sm.currentPos).match(myregexp);

            if (wbefore) {
                for (var i=wbefore.length-1;
                     (i>=0 && words.items.length < maxItems);
                     i--) {
                    addWord(wbefore[i]);
                }
            }

            if (words.items.length < maxItems) {
                var wafter = sm.getTextRange(sm.currentPos, sm.textLength).match(myregexp);

                if (wafter) {
                    for (var j=0;
                         (j<wafter.length && words.items.length < maxItems);
                         j++) {
                        addWord(wafter[j]);
                    }
                }
            }
        }

        //half of the timer setting -- plenty to do left
        var maxTime = (ko.extensions.ko_intel.prefs.completionSpeed / 1000)/2;

        if (words.items.length < maxItems
            && ko.extensions.ko_intel.prefs.completionLookHistory) {

            var views = this.getAllOpenDocumentViews();

            //alert(views);

            for (var i in views) {
                var viewScimoz = views[i];

                var duration = timeSvc.time() - startTime;
                //time limited lookup

                if (words.items.length < maxItems
                    && duration < maxTime //time limit
                    && viewScimoz.textLength < KO_INTEL_FILESIZELIMIT //length limit at 1MB
                    ) {
                    //no break in JS???

                    var viewMatches = viewScimoz.text.match(myregexp);

                    if (viewMatches) {
                        for (i=0;
                            (i<viewMatches.length && words.items.length < maxItems);
                            i++) {
                            addWord(viewMatches[i]);
                        }
                    }
                }
            }
        }

        var index = 1;
        for (var x in words.items) {
            rv.push(new ko_intelTreeitemPrototype(index,
                                              x,
                                              x,
                                              '',
                                              false,
                                              '',
                                              false));
            index++;
            if (index > maxItems) break;
        }

        // see how much time is spent in a lookup:
        var duration = timeSvc.time() - startTime;
        if (duration > maxTime) {
          var msg = "getCompletion for "+word+" in "+duration+" at "+curpos;
          log.warn(msg);
        }

    }
    catch(e)
    {
        log.exception(e);
    }

    return rv;
  };

  /**
   * Common tree view prototype object. As a parameter is expected used
   * tree view items.
   *
   * @param aTreeitems {array}
   */
  function ko_intelTreeviewPrototype(aTreeitems) {
    this.treeitems = aTreeitems;
  }

  ko_intelTreeviewPrototype.prototype =
  {
    treebox   : null,
    selection : null,

    get rowCount() { return this.treeitems.length; },

    get idPrefix() {
      return "ko_intel-" + ko.extensions.ko_intel.prefs.displayWhere + "-tree";
    },

    get atomSrv() {
      return Components.classes["@mozilla.org/atom-service;1"].
          getService(Components.interfaces.nsIAtomService);
    },

    setTree : function(aOut) {
      this.treebox = aOut;
    },

    getCellText : function(aRow, aCol)
    {
      if (aCol.id.indexOf('col-index') > 0)
        return this.treeitems[aRow].index;

      if (aCol.id.indexOf('col-label') > 0) {
        if (ko.extensions.ko_intel.prefs.showIcons) {
          return " " + this.treeitems[aRow].label;
        } else {
          return this.treeitems[aRow].label;
        }
      }

      return "";
    },

    getCellValue : function(aRow, aCol)
    {
      return this.treeitems[aRow].fullPath;
    },

    get currentSelectedItem() {
        if (this.selection.currentIndex < 0) {
            return null;
        }
        return this.treeitems[this.selection.currentIndex];
    },

    getCellProperties : function(aRow, aCol, aProp)
    {
      //log.warn(this.treeitems[aRow]+this.treeitems[aRow].current);

      if(this.treeitems[aRow].current) {
        if (aProp) {
          aProp.AppendElement(this.atomSrv.getAtom("currentView"));
        } else {
          return "currentView";
        }
      } else {
        if(ko.extensions.ko_intel.prefs.highlightCurrent) {
          var currentView = ko.views.manager.currentView;

          if(currentView.koDoc.displayPath == this.treeitems[aRow].fullPath)
            if (aProp) {
                aProp.AppendElement(this.atomSrv.getAtom("currentView"));
            } else {
                return "currentView";
            }
        }
      }

      if(this.treeitems[aRow].isDirty &&
         ko.extensions.ko_intel.prefs.highlightUnsaved)
      {
        if (aProp) {
            aProp.AppendElement(this.atomSrv.getAtom("isDirty"));
        } else {
            return "isDirty";
        }
      }
      return "";
    },

    hasNextSibling : function(aRow, aAfterIndex)
    {
      return ((aRow+1)<this.rowCount);
    },

    cycleHeader : function(aCol) {},

    isSorted : function() {
      return (ko_intelTreesortHelper.mDirection != 0) ? true : false;
    },

    // Other (mainly unused) methods
    getParentIndex : function(aRow) { return -1; },
    getLevel : function(aRow) { return 0; },
    getColumnProperties : function(aCol, aProp) { return; },
    getRowProperties : function(aRow, aProp) { return; },
    isContainer : function(aRow) { return false; },
    isContainerOpen : function(aRow) { return false; },
    isContainerEmpty : function(aRow) { return; },
    canDrop : function(aRow, aOrientation) { return true; },
    drop : function(aRow, aOrientation) {},
    toggleOpenState : function(aRow) {},
    selectionChanged : function() {},
    cycleCell : function(aRow, aCol) {},
    isEditable : function(aRow, aCol) { return false; },
    setCellText : function(aRow, aCol, aValue) {},
    setCellValue : function(aRow, aCol, aValue) {},
    performAction : function(aAction) {},
    performActionOnRow : function(aAction, aRow) {},
    preformActionOnCell : function(aAction, aRow, aCol) {},
    isSeparator : function(aRow) { return false; }

  }; // End of ko_intelTreeviewPrototype()


  // ========================================================================
  // Main methods for ko_intel


  /**
   * Fired when ko_intel is loading
   *
   */
  this.onLoad = function()
  {
    try {
      // We have default values for all values so user doesn't
      // need to go to the Preferences dialog and set up them firstly.
      ko.extensions.ko_intel.prefs.checkPrefs();

      // Update ko_intel's UI
      this.update();
      this.updateClipboard();

      // Append event observers
      observerSvc.addObserver(this, "open_file", false);
      observerSvc.addObserver(this, "open-url", false);
      observerSvc.addObserver(this, "SciMoz:FileDrop", false);
      observerSvc.addObserver(this, "file_changed", false);

      window.addEventListener('current_view_changed', this.update, false);
      window.addEventListener('view_closed', this.update, false);
      window.addEventListener('view_opened', this.update, false);

      // Append preferences observer
      prefSrv.QueryInterface(Components.interfaces.nsIPrefBranch2);
      prefSrv.addObserver("", this, false);

      ko.extensions.ko_intel.completionTimer = new ko.objectTimer(
        ko.extensions.ko_intel, ko.extensions.ko_intel.onTimer, []);
      // XXX
      ko.extensions.ko_intel.completionTimer.startInterval(
                                    ko.extensions.ko_intel.prefs.completionSpeed);

      //why is this needed???
      ko.extensions.ko_intel.clipboardHistory = new ko_intelFixedSizeStack(
                                    ko.extensions.ko_intel.prefs.clipboardItems);
      ko.extensions.ko_intel.clipboardHistoryCounter = 0;
      ko.extensions.ko_intel.lastClipboardHistoryText = '';

      ko.extensions.ko_intel.clipboardTimer = new ko.objectTimer(
        ko.extensions.ko_intel, ko.extensions.ko_intel.onClipboardTimer, []);
      // XXX
      ko.extensions.ko_intel.clipboardTimer.startInterval(250);

    } catch(e) {
      log.exception(e);
    }
  }; // end onLoad()


  /**
   * Correctly unload ko_intel (events obervers). Fired when Komodo is going to
   * be closed.
   */
  this.shutdown = function()
  {
    try {
      if (ko.extensions.ko_intel.completionTimer) {
        ko.extensions.ko_intel.completionTimer.stopInterval();
        ko.extensions.ko_intel.completionTimer.free();
        ko.extensions.ko_intel.completionTimer = null;
      }

      if (ko.extensions.ko_intel.clipboardTimer) {
        ko.extensions.ko_intel.clipboardTimer.stopInterval();
        ko.extensions.ko_intel.clipboardTimer.free();
        ko.extensions.ko_intel.clipboardTimer = null;
      }

      observerSvc.removeObserver(this, "open_file");
      observerSvc.removeObserver(this, "open-url");
      observerSvc.removeObserver(this, "SciMoz:FileDrop");
      observerSvc.removeObserver(this, "file_changed");

      window.removeEventListener('current_view_changed', this.updateEvent, false);
      window.removeEventListener('view_closed', this.updateEvent, false);
      window.removeEventListener('view_opened', this.updateEvent, false);

      prefSrv.QueryInterface(Components.interfaces.nsIPrefBranch2);

      if(prefSrv)
        prefSrv.removeObserver("", this);
    } catch(e) {
      log.exception(e);
    }

    observerSvc = null;
  }; // end shutdown()


  /**
   * Observer implementation. We observe changes in views (opening, closing).
   *
   * @param aSubject {string}
   * @param aTopic {string}
   * @param aData {string}
   */
  this.observe = function(aSubject, aTopic, aData)
  {
    try {
      if (!ko.extensions.ko_intel.prefs.enableko_intel) return;

      switch(aTopic) {
        case "open_file":
        case "SciMoz:FileDrop":
        case "file_changed":
        case "nsPref:changed":
          this.update();
          break;
      }
    } catch(e) {
      log.exception(e);
    }
  }; // end observe()

  ko.extensions.ko_intel.getElement = function(name)
  {
    var tree=null;
    try {
      // cache later
      tree = document.getElementById("ko_intelViewbox").contentDocument.getElementById("ko_intel-left-"+name);
    } catch(e) {
      log.exception(e);
    }
    return tree;
  };

  this.updateEvent = function()
  {
    try {
      if (!ko.extensions.ko_intel.prefs.enableko_intel) return;

      this.update();
    } catch(e) {
      log.exception(e);
    }
  };

  this.indexMaker = function(index)
  {
    try {
      if (index <= 10) {
        return index;
      } else {
        // a11
        // b12
        return String.fromCharCode(index-11+97) + index;
      }
    } catch(e) {
      log.exception(e);
    }
    return index;
  };

  /**
   * Updates ko_intel - user preferences and the tree
   */
  this.update = function()
  {
    try {
      var completiontree = ko.extensions.ko_intel.getElement("completiontree");

      // Enable/disable ko_intel according to user's preferences
      if (ko.extensions.ko_intel.prefs.enableCompletion) {
        completiontree.disabled = false;
        ko.extensions.ko_intel.reloadCompletionTree(
            null, ko.extensions.ko_intel.prefs.completionIgnoreCase, false);
      } else {
        // When ko_intel is disabled we need to ensure that table is empty
        completiontree.view = new ko_intelTreeviewPrototype([]);
        completiontree.disabled = true;
      }

    } catch(e) {
      log.exception(e);
    }
  }; // end update()

  this.updateClipboard = function()
  {
    try {
      var clipboardtree = ko.extensions.ko_intel.getElement("clipboardtree");

      // Enable/disable ko_intel according to user's preferences
      if (ko.extensions.ko_intel.prefs.enableClipboard) {
        clipboardtree.disabled = false;
        ko.extensions.ko_intel.reloadClipboardTree();
      } else {
        // When ko_intel is disabled we need to ensure that table is empty
        clipboardtree.view = new ko_intelTreeviewPrototype([]);
        clipboardtree.disabled = true;
      }

    } catch(e) {
      log.exception(e);
    }
  }; // end updateClipboard()

  this.onHotkeyCaseInsensitiveLookUp = function() {
      try {
        this.reloadCompletionTree(
            null, !ko.extensions.ko_intel.prefs.completionIgnoreCase, true);
      } catch (e) {
          log.exception(e);
      }
  };

  this.reloadCompletionTree = function(currentPos, completionIgnoreCase, force)
  {
    try {
        if (!ko.extensions.ko_intel.prefs.enableCompletion) return;

        var curpos;
        var tree = ko.extensions.ko_intel.getElement("completiontree");
        if (!currentPos) {
          try {
            curpos = ko.extensions.ko_intel.getCurrentCompletionPos();
          } catch(e) {
            tree.view = new ko_intelTreeviewPrototype([]);
            ko.extensions.ko_intel.completionsShown = '';
            ko.extensions.ko_intel.completionsShownAt = null;
            return;
          }
        } else {
          curpos = currentPos;
        }
        if ((ko.extensions.ko_intel.completionsShown != curpos) || force) {
          var words  = ko.extensions.ko_intel.getCompletion(
                          completionIgnoreCase, curpos);
          //log.warn("reloadCompletionTree "+curpos);
          tree.view  = new ko_intelTreeviewPrototype(words);

          timeSvc = Components.classes["@activestate.com/koTime;1"].
              getService(Components.interfaces.koITime);
          var curTime = timeSvc.time();

          ko.extensions.ko_intel.completionsShown = curpos;
          ko.extensions.ko_intel.completionsShownAt = curTime;
        }
    } catch(e) {
      log.exception(e);
    }
  }; // end reloadCompletionTree(aPrefix)

  this.reloadClipboardTree = function()
  {
    try {
        if (!ko.extensions.ko_intel.prefs.enableClipboard) return;

        var parts  = new Array();
        var index = 1;
        for (var i in ko.extensions.ko_intel.clipboardHistory.items) {
            var text = ko.extensions.ko_intel.clipboardHistory.items[i].text;
            var current = ko.extensions.ko_intel.clipboardHistory.items[i].current;
            parts.push(new ko_intelTreeitemPrototype(index,
                                              this.trim(text),
                                              text,
                                              '',
                                              false,
                                              i, // stash in index
                                              current));
            index++;
        }

        if (!KO_INTEL_CLIPBOARD_HISTORY_LRU) {
            parts.reverse();
            index = 1;
            for (var i in parts) {
                parts[i].index = this.indexMaker(index);
                index ++;
            }
        }

        //var prefix = ko.extensions.ko_intel.prefs.displayWhere;
        //var tree   = document.getElementById("ko_intel-" + prefix + "-clipboardtree");
        var tree   = ko.extensions.ko_intel.getElement("clipboardtree");

        tree.view  = new ko_intelTreeviewPrototype(parts);
    } catch(e) {
      log.exception(e);
      dump(e);
    }
  }; // end reloadClipboardTree(aPrefix)

  this.trim = function(str) {
    return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
  };

  this.onTimer = function()
  {
    try {
        if (!ko.extensions.ko_intel.prefs.enableCompletion) return;

        var curpos;
        try {
          curpos = ko.extensions.ko_intel.getCurrentCompletionPos();
        } catch(e) {
          ko.extensions.ko_intel.lastCompletionPos = '';
          ko.extensions.ko_intel.reloadCompletionTree(
                null, ko.extensions.ko_intel.prefs.completionIgnoreCase, true);

          log.warn('onTimer getCurrentCompletionPos failed');
          return;
        }

        if (ko.extensions.ko_intel.lastCompletionPos != curpos) {
          //if position changed since last fire
          ko.extensions.ko_intel.reloadCompletionTree(
            curpos, ko.extensions.ko_intel.prefs.completionIgnoreCase, false);
        }

        ko.extensions.ko_intel.lastCompletionPos = curpos;
    } catch(e) {
      log.exception(e);
    }
  }; // end onTimer(aPrefix)

  this.hasClipboardHistory = function(text)
  {
    try {
        if (ko.extensions.ko_intel.clipboardHistory.length) {
            for (var i in ko.extensions.ko_intel.clipboardHistory.items) {
                if (ko.extensions.ko_intel.clipboardHistory.items[i].text == text) {
                    return true;
                }
            }
        }
    } catch(e) {
      log.exception(e);
    }
    return false;
  };

  this.incrementUsageCount = function(text)
  {
    try {
        for (var i in ko.extensions.ko_intel.clipboardHistory.items) {
            if (ko.extensions.ko_intel.clipboardHistory.items[i].text == text) {
                ko.extensions.ko_intel.clipboardHistory.items[i].usageCount += 1;
                ko.extensions.ko_intel.clipboardHistory.items[i].current = true;
            } else {
              ko.extensions.ko_intel.clipboardHistory.items[i].current = false;
            }
        }

        ko.extensions.ko_intel.reloadClipboardTree();
    } catch(e) {
      log.exception(e);
    }
  };

  this.addToClipboardHistory = function(text)
  {
    try {
        var found = this.hasClipboardHistory(text);

        if (found) {
            this.incrementUsageCount(text);
        } else {
            var hst = ko.extensions.ko_intel.clipboardHistory;
            var leastCount = 99999;
            for (var i in hst.items) {
                hst.items[i].current = false;
                if (hst.items[i].usageCount < leastCount) {
                    leastCount = hst.items[i].usageCount;
                }
            }

            ko.extensions.ko_intel.clipboardHistoryCounter += 1;
            item = new ko_intelClipboardItemPrototype(
                text, 0, ko.extensions.ko_intel.clipboardHistoryCounter, true);

            if (KO_INTEL_CLIPBOARD_HISTORY_LRU) {
                if (hst.length < hst.maxItems) {
                    // just push
                    hst.push(item);
                } else {
                    // find a LRU item to replace
                    var leastIdx = ko.extensions.ko_intel.clipboardHistoryCounter;
                    for (var i in hst.items) {
                        if (hst.items[i].usageCount == leastCount) {
                            if (hst.items[i].addIndex < leastIdx) {
                                leastIdx = hst.items[i].addIndex;
                            }
                        }
                    }
                    if (leastIdx == ko.extensions.ko_intel.clipboardHistoryCounter) {
                        //alert("just push");
                        // huhh, not found, just push
                        hst.push(item);
                    } else {
                        // replace
                        //alert("replace "+leastIdx);
                        for (var i in hst.items) {
                            if (hst.items[i].addIndex == leastIdx) {
                                //alert("replacing "+i);
                                hst.items[i] = item;
                            }
                        }
                    }
                }
            } else {
                hst.push(item);
            }
            this.reloadClipboardTree();
        }
    } catch(e) {
      log.exception(e);
    }
  };

  this.onClipboardTimer = function()
  {
    try {
        if (!ko.extensions.ko_intel.prefs.enableClipboard) return;

        timeSvc = Components.classes["@activestate.com/koTime;1"].
            getService(Components.interfaces.koITime);

        var startTime = timeSvc.time();

        var clipTxt = null;
        try {
            clipTxt = xtk.clipboard.getText();
            // don't store brutally long entries
            if (clipTxt.length > 40960) {
                clipTxt = null;
            }
        } catch (e) {
            clipTxt = null;
        }

        if (clipTxt) {
            if (ko.extensions.ko_intel.lastClipboardHistoryText != clipTxt) {
                if (!this.hasClipboardHistory(clipTxt)) {
                    this.addToClipboardHistory(clipTxt);
                }
                ko.extensions.ko_intel.lastClipboardHistoryText = clipTxt;
            }
        }

        var duration = timeSvc.time() - startTime;
        var maxTime = (ko.extensions.ko_intel.prefs.completionSpeed / 1000)/2;
        if (duration > maxTime) {
          var msg = "onClipboardTimer in "+duration;
          log.warn(msg);
        }

    } catch(e) {
      log.exception(e);
    }
  }; // end onClipboardTimer(aPrefix)


  /**
   * Returns currently selected view in tree of active ko_intel's sidebar
   */
  this.getCurrentlySelectedCompletion = function()
  {
    try {
      var tree   = ko.extensions.ko_intel.getElement("completiontree");
      var label  = tree.view.getCellValue(tree.currentIndex,
                                          tree.columns.getPrimaryColumn());

      return label;
    } catch(e) {
      log.exception(e);
    }

    return null;
  }; // end getCurrentlySelectedCompletion()

  /**
   * Fired when user doubleclicked on any tree item (completiontree)
   */
  this.onCompletionTreeDblClick = function()
  {
    try {
      if (!ko.extensions.ko_intel.prefs.enableko_intel) return;

      var newword = this.getCurrentlySelectedCompletion();
      if (!newword) return;

      var sm = ko.views.manager.currentView.scimoz;

      sm.beginUndoAction();

      var word = ko.extensions.ko_intel.completionWord;
      sm.anchor = sm.currentPos - word.length;
      sm.replaceSel('');
      sm.replaceSel(newword);

      ko.extensions.ko_intel.lastInsertedWord = newword;
      ko.extensions.ko_intel.addToClipboardHistory(newword);
      var txtbox   = ko.extensions.ko_intel.getElement("last_inserted");
      txtbox.value = newword;

      sm.endUndoAction();

      sm.scrollCaret();

    } catch(e) {
      log.exception(e);
    }
  }; // end onCompletionTreeDblClick()

  /**
   * Returns currently selected view in tree of active ko_intel's sidebar
   */
  this.getCurrentlySelectedClipboard = function()
  {
    try {
      var tree   = ko.extensions.ko_intel.getElement("clipboardtree");
      var label  = tree.view.getCellValue(tree.currentIndex,
                                          tree.columns.getPrimaryColumn());

      return label;
    } catch(e) {
      log.exception(e);
    }

    return null;
  }; // end getCurrentlySelectedClipboard()

  this.onClipboardTreeDblClick = function()
  {
    try {
      var newword = this.getCurrentlySelectedClipboard();
      if (!newword) return;

      var sm = ko.views.manager.currentView.scimoz;

      sm.beginUndoAction();
      sm.replaceSel(newword);
      sm.endUndoAction();
      sm.scrollCaret();

      ko.extensions.ko_intel.incrementUsageCount(newword);

    } catch (e) {
        log.exception(e);
    }
  };

  this.getCurrentCompletionPos = function(aEvent)
  {
    var cv = ko.views.manager.currentView;
    var curinsert = cv.scimoz.currentPos;
    var curdoc = cv.koDoc.displayPath;

    var pos = curdoc+"#"+curinsert;
    return pos;
  };

  this.onHotkeyInsertCurrentHistoryItem = function(index) {
    try {
        var hst = ko.extensions.ko_intel.clipboardHistory;
        var current = null;
        for (var i in hst.items) {
            if (hst.items[i].current) {
                current = hst.items[i].text;
            }
        }

        if (current) {
            var sm = ko.views.manager.currentView.scimoz;

            sm.beginUndoAction();

            sm.replaceSel(current);

            sm.endUndoAction();

            sm.scrollCaret();
        }
    } catch (e) {
        log.exception(e);
    }
  }; // end onHotkeyInsertCurrentHistoryItem

  this.onHotkeyInsertIntelli = function(index) {
    try {
        var tree   = ko.extensions.ko_intel.getElement("completiontree");

        if (index == 99 && ko.extensions.ko_intel.lastInsertedWord) {
            var sm = ko.views.manager.currentView.scimoz;

            sm.beginUndoAction();

            sm.replaceSel(ko.extensions.ko_intel.lastInsertedWord);

            sm.endUndoAction();

            sm.scrollCaret();
        } else {
            tree.currentIndex = index-1;
            ko.extensions.ko_intel.onCompletionTreeDblClick(null);
        }
    } catch (e) {
        log.exception(e);
    }
  }; // end onHotkeyInsertIntelli


  this.onHotkeyInsertClipboard = function(index) {
    try {
        var tree   = ko.extensions.ko_intel.getElement("clipboardtree");

        tree.currentIndex = index-1;
        ko.extensions.ko_intel.onClipboardTreeDblClick(null);
    } catch (e) {
        log.exception(e);
    }
  }; // end onHotkeyInsertClipboard


  /**
   * Implements other ko_intel commands. All commands are related
   * to active ko_intel's sidebar (left or right doesn't matter)
   *
   * @param aCmd {String}
   */
  this.doCommand = function(aCmd)
  {
    switch(aCmd)
    {
      // Show ko_intel's Preferences dialog
      case "showPrefs":
        var dlg = window.open("chrome://ko_intel/content/preferences.xul", "",
            "chrome,extrachrome,titlebar,toolbar,modal,centerscreen");
        if(dlg) dlg.focus();
        break;
    }
  }; // end doCommand(aCmd)

}).apply(ko.extensions.ko_intel);

// ===========================================================================

// Initialize it once Komodo has finished loading
// XXX: Use an observer or notification mechanism.
window.addEventListener("load",
                 function(event){setTimeout("ko.extensions.ko_intel.onLoad()", 3000);},
                 false);
window.addEventListener("unload",
                        function(event) { ko.extensions.ko_intel.shutdown(); }, false);
