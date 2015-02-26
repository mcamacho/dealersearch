/*global google, jQuery, List, console, _*/
'use strict';
var dealerMap = (function(window, document, undefined) {

  var map, itemlist, infoopen, prevPos, markerTmpl, listTmpl;

  // ajax call json object

  function initialize() {
    infoopen = undefined;
    prevPos = 0;
    jQuery('#map-canvas').empty();
    map = undefined;
    jQuery.ajax({
      url: '{THEME_ROOT}/_ajax.php',
      type: 'POST',
      dataType: 'json',
      data: {
        api: 'true',
        f: 'json',
        show: 'all',
        d: 'rooftops',
        k: 'id,dealer_name,dealer_website,dealer_address_1,dealer_city,dealer_state,dealer_zip,dealer_phone_main,dealer_latitude,dealer_longitude,distance'
      },
      success: function(data) {
        var mapObject = extendMap(data);
        initMapList(mapObject);
      },
      error: function(xhr, textStatus, errorThrown) {
        console.log(xhr + '-e-' + textStatus + '-' + errorThrown);
      }
    });
  }
  // extend mapObject with mapCenter, southWest and northEast geo, current location lat and lon
  function extendMap(data) {
    var collection = _.map(data, function (ele) {
      return _.extend(ele, {
        dealer_latitude: parseFloat(ele.dealer_latitude),
        dealer_longitude: parseFloat(ele.dealer_longitude) * -1,
        distance: parseFloat(ele.distance),
      });
    });
    var mapObject = {
      dealers: _.sortBy(collection, 'distance')
    };
    var last = collection.length - 1;
    // sort collection by latitude
    var colbylat = _.sortBy(collection, 'dealer_latitude');
    // sort collection by longitude
    var colbylon = _.sortBy(collection, 'dealer_longitude');
    // assign new values
    mapObject.southWest = {
      'lat': colbylat[0].dealer_latitude,
      'lon': colbylon[0].dealer_longitude
    };
    mapObject.northEast = {
      'lat': colbylat[last].dealer_latitude,
      'lon': colbylon[last].dealer_longitude
    };
    mapObject.mapCenter = {
      'lat': ((parseFloat(colbylat[0].dealer_latitude, 10) + parseFloat(colbylat[last].dealer_latitude, 10)) / 2),
      'lon': ((parseFloat(colbylon[0].dealer_longitude, 10) + parseFloat(colbylon[last].dealer_longitude, 10)) / 2)
    };
    return mapObject;
  }

  // initialize map and list of dealers

  function initMapList(extmap) {
    // map instance
    var mapOptions = {
      zoom: 4,
      center: new google.maps.LatLng(extmap.mapCenter.lat, extmap.mapCenter.lon),
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);

    // marker custom image
    var image = {
      url: 'http://cdn.wpdlr.co/assets/icons/vw-marker-02.png',
      size: new google.maps.Size(30, 41),
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(15, 41)
    };

    // marker custom shadow
    var shadow = {
      url: 'http://cdn.wpdlr.co/assets/icons/vw-marker-02-shadow.png',
      size: new google.maps.Size(30, 41),
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(15, 41)
    };

    // marker location bounds
    var southWest = new google.maps.LatLng(extmap.southWest.lat, extmap.southWest.lon);
    var northEast = new google.maps.LatLng(extmap.northEast.lat, extmap.northEast.lon);
    var bounds = new google.maps.LatLngBounds(southWest, northEast);
    map.fitBounds(bounds);

    // add dealer-list-tl template to Mustache plugin engine
    if (typeof itemlist !== 'undefined') {
      jQuery('#dealerList').empty();
      itemlist.clear();
    } else {
      // jQuery.Mustache.addFromDom('dealer-list-tl');
      markerTmpl = jQuery('#dealer-marker-tmpl').html();
      listTmpl = jQuery('#dealer-list-tmpl').html();
    }

    var ext = extmap.dealers.reverse();
    // instantiate and append dealer list to DOM using mustache template
    // instantiate and append dealer marker to map
    for (var i = ext.length - 1; i >= 0; i--) {
      var position = new google.maps.LatLng(
        ext[i].dealer_latitude,
        ext[i].dealer_longitude);
      var marker = new google.maps.Marker({
        icon: image,
        shadow: shadow,
        optimized: true,
        position: position,
        map: map
      });
      marker.setTitle(ext[i].dealer_name);
      attachContent(marker, ext[i]);
    }
    // initialize dealerList and sortInit
    dealerList();
    sortInit();
  }

  function attachContent(marker, data) {
    var dataContent = _.template(markerTmpl, data, {
      variable: 'mk'
    });
    var infowindow = new google.maps.InfoWindow({
      content: dataContent
    });
    google.maps.event.addListener(marker, 'open', function() {
      map.panTo(marker.getPosition());
      if (infoopen !== undefined) {
        infoopen.close();
      }
      map.setZoom(10);
      infowindow.open(marker.get('map'), marker);
      infoopen = infowindow;
      //map.setCenter(marker.getPosition());
    });
    google.maps.event.addListener(marker, 'click', function() {
      jQuery('#dealerList').trigger('markerevent', [data]);
      google.maps.event.trigger(marker, 'open');
    });
    google.maps.event.addListener(marker, 'dblclick', function() {
      // map.panTo(marker.getPosition());
      google.maps.event.trigger(marker, 'open');
    });
    var item = _.template(listTmpl, data, {
      variable: 'mk'
    });
    jQuery(item)
      .appendTo('#dealerList')
      .on('click', marker, function() {
        jQuery('.active').removeClass('active');
        jQuery(this).addClass('active');
        google.maps.event.trigger(marker, 'dblclick');
      });
  }

  function dealerList() {
    jQuery('#dealerList').on('markerevent', function(event, data) {
      jQuery('#example-list .search').val('').change().blur();
      itemlist.search();
      jQuery('.active').removeClass('active');
      var id = jQuery('#' + data.id);
      prevPos = jQuery('#dealerList').scrollTop();
      jQuery('#dealerList').scrollTop(id.position().top + prevPos);
      id.addClass('active');
    });
  }

  function sortInit() {
    itemlist = new List('example-list', {
      valueNames: ['title', 'distance', 'id'],
      page: 1000
    });
  }

  return {
    refreshMap: function () {
      initialize();
    }
  };

})(window, document);