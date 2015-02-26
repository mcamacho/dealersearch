/*global jQuery, Modernizr, _*/
/* zipcoderadius module - mKlib library
  zipcode and radius module controller 
*/
var mKlib = mKlib || {};
mKlib.ziprad = (function(window) {
  "use strict";
  // public object
  var ziprad = {};
  // model object
  ziprad.gl = {
    radius: "",
    zipcode: ""
  };
  // private variables
  var config = {
    focusObj: {
      hideClass: ".after-location",
      modalLayer: "<div class='reveal-modal-bg' style='display: block;'></div>",
      alertText: "Enter Zip Code to Continue"
    },
    formElement: {
      wrapper: "#location",
      radiusDefault: 50
    },
    geoOptions: {
      maximumAge: Infinity,
      timeout: 10000,
      enableHighAccuracy: true
    }
  },
  formElement = {
    zipcode: "#zipcode",
    radius: "#radius",
    radiusTxt: "#radius-text"
  };

  // change the view to focus on the zipcode field to be user filled
  function focusonZipfield() {
    var cfc = config.focusObj;
    // hide hideclass blocks 
    jQuery(cfc.hideClass).hide();
    // append to body tag semi transparent black layer between all (background) and the input fields form block
    jQuery("body").append(cfc.modalLayer);
    // modify #location form layout to display over everything else, and display label text
    jQuery(config.formElement.wrapper).addClass("alert").append("<p style='text-align: center; padding-top: 0.5em; margin: 0;'>" + cfc.alertText + "</p>");
  }
  // change the view to blur from the zipcode field
  function blurZipfield() {
    var cfc = config.focusObj;
    // show hideclass blocks 
    jQuery(cfc.hideClass).show();
    // append to body tag semi transparent black layer between all (background) and the input fields form block
    jQuery(".reveal-modal-bg").remove();
    // modify #location form layout to display over everything else, and display label text
    jQuery(config.formElement.wrapper).removeClass("alert").find("p:contains(" + cfc.alertText + ")").remove();
  }

  function uiController() {
    var time = 0,
      cfr = config.formElement,
      fre = formElement,
      radiusReg = new RegExp("^\\d{2,4}$"),
      zipcodeReg = new RegExp("^\\d{5}$");

    function changeField(blockId, inputReg) {
      var bId = jQuery(blockId);
      var value = bId.val();
      if (!("noUiSlider" in window) && Modernizr.inputtypes.range) {
        // clone range input field value to next sibling
        bId.next("input").val(value);
        // clear timeOut handler if still changing
        clearTimeout(time);
        time = setTimeout(function() {
          if (inputReg.test(value)) {
            updateField(blockId.slice(1), value, "user");
          }
        }, 250);
      } else {
        if (inputReg.test(value)) {
          updateField(blockId.slice(1), value, "user");
        }
      }
    }

    // initialice noUiSlider
    initSlider({
      slider: formElement.radius,
      sliderTxt: formElement.radiusTxt
    }, ziprad.gl.radius !== "" ? parseInt(ziprad.gl.radius, 10) : config.formElement.radiusDefault);

    jQuery(cfr.wrapper)
      .on("change", fre.zipcode, function() {
        changeField(fre.zipcode, zipcodeReg);
      })
      .on("change", fre.radius, function() {
        changeField(fre.radius, radiusReg);
      })
      // click event to trigger the change event FF issue 
      .on("click", "input.range", function() {
        if (!("noUiSlider" in window) && Modernizr.inputtypes.range)
          jQuery(this).trigger("change");
      })
      // 'enter' keypress event to trigger the change event
      .on("keypress", "input", function(e) {
        if (e.which === 13) {
          jQuery(this).trigger("change");
        }
      });
  }

  function updateModel (key, value, initiator) {
    ziprad.gl[key] = value;
    if (initiator !== "field") {
      updateField(key, value, "model");
    }
    if (initiator !== "hash") {
      updateHash(key, value);
    }
    if (initiator !== "cookie") {
      mKlib.cookieDb.setDb(key, value);
    }

    if (!_.isEmpty(ziprad.gl.zipcode) && !_.isEmpty(ziprad.gl.radius)) {
      // use callback handler if initiator equals to field - that is user values interaction
      if (initiator === "field") {
        ziprad.handler();
      }
      // call init function if initiator equals to cookie or hash
      else if (initiator === "cookie" || initiator === "hash") {
        if (jQuery(config.formElement.wrapper).hasClass("alert"))
          blurZipfield();
        ziprad.initfn();
      }
    }
  }

  function updateField(key, value, initiator) {
    var fieldEle = jQuery(formElement[key]);
    fieldEle.val(value);
    if (fieldEle.next("input").length > 0)
      fieldEle.next("input").val(value);
    if (initiator === "user")
      updateModel(key, value, "field");
  }

  function updateHash(key, value) {
    var hashObj = mKlib.router.getHashObj() || {};
    var tempObj = {};
    tempObj[key] = value;
    mKlib.router.setHash(_.extend(hashObj, tempObj));
  }


  // ajax call to get the postal code based on lat & lon values
  function reverseGeo(position) {
    var urlPath = "http://api.geonames.org/findNearbyPostalCodesJSON?lat=" + position.coords.latitude + "&lng=" + position.coords.longitude + "&username=macamanga";
    jQuery.get(urlPath, function(data) {
      // update zipcode cookie and model values with default value
      mKlib.cookieDb.setDb("zipcode", data.postalCodes[0].postalCode);
      updateModel("zipcode", data.postalCodes[0].postalCode, "cookie");
      defaultLoad();
    }).fail(function() {
      defaultLoad();
    });
  }

  // check for zipcode and radius cookies, geolocation
  function defaultLoad() {
    var mK = mKlib.cookieDb,
      zipcookie = mK.getDb("zipcode"),
      radiuscookie = mK.getDb("radius");
    // check for zipcode and radius cookies
    if (_.isEmpty(zipcookie) || _.isEmpty(radiuscookie)) {
      // call for layout focus on form input fields
      focusonZipfield();
      // update radius cookie and model values with default value
      mK.setDb("radius", config.formElement.radiusDefault);
      updateModel("radius", config.formElement.radiusDefault, "cookie");
      // call for geolocation method or the user to solve the zipcode value
      if (Modernizr.geolocation) {
        window.navigator.geolocation.getCurrentPosition(reverseGeo, function() {
          // if error, iterate again
          defaultLoad();
        }, config.geoOptions);
      }
    }
    // assign cookies to gl object and run app
    else {
      updateModel("zipcode", zipcookie, "cookie");
      updateModel("radius", radiuscookie, "cookie");
    }
  }

  // init radius noUiSlider
  function initSlider(blockObj, startVal) {
    var maxRange = 500;
    if (startVal > 500)
    // var maxRange = 150;
    // if (startVal > 150)
      maxRange = startVal;
    jQuery(blockObj.slider).noUiSlider({
      range: [25, maxRange],
      start: startVal,
      step: 25,
      handles: 1,
      behaviour: "extend-tap",
      serialization: {
        to: [jQuery(blockObj.sliderTxt), "html"],
        resolution: 1
      }
    });
  }

  // ------------------ public methods
  ziprad.init = function(handler, initfn, customconfig) {
    // callback handler to be used when gl model is modified
    ziprad.handler = handler || function() { window.alert("location values modified by user"); };
    ziprad.initfn = initfn || function() { window.alert("ready to run the main app"); };
    // extend default config with custom one 
    if (customconfig)
      _.extend(config, customconfig);

    // check for URL location hash object
    var hashObj = mKlib.router.getHashObj();
    if (_.isEmpty(hashObj)) {
      defaultLoad();
    }
    // evaluate the URL location hash object
    else {
      // if radius and zipcode are included on the hash
      if (Object.prototype.hasOwnProperty.call(hashObj, "radius") && Object.prototype.hasOwnProperty.call(hashObj, "zipcode")) {
        // radius and zipcode validation
        var radiusHash = /^\d{2,4}$/.test(hashObj.radius) ? hashObj.radius : "";
        var zipcodeHash = /^\d{5}$/.test(hashObj.zipcode) ? hashObj.zipcode : "";
        if (_.isEmpty(radiusHash) || _.isEmpty(zipcodeHash)) {
          // remove radius and zipcode keys from the hash query
          mKlib.router.setHash(_.omit(hashObj,["radius", "zipcode"]));
          defaultLoad();
        }
        // remove invalid zipcode and radius from the hash string and replace window location
        else {
          // use location hash to update gl model
          updateModel("zipcode", zipcodeHash, "hash");
          updateModel("radius", radiusHash, "hash");
        }
      } else {
        defaultLoad();
      }
    }
    // initialize the UI set of controls
    uiController();
  };

  return ziprad;
})(window);