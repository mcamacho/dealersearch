/*global console*/
/* clientDb module - mKlib library
   indexedDb client database feature required
*/
var mKlib = mKlib || {};
mKlib.clientDb = (function (window) {
    "use strict";
    // verify device feature
    if (!Boolean("indexedDB" in window)) return {
        feature: false
    };
    // create indexedDb Object
    var idb = {};
    // other variables
    var datastore = null;
    var dbName = "dealerx-vehicle-db";
    var dbVersion = 1;
    idb.setup = {
        roof: {
            store: "roof",
            keyPath: "id",
            keys: ["dealer_name", "dealer_city", "dealer_state", "dealer_zip", "dealer_region"]
        },
        vehicles: {
            store: "vehicles",
            keyPath: "vin",
            keys: ["id", "make", "model", "standard_body", "year"]
        }
    };
    idb.feature = true;
    idb.openDb = function (callback) {
        var req = window.indexedDB.open(dbName, dbVersion);
        req.onupgradeneeded = function (evt) {
            for (var newstore in idb.setup) {
                var keys = idb.setup[newstore].keys;
                var keypathobj = {
                    keyPath: idb.setup[newstore].keyPath
                };
                var setstore = evt.target.result.createObjectStore(idb.setup[newstore].store, keypathobj);
                for (var i = keys.length - 1; i >= 0; i--) {
                    setstore.createIndex(keys[i], keys[i], {
                        unique: false
                    });
                }
            }
            console.log("openDb.onupgradeneeded");
        };
        req.onsuccess = function (evt) {
            datastore = evt.target.result;
            callback();
            console.log("openDb DONE");
        };
        req.onerror = function (evt) {
            console.error("openDb:", evt.target.errorCode);
        };
    };

    idb.fetchDb = function (callback, store, keyArray, indexKey) {
        // Get a reference to the db.
        var db = datastore;
        // Initiate a new transaction.
        var transaction = db.transaction([store], "readonly");
        // Get the datastore.
        var objStore = transaction.objectStore(store);
        var cursorRequest;
        var objArray = [];

        function successArray(evt) {
            var result = evt.target.result;
            if (result) {
                objArray.push(result);
                console.log("obj fetch");
            }
        }
        // when multiple keys are requested
        if (keyArray) {
            for (var i = keyArray.length - 1; i >= 0; i--) {
                cursorRequest = objStore.get(keyArray[i]);
                cursorRequest.onsuccess = successArray;
            }
        }
        // get whole list
        else if (indexKey) {
            var index = objStore.index(indexKey);
            cursorRequest = index.openCursor();
        }
        // get whole list
        else {
            cursorRequest = objStore.openCursor();
        }
        transaction.oncomplete = function () {
            // Execute the callback function.
            console.log("ends fetch");
            callback(objArray);
        };
        cursorRequest.onerror = idb.onerror;
    };

    idb.pushDb = function (callback, store, objArray, expiration) {
        // Get a reference to the db.
        var db = datastore;
        // Initiate a new transaction.
        var transaction = db.transaction([store], "readwrite");
        // Get the datastore.
        var objStore = transaction.objectStore(store);
        // Create the datastore request.
        var request;
        var counter = 0;

        function successArray() {
            // Execute the callback function.
            counter++;
            console.log("obj push");
        }
        console.log(objArray);
        for (var i = objArray.length - 1; i >= 0; i--) {
            objArray[i].expiration = expiration;
            request = objStore.put(objArray[i]);
            request.onsuccess = successArray;
            request.onerror = idb.onerror;
        }
        transaction.oncomplete = function () {
            // Execute the callback function.
            console.log("ends push");
            callback(counter);
        };
    };

    idb.onerror = function () {
        console.log("error");
    };

    // public methods
    return idb;
}(window));
// disable clientDb temporaly
mKlib.clientDb.feature = false;
/*global jQuery, console, mKlib, PubSub, _*/
/* controller module
 */
