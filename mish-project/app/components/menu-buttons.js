/* eslint-disable no-console */
/* eslint ember/avoid-leaking-state-in-ember-objects: "off" */
// (cannot use ember-context-menu with the 'leaking-state' rule)
import Component from '@ember/component'
import EmberObject from '@ember/object';
import { Promise } from 'rsvp';
import $ from 'jquery';
import { later } from '@ember/runloop';
//import Ember from 'ember';
import { htmlSafe } from '@ember/string';
import { task } from 'ember-concurrency';
import contextMenuMixin from 'ember-context-menu';
export default Component.extend (contextMenuMixin, {

  // PERFORM TASKS, reachable from the HTML template page
  /////////////////////////////////////////////////////////////////////////////////////////

  rstBrdrs: task (function* () {
    if ($ (".jstreeAlbumSelect").is (":visible")) {
      // Close this if visible:
      $ (".jstreeAlbumSelect").hide ();
    } else {
      resetBorders ();
    }
    yield null; // required
  }),

  requestDirs: task (function* () {

    let imdbroot = this.get ("imdbRoot");
    document.title = "Mish — " + imdbroot;
    if (imdbroot === "") {
      let rootList = yield reqRoot (); // Request possible directories ((1))

      if (rootList) {
        rootList = rootList.split ("\n");
        let seltxt = rootList [0];
        rootList.splice (0, 1, "");
        let selix = rootList.indexOf (seltxt);
        if (selix > 0) {
          this.set ("imdbRoot", seltxt);
          $ ("#imdbRoot").text (seltxt);
          imdbroot = seltxt;
        }
        this.set ("imdbRoots", rootList);
        rootList = rootList.join ("\n");
        $ ("#imdbRoots").text (rootList);
      }

      if (imdbroot === "") {
        // Prepare to select imdbRoot
        $ ("div.settings div.check").hide ();
        //$ ("#rootSel").prop ('selectedIndex', selix);
        return;
      }
    }
    document.title = "Mish — " + imdbroot;

    if (this.get ("albumData").length === 0) {
      yield reqDirs (imdbroot); // Request all subdirectories recursively ((2))
    }
    this.set ("userDir", $ ("#userDir").text ());
    this.set ("imdbRoot", $ ("#imdbRoot").text ());
    //this.set ("imdbDir", $ ("#imdbDir").text ());
    this.set ("imdbDirs", $ ("#imdbDirs").text ().split ("\n"));

    if (this.get ("albumData").length === 0) {
      // Construct dirList|treePath for jstree data = albumData
      let treePath = this.get ("imdbDirs");
      let imdbLink = this.get ("imdbLink");
      for (var i=0; i<treePath.length; i++) {
        if (i === 0) {treePath [i] = imdbLink;} else {
          treePath [i] = imdbLink + treePath [i].toString ();
        }
        /*let branch = treePath [i].split ("/");
        if (branch [0] === "") {branch.splice (0, 1);}
        //console.log (branch);*/
      }
      let albDat = aData (treePath);
      // Substitute the first name (in '{text:"..."') into the root name:
      albDat = albDat.split (","); // else too long a string (??)
      albDat [0] = albDat [0].replace (/{text:".*"/, '{text:"' + this.get ("imdbRoot") + '"');
      albDat = albDat.join (",");
      let count = $ ("#imdbCoco").html ().split ("\n");
      for (let i=0; i<count.length; i++) {
        albDat = albDat.replace (/{text:"([^" ]*)"/, "{text:€$1<small>" + count[i] + "</small>\"");
      }
      albDat = albDat.replace (/€/g, '"');
      this.set ("albumData", eval (albDat));
      if (tempStore) {
        //alert ('75 tempStore true');
        later ( ( () => {
          //$ (".ember-view.jstree").jstree ("open_all");
          $ (".ember-view.jstree").jstree ("_open_to", "#j1_" + tempStore);
          $ (".ember-view.jstree").jstree ("select_node", $ ("#j1_" + tempStore));
          tempStore = "";
        }), 400);
      } else {
        //alert ('83 tempStore false');
        this.set ("albumText", "");
        this.set ("albumName", "");
      }
      albumWait = false;
    }

  }),

  // CONTEXT MENU Context menu
  /////////////////////////////////////////////////////////////////////////////////////////
  contextItems: [
    { label: "×", disabled: true }, // Spacer
    { label: 'Information',
      disabled: false,
      action () {
        var picName = $ ("#picName").text ();
        var picOrig = $ ("#picOrig").text ();
        var title = "Information";
        var yes = "Ok";
        getFilestat (picOrig).then (result => {
          $ ("#temporary").text (result);
        }).then ( () => {
            var txt = '<i>Namn</i>: <span style="color:deeppink">' + picName + '</span><br>';
            txt += $ ("#temporary").text ();
            var tmp = $ ("#download").attr ("href");
            if (tmp.toString () != "null") {
              txt += '<br><span class="lastDownload"><i>Senast startad nedladdning</i>:<br>' + tmp + "</span>";
            }
            infoDia (null, picName, title, txt, yes, false);
            $ ("#temporary").text ("");
        });
      }
    },
    { label: 'Redigera text...',
      /*disabled: () => {
        return !(allow.textEdit || allow.adminAll);
      },*/
      disabled: false,
      action: () => {
        // Mimic click on the text of the mini-picture (thumbnail)
        $ ("#i" + escapeDots ($ ("#picName").text ().trim ()) + " a").next ().next ().next ().click ();
      }
    },
    { label: 'Redigera bild...', // i18n
      disabled: () => {
        return !(allow.imgEdit || allow.adminAll);
      },
      // to be completed ...
      action () {
        var title = "Information";
        var text = "<br>”Redigera bild...” är fortfarande<br>UNDER UTVECKLING"; // i18n
        var yes = "Ok" // i18n
        infoDia (null, null, title, text, yes, true);
        return;
      }
    },
    { label: 'Göm eller visa', // Toggle hide/show
      disabled: () => {
        return !(allow.imgHidden || allow.adminAll);
      },
      action () {
        var picName, act, nels, nelstxt, picNames = [], nodelem = [], nodelem0, i;
        later ( ( () => { // Picname needs time to settle...
          picName = $ ("#picName").text ().trim ();
        }), 50);
        picName = $ ("#picName").text ().trim ();
        picNames [0] = picName;
        nodelem0 = document.getElementById ("i" + picName).firstElementChild.nextElementSibling;
        nels = 1;
        var picMarked = nodelem0.className === "markTrue";
        if (picMarked) {
          picNames = [];
          nodelem = document.getElementsByClassName ("markTrue");
          nels = nodelem.length;
          nelstxt = "alla " + nels;
          if (nels === 2) {nelstxt = "båda två";}
          for (i=0; i<nodelem.length; i++) {
            picNames.push (nodelem [i].nextElementSibling.innerHTML.trim ());
          }
        }
        //console.log (nodelem0.parentNode.style.backgroundColor); // Check representation!
        if (nodelem0.parentNode.style.backgroundColor === $ ("#hideColor").text ())
          {act = 0;} else {act = 1;} // 0 = show, 1 = hide (it's the hide flag!)
        var actxt1 = ["Vill du visa ", "Vill du gömma "];
        var actxt2 = ["ska visas ", "ska gömmas "];
        if (nels > 1) {
          resetBorders (); // Reset all borders
          markBorders (picName); // Mark this one
          $ ("#dialog").html ("<b>" + actxt1 [act] + nelstxt + "?</b><br>" + cosp (picNames) + "<br>" + actxt2 [act]); // Set dialog text content
          $ ("#dialog").dialog ( { // Initiate dialog
            title: "Göm eller visa...",
            autoOpen: false,
            draggable: true,
            modal: true,
            closeOnEscape: true
          });
          // Define button array
          $ ("#dialog").dialog ('option', 'buttons', [
          {
            text: "Ja", // Yes
            "id": "allButt", // Process all
            click: function () {
              hideFunc (picNames, nels, act);
              $ (this).dialog ('close');
            }
          },
          {
            text: "", // Set later, in order to include html tags (illegal here)
            "id": "singButt", // Process only one
            click: function () {
              var nodelem = [];       // Redefined since:
              nodelem [0] = nodelem0; // Else illegal, displays "read-only"!
              picNames [0] = picName;
              nels = 1;
              hideFunc (picNames, nels, act);
              $ (this).dialog ('close');
            }
          }]);
          $ ("#singButt").html ('Nej, bara <span  style="color:deeppink">' + picName + '</span>'); // 'text:', here we may include html tags
          niceDialogOpen ();
          $ ("#allButt").focus ();
        } else {
          hideFunc (picNames, nels, act);
        }
      }
    },
    { label: "|", disabled: true }, // Spacer
    { label: 'Markera/avmarkera alla',
      disabled: false,
      action () {
        var picName = $ ("#picName").text ().trim ();
        var tmp = document.getElementById ("i" + picName).firstElementChild.nextElementSibling.className;
        var marked;
        $ ("[alt='MARKER']").removeClass ();
        $ ("#markShow").removeClass ();
        if (tmp === "markTrue") {
          $ ("[alt='MARKER']").addClass ("markFalse");
          $ ("#markShow").addClass ("markFalseShow");
          marked = "0";
        } else {
          $ ("[alt='MARKER']").addClass ("markTrue");
          $ ("#markShow").addClass ("markTrueShow");
          marked = $ ("[alt='MARKER']").length;
        }
        $ (".numMarked").text (marked);
        resetBorders (); // Reset all borders
      }
    },
    { label: 'Markera bara gömda',
      disabled: () => {
        return false;
      },
      action () {
        let hico = $("#hideColor").text ();
        let tmp = document.getElementsByClassName ("img_mini");
        for (let i=0; i<tmp.length; i++) {
          tmp [i].querySelector ("div[alt='MARKER']").setAttribute ("class", "markFalse") ;
          if (tmp [i].style.backgroundColor === hico) {
            tmp [i].querySelector ("div[alt='MARKER']").setAttribute ("class", "markTrue") ;
          }
        }
        $ ('.showCount .numMarked').text ($ (".markTrue").length + " ");
      }
    },
    { label: 'Invertera markeringar',
      disabled: false,
      action () {
        $ (".markTrue").addClass ("set_false");
        $ (".markFalse").addClass ("set_true");
        $ (".set_false").removeClass ("markTrue");
        $ (".set_true").removeClass ("markFalse");
        $ (".set_false").addClass ("markFalse");
        $ (".set_true").addClass ("markTrue");
        $ (".markTrue").removeClass ("set_true");
        $ (".markFalse").removeClass ("set_false");
        var marked = $ (".markTrue").length;
        $ (".numMarked").text (" " + marked);
        var cn = document.getElementById ("markShow").className;
        $ ("#markShow").removeClass ();
        if (cn === "markFalseShow") {
          $ ("#markShow").addClass ("markTrueShow");
        } else {
          $ ("#markShow").addClass ("markFalseShow");
        }
        resetBorders (); // Reset all borders
      }
    },
    { label: 'Placera först',
      disabled: () => {
        return !((allow.imgReorder && allow.saveChanges) || allow.adminAll);
      },
      action () {
        var picName;
        picName = $ ("#picName").text ();
        var sortOrder = $ ("#sortOrder").text ();
        var rex = new RegExp (picName + ",[\\d,]+\\n?", "");
        var k = sortOrder.search (rex);
        if (k < 1) {return;}
        var line = sortOrder.match (rex) [0];
        sortOrder = sortOrder.replace (line, "");
        sortOrder = sortOrder.replace (/\\n\\n/g, "\n");
        sortOrder = line.trim () + "\n" + sortOrder.trim ();
        $ ("#sortOrder").text (sortOrder);
        saveOrderFunction (sortOrder) // Save on server disk
        .then ($ ("#refresh-1").click ()); // Call via DOM...
        later ( ( () => {
          scrollTo (null, $ (".showCount:first").offset ().top);
        }), 50);
      }
    },
    { label: 'Placera sist',
      disabled: () => {
        return !((allow.imgReorder && allow.saveChanges) || allow.adminAll);
        //return !((allow.imgReorder && allow.saveChanges && $ ("#saveOrder").css ("display") !== "none") || allow.adminAll);
      },
      action () {
        var picName;
        picName = $ ("#picName").text ();
        var sortOrder = $ ("#sortOrder").text ();
        var rex = new RegExp (picName + ",[\\d,]+\\n?", "");
        var k = sortOrder.search (rex);
        if (k < 0) {return;}
        var line = sortOrder.match (rex) [0];
        sortOrder = sortOrder.replace (line, "");
        sortOrder = sortOrder.replace (/\\n\\n/g, "\n");
        sortOrder = sortOrder.trim () + "\n" + line.trim ();
        $ ("#sortOrder").text (sortOrder);
        saveOrderFunction (sortOrder) // Save on server disk
        .then ($ ("#refresh-1").click ()); // Call via DOM...
        later ( ( () => {
          scrollTo (null, $ ("#lowDown").offset ().top - window.screen.height*0.85);
        }), 50);
      }
    },
    { label: "|", disabled: true }, // Spacer
    { label: 'Ladda ned...',
      disabled: () => {
        return !(["admin", "editall", "edit"].indexOf (loginStatus) > -1 && (allow.imgOriginal || allow.adminAll));
        /*let dis = true; THIS way is too slow for copy protection!!
        let picName = $ ("#picName").text ();
        if (!picName.startsWith ("Vbm") && !picName.startsWith ("CPR") && ["admin", "editall", "edit"].indexOf (loginStatus) > -1 && ((allow.imgOriginal || allow.adminAll) && window.screen.width > 500 && window.screen.height > 500)) {dis = false;}
        return dis;*/
      },
      action () {
        $ ("#downLoad").click (); // Call via DOM since "this" is ...where?
      }
    },
    //{ label: ' ', disabled: true }, // Spacer
    { label: 'Länka till...', // i18n
      disabled: () => {
        return !(allow.delcreLink || allow.adminAll);
      },
      action () {
        var picName, nels, nlns, nelstxt, linktxt, picNames = [], nodelem = [], nodelem0, i;
        let symlinkClicked;
        picName = $ ("#picName").text ().trim ();
        later ( ( () => { // Picname needs time to settle...
          picName = $ ("#picName").text ().trim ();
        }), 50);
        resetBorders (); // Reset all borders
        if (!$ ("#i" + escapeDots (picName)).hasClass ("symlink")) { // Leave out symlinks
          markBorders (picName);
          picNames [0] = picName;
          nels = 1;
          symlinkClicked = false;
        } else {
          symlinkClicked = true;
          nels = 0;
          $ ("#picName").text (""); // Signals non-linkable, see "downHere"
        }
        nodelem0 = document.getElementById ("i" + picName).firstElementChild.nextElementSibling;
        var picMarked = nodelem0.className === "markTrue";
        if (picMarked) {
          picNames = [];
          nodelem = document.getElementsByClassName ("markTrue");
          for (i=0; i<nodelem.length; i++) {
            var tmpName = nodelem [i].nextElementSibling.innerHTML.trim ();
            if (!$ ("#i" + escapeDots (tmpName)).hasClass ("symlink")) { // Leave out symlinks
              picNames.push (tmpName);
            }
          }
          nels = picNames.length;
          nlns = nodelem.length - nels;
          linktxt = "";
          if (nlns > 0) {linktxt = "En är redan länk, övriga:<br>";} // i18n
          if (nlns > 1) {linktxt = nlns + " är länkar och kan inte användas; övriga:<br>";} // i18n
          nelstxt = "Vill du länka alla " + nels; // i18n
          if (nels === 2) {nelstxt = "Vill du länka båda två";} // i18n
          //console.log("nodelems non-symlinks:", nodelem.length, nels);
        }
        if (nels === 0) {
          var title = "Ingenting att länka"; // i18n
          var text = "<br><b>Omöjligt att länka länkar!</b>"; // i18n
          var yes = "Uppfattat" // i18n
          infoDia (null, null, title, text, yes, true);
          return;
        }
        //console.log (nodelem0.parentNode.style.backgroundColor); // <- Checks this text content
        $ ("#picNames").text (picNames.join ("\n"));
        if (nels > 1) {
          var lnTxt = "<br>ska länkas till visning också i annat album"; // i18n
          $ ("#dialog").html (linktxt + "<b>" + nelstxt + "?</b><br>" + cosp (picNames) + lnTxt); // Set dialog text content
          $ ("#dialog").dialog ( { // Initiate dialog
            title: "Länka till... ", // i18n
            autoOpen: false,
            draggable: true,
            modal: true,
            closeOnEscape: true
          });
          // Define button array
          $ ("#dialog").dialog ('option', 'buttons', [
          {
            text: "Ja", // Yes i18n
            "id": "allButt", // Process all
            click: function () {
              $ (this).dialog ('close');
              linkFunc (picNames);
              spinnerWait (false);
            }
          },
          {
            text: "", // Set later, in order to include html tags (illegal here)
            "id": "singButt", // Process only one
            click: function () {
              if (picName === "") {
                $ (this).dialog ('close');
              } else {
                var nodelem = [];       // Redefined since:
                nodelem [0] = nodelem0; // Else illegal, displays "read-only"!
                picNames = [];
                picNames [0] = picName;
                nels = 1;
                $ ("#picNames").text (picNames.join ("\n"));
                $ (this).dialog ('close');
                linkFunc (picNames);
                spinnerWait (false);
              }
            }
          }]);
          if (symlinkClicked) {
            picName = "";
            $ ("#singButt").html ("Nej");
          } else {
            $ ("#singButt").html ('Nej, bara <span  style="color:deeppink">' + picName + '</span>'); // 'text:', here we may include html tags
          }
          niceDialogOpen ();
          $ ("#singButt").removeClass ("ui-button-disabled ui-state-disabled");
          if ($ ("#picName").text () === "") { // "downHere", referenced above
            $ ("#singButt").addClass ("ui-button-disabled ui-state-disabled");
          }
          $ ("#allButt").focus ();
        } else {
          $ (this).dialog ('close');
          markBorders (picNames [0]); // Mark this single one, even if it wasn't clicked
          linkFunc (picNames);
          niceDialogOpen ();
          spinnerWait (false);
        }
      }
    },
    { label: 'Flytta till...', // i18n
      disabled: () => {
        return !(allow.deleteImg || allow.adminAll);
      },
      action () {
        var picName, nels, nlns, nelstxt, movetxt, picNames = [], nodelem = [], nodelem0, i;
        let symlinkClicked;
        picName = $ ("#picName").text ().trim ();
        later ( ( () => { // Picname needs time to settle...
          picName = $ ("#picName").text ().trim ();
        }), 50);
        resetBorders (); // Reset all borders
        if (!$ ("#i" + escapeDots (picName)).hasClass ("symlink")) { // Leave out symlinks
          markBorders (picName);
          picNames [0] = picName;
          nels = 1;
          symlinkClicked = false;
        } else {
          symlinkClicked = true;
          nels = 0;
          $ ("#picName").text (""); // Signals non-movable, see "downHere"
        }
        nodelem0 = document.getElementById ("i" + picName).firstElementChild.nextElementSibling;
        var picMarked = nodelem0.className === "markTrue";
        if (picMarked) {
          picNames = [];
          nodelem = document.getElementsByClassName ("markTrue");
          for (i=0; i<nodelem.length; i++) {
            var tmpName = nodelem [i].nextElementSibling.innerHTML.trim ();
            if (!$ ("#i" + escapeDots (tmpName)).hasClass ("symlink")) { // Leave out symlinks
              picNames.push (tmpName);
            }
          }
          nels = picNames.length;
          nlns = nodelem.length - nels;
          movetxt = "";
          if (nlns > 0) {movetxt = "En är länk och kan inte flyttas; övriga:<br>";} // i18n
          if (nlns > 1) {movetxt = nlns + " är länkar som inte kan flyttas; övriga:<br>";} // i18n
          nelstxt = "Vill du flytta alla " + nels; // i18n
          if (nels === 2) {nelstxt = "Vill du flytta båda två";} // i18n
          //console.log("nodelems non-symlinks:", nodelem.length, nels);
        }
        if (nels === 0) {
          var title = "Ingenting att flytta"; // i18n
          var text = "<br><b>Omöjligt att flytta länkar!</b>"; // i18n
          var yes = "Uppfattat" // i18n
          infoDia (null, null, title, text, yes, true);
          return;
        }
        //console.log (nodelem0.parentNode.style.backgroundColor); // <- Checks this text content
        $ ("#picNames").text (picNames.join ("\n"));
        if (nels > 1) {
          var mvTxt = "<br>ska flyttas till annat album"; // i18n
          $ ("#dialog").html (movetxt + "<b>" + nelstxt + "?</b><br>" + cosp (picNames) + mvTxt); // Set dialog text content
          $ ("#dialog").dialog ( { // Initiate dialog
            title: "Flytta till... ", // i18n
            autoOpen: false,
            draggable: true,
            modal: true,
            closeOnEscape: true
          });
          // Define button array
          $ ("#dialog").dialog ('option', 'buttons', [
          {
            text: "Ja", // Yes i18n
            "id": "allButt", // Process all
            click: function () {
              $ (this).dialog ('close');
              moveFunc (picNames);
              /*later ( ( () => {
                $ ("#reLd").click ();
                spinnerWait (false);
              }), 1600);*/
            }
          },
          {
            text: "", // Set later, in order to include html tags (illegal here)
            "id": "singButt", // Process only one
            click: function () {
              if (picName === "") {
                $ (this).dialog ('close');
              } else {
                var nodelem = [];       // Redefined since:
                nodelem [0] = nodelem0; // Else illegal, displays "read-only"!
                picNames = [];
                picNames [0] = picName;
                nels = 1;
                $ ("#picNames").text (picNames.join ("\n"));
                $ (this).dialog ('close');
                moveFunc (picNames);
                /*later ( ( () => {
                  $ ("#reLd").click ();
                  spinnerWait (false);
                }), 1600);*/
              }
            }
          }]);
          if (symlinkClicked) {
            picName = "";
            $ ("#singButt").html ("Nej");
          } else {
            $ ("#singButt").html ('Nej, bara <span  style="color:deeppink">' + picName + '</span>'); // 'text:', here we may include html tags
          }
          niceDialogOpen ();
          $ ("#singButt").removeClass ("ui-button-disabled ui-state-disabled");
          if ($ ("#picName").text () === "") { // "downHere", referenced above
            $ ("#singButt").addClass ("ui-button-disabled ui-state-disabled");
          }
          $ ("#allButt").focus ();
        } else {
          $ (this).dialog ('close');
          markBorders (picNames [0]); // Mark this single one, even if it wasn't clicked
          moveFunc (picNames);
          niceDialogOpen ();
          /*later ( ( () => {
            $ ("#reLd").click ();
            spinnerWait (false);
          }), 1600);*/
        }
      }
    },
    { label: 'RADERA...',
      disabled: () => {
        return !(allow.delcreLink || allow.deleteImg || allow.adminAll);
      },
      action () {
        var picName, all, nels, nelstxt, delNames,
          picNames = [], nodelem = [], nodelem0, linked, i;
        picName = $ ("#picName").text ().trim ();

        // A symlink clicked:
        var title = "Otillåtet"; // i18n
        var text = "<br>— du får bara radera länkar —"; // i18n
        var yes = "Uppfattat" // i18n
        let symlink = document.getElementById ("i" + picName).classList.contains ('symlink');
        if (!symlink && !allow.deleteImg) {
          infoDia (null, null, title, text, yes, true);
          return;
        }

        picNames [0] = picName;
        nodelem0 = document.getElementById ("i" + picName).firstElementChild.nextElementSibling;
        nels = 1;
        var picMarked = nodelem0.className === "markTrue";
        if (picMarked) {
          picNames = [];
          nodelem = document.getElementsByClassName ("markTrue");
          linked = $ (".symlink .markTrue").length;
          all = "alla ";
          nels = nodelem.length;
          nelstxt = nels; // To be used as text...
          if (nels === 2) {all = "båda "; nelstxt = "två";}
          for (i=0; i<nodelem.length; i++) {
            picNames.push (nodelem [i].nextElementSibling.innerHTML.trim ());
          }
        }
        delNames = picName;
        if (nels > 1) {

          // Not only symlinks are included:
          if (nels > linked && !allow.deleteImg) {
            infoDia (null, null, title, text, yes, true);
            return;
          }

          delNames =  cosp (picNames);
          nelstxt = "<b>Vill du radera " + all + nelstxt + "?</b><br>" + delNames + "<br>ska raderas permanent";
          if (linked) {
            nelstxt += " *<br><span style='color:green;font-size:85%'>* då <span style='color:green;text-decoration:underline'>länk</span> raderas berörs inte originalet</span>";
          }
          $ ("#dialog").html (nelstxt); // i18n
          var eraseText = $ ("#imdbDir").text ().replace (/^(.+[/])+/, "") + ": Radera...";
          // Set dialog text content
          $ ("#dialog").dialog ( { // Initiate dialog
            title: eraseText,
            autoOpen: false,
            draggable: true,
            modal: true,
            closeOnEscape: true
          });
          // Close button
          $ ("#dialog").dialog ('option', 'buttons', [ // Define button array
          {
            text: "Ja", // Yes
            "id": "allButt", // Process all
            click: function () {
              $ (this).dialog ('close');
              nextStep (nels);
            }
          },
          {
            text: "", // Set later, (html tags are killed here)
            "id": "singButt", // Process only one
            click: function () {
              var nodelem = [];       // Redefined since:
              nodelem [0] = nodelem0; // Else illegal, displays "read-only"!
              picNames [0] = picName;
              delNames = picName;
              nels = 1;
              $ (this).dialog ('close');
              nextStep (nels);
            }
          }]);
          resetBorders (); // Reset all borders
          markBorders (picName); // Mark this one
          $ ("#singButt").html ('Nej, bara <span  style="color:deeppink">' + picName + '</span>'); // May contain html
          niceDialogOpen ();
          $ ("#allButt").focus ();
        } else {nextStep (nels);}

        function nextStep (nels) {
          var eraseText = "Radera i " + $ ("#imdbDir").text ().replace (/^(.+[/])+/, "") + ":"; // i18n
          resetBorders (); // Reset all borders, can be first step!
          markBorders (picName); // Mark this one
          if (nels === 1) {
            linked = $ ("#i" + escapeDots (picName)).hasClass ("symlink");
          }
          nelstxt = "<b>Vänligen bekräfta:</b><br>" + delNames + "<br>i <b>" + $ ("#imdbDir").text ().replace (/^(.+[/])+/, "") + "<br>ska alltså raderas?</b><br>(<i>kan inte ångras</i>)"; // i18n
          if (linked) {
            nelstxt += "<br><span style='color:green;font-size:85%'>Då <span style='color:green;text-decoration:underline'>länk</span> raderas berörs inte originalet</span>"; // i18n
          }
          $ ("#dialog").html (nelstxt);
          $ ("#dialog").dialog ( { // Initiate a new, confirmation dialog
            title: eraseText,
            closeText: "×",
            autoOpen: false,
            draggable: true,
            modal: true,
            closeOnEscape: true
          });
          $ ("#dialog").dialog ('option', 'buttons', [ // Define button array
          {
            text: "Ja", // Yes
            "id": "yesBut",
            click: function () {
              /*if (!(allow.deleteImg || allow.adminAll)) { // Will never happen
                userLog ("RADERING FÖRHINDRAD"); // i18n
                return;
              }*/
              console.log ("To be deleted: " + delNames); // delNames is picNames as a string
              // NOTE: Must be a 'clean' call (no then or <await>):
              deleteFiles (picNames, nels);
              $ (this).dialog ('close');
              later ( ( () => {
                userLog ($ ("#temporary").text ());
                $ ("#temporary").text ("");
              }), 1000);
              scrollTo (null, $ ("#highUp").offset ().top);
              $ ("#refresh-1").click ();
            }
          },
          {
            text: "Nej", // No
            "id": "noBut",
            click: function () {
              console.log ("Untouched: " + delNames);
              $ (this).dialog ('close');
            }
          }]);
          niceDialogOpen ();
          $ ("#yesBut").focus ();
        }
      }
    },
    { label: "×", disabled: true }, // Spacer
  ],
  //contextSelection: [{ paramDum: false }],  // The context menu "selection" parameter (not used)
  contextSelection: () => {return {}},
  _contextMenu (e) {
//    document.addEventListener ('click', (evnt) => {triggerClick (evnt);}, false);
//    document.removeEventListener ('mouseup', (e) => {triggerClick (evnt);}, false);
    later ( ( () => {
      // At text edit (ediText) || running slide show
      if ( ($ ("div[aria-describedby='textareas']").css ("display") !== "none") ||
          ($ ("#navAuto").text () === "true") ) {
        $ ("ul.context-menu").hide ();
        return;
      }
      $ ("ul.context-menu").hide ();
      var nodelem = e.target;
      if (nodelem.tagName === 'IMG' && nodelem.className.indexOf ('left-click') > -1 || nodelem.parentElement.id === 'link_show') {
        // Set the target image path. If the show-image is clicked the target is likely an
        // invisible navigation link, thus reset to parent.firstchild (= no-op for mini-images):
        $ ("#picOrig").text (nodelem.parentElement.firstElementChild.title.trim ());
        // Set the target image name, which is in the second parent sibling in both cases:
        var namepic = nodelem.parentElement.nextElementSibling.nextElementSibling.innerHTML.trim ();
        $ ("#picName").text (namepic);

        // Ascertain that the minipic is shown (maybe created just now)
        var toshow = document.getElementById ("i" + namepic).firstElementChild.firstElementChild;
        var minipic = toshow.getAttribute ("src");
        toshow.removeAttribute ("src");
        toshow.setAttribute ("src", minipic);
        //var docLen = document.body.scrollHeight; // <- NOTE: this is the document Ypx height
        //var docWid = document.body.scrollWidth; // <- NOTE: this is the document Xpx width
        // var scrollY = window.pageYOffset; // <- NOTE: the Ypx document coord of the viewport

        $ ("#wormhole-context-menu").css ("position", "absolute"); // Change from fixed

        $ ("div.context-menu-container").css ("position", "relative"); // Change from fixed
        var viewTop = window.pageYOffset; // The viewport position
        var tmpTop = e.clientY;           // The mouse position
        $ ("div.context-menu-container").css ("top", (viewTop + tmpTop) + "px");

        $ ("ul.context-menu").css ("left", "-2px");
        $ ("ul.context-menu").css ("right", "");
        $ ("ul.context-menu.context-menu--left").css ("left", "");
        $ ("ul.context-menu.context-menu--left").css ("right", "2px");
        $ ("ul.context-menu").show ();

      } else {
        $ ("ul.context-menu").hide ();
        $ ("#picName").text ('');
        $ ("#picOrig").text ('');
      }
    }), 7); // was 20
  },

  // STORAGE FOR THE HTML page population, and other storages
  /////////////////////////////////////////////////////////////////////////////////////////
  allNames: () => {return []}, // ##### File names etc. (object array) for the thumbnail list generation
  timer: null,  // The timer for auto slide show
  savekey: -1,  // The last pressed keycode used to lock Ctrl+A etc.
  userDir:  "undefined", // Current server user directory
  imdbLink: "imdb", // Name of the symbolic link to the imdb root directory
  imdbRoot: "", // The imdb directory (initial default = env.variable $IMDB_ROOT)
  imdbRoots: () => {return []}, // For imdbRoot selection
  //imdbDir: "",  // Current picture directory, selected from imdbDirs
  imdbDirs: () => {return ['Album?']}, // Reset in requestDirs
  albumName: "",
  albumText: "",
  albumData: () => {return []}, // Directory structure for the selected imdbRoot
  loggedIn: false,
  subaList: () => {return []},
  // HOOKS, that is, Ember "hooks" in the execution cycle
  /////////////////////////////////////////////////////////////////////////////////////////
  //----------------------------------------------------------------------------------------------
  init () { // ##### Component initiation
    this._super (...arguments);
    $ (document).ready ( () => {
      later ( ( () => {
        console.log ("jQuery v" + $ ().jquery);
        // The time stamp is produced with the Bash 'ember-b-script'
        userLog ($ ("#timeStamp").text (), true);
        // Login advice:
        $ ("#title span.proid").attr ("title", "Most is safe here!");
        $ ("#title button.cred").attr ("title", logAdv);
        // Initialize settings:
        $ ("#picFound").text ("Funna_bilder"); // i18n
        zeroSet ();
        this.actions.setAllow ();
        this.actions.setAllow (true);
        $ ("#title form button.viewSettings").hide ();
        // To top of screen:
        later ( ( () => {
          scrollTo (0, 0);
          $ ("#title button.cred").focus ();
          later ( ( () => {
            $ (".cred.user").attr ("value", "gäst"); // i18n
            $ (".cred.login").click ();
            later ( ( () => {
              $ (".cred.login").click ();
              $ (".cred.user").click (); // Prevents FF showing link to saved passwords
              $ (".cred.login").focus ();
            }), 100);
          }), 100);
        }), 177);
      }), 10);
    });
  },
  //----------------------------------------------------------------------------------------------
  didInsertElement () { // ##### Runs at page ready state
    this._super (...arguments);

    this.setNavKeys ();
    // Search does find also hidden images, thus must be allowed:
    if (allow.imgHidden || allow.adminAll) {
      $ ("button.findText").show ()
    } else {
      $ ("button.findText").hide ()
    }
    // Update the slide show speed factor when it is changed
    //document.querySelector ('input.showTime[type="number"]').addEventListener ('change', function () {$ ("#showFactor").text (parseInt (this.value));});
    later ( ( () => {
      prepDialog ();
      prepTextEditDialog ();
      prepSearchDialog ();
    }), 10);
    execute ("head -n1 LICENSE.txt").then (a => {
      $ (".copyright").text (a);
    });
  },
  //----------------------------------------------------------------------------------------------
  didRender () {
    this._super (...arguments);
    $ (document).ready ( () => {

      devSpec ();

      if ($ ("#hideFlag").text () === "1") {
        this.actions.hideFlagged (true).then (null);
      } else {
        this.actions.hideFlagged (false).then (null);
      }

      later ( ( () => {
        // Update the slide show speed factor when it is changed
        document.querySelector ('input.showTime[type="number"]').addEventListener ('change', function () {$ ("#showFactor").text (parseInt (this.value));});

        $ ("span#showSpeed").hide ();
        $ ("div.ember-view.jstree").attr ("onclick", "return false");

        $ (".img_mini.symlink [alt='MARKER']").attr("title", "Markera, eller med högerklick: Gå till källan");
      }), 10);
    });
  },

  // HELP FUNCTIONS, that is, component methods (within-component functions)
  /////////////////////////////////////////////////////////////////////////////////////////
  //----------------------------------------------------------------------------------------------
  refreshAll () {
    // ===== Updates allNames and the sortOrder tables by locating all images and
    // their metadata in the "imdbDir" dir (name is DOM saved) on the server disk.
    // This will trigger the template to restore the DOM elements. Prepare the didRender hook
    // to further restore all details!
    return new Promise (resolve => {
      var test = 'A1';
      this.requestOrder ().then (sortnames => {
        if (sortnames === undefined) {sortnames = "";}
        if (sortnames === "Error!") {
          spinnerWait (false);
          $ (".jstreeAlbumSelect").show ();
          if ($ ("#imdbDir").text () !== "") {
            document.getElementById ("imdbError").className = "show-inline";
          }
          $ ('.showCount').hide ();
          //this.set ("imdbDir", "");
          $ ("#imdbDir").text ("");
          $ ("#sortOrder").text ("");
          $ ('#navKeys').text ('true');
        } else {
          $ ('.showCount:last').hide ();
          $ ("#sortOrder").text (sortnames); // Save in the DOM
        }
        test = 'A2';
        // Use sortOrder (as far as possible) to reorder namedata ERROR
        // First pick out namedata (allNames) against sortnames (SN), then any remaining
        this.requestNames ().then (namedata => {
          var i = 0, k = 0;
          // --- START prepare sortnames checking CSV columns
          var SN = [];
          if ($ ("#sortOrder").text ().trim ().length > 0) {
            SN = $ ("#sortOrder").text ().trim ().split ('\n');
          }
          //console.log("NOTE: SN is the latest saved list of images, not nesseceraly reflecting the actual directory content (must have been saved to do that):",SN);
          sortnames = '';
          for (i=0; i<SN.length; i++) {
            var tmp = SN [i].split (",");
            if (tmp [0].slice (0, 1) !== ".") {
              if (tmp.length < 2) {
                tmp.push (" ");
                SN [i] = SN [i] + ",";
              }
              if (tmp [1].trim ().length === 0) {SN [i] = SN [i] + '0';}
              if (tmp.length < 3) {
                tmp.push (" ");
                SN [i] = SN [i] + ",";
              }
              if (tmp [2].trim ().length === 0) {SN [i] = SN [i] + '0';}
              sortnames = sortnames +'\n'+ SN [i];
            }
          }
          test = 'A3';
          sortnames = sortnames.trim (); // Important!
          if (sortnames === "") {
            var snamsvec = [];
          } else {
            snamsvec = sortnames.split ('\n'); // sortnames vectorized
          }
          // --- Pull out the plain sort order file names: snams <=> sortnames
          var snams = [];
          // snamsvec is sortnames vectorized
          for (i=0; i<snamsvec.length; i++) {
            // snams is kind of 'sortnames.name'
            snams.push (snamsvec [i].split (",") [0]);
          }
          //console.log(test,"[sortnames]",sortnames,snamsvec.length);
          // --- END prepare sortnames
          // --- Pull out the plain dir list file names: name <=> namedata (undefined order)
          if (namedata === undefined) {namedata = [];}
          var name = [];
          for (i=0; i<namedata.length; i++) {
            name.push (namedata [i].name);
          }
          test ='B';
          // --- Make the object vector 'newdata' for new 'namedata=allNames' content
          // --- Use 'snams' order to pick from 'namedata' into 'newdata' and 'newsort'
          // --- 'namedata' and 'name': Ordered as from disk (like unknown)
          var newsort = "", newdata = [];
          while (snams.length > 0 && name.length > 0) {
            k = name.indexOf (snams [0]);
            if (k > -1) {
              newsort = newsort + snamsvec [0] + "\n";
              newdata.pushObject (namedata [k]);
              namedata.removeAt (k, 1);
              name.splice (k, 1);
            }
            snamsvec.splice (0, 1);
            snams.splice (0, 1);
          }
          test ='C';
          // --- Move remaining 'namedata' objects (e.g. uploads) into 'newdata' until empty.
          // --- Place them first to get better noticed. Update newsort for sortnames.
          // --- The names, of such (added) 'namedata' objects, are kept remaining in 'name'??
          while (namedata.length > 0) {
            newsort = namedata [0].name + ",0,0\n" + newsort;
            //newdata.pushObject (namedata [0]); instead:
            newdata.insertAt (0, namedata [0]);
            namedata.removeAt (0, 1);
          }
          newsort = newsort.trim (); // Important
          test ='E0';
          this.set ("allNames", newdata); // The minipics reload is triggered here (RELOAD)
          $ ('#sortOrder').text (newsort); // Save in the DOM
          //console.log("NOTE: newsort is the true list of images in the actual directory:",newsort.split("\n"));
          //console.log("NOTE: newdata will trigger the thumbnails reload:",this.get ("allNames"));
          preloadShowImg = []; // Preload show images:
          var n = newdata.length;
          let nWarn = 100;
          for (i=0; i<n; i++) {
            preloadShowImg [i] = new Image();
            preloadShowImg [i].src = newdata [i].show;
          }
          if ((n > nWarn) && (allow.imgUpload || allow.adminAll)) {
            infoDia (null, null, "M Ä N G D V A R N I N G", "<b>Ett album bör av alla möjliga <br>praktiska och tekniska skäl inte ha <br>särskilt många fler än etthundra bilder. <br>Försök att dela på det här albumet ...</b>", "... uppfattat!", true);
          }
          if (n > 0) {
            $ (".numMarked").text (" " + $ (".markTrue").length);
            if ($ ("#hideFlag") === "1") {
              $ (".numHidden").text (" " + $ (".img_mini [backgroundColor=$('#hideColor')]").length);
              // DOES THIS WORK OR MAY IT BE REMOVED??
              $ (".numShown").text (" " + $ (".img_mini [backgroundColor!=$('#hideColor')]").length);
            } else {
              $ (".numHidden").text ("0");
              $ (".numShown").text ($ (".img_mini").length);
            }
            userLog ("RELOAD");
          }
          test = 'E1';
          later ( ( () => {
            if ($ ("#hideNames").text () === "1") {
              $ (".img_name").hide ();
            } else {
              $ (".img_name").show ();
            }
          }), 20);
          later ( ( () => {
            $ ("#saveOrder").click ();
          }), 200);
        }).catch (error => {
          console.error (test + ' in function refreshAll: ' + error.message);
        });
      }).catch ( () => {
        console.log ("Not found");
      });
      $ ('#navKeys').text ('true');
      if ($ ("#imdbDir").text () !== "") {
        this.actions.imageList (true);
      }
      resolve ();
    });
  },
  //----------------------------------------------------------------------------------------------
  setNavKeys () { // ===== Trigger actions.showNext when key < or > is pressed etc...

    var triggerClick = (evnt) => {
      var that = this;
//console.log("evnt",evnt);
      var tgt = evnt.target;
      let tgtClass = "";
      if (tgt) {
//console.log("tgt.classList",tgt.classList);
        tgtClass = tgt.classList [0] || "";
      }
      if (-1 < tgtClass.indexOf ("context-menu") || tgtClass === "spinner") {
        return;
      }
      if (tgt.id === "wrap_pad") {
        that.actions.hideShow ();
        return;
      }
      if (tgt.tagName !=="IMG") {return;}
      if ($ (tgt).hasClass ("mark")) {
        if ((allow.imgHidden || allow.adminAll) && evnt.button === 2) {
          // Right click on the marker area of a thumbnail...
          let classes = $ (tgt).parent ("div").parent ("div").attr("class");
          let albumDir, file, tmp;
          if (classes && -1 < classes.split (" ").indexOf ("symlink")) { // ...of a symlink...
            tmp = $ (tgt).parent ("div").parent ("div").find ("img").attr("title");
            // ...then go to the linked picture:
            getFilestat (tmp).then (result => {
              //console.log ("Länk:", tmp);
              result = result.replace (/(<br>)+/g, "\n");
              result = result.replace(/<(?:.|\n)*?>/gm, ""); // Remove <tags>
              //console.log (result.split ("\n") [1]);
              file = result.split ("\n") [1].replace (/^[^/]*\/(\.\.\/)*/, $ ("#imdbLink").text () + "/");
              albumDir = file.replace (/^[^/]+(.*)\/[^/]+$/, "$1").trim ();
              let idx = $ ("#imdbDirs").text ().split ("\n").indexOf (albumDir);
              if (idx < 0) {
                infoDia (null, null, "Tyvärr ...", "<br>Albumet <b>" + albumDir.replace (/^(.*\/)+/, "") + "</b> kan inte visas!", "Ok", true);
                return;
              }
//console.log ("Album:", albumDir, idx);
              $ (".ember-view.jstree").jstree ("deselect_all");
              $ (".ember-view.jstree").jstree ("open_all");
              $ (".ember-view.jstree").jstree ("select_node", $ ("#j1_" + (1 + idx)));
              $ (".jstreeAlbumSelect").show ();
              let namepic = file.replace (/^(.*\/)*(.+)\.[^.]*$/, "$2");
              later ( ( () => {
                gotoMinipic (namepic);
              }), 500);
            })
          }
        }
        return;
      }
      if (evnt.button === 2) {return;}
      var namepic = tgt.parentElement.parentElement.id.slice (1);

      // Check if the intention is to "mark" (Shift + click):
      if (evnt.shiftKey) {
        later ( ( () => {
          //console.log("NOTE: Click with shift pressed:",namepic);
          that.actions.toggleMark (namepic);
          return;
        }), 20);
      } else {
        var origpic = tgt.title;
        var minipic = tgt.src;
        var showpic = minipic.replace ("/_mini_", "/_show_");
        document.getElementById ("divDropbox").className = "hide-all";
        this.actions.showShow (showpic, namepic, origpic);
        return;
      }
    }
    document.addEventListener ("click", triggerClick, false); // Click (at least left click)
    document.addEventListener ("contextmenu", triggerClick, false); // Right click
    //document.oncontextmenu = (e) => {triggerClick (e); return;}

    // Then the keyboard, actions.showNext etc.:
    var that = this;
    function triggerKeys (event) {
      var Z = false; // Debugging switch
      if (event.keyCode === 112) { // F1 key
        that.actions.toggleHelp ();
      } else
      if (event.keyCode === 27) { // ESC key
        $ (".jstreeAlbumSelect").hide ();
        if ($ ("div.settings").is (":visible")) { // Hide settings
          $ ("div.settings, div.settings div.root, div.settings div.check").hide ();
          return;
        }
        if (document.getElementById ("divDropbox").className !== "hide-all") { // Hide upload
          document.getElementById ("divDropbox").className = "hide-all";
          return;
        }
        if ($ ("#notes").is (":visible")) {
          $ ("#notes").dialog ("close");
        } else
        if ($ ("#dialog").is (":visible")) {
          $ ("#dialog").dialog ("close");
        } else
        if ($ ("div[aria-describedby='textareas']").css ("display") !== "none") { // At text edit, visible
          ediTextClosed ();
          if (Z) {console.log ('*a');}
        } else // Carefylly here: !== "none" is false if the context menu is absent!
        if ($ ("ul.context-menu").css ("display") === "block") { // When context menu EXISTS and is visible
          $ ("ul.context-menu").hide ();
          if (Z) {console.log ('*b');}
        } else
        if ($ ("#link_show a").css ('opacity') > 0 ) { // The navigation help is visible
          $ ("#link_show a").css ('opacity', 0 );
          if (Z) {console.log ('*c');}
        } else
        if ($ (".toggleAuto").text () === "STOP") { // Auto slide show is running
          $ ("#navAuto").text ("false");
          later ( ( () => {
            $ (".nav_links .toggleAuto").text ("AUTO");
            that.runAuto (false);
          }), 100);
          if (Z) {console.log ('*d');}
        } else
        if ($ (".img_show").css ("display") === "block") { // Show image is visible
          that.actions.hideShow ();
          if (Z) {console.log ('*e');}
        } else {
          resetBorders (); // Reset all borders
        }
        if (Z) {console.log ('*f');}
      } else
      if (event.keyCode === 37 && $ ("#navKeys").text () === "true" &&
      $ ("div[aria-describedby='searcharea']").css ("display") === "none" &&
      $ ("div[aria-describedby='textareas']").css ("display") === "none" &&
      !$ ("#title input.cred.user").is (":focus") &&
      !$ ("#title input.cred.password").is (":focus")) { // Left key <
        event.preventDefault(); // Important!
        that.actions.showNext (false);
        if (Z) {console.log ('*g');}
      } else
      if (event.keyCode === 39 && $ ("#navKeys").text () === "true" &&
      $ ("div[aria-describedby='searcharea']").css ("display") === "none" &&
      $ ("div[aria-describedby='textareas']").css ("display") === "none" &&
      !$ ("#title input.cred.user").is (":focus") &&
      !$ ("#title input.cred.password").is (":focus")) { // Right key >
        event.preventDefault(); // Important!
        that.actions.showNext (true);
        if (Z) {console.log ('*h');}
      } else
      if (that.savekey !== 17 && event.keyCode === 65 && $ ("#navAuto").text () !== "true" &&
      $ ("div[aria-describedby='searcharea']").css ("display") === "none" &&
      $ ("div[aria-describedby='textareas']").css ("display") === "none" &&
      !$ ("#title input.cred.user").is (":focus") &&
      !$ ("#title input.cred.password").is (":focus")) { // A key
        if (!($ ("#imdbDir").text () === "")) {
          $ ("#dialog").dialog ("close");
          $ ("#navAuto").text ("true");
          later ( ( () => {
            $ (".nav_links .toggleAuto").text ("STOP");
            that.runAuto (true);
          }), 250);
          if (Z) {console.log ('*i');}
        }
      } else
      if (that.savekey === 17 && event.keyCode === 83) { // Ctrl + S (for saving texts)
        event.preventDefault(); // Important!
        if ($ ("button.saveNotes").is (":visible")) {
          $ ("button.saveNotes").click ();
        } else
        if ($ ("button.saveTexts").is (":visible") && !$ ("button.saveTexts").attr ("disabled")) {
          $ ("button.saveTexts:first").click ();
        }
        that.savekey = event.keyCode;
      } else {
        that.savekey = event.keyCode;
      }
    }
    document.addEventListener ('keydown', triggerKeys, false);
  },
  //----------------------------------------------------------------------------------------------
  runAuto (yes) { // ===== Help function for toggleAuto
    if (Number ($ (".numShown:first").text ()) < 2) {return;}
    if (yes) {
      ediTextClosed ();
      $ ("#showSpeed").show ();
      userLog ('START show');
      //$ ("#showSpeed input").focus (); Fatal for phones!
      var that = this;
      (function sequence () {
        that.actions.showNext (true); // Immediate response
        var showFactor = parseInt ($ ("#showFactor").text ());
        if (showFactor < 1) {showFactor = 0.5;}
        if (showFactor > 99) {showFactor = 99;}
        var txlen = $ ("#wrap_show .img_txt1").text ().length + $ ("#wrap_show .img_txt2").text ().length;
        if (!txlen) {txlen = 0;}
        if (txlen < 100) {txlen = 100;} // 100 char
        if (txlen > 1000) {txlen = 1000;} // 1000 char
        var ms;
        if ($ (".nav_links span a.speedBase").css ('color') === 'rgb(255, 20, 147)') { // deeppink
          ms = 14*txlen;
        } else {
          ms = 1000;
        }
        that.timer = setTimeout (sequence, showFactor*ms);
      } ());
    } else {
      clearTimeout (this.timer);
      $ ("#showSpeed").hide ();
      userLog ('STOP show');
    }
  },
  //----------------------------------------------------------------------------------------------
  requestOrder () { // ===== Request the sort order list
    return new Promise ( (resolve, reject) => {
      var IMDB_DIR =  $ ('#imdbDir').text ();
      if (IMDB_DIR.slice (-1) !== "/") {IMDB_DIR = IMDB_DIR + "/";}
      IMDB_DIR = IMDB_DIR.replace (/\//g, "@"); // For sub-directories
      var that = this;
      var xhr = new XMLHttpRequest ();
      xhr.open ('GET', 'sortlist/' + IMDB_DIR, true, null, null); // URL matches server-side routes.js
      xhr.onload = function () {
        if (this.status >= 200 && this.status < 300) {
          var data = xhr.responseText.trim ();
          if (data.slice (0, 8) === '{"error"') {
            //data = undefined;
            data = "Error!"; // This error text may also be generated elsewhere
          }
          var tmpName = that.get ("albumName");
          tmpName = extractContent (tmpName); // Don't accumulate HTML
          document.title = document.title + " " + removeUnderscore (tmpName, true) + " —";
          tmpName = removeUnderscore (tmpName); // Improve readability
          if (data === "Error!") {
            tmpName += " &mdash; <em style=\"color:red;background:transparent\">just nu oåtkomligt</em>" // i18n
            that.set ("albumName", tmpName);
            //that.set ("imdbDir", "");
            $ ("#imdbDir").text ("");
          } else {
            that.set ("albumText", "&nbsp; Valt album: &nbsp;");
            that.set ("albumName", '<strong class="albumName">' + tmpName + '</strong>');
            $ (".jstreeAlbumSelect p:first a").attr ("title", " Ta bort | gör nytt album ");
          }
          resolve (data); // Return file-name text lines
          console.log ("ORDER received");
        } else {
          resolve ("Error!");
          reject ({
            status: this.status,
            statusText: xhr.statusText
          });
        }
      };
      xhr.onerror = function () {
        resolve ("Error!");
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      };
      xhr.send ();
    }).catch (error => {
      console.error (error.message);
    });
  },
  //----------------------------------------------------------------------------------------------
  requestNames () { // ===== Request the file information list
    // NEPF = number of entries (lines) per file in the plain text-line-result list ('namedata')
    // from the server. The main information ('namedata') is retreived from each image file, e.g.
    // metadata. It is reordered into 'newdata' in 'sortnames' order, as far as possible;
    // 'sortnames' is cleaned from non-existent (removed) files and extended with new (added)
    // files, in order as is. So far, the sort order is 'sortnames' with hideFlag (and albumIndex?)
    var that = this;
    return new Promise ( (resolve, reject) => {
      var IMDB_DIR =  $ ('#imdbDir').text ();
      if (IMDB_DIR.slice (-1) !== "/") {IMDB_DIR = IMDB_DIR + "/";}
      IMDB_DIR = IMDB_DIR.replace (/\//g, "@"); // For sub-directories
      var xhr = new XMLHttpRequest ();
      xhr.open ('GET', 'imagelist/' + IMDB_DIR, true, null, null); // URL matches server-side routes.js
      var allfiles = [];
      xhr.onload = function () {
        if (this.status >= 200 && this.status < 300) {
          var Fobj = EmberObject.extend ({
            orig: '',  // for orig-file path (...jpg|tif|png|...)
            show: '',  // for show-file path (_show_...png)
            mini: '',  // for mini-file path (_mini_...png)
            name: '',  // Orig-file base name without extension
            txt1: 'description', // for metadata
            txt2: 'creator',     // for metadata
            symlink: 'false'           // else 'symlink'
          });
          var NEPF = 7; // Number of properties in Fobj
          var result = xhr.responseText;
          result = result.trim ().split ('\n'); // result is vectorised
          var i = 0, j = 0;
          var n_files = result.length/NEPF;
          if (n_files < 1) { // Covers all weird outcomes
            result = [];
            n_files = 0;
            $ ('.showCount .numShown').text (' 0');
            $ ('.showCount .numHidden').text (' 0');
            $ ('.showCount .numMarked').text ('0');
            $ ("span.ifZero").hide ();
            $ ('#navKeys').text ('false'); // Prevents unintended use of L/R arrows
          }
          for (i=0; i<n_files; i++) {
            result [j + 4] = result [j + 4].replace (/&lt;br&gt;/g,"<br>");
            var f = Fobj.create ({
              orig: result [j],
              show: result [j + 1],
              mini: result [j + 2],
              name: result [j + 3],
              txt1: htmlSafe (result [j + 4]),
              txt2: htmlSafe (result [j + 5]),
              symlink: result [j + 6],
            });
            if (f.txt1.toString () === "-") {f.txt1 = "";}
            if (f.txt2.toString () === "-") {f.txt2 = "";}
            j = j + NEPF;
            allfiles.pushObject (f);
          }
          later ( ( () => {
            $ (".showCount:first").show ();
            $ (".miniImgs").show ();
            later ( ( () => {
              spinnerWait (false);
              //later ( ( () => {
              that.actions.setAllow (); // Fungerar hyfsat ...?
              //}), 2000);
            }), 2000);
          }), 2000);
          //userLog ('INFO received');
          resolve (allfiles); // Return file-list object array
        } else {
          reject ({
            status: this.status,
            statusText: xhr.statusText
          });
        }
      };
      xhr.onerror = function () {
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      };
      xhr.send ();
    }).catch (error => {
      console.error (error.message);
    });
  },
  //----------------------------------------------------------------------------------------------
  // TEMPLATE ACTIONS, that is, functions reachable from the HTML page
  /////////////////////////////////////////////////////////////////////////////////////////
  actions: {
    //============================================================================================
    subaSelect (subName) { // ##### Sub-album link selected
//console.log("subName",subName,subName.length);
      subName = subName.replace (/&nbsp;/g, "_"); // Restore correct album name!
      let names = $ ("#imdbDirs").text ().split ("\n");
      let name = $ ("#imdbDir").text ().slice (4); // Remove 'imdb'
      //let name = this.get ("imdbDir").slice (4);
//console.log("name",name,name.length);
      //let names = this.get ("imdbDirs");
      let here, idx;
      if (subName === "|«") {
        idx = 0;
      } else if (subName === "«") {
        name = name.replace (/((\/[^/])*)(\/[^/]*$)/, "$1");
        idx = names.indexOf (name);
//console.log("A",idx,name,names);
      } else if (subName === "‹›") {
        idx = savedAlbumIndex;
      } else {
        here = names.indexOf (name);
        idx = names.slice (here + 1).indexOf (name + "/" + subName);
//console.log("B",idx,name,names);
        if (idx < 0) {
          $ (".jstreeAlbumSelect").hide ();
//console.log("C",idx,name,names);
        } else {
          idx = idx + here + 1;
//console.log("D",idx,name,names);
        }
      }
      if (idx < 0) {
//console.log("E",idx,name,names);
        $ (".jstreeAlbumSelect").hide ();
        return;
      } else {
        //$ (".jstreeAlbumSelect").show ();
        //$ (".ember-view.jstree").jstree ("load_all");
        //$ (".ember-view.jstree").jstree ("close_all");
        //$ (".ember-view.jstree").jstree ("close_node", $ ("#j1_" + (1 + idx)));
        //$ (".ember-view.jstree").jstree ("_open_to", $ ("#j1_" + (1 + idx)));
        $ (".ember-view.jstree").jstree ("open_all");
        $ (".ember-view.jstree").jstree ("deselect_all");
        later ( ( () => {
          $ (".ember-view.jstree").jstree ("select_node", $ ("#j1_" + (1 + idx)));
        }), 100);
      }
    },
    //============================================================================================
    setAllow (newSetting) { // ##### Updates settings checkbox menu and check reordering attributes
      allowvalue = $ ("#allowValue").text ();
      var n = allowvalue.length;

      if (newSetting) { // Uppdate allowvalue from checkboxes
        var a = "";
        for (var i=0; i<n; i++) {
          var v = String (1 * $ ('input[name="setAllow"]') [i].checked);
          a += v;
        }
        allowvalue = a;
        $ ("#allowValue").text (allowvalue);
      }

      function code (i, j) {
        if (i) {
          return '<input id="c' + (j + 1) + '" type="checkbox" name="setAllow" checked value=""><label for="c' + (j + 1) + '"></label>';
        } else { // The label tags are to satisfy a CSS:checkbox construct, see app.css
          return '<input id="c' + (j + 1) + '" type="checkbox" name="setAllow" value=""><label for="c' + (j + 1) + '"></label>';
        }
      }
      var allowHtml = [];
      for (var j=0; j<n; j++) {
        allowHtml [j] = "<span>allow." + allowance [j] + " " + (j + 1) + ' </span>' + code (Number (allowvalue [j]), j);
      }
      $ ("#setAllow").html (allowHtml.join ("<br>"));
      allowFunc ();

      if (newSetting) { // Allow only one confirmation per settings-view
        disableSettings ();
        later ( ( () => {
          $ ("div.settings, div.settings div.root, div.settings div.check").hide ();
        }), 500);
      }

      if (allow.imgReorder || allow.adminAll) { // Allow reorder and ...
        $ ("div.show-inline.ember-view").attr ("draggable", "true");
        $ ("div.show-inline.ember-view").attr ("onmousedown", "return true");
      } else { // ... disallow reorder, onmousedown setting is important!
        $ ("div.show-inline.ember-view").attr ("draggable", "false");
        $ ("div.show-inline.ember-view").attr ("onmousedown", "return false");
      }
      $ ("div.settings button.confirm").blur (); // Important in some situations
    },
    //============================================================================================
    albumEdit () { // ##### Erase or create (sub)albums (image folders)

      var imdbDir = $ ("#imdbDir").text ();
      if (imdbDir === "—" || imdbDir === "") {return;}
      if (!(allow.albumEdit || allow.adminAll)) {
        userLog ("ALBUM protected");
        return;
      }
      $ (".img_show").hide ();
      var imdbRoot = $ ("#imdbRoot").text ();
      var album = $ (this.get ("albumName")).text ();
      if (imdbDir.indexOf ("/") < 0) {
        imdbDir = imdbRoot;
      } else {
        imdbDir = imdbDir.replace (/^[^/]*\//, imdbRoot + "/");
      }

      $ ("#temporary").text ("");
      var text = "<br><b>" + album + "</b> ska raderas<br>Nej, ingen fara: UNDER UTVECKLING!";

      // NOTE: Här kollas att albumet är tomt men inte om det har underalbum! OBS!
      var codeAlbum = "'var action=this.value;if (this.selectedIndex === 0) {$ (\"#temporary\").text (\"\");return false;}if (action === \"erase\" && Number ($ (\".showCount:first .numShown\").text ()) === 0 && Number ($ (\".showCount:first .numHidden\").text ()) === 0) {" + "$ (\"#temporary\").text (\"infoDia (null, null,\\\""+ album +"\\\",\\\""+ text +"\\\",\\\"Ok\\\",true)\")" + ";} else {" + "$ (\"#temporary\").text (\"infoDia (null, null,\\\""+ album +"\\\",\\\"<br>UNDER UTVECKLING\\\",\\\"Ok\\\",true)\")" + ";}'";

      var code = '<br><select class="selectOption" onchange=' + codeAlbum + '>'
      code += '\n<option value="">&nbsp;Välj åtgärd för&nbsp;</option>'
      code += '\n<option value="new">&nbsp;Gör ett nytt underalbum till&nbsp;</option>'
      code += '\n<option value="erase">&nbsp;Radera albumet (töm det först)&nbsp;</option>'
      code += '\n</select><br>' + imdbDir + '<br>&nbsp;';
      text = code;

      infoDia (null, null, album, text, 'Ok', true, true);
      later ( ( () => {
        $ ("select.selectOption").focus ();
      }), 50);
    },
    //============================================================================================
    // ##### Check file base names against a server directory & modify command(s), NOTE:
    // checkNames uses 1) the server directory in #temporary and 2) the commands in #temporary_1
    checkNames () {
      later ( ( () => {
        var lpath =  $ ('#temporary').text (); // <- the server dir
        getBaseNames (lpath).then (names => {
          //console.log("checkNames:", names);
          var links = $ ("#picNames").text ().split ("\n"); // <- the names to be checked
          var cmds = $ ('#temporary_1').text ().split ("\n"); // <- corresp. shell commands
          //console.log(cmds.join ("\n"));
          for (var i=0; i<links.length; i++) {
            if (names.indexOf (links [i]) > -1) {
              cmds [i] = cmds [i].replace (/^[^ ]+ [^ ]+ /, "#exists already: ");
              userLog ("NOTE exists");
            }
          }
          //console.log(cmds.join ("\n"));
          $ ('#temporary_1').text (cmds.join ("\n"));
        });
      }), 100);
    },
    //============================================================================================
    hideSpinner () { // ##### The spinner may be clicked away if it renamains for some reason

      spinnerWait (false);
      userLog ("STOP spin");
    },
    //============================================================================================
    speedBase () { // ##### Toogle between seconds/textline and seconds/picture

      // Deppink triggers seconds/textline
      var colorText = $ (".nav_links span a.speedBase").css ('color');
      //console.log (colorText);
      if ( colorText !== 'rgb(255, 20, 147)') { // not deeppink but gray or hoover-color
        $ (".nav_links span a.speedBase").css ('color', 'deeppink'); // 'rgb(255, 20, 147)'
      } else {
        $ (".nav_links span a.speedBase").css ('color', 'gray'); // 'rgb(128, 128, 128)'
      }
    },
    //============================================================================================
    selectRoot (that, value) { // ##### Select initial album root dir (imdb) from dropdown

// NOTE: Is always value = "" !!!???
      //let that = this;
      $ ("#toggleTree").attr ("title", "Välj album");
      // Close all dialogs/windows
      ediTextClosed ();
      //$ ("div.settings, div.settings div.root, div.settings div.check").hide ();
      $ (".img_show").hide ();
      document.getElementById ("imageList").className = "hide-all";
      document.getElementById ("divDropbox").className = "hide-all";
      if (value === "") {
        $ ("div.settings div.check").hide ();
      }
      $ (".ember-view.jstree").jstree ("load_all");
      later ( ( () => {
        //that.set ("imdbDir", "");
        $ ("#imdbDir").text ("");
        albumWait = true;
        $ ("#requestDirs").click (); // perform ...
        later ( ( () => {
          $ (".ember-view.jstree").jstree ("open_node", $ ("#j1_1"));
          $ (".ember-view.jstree").jstree ("select_node", $ ("#j1_1"));
          var imdbroot = $ ("#imdbRoot").text ();
          if (imdbroot !== "" && initFlag) {
            userLog ("#START " + imdbroot);
            initFlag = false;
            $ ("#toggleTree").click ();
            // Clear out the search result album
            let lpath = "imdb/" + $ ("#picFound").text ();
            // The following commands must come in sequence (the picFound album is regenerated)
            execute ("rm -rf " +lpath+ " && mkdir " +lpath+ " && touch " +lpath+ "/.imdb").then ();
          }
        }), 222);
      }), 222);
    },
    //============================================================================================
    selectAlbum () {

//console.log(this.get ("imdbDirs"));
      let that = this;
      let value = $ ("[aria-selected='true'] a.jstree-clicked");
      if (value && value.length > 0) {
        value = value.attr ("title").toString ();
      } else {
        value =  "";
      }
      if (albumWait) {
        document.getElementById ("imageList").className = "hide-all";
        return;
      }
      ediTextClosed ();
      $ ("div.ember-view.jstree").attr ("onclick", "return false");
      $ ("ul.jstree-container-ul.jstree-children").attr ("onclick", "return false");
      new Promise ( (resolve) => {
        $ ("a.jstree-anchor").blur (); // Important?
        if (value !== $ ("#imdbDir").text ()) {
          // save the index of the preceeding album
          savedAlbumIndex = $ ("#imdbDirs").text ().split ("\n").indexOf ($ ("#imdbDir").text ().slice (4));
          $ ("#backImg").text ("");
          $ ("#picName").text ("");
          $ ("#picOrig").text ("");
          $ ("#sortOrder").text ("");
          $ (".showCount").hide ();
          $ (".miniImgs").hide ();
        }
//console.log("1>>>>>>>>>>\n",value);
        let imdbDir = value;
        $ ("#imdbDir").text (value);
        let selDir = value.slice (4);
        let selDirs = $ ("#imdbDirs").text ().split ("\n");
        let tmp = [""]; // at root
        if (selDir) {tmp = ["|«", "«", "‹›"];}
        let i0 = selDirs.indexOf (selDir);
//console.log("selDir",selDir,"selDirs",selDirs,"i0",i0);
        for (let i=i0; i<selDirs.length; i++) {
          if (selDir === selDirs [i].slice (0, selDir.length)) {
            let cand = selDirs [i].slice (selDir.length);
            if (cand.indexOf ("/") === 0 && cand.replace (/^(\/[^/]+).*$/, "$1") === cand) {
//console.log("cand",cand);
              if (cand.slice (1) !== $ ("#picFound").text ()) {
                tmp.push (cand.slice (1).replace (/_/g, "&nbsp;"));
//console.log("tmp",tmp);
              }
            }
          }
        }
        if (tmp [0] === "") {
          if (savedAlbumIndex > 0) {
            tmp [0] = "‹›";
          } else {
            tmp = tmp.slice (1); // at root
          }
        }
        that.set ("subaList", tmp); // NOTE: For the album menu rows in *.hbs (a.imDir)
        later ( ( () => {
          let n = $ ("a.imDir").length/2;
          if (tmp [0] === "|«") {
            $ ("a.imDir").each (function (index, element) {
              if (index < 3) {
                $ (element).attr ("title", returnTitles [index]);
              } else if (index - n > -1 && index - n < 3) {
                $ (element).attr ("title", returnTitles [index - n]);
              } else if (index > n) {
                return false;
              }
            });
          } else if (tmp [0] === "‹›") {
            $ ("a.imDir").each (function (index, element) {
              if (index === 0 || index === n) {
                $ (element).attr ("title", returnTitles [index + 2]);
              } else if (index > n) {
                return false;
              }
            });
          }
        }), 50);
//console.log("subaList",tmp);
        let tmp1 = [""];
        if (value) {tmp1 = value.split ("/");}
        if (tmp1 [tmp1.length - 1] === "") {tmp1 = tmp1.slice (0, -1)} // removes trailing /
        tmp1 = tmp1.slice (1); // remove symbolic link name
        if (tmp1.length > 0) {
          that.set ("albumName", tmp1 [tmp1.length - 1]);
        } else {
          that.set ("albumName", that.get ("imdbRoot"));
        }
        $ ("#refresh-1").click ();
        console.log ("Selected: " + imdbDir);
        if (value) {
          $ ("#toggleTree").attr ("title", "Valt album:  " + that.get ("albumName") + "  (" + imdbDir.replace (/imdb/, that.get ("imdbRoot")) + ")"); // /imdb/ == imdbLink
        }
        resolve (true);
        later ( ( () => {
          // Don't hide login (at top) if we have 0/top position!
          // If not, adjust the position, login remains hidden at window top.
          if (0 < window.pageYOffset) {
            scrollTo (null, $ ("#highUp").offset ().top);
          }
        }), 50);
      }).catch (error => {
        console.error (error.message);
      });
    },
    //============================================================================================
    toggleAlbumTree (imdbroot) {

      if ($ ("#imdbRoot").text () !== imdbroot) {
        this.actions.imageList (false); // Hide since source will change
        userLog ("START " + imdbroot);
        $ ("#imdbRoot").text (imdbroot);
        this.set ("imdbRoot", imdbroot);
        this.set ("albumData", []);
        this.set ("albumName", "");
        this.set ("albumText", "");
        $ ("#toggleTree").attr ("title", "Välj album");
      }
      document.getElementById ("divDropbox").className = "hide-all";
      //var that = this;
      $ ("div.settings, div.settings div.root, div.settings div.check").hide ();
      if (!$ (".jstreeAlbumSelect").is (":visible")) {
        // Cannot be shown without imdbRoot set
        if (!imdbroot || imdbroot === "") {
          this.actions.selectRoot (this, "");
          return;
        }
        $ (".jstreeAlbumSelect").show ();
        $ ("#requestDirs").click ();
        // Then wait for requestDirs:
        let albumDir = "", albumDirs = [""], idx = 0;
        later ( ( () => {
          albumDir = $ ("#imdbDir").text ().replace (/^[^/]+/, "");
//console.log("albumDir",albumDir);
          //albumDirs = $ ("#imdbDirs").text ().split ("\n");
//console.log("albumDirs",albumDirs);
          albumDirs = this.get ("imdbDirs");
//console.log("albumDirs",albumDirs);
          idx = albumDirs.indexOf (albumDir);
//console.log("idx",idx);
          //$ (".ember-view.jstree").jstree ("deselect_all");
          $ (".ember-view.jstree").jstree ("load_all");
          //$ (".ember-view.jstree").jstree ("close_all");
          $ (".ember-view.jstree").jstree ("_open_to", $ ("#j1_" + (1 + idx)));
          //$ (".ember-view.jstree").jstree ("open_node", $ ("#j1_" + (1 + idx)));
          if (idx === 0) {
            $ (".ember-view.jstree").jstree ("open_node", $ ("#j1_1"));
          }
        }), 777);
        /*if (albumDir === "") {
          //$ (".ember-view.jstree").jstree ("open_all");
          later ( ( () => {
            $ (".ember-view.jstree").jstree ("open_all");
            $ (".ember-view.jstree").jstree ("deselect_all");
//$ (".ember-view.jstree").jstree ("select_node", $ ("#j1_1"));
            $ (".ember-view.jstree").jstree ("open_node", $ ("#j1_1"));
          }), 200);
        }*/
        // no of pics   let nix = $ ("#imdbCoco").text ().split ("\n") [idx].replace (/^ \(([0-9]+)\).*/, "$1");


        /*if (albumDir !== "") {
          let idx = albumDirs.indexOf (albumDir);
console.log("idx",idx);
          //console.log(idx,nix,"idx nix");
          $ (".ember-view.jstree").jstree ("close_all");
          $ (".ember-view.jstree").jstree ("_open_to", "#j1_" + (1 + idx));
          if (idx === 0) {
            $ (".ember-view.jstree").jstree ("open_all");
            $ (".ember-view.jstree").jstree ("deselect_all");
            $ (".ember-view.jstree").jstree ("select_node", $ ("#j1_" + (1 + idx)));
            later ( ( () => {
              $ (".jstreeAlbumSelect").show ();
            }), 200);
          }
        }
        return;*/
      } else {
        $ (".jstreeAlbumSelect").hide ();
      }
    },
    //============================================================================================
    toggleHideFlagged () { // #####

      if ($ ("#sortOrder").text () === "") {return;}
      if (!(allow.imgHidden || allow.adminAll)) {
        userLog ("HIDDEN protected");
        return;
      }
      return new Promise ( (resolve) => {
        $ ("#link_show a").css ('opacity', 0 );

        if ($ ("#hideFlag").text () === "1") {
          $ ("#hideFlag").text ("0");
          this.actions.hideFlagged (false).then (null); // Show all pics
        } else {
          $ ("#hideFlag").text ("1");
          this.actions.hideFlagged (true).then (null); // Hide the flagged pics
        }
        resolve ("OK");
      }).then (null).catch (error => {
        console.error (error.message);
      });

    },
    //============================================================================================
    hideFlagged (yes) { // #####

     return new Promise ( (resolve) => {

      $ ("#link_show a").css ('opacity', 0 );
      var tmp = $ ('#sortOrder').text ().trim ();
      if (tmp.length < 1) {return;}
      var rows = tmp.split ('\n');
      var n = 0, h = 0;
      for (var i=0; i<rows.length; i++) {
        var str = rows [i].trim ();
        var k = str.indexOf (",");
        var name = str.substring (0, k);
        str = str.slice (k+1);
        k = str.indexOf (",");
        var hideFlag = 1*str.substring (0, k); // Used as 1 = hidden, 0 = shown
        str = str.slice (k+1);
        //var albumIndex = 1*str;
        //var dummy = albumIndex; // Not yet used
        var nodelem = document.getElementById ("i" + name);
        if (nodelem) {
          n = n + 1;
          if (hideFlag) {
            nodelem.style.backgroundColor=$ ("#hideColor").text ();
            if (yes) {
              nodelem.style.display='none';
            }
            h = h + 1;
          } else {
            nodelem.style.backgroundColor='#222';
            if (yes) {
              nodelem.style.display='block-inline';
            }
          }
        }
      }
      if (yes) {
        $ ('.showCount .numShown').text (" " + (n - h));
        $ ('.showCount .numHidden').text (" " + h);
        //$ ('#toggleHide').css ('color', 'lightskyblue');
        $ ('#toggleHide').css ('background-image', 'url(/images/eyes-blue.png)');
      } else {
        $ ('.showCount .numShown').text (" " + n);
        $ ('.showCount .numHidden').text (' 0');
        //$ ('#toggleHide').css ('color', 'white');
        $ ('#toggleHide').css ('background-image', 'url(/images/eyes-white.png)');
        $ (".img_mini").show (); // Show all pics
      }
      $ ('.showCount .numMarked').text ($ (".markTrue").length + " ");

      var lineCount = parseInt ($ (window).width ()/170); // w150 +> w170 each pic
      $ ('.showCount').hide ();
      $ ('.showCount:first').show (); // Show upper
      if (n > 0) {
        $ ("span.ifZero").show ();
        if ( (n - h) > lineCount) {$ ('.showCount').show ();} // Show both
      } else {
        $ ("span.ifZero").hide ();
      }

      resolve ("OK");

     }).catch (error => {
      console.error (error.message);
     });

    },
    //============================================================================================
    showDropbox () { // ##### Display (toggle) the Dropbox file upload area

      if ($ ("#imdbDir").text () === "") {return;}
      $ (".jstreeAlbumSelect").hide ();
      $ ("#link_show a").css ('opacity', 0 );
      if (document.getElementById ("divDropbox").className === "hide-all") {
        document.getElementById ("divDropbox").className = "show-block";
        $ ("div.settings, div.settings div.root, div.settings div.check").hide ();
        this.actions.hideShow ();
        $ ("#dzinfo").html ("VÄLJ FOTOGRAFIER FÖR UPPLADDNING"); // i18n
        scrollTo (null, $ ("#highUp").offset ().top);
        if (allow.imgUpload || allow.adminAll) {
          document.getElementById("uploadPics").disabled = false;
        } else {
          document.getElementById("uploadPics").disabled = true;
          userLog ("UPLOAD prohibited");
        }
      } else {
        document.getElementById ("divDropbox").className = "hide-all";
        document.getElementById("reLd").disabled = false;
        document.getElementById("saveOrder").disabled = false;
        scrollTo (null, $ (".showCount:first").offset ().top);
      }
    },
    //============================================================================================
    imageList (yes) { // ##### Display or hide the thumbnail page

      $ ("#link_show a").css ('opacity', 0 );
      //if (yes || document.getElementById ("imageList").className === "hide-all") {
      if (yes) {
        document.getElementById ("imageList").className = "show-block";
      } else {
        document.getElementById ("imageList").className = "hide-all";
      }
    },
    //============================================================================================
    showShow (showpic, namepic, origpic) { // ##### Render a 'show image' in its <div>

      $ (".jstreeAlbumSelect").hide ();
      $ ("div.settings, div.settings div.root, div.settings div.check").hide ();
      $ ("ul.context-menu").hide ();
      $ ("#" + escapeDots (namepic) + " a img").blur ();
      $ ("#picName").text (namepic);
      resetBorders (); // Reset all borders
      markBorders (namepic); // Mark this one
      $ ("#wrap_show").removeClass ("symlink");
      if ($ ("#i" + escapeDots (namepic)).hasClass ("symlink")) {$ ("#wrap_show").addClass ("symlink");}
       $ ("#full_size").hide (); // button
      if (allow.imgOriginal || allow.adminAll) {$ ("#full_size").show ();}
      $ (".img_show").hide (); // Hide in case a previous is not already hidden
      $ ("#link_show a").css ('opacity', 0 );
      $ (".img_show img:first").attr ('src', showpic);
      $ (".img_show img:first").attr ('title', origpic);
      $ (".img_show .img_name").text (namepic); // Should be plain text
      $ (".img_show .img_txt1").html ($ ('#i' + escapeDots (namepic) + ' .img_txt1').html ());
      $ (".img_show .img_txt2").html ($ ('#i' + escapeDots (namepic) + ' .img_txt2').html ());
      // The mini image 'id' is the 'trimmed file name' prefixed with 'i'
      if (typeof this.set === 'function') { // false if called from showNext
        var savepos = $ ('#i' + escapeDots (namepic)).offset ();
        if (savepos !== undefined) {
          $ ('#backPos').text (savepos.top); // Vertical position of the mini-image
        }
        $ ('#backImg').text (namepic); // The name of the mini-image
      }
      $ ("#wrap_show").css ('background-color', $ ('#i' + escapeDots (namepic)).css ('background-color'));
      $ (".img_show").show ();
      scrollTo (null, $ (".img_show img:first").offset ().top - $ ("#topMargin").text ());
      $ ("#markShow").removeClass ();
      if (document.getElementById ("i" + namepic).firstElementChild.nextElementSibling.className === "markTrue") {
        $ ("#markShow").addClass ("markTrueShow");
      } else {
        $ ("#markShow").addClass ("markFalseShow");
      }
      devSpec (); // Special device settings
      // Prepare texts for ediText dialog if not runAuto
      if ($ ("#navAuto").text () === "false") {
        if ($ ("#textareas").is (":visible")) {
          refreshEditor (namepic, origpic);
        }
        /*if ($ (".img_mini .img_name").css ("display") !== $ (".img_show .img_name").css ("display")) { // Can happen in a few situations
          $ (".img_show .img_name").toggle ();
        }*/
      }
    },
    //============================================================================================
    hideShow () { // ##### Hide the show image element

      hideShow_g ();
    },
    //============================================================================================
    showNext (forwards) { // ##### SHow the next image if forwards is true, else the previous

      $ (".shortMessage").hide ();
      if (Number ($ (".numShown:first").text ()) < 2) {
        $ ("#link_show a").blur ();
        return;
      }


      if ($ ("#navAuto").text () !== "true") {
      //if ($ ("div[aria-describedby='textareas']").css ("display") === "none") {
        $ ("#dialog").dialog ("close");
      }
      $ ("#link_show a").css ('opacity', 0 );

      var namehere = $ (".img_show .img_name").text ();
      var namepic, minipic, origpic;
      var tmp = document.getElementsByClassName ("img_mini");
      namepic = namehere;
      if (forwards) {
        while (namepic === namehere) {
          namepic = null;
          if (!document.getElementById ("i" + namehere) || !document.getElementById ("i" + namehere).parentElement.nextElementSibling) { // last
            namepic = tmp [0].getAttribute ("id").slice (1);
            userLog ("FIRST");
          } else {
            namepic = document.getElementById ("i" + namehere).parentElement.nextElementSibling.firstElementChild.id.slice (1);
          }
          if (document.getElementById ("i" + namepic).style.display === 'none') {
            namehere = namepic;
          }
        }
      } else {
        while (namepic === namehere) {
          namepic = null;
          if (!document.getElementById ("i" + namehere) || !document.getElementById ("i" + namehere).parentElement.previousElementSibling) { // first
            //var tmp = document.getElementsByClassName ("img_mini");
            namepic = tmp [tmp.length - 1].getAttribute ("id").slice (1);
            userLog ("LAST");
          } else {
            namepic = document.getElementById ("i" + namehere).parentElement.previousElementSibling.firstElementChild.id.slice (1);
          }
          if (document.getElementById ("i" + namepic).style.display === 'none') {
            namehere = namepic;
          }
        }
      }

      if (!namepic) {return;} // Maybe malplacé...
      var toshow = document.getElementById ("i" + namepic);
      minipic = toshow.firstElementChild.firstElementChild.getAttribute ("src");
      origpic = toshow.firstElementChild.firstElementChild.getAttribute ("title");

      var showpic = minipic.replace ("/_mini_", "/_show_");
      $ (".img_show").hide (); // Hide to get right savepos
      var savepos = $ ('#i' + escapeDots (namepic)).offset ();
      if (savepos !== undefined) {
        $ ('#backPos').text (savepos.top); // Save position
      }
      $ ('#backImg').text (namepic); // Save name
      if (typeof this.set === "function") { // false if called from didInsertElement.
        this.actions.showShow (showpic, namepic, origpic);
      } else {                              // Arrow-key move, from didInsertElement
        this.showShow (showpic, namepic, origpic);
      }
      $ ("#link_show a").blur (); // If the image was clicked
    },
    //============================================================================================
    toggleAuto () { // ##### Start/stop auto slide show

      if (Number ($ (".numShown:first").text ()) < 2) {return;}

      $ ("#dialog").dialog ("close");
      if ($ ("#imdbDir").text () === "") {return;}
      if ($ ("#navAuto").text () === "false") {
        $ ("#navAuto").text ("true");
        later ( ( () => {
          $ (".nav_links .toggleAuto").text ("STOP");
          this.runAuto (true);
          document.getElementById("reLd").disabled = true;
          document.getElementById("saveOrder").disabled = true;
        }), 500);
      } else {
        $ ("#navAuto").text ("false");
        later ( ( () => {
          $ (".nav_links .toggleAuto").text ("AUTO");
          this.runAuto (false);
          document.getElementById("reLd").disabled = false;
          document.getElementById("saveOrder").disabled = false;
        }), 500);
      }
    },
    //============================================================================================
    refresh (nospin) { // ##### Reload the imageList and update the sort order

      if ($ ("#imdbDir").text () === "") {return;}
      if (!nospin) {
        spinnerWait (true);
      }
      $ ("#link_show a").css ('opacity', 0 );
      $ (".img_show").hide ();
      this.refreshAll ().then ( () => {
        return true;
      });
    },
    //============================================================================================
    saveOrder () { // ##### Save, in imdbDir on server, the ordered name list for the thumbnails on the screen. Note that they may, by user's drag-and-drop, have an unknown sort order (etc.)

      if (!(allow.saveChanges || allow.adminAll) || $ ("#imdbDir").text () === "") {return;}
      $ ("#link_show a").css ('opacity', 0 );

      new Promise (resolve => {
        spinnerWait (true);
        var i =0, k = 0, SName = [], names, SN;
        SN = $ ('#sortOrder').text ().trim ().split ('\n'); // Take it from the DOM storage
        for (i=0; i<SN.length; i++) {
          SName.push (SN[i].split (",") [0]);
        }
        var UName = $ ('#uploadNames').text ().trim (); // Newly uploaded
        $ ('#uploadNames').text (''); // Reset
        var newOrder = '';
        // Get the true ordered name list from the DOM mini-pictures (thumbnails).
        names = $ (".img_mini .img_name").text ();
        names = names.toString ().trim ().replace (/\s+/g, " ");
        names = names.split (" ");
        for (i=0; i<names.length; i++) {
          k = SName.indexOf (names [i]);
          if (k > -1) {
            if (UName.indexOf (names[i]) > -1) {
              SN [k] = SN [k].replace (/,\d*,/, ',0,'); // Reset the hide flag for newly uploaded
            }
            newOrder = newOrder + '\n' + SN [k];
          } else {
            newOrder = newOrder + '\n' + names [i] + ',0,0';
          }
        }
        newOrder = newOrder.trim ();
        //$ ("#sortOrder").text (newOrder);
        later ( ( () => {
          saveOrderFunction (newOrder).then ( () => { // Save on server disk
            document.getElementById ("saveOrder").blur ();
            resetBorders (); // Reset all borders
            spinnerWait (false);
          });
        }), 1500);
        resolve (true);
      }).catch (error => {
        console.error (error.message);
      });
    },
    //============================================================================================
    showOrder () { // ##### For DEBUG: Show the ordered name list in the (debug) log
      // OBSOLETE, REMOVE eventually ...
      $ ("#link_show a").css ('opacity', 0 ); // why ...?
      var tmp = $ ('#sortOrder').text ().trim ();
      if (!tmp) {tmp = '';}
      // sortOrder is a string with a bunch of lines
      console.log (tmp.length +', order:');
      console.log (tmp.trim ());
      document.getElementById ("showOrder").blur ();
    },
    //============================================================================================
    toggleNameView () { // ##### Toggle-view file names

      $ ("#link_show a").css ('opacity', 0 );
      $ (".img_name").toggle ();
      if (document.getElementsByClassName ("img_name") [0].style.display === "none") {
        $ ("#hideNames").text ("1");
      } else {
        $ ("#hideNames").text ("0");
      }
    },
    //============================================================================================
    toggleHelp () { // ##### Toggle-view user manual

      if ($ ("#helpText").is (":visible") || $ ("#navAuto").text () === "true") {
        $ ('#helpText').dialog ("close");
      } else {
        let header = "Användarhandledning<br>(främst för dator med mus och tangentbord)"
        infoDia ("helpText", null, header, $ ("div.helpText").html (), "Stäng", false);
        $ ("#helpText").parent ().css ("top", "0");
        $ (".jstreeAlbumSelect").hide ();
      }
    },
    //============================================================================================
    toggleNav () { // ##### Toggle image navigation-click zones

      if ($ ("#navAuto").text () === "true") {
        var title = "Stanna automatisk visning...";
        var text = ' ... med <span style="color:deeppink;font-family:monospace;font-weight:bold">STOP</span> eller Esc-tangenten och börja visningen igen med <span style="color:deeppink;font-family:monospace;font-weight:bold">AUTO</span> eller A-tangenten!';
        var yes ="Ok";
        var modal = true;
        infoDia (null, null, title, text, yes, modal);
      } else if ($ ("#link_show a").css ('opacity') === '0' ) {
        $ ("#link_show a").css ('opacity', 1 );
      } else {
        $ ("#link_show a").css ('opacity', 0 );
      }
      devSpec ();

    },
    //============================================================================================
    findText () { // ##### Open dialog to search Xmp metadata text in the current imdbRoot

      if (!(allow.imgHidden || allow.adminAll)) {
        userLog ("LOCKED", true);
        return;
      }
      let diaSrch = "div[aria-describedby='searcharea']"
      if ($ (diaSrch).css ("display") !== "none") {
        $ ("#searcharea").dialog ("close");
      } else {
        if ($ ("#imdbRoot").text () === "") {
          userLog ("ALBUM?", true);
          return;
        }
        //$ (".jstreeAlbumSelect").hide ();
        ediTextClosed ();
        $ (diaSrch).show ();
        $ ("#searcharea").dialog ("open");
        $ ("#searcharea div.diaMess div.edWarn").html ("Sökdata...");
        age_imdb_images ();
        let sw = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
        let diaSrchLeft = parseInt ((sw - ediTextSelWidth ())/2) + "px";
        $ (diaSrch).css ("left", diaSrchLeft);
        $ (diaSrch).css ("max-width", sw+"px");
        $ (diaSrch).css ("width", "");
        $ ('textarea[name="searchtext"]').focus ();
        $ ("button.findText").html ("Sök i <b>" + $ ("#imdbRoot").text () + "</b>");
        $ ("button.findText").show ();
        $ ("button.updText").hide ();
        if (allow.albumEdit || allow.adminAll) {
          $ ("button.updText").show ();
          $ ("button.updText").css ("float", "right");
          $ ("button.updText").html ("Uppdatera söktexter");
          $ ("button.updText").attr ("title", "Förnya sökregistrets bildtexter");
        }
      }
    },
    //============================================================================================
    ediText (namepic) { // ##### Edit picture texts

      var displ = $ ("div[aria-describedby='textareas']").css ("display");
      var name0 = $ ("div[aria-describedby='textareas'] span.ui-dialog-title span").html ();
      if (allow.textEdit || allow.adminAll) {
        $ ("button.saveTexts").attr ("disabled", false);
      } else {
        $ ("button.saveTexts").attr ("disabled", true);
      }
      if ($ ("#navAuto").text () === "true") {return;}
      $ ("#link_show a").css ('opacity', 0 );
      $ ('#navKeys').text ('false');
      // In case the name is given, the call originates in a mini-file (thumbnail)
      // Else, the call originates in, or in the opening of, a new|next show-file
      //   that may have an open 'textareas' dialog
      var origpic;
      if (namepic) {
        later ( ( () => {
          displ = $ ("div[aria-describedby='textareas']").css ("display");
          if (displ !== "none" && name0 === namepic) {
            ediTextClosed ();
            return;
          }
        }), 20);
        // NOTE: An ID string for 'getElementById' should have dots unescaped!
        origpic = document.getElementById ("i" + namepic).firstElementChild.firstElementChild.getAttribute ("title"); // With path

      } else {
        namepic = $ (".img_show .img_name").text ();
        // NOTE: An ID string for JQuery must have its dots escaped! CSS use!
        $ ("#backPos").text ($ ('#i' + escapeDots (namepic)).offset ().top);
        if ($ ("div[aria-describedby='textareas']").css ("display") !== "none") {
          ediTextClosed ();
          return;
        }
        origpic = $ (".img_show img").attr ('title'); // With path
      }

      fileWR (origpic).then (acc => {
        //console.log("> acc:",acc);
        if (acc !== "WR") {
          infoDia (null, null,"Bildtexterna kan inte redigeras", "<br><span class='pink'>" + namepic + "</span> är ändringsskyddad<br><br>Om det är oväntat:<br>Kontrollera filägare!", "Stäng", true);
          //$ ("#textareas").dialog ("open");
          $ ("div[aria-describedby='textareas']").hide ();
          return;
        }
      });
      $ ("#picName").text (namepic);
      displ = $ ("div[aria-describedby='textareas']").css ("display");

      // OPEN THE TEXT EDIT DIALOG and adjust some more details...
      later ( ( () => {
        $ ("#textareas").dialog ("open");
        $ ("div[aria-describedby='textareas']").show ();
        $ ("div[aria-describedby='textareas'] span.ui-dialog-title span").on ("click", () => { // Open if the name is clicked
          later ( ( () => {
            var showpic = origpic.replace (/\/[^/]*$/, '') +'/'+ '_show_' + namepic + '.png';
            this.actions.showShow (showpic, namepic, origpic);
          }), 7);
        });

        $ ('textarea[name="description"]').attr ("placeholder", "Skriv bildtext: När var vad vilka (för Xmp.dc.description)");
        $ ('textarea[name="creator"]').attr ("placeholder", "Skriv ursprung: Foto upphov källa (för Xmp.dc.creator)");
      }), 10);

      refreshEditor (namepic, origpic); // ...and perhaps warnings

      resetBorders ();
      if (displ === "none") {
        // Prepare the extra "non-trivial" dialog buttons
        $ ("div[aria-describedby='textareas'] .ui-dialog-buttonset button:first-child").css ("float", "left");
        $ ("div[aria-describedby='textareas'] .ui-dialog-buttonset button:last-child").css ("float", "right");
        $ ("div[aria-describedby='textareas'] .ui-dialog-buttonset button:first-child").attr ("title", "... som inte visas");
        $ ("div[aria-describedby='textareas'] .ui-dialog-buttonset button:last-child").attr ("title", "Extra sökbegrepp");
        // Resize and position the dialog
        var diaDiv = "div[aria-describedby='textareas']"
        var sw = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
        var diaDivLeft = parseInt ((sw - ediTextSelWidth ())/2) + "px";
        $ (diaDiv).css ("top", "0px");
        $ (diaDiv).css ("left", diaDivLeft);
        $ (diaDiv).css ("max-width", sw+"px");
        $ (diaDiv).css ("width", "");
        let hs = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
        var up = 128;
        //var uy = $("div.ui-dialog");
        //var ui = $("div.ui-dialog .ui-dialog-content");
        var uy = $(diaDiv);
        var ui = $(diaDiv + " .ui-dialog-content");
        uy.css ("height", "auto");
        ui.css ("height", "auto");
        uy.css ("max-height", hs + "px");
        ui.css ("max-height", hs - up + "px");
        uy.css ("top", hs - uy.height ())
      }
      $ (".jstreeAlbumSelect").hide ();
      markBorders (namepic);
    },
    //============================================================================================
    fullSize () { // ##### Show full resolution image

      $ ("#link_show a").css ('opacity', 0 );
      if (window.screen.width < 500) {return;}
      if (!(allow.imgOriginal || allow.adminAll)) {return;}
      var name = $ ("#picName").text ();
      // Only selected user classes may view or download protected images
      if ((name.startsWith ("Vbm") || name.startsWith ("CPR")) && ["admin", "editall", "edit"].indexOf (loginStatus) < 0) {
        userLog ("PROTECTED", true);
        return;
      }
      spinnerWait (true);
      return new Promise ( (resolve, reject) => {
        var xhr = new XMLHttpRequest ();
        var origpic = $ (".img_show img").attr ('title'); // With path
        xhr.open ('GET', 'fullsize/' + origpic, true, null, null); // URL matches routes.js with *?
        xhr.onload = function () {
          if (this.status >= 200 && this.status < 300) {

            // NOTE: djvuName is the name of a PNG file, starting from 2019, see routes.js
            var djvuName = xhr.responseText;
            //var dejavu = window.open (djvuName  + '?djvuopts&amp;zoom=100', 'dejavu', 'width=916,height=600,resizable=yes,location=no,titlebar=no,toolbar=no,menubar=no,scrollbars=yes,status=no'); // Use the PNG file instead (wrongly named):
            var dejavu = window.open (djvuName, 'dejavu', 'width=916,height=600,resizable=yes,location=no,titlebar=no,toolbar=no,menubar=no,scrollbars=yes,status=no');
            if (dejavu) {dejavu.focus ();} else {
              userLog ("POPUP blocked");
            }
            spinnerWait (false);
            resolve (true);
          } else {
            reject ({
              status: this.status,
              statusText: xhr.statusText
            });
          }
        };
        xhr.onerror = function () {
          reject ({
            status: this.status,
            statusText: xhr.statusText
          });
        };
        xhr.send ();
      }).catch (error => {
        console.error (error.message);
      });
    },
    //============================================================================================
    downLoad () { // ##### Download an image

      if (!(allow.imgOriginal || allow.adminAll)) {return;}
      let name = $ ("#picName").text ();
      // Only selected user classes may view or download protected images
      if ((name.startsWith ("Vbm") || name.startsWith ("CPR")) && ["admin", "editall", "edit"].indexOf (loginStatus) < 0) {
        userLog ("COPYRIGHT©protected");
        return;
      }
      $ ("#link_show a").css ('opacity', 0 );
      spinnerWait (true);
      return new Promise ( (resolve, reject) => {
        var xhr = new XMLHttpRequest ();
        var tmp = $ ("#picName").text ().trim ();
        later ( ( () => {
          resetBorders (); // Reset all borders
          markBorders (tmp); // Mark this one
        }), 50);
        var origpic = $ ('#i' + escapeDots (tmp) + ' img.left-click').attr ('title'); // With path
        xhr.open ('GET', 'download/' + origpic, true, null, null); // URL matches routes.js with *?
        xhr.onload = function () {
          if (this.status >= 200 && this.status < 300) {
            //console.log (this.responseURL); // Contains http://<host>/download/...
            var host = this.responseURL.replace (/download.+$/, "");
            $ ("#download").attr ("href", host + this.responseText); // Is just 'origpic'(!)
            later ( ( () => {
              //$ ("#download").click (); DOES NOT WORK
              document.getElementById ("download").click (); // Works
            }), 250);
            spinnerWait (false);
            userLog ("DOWNLOAD");
            resolve (true);
          } else {
            reject ({
              status: this.status,
              statusText: xhr.statusText
            });
          }
        };
        xhr.onerror = function () {
          reject ({
            status: this.status,
            statusText: xhr.statusText
          });
        };
        xhr.send ();
      }).catch (error => {
        console.error (error.message);
      });
    },
    //============================================================================================
    toggleMark (name) { // ##### Mark an image

      if (!name) {
        name = document.getElementById ("link_show").nextElementSibling.nextElementSibling.textContent.trim ();
      }
      resetBorders (); // Reset all borders
      var ident = "#i" + escapeDots (name) + " div:first";
      var marked = $ (ident).hasClass ("markTrue");
      $ (ident).removeClass ();
      $ ("#markShow").removeClass ();
      if (marked) {
        $ (ident).addClass ('markFalse');
        $ ("#markShow").addClass ('markFalseShow');
      } else {
        $ (ident).addClass ('markTrue');
        $ ("#markShow").addClass ('markTrueShow');
      }
      $ ('.showCount .numMarked').text ($ (".markTrue").length + " ");
    },
    //============================================================================================
    logIn () { // ##### User login/confirm/logout button pressed

      //$ ("div[aria-describedby='textareas']").css ("display", "none");
      $ ("#dialog").dialog ('close');
      $ ("#searcharea").dialog ('close');
      document.getElementById ("divDropbox").className = "hide-all";
      ediTextClosed ();
      var that = this;
      $ (".img_show").hide ();
      var btnTxt = $ ("#title button.cred").text ();
      if (btnTxt === " Logga in ") { // Log in (should be buttonText[0] ... i18n)
        $ ("#title input.cred").show ();
        //$ ("#title input.cred.user").focus ();
        //$ ("#title input.cred.user").select ();
        $ ("#title button.cred").text (" Bekräfta ");
        $ ("#title button.cred").attr ("title", "Bekräfta inloggning");
        later ( ( () => {
          $ ("#title input.cred").blur ();
          $ ("#title button.cred").focus (); // Prevents FF showing link to saved passwords
        }),100);
        return;
      }
      if (btnTxt === " Logga ut ") { // Log out
        $ ("#hideFlag").text ("1");// Two lines from 'toggleHideFlagged'
        that.actions.hideFlagged (true).then (null); // Hide flagged pics if shown
        $ ("#title button.cred").text (" Logga in ");
        $ ("#title button.cred").attr ("title", logAdv);
        $ ("#title span.cred.name").text ("");
        this.set ("loggedIn", false);
        $ ("div.settings, div.settings div.root, div.settings div.check").hide ();
        $ ("#title button.viewSettings").hide ();
        $ ("#title button.cred").focus ();
        userLog ("LOGOUT");
        $ ("#title button.cred").focus ();
        zeroSet (); // #allowValue = '000... etc.
        that.actions.setAllow ();
        $ ("#showDropbox").hide ();  // Hide upload button

        if ($ ("#imdbRoot").text ()) { // If imdb is initiated
          // Clear out the search result album
          let lpath = "imdb/" + $ ("#picFound").text ();
          // The following commands must come in sequence (the picFound album is regenerated)
          execute ("rm -rf " +lpath+ " && mkdir " +lpath+ " && touch " +lpath+ "/.imdb").then ();
        }
        // Assure that the album tree is properly shown after LOGOUT
        $ (".ember-view.jstree").jstree ("close_all");
        that.set ("albumData", []);
        $ ("#requestDirs").click ();
        setTimeout(function () { // NOTE: Normally, later replaces setTimeout
          later ( ( () => {
            $ (".ember-view.jstree").jstree ("open_node", $ ("#j1_1"));
          }), 400);
        }, 200);                 // NOTE: Preserved here just as an example

        return;
      }
      if (btnTxt === " Bekräfta ") { // Confirm
        var usr = $ ("#title input.cred.user").val ();
        var pwd = $ ("#title input.cred.password").val ().trim (); // Important
        $ ("#title input.cred").hide ();
        loginError ().then (isLoginError => {
          if (isLoginError) {
            $ ("#title button.cred").text (" Logga in ");
            $ ("#title button.cred").attr ("title", logAdv);
            this.set ("loggedIn", false);
            $ ("div.settings, div.settings div.root, div.settings div.check").hide ();
            userLog ("LOGIN error");
            $ ("#title button.cred").focus ();
            zeroSet (); // #allowValue = '000... etc.
            that.actions.setAllow ();
          } else {
            $ ("#title button.cred").text (" Logga ut ");
            $ ("#title button.cred").attr ("title", "Du är inloggad!");
            $ ("#title button.viewSettings").attr ("title", "Se inställningar - klicka här!");
            $ ("#title button.viewSettings").show ();
            this.set ("loggedIn", true);
//$ ("#title button.cred").focus ();
            userLog ("LOGIN");
//$ ("#title button.cred").focus ();
            that.actions.setAllow ();

            if ($ ("#imdbRoot").text ()) { // If imdb is initiated
              // Clear out the search result album
              let lpath = "imdb/" + $ ("#picFound").text ();
              // The following commands must come in sequence (the picFound album is regenerated)
              execute ("rm -rf " +lpath+ " && mkdir " +lpath+ " && touch " +lpath+ "/.imdb").then ();
            }
            later ( ( () => {
              // Hide album root selector if unqualified
              if (allow.albumEdit || allow.adminAll) {
                $ ("div.settings, div.settings div.root").show ();
              } else {
                $ ("div.settings, div.settings div.root").hide ();
              }
              $ (".cred.name").attr ("title","användarnamn [användarkategori]"); // i18n
              $ ("#toggleTree").click ();
                $ (".ember-view.jstree").jstree ("open_all");
                $ (".ember-view.jstree").jstree ("deselect_all");
                $ (".ember-view.jstree").jstree ("_open_to", $ ("#j1_1"));
                $ (".ember-view.jstree").jstree ("open_node", $ ("#j1_1"));
                later ( ( () => {
                  $ (".ember-view.jstree").jstree ("select_node", $ ("#j1_1"));
                }), 1800);
            }), 800);
          }
          $ ("#title input.cred.password").val ("");
        });
      }

      // When password doesn't match user, return true; else set 'allowvalue' and return 'false'
      function loginError () {
        return new Promise (resolve => {
          /*if (usr === "") {
            usr = "anonym";
            //$ ("#title input.cred.user").val (usr);
          }*/
          //console.log(usr,pwd,"probe");
          getCredentials (usr).then (credentials => {
            var cred = credentials.split ("\n");
            var password = cred [0];
            var status = cred [1];
            loginStatus = status; // global
            if (status === "viewer") {usr = "anonym";}  // i18n
            var allow = cred [2];
            if (pwd === password) {
              $ ("#allowValue").text (allow);
              $ ("#title span.cred.name").text (usr +" ["+ status +"]");

              // Assure that the album tree is properly shown after LOGIN
              $ (".ember-view.jstree").jstree ("close_all");
              that.set ("albumData", []);
              $ ("#requestDirs").click ();
              setTimeout(function () { // NOTE: Normally, later replaces setTimeout
                later ( ( () => {
                  $ (".ember-view.jstree").jstree ("open_node", $ ("#j1_1"));
                }), 200);
                resolve (false);
              }, 200);                 // NOTE: Preserved here just as an example

              // Hide upload button if just viewer or guest:
              if (status === "viewer" || status === "guest") {
                $ ("#showDropbox").hide ();
              } else {
                $ ("#showDropbox").show ();
              }
            } else {
              resolve (true);
            }
          }).catch (error => {
            console.error (error.message);
          });

          function getCredentials (user) { // Sets .. and returns ...
            return new Promise ( (resolve, reject) => {
              // ===== XMLHttpRequest checking 'usr'
              var xhr = new XMLHttpRequest ();
              xhr.open ('GET', 'login/' + user, true, null, null);
              xhr.onload = function () {
                resolve (xhr.responseText);
              }
              xhr.onerror = function () {
                reject ({
                  status: this.status,
                  statusText: xhr.statusText
                });
              }
              xhr.send ();
            }).catch (error => {
              console.error (error.message);
            });
          }
        });
      }
    },
//============================================================================================
    toggleSettings () { // ##### Show/change settings

      if (!this.get ("loggedIn")) {
        $ ("div.settings, div.settings div.root, div.settings div.check").hide ();
        return;
      }
      let that =this;
      //document.getElementById ("imageList").className = "hide-all";
      $ ("#dialog").dialog ('close');
      $ ("#searcharea").dialog ('close');
      ediTextClosed ();
      document.getElementById ("divDropbox").className = "hide-all";
      $ (".img_show").hide (); // settings + img_show don't go together
      $ ("div.settings, div.settings div.root, div.settings div.check").toggle ();
      if (!(allow.albumEdit || allow.adminAll)) {
        $ ("div.settings div.root").hide ();
      } else {
        $ ("div.settings div.root").show (); //important!
        $ (".jstreeAlbumSelect").hide ();
        if ($ ("#imdbRoot").text () === "") {
          this.actions.selectRoot (that, "");
          return;
        }
      }
      this.actions.setAllow (); // Resets unconfirmed changes
      document.querySelector ('div.settings button.confirm').disabled = true;
      var n = document.querySelectorAll ('input[name="setAllow"]').length;
      for (var i=0; i<n; i++) {
        document.querySelectorAll ('input[name="setAllow"]') [i].disabled = false;
        document.querySelectorAll ('input[name="setAllow"]') [i].addEventListener ('change', function () {
          document.querySelector ('div.settings button.confirm').disabled = false;
          $ ("div.settings div.root").hide ();
        })
      }
      // Protect the first checkbox (must be 'allow.adminAll'), set in the sqLite tables:
      document.querySelectorAll ('input[name="setAllow"]') [0].disabled = true;
      // Lock if change of setting is not allowed
      if (!(allow.setSetting || allow.adminAll)) {
        disableSettings ();
        $ (".settings input[type=checkbox]+label").css ("cursor", "default");
      }
      if ($ ("div.settings").is (":visible")) {
        $ (".jstreeAlbumSelect").hide ();
      }
    },
    //============================================================================================
    goTop () {
      scrollTo (0, 0);
      $ (".jstreeAlbumSelect").hide ();
    }
  }
});
// G L O B A L S, that is, 'outside' (global) variables and functions (globals)
/////////////////////////////////////////////////////////////////////////////////////////
let initFlag = true;
let albumWait = false;
let logAdv = "Logga in för att se inställningar, anonymt utan namn eller lösenord, eller med namnet 'gäst' utan lösenord för att också få vissa redigeringsrättigheter"; // i18n
let nosObs = "Skriv gärna på prov, men du saknar tillåtelse att spara text"; // i18n
let nopsGif = "GIF-fil kan bara ha tillfällig text"; // i18n
//let nopsLink = "Text kan inte ändras/sparas permanent via länk"; // i18n Obsolete
let preloadShowImg = [];
let loginStatus = "";
let tempStore = "";
let savedAlbumIndex = 0;
let returnTitles = ["TOPP", "UPP", "SENASTE"];
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Get the age of _imdb_images databases
function age_imdb_images () {
  execute ('echo $(($(date "+%s")-$(date -r imdb/_imdb_images.sqlite "+%s")))').then (s => {
    let d = 0, h = 0, m = 0, text = "&nbsp;";
    if (s*1) {
      d = (s - s%86400);
      s = s - d;
      d = d/86400;
      h = (s - s%3600);
      s = s - h;
      h = h/3600;
      m = (s - s%60);
      s = s - m;
      m = m/60;
      // Show approximate txt database age
      text = "Söktextålder: ";
      if (d) {text += d + " d "; s = 0; m = 0;}
      if (h) {text += h + " h "; s = 0;}
      if (m) {text += m + " m ";}
      if (s) {text += s + " s ";}
    }
    $ ("#searcharea div.diaMess div.edWarn").html (text);
  })
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Load all image paths of the current imdbRoot tree into _imdb_images.sqlite
function load_imdb_images () {
  return new Promise (resolve => {
    spinnerWait (true);
    userLog ("Det här kan ta några minuter ...", true)
    let cmd = './ld_imdb.js -e';
    execute (cmd).then ( () => {
      spinnerWait (false);
      userLog ("Image search texts updated");
      $ ("div[aria-describedby='searcharea']").show ();
      $ ("button.updText").css ("float", "right");
      $ ("button.updText").hide ();
      resolve ("Done")
    })
  })
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Hide the show image element, called by hideShow ()
function hideShow_g () {
  $ ("ul.context-menu").hide (); // if open
  $ ("#link_show a").css ('opacity', 0 );
  $ (".img_show div").blur ();
  if ($ (".img_show").is (":visible")) {
    $ (".img_show").hide ();
    gotoMinipic ($ (".img_show .img_name").text ());
  }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Position to a minipic and highlight its border
function gotoMinipic (namepic) {
  let hs = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
  let spinner = document.querySelector("img.spinner");
  let timer;
  (function repeater () {
    timer = setTimeout (repeater, 500)
    if (spinner.style.display === "none") {
      clearTimeout (timer);
      let y, p = $ ("#i" + escapeDots (namepic));
//console.log(p.offset ());
      if (p.offset ()) {
        y = p.offset ().top + p.height ()/2 - hs/2;
      } else {
        y = 0;
      }
      let t = $ ("#highUp").offset ().top;
      if (t > y) {y = t;}
      scrollTo (null, y);
      resetBorders (); // Reset all borders
      markBorders (namepic); // Mark this one
    }
  } ());

  /*return new Promise (resolve => {
    while (true) {
      later ( ( () => {
        spinner = document.querySelector("img.spinner");
      }), 999);
      if (spinner.style.visibility === "hidden" || spinner.style.display === "none") {break;}
    }*/
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Wait for server activities etc.
function spinnerWait (runWait) {
  if (runWait) {
    $ (".spinner").show ();
    document.getElementById("reLd").disabled = true;
    document.getElementById("saveOrder").disabled = true;
    document.getElementById("toggleTree").disabled = true;
    $ ("div.settings, div.settings div.root, div.settings div.check").hide ();
    $ (".jstreeAlbumSelect").hide ();
    document.getElementById ("divDropbox").className = "hide-all";
  } else { // End waiting
    $ (".spinner").hide ();
    later ( ( () => {
      document.getElementById("reLd").disabled = false;
      document.getElementById("saveOrder").disabled = false;
      document.getElementById("toggleTree").disabled = false;
      document.getElementById("showDropbox").disabled = false; // May be disabled at upload!
    }), 100);
    //if (allow.imgUpload || allow.adminAll) {document.getElementById("uploadPics").disabled = false;}
  }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function deleteFiles (picNames, nels) { // ===== Delete image(s)
//let deleteFiles = (picNames, nels) => { // ===== Delete image(s)

  // nels = number of elements in picNames to be deleted
  // ndel = number of elements in picNames successfully deleted
  new Promise (resolve => {
    let ndel = 0;
    var keep = [], isSymlink;
    for (var i=0; i<nels; i++) {
      isSymlink = $ ('#i' + escapeDots (picNames [i])).hasClass ('symlink');
      if (!(allow.deleteImg || isSymlink && allow.delcreLink || allow.adminAll)) {
        keep.push (picNames [i]);
      } else {
        deleteFile (picNames [i]).then (result => {
          if (result.slice (0,3) === "DEL") {
            ndel++; // Save until later:
            $ ("#temporary").text (ndel + " DELETED");
            //console.log (ndel + " DELETED");
          } else {
            console.log (result);
          }
        });
      }
    }
    if (keep.length > 0) {
      console.log ("No delete permission for " + cosp (keep, true));
      keep = cosp (keep);
      later ( ( () => {
        infoDia (null, null, "Otillåtet att radera", '<br><span  style="color:deeppink">' + keep + '</span>', "Ok", true); // i18n
      }), 100);
    }
    later ( ( () => {
      $ ("#saveOrder").click ();
    }), 200);
    resolve ();
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function deleteFile (picName) { // ===== Delete an image
  $ ("#link_show a").css ('opacity', 0 );
  return new Promise ( (resolve, reject) => {
    // ===== XMLHttpRequest deleting 'picName'
    var xhr = new XMLHttpRequest ();
    var origpic = $ ('#i' + escapeDots (picName) + ' img.left-click').attr ('title'); // With path
    xhr.open ('GET', 'delete/' + origpic, true, null, null); // URL matches routes.js with *?
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        //console.log (xhr.responseText);
        //userLog (xhr.responseText);
        //resolve (picName);
        resolve (xhr.responseText);
      } else {
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.onerror = function () {
      reject ({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    xhr.send ();
    //console.log ('Deleted: ' + picName);
  }).catch (error => {
    console.error (error.message);
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function infoDia (dialogId, picName, title, text, yes, modal, flag) { // ===== Information dialog
  // NOTE: if (picName ===
  //                  "name") { show info for that picture }
  //                      "") { run serverShell ("temporary_1") ... }
  //   null && flag === true) { evaluate #temporary, probably for albumEdit }
  if (!dialogId) {dialogId = "dialog";}
  var id = "#" + dialogId;
  if (picName) { //
    resetBorders (); // Reset all borders
    markBorders (picName); // Mark this one
  }
  $ (id).dialog ( { // Initiate dialog
    title: "", // html set below //#
    closeText: "×",
    autoOpen: false,
    draggable: true,
    modal: modal,
    closeOnEscape: true,
  });
  $ (id).html (text);
  // Define button array
  $ (id).dialog ('option', 'buttons', [
  {
    text: yes, // Okay. See below
      id: "yesBut",
    click: function () {
      if (picName === "") { // Special case: link, move, ..., and then refresh
        spinnerWait (true);
        serverShell ("temporary_1");
        later ( ( () => {
          document.getElementById("reLd").disabled = false;
          $ ("#reLd").click ();
        }), 800);
      }
      $ (this).dialog ('close');
      if (flag && !picName) { // Special case: evaluate #temporary
        console.log ($ ("#temporary").text ());
        eval ($ ("#temporary").text ());
      }
      return true;
    }
  }]);
  niceDialogOpen (dialogId);
  $ ("div[aria-describedby='" + dialogId + "'] span.ui-dialog-title").html (title); //#
  later ( ( () => {
    $ ("#yesBut").focus ();
    $ ("#yesBut").html (yes);
  }), 222);
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function notesDia (picName, filePath, title, text, save, saveClose, close) { // ===== Text dialog
  $ ("#notes").dialog ('destroy').remove ();
  if (picName) { //
    resetBorders (); // Reset all minipic borders
    markBorders (picName); // Mark this one
  }
  $ ('<div id="notes"><textarea class="notes" name="notes" placeholder="Anteckningar (för Xmp.dc.source) som inte visas med bilden" rows="8"></textarea></div>').dialog ( { // Initiate dialog
    title: title,
    closeText: "×",
    autoOpen: false,
    draggable: true,
    modal: true,
    closeOnEscape: true,
    resizable: false
  });
  // Improve 'title':
  $ ("div[aria-describedby='notes'] span.ui-dialog-title").html ("<span class='pink'>" + picName + "</span> &nbsp; " + title);

  function notesSave () { // NOTE: This way to save metadata is probably the most efficient, and
    // 'xmpset' should perhaps ultimately replace 'set_xmp_creatior' and 'set_xmp_description'?
    // Remove extra spaces and convert to <br> for saving metadata in server image:
    text = $ ('textarea[name="notes"]').val ().replace (/ +/g, " ").replace (/\n /g, "<br>").replace (/\n/g, "<br>").trim ();
    fileWR (filePath).then (acc => {
      //console.log("acc:", acc);
      if (acc !== "WR") {
        userLog ("NOT written");
        infoDia (null, null,"Texten sparades inte!", "<br>Texten kan inte uppdateras på grund av något<br>åtkomsthinder &ndash; är filen registrerad på rätt ägare?", "Ok", true);
      } else {
        // Remove <br> in the text shown; use <br> as is for metadata
        $ ('textarea[name="notes"]').val (text.replace (/<br>/g, "\n"));
        // Länk: filePath rätt?
        execute ("xmpset source " + filePath + ' "' + text.replace (/"/g, '\\"')+ '"').then ( () => {
          userLog ("TEXT written");
        });
      }
    });
  }
  // Define button array
  $ ("#notes").dialog ("option", "buttons", [
    {
      text: save,
      //"id": "saveBut",
      class: "saveNotes",
      click: function () { // ***duplicate***
        notesSave ();
      }
    },
    {
      text: saveClose,
      class: "saveNotes",
      click: function () { // ***duplicate***
        notesSave ();
        $ (this).dialog ("close");
      }
    },
    {
      text: close,
      class: "closeNotes",
      click: function () {
        $ (this).dialog ("close");
      }
    }
  ]);
  $ ("#notes").dialog ("open");
  var tmp = $ ("#notes").prev ().html ();
  //tmp = tmp.replace (/<span([^>]*)>/, "<span$1><span>" + picName + "</span> &nbsp ");
  // Why doesn't the close button work? Had to add next line to get it function:
  tmp = tmp.replace (/<button/,'<button onclick="$(\'#notes\').dialog(\'close\');"');
  $ ("#notes").prev ().html (tmp);
  $ ('textarea[name="notes"]').html ("");
  niceDialogOpen ("notes");
  later ( ( () => {
    $ ("#notes").dialog ("open"); // Reopen
    $ ('textarea[name="notes"]').focus (); // Positions to top *
    if (!(allow.notesEdit || allow.adminAll)) {
      $ ('textarea[name="notes"]').attr ("disabled", true);
      $ ("button.saveNotes").attr ("disabled", true);
      $ ("button.closeNotes").focus ();
    }
    $ ('textarea[name="notes"]').html (text.replace (/<br>/g, "\n"));
  }), 40);
  // Why doesn't the 'close-outside' work? Had to add this to get it function:
  $ ('.ui-widget-overlay').bind ('click', function () {
    $ ('#notes').dialog ('close');
  });
  $ ("#notes").css ("padding", "0");
  //document.querySelector('textarea[name="notes"]').scrollTop = 0; // * Doesn't work
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function niceDialogOpen (dialogId) {
  if (!dialogId) {dialogId = "dialog";}
  var id = "#" + dialogId;
  $ (id).parent ().width ("auto");
  $ (id).width ("auto");
  $ (id).parent ().height ("auto");
  $ (id).height ("auto");
  $ (id).parent ().css ("max-height", "");
  $ (id).css ("max-height","");
  $ (id).dialog ("open");
  var esw = ediTextSelWidth () - 100;
  var sw = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
  $ (id).parent ().css ("min-width", "300px");
  $ (id).parent ().css ("max-width", sw+"px");
  $ (id).parent ().width ("auto");
  $ (id).width ("auto");
  if (id === "#notes") {
    var diaDivLeft = parseInt ( (sw - esw)/2) + "px";
    $ (id).parent ().css ("left", diaDivLeft);
    $ (id).parent ().width (esw + "px");
  }
  var up = 128;
  let hs = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
  $ (id).parent ().css ("max-height", hs + "px");
  $ (id).css ("max-height", hs - up + "px");
  // NOTE, nodes above: JQuery objects
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Close the ediText dialog and return false if it wasn't already closed, else return true
function ediTextClosed () {
  $ ("div[aria-describedby='textareas'] span.ui-dialog-title span").html ("");
  $ (".ui-dialog-buttonset button:first-child").css ("float", "none");
  $ (".ui-dialog-buttonset button:last-child").css ("float", "none");
  $ (".ui-dialog-buttonset button:first-child").attr ("title", "");
  $ (".ui-dialog-buttonset button:last-child").attr ("title", "");
  if ($ ("div[aria-describedby='textareas']").css ("display") === "none") {
    return true; // It is closed
  } else {
    $ ("div[aria-describedby='textareas']").hide ();
    $ ('#navKeys').text ('true');
    return false; // It wasn't closed (now it is)
  }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function hideFunc (picNames, nels, act) { // ===== Execute a hide request
  // nels = number of elements in picNames to be acted on, act = hideFlag
  for (var i=0; i<nels; i++) {
    var picName = picNames [i];
    var sortOrder = $ ("#sortOrder").text ();
    var k = sortOrder.indexOf (picName + ",");
    var part1 = sortOrder.substring (0, picName.length + k + 1);
    var part2 = sortOrder.slice (picName.length + k + 1);
    k = part2.indexOf (",");
    var hideFlag = ('z' + act).slice (1); // Set 1 or 0 and convert to string
    sortOrder = part1 + hideFlag + part2.slice (k); // Insert the new flag
    $ ("#i" + escapeDots (picName)).css ('background-color', '#222');
    $ ("#wrap_show").css ('background-color', '#222'); // *Just in case the show image is visible     $ ("#i" + escapeDots (picName)).show ();
    if (hideFlag === "1") { // If it's going to be hidden: arrange its CSS ('local hideFlag')
      $ ("#i" + escapeDots (picName)).css ('background-color', $ ("#hideColor").text ());
      $ ("#wrap_show").css ('background-color', $ ("#hideColor").text ()); // *Just in case -
      // The 'global hideFlag' determines whether 'hidden' pictures are hidden or not
      if ($ ("#hideFlag").text () === "1") { // If hiddens ARE hidden, hide this also
        $ ("#i" + escapeDots (picName)).hide ();
      }
    }
    $ ("#sortOrder").text (sortOrder); // Save in the DOM
  }
  //Update picture numbers:
  var tmp = document.getElementsByClassName ("img_mini");
  var numHidden = 0, numTotal = tmp.length;
  for (i=0; i<numTotal; i++) {
    if (tmp [i].style.backgroundColor === $ ("#hideColor").text ()) {
      numHidden = numHidden + 1;
    }
  }
  if ($ ("#hideFlag").text () === "1") {
    $ (".numHidden").text (numHidden);
    $ (".numShown").text (numTotal - numHidden);
  } else {
    $ (".numHidden").text ("0");
    $ (".numShown").text (numTotal);
  }
  if (numTotal) {
    $ ("span.ifZero").show ();
  } else {
    $ ("span.ifZero").hide ();
  }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function linkFunc (picNames) { // ===== Execute a link-these-files-to... request
  // picNames should also be saved as string in #picNames
  var albums = $ ("#imdbDirs").text ();
  albums = albums.split ("\n");
  //console.log("C",albums);
  var curr = $ ("#imdbDir").text ().match(/\/.*$/); // Remove imdbLink
  if (curr) {curr = curr.toString ();} else {curr = "";}
  var lalbum = [];
  var i;
  for (i=0; i<albums.length; i++) { // Remove current album from options
    if (albums [i] !== curr) {lalbum.push (albums [i]);}
  }

  var rex = /^[^/]*\//;
  var codeLink = "'var lalbum=this.value;var lpath = \"\";if (this.selectedIndex === 0) {return false;}lpath = lalbum.replace (/^[^/]*(.*)/, $ (\"#imdbLink\").text () + \"$1\");console.log(\"Link to\",lpath);var picNames = $(\"#picNames\").text ().split (\"\\n\");var cmd=[];for (var i=0; i<picNames.length; i++) {var linkfrom = document.getElementById (\"i\" + picNames [i]).getElementsByTagName(\"img\")[0].getAttribute (\"title\");linkfrom = \"../\".repeat (lpath.split (\"/\").length - 1) + linkfrom.replace (" + rex + ", \"\");var linkto = lpath + \"/\" + picNames [i];linkto += linkfrom.match(/\\.[^.]*$/);cmd.push(\"ln -sf \"+linkfrom+\" \"+linkto);}$ (\"#temporary\").text (lpath);$ (\"#temporary_1\").text (cmd.join(\"\\n\"));$ (\"#checkNames\").click ();'";
  //console.log(codeLink);

  var r = $ ("#imdbRoot").text ();
  var codeSelect = '<select class="selectOption" onchange=' + codeLink + '>\n<option value="">Välj ett album:</option>';
  for (i=0; i<lalbum.length; i++) {
    var v = r + lalbum [i];
    codeSelect += '\n<option value ="' +v+ '">' +v+ '</option>';
  }
  codeSelect += "\n</select>"
  var title = "Länka till annat album";
  var text = cosp (picNames) +"<br>ska länkas till<br>" + codeSelect;
  var modal = true;
  infoDia (null, "", title, text, "Ok", modal); // Trigger infoDia run 'serverShell("temporary_1")'
  $ ("select.selectOption").focus ();
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function moveFunc (picNames) { // ===== Execute a link-this-file-to... request
  // picNames should also be saved as string in #picNames
  var albums = $ ("#imdbDirs").text ();
  albums = albums.split ("\n");
  let curr = $ ("#imdbDir").text ().match(/\/.*$/); // Remove imdbLink
  if (curr) {curr = curr.toString ();} else {curr = "";}
  let malbum = [];
  let i;
  for (i=0; i<albums.length; i++) { // Remove current album from options
    if (albums [i] !== curr) {malbum.push (albums [i]);}
  }

  let codeMove = "'let malbum = this.value;let mpath = \"\";if (this.selectedIndex === 0) {return false;}mpath = malbum.replace (/^[^/]*(.*)/, $ (\"#imdbLink\").text () + \"$1\");console.log(\"Move to\",mpath);let picNames = $(\"#picNames\").text ().split (\"\\n\");let cmd=[];for (let i=0; i<picNames.length; i++) {let movefrom = \" \" + document.getElementById (\"i\" + picNames [i]).getElementsByTagName(\"img\")[0].getAttribute (\"title\");let mini = movefrom.replace (/([^\\/]+)(\\.[^\\/.]+)$/, \"_mini_$1.png\");let show = movefrom.replace (/([^\\/]+)(\\.[^\\/.]+)$/, \"_show_$1.png\");let moveto = \" \" + mpath + \"/\";cmd.push (\"mv -fu\" +movefrom+mini+show+moveto);}$ (\"#temporary\").text (mpath);$ (\"#temporary_1\").text (cmd.join(\"\\n\"));$ (\"#checkNames\").click ();'"
  //console.log(codeMove);

  let r = $ ("#imdbRoot").text ();
  let codeSelect = '<select class="selectOption" onchange=' + codeMove + '>\n<option value="">Välj ett album:</option>';
  for (i=0; i<malbum.length; i++) {
    let v = r + malbum [i];
    codeSelect += '\n<option value ="' +v+ '">' +v+ '</option>';
  }
  codeSelect += "\n</select>"
  let title = "Flytta till annat album";
  let text = cosp (picNames) +"<br>ska flyttas till<br>" + codeSelect;
  let modal = true;
  infoDia (null, "", title, text, "Ok", modal); // Trigger infoDia run serverShell ("temporary_1")
  $ ("select.selectOption").focus ();
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function saveOrderFunction (namelist) { // ===== XMLHttpRequest saving the thumbnail order list

  if (!(allow.saveChanges || allow.adminAll) || $ ("#imdbDir").text () === "") {return;}

  document.getElementById ("divDropbox").className = "hide-all"; // If shown...
  return new Promise ( (resolve, reject) => {
    $ ("#sortOrder").text (namelist); // Save in the DOM
    var IMDB_DIR =  $ ('#imdbDir').text ();
    if (IMDB_DIR.slice (-1) !== "/") {IMDB_DIR = IMDB_DIR + "/";}
    IMDB_DIR = IMDB_DIR.replace (/\//g, "@"); // For sub-directories
    var xhr = new XMLHttpRequest ();
    xhr.open ('POST', 'saveorder/' + IMDB_DIR); // URL matches server-side routes.js
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        userLog ("SAVE");
        resolve (true); // Can we forget 'resolve'?
      } else {
        userLog ("SAVE error");
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.send (namelist);
  }).catch (error => {
    console.error (error.message);
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function userLog (message, flashOnly) { // ===== Message to the log file and flash the user
  if (!flashOnly) {
    console.log (message);
    var messes = $ ("#title span.usrlg").text ().trim ().split ("•");
    if (messes.length === 1 && messes [0].length < 1) {messes = [];}
    if (!(messes.length > 0 && messes [messes.length - 1].trim () === message.trim ())) {messes.push (message);}
    if (messes.length > 5) {messes.splice (0, messes.length -5);}
    messes = messes.join (" • ");
    $ ("#title span.usrlg").text (messes);
  }
  $ (".shortMessage").text (message);
  $ (".shortMessage").show ();
  later ( ( () => {
    $ (".shortMessage").hide ();
  }), 2000);
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function reqRoot () { // Propose root directory (requestDirs)
  return new Promise ( (resolve, reject) => {
    var xhr = new XMLHttpRequest ();
    xhr.open ('GET', 'rootdir/', true, null, null);
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        var dirList = xhr.responseText;
        resolve (dirList);
      } else {
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.onerror = function () {
      reject ({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    xhr.send ();
  }).catch (error => {
    if (error.status !== 404) {
      console.error (error.message);
    } else {
      console.log ("reqRoot: No NodeJS server");
    }
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function reqDirs (imdbroot) { // Read the dirs in imdb (requestDirs)
  if (imdbroot === undefined) {return;}
  return new Promise ( (resolve, reject) => {
    var xhr = new XMLHttpRequest ();
    spinnerWait (true); // Mostly superfluous
    xhr.open ('GET', 'imdbdirs/' + imdbroot, true, null, null);
    xhr.onload = function () {
      spinnerWait (false);
      if (this.status >= 200 && this.status < 300) {
        var dirList = xhr.responseText;
        dirList = dirList.split ("\n");
        var dirCoco = dirList.splice (dirList.length/2 + 1);
        $ ("#userDir").text (dirList [0].slice (0, dirList [0].indexOf ("@")));
        $ ("#imdbRoot").text (dirList [0].slice (dirList [0].indexOf ("@") + 1));
        $ ("#imdbLink").text (dirList [1]);
        var imdbLen = dirList [1].length;
        dirList = dirList.slice (1);
        var nodeVersion = dirList [dirList.length - 1];
        var nodeText = $ (".lastRow").html (); // In application.hbs
        nodeText = nodeText.replace (/NodeJS[^•]*•/, nodeVersion +" •");
        $ (".lastRow").html (nodeText); // In application.hbs
        // Remove the last line
        dirList.splice (dirList.length - 1, 1);
        for (let i=0; i<dirList.length; i++) {
          dirList [i] = dirList [i].slice (imdbLen);
        }
        // Remove "ignore" albums from the list if not allowed, starred in dirCoco
        if (!(allow.textEdit || allow.adminAll)) {
          let newList = [], newCoco = [];
          for (let j=0; j<dirList.length; j++) {
            if (dirCoco [j].indexOf ("*") < 0) {
              newList.push (dirList [j])
              newCoco.push (dirCoco [j])
            }
          }
          dirList = newList;
          dirCoco = newCoco;
        } else { // Modify the star appearance
          for (let j=0; j<dirCoco.length; j++) {
            dirCoco [j] = dirCoco [j].replace (/\*/, "—*");
          }
        }
//console.log(dirList);
        // Don't keep current album visible if not in dirList:
        let curr = $ ("#imdbDir").text ().match(/\/.*$/); // Remove imdbLink
        if (curr) {curr = curr.toString ();} else {
          curr = "£"; // Side effect: imdb cannot be hidden
        }
        let ix = dirList.indexOf (curr);
        if (ix < 0) {
          document.getElementById ("imageList").className = "hide-all";
          $ ("#imdbDir").text (""); // Remove active album
        } else { // ... but save for selection if present in dirList:
          tempStore = ix + 1; // ELSEWHERE:
          //$ (".ember-view.jstree").jstree ("select_node", $ ("#j1_" + tempStore));
        }
//console.log("########\n",dirList);
        dirList = dirList.join ("\n");
//console.log("########\n",dirList);
        $ ("#imdbDirs").text (dirList);
        dirCoco = dirCoco.join ("\n").trim ();
        $ ("#imdbCoco").text (dirCoco);
        resolve (dirList);
      } else {
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.onerror = function () {
      reject ({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    xhr.send ();
  }).catch (error => {
    if (error.status !== 404) {
      console.error (error.message);
    } else {
      console.log (error.status, error.statusText, "or NodeJS server error?");
    }
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getBaseNames (IMDB_DIR) { // ===== Request imgfile basenames from a server directory
  return new Promise ( (resolve, reject) => {
    if (IMDB_DIR.slice (-1) !== "/") {IMDB_DIR = IMDB_DIR + "/";}
    IMDB_DIR = IMDB_DIR.replace (/\//g, "@");
    var xhr = new XMLHttpRequest ();
    xhr.open ('GET', 'basenames/' + IMDB_DIR, true, null, null);
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        var result = xhr.responseText;
        //userLog ('NAMES received');
        resolve (result);
      } else {
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.onerror = function () {
      reject ({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    xhr.send ();
  }).catch (error => {
    console.error (error.message);
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getFilestat (filePath) { // Request a file's statistics/information
  return new Promise ( (resolve, reject) => {
    var xhr = new XMLHttpRequest ();
    xhr.open ('GET', 'filestat/' + filePath.replace (/\//g, "@"), true, null, null);
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        var data = xhr.responseText.trim ();
        resolve (data);
      } else {
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.onerror = function () {
      reject ({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    xhr.send ();
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function fileWR (filePath) { // Request a server file's exist/read/write status/permission
  // Returns '', 'R', or 'WR', indicating missing, readable, or read/writeable
  return new Promise ( (resolve, reject) => {
    var xhr = new XMLHttpRequest ();
    xhr.open ('GET', 'wrpermission/' + filePath.replace (/\//g, "@"), true, null, null);
    //console.log(filePath);
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        var data = xhr.responseText.trim ();
        resolve (data);
      } else {
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.onerror = function () {
      reject ({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    xhr.send ();
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function resetBorders () { // Reset all mini-image borders and SRC attributes
  var minObj = $ (".img_mini img.left-click");
  minObj.css ('border', '0.25px solid #888');
  //console.log("--- resetBorders");
  minObj.removeClass ("dotted");
  // Resetting all minifile SRC attributes ascertains that any minipic is shown
  // (maybe created just now, e.g. at upload, any outside-click will show them)
  for (var i=0; i<minObj.length; i++) {
    var toshow = minObj [i];
    var minipic = toshow.src;
    $ (toshow).removeAttr ("src").attr ("src", minipic);
  }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function markBorders (picName) { // Mark a mini-image border
  $ ('#i' + escapeDots (picName) + ".img_mini img.left-click").css ('border', '2px dotted deeppink');
  $ ('#i' + escapeDots (picName) + ".img_mini img.left-click").addClass ("dotted");
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function escapeDots (txt) { // Escape dots, for CSS names
  // Use e.g. when file names are used in CSS, #<id> etc.
  return txt.replace (/\./g, "\\.");
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function cosp (textArr, system) { // Convert an array of text strings
  // into a comma+space[and]-separated text string
  var andSep = " och"; // i18n
  if (system) {andSep = ", and"}
  if (textArr.length === 1) {return textArr [0]} else {
    return textArr.toString ().replace (/,/g, ", ").replace (/,\s([^,]+)$/, andSep + " $1")
  }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function removeUnderscore (textString, noHTML) {
  return textString.replace (/_/g, noHTML?" ":"&nbsp;");
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function extractContent(htmlString) { // Extracts text from an HTML string
  var span= document.createElement('span');
  span.innerHTML= htmlString;
  return span.textContent || span.innerText;
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function devSpec () { // Device specific features/settings
  // How do we make context menus with iPad/iOS?
  if ( (navigator.userAgent).includes ("iPad")) {
    $ ("#full_size").hide (); // the central full size image link
  }
  if (window.screen.width < 500) {
    $ ("#full_size").hide (); // the central full size image link
    $ ("a.toggleAuto").hide (); // slide show button
  }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function disableSettings () { // Disables the confirm button, and all checkboxes
  //document.querySelector ('div.settings button.confirm').disabled = true;
  $ ("div.settings button.confirm").prop ("disabled", true);
  for (var i=0; i<allowvalue.length; i++) {
    document.querySelectorAll ('input[name="setAllow"]') [i].disabled = true;
  }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function aData (dirList) { // Construct the jstree data template from dirList
  var d = dirList;  // the dirList vector should be strictly sorted
  var r = ''; // for resulting data
  if (d.length <1) {return r;}
  var i = 0, j = 0;
  var li_attr = 'li_attr:{onclick:"return false",draggable:"false",ondragstart:"return false"},';
  // the first element is the root dir without any '/'
  r = '[ {text:"' + d [0] + '",' + 'a_attr:{title:"' + d [0] + '"},' +li_attr+ '\n';
  var nc = -1; // children level counter
  var b = [d [0]];
  for (i=1; i<dirList.length; i++) {
    var a_attr = 'a_attr:{title:"' + d [i] + '"},'
    var s = b; // branch before
    b = d [i].split ("/"); // branch
    if (b.length > s.length) { // start children
      r += 'children: [\n';
      nc += 1; // always one step up
    } else if (b.length < s.length) { // end children
      r += '}';
      for (j=0; j<s.length - b.length; j++) {
        r += ' ]}';
      }
      r += ',\n';
      nc -= s.length - b.length; // one or more steps down
    } else {
      r += '},\n';
    }
    r += '{text:"' + b [b.length - 1] + '",' + a_attr + li_attr + '\n';
    s = b;
  }
  r += '}]}';
  for (i=0; i<nc; i++) {r += ' ]}';}
  r += ' ]\n';
  if (d.length === 1) {r = r.slice (0, r.length - 4);} // Surplus "} ]" characters
  return r; // Don't removeUnderscore here!
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function serverShell (anchor) { // Send commands in 'anchor text' to server shell
  var cmds = $ ("#"+anchor).text ();
  //console.log(cmds);
  cmds = cmds.split ("\n");
  let commands = [];
  for (var i=0; i<cmds.length; i++) {
    if (cmds [i].length > 1 && cmds [i].slice (0, 1) !== "#") { // Skip comment lines
      commands.push (cmds [i]);
    }
  }
  commands = commands.join ("\n").trim ();
  if (commands) {
    mexecute (commands).then (result => {
      if (result.toString ().trim ()) {
        console.log (result);
      }
    });
  }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function mexecute (commands) { // Execute on the server, return a promise
  let data = new FormData();
  data.append ("cmds", commands);
  return new Promise ( (resolve, reject) => {
    let xhr = new XMLHttpRequest ();
    xhr.open ('POST', 'mexecute/');
    xhr.onload = function () {
      //console.log ("Status", this.status);
      resolve (xhr.responseText); // usually empty
    };
    xhr.onerror = function () {
      reject ({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    xhr.send (data);
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function execute (command) { // Execute on the server, return a promise
  return new Promise ( (resolve, reject) => {
    var xhr = new XMLHttpRequest ();
    command = command.replace (/%/g, "%25");
    xhr.open ('GET', 'execute/' + encodeURIComponent (command.replace (/\//g, "@")), true, null, null);
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        var data = xhr.responseText.trim ();
        resolve (data);
      } else {
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.onerror = function () {
      reject ({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    xhr.send ();
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function ediTextSelWidth () { // Selects a useful edit dialog width within available screen (px)
  var sw = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
  if (sw > 750) {sw = 750;}
  return sw;
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Prepare dialogs
var prepDialog = () => {
  later ( ( () => {
    $ ("#helpText").dialog ({autoOpen: false, resizable: true, title: "Användarhandledning"}); // Initiate a dialog...
    $ (".ui-dialog .ui-dialog-titlebar-close").text ("×");
    //later ( ( () => {
    //  $ ("#helpText").dialog ("close"); // and close it
    //}), 100);
    // Initiate a dialog, ready to be used:
    $ ("#dialog").dialog ({resizable: true}); // Initiate a dialog...
    $ (".ui-dialog .ui-dialog-titlebar-close").text ("×");
    $ ("#dialog").dialog ("close"); // and close it
    // Close on click off a modal dialog with overlay:
    $ ("body").on ("click", ".ui-widget-overlay", function () {
      $ ("#dialog").dialog ( "close" );
    });
  }), 7);
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Prepare the dialog for text search
let prepSearchDialog = () => {
  $ ( () => {
    let sw = ediTextSelWidth () - 25; // Dialog width
    let tw = sw - 25; // Text width
    $ ('<div id="searcharea" style="margin:0;padding:0;width:'+sw+'px"><div class="diaMess"> <div class="edWarn" style="font-weight:normal;text-align:right" ></div> \
    <div class="srchIn">Sök i:&nbsp; <span class="glue"><input id="t1" type="checkbox" name="search1" value="description" checked/><label for="t1">&nbsp;bildtext</label></span>&nbsp; \
    <span class="glue"><input id="t2" type="checkbox" name="search2" value="creator"/><label for="t2">&nbsp;ursprung</label></span>&nbsp; \
    <span class="glue"><input id="t3" type="checkbox" name="search3" value="source"/><label for="t3">&nbsp;anteckningar</label></span>&nbsp; \
    <span class="glue"><input id="t4" type="checkbox" name="search4" value="album"/><label for="t4">&nbsp;album</label></span>&nbsp; \
    <span class="glue"><input id="t5" type="checkbox" name="search5" value="name"/><label for="t5">&nbsp;namn</label></span></div> \
    <div class="orAnd">Regel för åtskilda ord/textbitar (\' och % räknas som blank):<br><span class="glue"><input id="r1" type="radio" name="searchmode" value="AND" checked/><label for="r1">&nbsp;alla&nbsp;ska&nbsp;hittas</label></span>&nbsp; <span class="glue"><input id="r2" type="radio" name="searchmode" value="OR"/><label for="r2">&nbsp;minst&nbsp;ett&nbsp;av&nbsp;dem&nbsp;ska&nbsp;hittas</label></span></div> <span class="srchMsg"></span></div><textarea name="searchtext" placeholder="(minst tre tecken utöver omgivande blanka)" rows="4" style="min-width:'+tw+'px" /></div>').dialog ( {
      title: "Finn bilder: Sök i bildtexter",

      //closeText: "×", // Replaced (why needed?) below by // Close => ×
      autoOpen: false,
      closeOnEscape: true,
      modal: false
    });
    $ ("#searcharea").dialog ('option', 'buttons', [
      {
        text: " Sök ", // findText should update
        //"id": "findBut",
        class: "findText",
        click: function () {
          // Replace ['% \n]+ with a single space (' and % disturbes WHERE ... LIKE ...)
          let sTxt = $ ('textarea[name="searchtext"]').val ().replace (/['% \n]+/g, " ").trim ()
          if (sTxt.length < 3) {
            $ ('textarea[name="searchtext"]').val ("");
            $ ('textarea[name="searchtext"]').focus ();
          } else {
            $ ("button.updText").hide ();
            $ ("button.findText").show ();
            age_imdb_images (); // Show the time since the data was collected
            let and = $ ('input[type="radio"]') [0].checked;
            let boxes = $ ('.srchIn input[type="checkbox"]');
            let sWhr = [];
            let n = 0;
            for (let i=0; i<boxes.length; i++) {
              sWhr [i] = boxes [i].checked;
              if (sWhr [i]) {n++}
            }
            if (!n) {
              return;
            }
//console.log(sWhr);
            spinnerWait (true);
            searchText (sTxt, and, sWhr).then (result => {
              $ ("#temporary_1").text ("");
              let cmd = [];

              /*/ Clear out the search result album
              let lpath = "imdb/" + $ ("#picFound").text ();
              // The following commands must come in sequence (the picFound album is regenerated)
              cmd.push ("rm -rf " +lpath+ " && mkdir " +lpath+ " && touch " +lpath+ "/.imdb");*/

              // Insert links of found pictures into picFound:
              let n = 0, paths = [], albs = [];
              // Maximum numer of pictures from the search results to show:
              let nLimit = 100;
              if (result) {
                paths = result.split ("\n").sort ();
//console.log(" result:\n" + result);
//console.log(" paths:\n" + paths.join ("\n"));
                let chalbs = $ ("#imdbDirs").text ().split ("\n");
                n = paths.length;
                let lpath = "imdb/" + $ ("#picFound").text ();
                for (let i=0; i<n; i++) {
                  let chalb = paths [i].replace (/^[^/]+(.*)\/[^/]+$/, "$1");
//console.log(chalb, chalbs.indexOf (chalb));
                  if (!(chalbs.indexOf (chalb) < 0)) {
                    let fname = paths [i].replace (/^.*\/([^/]+$)/, "$1");
                    let linkfrom = paths [i];
                    linkfrom = "../".repeat (lpath.split ("/").length - 1) + linkfrom.replace (/^[^/]*\//, "");
                    let linkto = lpath + "/" + fname;
                    if (albs.length < nLimit) {
                      cmd.push ("ln -sf " + linkfrom + " " + linkto);
                    }
                    albs.push (paths [i]);
                  }
                }
                paths = albs;
              }
              n = paths.length;
              //if (n > 0) {
                // Clear out the search result album
                let lpath = "imdb/" + $ ("#picFound").text ();
                // The following commands must come in sequence (the picFound album is regenerated)
                execute ("rm -rf " +lpath+ " && mkdir " +lpath+ " && touch " +lpath+ "/.imdb").then ();
              //}
              userLog (n + " FOUND");
              $ ("#temporary_1").text (cmd.join ("\n"));
              let yes ="Visa i <b>" + removeUnderscore ($ ("#picFound").text (), true) + "</b>";
              let modal = false;
              let p3 =  "<p style='margin:-0.3em 1.6em 0.2em 0;background:transparent'>" + sTxt + "</p>Funna i <span style='font-weight:bold'>" + $ ("#imdbRoot").text () + "</span>:&nbsp; " + n + (n>nLimit?" (i listan, bara " + nLimit + " kan visas)":"");
              // Run `serverShell ("temporary_1")` via `infoDia (null, "", ... )`
              infoDia (null, "", p3, "<div style='text-align:left;margin:0.3em 0 0 2em'>" + paths.join ("<br>").replace (/imdb\//g, "./") + "</div>", yes, modal);
              //alert (n +"\n"+ result);
              if (n === 0) {document.getElementById("yesBut").disabled = true;}
              $ ("button.findText").show ();
              $ ("button.updText").css ("float", "right");
              selectPicFound ();
              //spinnerWait (false);
              if (n <= 100 && loginStatus === "guest") { // Simply show the search result at once...
                $ ("div[aria-describedby='dialog'] button#yesBut").click ();
              } // ...else inspect and decide whether to click the show button
            });
          }
        }
      },
      {
        text: " Stäng ",
        click: () => {
          $ ("#searcharea").dialog ('close');
        }
      },
      {
        text: "reload", // findText should update
        title: "",
        //"id": "updBut",
        class: "updText",
        click: function () {
          $ ("div[aria-describedby='searcharea']").hide ();
          //spinnerWait (true);
          load_imdb_images ().then ( () => {
            //console.log(result);
            later ( ( () => {
              //age_imdb_images ();
              //spinnerWait (false);
              //userLog ("DATABASE reloaded");
              age_imdb_images ();
            }), 2000);
          });
        }
      },
    ]);
    let txt = $ ("button.ui-dialog-titlebar-close").html (); // Close => ×
    txt.replace (/Close/, "×");                                    // Close => ×
    $ ("button.ui-dialog-titlebar-close").html (txt);        // Close => ×
    $ ("div[aria-describedby='searcharea'] span.ui-dialog-title").html ('Finn bilder <span style="color:green">(ej länkar)</span>: Sök i bildtexter');
  });
} // end prepSearchDialog
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Display found-pictures album link in jstree
function selectPicFound () {
  $ ("div[aria-describedby='searcharea']").hide ();
  let index = 1 + $ ("#imdbDirs").text ().split ("\n").indexOf ("/" + $ ("#picFound").text ());
  //console.log($ ("#picFound").text (), index);
  $ (".ember-view.jstree").jstree ("open_node", $ ("#j1_1"));
  $ (".ember-view.jstree").jstree ("deselect_all");
  $ (".ember-view.jstree").jstree ("select_node", $ ("#j1_" + index));
  $ (".jstreeAlbumSelect").show ();
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Search image text in the current imdbRoot
function searchText (searchString, and, searchWhere) {
  hideShow_g ();
  ediTextClosed ();
  let ao = "", AO;
  if (and) {AO = " AND "} else {AO = " OR "}
  let arr = searchString;
  if (arr === "") {arr = undefined;}
//console.log ("Att söka:", arr);
  let str = "";
  if (arr) {
    arr = arr.split (" ");
//console.log(arr);
    for (let i = 0; i<arr.length; i++) {
      arr [i] = "'%" + arr [i] + "%'";
      if (i > 0) {ao = AO + "\n"}
      str += ao + "txtstr LIKE " + arr[i].trim ();
    }
//console.log(str);
    str = str.replace (/\n/g, "");
  }
//console.log(str)
  if (!$ ("#imdbDir").text ()) {
    $ ("#imdbDir").text ("imdb/" + $ ("#picFound").text ());
///******
  }
  let srchData = new FormData();
  srchData.append ("like", str);
  srchData.append ("cols", searchWhere);
  srchData.append ("info", "not used yet");
  return new Promise ( (resolve, reject) => {
    let xhr = new XMLHttpRequest();
    let imdbroot = $ ("#imdbRoot").text ();
    xhr.open ('POST', 'search/' + imdbroot);
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        let data = xhr.responseText.trim ();
        resolve (data);
      } else {
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.send (srchData);
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// https://stackoverflow.com/questions/30605298/jquery-dialog-with-input-textbox etc.
// Prepare the dialog for the image texts editor
var prepTextEditDialog = () => {
$ ( () => {
  var sw = ediTextSelWidth (); // Selected dialog width
  var tw = sw - 25; // Text width
  $ ('<div id="textareas" style="margin:0;padding:0;width:'+sw+'px"><div class="diaMess"><span class="edWarn"></span></div><textarea name="description" rows="6" style="min-width:'+tw+'px" /><br><textarea name="creator" rows="1" style="min-width:'+tw+'px" /></div>').dialog ( {
    title: "Bildtexter",
    //closeText: "×", // Replaced (why needed?) below by // Close => ×
    autoOpen: false,
    draggable: true,
    closeOnEscape: false, // NOTE: handled otherwise
    modal: false
  });

  $ ("#textareas").dialog ('option', 'buttons', [
    {
      text: "Anteckningar",
      click: () => { // "Non-trivial" dialog button, to a new level
        var namepic = $ ("div[aria-describedby='textareas'] span.ui-dialog-title span").html ();
        var ednp = escapeDots (namepic);
        var linkPath = $ ("#i" + ednp + " img").attr ("title");
        var filePath = linkPath; // OK if not a link
        function xmpGetSource () {
          execute ("xmpget source " + filePath).then (result => {
            notesDia (namepic, filePath, "Anteckningar", result, "Spara", "Spara och stäng", "Stäng");
          });
        }
        if ($ ("#i" + ednp).hasClass ("symlink")) {
          getFilestat (linkPath).then (result => {
            //console.log (result); // The file info HTML, strip it:
            result = result.replace (/^.+: ((\.){1,2}\/)+/, "imdb/");
            result = result.replace (/^([^<]+)<.+/, "$1");
            filePath = result;
          }).then ( () => {
            xmpGetSource ();
            return;
          })
        } else {
          xmpGetSource ();
        }
      }
    },
    {
      text: " Spara ",
      //"id": "saveBut",
      class: "saveTexts",
      click: function () {
        var namepic = $ ("div[aria-describedby='textareas'] span.ui-dialog-title span").html ();
        var text1 = $ ('textarea[name="description"]').val ();
        var text2 = $ ('textarea[name="creator"]').val ();
        storeText (namepic, text1, text2);
      }
    },
    {
      text: " Spara och stäng ",
      class: "saveTexts",
      click: () => {
        var namepic = $ ("div[aria-describedby='textareas'] span.ui-dialog-title span").html ();
        var text1 = $ ('textarea[name="description"]').val ();
        var text2 = $ ('textarea[name="creator"]').val ();
        storeText (namepic, text1, text2);
        ediTextClosed ();
      }
    },
    {
      text: " Stäng ",
      click: () => {
        ediTextClosed ();
      }
    },
    {
      text: "Nyckelord",
      click: () => { // "Non-trivial" dialog button, to a new level
        infoDia (null, "","Nyckelord", "Ord lagrade som metadata<br>som kan användas som särskilda sökbegrepp<br><br>UNDER UTVECKLING", "Ok", true);
      }
    }
  ]);

  var txt = $ ("button.ui-dialog-titlebar-close").html (); // Close => ×
  txt.replace (/Close/, "×");                                    // Close => ×
  $ ("button.ui-dialog-titlebar-close").html (txt);        // Close => ×
  // NOTE this clumpsy direct reference to jquery (how directly trigger ediTextClosed?):
  $ ("button.ui-dialog-titlebar-close").attr ("onclick",'$("div[aria-describedby=\'textareas\'] span.ui-dialog-title span").html("");$("div[aria-describedby=\'textareas\']").hide();$("#navKeys").text("true");$("#smallButtons").show();$("div.nav_links").show()');

  function storeText (namepic, text1, text2) {
    text1 = text1.replace (/ +/g, " ").replace (/\n /g, "<br>").replace (/\n/g, "<br>").trim ();
    text2 = text2.replace (/ +/g, " ").replace (/\n /g, "<br>").replace (/\n/g, "<br>").trim ();
    // Show what was saved:
    $ ('textarea[name="description"]').val (text1.replace (/<br>/g, "\n"));
    $ ('textarea[name="creator"]').val (text2.replace (/<br>/g, "\n"));
    var ednp = escapeDots (namepic);
    var fileName = $ ("#i" + ednp + " img").attr ('title');
    $ ("#i" + ednp + " .img_txt1" ).html (text1);
    $ ("#i" + ednp + " .img_txt1" ).attr ('title', text1.replace(/<[^>]+>/g, " "));
    $ ("#i" + ednp + " .img_txt2" ).html (text2);
    $ ("#i" + ednp + " .img_txt2" ).attr ('title', text2.replace(/<[^>]+>/g, " "));
    if ($ (".img_show .img_name").text () === namepic) {
      $ ("#wrap_show .img_txt1").html (text1);
      $ ("#wrap_show .img_txt2").html (text2);
    }
    // Cannot save metadata in GIFs:
    if (fileName.search (/\.gif$/i) > 0) {return;}
    // Get real file name if symlink:
    let linkPath = fileName;
    if ($ ("#i" + ednp).hasClass ("symlink")) {
      getFilestat (linkPath).then (result => {
        //console.log (result); // The file info HTML, strip it:
        result = result.replace (/^.+: ((\.){1,2}\/)+/, "imdb/");
        result = result.replace (/^([^<]+)<.+/, "$1");
        fileName = result;
      }).then ( () => {
        saveText (fileName +'\n'+ text1 +'\n'+ text2);
        return;
      })
    } else {
      saveText (fileName +'\n'+ text1 +'\n'+ text2);
    }
    // ===== XMLHttpRequest saving the text
    function saveText (txt) {
      var IMDB_DIR =  $ ("#imdbDir").text ();
      if (IMDB_DIR.slice (-1) !== "/") {IMDB_DIR = IMDB_DIR + "/";} // Important!
      IMDB_DIR = IMDB_DIR.replace (/\//g, "@"); // For sub-directories

      var xhr = new XMLHttpRequest ();
      xhr.open ('POST', 'savetext/' + IMDB_DIR); // URL matches server-side routes.js
      xhr.onload = function () {
        if (xhr.responseText) {
          userLog ("NOT written");
          $ ("#i" + ednp + " .img_txt1" ).html ("");
          $ ("#i" + ednp + " .img_txt2" ).html ("");
          infoDia (null, null,"Texten sparades inte!", '<br>Bildtexten kan inte uppdateras på grund av<br>något åtkomsthinder &ndash; är filen registrerad på rätt ägare?<br><br>Eventuell tillfälligt förlorad text återfås med ”Återställ osparade ändringar”', "Ok", true);
        } else {
          userLog ("TEXT written");
          //console.log ('Xmp.dc metadata saved in ' + fileName);
        }
      }
      xhr.send (txt);
    }
  }
});
} // end prepTextEditDialog
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Refresh the editor dialog content
function refreshEditor (namepic, origpic) {
  $ ("div[aria-describedby='textareas'] span.ui-dialog-title").html ("<span class='pink'>" + namepic + "</span> &nbsp; Bildtexter");
  // Take care of the notes etc. buttons:
  if (!(allow.notesView || allow.adminAll)) {
    $ ("div[aria-describedby='textareas'] .ui-dialog-buttonset button:first-child").css ("display", "none");
    $ ("div[aria-describedby='textareas'] .ui-dialog-buttonset button:last-child").css ("display", "none");
  } else {
    $ ("div[aria-describedby='textareas'] .ui-dialog-buttonset button:first-child").css ("display", "inline");
    $ ("div[aria-describedby='textareas'] .ui-dialog-buttonset button:last-child").css ("display", "inline");
  }
  $ ("#textareas .edWarn").html ("");
  let warnText = "";
  if ($ ("button.saveTexts").attr ("disabled")) { // Cannot save if not allowed
    warnText += nosObs;
    //$ ("#textareas .edWarn").html (nosObs); // Nos = no save
  }
  if (origpic.search (/\.gif$/i) > 0) {
    // Don't display the notes etc. buttons:
    warnText += (warnText?"<br>":"") + nopsGif;
    $ (".ui-dialog-buttonset button:first-child").css ("display", "none");
    $ (".ui-dialog-buttonset button:last-child").css ("display", "none");
  }
  warnText = "<b style='float:left;cursor:text'> &nbsp; ’ – × ° — ” &nbsp; </b>" + warnText;

  if (warnText) {$ ("#textareas .edWarn").html (warnText);}
  // Load the texts to be edited after positioning to top
  $ ('textarea[name="description"]').html ("");
  $ ('textarea[name="creator"]').html ("");
  $ ("#textareas").dialog ("open"); // Reopen
  $ ('textarea[name="description"]').focus ();
  later ( ( () => {
    $ ('textarea[name="creator"]').val ($ ('#i' + escapeDots (namepic) + ' .img_txt2').html ().trim ().replace (/<br>/g, "\n"));
    $ ('textarea[name="description"]').val ($ ('#i' + escapeDots (namepic) + ' .img_txt1').html ().trim ().replace (/<br>/g, "\n"));
  }), 40);
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Allowance settings
// 'allowance' contains the property names array for 'allow'
// 'allowvalue' is the source of the 'allow' property values
// 'allow' has settings like 'allow.deleteImg' etc.
var allowance = [ // 'allow' order
  "adminAll",     // + allow EVERYTHING
  "albumEdit",    // +  " create/delete album directories
  "appendixEdit", // o  " edit appendices (attached documents)
  "appendixView", // o  " view     "
  "delcreLink",   // +  " delete and create linked images NOTE *
  "deleteImg",    // +  " delete (= remove, erase) images NOTE *
  "imgEdit",      // o  " edit images
  "imgHidden",    // +  " view and manage hidden images
  "imgOriginal",  // +  " view and download full size images
  "imgReorder",   // +  " reorder images
  "imgUpload",    // +  " upload    "
  "notesEdit",    // +  " edit notes (metadata) NOTE *
  "notesView",    // +  " view   "              NOTE *
  "saveChanges",  // +  " save order/changes (= saveOrder)
  "setSetting",   // +  " change settings
  "textEdit"      // +  " edit image texts (metadata)
];
var allowvalue = "0".repeat (allowance.length);
$ ("#allowValue").text (allowvalue);
var allow = {};
function zeroSet () { // Called from logIn at logout
  $ ("#allowValue").text ("0".repeat (allowance.length));
}
function allowFunc () { // Called from setAllow (which is called from init(), logIn(), toggleSettings(),..)
  allowvalue = $ ("#allowValue").text ();
  for (var i=0; i<allowance.length; i++) {
    allow [allowance [i]] = Number (allowvalue [i]);
    //console.log(allowance[i], allow [allowance [i]]);
  }
  if (allow.deleteImg) {  // NOTE *  If ...
    allow.delcreLink = 1; // NOTE *  then set this too
    i = allowance.indexOf ("delcreLink");
    allowvalue = allowvalue.slice (0, i - allowvalue.length) + "1" + allowvalue.slice (i + 1 - allowvalue.length); // Also set the source value (in this way since see below)
    //allowvalue [i] = "1"; Gives a weird compiler error: "4 is read-only" if 4 = the index value
  }
  if (allow.notesEdit) { // NOTE *  If ...
    allow.notesView = 1; // NOTE *  then set this too
    i = allowance.indexOf ("notesView");
    allowvalue = allowvalue.slice (0, i - allowvalue.length) + "1" + allowvalue.slice (i + 1 - allowvalue.length);
  }
  // Hide smallbuttons we don't need:
  if (allow.adminAll || allow.saveChanges) { // For anonymous user who may reorder
    $ ("#saveOrder").show ();
  } else {
    $ ("#saveOrder").hide ()
  }
  if (allow.adminAll || allow.imgHidden) {
    $ ("#toggleHide").show ();
  } else {
    $ ("#toggleHide").hide ();
  }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Disable browser back button
history.pushState (null, null, location.href);
window.onpopstate = function () {
    history.go(1);
}
