// add.js, by Joseph Kowalczyk, James Clunes, and Brooke Fandrich
(function () {
    // These are the sessionStorage key names used to store and read all location creator data across pages.
    var KEYS = {
        mode: 'commonGoodAccessMode',
        email: 'commonGoodUserEmail',
        profileName: 'commonGoodProfileName',
        profilePhoto: 'commonGoodProfilePhoto',
        locationName: 'commonGoodLocationName',
        locationAddress: 'commonGoodLocationAddress',
        createdLocation: 'commonGoodHasCreatedLocation',
        createdLocations: 'commonGoodCreatedLocations',
        locationDescription: 'commonGoodLocationDescription',
        socialLinks: 'commonGoodLocationSocialLinks',
        locationSiteUrl: 'commonGoodLocationSiteUrl',
        publicContactInfo: 'commonGoodPublicContactInfo',
        locationServices: 'commonGoodLocationServices',
        hostMaterials: 'commonGoodHostMaterials',
        guestMaterials: 'commonGoodGuestMaterials',
        locationBannerPhoto: 'commonGoodLocationBannerPhoto'
    };

    // This checks the URL for a mode=edit parameter so the page can behave differently when editing an existing location.
    var urlParams = new URLSearchParams(window.location.search);
    var isEditMode = urlParams.get('mode') === 'edit';

    // These variables hold the Leaflet map instance, marker, active tile layer, and autocomplete debounce timer.
    var accessMode = sessionStorage.getItem(KEYS.mode);
    var locationPreviewMap;
    var locationMarker;
    var activeTileLayer;
    var autocompleteTimer;
    var MADISON_VIEWBOX = '-89.74,43.24,-89.10,42.88';
    // This is a list of pre-written local suggestions shown in the address autocomplete dropdown before any API results arrive.
    var localLocationSuggestions = [
        'Madison, WI',
        '134 N Orchard St, Madison, WI',
        'State St, Madison, WI',
        'University Ave, Madison, WI',
        'Monroe St, Madison, WI',
        'East Washington Ave, Madison, WI',
        'Orchard St, Madison, WI',
        'Capitol Square, Madison, WI',
        'Camp Randall Stadium, Madison, WI',
        'Downtown Madison, WI',
        'Shorewood Hills, WI',
        'Maple Bluff, WI',
        'Middleton, WI',
        'Fitchburg, WI',
        'Sun Prairie, WI',
        'Verona, WI',
        'Monona, WI',
        'Waunakee, WI',
        'Oregon, WI',
        'Stoughton, WI',
        'McFarland, WI',
        'DeForest, WI',
        'Windsor, WI',
        'Cottage Grove, WI',
        'Cross Plains, WI',
        'Mount Horeb, WI'
    ];

    // This safely reads and parses a JSON value from sessionStorage, returning the fallback if the key is missing or invalid.
    function parseJsonFromSession(key, fallback) {
        try {
            var value = sessionStorage.getItem(key);
            if (!value) { return fallback; }
            return JSON.parse(value);
        } catch (error) {
            return fallback;
        }
    }

    // This updates the page title and button labels when the page is opened in edit mode.
    function setEditorModeLabels() {
        if (!isEditMode) { return; }

        var titleEl = document.title;
        if (titleEl) {
            document.title = 'CommonGood | Edit Location';
        }

        var topHeading = document.querySelector('.hosting-create-topbar h1');
        if (topHeading) {
            topHeading.textContent = 'Edit Location Details';
        }

        var submitButton = document.querySelector('#create-location-form button[type="submit"]');
        if (submitButton) {
            submitButton.textContent = 'Save Changes to CommonGood';
        }
    }

    // This pre-fills the location name and address inputs from sessionStorage when returning to edit an existing location.
    function prefillCoreLocationInputs() {
        var locNameInput = document.getElementById('loc-name');
        var mapQueryInput = document.getElementById('location-query');
        var savedLocationName = sessionStorage.getItem(KEYS.locationName);
        var savedLocationAddress = sessionStorage.getItem(KEYS.locationAddress);

        if (locNameInput && savedLocationName) {
            locNameInput.value = savedLocationName;
        }

        if (mapQueryInput && savedLocationAddress) {
            mapQueryInput.value = savedLocationAddress;
        }
    }

    // This appends ", Wisconsin" to a query string if the user has not already typed a state name.
    function toWisconsinQuery(text) {
        if (/\b(wi|wisconsin)\b/i.test(text)) {
            return text;
        }
        return text + ', Wisconsin';
    }

    // This filters the local suggestion list to find entries that match what the user has typed so far.
    function getLocalSuggestionMatches(value, limit) {
        var loweredValue = value.toLowerCase().trim();
        if (!loweredValue) { return []; }

        var tokens = loweredValue.split(/\s+/).filter(Boolean);

        return localLocationSuggestions
            .filter(function (item) {
                var loweredItem = item.toLowerCase();

                // Prefer direct substring matches.
                if (loweredItem.indexOf(loweredValue) !== -1) {
                    return true;
                }

                // Fallback: all typed tokens must appear somewhere in the suggestion.
                return tokens.every(function (token) {
                    return loweredItem.indexOf(token) !== -1;
                });
            })
            .slice(0, limit || 5);
    }

    // This abbreviates common street-type words like "avenue" to "Ave" so addresses look consistent.
    function normalizeStreetWord(word) {
        var map = {
            north: 'N',
            south: 'S',
            east: 'E',
            west: 'W',
            street: 'St',
            avenue: 'Ave',
            road: 'Rd',
            boulevard: 'Blvd',
            drive: 'Dr',
            lane: 'Ln',
            court: 'Ct',
            place: 'Pl'
        };

        var lower = word.toLowerCase();
        return map[lower] || word;
    }

    // This converts a full state name like "wisconsin" into its two-letter abbreviation.
    function toStateCode(stateValue) {
        if (!stateValue) { return ''; }

        var lowered = stateValue.toLowerCase();
        if (lowered === 'wisconsin') { return 'WI'; }
        if (lowered === 'illinois') { return 'IL'; }
        if (lowered === 'minnesota') { return 'MN'; }
        if (lowered === 'iowa') { return 'IA'; }
        if (lowered.length === 2) { return stateValue.toUpperCase(); }
        return stateValue;
    }

    // This builds a short human-readable address string from a Nominatim geocode result object.
    function toShortAddress(result) {
        var addr = result && result.address ? result.address : {};
        var house = addr.house_number || '';
        var street = addr.road || addr.pedestrian || addr.footway || '';
        var city = addr.city || addr.town || addr.village || addr.hamlet || 'Madison';
        var state = toStateCode(addr.state || addr.state_code || 'WI');

        if (street) {
            street = street
                .split(/\s+/)
                .map(normalizeStreetWord)
                .join(' ');
        }

        var left = (house + ' ' + street).trim();
        if (!left) {
            left = result.display_name ? result.display_name.split(',')[0].trim() : '';
        }

        if (left && city && state) {
            return left + ', ' + city + ', ' + state;
        }

        return left || result.display_name || '';
    }

    // This normalizes a road text string to lowercase with common abbreviations so two addresses can be compared reliably.
    function normalizeRoadText(value) {
        if (!value) { return ''; }

        return value
            .toLowerCase()
            .replace(/\bavenue\b/g, 'ave')
            .replace(/\bstreet\b/g, 'st')
            .replace(/\broad\b/g, 'rd')
            .replace(/\bboulevard\b/g, 'blvd')
            .replace(/\bdrive\b/g, 'dr')
            .replace(/\blane\b/g, 'ln')
            .replace(/\bcourt\b/g, 'ct')
            .replace(/\bplace\b/g, 'pl')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // This scores multiple geocode results and returns the one that best matches the user's typed query.
    function chooseBestGeocodeResult(query, results) {
        if (!results || !results.length) {
            return null;
        }

        var queryText = normalizeRoadText(query);
        var queryNumberMatch = queryText.match(/\b(\d{1,6})\b/);
        var queryNumber = queryNumberMatch ? queryNumberMatch[1] : '';
        var queryHasUniversity = queryText.indexOf('university') !== -1;

        var scored = results.map(function (item) {
            var addr = item && item.address ? item.address : {};
            var display = normalizeRoadText(item.display_name || '');
            var road = normalizeRoadText(addr.road || addr.pedestrian || addr.footway || '');
            var city = (addr.city || addr.town || addr.village || '').toLowerCase();
            var house = String(addr.house_number || '');
            var score = 0;

            if (city === 'madison') { score += 6; }
            if (queryNumber && house === queryNumber) { score += 8; }
            if (queryHasUniversity && road.indexOf('university') !== -1) { score += 6; }

            if (queryText && display.indexOf(queryText) !== -1) {
                score += 4;
            } else if (queryText) {
                var tokens = queryText.split(' ').filter(Boolean);
                var tokenMatches = tokens.filter(function (token) {
                    return display.indexOf(token) !== -1;
                }).length;
                score += tokenMatches;
            }

            return {
                score: score,
                item: item
            };
        });

        scored.sort(function (a, b) {
            return b.score - a.score;
        });

        return scored[0].item;
    }

    // This clears the guest session and redirects to the home page if the guest user reloads the page.
    function resetGuestSessionOnReload() {
        var navEntries = performance.getEntriesByType('navigation');
        var navType = navEntries.length ? navEntries[0].type : '';

        if (accessMode === 'guest' && navType === 'reload') {
            sessionStorage.clear();
            window.location.href = '../';
            return true;
        }

        return false;
    }

    // This redirects to the home page if there is no active session.
    function enforceAccess() {
        if (!accessMode) {
            window.location.href = '../';
        }
    }

    // This updates the header badge to show guest mode or the signed-in email.
    function updateSessionBadge() {
        var badge = document.getElementById('session-badge');
        if (!badge) { return; }

        if (accessMode === 'guest') {
            badge.textContent = 'Guest tester mode';
        } else {
            var email = sessionStorage.getItem(KEYS.email);
            badge.textContent = email ? 'Logged in as ' + email : 'Signed in';
        }
    }

    // This fills the host name and avatar in the listing preview area from sessionStorage.
    function loadHostInfo() {
        var nameEl = document.getElementById('listing-name');
        var avatarEl = document.getElementById('listing-avatar');

        if (nameEl) {
            var savedName = sessionStorage.getItem(KEYS.profileName);
            if (savedName) {
                nameEl.textContent = savedName;
            } else {
                nameEl.textContent = '';
            }
        }

        if (avatarEl) {
            var savedPhoto = sessionStorage.getItem(KEYS.profilePhoto);
            if (savedPhoto) { avatarEl.src = savedPhoto; }
        }
    }

    // This wires the banner photo upload button to open a file picker and save the image to sessionStorage.
    function bindBannerUpload() {
        var zone = document.getElementById('banner-upload-zone');
        var button = document.getElementById('banner-upload-btn');
        var input = document.getElementById('banner-input');
        var preview = document.getElementById('banner-preview');

        if (!input) { return; }

        if (zone) {
            zone.addEventListener('click', function () { input.click(); });
            zone.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { input.click(); }
            });
        }

        if (button) {
            button.addEventListener('click', function () { input.click(); });
        }

        input.addEventListener('change', function () {
            var file = input.files[0];
            if (!file) { return; }

            if (button) {
                button.textContent = 'Uploaded';
            }

            if (preview && zone) {
                var reader = new FileReader();
                reader.onload = function (e) {
                    preview.src = e.target.result;
                    zone.classList.add('has-image');
                    sessionStorage.setItem(KEYS.locationBannerPhoto, e.target.result);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // This wires the profile photo upload button to open a file picker and update both the preview and sessionStorage.
    function bindProfilePhotoUpload() {
        var button = document.getElementById('profile-photo-upload-btn');
        var input = document.getElementById('profile-photo-input');
        var listingAvatar = document.getElementById('listing-avatar');

        if (!button || !input) { return; }

        button.addEventListener('click', function () {
            input.click();
        });

        input.addEventListener('change', function () {
            var file = input.files[0];
            if (!file) { return; }

            button.textContent = 'Uploaded';

            if (listingAvatar) {
                var reader = new FileReader();
                reader.onload = function (e) {
                    listingAvatar.src = e.target.result;
                    sessionStorage.setItem(KEYS.profilePhoto, e.target.result);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // This generates a unique location ID from the name and the current timestamp.
    function makeLocationId(name) {
        var source = (name || 'location').toLowerCase();
        var slug = source.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
        return 'loc-' + (slug || 'item') + '-' + Date.now();
    }

    // This reads the public contact info from sessionStorage and formats it as a single display string.
    function buildContactLine() {
        var contact = parseJsonFromSession(KEYS.publicContactInfo, {});
        var parts = [];

        if (contact.email) {
            parts.push('Email ' + contact.email);
        }
        if (contact.phone) {
            parts.push('Phone ' + contact.phone);
        }
        if (contact.preference) {
            parts.push(contact.preference);
        }

        return parts.join(' | ');
    }

    // This assembles a complete location record object from all the data currently stored in sessionStorage.
    function buildLocationRecord(options) {
        var services = parseJsonFromSession(KEYS.locationServices, []);
        var socialLinks = parseJsonFromSession(KEYS.socialLinks, []);
        var description = sessionStorage.getItem(KEYS.locationDescription) || '';
        var siteUrl = sessionStorage.getItem(KEYS.locationSiteUrl) || '';

        return {
            locationId: options.locationId,
            name: options.name,
            address: options.address,
            lat: options.lat,
            lon: options.lon,
            icon: options.icon,
            description: description,
            contact: buildContactLine(),
            siteUrl: siteUrl,
            services: services,
            servicesText: services.map(function (item) {
                return item && item.name ? item.name : '';
            }).filter(Boolean).join(', '),
            socialLinks: socialLinks,
            profileName: sessionStorage.getItem(KEYS.profileName) || 'Community Host',
            profilePhoto: sessionStorage.getItem(KEYS.profilePhoto) || '',
            bannerPhoto: sessionStorage.getItem(KEYS.locationBannerPhoto) || ''
        };
    }

    // This moves the map and repositions the marker to the given latitude and longitude.
    function setMapLocation(lat, lon, label) {
        if (!locationPreviewMap) { return; }

        locationPreviewMap.setView([lat, lon], 14);

        if (!locationMarker) {
            locationMarker = L.marker([lat, lon]).addTo(locationPreviewMap);
        } else {
            locationMarker.setLatLng([lat, lon]);
        }

        if (label) {
            locationMarker.bindPopup(label).openPopup();
        }
    }

    // This loads the Stadia tile layer and switches to OpenStreetMap after a short delay as a fallback.
    function addBaseTilesWithFallback(mapInstance) {
        var switchedToFallback = false;

        var stadiaLayer = L.tileLayer('https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.{ext}', {
            minZoom: 0,
            maxZoom: 20,
            attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            ext: 'png'
        });

        function switchToOsmFallback() {
            if (switchedToFallback) { return; }
            switchedToFallback = true;

            if (activeTileLayer) {
                mapInstance.removeLayer(activeTileLayer);
            }

            activeTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                minZoom: 0,
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapInstance);
        }

        stadiaLayer.on('tileerror', function () {
            switchToOsmFallback();
        });

        activeTileLayer = stadiaLayer.addTo(mapInstance);

        setTimeout(function () {
            if (!switchedToFallback) {
                switchToOsmFallback();
            }
        }, 2500);
    }

    // This initializes the Leaflet preview map inside the location creator and centers it on Madison.
    function initLocationPreviewMap() {
        var mapEl = document.getElementById('location-preview-map');

        if (!mapEl) {
            return false;
        }

        if (typeof L === 'undefined') {
            mapEl.innerHTML = '<iframe title="Location preview map" style="border:0;width:100%;height:100%;" src="https://www.openstreetmap.org/export/embed.html?bbox=-89.53%2C42.98%2C-89.22%2C43.16&amp;layer=mapnik"></iframe>';
            return false;
        }

        // Reuse landing-page defaults from js/main.js.
        locationPreviewMap = L.map('location-preview-map', {
            zoomControl: false
        }).setView([43.08, -89.38], 13);

        addBaseTilesWithFallback(locationPreviewMap);

        L.control.zoom({position: 'bottomleft'}).addTo(locationPreviewMap);

        // Keep map visible inside the scrollable grid container.
        requestAnimationFrame(function () {
            locationPreviewMap.invalidateSize();
        });
        setTimeout(function () {
            if (locationPreviewMap) {
                locationPreviewMap.invalidateSize();
            }
        }, 150);

        window.addEventListener('resize', function () {
            if (locationPreviewMap) {
                locationPreviewMap.invalidateSize();
            }
        });

        setMapLocation(43.08, -89.38, 'Madison, WI');
        return true;
    }

    // This sends an address query to the Nominatim geocoding API and returns the raw results.
    function geocodeAddress(query, resultLimit) {
        if (!query) {
            return Promise.resolve([]);
        }

        var wisconsinQuery = toWisconsinQuery(query);
        var limit = resultLimit || 1;
        var endpoint =
            'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=' + limit + '&countrycodes=us' +
            '&viewbox=' + encodeURIComponent(MADISON_VIEWBOX) + '&bounded=1&q=' + encodeURIComponent(wisconsinQuery);

        return fetch(endpoint).then(function (response) {
            return response.json();
        });
    }

    // This geocodes an address string, picks the best result, and moves the map to that location.
    function geocodeAndCenter(query) {
        if (!query) { return Promise.resolve(null); }

        return geocodeAddress(query, 5)
            .then(function (results) {
                if (!results || !results.length) {
                    alert('Could not find that location yet. Try a fuller address, city, or ZIP code.');
                    return null;
                }

                var top = chooseBestGeocodeResult(query, results) || results[0];
                var shortLabel = toShortAddress(top);
                var lat = parseFloat(top.lat);
                var lon = parseFloat(top.lon);
                setMapLocation(lat, lon, shortLabel);

                return {
                    lat: lat,
                    lon: lon,
                    label: shortLabel
                };
            })
            .catch(function () {
                alert('Map lookup failed. Check your connection and try again.');
                return null;
            });
    }

    function bindLocationMap() {
        var queryInput = document.getElementById('location-query');
        var centerButton = document.getElementById('update-location-map');
        var suggestions = document.getElementById('location-suggestions');

        if (!queryInput || !centerButton) { return; }

        if (!initLocationPreviewMap()) { return; }

        // This wires the Save Address button to geocode the address, move the map, and write the result to sessionStorage.
        var saveAddressBtn = document.getElementById('save-address-btn');
        var saveAddressStatus = document.getElementById('save-address-status');

        centerButton.addEventListener('click', function () {
            geocodeAndCenter(queryInput.value.trim());
        });

        if (saveAddressBtn) {
            saveAddressBtn.addEventListener('click', function () {
                var query = queryInput.value.trim();
                if (!query) {
                    alert('Enter an address before saving.');
                    return;
                }

                saveAddressBtn.disabled = true;
                saveAddressBtn.textContent = 'Saving…';

                geocodeAndCenter(query)
                    .then(function (geocodedPoint) {
                        if (!geocodedPoint) {
                            saveAddressBtn.disabled = false;
                            saveAddressBtn.textContent = 'Save Address';
                            return;
                        }

                        sessionStorage.setItem(KEYS.locationAddress, query);

                        saveAddressBtn.disabled = false;
                        saveAddressBtn.textContent = 'Save Address';

                        if (saveAddressStatus) {
                            saveAddressStatus.textContent = '✓ Address saved: ' + geocodedPoint.label;
                            saveAddressStatus.hidden = false;
                        }
                    })
                    .catch(function () {
                        saveAddressBtn.disabled = false;
                        saveAddressBtn.textContent = 'Save Address';
                    });
            });
        }

        queryInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                geocodeAndCenter(queryInput.value.trim());
            }
        });

        // Type-ahead location suggestions in the browser input dropdown.
        queryInput.addEventListener('input', function () {
            var value = queryInput.value.trim();

            if (!suggestions) { return; }

            if (autocompleteTimer) {
                clearTimeout(autocompleteTimer);
            }

            if (value.length < 3) {
                suggestions.innerHTML = '';
                return;
            }

            suggestions.innerHTML = '';
            getLocalSuggestionMatches(value, 5).forEach(function (item) {
                    var localOption = document.createElement('option');
                    localOption.value = item;
                    suggestions.appendChild(localOption);
                });

            autocompleteTimer = setTimeout(function () {
                geocodeAddress(value, 5)
                    .then(function (results) {
                        suggestions.innerHTML = '';

                        getLocalSuggestionMatches(value, 3).forEach(function (item) {
                                var localOption = document.createElement('option');
                                localOption.value = item;
                                suggestions.appendChild(localOption);
                            });

                        results.forEach(function (item) {
                            var option = document.createElement('option');
                            option.value = toShortAddress(item);
                            suggestions.appendChild(option);
                        });
                    })
                    .catch(function () {
                        // Keep local fallback suggestions on network/API failure.
                    });
            }, 250);
        });

        queryInput.addEventListener('change', function () {
            var locNameInput = document.getElementById('loc-name');
            if (locNameInput && !locNameInput.value.trim()) {
                locNameInput.value = queryInput.value.trim();
            }
        });
    }

    // This wires the service add button so the host can attach named services with optional images to the location.
    function bindServices() {
        var addButton = document.getElementById('add-service-btn');
        var nameInput = document.getElementById('service-name');
        var detailsInput = document.getElementById('service-details');
        var imageInput = document.getElementById('service-image-input');
        var servicesList = document.getElementById('services-list');

        if (!addButton || !nameInput || !detailsInput || !imageInput || !servicesList) { return; }

        var services = parseJsonFromSession(KEYS.locationServices, []);

        function saveServices() {
            sessionStorage.setItem(KEYS.locationServices, JSON.stringify(services));
        }

        function appendServiceCard(service) {
            var name = service && service.name ? service.name : '';
            var details = service && service.details ? service.details : '';
            var imageSrc = service && service.imageSrc ? service.imageSrc : '';

            var li = document.createElement('li');
            li.className = 'hosting-service-item';

            var img = document.createElement('img');
            img.src = imageSrc || '../img/add-map-placeholder.svg';
            img.alt = 'Service preview image';

            var wrapper = document.createElement('div');
            var title = document.createElement('p');
            title.className = 'hosting-service-name';
            title.textContent = name;

            var meta = document.createElement('p');
            meta.className = 'hosting-service-meta';
            meta.textContent = details || 'New service item';

            wrapper.appendChild(title);
            wrapper.appendChild(meta);

            li.appendChild(img);
            li.appendChild(wrapper);
            servicesList.appendChild(li);
        }

        function appendService(imageSrc) {
            var name = nameInput.value.trim();
            var details = detailsInput.value.trim();

            if (!name) {
                alert('Please enter a service name before adding.');
                return;
            }

            var service = {
                name: name,
                details: details,
                imageSrc: imageSrc || ''
            };

            services.push(service);
            saveServices();
            appendServiceCard(service);

            nameInput.value = '';
            detailsInput.value = '';
            imageInput.value = '';
        }

        servicesList.innerHTML = '';
        services.forEach(appendServiceCard);

        addButton.addEventListener('click', function () {
            var file = imageInput.files[0];

            if (!file) {
                appendService('');
                return;
            }

            var reader = new FileReader();
            reader.onload = function (e) {
                appendService(e.target.result);
            };
            reader.readAsDataURL(file);
        });
    }

    // This wires the plus buttons for the host-provided and guest-provided materials lists.
    function bindMaterialAdders() {
        var addHost = document.getElementById('add-host-material');
        var addGuest = document.getElementById('add-guest-material');
        var hostList = document.getElementById('host-material-list');
        var guestList = document.getElementById('guest-material-list');

        if (!addHost || !addGuest || !hostList || !guestList) { return; }

        var hostMaterials = parseJsonFromSession(KEYS.hostMaterials, []);
        var guestMaterials = parseJsonFromSession(KEYS.guestMaterials, []);

        function renderList(targetList, items) {
            targetList.innerHTML = '';

            items.forEach(function (item) {
                var li = document.createElement('li');
                li.textContent = item;
                targetList.appendChild(li);
            });
        }

        function saveMaterials() {
            sessionStorage.setItem(KEYS.hostMaterials, JSON.stringify(hostMaterials));
            sessionStorage.setItem(KEYS.guestMaterials, JSON.stringify(guestMaterials));
        }

        function addToList(targetList, promptLabel, targetStore) {
            var value = window.prompt(promptLabel);
            if (!value) { return; }

            var text = value.trim();
            if (!text) { return; }

            targetStore.push(text);
            saveMaterials();
            renderList(targetList, targetStore);
        }

        renderList(hostList, hostMaterials);
        renderList(guestList, guestMaterials);

        addHost.addEventListener('click', function () {
            addToList(hostList, 'Add a host-provided material:', hostMaterials);
        });

        addGuest.addEventListener('click', function () {
            addToList(guestList, 'Add a guest-brought material:', guestMaterials);
        });
    }

    // This wires all the accordion tool panels including description, social links, QR code, and contact info.
    function bindListingTools() {
        var toggles = document.querySelectorAll('.hosting-tool-toggle[data-target]');
        var descriptionInput = document.getElementById('location-page-description');
        var descriptionPreview = document.getElementById('description-preview');
        var saveDescriptionBtn = document.getElementById('save-description-btn');

        var socialPlatformSelect = document.getElementById('social-platform-select');
        var socialUrlInput = document.getElementById('social-url-input');
        var addSocialBtn = document.getElementById('add-social-link-btn');
        var socialLinksListEl = document.getElementById('social-links-list');

        var locationSiteUrl = document.getElementById('location-site-url');
        var generateQrBtn = document.getElementById('generate-qr-btn');
        var qrWrap = document.getElementById('qr-output-wrap');
        var qrImage = document.getElementById('location-qr-image');

        var contactEmail = document.getElementById('public-contact-email');
        var contactPhone = document.getElementById('public-contact-phone');
        var contactPreference = document.getElementById('contact-preference');
        var contactNotes = document.getElementById('contact-notes');
        var saveContactBtn = document.getElementById('save-contact-btn');
        var contactPreview = document.getElementById('contact-preview');

        if (toggles.length) {
            toggles.forEach(function (toggle) {
                toggle.addEventListener('click', function () {
                    var targetId = toggle.getAttribute('data-target');
                    if (!targetId) { return; }

                    var targetPanel = document.getElementById(targetId);
                    if (!targetPanel) { return; }

                    targetPanel.hidden = !targetPanel.hidden;
                });
            });
        }

        if (descriptionInput && descriptionPreview && saveDescriptionBtn) {
            var savedDescription = sessionStorage.getItem(KEYS.locationDescription);
            if (savedDescription) {
                descriptionInput.value = savedDescription;
                descriptionPreview.textContent = savedDescription;
            }

            saveDescriptionBtn.addEventListener('click', function () {
                var value = descriptionInput.value.trim();
                if (!value) {
                    descriptionPreview.textContent = 'No description saved yet.';
                    sessionStorage.removeItem(KEYS.locationDescription);
                    return;
                }

                sessionStorage.setItem(KEYS.locationDescription, value);
                descriptionPreview.textContent = value;
            });
        }

        function renderSocialLinks(links) {
            if (!socialLinksListEl) { return; }
            socialLinksListEl.innerHTML = '';

            links.forEach(function (item) {
                var li = document.createElement('li');
                var anchor = document.createElement('a');
                anchor.href = item.url;
                anchor.target = '_blank';
                anchor.rel = 'noopener noreferrer';
                anchor.textContent = item.platform + ': ' + item.url;
                li.appendChild(anchor);
                socialLinksListEl.appendChild(li);
            });
        }

        var savedSocialLinks = [];
        try {
            savedSocialLinks = JSON.parse(sessionStorage.getItem(KEYS.socialLinks) || '[]');
        } catch (error) {
            savedSocialLinks = [];
        }
        renderSocialLinks(savedSocialLinks);

        if (socialPlatformSelect && socialUrlInput && addSocialBtn) {
            addSocialBtn.addEventListener('click', function () {
                var platform = socialPlatformSelect.value;
                var url = socialUrlInput.value.trim();

                if (!url) {
                    alert('Please enter a link URL.');
                    return;
                }

                var normalizedUrl = /^https?:\/\//i.test(url) ? url : ('https://' + url);
                savedSocialLinks.push({ platform: platform, url: normalizedUrl });
                sessionStorage.setItem(KEYS.socialLinks, JSON.stringify(savedSocialLinks));
                renderSocialLinks(savedSocialLinks);
                socialUrlInput.value = '';
            });
        }

        if (locationSiteUrl && qrWrap && qrImage && generateQrBtn) {
            var savedSiteUrl = sessionStorage.getItem(KEYS.locationSiteUrl);
            if (savedSiteUrl) {
                locationSiteUrl.value = savedSiteUrl;
                qrImage.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(savedSiteUrl);
                qrWrap.hidden = false;
            }

            generateQrBtn.addEventListener('click', function () {
                var rawUrl = locationSiteUrl.value.trim();
                if (!rawUrl) {
                    alert('Enter a website URL first.');
                    return;
                }

                var normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : ('https://' + rawUrl);
                sessionStorage.setItem(KEYS.locationSiteUrl, normalizedUrl);
                qrImage.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(normalizedUrl);
                qrWrap.hidden = false;
            });
        }

        if (contactEmail && contactPhone && contactPreference && contactNotes && saveContactBtn && contactPreview) {
            try {
                var savedContact = JSON.parse(sessionStorage.getItem(KEYS.publicContactInfo) || '{}');
                if (savedContact.email) { contactEmail.value = savedContact.email; }
                if (savedContact.phone) { contactPhone.value = savedContact.phone; }
                if (savedContact.preference) { contactPreference.value = savedContact.preference; }
                if (savedContact.notes) { contactNotes.value = savedContact.notes; }

                if (savedContact.email || savedContact.phone) {
                    contactPreview.textContent = 'Saved: ' +
                        (savedContact.email ? ('Email ' + savedContact.email) : '') +
                        (savedContact.email && savedContact.phone ? ' | ' : '') +
                        (savedContact.phone ? ('Phone ' + savedContact.phone) : '') +
                        (savedContact.preference ? (' | ' + savedContact.preference) : '');
                }
            } catch (error) {
                // Ignore malformed cached contact data.
            }

            saveContactBtn.addEventListener('click', function () {
                var data = {
                    email: contactEmail.value.trim(),
                    phone: contactPhone.value.trim(),
                    preference: contactPreference.value,
                    notes: contactNotes.value.trim()
                };

                if (!data.email && !data.phone) {
                    alert('Add at least one public email or phone number.');
                    return;
                }

                sessionStorage.setItem(KEYS.publicContactInfo, JSON.stringify(data));
                contactPreview.textContent = 'Saved: ' +
                    (data.email ? ('Email ' + data.email) : '') +
                    (data.email && data.phone ? ' | ' : '') +
                    (data.phone ? ('Phone ' + data.phone) : '') +
                    (data.preference ? (' | ' + data.preference) : '');
            });
        }
    }

    // This handles the main form submission, geocodes the address, builds the location record, and saves it to sessionStorage.
    function bindForm() {
        var form = document.getElementById('create-location-form');
        if (!form) { return; }

        // Demo: persist a created-location flag and route to the faux host dashboard.
        form.addEventListener('submit', function (e) {
            e.preventDefault();

            var previousLocationName = sessionStorage.getItem(KEYS.locationName) || '';

            var locationNameInput = document.getElementById('loc-name');
            var mapQueryInput = document.getElementById('location-query');
            var savedLocationName = '';
            var savedLocationAddress = '';

            if (locationNameInput && locationNameInput.value.trim()) {
                savedLocationName = locationNameInput.value.trim();
            }

            if (mapQueryInput && mapQueryInput.value.trim()) {
                savedLocationAddress = mapQueryInput.value.trim();

                if (!savedLocationName) {
                    savedLocationName = mapQueryInput.value.trim();
                }
            } else {
                savedLocationAddress = 'Madison, WI';

                if (!savedLocationName) {
                    savedLocationName = 'Your Location';
                }
            }

            geocodeAndCenter(savedLocationAddress)
                .then(function (geocodedPoint) {
                    if (!geocodedPoint) {
                        alert('Could not save location coordinates. Please verify the address and try again.');
                        return;
                    }

                    sessionStorage.setItem(KEYS.createdLocation, 'true');
                    sessionStorage.setItem(KEYS.locationName, savedLocationName);
                    sessionStorage.setItem(KEYS.locationAddress, savedLocationAddress);

                    var savedLat = geocodedPoint.lat;
                    var savedLon = geocodedPoint.lon;

                    var createdLocations = [];
                    try {
                        createdLocations = JSON.parse(sessionStorage.getItem(KEYS.createdLocations) || '[]');
                    } catch (error) {
                        createdLocations = [];
                    }

                    var matchByName = function (entry) {
                        if (typeof entry === 'string') {
                            return entry === savedLocationName || entry === previousLocationName;
                        }
                        return entry && (entry.name === savedLocationName || entry.name === previousLocationName);
                    };
                    var matchedEntry = createdLocations.find(matchByName);
                    var locationId = matchedEntry && matchedEntry.locationId
                        ? matchedEntry.locationId
                        : makeLocationId(savedLocationName);
                    var nextRecord = buildLocationRecord({
                        locationId: locationId,
                        name: savedLocationName,
                        address: savedLocationAddress,
                        lat: savedLat,
                        lon: savedLon,
                        icon: ''
                    });

                    var exists = createdLocations.some(function (entry) {
                        if (typeof entry === 'string') {
                            return entry === savedLocationName;
                        }

                        return entry && entry.name === savedLocationName;
                    });

                    if (isEditMode && previousLocationName) {
                        createdLocations = createdLocations.map(function (entry) {
                            if (typeof entry === 'string') {
                                if (entry === previousLocationName || entry === savedLocationName) {
                                    return nextRecord;
                                }
                                return entry;
                            }

                            if (!entry) { return entry; }

                            if (entry.name === previousLocationName || entry.name === savedLocationName) {
                                return nextRecord;
                            }

                            return entry;
                        });

                        exists = createdLocations.some(function (entry) {
                            return entry && entry.name === savedLocationName;
                        });
                    }

                    if (!exists) {
                        createdLocations.unshift(nextRecord);
                    }
                    sessionStorage.setItem(KEYS.createdLocations, JSON.stringify(createdLocations));

                    alert(isEditMode ? 'Location updated!' : 'Location saved! Opening your hosting dashboard preview.');
                    window.location.href = 'host-dashboard/';
                });
        });
    }

    // This clears the access mode and email from sessionStorage when the user clicks the logout link.
    function bindLogout() {
        var logoutLink = document.getElementById('logout-link');
        if (!logoutLink) { return; }

        logoutLink.addEventListener('click', function () {
            sessionStorage.removeItem(KEYS.mode);
            sessionStorage.removeItem(KEYS.email);
        });
    }

    // This runs all setup steps in the correct order when the page finishes loading.
    function init() {
        if (resetGuestSessionOnReload()) { return; }

        enforceAccess();
        setEditorModeLabels();
        updateSessionBadge();
        loadHostInfo();
        prefillCoreLocationInputs();
        bindBannerUpload();
        bindProfilePhotoUpload();
        bindLocationMap();
        bindServices();
        bindMaterialAdders();
        bindListingTools();
        bindForm();
        bindLogout();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