var vehicleSearch = (function (mo) {
    "use strict";
    mo.controller = {
        mo: mo,
        // check user pref stored on the client
        checkUserPref: function () {
            var currentSession = mKlib.localDb.sesGetDb("user");
            if (_.isEmpty(currentSession)) return {};
            return currentSession;
        },
        // store user pref on the client
        storeUserPref: function () {
            if (mKlib.localDb.feature) {
                var sessionObj = {
                    vpp: {
                        sel: mo.config.vpp.sel
                    },
                    sort: {
                        direction: mo.view.sort.direction,
                        category: mo.view.sort.category
                    }
                };
                mKlib.localDb.sesSetDb("user", sessionObj);
            }
        },
        // check for session stored on the client
        checkSession: function () {
            if (mKlib.localDb.feature) {
                var currentSession = mKlib.localDb.sesGetDb(mKlib.ziprad.gl.zipcode);
            } else {
                currentSession = {};
            }
            if (_.isEmpty(currentSession) || currentSession.expiration < mo.config.currentDate) return {};
            var sessionObj = {};
            var radius = parseInt(mKlib.ziprad.gl.radius, 10);
            if (parseInt(currentSession.radius, 10) >= radius) {
                sessionObj = _.filter(currentSession.dealerIds, function (ele) {
                    return parseFloat(ele.distance) <= radius;
                });
            }
            return sessionObj;
        },
        // store session on the client
        storeSession: function () {
            if (mKlib.localDb.feature) {
                var sessionObj = {};
                sessionObj.radius = mKlib.ziprad.gl.radius;
                sessionObj.expiration = mo.config.currentDate + (1000 * 60 * 60);
                sessionObj.dealerIds = mo.model.dealer.collection;
                mKlib.localDb.sesSetDb(mKlib.ziprad.gl.zipcode, sessionObj);
            }
        },
        // mediator - extend object data for the ajax call
        callData: function (dataObj, eventName) {
            // extend basic request with required data
            var objRequest = jQuery.extend({}, mo.config.basicRequest, dataObj);
            // publish the ajax request
            PubSub.publish(eventName, jQuery.ajax(objRequest));
        },
        // broadcast for ajax calls - callbacks _processRoof _processList
        responseCall: function (event, response) {
            if (event === "loadRoof") {
                response.done(function (data) {
                    mo.model.processRoof(data, true);
                });
            } else if (event === "loadList") {
                response.done(function (data) {
                    mo.model.processList(data);
                });
            } else if (event === "loadPreview") {
                response.done(function (data) {
                    mo.view.preview(data[0]);
                });
            }
            response.fail(function () {
                console.log(arguments[2]);
            });
        },
        // control flow after ajax response data has been cached on model
        cacheModel: function (event, obj) {
            if (obj.cached) {
                if (event === "cacheRoof") {
                    mo.controller.checkStoreList(mo.model.dealer.idsArray);
                } else if (event === "checkLocal") {
                    mo.controller.defineVehicleReq(obj.collection);
                } else if (event === "cacheVehicle") {
                    mo.controller.extendDistance();
                    mo.controller.verifyHash();
                    mo.model.setCollections();
                    mo.controller.initSliderMenu();
                    mo.controller.setStore(obj.collection);
                } else if (event === "cacheCollections") {
                    mo.controller.publishView();
                } else if (event === "cacheFilter") {
                    mo.controller.updateHash();
                    mo.controller.updateHashSliders();
                    mo.model.setCollections();
                }
            }
        },
        // using the notStored Ids array construct the ajax call data
        defineVehicleReq: function (idsArray) {
            var idRequest = {
                data: {}
            };
            idRequest.data[mo.config.dealerId] = _.map(idsArray, function (ele) {
                return ele.slice(0, ele.indexOf("-"));
            }).toString();
            var vehicleRequest = jQuery.extend(true, {}, mo.config.vehicleRequest, idRequest);
            this.callData(vehicleRequest, "loadList");
        },
        // publish renderLayout to mediator controller
        publishView: function () {
            // call renderlayout publish 
            PubSub.publish("renderLayout", {
                categories: mo.model.vehicle.category,
                list: mo.model.vehicle.collection,
                page: mo.view.page
            });
        },
        // check store list using localStorage method
        checkStoreList: function (idsArray) {
            if (!mKlib.localDb.feature) {
                PubSub.publish("checkLocal", {
                    cached: true,
                    collection: idsArray
                });
                return false;
            }
            // index - object - with key: id, value: expiration
            var localIndex = mKlib.localDb.localIndex = mKlib.localDb.getDb("index-" + mo.config.vehicleRequest.data.type);
            // cache array of keys not stored on local
            var unfound = _.difference(idsArray, _.keys(localIndex));
            // remaining keys to check expiration
            var tocheck = _.difference(idsArray, unfound);
            // check if any item is expired or unfound
            var expired = _.filter(tocheck, function (id) {
                return localIndex[id] < mo.config.currentDate;
            });
            var toload = _.union(unfound, expired);
            // get the local stored objects and cache on model
            mo.model.getStoredList(_.difference(idsArray, toload), toload);
        },
        // set store list based on loaded data
        setStore: function (objArray) {
            if (_.isEmpty(objArray) || !mKlib.localDb.feature) return false;
            var indexObject = {}, idGroup = _.groupBy(objArray, "id"),
                vehType = "-" + mo.config.vehicleRequest.data.type;
            for (var id in idGroup) {
                mKlib.localDb.setDb(id + vehType, idGroup[id]);
                indexObject[id + vehType] = mo.config.currentDate + mo.config.expTime;
            }
            mKlib.localDb.setDb("index" + vehType, _.extend(mKlib.localDb.localIndex, indexObject));
        },
        // check the filter obj so it will work with the current vehicle collection
        verifyHash: function () {
            // if specific hash item query doesn't returns result remove from the hash string
            // else assign the hash object to the model filter object
            var filterEle = {}, response;
            var hashObj = mKlib.router.getHashObj();
            if (_.isEmpty(hashObj)) {
                mo.model.init = true;
                return false;
            }
            var oldObj = _.clone(hashObj);

            function rangeFind(ele) {
                var rangeArray = filterEle[filter].split(",");
                var eleValue = ele[filter] === "N/A" || ele[filter] === "Call" ? 0 : parseInt(ele[filter].replace(",", ""), 10);
                if (eleValue < parseInt(rangeArray[0], 10) || eleValue > parseInt(rangeArray[1], 10)) return false;
                else return true;
            }
            for (var filter in hashObj) {
                if (filter !== "zipcode" && filter !== "radius" && filter !== "page") {
                    // set a temporal obj with one of the key-value pairs
                    filterEle[filter] = hashObj[filter];
                    // check on each of the filters for key-value apearence 
                    response = hashObj[filter].indexOf(",") < 0 ? _.findWhere(mo.model.vehicle.collectionAll, filterEle) : _.find(mo.model.vehicle.collectionAll, rangeFind);
                    // if nothing found clean the model filter obj
                    if (response === undefined) hashObj = _.omit(hashObj, filter);
                    filterEle = {};
                } else if (filter === "page") {
                    // assign to page property the hash page value
                    mo.view.page = parseInt(hashObj[filter], 10);
                }
            }
            // set model filter if hash obj is ok
            if (_.isEqual(oldObj, hashObj)) {
                // create a filter array list, including nonfilters and range filters
                var keyList = (function () {
                    var list = ["zipcode", "radius", "page"];
                    for (var filter in oldObj) {
                        if (oldObj[filter].indexOf(",") > 0) {
                            list.push(filter);
                            // cache filter slider data
                            mo.view.hashSliders[filter] = oldObj[filter];
                        }
                    }
                    return list;
                }());
                // create the object for the nonfilters and range filters
                var otherHash = _.pick(oldObj, keyList);
                // check the complete filter, without zipcode and radius
                oldObj = _.omit(oldObj, keyList);
                if (_.isEmpty(oldObj)) {
                    mo.model.init = true;
                    return false;
                }
                response = _.findWhere(mo.model.vehicle.collectionAll, oldObj);
                if (response !== undefined) {
                    mo.model.init = true;
                    mo.model.filter = _.clone(oldObj);
                } else {
                    mKlib.router.setHash(otherHash);
                }
            }
            // clean the hash
            else {
                mKlib.router.setHash(hashObj);
                // window.location.reload(true);
            }
        },
        // update hash
        updateHash: function () {
            var otherHash = _.pick(mKlib.router.getHashObj(), "zipcode", "radius", "page");
            mKlib.router.setHash(_.extend(otherHash, mo.model.filter));
        },
        // update hashSlider
        updateHashSliders: function () {
            mo.view.hashSliders = {};
            for (var filter in mo.model.filter) {
                if (mo.model.filter[filter].indexOf(",") > 0) {
                    mo.view.hashSliders[filter] = mo.model.filter[filter];
                }
            }
        },
        // get vehicle preview
        getVehicle: function (vin) {
            var vehicleRequest = {};
            vehicleRequest.data = {
                api: "true",
                f: "json",
                vin: vin,
                k: "id,vin,year,make,model,trim,standard_body,price,mileage,transmission,stock,engine,fuel_type,type,exterior_color,image_list,stat"
            };
            this.callData(vehicleRequest, "loadPreview");
        },
        // initialize noUiSlider using the vehicle Collection
        initSliderMenu: function () {
            // get the categories where slider: true
            var sliderCat = _.where(mo.config.categories, {
                slider: true
            });
            // collect max and min values from the vehicle Collection for the categories
            var basicInit = {
                connect: true,
                step: 1000,
                behaviour: "extend-tap"
            };
            var max, min;

            function dbIdVal(vehicle) {
                if (vehicle[sliderCat[cat].dbId] === "N/A" || vehicle[sliderCat[cat].dbId] === "Call") return 0;
                var elValue = parseInt(vehicle[sliderCat[cat].dbId].replace(",", ""), 10);
                return elValue;
            }

            function labelMin() {
                if (arguments[0].length > 3) arguments[0] = arguments[0].replace(/(\d{3})$/, ",$1");
                jQuery("#" + this.attr("id") + "-min").text(arguments[0]);
            }

            function labelMax() {
                if (arguments[0].length > 3) arguments[0] = arguments[0].replace(/(\d{3})$/, ",$1");
                jQuery("#" + this.attr("id") + "-max").text(arguments[0]);
            }
            // based on the Id and label from the categories insert the DOM object
            for (var cat in sliderCat) {
                max = _.max(mo.model.vehicle.collectionAll, dbIdVal);
                min = _.min(mo.model.vehicle.collectionAll, dbIdVal);
                max = parseInt(max[sliderCat[cat].dbId].replace(",", ""), 10);
                min = min[sliderCat[cat].dbId] === "N/A" || min[sliderCat[cat].dbId] === "Call" ? 0 : parseInt(min[sliderCat[cat].dbId].replace(",", ""), 10);
                basicInit.range = [min, max];
                basicInit.start = [min, max];
                basicInit.step = sliderCat[cat].step || basicInit.step;
                basicInit.serialization = {
                    to: [
                        [jQuery("#" + sliderCat[cat].dbId + "-min"), labelMin],
                        [jQuery("#" + sliderCat[cat].dbId + "-max"), labelMax]
                    ],
                    resolution: 1
                };
                jQuery("#" + sliderCat[cat].dbId).noUiSlider(basicInit, true);
                // cache values on mo.view.sliders
                mo.view.sliders[sliderCat[cat].dbId] = min.toString() + "," + max.toString();
            }
            if (!_.isEmpty(mo.view.hashSliders)) mo.view.setSliders();
        },
        // extend with distance the vehicleCollectionAll 
        extendDistance: function () {
            mo.model.vehicle.collectionAll = _.map(mo.model.vehicle.collectionAll, function (obj) {
                var ele = _.find(mo.model.dealer.distance, {
                    id: obj.id
                });
                var distance = _.has(ele, "distance") ? ele.distance : "0";
                return _.extend(obj, {
                    distance: distance
                });
            });
        },
        // initialize query field with the vehicle collection Data
        runQueryField: function (query) {
            var queryF = query.toLowerCase();
            var founded = false;
            if (queryF !== "") {
                // find the category
                for (var cat in mo.model.vehicle.categoryAll) {
                    if (_.has(mo.model.vehicle.categoryAll[cat], queryF)) {
                        founded = true;
                        mo.model.filter = {};
                        mo.model.updateFilter({
                            key: cat,
                            value: mo.model.vehicle.categoryAll[cat][queryF]
                        });
                        break;
                    }
                }
            } else {
                mo.model.filter = {};
            }
            var queryBlock = jQuery(mo.config.queryBlock).find("span").hide().end();
            if (founded) queryBlock.find(".success").show();
            else queryBlock.find(".nosuccess").show();
            if (queryF === "") PubSub.publish("cacheFilter", {
                cached: true
            });
        }
    };
    mo.controllerDB = {
        // control flow after ajax response data has been cached on model
        cacheModel: function (event, obj) {
            if (obj.cached) {
                var expiration = mo.config.currentDate + mo.config.expTime;
                if (event === "cacheRoof") {
                    mKlib.clientDb.fetchDb(mo.controller.compareStoredKeys, mKlib.clientDb.setup.roof.store, mo.model.dealer.idsArray);
                    mKlib.clientDb.pushDb(function (resp) {
                        console.log("roof" + resp);
                    }, mKlib.clientDb.setup.roof.store, mo.model.dealer.collection, expiration);
                } else if (event === "cacheVehicle") {
                    // mKlib.clientDb.fetchDb(mo.controller.checkStoreList, mKlib.clientDb.setup.vehicle.store, mo.model.dealer.idsArray);
                    mKlib.clientDb.pushDb(function (resp) {
                        console.log("vehicles" + resp);
                    }, mKlib.clientDb.setup.vehicles.store, mo.model.vehicle.collection, expiration);
                }
            } else {
                console.log("no cached model");
            }
        },
        // rooftop storage ---------------------------------
        // logic function to get cacheRoof
        compareStoredKeys: function (objStored) {
            console.log(objStored);
            if (objStored) {
                var nonexpiredObj = _.filter(objStored, function (ele) {
                    return ele.expiration > mo.config.currentDate;
                });
                var nonexpiredIds = _.pluck(nonexpiredObj, "id");
                var toloadIds = _.difference(mo.model.dealer.idsArray, nonexpiredIds);
                if (toloadIds.length > 0) mo.controller.defineVehicleReq(toloadIds);
            } else {
                mo.controller.defineVehicleReq(mo.model.dealer.idsArray);
                console.log("no data stored - request all dealerIds data and vehicle lists");
            }
        }
    };
    if (mKlib.clientDb.feature) _.extend(mo.controller, mo.controllerDB);

    return mo;
}(vehicleSearch || {}));
/* cookie module - mKlib library
   get, store and other methods for client cookies. 
*/
var mKlib = mKlib || {};
mKlib.cookieDb = (function (document) {
    "use strict";
    // create cdb Object
    var cdb = {},
    currentTime = new Date().getTime(),
        cookieExp = 1000 * 60 * 60 * 24;

    cdb.setDb = function (key, value) {
        document.cookie = key + "=" + value + ";path=/;expires=" + new Date(currentTime + cookieExp).toUTCString();
    };

    cdb.getDb = function (value) {
        return document.cookie.replace(new RegExp("(?:(?:^|.*;\\s*)" + value + "\\s*\\=\\s*([^;]*).*$)|^.*$"), "$1") || "";
    };

    cdb.setExpiration = function (time) {
        if (typeof time === "number") cookieExp = time;
    };

    return cdb;
}(document));
/*global _, console*/
/* helper module
 */
