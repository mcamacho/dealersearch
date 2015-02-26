function getBounds (maps, data) {
  var bounds = new maps.LatLngBounds();
  _.forEach(data, function(ele) {
    bounds.extend(new maps.LatLng(ele.dealer_latitude, ele.dealer_longitude));
  });
  return bounds;
}

function getLatLon (data) {
  return { latitude: data.lat(), longitude: data.lng() };
}

function setMap (maps, data) {
  var bounds = getBounds(maps, data), neB = bounds.getNorthEast(), swB = bounds.getSouthWest(), mapC = bounds.getCenter();
  return {
          center: getLatLon(mapC),
          bounds: {
            northeast: getLatLon(neB),
            southwest: getLatLon(swB)
          },
          zoom: 8,
          refresh: true
        };
}

function setMarker (marker, i) {
  return {
    latitude: parseFloat(marker.dealer_latitude),
    longitude: parseFloat(marker.dealer_longitude),
    dealer: marker.dealer_name,
    address: marker.dealer_address_1,
    city: marker.dealer_city,
    state: marker.dealer_state,
    zip: marker.dealer_zip,
    sales: marker.dealer_phone_main,
    service: marker.dealer_phone_service,
    parts: marker.dealer_phone_parts,
    website: marker.dealer_website,
    id: i
  };
}

var app = angular.module("dealerSearch", ["uiGmapgoogle-maps"]);

app.config(function(uiGmapGoogleMapApiProvider) {
  uiGmapGoogleMapApiProvider.configure({ v: "3.18" });
});

app.constant('_', window._);

app.controller("mapCtrl", function($scope, uiGmapGoogleMapApi, $log, $http, _) {
  uiGmapGoogleMapApi.then(function(maps) {
    $http.get("locations.json").
      success(function(data, status) {
        $scope.map = setMap(maps, data);
        $scope.markers = _.map(data, setMarker, maps);
        $log.info($scope.markers);
      }).
      error(function(data, status) {
        $log.error("Request failed" + status);
      });
  });
});