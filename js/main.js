// main.js, by Joseph Kowalczyk, James Clunes, and Brooke Fandrich
(function(){

    // Pseudoglobal Variables
    var map;
    var locationsLayer; // Enables filtering via search and other filter controls
    var accessMode = sessionStorage.getItem('commonGoodAccessMode')
    var activeFilters = { searchTerm: '', timeMode: 'anytime', categories: new Set(), customDay: null };
    var MAP_ICON_ALLOWLIST = [
        'bicycle.svg',
        'courthouse.svg',
        'diy.svg',
        'garden_centre.svg',
        'hotel.svg',
        'library.svg',
        'restaurant.svg',
        'social_facility.svg',
        'trade.svg'
    ];
    
    var iconSvgCache = {};

    // Fetches an SVG icon file by name, using a cache to avoid redundant network requests.
    function fetchIconSvg(iconFile, callback) {
        if (!iconFile) { callback(''); return;} // No icon specified, return empty string immediately
        if (iconSvgCache[iconFile]) { callback(iconSvgCache[iconFile]); return; } // Return cached SVG if already fetched

        fetch('img/map-icons/' + iconFile)
            .then(function(r) { return r.text(); }) // Read response body as text
            .then(function(svgText) {
                iconSvgCache[iconFile] = svgText; // Store result in cache for future calls
                callback(svgText);
            })
            .catch(function() { callback(''); }); // On error, return empty string to avoid breaking the icon build
    }



    function buildMapIcon(iconFile, category, callback) {
        var color = (CATEGORY_META[category] && CATEGORY_META[category].color) || '#555555';

        fetchIconSvg(iconFile, function(svgText) {
            // Strip the outer <svg> wrapper so we can nest it inside our pin SVG
            var inner = svgText
                .replace(/<\?xml[^>]*>/i, '')
                .replace(/<!DOCTYPE[^>]*>/i, '')
                .replace(/<svg[^>]*>/, '')
                .replace(/<\/svg>/, '')
                .trim();

            // Wrap in a group that scales and positions it into the pin's circle
            var iconGroup = inner
                ? '<g transform="translate(5,5) scale(1.2)" style="filter:brightness(0) invert(1)">' + inner + '</g>'
                : '<circle cx="14" cy="14" r="4" fill="rgba(255,255,255,0.9)"/>';

            var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38">'
                + '<ellipse cx="14" cy="35.5" rx="5" ry="2" fill="rgba(0,0,0,0.22)"/>'
                + '<path d="M14 2 C7.37 2 2 7.37 2 14 C2 22.5 14 36 14 36 C14 36 26 22.5 26 14 C26 7.37 20.63 2 14 2 Z" fill="' + color + '" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/>'
                + '<circle cx="14" cy="14" r="9.5" fill="rgba(255,255,255,0.18)"/>'
                + iconGroup
                + '</svg>';

            var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
            callback(L.icon({
                iconUrl:     url,
                iconSize:    [28, 38],
                iconAnchor:  [14, 38],
                popupAnchor: [0, -40]
            }));
        });
    }

    // Maps each location category name to its associated pin color used in buildMapIcon.
    var CATEGORY_META = {
            'Bicycle Access': { color: '#3a86cc' },
            'Food':           { color: '#e05c2a' },
            'Library':        { color: '#7c4dcc' },
            'Garden':         { color: '#3aaa5c' },
            'Housing':        { color: '#cc7a3a' },
            'Childcare':      { color: '#cc3a6e' },
            'Crafting':       { color: '#888888' },
            'Tool Rental':    { color: '#b07d2a' },
            'Legal':          { color: '#4a5a8c' },
        };

    // ── Guest session: clear data on page reload ────────────────────────────────
    function handleGuestReload() {
        var navigationEntries = performance.getEntriesByType('navigation'); // Retrieve navigation timing entries
        var navigationType = navigationEntries.length ? navigationEntries[0].type : ''; // Extract the navigation type (e.g. 'reload', 'navigate')

        if (accessMode === 'guest' && navigationType === 'reload') {
            sessionStorage.clear(); // Wipe guest session data so the user is not left in a partial state after reload
            accessMode = null; // Reset local access mode to prevent stale guest state
        }
    }

    // ── Map initialisation ──────────────────────────────────────────────────────

    // Creating leaflet map
    function mapInit() {
        handleGuestReload();
        initWelcomeModal();

        map = L.map('map', {
            zoomControl: false // Remove zoom control to reposition later.
        }).setView([43.08, -89.38], 13);

        // Add tileset
        L.tileLayer('https://api.thunderforest.com/transport/{z}/{x}/{y}.{ext}?apikey=848f71faa05242a78e5ca550fa29890f', {
            minZoom: 0,
            maxZoom: 20,
            attribution: '&copy; <a href="https://www.thundermaps.com/" target="_blank">ThunderMaps</a> &copy;  <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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
                createNavMenu(json); // moving into here to receive the locations.geojson
                createTimeFilter(json);
            });

        createInfoButton();
        createSearchFilter();
        createZoom();
    };

    // This escapes special HTML characters in a value so it is safe to insert into popup content.
    function escapeHtml(value) {
        var text = value === null || value === undefined ? '' : String(value);
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // This builds the correct detail page URL for a location, using the source type and id from its properties.
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

    // This assembles the HTML string shown inside a map marker popup, including name, contact, hours, and a details link.
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
//  
    function createSymbols(data) {
        locationsLayer = L.geoJson(data, {
            pointToLayer: function(feature, latlng) {
                var props    = feature.properties || {};
                var marker   = L.marker(latlng); // placeholder until icon loads
                buildMapIcon(props.iconFile || '', props.Category || '', function(icon) {
                    marker.setIcon(icon);
                });
                return marker;
            },
            onEachFeature: function(feature, layer) {
                layer.properties = feature.properties;
                layer.bindPopup(buildPopupContent(layer.properties));
            }
        }).addTo(map);
    }

    // ── User-created locations from sessionStorage ──────────────────────────────
    // Star-shaped div icon used to mark locations created by the current user on the map.
    var userStarIcon = L.divIcon({
        className: '',
        html: '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">' +
              '<polygon points="17,2 21.5,13 33,13 23.5,20 27,31 17,24 7,31 10.5,20 1,13 12.5,13" ' +
              'fill="#f5a623" stroke="#b8740a" stroke-width="1.5" stroke-linejoin="round"/>' +
              '</svg>',
        iconSize: [34, 34],
        iconAnchor: [17, 17], // Anchor at center of icon
        popupAnchor: [0, -18] // Popup appears above the icon
    });

    function addUserLocations() {
        var raw;
        try {
            raw = JSON.parse(sessionStorage.getItem('commonGoodCreatedLocations') || '[]'); // Parse stored user locations from sessionStorage
        } catch (e) {
            raw = []; // Fall back to empty array if stored data is malformed
        }

        raw.forEach(function (entry, index) {
            if (!entry || typeof entry !== 'object') { return; } // Skip invalid entries
            var lat = entry.lat;
            var lon = entry.lon;
            if (lat === null || lat === undefined || lon === null || lon === undefined) { return; } // Skip entries missing coordinates

            // Build a GeoJSON-style feature object from the stored entry data
            var feature = {
                type: 'Feature',
                properties: {
                    Name: entry.name || 'Your Location',
                    Description: entry.description || '',
                    Contact: entry.contact || '',
                    Hours: entry.hours || '',
                    Link: entry.siteUrl || '',
                    Services: entry.servicesText || '',
                    isUserCreated: true, // Flag used by buildDetailsUrl to generate the correct detail page link
                    userLocationId: entry.locationId || ('legacy-' + index) // Use stored ID or fall back to index-based ID for older entries
                },
                geometry: {
                    type: 'Point',
                    coordinates: [lon, lat]
                }
            };

            var marker = L.marker([lat, lon], { icon: userStarIcon }); // Place the star icon at the user's stored coordinates
            marker.properties = feature.properties;
            marker.bindPopup(buildPopupContent(feature.properties));
            locationsLayer.addLayer(marker); // Add directly to locationsLayer so it participates in filtering
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
                L.DomEvent.disableScrollPropagation(suggestionsDropdown); // disables map scroll zoom

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

    // This applies the current search term and time mode filters together, showing or hiding each marker accordingly.
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

            var activeCats = activeFilters.categories;
            var matchesCategory = activeCats.size === 0 || activeCats.has(layer.properties.Category || '');
            
            if (matchesSearch && matchesTime && matchesCategory) { //If it matches search and matches time...
                layer.addTo(map); // Adds the marker to the map
            } else { 
                layer.removeFrom(map); // Remove the marker from the map until it meets search criteria
            }
        });
    };

    // This checks whether a location is currently open based on its parsed hours and the current day and time.
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

    // This checks whether a location is open at a specific custom time string on the current day of the week.
    function isOpenAtTime(hoursParsed, timeString) {
        if (hoursParsed === null) return true; // always show locations with unknown hours, i.e. "Check website for hours."
    
        // Parse timeString "HH:MM" to match HoursParsed in locations.geojson
        var timeParts = timeString.split(':');
        var time = parseInt(timeParts[0]) * 100 + parseInt(timeParts[1]);
        
        // Use custom day if set, otherwise fall back to today: jc
        var day = (activeFilters.customDay !== null)
            ? activeFilters.customDay
            : (new Date().getDay() + 6) % 7;
        
        
        var todayHours = hoursParsed[day];

        var todayHours = hoursParsed[day];
        
        if (todayHours === null) return false; // Always return false if location is closed
        var open = todayHours[0], close = todayHours[1];
        if (close < open) { // overnight span
            return time >= open || time < close;
        }
        return time >= open && time < close;
    }

    // This updates the search autocomplete dropdown with matching location names and service types as the user types.
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

                if (lower.includes(term) && !seen[lower]) { // If the lowercase service list includes the search term, has not been seen before, and the total number of suggestions does not exceed 5...
                    seen[lower] = true;
                    suggestions.push({text: trimmed, isName: false}); // Push a json object, text is what displays as the suggestion, isName will control if the suggestion is italicized or not.
                }
            });

            // Location name suggestions
            var nameRaw = layer.properties.Name || ''; // Likewise, but for location names instead of services
            var nameLower = nameRaw.toLowerCase(); // Saves a lowercase version of the location name, matches how search filter processes inputs

            if (nameLower.includes(term) && !seen[nameLower]) { // If the lowercase location name includes the search term, has not been seen before, and the total number of suggestions does not exceed 5...
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
    function createTimeFilter(geojson) {

        // set up categories for filter & legend
        var seenCats = {}; // Tracks categories already added to prevent duplicates
        var catsInData = []; // Ordered list of unique category objects to render in the legend
        (geojson ? geojson.features : []).forEach(function(feature) {
            var cat = (feature.properties && feature.properties.Category) || '';
            if (cat && !seenCats[cat]) {
                seenCats[cat] = true;
                catsInData.push({
                    category: cat,
                    iconFile: feature.properties.iconFile || '', // Icon image file name for the legend swatch
                    color: (CATEGORY_META[cat] && CATEGORY_META[cat].color) || '#555555' // Use CATEGORY_META color or fall back to grey
                });
            }
        });

        
        // Initialize filter menu
        var timeFilter = L.Control.extend({
            options: {position: 'topleft'},

            onAdd: function () {
                // Create control container div
                var container = L.DomUtil.create('div', 'timefilter-container');
                var content = L.DomUtil.create('div','timefilter-content', container);
                

                // setting up filter legend - jc
                var filterHeading = L.DomUtil.create('p', 'navmenu-filter-heading', content);
                filterHeading.innerHTML = '<b>Filter by Category</b>';

                var legend = L.DomUtil.create('div', 'navmenu-legend', content);

                catsInData.forEach(function(entry) {
                    var groupRow = L.DomUtil.create('div', 'legend-group-row', legend);

                    //checkboxes - jc
                    var checkbox = L.DomUtil.create('input', 'legend-group-checkbox', groupRow);
                    checkbox.type = 'checkbox';
                    checkbox.id = 'filter-cat-' + entry.category.replace(/\s+/g, '-');

                    //colored swatch with icon image:
                    var swatch = L.DomUtil.create('span', 'legend-swatch', groupRow);
                    swatch.style.background = entry.color;
                    if (entry.iconFile) {
                        var swatchImg = document.createElement('img');
                        swatchImg.src = 'img/map-icons/' + entry.iconFile;
                        swatchImg.style.cssText = 'width:16px;height:16px;filter:brightness(0) invert(1);display:block;margin:2px auto 0;';
                        swatch.appendChild(swatchImg);
                    }

                    // labeling
                    var label = L.DomUtil.create('label', 'legend-group-label', groupRow);
                    label.htmlFor     = checkbox.id;
                    label.textContent = entry.category;

                    // Checkbox change → update filter and re-apply
                    L.DomEvent.on(checkbox, 'change', function() {
                        if (checkbox.checked) {
                            activeFilters.categories.add(entry.category);
                        } else {
                            activeFilters.categories.delete(entry.category);
                        }
                        applyFilters();
                    });
                });

                // Clear all category filters button
                var clearBtn = L.DomUtil.create('button', 'navmenu-clear-filters', content);
                clearBtn.textContent = 'Clear Category Filters';
                L.DomEvent.on(clearBtn, 'click', function() {
                    activeFilters.categories.clear();
                    legend.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
                        cb.checked = false;
                    });
                    applyFilters();
                });  

                //Time radio buttons:
                var timeHeading = L.DomUtil.create('p', 'navmenu-filter-heading', content);
                timeHeading.innerHTML = '<b>Filter by Time </b>';

                var timeOptions = L.DomUtil.create('div', '', content);
                timeOptions.innerHTML = `
                   
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
                        <div class="custom-time-row">
                            <select id="custom-day">
                                <option value="0">Monday</option>
                                <option value="1">Tuesday</option>
                                <option value="2">Wednesday</option>
                                <option value="3">Thursday</option>
                                <option value="4">Friday</option>
                                <option value="5">Saturday</option>
                                <option value="6">Sunday</option>
                            </select>
                            <input type="text" id="custom-time" placeholder="HH:MM">
                        </div>
                    </div>
                `;

                var radios = timeOptions.querySelectorAll('input[name="availability"]');
                var customTimeInput = timeOptions.querySelector('#custom-time');
                var customTimeContainer = timeOptions.querySelector('#custom-time-input');

                var customDaySelect = timeOptions.querySelector('#custom-day');

                // Set the day selector to default to today's day
                var todayIndex = (new Date().getDay() + 6) % 7; // Convert JS Sunday=0 to Monday=0 index
                customDaySelect.value = String(todayIndex);

                L.DomEvent.on(customTimeInput, 'change', function() {
                    activeFilters.customTime = customTimeInput.value;
                    activeFilters.customDay  = parseInt(customDaySelect.value);
                    applyFilters();
                });

                L.DomEvent.on(customTimeInput, 'focus', function() {
                    customTimeInput.type = 'time';
                });

                L.DomEvent.on(customTimeInput, 'blur', function() {
                    if (!customTimeInput.value) {
                        customTimeInput.type = 'text';
                    }
                });

                L.DomEvent.on(customDaySelect, 'change', function() {
                    activeFilters.customDay = parseInt(customDaySelect.value);
                    applyFilters();
                });

                radios.forEach(function(radio) {
                    L.DomEvent.on(radio, 'change', function() { // When one of the radio buttons is pressed...
                        activeFilters.timeMode = radio.value; // Change the value of activeFilters's timeMode attribute to the value of that radio button ('rightnow', 'anytime', or 'custom'.)
                        
                        customTimeContainer.style.display = radio.value === 'custom' ? 'block' : 'none'; // Show the custom time row only when 'Custom' is selected

                        applyFilters();
                    });
                });



                // Listen for custom time changes
                L.DomEvent.on(customTimeInput, 'change', function() {
                    activeFilters.customTime = customTimeInput.value;
                    applyFilters();
                });
  

                // Disable click propagation
                L.DomEvent.disableClickPropagation(container);

                return container;
            }
        });



        map.addControl(new timeFilter());
    };

    // ── Welcome modal ───────────────────────────────────────────────────────────
    function initWelcomeModal() {
        var backdrop = document.getElementById('welcome-backdrop');
        var closeBtn = document.getElementById('welcome-close-btn');

        if (!backdrop || !closeBtn) { return; } // Exit early if modal elements are not present in the DOM

        // Hides the modal by adding the hidden CSS class to the backdrop element
        function closeModal() {
            backdrop.classList.add('welcome-backdrop--hidden');
        }

        closeBtn.addEventListener('click', closeModal); // Close when the explicit close button is clicked

        // Close when the user clicks the backdrop area outside the modal box
        backdrop.addEventListener('click', function (e) {
            if (e.target === backdrop) { closeModal(); }
        });

        // Close when the Escape key is pressed, only if the modal is currently visible
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !backdrop.classList.contains('welcome-backdrop--hidden')) {
                closeModal();
            }
        });
    }

    // ── Info button (re-open welcome modal) ────────────────────────────────────
    function createInfoButton() {
        var infoControl = L.Control.extend({
            options: { position: 'topright' },

            onAdd: function () {
                var btn = L.DomUtil.create('button', 'info-btn');
                btn.type = 'button';
                btn.setAttribute('aria-label', 'About CommonGood'); // Accessibility label for screen readers
                btn.title = 'About CommonGood'; // Tooltip shown on hover
                btn.innerHTML = '<span aria-hidden="true">i</span>'; // Visual 'i' glyph, hidden from screen readers since aria-label covers it

                // Re-show the welcome modal when the info button is clicked
                L.DomEvent.on(btn, 'click', function () {
                    var backdrop = document.getElementById('welcome-backdrop');
                    if (backdrop) {
                        backdrop.classList.remove('welcome-backdrop--hidden'); // Remove hidden class to make the modal visible again
                    }
                });

                L.DomEvent.disableClickPropagation(btn); // Prevent click from passing through to the map
                return btn;
            }
        });

        map.addControl(new infoControl());
    }

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
                        '<p><a href="hosting/location/">Locations</a></p>' +
                        '<p><a href="profile.html">Profile</a></p>' +
                        '<p><a href="#" id="logout-nav-link">Logout</a></p>';

                    // Wire logout to clear session before navigating
                    var logoutLink = content.querySelector('#logout-nav-link');
                    L.DomEvent.on(logoutLink, 'click', function() {
                        sessionStorage.removeItem('commonGoodAccessMode'); // Remove access mode so the user is treated as logged out
                        sessionStorage.removeItem('commonGoodUserEmail'); // Remove stored email to fully clear the session
                        window.location.href = 'index.html'; // Redirect to the landing page
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