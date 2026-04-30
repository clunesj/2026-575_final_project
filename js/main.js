// main.js, by Joseph Kowalczyk, James Clunes, and Brooke Fandrich
(function(){

    // Pseudoglobal Variables
    var map;
    var locationsLayer; // Enables filtering via search and other filter controls
    var accessMode = sessionStorage.getItem('commonGoodAccessMode');

    // ── Guest session: clear data on page reload ────────────────────────────────
    function handleGuestReload() {
        var navigationEntries = performance.getEntriesByType('navigation');
        var navigationType = navigationEntries.length ? navigationEntries[0].type : '';

        if (accessMode === 'guest' && navigationType === 'reload') {
            sessionStorage.clear();
            accessMode = null;
        }
    }

    // ── Map initialisation ──────────────────────────────────────────────────────

    // Creating leaflet map
    function mapInit() {
        handleGuestReload();

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
        fetch('data/locations.geojson')
            .then(function(response) {
                return response.json();
            })
            .then(function(json){
                createSymbols(json);
            })
        createNavMenu();
        createSearchFilter();
        createTimeFilter();
        // createRepeatFilter(); -- Nonfunctional, see createRepeatFilter() definition.
        createZoom();
    };

    // ── Adding initial locations to the map ─────────────────────────────────────
    function createSymbols(data) {
        locationsLayer = L.geoJson(data, { // Assign pseudoglobal variable data to make searching possible
            pointToLayer: function(feature, latlng){
                return L.marker(latlng);
            },
            onEachFeature: function(feature, layer) {
                // Build popup content, established here because popups themselves do not change.
                layer.properties = feature.properties;
                var popupContent = `
                    <div class="popup-content">
                        <h3>${layer.properties.Name}</h3>
                        <p><b>Description:</b> ${layer.properties.Description}</p>
                        <p><b>Contact:</b> ${layer.properties.Contact}</p>
                        <p><b>Hours:</b> ${layer.properties.Hours}</p>
                        <p><a href="${layer.properties.Link}" target="_blank">Visit Website</a></p>
                        <p><b>Services:</b> ${layer.properties.Services}</p>
                    </div>
                `;
                layer.bindPopup(popupContent);
            }
        }).addTo(map);
}

    // ── Filter controls ─────────────────────────────────────────────────────────

    // Create Search filter
    function createSearchFilter() {
        var searchFilter = L.Control.extend({
            options: {position: 'topleft'},

            onAdd: function() {
                // Container div
                var container = L.DomUtil.create('div', 'searchfilter-container');
                // Container content
                var input = L.DomUtil.create('input', 'searchfilter-input', container);
                input.type = 'text'; // Sets input type of the search bar to text.
                input.placeholder = 'Search location name or service type...'; // Sets search bar placeholder text, i.e. when nothing is typed.

                // Event listener for search filtering
                L.DomEvent.on(input, 'input', function () {
                    filterLocations(input.value);
                })


                // Disable click propagation
                L.DomEvent.disableClickPropagation(container);

                return container;
            }
        })
        map.addControl(new searchFilter());
    };

    function filterLocations(searchTerm) {
        var term = searchTerm.toLowerCase().trim(); // Reads the search input, saves it as a lowercase string with no whitespace

        locationsLayer.eachLayer(function(layer) { // Iterate through each point on the map...
            if (!layer.properties) return; // In case a point has no properties, skip it.

            var name = layer.properties.Name?.toLowerCase() || ''; // If a marker has a Name value, assign it to name in lowercase. Otherwise assign a blank string.
            var services = layer.properties.Services?.toLowerCase() || ''; // Likewise, but for the Services list.
            
            if (!term || name.includes(term) || services.includes(term)) { // If the search bar is empty, or the marker's Name or Services includes the search input...
                layer.addTo(map); // Adds the marker to the map
            } else { 
                layer.removeFrom(map); // Remove the marker from the map until it meets search criteria
            }
        });
    };

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
                    <p>Location Availability<br><b>(NON-FUNCTIONAL)</b></p>
                    <div>
                        <input type = 'radio' class = 'inputbutton' id = 'rightnow' name = 'availability' value = 'rightnow'>
                        <label for = 'rightnow'>Right Now</label>
                    </div>
                    <div>
                        <input type = 'radio' class = 'inputbutton' id = 'anytime' name = 'availability' value = 'anytime'>
                        <label for = 'anytime'>Any Time</label>
                    </div>
                    <div>
                        <input type = 'radio' class = 'inputbutton' id = 'custom' name = 'availability' value = 'custom'>
                        <label for = 'custom'>Custom</label>
                    </div>
                `;

                // Disable click propagation
                L.DomEvent.disableClickPropagation(container);

                return container;
            }
        });

        map.addControl(new timeFilter());
    };

    // Create event repeat filter control -- Nonfunctional, as of 4/30 data does not differentiate between pop-up and repeating events, staying commented in case that changes.
    //function createRepeatFilter() {
    //    // Initialize filter menu
    //    var repeatFilter = L.Control.extend({
    //        options: {position: 'topleft'},
    //
    //        onAdd: function () {
    //            // Create control container div
    //            var container = L.DomUtil.create('div', 'repeatfilter-container');
    //
    //            // Container content
    //            var content = L.DomUtil.create('div', 'repeatfilter-content', container);
    //            content.innerHTML = `
    //                <p>Location Frequency</p>
    //                <div>
    //                    <input type = 'radio' id = 'all' name = 'frequency' value = 'all'>
    //                    <label for = 'all'>All</label>
    //                </div>
    //                <div>
    //                    <input type = 'radio' id = 'recurring' name = 'frequency' value = 'recurring'>
    //                    <label for = 'recurring'>Recurring</label>
    //                </div>
    //                <div>
    //                    <input type = 'radio' id = 'popup' name = 'frequency' value = 'popup'>
    //                    <label for = 'popup'>Pop-up (one-time)</label>
    //                </div>
    //            `;
    //
    //            // Disable click propagation
    //            L.DomEvent.disableClickPropagation(container);
    //
    //            return container;
    //        }
    //    });
    //
    //    map.addControl(new repeatFilter());
    //};

    // ── Navigation menu (top-right hamburger) ───────────────────────────────────
    // Before login: shows only "Login".
    // After login or guest: shows "Locations", "Profile", and "Logout".
    function createNavMenu() {
        var navMenu = L.Control.extend({
            options: {position: 'topright'},

            onAdd: function() {
                // Create control container div
                var container = L.DomUtil.create('div', 'navmenu-container');

                // Create icon/collapsed appearance
                var button = L.DomUtil.create('button', 'navmenu-button', container);
                button.innerHTML = '<img src="img/menu.svg" alt="Menu">';

                // Create content/expanded appearance — populated based on session state
                var content = L.DomUtil.create('div', 'navmenu-content', container);

                if (accessMode) {
                    // Logged-in or guest tester: show app navigation
                    content.innerHTML =
                        '<p><a href="hosting/location.html">Locations</a></p>' +
                        '<p><a href="profile.html">Profile</a></p>' +
                        '<p><a href="#" id="logout-nav-link">Logout</a></p>';

                    // Wire logout to clear session before navigating
                    var logoutLink = content.querySelector('#logout-nav-link');
                    L.DomEvent.on(logoutLink, 'click', function() {
                        sessionStorage.removeItem('commonGoodAccessMode');
                        sessionStorage.removeItem('commonGoodUserEmail');
                        window.location.href = 'index.html';
                    });
                } else {
                    // No active session: show only Login
                    content.innerHTML = '<p><a href="login.html">Login</a></p>';
                }

                // Toggle the content on/off when the menu button is clicked
                L.DomEvent.on(button, 'click', function() {
                    if (L.DomUtil.hasClass(container, 'expanded')) {
                        L.DomUtil.removeClass(container, 'expanded');
                    } else {
                        L.DomUtil.addClass(container, 'expanded');
                    }
                });

                // Disable mouse propagation, prevents interacting with map through the menu
                L.DomEvent.disableClickPropagation(container);

                return container;
            }
        });

        map.addControl(new navMenu());
    };

    // Readd zoom control in the bottom left, making room for filter controls
    function createZoom() {
        L.control.zoom({position: 'bottomleft'}).addTo(map);
    };

    // Runs mapInit() once the DOM loads.
    document.addEventListener('DOMContentLoaded', mapInit);
})(); // Must be the last line. Closes and executes the wrapping function. ---------------------------------------
