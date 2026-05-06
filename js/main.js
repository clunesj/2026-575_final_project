// main.js, by Joseph Kowalczyk, James Clunes, and Brooke Fandrich
(function(){

    // Pseudoglobal Variables
    var map;
    var locationsLayer; // Enables filtering via search and other filter controls
    var accessMode = sessionStorage.getItem('commonGoodAccessMode')
    var activeFilters = { searchTerm: '', timeMode: 'anytime'}; // updating so filters work in concert -jc

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
        L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.{ext}', {
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
                addUserLocations();
            })
        createNavMenu();
        createSearchFilter();
        createTimeFilter();
        // createRepeatFilter(); -- Nonfunctional, see createRepeatFilter() definition.
        createZoom();
    };

    function escapeHtml(value) {
        var text = value === null || value === undefined ? '' : String(value);
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function buildDetailsUrl(properties) {
        if (!properties) {
            return 'location-details.html';
        }

        if (properties.isUserCreated) {
            var params = ['source=user'];
            if (properties.userLocationId) {
                params.push('id=' + encodeURIComponent(properties.userLocationId));
            }
            if (properties.Name) {
                params.push('name=' + encodeURIComponent(properties.Name));
            }
            return 'location-details.html?' + params.join('&');
        }

        if (properties.Key !== undefined && properties.Key !== null) {
            return 'location-details.html?source=dataset&id=' + encodeURIComponent(properties.Key);
        }

        return 'location-details.html';
    }

    function buildPopupContent(properties) {
        var name = escapeHtml(properties && properties.Name ? properties.Name : 'Community Location');
        var description = escapeHtml(properties && properties.Description ? properties.Description : 'No description available yet.');
        var contact = escapeHtml(properties && properties.Contact ? properties.Contact : 'Not listed');
        var hours = escapeHtml(properties && properties.Hours ? properties.Hours : 'Not listed');
        var services = escapeHtml(properties && properties.Services ? properties.Services : 'Not listed');
        var link = properties && properties.Link ? properties.Link : '';
        var detailsUrl = buildDetailsUrl(properties || {});

        var websiteLine = link
            ? '<p><a href="' + escapeHtml(link) + '" target="_blank" rel="noopener noreferrer">Visit Website</a></p>'
            : '<p><span class="popup-muted">Website not listed</span></p>';

        return [
            '<div class="popup-content">',
            '<h3>' + name + '</h3>',
            '<p><b>Description:</b> ' + description + '</p>',
            '<p><b>Contact:</b> ' + contact + '</p>',
            '<p><b>Hours:</b> ' + hours + '</p>',
            websiteLine,
            '<p><b>Services:</b> ' + services + '</p>',
            '<p><a href="' + detailsUrl + '" class = "popup-button">Details...</a></p>',
            '</div>'
        ].join('');
    }

    // ── Adding initial locations to the map ─────────────────────────────────────
    function createSymbols(data) {
        locationsLayer = L.geoJson(data, { // Assign pseudoglobal variable data to make searching possible
            pointToLayer: function(feature, latlng){
                if (feature.properties && feature.properties.iconFile) {
                    var customIcon = L.icon({
                        iconUrl: 'data/icons/' + feature.properties.iconFile,
                        iconSize: [36, 36], // Size of marker icon
                        iconAnchor: [18, 36], // Position on icon that represents the location
                        popupAnchor: [0, -36] // Position realtive to anchor that the popup originates from.
                    });
                    return L.marker(latlng);
                }
                return L.marker(latlng);
            },
            onEachFeature: function(feature, layer) {
                // Build popup content, established here because popups themselves do not change.
                layer.properties = feature.properties;
                var popupContent = buildPopupContent(layer.properties);
                layer.bindPopup(popupContent);
            }
        }).addTo(map);
}

    // ── User-created locations from sessionStorage ──────────────────────────────
    function addUserLocations() {
        var raw;
        try {
            raw = JSON.parse(sessionStorage.getItem('commonGoodCreatedLocations') || '[]');
        } catch (e) {
            raw = [];
        }

        raw.forEach(function (entry, index) {
            if (!entry || typeof entry !== 'object') { return; }
            var lat = entry.lat;
            var lon = entry.lon;
            if (lat === null || lat === undefined || lon === null || lon === undefined) { return; }

            var feature = {
                type: 'Feature',
                properties: {
                    Name: entry.name || 'Your Location',
                    Description: entry.description || '',
                    Contact: entry.contact || '',
                    Hours: entry.hours || '',
                    Link: entry.siteUrl || '',
                    Services: entry.servicesText || '',
                    iconFile: entry.icon || '',
                    isUserCreated: true,
                    userLocationId: entry.locationId || ('legacy-' + index)
                },
                geometry: {
                    type: 'Point',
                    coordinates: [lon, lat]
                }
            };

            locationsLayer.addData(feature);
        });
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

                // Search suggestions accelerator
                var suggestionsDropdown = L.DomUtil.create('div', 'searchfilter-suggestions', container);
                suggestionsDropdown.style.display = 'none'; // Suggestions dropdown does not display on page load.

                // Event listener for search filtering
                L.DomEvent.on(input, 'input', function () {
                    activeFilters.searchTerm = input.value;
                    applyFilters();
                    updateSuggestions(input.value, suggestionsDropdown, input)
                });

                    //add a reset button to clear search filter: jc
                var resetButton = L.DomUtil.create('button', 'searchfilter-reset', container);
                resetButton.innerHTML = '↺';
                resetButton.title = 'Clear search';
                L.DomEvent.on(resetButton, 'click', function () {
                    input.value = '';
                    // searchFilterLocations('');
                    activeFilters.searchTerm = '';
                    applyFilters();
                    suggestionsDropdown.style.display = 'none';
                });


                // Disable click propagation
                L.DomEvent.disableClickPropagation(container);

                return container;
            }
        })
        map.addControl(new searchFilter());
    };

    // commenting out to try a filter that works with both 11:20 jc
    // function searchFilterLocations(searchTerm) {
    //     var term = searchTerm.toLowerCase().trim(); // Reads the search input, saves it as a lowercase string with no whitespace

    //     locationsLayer.eachLayer(function(layer) { // Iterate through each point on the map...
    //         if (!layer.properties) return; // In case a point has no properties, skip it.

    //         var name = layer.properties.Name?.toLowerCase() || ''; // If a marker has a Name value, assign it to name in lowercase. Otherwise assign a blank string.
    //         var services = layer.properties.Services?.toLowerCase() || ''; // Likewise, but for the Services list.
            
    //         if (!term || name.includes(term) || services.includes(term)) { // If the search bar is empty, or the marker's Name or Services includes the search input...
    //             layer.addTo(map); // Adds the marker to the map
    //         } else { 
    //             layer.removeFrom(map); // Remove the marker from the map until it meets search criteria
    //         }
    //     });
    // };\

    function applyFilters(){
        var term = activeFilters.searchTerm.toLowerCase().trim(); // Reads the search input, saves it as a lowercase string with no whitespace
        var mode = activeFilters.timeMode;

        locationsLayer.eachLayer(function(layer) { // Iterate through each point on the map...
            if (!layer.properties) return; // In case a point has no properties, skip it.

            var name = layer.properties.Name?.toLowerCase() || ''; // If a marker has a Name value, assign it to name in lowercase. Otherwise assign a blank string.
            var services = layer.properties.Services?.toLowerCase() || ''; // Likewise, but for the Services list.
            var matchesSearch = !term || name.includes(term) || services.includes(term);

            var matchesTime = true;
            if (mode === 'rightnow') {
                matchesTime = isOpenNow(layer.properties.HoursParsed); //not to be confused with hoursParsed!
            } else if (mode === 'custom' && activeFilters.customTime) {
                matchesTime = isOpenAtTime(layer.properties.HoursParsed, activeFilters.customTime)
            }

            if (matchesSearch && matchesTime) { //If it matches search and matches time...
                layer.addTo(map); // Adds the marker to the map
            } else { 
                layer.removeFrom(map); // Remove the marker from the map until it meets search criteria
            }
        });
    };

    function isOpenNow(hoursParsed) { 
        if (hoursParsed === null) return true; // always show locations with unknown hours, i.e. "Check website for hours."
        var now = new Date();
        var day = (now.getDate() + 6) % 7; // convert JS Sunday = 0 to Monday = 0
        var time = now.getHours() * 100 + now.getMinutes();
        var todayHours = hoursParsed[day];
        if (todayHours === null) return false; // closed on certain days!
        var open = todayHours[0], close = todayHours[1];
        if (close < open){ // overnight span
            return time >= open || time < close;
        }
        return time >= open && time < close;
    };

    function isOpenAtTime(hoursParsed, timeString) {
        if (hoursParsed === null) return true; // always show locations with unknown hours, i.e. "Check website for hours."
    
        // Parse timeString "HH:MM" to match HoursParsed in locations.geojson
        var timeParts = timeString.split(':');
        var time = parseInt(timeParts[0]) * 100 + parseInt(timeParts[1]);
        
        // Getting current day to retrieve current day of the week
        var now = new Date();
        var day = (now.getDate() + 6) % 7;
        var todayHours = hoursParsed[day];
        
        if (todayHours === null) return false; // Always return false if location is closed
        
        var open = todayHours[0], close = todayHours[1];
        if (close < open) { // overnight span
            return time >= open || time < close;
        }
        return time >= open && time < close;
    }

    // Commenting out to try a filter that works with both 11:20 jc
    // function timeFilterLocations(mode) { // this is the function to filter based on if the hours match now
    //     locationsLayer.eachLayer(function(layer) {
    //         if (!layer.properties) return;
    //         if(mode === 'rightnow') {
    //             if (isOpenNow(layer.properties.HoursParsed)) {
    //                 layer.addTo(map);
    //             } else {
    //                 layer.removeFrom(map);
    //             }
    //         } else {
    //             layer.addTo(map);
    //             }
    //         });
    // }

    function updateSuggestions(searchTerm, dropdown, input) {
        var term = searchTerm.toLowerCase().trim();
        dropdown.innerHTML = ''; // Resets dropdown contents to prevent overflowing when search term changes.

        // If there is no search term, disable the suggestions dropdown.
        if (!term) {
            dropdown.style.display = 'none';
            return;
        }

        var seen = {}; // avoiding duplicates by tracking service types already added
        var suggestions = []; // Initialize array to hold suggestions
        
        locationsLayer.eachLayer(function(layer){ // Iterate through each marker on the map...
            if (!layer.properties) return; // In case a point has no properties, skip it.
            
            // Services suggestions
            var servicesRaw = layer.properties.Services || ''; // If a marker has a Name value, assign it to name. Otherwise, assign a blank string.
            servicesRaw.split(',').forEach(function(serviceType) {
                var trimmed = serviceType.trim(); // remove whitespace around the tags
                var lower = trimmed.toLowerCase();

                if (lower.includes(term) && !seen[lower] && suggestions.length <5) { // If the lowercase service list includes the search term, has not been seen before, and the total number of suggestions does not exceed 5...
                    seen[lower] = true;
                    suggestions.push({text: trimmed, isName: false}); // Push a json object, text is what displays as the suggestion, isName will control if the suggestion is italicized or not.
                }
            });

            // Location name suggestions
            var nameRaw = layer.properties.Name || ''; // Likewise, but for location names instead of services
            var nameLower = nameRaw.toLowerCase(); // Saves a lowercase version of the location name, matches how search filter processes inputs

            if (nameLower.includes(term) && !seen[nameLower] && suggestions.length < 5) { // If the lowercase location name includes the search term, has not been seen before, and the total number of suggestions does not exceed 5...
                seen[nameLower] = true // Adds the name to the seen list, preventing it from showing again
                suggestions.push({text: nameRaw, isName: true}) // Similar to services suggestion, pushes as json object.
            }
        });

        // Displaying suggestions when a term is searched
        if (suggestions.length > 0) {
            dropdown.style.display = 'block'; // Set the display style to block, showing the suggestions.
            
            suggestions.forEach(function(suggestion){ // for each item in the suggestion array...
                var item = L.DomUtil.create('div', 'suggestion-item', dropdown); // Create a new div for the suggestion
                item.textContent = suggestion.text; // set content of div to the text component of the suggestion

                // Italicize location names
                if (suggestion.isName) { // If the isName component of the suggestion is true...
                    item.style.fontStyle = 'italic'; // Apply an inline style that makes the suggestion italicized.
                }

                // When a suggestion is clicked, fill the search bar with the item and clear suggestions
                L.DomEvent.on(item, 'click', function() { // When the suggestion div is clicked...
                    input.value = suggestion.text;
                    activeFilters.searchTerm = suggestion.text;
                    applyFilters();
                    dropdown.style.display = 'none'; // Remove the suggestions display.
                });
            });
        } else {
            dropdown.style.display = 'none';
        }
    };

    // Create time filter control
    function createTimeFilter() {
        // Initialize filter menu
        var timeFilter = L.Control.extend({
            options: {position: 'topleft'},

            onAdd: function () {
                // Create control container div
                var container = L.DomUtil.create('div', 'timefilter-container');

                // Container content, custom time input is hidden until the option is selected.
                var content = L.DomUtil.create('div', 'timefilter-content', container);
                content.innerHTML = `
                    <b>Filter to locations available...</b>
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
                    <div id = 'custom-time-input' style = 'display: none;'>
                        <input type = 'time' id = 'custom-time' placeholder='Select time (HH:MM)'>
                    </div>
                `;

                var radios = content.querySelectorAll('input[name="availability"]');
                var customTimeInput = content.querySelector('#custom-time');
                var customTimeContainer = content.querySelector('#custom-time-input');

                radios.forEach(function(radio) {
                    L.DomEvent.on(radio, 'change', function() { // When one of the radio buttons is pressed...
                        activeFilters.timeMode = radio.value; // Change the value of activeFilters's timeMode attribute to the value of that radio button ('rightnow', 'anytime', or 'custom'.)

                        // Show/hide custom time input
                        if (radio.value === 'custom') {
                            customTimeContainer.style.display = 'block'
                        } else {
                            customTimeContainer.style.display = 'none'
                        }

                        applyFilters();
                    });
                });

                // Listen for custom time changes
                L.DomEvent.on(customTimeInput, 'change', function() {
                    activeFilters.customTime = customTimeInput.value;
                    applyFilters();
                })

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
