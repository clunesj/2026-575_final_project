// main.js, by Joseph Kowalczyk, James Clunes, and Brooke Fandrich
(function(){

    // Pseudoglobal Variables
    var map;
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
        // Search goes here
        createTimeFilter();
        createRepeatFilter();
        createZoom();
    };

    // ── Adding initial locations to the map ─────────────────────────────────────
    function createSymbols(data) {
        L.geoJson(data, {
            pointToLayer: function(feature, latlng){
                return L.marker(latlng);
            },
            onEachFeature: function(feature, layer) {
                // Build popup content, established here because popups themselves do not change.
                var props = feature.properties;
                var popupContent = `
                    <div class="popup-content">
                        <h3>${props.Name}</h3>
                        <p><b>Description:</b> ${props.Description}</p>
                        <p><b>Contact:</b> ${props.Contact}</p>
                        <p><b>Hours:</b> ${props.Hours}</p>
                        <p><a href="${props.Link}" target="_blank">Visit Website</a></p>
                        <p><b>Services:</b> ${props.Services}</p>
                    </div>
                `;
                layer.bindPopup(popupContent);
            }
        }).addTo(map);
}

    // ── Filter controls ─────────────────────────────────────────────────────────

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
                        <input type = 'radio' id = 'custom' name = 'availability' value = 'custom'>
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

                // Disable click propagation
                L.DomEvent.disableClickPropagation(container);

                return container;
            }
        });

        map.addControl(new repeatFilter());
    };

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