var vehicleSearch = (function (mo) {
    "use strict";
    mo.helper = {
        mo: mo,
        cleanData: function (dataString) {
            var dataArray = dataString.slice(1).split(",");
            for (var i = dataArray.length - 1; i >= 0; i--) {
                if (dataArray[i].match(/"{1}/g).length > 4) {
                    var lastQuote = dataArray[i].indexOf("\"", dataArray[i].indexOf("\"", dataArray[i].indexOf(":")) + 1) + 1;
                    dataArray[i] = dataArray[i].slice(0, lastQuote);
                }
            }
            return dataArray.join();
        },
        // custom json parsing of ajax data response 
        jsonEleParse: function (dataString) {
            if (dataString === "") {
                return [];
            }
            var response;
            try {
                response = JSON.parse("[" + dataString.slice(1) + "]");
            } catch (e) {
                response = this.cleanData(dataString);
                response = JSON.parse("[" + response + "]");
                console.log(e);
            }
            return response;
        },
        // collection helper
        orderBy: function (list, sort) {
            var tempList;
            tempList = _.sortBy(list, function (ele) {
                var elesort = ele[sort.category] === "Call" || ele[sort.category] === "N/A" ? "0" : ele[sort.category];
                elesort = /^[0-9,.]*$/.test(elesort) ? parseInt(elesort.replace(",", ""), 10) : elesort;
                return _.isNumber(elesort) ? elesort : elesort.toLowerCase();
            });
            if (sort.direction === "dsc") {
                tempList = tempList.reverse();
            }
            return tempList;
        },
        // set search categories collection 
        setSearchCat: function (data, objarray) {
            var collection = {};
            var tempArray;
            for (var i = objarray.length - 1; i >= 0; i--) {
                if (objarray[i].indexOf(":") < 0) {
                    tempArray = _.uniq(_.pluck(data, objarray[i]));
                    var tempObj = {};
                    for (var y = tempArray.length - 1; y >= 0; y--) {
                        tempObj[tempArray[y].toLowerCase()] = tempArray[y];
                    }
                    collection[objarray[i]] = tempObj;
                }
            }
            return collection;
        },
        // set list of categories from a collection
        setCategories: function (data, objarray) {
            var values = [],
                valueGroups = {},
                category = {};

            function itself(it) {
                return it;
            }

            function objectArray(value, key) {
                return {
                    "vLabel": key,
                        "label": key,
                        "count": value
                };
            }

            function pairArray(element) {
                var dealerObj;
                var pairs = objarray[i].pair;
                for (var ii = pairs.length - 1; ii >= 0; ii--) {
                    dealerObj = _.find(mo.model.dealer[pairs[ii].group], {
                        "id": element.label
                    });
                    if (_.has(dealerObj, pairs[ii].getKey)) {
                        element[pairs[ii].setKey] = dealerObj[pairs[ii].getKey];
                    } else {
                        element[pairs[ii].setKey] = "0";
                    }
                }
                return element;
            }

            function pairFloat(ele) {
                return parseFloat(ele.distance.replace(",", ""));
            }
            for (var i = objarray.length - 1; i >= 0; i--) {
                if (objarray[i].menu) {
                    values = _.pluck(data, objarray[i].dbId);
                    valueGroups = _.countBy(values, itself);
                    valueGroups = _.map(valueGroups, objectArray);
                    if (objarray[i].pair) {
                        valueGroups = _.map(valueGroups, pairArray);
                        category[objarray[i].dbId] = _.sortBy(valueGroups, pairFloat);
                    } else {
                        category[objarray[i].dbId] = _.sortBy(valueGroups, "label");
                    }
                }
            }
            return category;
        },
        // get group
        getGroup: function (filterList, page) {
            var groupFilter = filterList;
            for (var i = 0; i < (page - 1); i++) {
                groupFilter = _.rest(groupFilter, mo.config.vpp.opt[mo.config.vpp.sel]);
            }
            groupFilter = _.first(groupFilter, mo.config.vpp.opt[mo.config.vpp.sel]);
            return groupFilter;
        },
        // verify image
        verifyImage: function (list) {
            for (var i = list.length - 1; i >= 0; i--) {
                if (list[i].image_1 === "") {
                    list[i].image_1 = mo.config.noImagePath;
                }
            }
            return list;
        }
    };
    return mo;
}(vehicleSearch || {}));
/*global _*/
/* localDb module - mKlib library
   using localStorage or sessionStorage, store data received from server. 
*/
var mKlib = mKlib || {};
mKlib.localDb = (function (window) {
    "use strict";
    // create ldb Object
    var ldb = {}, _localStorage;
    // verify device feature
    try {
        _localStorage = window.localStorage;
        ldb.feature = _localStorage !== undefined ? true : false;
    } catch (e) {
        return {
            feature: false
        };
    }

    ldb.scopeName = "mk";
    ldb.setDb = function (key, obj) {
        var value = JSON.stringify(obj);
        _localStorage.setItem(ldb.scopeName + "-" + key, value);
    };

    ldb.getDb = function (request) {
        var value = _localStorage.getItem(this.scopeName + "-" + request);
        value = JSON.parse(value || "{}");
        return value;
    };

    ldb.getCollection = function (idsArray) {
        var collection = [];
        for (var i = idsArray.length - 1; i >= 0; i--) {
            collection.push(ldb.getDb(idsArray[i]));
        }
        return _.flatten(collection);
    };

    ldb.sesSetDb = function (key, obj) {
        var value = JSON.stringify(obj);
        sessionStorage.setItem(ldb.scopeName + "-" + key, value);
    };

    ldb.sesGetDb = function (request) {
        var value = sessionStorage.getItem(this.scopeName + "-" + request);
        value = JSON.parse(value || "{}");
        return value;
    };

    return ldb;
}(window));
/*global mKlib, PubSub, _*/
/* model module
 */
var vehicleSearch = (function (mo) {
    "use strict";
    mo.model = {
        mo: mo,
        init: false,
        // dealer and vehicle objects
        dealer: {},
        vehicle: {},
        filter: {},
        // reset dealer and list objects
        reset: function () {
            this.dealer = {};
            this.vehicle = {};
            this.filter = {};
        },
        // process the data received from the ajax roof call
        processRoof: function (data, storeOpt) {
            // cache id-distance object, dealer Ids array and dealers collection
            this.dealer.distance = this.dealer.collection = data;
            this.dealer.idsArray = _.map(_.pluck(data, "id"), function (ele) {
                return ele + "-" + mo.config.vehicleRequest.data.type;
            });
            // store session
            if (storeOpt) {
                mo.controller.storeSession();
            }
            // publish cacheModel Ready
            var cacheModel = {
                cached: this.dealer.idsArray.length > 0 && this.dealer.collection !== ""
            };
            PubSub.publish("cacheRoof", cacheModel);
        },
        // get object collection from localStorage 
        getStoredList: function (idsArray, toload) {
            // cache vehicle collection
            this.vehicle.collectionAll = mKlib.localDb.getCollection(idsArray);
            // join the unfound and expired arrays
            if (toload.length > 0) PubSub.publish("checkLocal", {
                cached: true,
                collection: toload
            });
            else PubSub.publish("cacheVehicle", {
                cached: true,
                collection: []
            });
        },
        // process the data received from the ajax list call
        processList: function (data) {
            // cache vehicle collection
            // var collection = _.toArray(data);
            var collection = data;
            this.vehicle.collectionAll = this.vehicle.collectionAll ? _.union(this.vehicle.collectionAll, collection) : collection;
            // publish cacheModel Ready
            var cacheModel = {
                cached: this.vehicle.collectionAll.length > 0,
                collection: collection
            };
            PubSub.publish("cacheVehicle", cacheModel);
        },
        // setCollections
        setCollections: function () {
            var rangeFilter = {}, filter = _.clone(this.filter),
                rangeCollection;
            // create vehicle categoryAll
            this.vehicle.categoryAll = mo.helper.setSearchCat(this.vehicle.collectionAll, mo.config.searchCategories);
            // separate model filter in rangeFilter and filter objects
            _.each(filter, function (value, key) {
                if (value.indexOf(",") > 0) {
                    rangeFilter[key] = value;
                    filter = _.omit(filter, key);
                }
            });
            // assign to rangeCollection, using the filter
            rangeCollection = _.isEmpty(rangeFilter) ? _.clone(this.vehicle.collectionAll) : _.filter(this.vehicle.collectionAll, function (ele) {
                var rangeArray, eleValue;
                for (var filter in rangeFilter) {
                    rangeArray = rangeFilter[filter].split(",");
                    eleValue = ele[filter] === "N/A" || ele[filter] === "Call" ? 0 : parseInt(ele[filter].replace(",", ""), 10);
                    if (eleValue < parseInt(rangeArray[0], 10) || eleValue > parseInt(rangeArray[1], 10)) return false;
                }
                return true;
            });
            this.vehicle.collection = _.isEmpty(filter) ? rangeCollection : _.where(rangeCollection, filter);
            // sort by selected category
            if (mo.view.sort.category !== "price") this.vehicle.collection = mo.helper.orderBy(this.vehicle.collection, {
                direction: mo.view.sort.direction,
                category: "price"
            });
            this.vehicle.collection = mo.helper.orderBy(this.vehicle.collection, mo.view.sort);
            // create list collections based on the config categories
            this.vehicle.category = mo.helper.setCategories(this.vehicle.collection, mo.config.categories);
            // publish cacheModel Ready
            var cacheModel = {
                cached: typeof this.vehicle.category === "object"
            };
            PubSub.publish("cacheCollections", cacheModel);
        },
        // update the filterQuery object array based on button key-value
        updateFilter: function (dataset) {
            if (!_.isArray(dataset.value) && _.has(this.filter, dataset.key)) {
                this.filter = _.omit(this.filter, dataset.key);
            } else if (_.isArray(dataset.value) && mo.view.sliders[dataset.key] === dataset.value) {
                this.filter = _.omit(this.filter, dataset.key);
            } else {
                this.filter[dataset.key] = dataset.value.toString();
            }
            // publish cacheModel Ready
            var cacheModel = {
                cached: typeof this.filter === "object"
            };
            PubSub.publish("cacheFilter", cacheModel);
        }
    };
    return mo;
}(vehicleSearch || {}));
/* router module - mKlib library
  library to get and set location history related to search
*/
var mKlib = mKlib || {};
mKlib.router = (function (window) {
    "use strict";
    // create router Object
    var router = {}, hash;
    router.popFeature = "onpopstate" in window;

    router.getHashObj = function () {
        hash = window.location.hash;
        if (hash.length === 0) return {};
        var hashObj = {}, hashArray = hash.split("/"),
            hashEle;
        for (var i = hashArray.length - 1; i >= 0; i--) {
            hashEle = hashArray[i].split("=");
            if (hashEle.length > 1) {
                hashObj[hashEle[0]] = hashEle[1];
            }
        }
        return hashObj;
    };

    router.setHash = function (obj) {
        var newHash = [];
        for (var key in obj) {
            newHash.push("/" + key + "=" + obj[key]);
        }
        window.location = "#" + newHash.join("");
    };

    return router;
}(window));
/*global jQuery, PubSub, _, mKlib*/
/* view module
 */
var vehicleSearch = (function (mo) {
    "use strict";
    mo.view = {
        mo: mo,
        // sort list direction and category
        sort: {
            direction: "dsc",
            category: ""
        },
        // page attribute
        page: 1,
        // sliders init values
        sliders: {},
        hashSliders: {},
        // setDisplay
        setDisplay: function () {
            if (arguments[1].list.length !== 0) {
                var groups = Math.ceil(arguments[1].list.length / mo.config.vpp.opt[mo.config.vpp.sel]);
                mo.view.displayNav(arguments[1].categories);
                mo.view.displayPagination(groups);
                mo.view.displayResults(arguments[1].list, arguments[1].page, groups === 1 ? false : true);
                mo.view.updateSliders();
                PubSub.publish("sortDisplayed", mo.model.vehicle.category);
            } else {
                jQuery(mo.config.listBlock).html("");
            }
        },
        // displayNav
        displayNav: function (categories) {
            var wrapTemplate = jQuery(mo.config.navTmpl.head).html(),
                itemTemplate = jQuery(mo.config.navTmpl.loop).html(),
                navBlock = jQuery(mo.config.navBlock);
            // reset ui navigation block
            navBlock.empty();
            // init/modify vehicle count block
            jQuery(mo.config.countBlock).text(mo.model.vehicle.collection.length);

            function iterate(value) {
                _.extend(value, {
                    catId: cat
                });
                tempItems.push(_.template(itemTemplate, value, {
                    variable: "mk"
                }));
            }
            for (var cat in categories) {
                var tempItems = [];
                var vLabel = _.findWhere(mo.config.categories, {
                    dbId: cat
                }).vLabel;
                var grid = _.findWhere(mo.config.categories, {
                    dbId: cat
                }).grid;
                var sectionObject = {
                    catId: cat,
                    catLabel: vLabel,
                    grid: grid
                };
                if (_.contains(_.keys(mo.model.filter), cat)) {
                    _.extend(sectionObject, {
                        catclass: "selected",
                        selLabel: categories[cat][0].vLabel
                    });
                }

                tempItems.push(_.template(wrapTemplate, sectionObject, {
                    variable: "mk"
                }));
                _.each(categories[cat], iterate);
                tempItems.push(jQuery(mo.config.navTmpl.foot).html());
                navBlock.append(tempItems.join(""));
            }
        },
        // display pagination
        displayPagination: function (groups) {
            if (groups === 1) {
                jQuery(mo.config.pagBlock).empty();
                this.pagLayout.init(groups);
                return false;
            }
            var html = [],
                itemTemplate = jQuery(mo.config.pagTmpl).html();
            for (var i = 1; i <= groups; i++) {
                html.push(_.template(itemTemplate, {
                    pag: i.toString()
                }, {
                    variable: "mk"
                }));
            }
            jQuery(mo.config.pagBlock).html(html.join(""));
            this.pagLayout.init(groups);
        },
        // display results
        displayResults: function (list, page, layout) {
            var itemTemplate = jQuery(mo.config.listTmpl).html(),
                group = mo.helper.verifyImage(mo.helper.getGroup(list, page)),
                tempItems = [];
            // when group is empty reset page to 1 and assign group again
            if (_.isEmpty(group)) {
                mo.view.page = 1;
                mo.view.updatePageHash();
                group = mo.helper.verifyImage(mo.helper.getGroup(list, 1));
            }
            _.each(group, function (value) {
                tempItems.push(_.template(itemTemplate, value, {
                    variable: "mk"
                }));
            });
            jQuery(mo.config.listBlock).fadeOut(200, function () {
                jQuery(this).fadeIn(200).html(tempItems.join(""));
            });
            mo.view.changeSortClass(this.sort.category);
            mo.view.updatePageHash();
            if (layout) this.pagLayout.showhide(page, false);
        },
        // update sliders based on filter
        updateSliders: function () {
            // loop over sliders object
            for (var key in this.sliders) {
                var values = this.hashSliders[key] || this.sliders[key];
                jQuery("#" + key).val(values.split(","));
            }
        },
        setSliders: function () {
            for (var key in this.hashSliders) {
                var dataset = {
                    key: key,
                    value: this.hashSliders[key]
                };
                mo.model.updateFilter(dataset);
            }
        },
        // display sort list - just for new page
        displaySortList: function () {
            var itemTemplate = jQuery(mo.config.sortTmpl).html(),
                tempItems = [];
            _.extend(this.sort, mo.config.sort);
            for (var i = mo.config.categories.length - 1; i >= 0; i--) {
                if (mo.config.categories[i].sortable) {
                    tempItems.push(_.template(itemTemplate, {
                        dbId: mo.config.categories[i].dbId,
                        vLabel: mo.config.categories[i].vLabel
                    }, {
                        variable: "mk"
                    }));
                }
            }
            jQuery(mo.config.sortBlock).append(tempItems.join("")).find("[data-sort=" + this.sort.category + "]").addClass(this.sort.direction);
        },
        // display vehicle per page selector
        displayVppSelector: function () {
            var itemTemplate = jQuery(mo.config.vppTmpl).html(),
                selectHtml = [];
            for (var i = 0, eles = mo.config.vpp.opt.length; i < eles; i++) {
                selectHtml.push(_.template(itemTemplate, {
                    index: i,
                    vehicles: mo.config.vpp.opt[i]
                }, {
                    variable: "mk"
                }));
            }
            jQuery(mo.config.vppBlock).append(selectHtml.join("")).children().eq(mo.config.vpp.sel).addClass("selected");
        },
        // modify the sort class for the vehicle list
        changeSortClass: function (setClass) {
            var listBlock = jQuery(mo.config.listBlock);
            var previousClass = listBlock.data("sortClass");
            listBlock.removeClass(previousClass).addClass(setClass).data("sortClass", setClass);
        },
        // update page hash
        updatePageHash: function () {
            var oldHash = mKlib.router.getHashObj();
            if (oldHash.page === mo.view.page.toString()) return false;
            var tempObj = {};
            tempObj.page = mo.view.page;
            mKlib.router.setHash(_.extend(oldHash, tempObj));
        },
        // update sort list
        updateSortList: function () {
            var ele = jQuery(mo.config.sortBlock).find("[data-sort=" + arguments[1].key + "]");
            if (arguments[1].active) {
                ele.removeClass("hide");
            } else {
                ele.addClass("hide");
            }
        },
        // enable/disable corresponding filter depends on array amount
        setSortAuto: function (event, catobj) {
            _.each(catobj, function (value, key) {
                if (value.length === 1) {
                    PubSub.publish("filterSet", {
                        key: key,
                        active: false
                    });
                } else {
                    PubSub.publish("filterSet", {
                        key: key,
                        active: true
                    });
                }
            });
        },
        // reset display
        resetDisplay: function () {
            jQuery(mo.config.listBlock).add(mo.config.navBlock).add(mo.config.pagBlock).empty();
        },
        // pagination layout
        pagLayout: {
            list: {},
            inputRange: {},
            visRange: 5,
            tempo: 0,
            init: function (groups) {
                if (groups === 1) {
                    return false;
                }
                this.list = jQuery("li", mo.config.pagBlock);
            },
            showhide: function (newpag, change) {
                var ele, pag;
                var count = this.list.length;
                if (change) mo.view.displayResults(mo.model.vehicle.collection, newpag);
                // jQuery("#pagRange").val(newpag);
                // this.list.removeClass("selected").hide();
                this.list.removeClass("selected");
                while (count--) {
                    ele = this.list.eq(count);
                    pag = ele.data("pag");
                    if (pag == newpag || (pag > newpag && pag < (newpag + this.visRange))) {
                        if (pag == newpag) ele.addClass("selected");
                        // ele.show();
                    }
                }
            }
        },
        // ------------------- UI controls - just for new page
        uiControls: function () {
            // preview buttons
            jQuery(mo.config.listBlock).on("click", "a.preview", function () {
                var dataset = jQuery(this).data();
                mo.controller.getVehicle(dataset.vin);
            });
            // reset filter buttons
            jQuery(mo.config.navBlock).on("click", "button.reset", function () {
                jQuery(this).parents(".title").siblings(".content").find("button").trigger("click");
            });
            // filter buttons
            jQuery(mo.config.navBlock).on("click", "button[data-key]", function () {
                var dataset = this.tagName === "BUTTON" ? jQuery(this).data() : jQuery(this.parentElement).data();
                mo.model.updateFilter(dataset);
            });
            // slider's filters
            jQuery(mo.config.navSliderBl).on("change", "[data-slider]", function () {
                var dataset = {
                    key: jQuery(this).data("slider"),
                    value: jQuery(this).val()
                };
                mo.model.updateFilter(dataset);
            });
            // pagination buttons
            jQuery(mo.config.pagBlock).on("click", "li", function () {
                var datapag = mo.view.page = jQuery(this).data("pag");
                // call display method
                mo.view.displayResults(mo.model.vehicle.collection, datapag, true);
            });
            // vehicles per page selector
            jQuery(mo.config.vppBlock).on("click", "li", function () {
                jQuery("li", mo.config.vppBlock).removeClass("selected");
                var datavalue = jQuery(this).addClass("selected").data("value");
                // modify the vpp index
                mo.config.vpp.sel = parseInt(datavalue, 10);
                // call display method
                mo.controller.publishView();
                // call user pref store method
                mo.controller.storeUserPref();
            });
            // sort buttons
            jQuery(mo.config.sortBlock).on("click", "button", function () {
                var sortBut = jQuery(this);
                var datasort = sortBut.data("sort");
                if (mo.view.sort.category === datasort) {
                    mo.view.sort.direction = sortBut.hasClass("dsc") ? "asc" : "dsc";
                    sortBut.toggleClass("asc dsc");
                } else {
                    mo.view.sort.direction = sortBut.hasClass("dsc") ? "dsc" : sortBut.hasClass("asc") ? "asc" : mo.config.sort.direction;
                    mo.view.sort.category = datasort;
                    sortBut.addClass(mo.view.sort.direction).siblings("button").removeClass("asc dsc");
                }
                // apply sortBy category to filterVehCollection
                if (mo.view.sort.category !== "price") mo.model.vehicle.collection = mo.helper.orderBy(mo.model.vehicle.collection, {
                    direction: mo.view.sort.direction,
                    category: "price"
                });
                mo.model.vehicle.collection = mo.helper.orderBy(mo.model.vehicle.collection, mo.view.sort);
                // call display method
                mo.view.displayResults(mo.model.vehicle.collection, mo.view.page);
                // call user pref store method
                mo.controller.storeUserPref();
            });
            // query field event
            jQuery(".search", mo.config.queryBlock).on("keyup", function () {
                var query = jQuery(this).val();
                if (mo.view.timeout) clearTimeout(mo.view.timeout);
                mo.view.timeout = setTimeout(function () {
                    mo.controller.runQueryField(query);
                }, 500);
            }).on("keypress", function (event) {
                if (event.which == 13) event.preventDefault();
            });
        },
        // assign function handler to changes on the history path, including hash attribute
        initPopState: function () {
            window.onpopstate = function () {
                var hashObj = mKlib.router.getHashObj();
                var hashObjPage = parseInt(hashObj.page, 10);
                hashObj = _.omit(hashObj, ["zipcode", "radius", "page"]);
                if (!_.isEqual(hashObj, mo.model.filter) && mo.model.init) {
                    if (hashObjPage > 0 && mo.view.page !== hashObjPage) mo.view.page = hashObjPage;
                    mo.model.filter = _.clone(hashObj);
                    mo.controller.updateHashSliders();
                    mo.model.setCollections();
                } else if (mo.model.init && hashObjPage > 0 && mo.view.page !== hashObjPage) {
                    mo.view.page = hashObjPage;
                    mo.model.setCollections();
                }
            };
        },
        // DOM insert and setup sliders based on categories information
        initNavSlider: function () {
            var tmpl = jQuery(mo.config.navSliderTmpl).html();
            // get the categories where slider: true
            var sliderCat = _.where(mo.config.categories, {
                slider: true
            });
            // based on the Id and label from the categories insert the DOM object
            for (var cat in sliderCat) {
                var sliderObj = {
                    vLabel: sliderCat[cat].vLabel,
                    dbId: sliderCat[cat].dbId,
                    sign: sliderCat[cat].sign || "",
                    abbr: sliderCat[cat].abbr || ""
                };
                jQuery(mo.config.navSliderBl).append(_.template(tmpl, sliderObj, {
                    variable: "mk"
                }));
            }
        },
        preview: function (data) {
            var vehData = _.extend(data, _.find(mo.model.dealer.collection, {
                id: data.id
            }));
            vehData.image_list = vehData.image_list.split(" ");
            var tmpl = jQuery(mo.config.previewTmpl).html();
            jQuery("#ajaxContainer").html(_.template(tmpl, vehData, {
                variable: "mk"
            })).foundation("reveal", "open").children().foundation("orbit", {
                animation: "fade",
                slide_number: false,
                bullets: false,
                timer: false
            });
        }
    };
    return mo;
}(vehicleSearch || {}));