// main.js, by Joseph Kowalczyk, James Clunes, and Brooke Fandrich
(function(){

    // ── Pseudoglobal Variables ──────────────────────────────────────────────────
    var map;
    var locationsLayer;   // Enables filtering via search and other filter controls
    var accessMode = sessionStorage.getItem('commonGoodAccessMode');
    var activeFilters = { searchTerm: '', timeMode: 'anytime', categories: new Set() };

    // ── Category metadata: display label and pin color, keyed by Category value ─
    // iconFile comes from the GeoJSON itself; this table only adds the color and
    // a human-friendly label for the nav menu legend.
    var CATEGORY_META = {
        'Bicycle Access': { label: 'Bicycle Access', color: '#3a86cc' },
        'Food':           { label: 'Food',            color: '#e05c2a' },
        'Library':        { label: 'Library',         color: '#7c4dcc' },
        'Garden':         { label: 'Garden',          color: '#3aaa5c' },
        'Housing':        { label: 'Housing',         color: '#cc7a3a' },
        'Childcare':      { label: 'Childcare',       color: '#cc3a6e' },
        'Crafting':       { label: 'Crafting',        color: '#888888' },
        'Tool Rental':    { label: 'Tool Rental',     color: '#b07d2a' },
        'Legal':          { label: 'Legal',           color: '#4a5a8c' },
    };

    // Fallback for any category not in the table above
    var FALLBACK_META = { label: 'Other', color: '#555555' };

    function getCategoryMeta(category) {
        return CATEGORY_META[category] || FALLBACK_META;
    }

    // ── Build a pin icon that composites the OSM symbol SVG inside a teardrop ──
    // The pin SVG uses an <image> element referencing the file on disk, so the
    // browser loads it the same way it would any img src. The symbol is rendered
    // in white inside a colored circle so it reads cleanly at marker scale.
    function makeCategoryIcon(category, iconFile) {
        var meta   = getCategoryMeta(category);
        var color  = meta.color;
        var imgSrc = iconFile ? 'data/icons/' + iconFile : '';

        // Inner image element — only included when we have an icon file
        var imageEl = imgSrc
            ? '<image href="' + imgSrc + '" x="5" y="5" width="18" height="18" ' +
              'style="filter: brightness(0) invert(1);" />'
            : '<circle cx="14" cy="14" r="4" fill="rgba(255,255,255,0.9)"/>';

        var svg = [
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"',
            '     width="28" height="38" viewBox="0 0 28 38">',
            '  <!-- drop shadow -->',
            '  <ellipse cx="14" cy="35.5" rx="5" ry="2" fill="rgba(0,0,0,0.22)"/>',
            '  <!-- teardrop body -->',
            '  <path d="M14 2 C7.37 2 2 7.37 2 14 C2 22.5 14 36 14 36 C14 36 26 22.5 26 14 C26 7.37 20.63 2 14 2 Z"',
            '        fill="' + color + '" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/>',
            '  <!-- subtle inner highlight -->',
            '  <circle cx="14" cy="14" r="9.5" fill="rgba(255,255,255,0.18)"/>',
            '  <!-- OSM symbol (white) -->',
            '  ' + imageEl,
            '</svg>'
        ].join('\n');

        var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        return L.icon({
            iconUrl:     url,
            iconSize:    [28, 38],
            iconAnchor:  [14, 38],
            popupAnchor: [0, -40]
        });
    }

    // ── Guest session: clear data on page reload ────────────────────────────────
    function handleGuestReload() {
        var navigationEntries = performance.getEntriesByType('navigation');
        var navigationType = navigationEntries.length ? navigationEntries[0].type : '';
        
        if (accessMode === 'guest' && navigationType === 'reload') {
            sessionStorage.clear();
            accessMode = null;
        }
    }

    // ── Title bar across the top ────────────────────────────────────────────────
    function createTitleBar() {
        var bar = document.createElement('div');
        bar.id = 'title-bar';
        bar.innerHTML = '<span class="title-bar-logo">⬡</span>' +
                        '<span class="title-bar-text">Common Good Madison</span>';
        document.body.insertBefore(bar, document.body.firstChild);

        var mapEl = document.getElementById('map');
        if (mapEl) {
            mapEl.style.top    = '48px';
            mapEl.style.height = 'calc(100% - 48px)';
        }
    }

    // ── Map initialisation ──────────────────────────────────────────────────────
    function mapInit() {
        handleGuestReload();
        createTitleBar();

        map = L.map('map', {
            zoomControl: false
        }).setView([43.08, -89.38], 13);

        L.tileLayer('https://api.thunderforest.com/transport/{z}/{x}/{y}.{ext}?apikey=848f71faa05242a78e5ca550fa29890f', {
            minZoom: 0,
            maxZoom: 20,
            attribution: '&copy; <a href="https://www.thundermaps.com/" target="_blank">ThunderMaps</a>' +
                         ' &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            ext: 'png'
        }).addTo(map);

        addData(map);
    }

    // ── Load GeoJSON, then wire up all controls ─────────────────────────────────
    // createNavMenu is called inside the fetch callback so the legend can be
    // built from the actual categories present in the data.
    function addData(map) {
        fetch('data/locations.geojson')
            .then(function(response) { return response.json(); })
            .then(function(json) {
                createSymbols(json);
                addUserLocations();
                createNavMenu(json);   // pass json so legend reflects real data
            });

        // Controls that don't depend on the data can be added immediately
        createSearchFilter();
        createTimeFilter();
        createZoom();
    }

    // ── HTML helpers ────────────────────────────────────────────────────────────
    function escapeHtml(value) {
        var text = (value === null || value === undefined) ? '' : String(value);
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function buildDetailsUrl(properties) {
        if (!properties) return 'location-details.html';

        if (properties.isUserCreated) {
            var params = ['source=user'];
            if (properties.userLocationId) params.push('id=' + encodeURIComponent(properties.userLocationId));
            if (properties.Name)           params.push('name=' + encodeURIComponent(properties.Name));
            return 'location-details.html?' + params.join('&');
        }

        if (properties.Key !== undefined && properties.Key !== null) {
            return 'location-details.html?source=dataset&id=' + encodeURIComponent(properties.Key);
        }

        return 'location-details.html';
    }

    function buildPopupContent(properties) {
        var name        = escapeHtml(properties && properties.Name        ? properties.Name        : 'Community Location');
        var description = escapeHtml(properties && properties.Description ? properties.Description : 'No description available yet.');
        var contact     = escapeHtml(properties && properties.Contact     ? properties.Contact     : 'Not listed');
        var hours       = escapeHtml(properties && properties.Hours       ? properties.Hours       : 'Not listed');
        var services    = escapeHtml(properties && properties.Services    ? properties.Services    : 'Not listed');
        var link        = properties && properties.Link ? properties.Link : '';
        var detailsUrl  = buildDetailsUrl(properties || {});

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
            '<p><a href="' + detailsUrl + '" class="popup-button">Details...</a></p>',
            '</div>'
        ].join('');
    }

    // ── Render GeoJSON features as styled markers ───────────────────────────────
    function createSymbols(data) {
        locationsLayer = L.geoJson(data, {
            pointToLayer: function(feature, latlng) {
                var props    = feature.properties || {};
                var category = props.Category || '';
                var iconFile = props.iconFile  || '';
                return L.marker(latlng, { icon: makeCategoryIcon(category, iconFile) });
            },
            onEachFeature: function(feature, layer) {
                layer.properties = feature.properties;
                layer.bindPopup(buildPopupContent(layer.properties));
            }
        }).addTo(map);
    }

    // ── User-created locations from sessionStorage ──────────────────────────────
    function addUserLocations() {
        var raw;
        try {
            raw = JSON.parse(sessionStorage.getItem('commonGoodCreatedLocations') || '[]');
        } catch(e) {
            raw = [];
        }

        raw.forEach(function(entry, index) {
            if (!entry || typeof entry !== 'object') return;
            if (entry.lat == null || entry.lon == null) return;

            var feature = {
                type: 'Feature',
                properties: {
                    Name:           entry.name         || 'Your Location',
                    Description:    entry.description  || '',
                    Contact:        entry.contact      || '',
                    Hours:          entry.hours        || '',
                    Link:           entry.siteUrl      || '',
                    Services:       entry.servicesText || '',
                    Category:       entry.category     || '',
                    iconFile:       entry.icon         || '',
                    isUserCreated:  true,
                    userLocationId: entry.locationId   || ('legacy-' + index)
                },
                geometry: {
                    type: 'Point',
                    coordinates: [entry.lon, entry.lat]
                }
            };

            locationsLayer.addData(feature);
        });
    }

    // ── Filtering ───────────────────────────────────────────────────────────────
    function applyFilters() {
        var term       = activeFilters.searchTerm.toLowerCase().trim();
        var mode       = activeFilters.timeMode;
        var activeCats = activeFilters.categories; // Set of category strings; empty = show all

        locationsLayer.eachLayer(function(layer) {
            if (!layer.properties) return;

            var name     = (layer.properties.Name     || '').toLowerCase();
            var services = (layer.properties.Services || '').toLowerCase();
            var matchesSearch = !term || name.includes(term) || services.includes(term);

            var matchesTime = true;
            if (mode === 'rightnow') {
                matchesTime = isOpenNow(layer.properties.HoursParsed);
            } else if (mode === 'custom' && activeFilters.customTime) {
                matchesTime = isOpenAtTime(layer.properties.HoursParsed, activeFilters.customTime);
            }

            // Category filter: empty Set means "show all"
            var matchesCategory = activeCats.size === 0 ||
                                  activeCats.has(layer.properties.Category || '');

            if (matchesSearch && matchesTime && matchesCategory) {
                layer.addTo(map);
            } else {
                layer.removeFrom(map);
            }
        });
    }

    function isOpenNow(hoursParsed) {
        if (hoursParsed === null) return true;
        var now  = new Date();
        var day  = (now.getDay() + 6) % 7; // JS Sun=0 → Mon=0
        var time = now.getHours() * 100 + now.getMinutes();
        var slot = hoursParsed[day];
        if (!slot) return false;
        var open = slot[0], close = slot[1];
        return close < open ? (time >= open || time < close)
                            : (time >= open && time < close);
    }

    function isOpenAtTime(hoursParsed, timeString) {
        if (hoursParsed === null) return true;
        var parts = timeString.split(':');
        var time  = parseInt(parts[0]) * 100 + parseInt(parts[1]);
        var day   = (new Date().getDay() + 6) % 7;
        var slot  = hoursParsed[day];
        if (!slot) return false;
        var open = slot[0], close = slot[1];
        return close < open ? (time >= open || time < close)
                            : (time >= open && time < close);
    }

    // ── Search filter control ───────────────────────────────────────────────────
    function createSearchFilter() {
        var searchFilter = L.Control.extend({
            options: { position: 'topleft' },

            onAdd: function() {
                var container = L.DomUtil.create('div', 'searchfilter-container');

                var input = L.DomUtil.create('input', 'searchfilter-input', container);
                input.type        = 'text';
                input.placeholder = 'Search location name or service type...';

                var suggestionsDropdown = L.DomUtil.create('div', 'searchfilter-suggestions', container);
                suggestionsDropdown.style.display = 'none';

                L.DomEvent.on(input, 'input', function() {
                    activeFilters.searchTerm = input.value;
                    applyFilters();
                    updateSuggestions(input.value, suggestionsDropdown, input);
                });

                var resetButton = L.DomUtil.create('button', 'searchfilter-reset', container);
                resetButton.innerHTML = '↺';
                resetButton.title     = 'Clear search';
                L.DomEvent.on(resetButton, 'click', function() {
                    input.value              = '';
                    activeFilters.searchTerm = '';
                    applyFilters();
                    suggestionsDropdown.style.display = 'none';
                });

                L.DomEvent.disableClickPropagation(container);
                return container;
            }
        });

        map.addControl(new searchFilter());
    }

    function updateSuggestions(searchTerm, dropdown, input) {
        var term = searchTerm.toLowerCase().trim();
        dropdown.innerHTML = '';

        if (!term) { dropdown.style.display = 'none'; return; }

        var seen        = {};
        var suggestions = [];

        locationsLayer.eachLayer(function(layer) {
            if (!layer.properties) return;

            // Service tag suggestions
            (layer.properties.Services || '').split(',').forEach(function(tag) {
                var trimmed = tag.trim();
                var lower   = trimmed.toLowerCase();
                if (lower.includes(term) && !seen[lower] && suggestions.length < 5) {
                    seen[lower] = true;
                    suggestions.push({ text: trimmed, isName: false });
                }
            });

            // Location name suggestions
            var name      = layer.properties.Name || '';
            var nameLower = name.toLowerCase();
            if (nameLower.includes(term) && !seen[nameLower] && suggestions.length < 5) {
                seen[nameLower] = true;
                suggestions.push({ text: name, isName: true });
            }
        });

        if (suggestions.length > 0) {
            dropdown.style.display = 'block';
            suggestions.forEach(function(s) {
                var item = L.DomUtil.create('div', 'suggestion-item', dropdown);
                item.textContent = s.text;
                if (s.isName) item.style.fontStyle = 'italic';
                L.DomEvent.on(item, 'click', function() {
                    input.value              = s.text;
                    activeFilters.searchTerm = s.text;
                    applyFilters();
                    dropdown.style.display = 'none';
                });
            });
        } else {
            dropdown.style.display = 'none';
        }
    }

    // ── Time filter control ─────────────────────────────────────────────────────
    function createTimeFilter() {
        var timeFilter = L.Control.extend({
            options: { position: 'topleft' },

            onAdd: function() {
                var container = L.DomUtil.create('div', 'timefilter-container');
                var content   = L.DomUtil.create('div', 'timefilter-content', container);
                content.innerHTML = `
                    <b>Filter to locations available...</b>
                    <div>
                        <input type="radio" class="inputbutton" id="rightnow" name="availability" value="rightnow">
                        <label for="rightnow">Right Now</label>
                    </div>
                    <div>
                        <input type="radio" class="inputbutton" id="anytime" name="availability" value="anytime">
                        <label for="anytime">Any Time</label>
                    </div>
                    <div>
                        <input type="radio" class="inputbutton" id="custom" name="availability" value="custom">
                        <label for="custom">Custom</label>
                    </div>
                    <div id="custom-time-input" style="display:none;">
                        <input type="time" id="custom-time">
                    </div>
                `;

                var radios              = content.querySelectorAll('input[name="availability"]');
                var customTimeInput     = content.querySelector('#custom-time');
                var customTimeContainer = content.querySelector('#custom-time-input');

                radios.forEach(function(radio) {
                    L.DomEvent.on(radio, 'change', function() {
                        activeFilters.timeMode = radio.value;
                        customTimeContainer.style.display = radio.value === 'custom' ? 'block' : 'none';
                        applyFilters();
                    });
                });

                L.DomEvent.on(customTimeInput, 'change', function() {
                    activeFilters.customTime = customTimeInput.value;
                    applyFilters();
                });

                L.DomEvent.disableClickPropagation(container);
                return container;
            }
        });

        map.addControl(new timeFilter());
    }

    // ── Navigation menu ─────────────────────────────────────────────────────────
    // Receives the parsed GeoJSON so the legend can reflect the real categories
    // present in the data rather than a hardcoded list.
    function createNavMenu(geojson) {
        // Collect unique categories from the loaded data, preserving first-seen order
        var seenCats   = {};
        var catsInData = [];
        (geojson ? geojson.features : []).forEach(function(feature) {
            var cat = (feature.properties && feature.properties.Category) || '';
            if (cat && !seenCats[cat]) {
                seenCats[cat] = true;
                catsInData.push({
                    category: cat,
                    iconFile: feature.properties.iconFile || '',
                    meta:     getCategoryMeta(cat)
                });
            }
        });

        var navMenu = L.Control.extend({
            options: { position: 'topright' },

            onAdd: function() {
                var container = L.DomUtil.create('div', 'navmenu-container');

                var button = L.DomUtil.create('button', 'navmenu-button', container);
                button.innerHTML = '<img src="img/menu.svg" alt="Menu">';

                var content = L.DomUtil.create('div', 'navmenu-content', container);

                // ── Nav links ──────────────────────────────────────────────────
                if (accessMode) {
                    content.innerHTML =
                        '<p><a href="hosting/location.html">Locations</a></p>' +
                        '<p><a href="profile.html">Profile</a></p>' +
                        '<p><a href="#" id="logout-nav-link">Logout</a></p>';

                    var logoutLink = content.querySelector('#logout-nav-link');
                    L.DomEvent.on(logoutLink, 'click', function() {
                        sessionStorage.removeItem('commonGoodAccessMode');
                        sessionStorage.removeItem('commonGoodUserEmail');
                        window.location.href = 'index.html';
                    });
                } else {
                    content.innerHTML = '<p><a href="login.html">Login</a></p>';
                }

                // ── Category filter legend ─────────────────────────────────────
                var filterHeading = L.DomUtil.create('p', 'navmenu-filter-heading', content);
                filterHeading.innerHTML = '<b>Filter by Category</b>';

                var legend = L.DomUtil.create('div', 'navmenu-legend', content);

                catsInData.forEach(function(entry) {
                    var groupRow = L.DomUtil.create('div', 'legend-group-row', legend);

                    // Checkbox
                    var checkbox = L.DomUtil.create('input', 'legend-group-checkbox', groupRow);
                    checkbox.type = 'checkbox';
                    checkbox.id   = 'filter-cat-' + entry.category.replace(/\s+/g, '-');

                    // Colored pin swatch with icon image
                    var swatch = L.DomUtil.create('span', 'legend-swatch', groupRow);
                    swatch.style.background = entry.meta.color;

                    if (entry.iconFile) {
                        var swatchImg = document.createElement('img');
                        swatchImg.src = 'data/icons/' + entry.iconFile;
                        swatchImg.style.cssText =
                            'width:9px;height:9px;filter:brightness(0) invert(1);' +
                            'display:block;margin:2px auto 0;';
                        swatch.appendChild(swatchImg);
                    }

                    // Label
                    var label = L.DomUtil.create('label', 'legend-group-label', groupRow);
                    label.htmlFor     = checkbox.id;
                    label.textContent = entry.meta.label;

                    // Checkbox change → update filter
                    L.DomEvent.on(checkbox, 'change', function() {
                        if (checkbox.checked) {
                            activeFilters.categories.add(entry.category);
                        } else {
                            activeFilters.categories.delete(entry.category);
                        }
                        applyFilters();
                    });
                });

                // Clear button
                var clearBtn = L.DomUtil.create('button', 'navmenu-clear-filters', content);
                clearBtn.textContent = 'Clear Category Filters';
                L.DomEvent.on(clearBtn, 'click', function() {
                    activeFilters.categories.clear();
                    legend.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
                        cb.checked = false;
                    });
                    applyFilters();
                });

                // Toggle menu open/closed
                L.DomEvent.on(button, 'click', function() {
                    if (L.DomUtil.hasClass(container, 'expanded')) {
                        L.DomUtil.removeClass(container, 'expanded');
                    } else {
                        L.DomUtil.addClass(container, 'expanded');
                    }
                });

                L.DomEvent.disableClickPropagation(container);
                return container;
            }
        });

        map.addControl(new navMenu());
    }

    // ── Zoom control ────────────────────────────────────────────────────────────
    function createZoom() {
        L.control.zoom({ position: 'bottomleft' }).addTo(map);
    }

    // Runs mapInit() once the DOM loads.
    document.addEventListener('DOMContentLoaded', mapInit);

})(); // Must be the last line. Closes and executes the wrapping function.
