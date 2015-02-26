function getBounds (gm, data) {
  var bounds = new gm.LatLngBounds();
  _.forEach(data, function(ele) {
    bounds.extend(new gm.LatLng(ele.dealer_latitude, ele.dealer_longitude));
  });
  return bounds;
}

function getLatLon (data) {
  return { latitude: data.lat(), longitude: data.lng() };
}

var app = angular.module("dealerSearch", ["uiGmapgoogle-maps"]);

app.config(function(uiGmapGoogleMapApiProvider) {
  uiGmapGoogleMapApiProvider.configure({ v: "3.18" });
});

app.controller("mapCtrl", function($scope, uiGmapGoogleMapApi, $log, $http) {
  // Do stuff with your $scope.
  // Note: Some of the directives require at least something to be defined originally!
  // e.g. $scope.markers = []
  // uiGmapGoogleMapApi is a promise.
  // The "then" callback function provides the google.maps object.
  uiGmapGoogleMapApi.then(function(maps) {
    $log.info("ready");
    $http.get("locations.json").
      success(function(data, status) {
        var bounds = getBounds(maps, data);
        var neB = bounds.getNorthEast();
        var swB = bounds.getSouthWest();
        var mapC = bounds.getCenter();
        $scope.map = {
          center: getLatLon(mapC),
          bounds: {
            northeast: getLatLon(neB),
            southwest: getLatLon(swB)
          },
          zoom: 13,
          refresh: true
        };
      }).
      error(function(data, status) {
        $log.error("Request failed" + status);
      });
//     $scope.map = { center: { latitude: 45, longitude: -73 }, zoom: 8 };
  });
});