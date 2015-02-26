// get the data - json
function reqListener () {
//   console.log(this.responseText);
  console.log(JSON.parse(this.responseText));
}

var oReq = new XMLHttpRequest();
oReq.onload = reqListener;
oReq.open("get", "locations.json", true);
oReq.send();
// feed the map and the menu
var app = angular.module("dealerSearch", ["uiGmapgoogle-maps"]);
app.config(function(uiGmapGoogleMapApiProvider) {
  uiGmapGoogleMapApiProvider.configure({
    //    key: 'your api key',
    v: "3.18"
  });
});
app.controller("mapCtrl", function($scope, uiGmapGoogleMapApi, $log) {
  $log.info("on mapCtrl");
  // Do stuff with your $scope.
  // Note: Some of the directives require at least something to be defined originally!
  // e.g. $scope.markers = []
  $scope.map = { center: { latitude: 45, longitude: -73 }, zoom: 8 };
  // uiGmapGoogleMapApi is a promise.
  // The "then" callback function provides the google.maps object.
  uiGmapGoogleMapApi.then(function(maps) {
    $log.info("ready");
    $scope.map = { center: { latitude: 45, longitude: -73 }, zoom: 8 };
  });
});