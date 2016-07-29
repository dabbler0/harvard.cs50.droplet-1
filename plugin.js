console.log('The define() call is running.');
define(function(require, exports, module) {
  console.log('The initial script is running.');
  var droplet = require('./droplet/dist/droplet-full.js');
  require('./jquery.min.js');
  var $ = jQuery;
  var tooltipster = require('./tooltipster/dist/js/tooltipster.bundle.js');

  var worker = null;

  function createWorker(mod) {
      // nameToUrl is renamed to toUrl in requirejs 2
      if (require.nameToUrl && !require.toUrl)
          require.toUrl = require.nameToUrl;

      var workerUrl = workerUrl || require.toUrl(mod);

      console.log('USING WORKER URL', workerUrl);

      try {
          return new Worker(workerUrl);
      } catch(e) {
          if (e instanceof window.DOMException) {
              // Likely same origin problem. Use importScripts from a shim Worker
              var blob = workerBlob(workerUrl);
              var URL = window.URL || window.webkitURL;
              var blobURL = URL.createObjectURL(blob);

              console.log('blobURL', blobURL);

              var worker = new Worker(blobURL);

              setTimeout(function() { // IE EDGE needs a timeout here
                  URL.revokeObjectURL(blobURL);
              });

              return worker;
          } else {
              throw e;
          }
      }
  };

  function workerBlob(url) {
    // workerUrl can be protocol relative
    // importScripts only takes fully qualified urls
    var script = "importScripts('" + url + "');";
    try {
        return new Blob([script], {"type": "application/javascript"});
    } catch (e) { // Backwards-compatibility
        var BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;
        var blobBuilder = new BlobBuilder();
        blobBuilder.append(script);
        return blobBuilder.getBlob("application/javascript");
    }
  }

  var OPT_MAP = {
    'ace/mode/c_cpp': JSON.parse(require("text!./droplet-configs/c_cpp.json"))
  };

  var useBlocksByDefault = true;

  main.consumes = ["Plugin", "tabManager", "ace", "ui", "commands", "menus", "settings"];
  main.provides = ["c9.ide.cs50.droplet"];
  return main;

  function main(options, imports, register) {
    console.log('Main is running');
    var Plugin = imports.Plugin;
    var tabManager = imports.tabManager;
    var ace = imports.ace;
    var ui = imports.ui;
    var commands = imports.commands;
    var menus = imports.menus;
    var settings = imports.settings;

    /***** Initialization *****/

    var plugin = new Plugin("CS50", main.consumes);
    var emit = plugin.getEmitter();

    console.log('Loading. Static prefix is', options.staticPrefix);

    window._lastEditor = null; // This is a debug variable/

    settings.on("read", function() {
        settings.setDefaults("user/cs50/droplet", [
            ["useBlocksByDefault", true]
        ]);
    });

    function toggleBlocksDefault(override) {
      if (typeof override === "boolean") {
        useBlocksByDefault = override;
      }
      else {
        useBlocksByDefault = !useBlocksByDefault;
        settings.set("user/cs50/droplet/@useBlocksByDefault", useBlocksByDefault);
      }

      menus.get("View/Use Blocks by Default").item.checked = useBlocksByDefault;
    }

    function load() {

      tabManager.once("ready", function() {

        tabManager.getTabs().forEach(function(tab) {
          var ace = tab.path && tab.editor.ace;
          if (ace && tab.editorType == "ace") {
            attachToAce(tab.editor.ace);
          }
        });

        ace.on("create", function(e) {
          console.log('Just created! Binding now.');
          e.editor.on("createAce", attachToAce, plugin);
        }, plugin);

      });


      var toggle = new ui.item({
        type: "check",
        caption: "Use Blocks by Default",
        onclick: toggleBlocksDefault
      });

      var divider = new ui.divider();

      menus.addItemByPath("View/Use Blocks by Default", toggle, 0, plugin);

      function forceAddCss(mod) {
          var linkElement = document.createElement('link');
          linkElement.setAttribute('rel', 'stylesheet');
          linkElement.setAttribute('href', require.toUrl(mod));
          document.head.appendChild(linkElement);
      }
      forceAddCss('./droplet/css/droplet.css');
      forceAddCss("./tooltipster/dist/css/tooltipster.bundle.min.css");
      forceAddCss("./tooltipster-style.css");

      console.log("Blocks by default:", settings.get("user/cs50/droplet/@useBlocksByDefault"));

      toggleBlocksDefault(settings.get("user/cs50/droplet/@useBlocksByDefault"));

    }

    function unload() {
      tabManager.getTabs().forEach(function(tab) {
        var ace = tab.path && tab.editor.ace;
        if (ace) {
          detachFromAce(tab.editor.ace);
        }
      });
      dropletEditor = null;
    }

    /***** Methods *****/

    var worker = createWorker('./droplet/dist/worker.js');

    function attachToAce(aceEditor) {
      console.log('Attached to ace editor!');
      if (!aceEditor._dropletEditor) {
        var currentValue = aceEditor.getValue();
        var dropletEditor = aceEditor._dropletEditor = new droplet.Editor(aceEditor, lookupOptions(aceEditor.getSession().$modeId), worker);

        dropletEditor.on('palettechange', function() {
          $(dropletEditor.paletteCanvas.children).each(function(index) {
            var title = Array.from(this.children).filter(function(child) { return child.tagName === 'title'; })[0];

            if (title != null) {
              this.removeChild(title);

              var element = $('<div>').html(title.textContent)[0];

              $(this).tooltipster({
                position: 'top',
                interactive: true,
                content: element,
                theme: ['tooltipster-noir', 'tooltipster-noir-customized'],
                contentCloning: true,
                maxWidth: 300
              });
            }
          });
        });

        // Restore the former top margin (for looking contiguous with the tab)
        dropletEditor.wrapperElement.style.top = '7px';

        dropletEditor.on('change', function() {
          setTimeout(function() {
            if (dropletEditor.session && dropletEditor.session.currentlyUsingBlocks) {
              console.log('Setting ace value');
              dropletEditor.setAceValue(dropletEditor.getValue());
            }
          }, 0);
        })

        _lastEditor = dropletEditor; // _lastEditor is a debug variable
        aceEditor._dropletEditor.setValueAsync(currentValue);

        var button = document.createElement('div');
        button.className = 'c9-droplet-toggle-button';

        // TODO move to a stylesheet
        // TODO a block shape SVG?
        button.innerText = '';
        button.style.position = 'absolute';
        button.style.right = '-30px';
        button.style.width = '30px';
        button.style.height = '50px';
        button.style.top = '50%';
        button.style.bottom='50%';
        button.style.marginTop = '-25px';
        button.style.cursor = 'pointer';
        button.style.boxShadow = '6px 0 6px -6px gray';
        button.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
        button.style.borderTopRightRadius = button.style.borderBottomRightRadius = '5px';
        dropletEditor.paletteElement.appendChild(button);

        if (!aceEditor._dropletEditor.session || !aceEditor._dropletEditor.session.currentlyUsingBlocks) {
          button.style.display = "none";
        }

        button.addEventListener('click', function() {
          aceEditor._dropletEditor.toggleBlocks();
        });

        // here we get an instance of ace
        // we can listen for setSession
        // and create droplet editor attached to this ace instance
        // it can work similar to http://pencilcode.net/edit/first
        // where there is a widget on the gutter displayed for all coffee files
        aceEditor.on("changeSession", function(e) {
          if (aceEditor._dropletEditor.hasSessionFor(e.session)) {
            button.style.display = 'block';
          }
          else {
            var option = lookupOptions(e.session.$modeId);
            if (option != null) {
              aceEditor._dropletEditor.bindNewSession(option);
              button.style.display = 'block';
            }
            else {
              button.style.display = 'none';
            }
          }
          var aceSession = window._lastBoundSession = e.session; // window._lastBoundSession is a debug variable

          e.session.on('changeMode', function(e) {
            if (aceEditor._dropletEditor.hasSessionFor(aceEditor.getSession())) {
             aceEditor._dropletEditor.setMode(lookupMode(aceEditor.getSession().$modeId), lookupModeOptions(aceEditor.getSession().$modeId));
             aceEditor._dropletEditor.setPalette(lookupPalette(aceEditor.getSession().$modeId));
            } else {
              var option = lookupOptions(aceEditor.getSession().$modeId);
              if (option != null) {
                aceEditor._dropletEditor.bindNewSession(option);
                button.style.display = 'block';
              }
              else {
                button.style.display = 'none';
              }
            }
          });

          tabManager.getTabs().forEach(function(tab) {
            var ace = tab.path && tab.editor.ace;
            var doc = tab.document, c9Session = tab.document.getSession();
            console.log('SETTING VALUE TO', doc.value);
            console.log('COMPARING TO', aceEditor._dropletEditor.getValue());

            if (doc.value !== aceEditor._dropletEditor.getValue()) {
              console.log('ACTUALLY SETTING VALUE TO', doc.value, aceEditor._dropletEditor.session.currentlyUsingBlocks);
              aceEditor._dropletEditor.setValueAsync(doc.value);
            }
          });

        });

        // Bind to mode changes
        aceEditor.getSession().on('changeMode', function(e) {
          if (aceEditor._dropletEditor.hasSessionFor(aceEditor.getSession())) {
            aceEditor._dropletEditor.setMode(lookupMode(aceEditor.getSession().$modeId), lookupModeOptions(aceEditor.getSession().$modeId));
            aceEditor._dropletEditor.setPalette(lookupPalette(aceEditor.getSession().$modeId));
          }
          else {
            var option = lookupOptions(aceEditor.getSession().$modeId);
            if (option != null) {
              aceEditor._dropletEditor.bindNewSession(option);
              button.style.display = 'block';
           }
            else {
              button.style.display = 'none';
            }
          }
        });

        // Bind to the associated resize event
        tabManager.getTabs().forEach(function(tab) {
          var ace = tab.path && tab.editor.ace;
          if (ace == aceEditor && tab.editorType == 'ace') {
            tab.editor.on('resize', function() {
              dropletEditor.resize();
            });
          }
        });
      }

      function lookupOptions(mode) {
        if (mode in OPT_MAP) {
          var result = OPT_MAP[mode];
          result.textModeAtStart = !useBlocksByDefault;
          return result;
        }
        else {
          return null;
        }
      }

      function lookupMode(id) {
        return (OPT_MAP[id] || {mode: null}).mode;
      }
      function lookupModeOptions(id) {
        return (OPT_MAP[id] || {mode: null}).modeOptions;
      }
      function lookupPalette(id) {
        return (OPT_MAP[id] || {palette: null}).palette;
      }

    }

    function detachFromAce(ace) {

    }

    plugin.on("resize", function() {
      alert('hello');
    })

    /***** Lifecycle *****/

    plugin.on("load", function() {
      load();
    });
    plugin.on("unload", function() {
      unload();
    });

    /***** Register and define API *****/

    plugin.freezePublicAPI({

    });

    register(null, {
      "c9.ide.cs50.droplet": plugin
    });
  }
});
