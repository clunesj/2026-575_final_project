// main.js, by Joseph Kowalczyk, James Clunes, and Brooke Fandrich
(function(){
    // Pseudoglobal Variables
    var map;

    // Creating leaflet map
    function mapInit() {
        map = L.map('map', {
            zoomControl: false // Remove zoom control to reposition later.
        }).setView([43.08, -89.38], 13);

        // Add tileset
        L.tileLayer('https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.{ext}', {
	        minZoom: 0,
	        maxZoom: 20,
	        attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	        ext: 'png'
        }).addTo(map);

        // Call addData, which will eventually load the prebuilt dataset, but also handles menus
        addData(map);
    };

    // AddData function, will eventually load in prebuilt dataset and user's chosen locations, currently handles menus
    function addData(map) {
        createNavMenu();
        // Search goes here
        createTimeFilter();
        createRepeatFilter();
        createZoom();
    };

    // Create search control NOTE: Requires leaflet-search.js to be installed, or other similar library!

    // Create time filter control
    function createTimeFilter() {
        // Initialize filter menu
        var timeFilter = L.Control.extend({
            options: {position: 'topleft'},

            onAdd: function () {
                // Create control container div
                var container = L.DomUtil.create('div', 'timefilter-container');

                // Container content
                var content = L.DomUtil.create('div', 'timefilter-content', container);
                content.innerHTML = `
                    <p>Location Availability</p>
                    <div>
                        <input type = 'radio' id = 'rightnow' name = 'availability' value = 'rightnow'>
                        <label for = 'rightnow'>Right Now</label>
                    </div>
                    <div>
                        <input type = 'radio' id = 'anytime' name = 'availability' value = 'anytime'>
                        <label for = 'anytime'>Any Time</label>
                    </div>
                    <div>
                        <input type = 'radio' id = 'custom' name = 'availability' value = 'rightnow'>
                        <label for = 'custom'>Custom</label>
                    </div>
                `;

                // Disable click propogation
                L.DomEvent.disableClickPropagation(container);

                return container;
            }
        });

        map.addControl(new timeFilter())
    };

    // Create event repeat filter control
        function createRepeatFilter() {
        // Initialize filter menu
        var repeatFilter = L.Control.extend({
            options: {position: 'topleft'},

            onAdd: function () {
                // Create control container div
                var container = L.DomUtil.create('div', 'repeatfilter-container');

                // Container content
                var content = L.DomUtil.create('div', 'repeatfilter-content', container);
                content.innerHTML = `
                    <p>Location Frequency</p>
                    <div>
                        <input type = 'radio' id = 'all' name = 'frequency' value = 'all'>
                        <label for = 'all'>All</label>
                    </div>
                    <div>
                        <input type = 'radio' id = 'recurring' name = 'frequency' value = 'recurring'>
                        <label for = 'recurring'>Recurring</label>
                    </div>
                    <div>
                        <input type = 'radio' id = 'popup' name = 'frequency' value = 'popup'>
                        <label for = 'popup'>Pop-up (one-time)</label>
                    </div>
                `;

                // Disable click propogation
                L.DomEvent.disableClickPropagation(container);

                return container;
            }
        });

        map.addControl(new repeatFilter())
    };
    // Create navigation menu (hosting dashboard, personal dashboard, settings, log in)
    function createNavMenu() {
        var navMenu = L.Control.extend({
            options: {position: 'topright'},
        
            onAdd: function() {
                // Create control container div
                var container = L.DomUtil.create('div', 'navmenu-container');

                // Create icon/collapsed appearance
                var button = L.DomUtil.create('button', 'navmenu-button', container);
                button.innerHTML = '<img src = "img/menu.svg"></button>';

                // Create content/expanded appearance
                var content = L.DomUtil.create('div', 'navmenu-content', container);
                content.innerHTML = `
                    <p><a href=''>Hosting Dashboard</a></p>
                    <p><a href=''>Personal Dashboard</a></p>
                    <p><a href=''>Settings</a></p>
                    <p><a href=''>Log In</a></p>
                `;

                // Toggling the content on/off when the menu button is clicked
                L.DomEvent.on(button, 'click', function(e){ // Leaflet's version of addEventListener for the button
                    if (L.DomUtil.hasClass(container, 'expanded')) { // If the navmenu already has the 'expanded' class...
                        L.DomUtil.removeClass(container, 'expanded') // Remove the 'expanded' class.
                    } else {                                         // Otherwise...
                        L.DomUtil.addClass(container, 'expanded')    // Add the 'expanded' class.
                    }
                });

                // Disable mouse propogation, prevents interacting with map through the menu button
                L.DomEvent.disableClickPropagation(container);

                return container;
            }
        });

        map.addControl(new navMenu());
    };

    // Readd zoom control in the bottom right, making room for filter controls
    function createZoom() {
        L.control.zoom({position: 'bottomleft'}).addTo(map)
    };

    // Runs mapInit() once the DOM loads.
    document.addEventListener('DOMContentLoaded', mapInit)

})(); // Must be the last line. Closes and executes the wrapping function. ---------------------------------------