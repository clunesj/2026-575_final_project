// main.js, by Joseph Kowalczyk, James Clunes, and Brooke Fandrich
(function(){
    // Pseudoglobal Variables
    var map;

    // Creating leaflet map
    function mapInit() {
        map = L.map('map').setView([43.08, -89.38], 13);

        // Add tileset
        L.tileLayer('https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.{ext}', {
	        minZoom: 0,
	        maxZoom: 20,
	        attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	        ext: 'png'
        }).addTo(map);

    }
    // Runs mapInit() once the DOM loads.
    document.addEventListener('DOMContentLoaded', mapInit)
})(); // Must be the last line. Closes and executes the wrapping function. ---------------------------------------