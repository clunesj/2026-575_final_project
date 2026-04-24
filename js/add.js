// add.js, by Joseph Kowalczyk, James Clunes, and Brooke Fandrich
(function () {
    var KEYS = {
        mode: 'commonGoodAccessMode',
        email: 'commonGoodUserEmail',
        profileName: 'commonGoodProfileName',
        profilePhoto: 'commonGoodProfilePhoto'
    };

    var accessMode = sessionStorage.getItem(KEYS.mode);
    var locationPreviewMap;
    var locationMarker;
    var activeTileLayer;
    var autocompleteTimer;
    var MADISON_VIEWBOX = '-89.74,43.24,-89.10,42.88';
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

    function toWisconsinQuery(text) {
        if (/\b(wi|wisconsin)\b/i.test(text)) {
            return text;
        }
        return text + ', Wisconsin';
    }

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

    function resetGuestSessionOnReload() {
        var navEntries = performance.getEntriesByType('navigation');
        var navType = navEntries.length ? navEntries[0].type : '';

        if (accessMode === 'guest' && navType === 'reload') {
            sessionStorage.clear();
            window.location.href = 'index.html';
            return true;
        }

        return false;
    }

    function enforceAccess() {
        if (!accessMode) {
            window.location.href = 'index.html';
        }
    }

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
                };
                reader.readAsDataURL(file);
            }
        });
    }

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
                };
                reader.readAsDataURL(file);
            }
        });
    }

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

    // Mirrors the landing page map setup in main.js (center, tile source, zoom control position).
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

    function geocodeAndCenter(query) {
        if (!query) { return; }

        var wisconsinQuery = toWisconsinQuery(query);
        var endpoint =
            'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&countrycodes=us' +
            '&viewbox=' + encodeURIComponent(MADISON_VIEWBOX) + '&bounded=1&q=' + encodeURIComponent(wisconsinQuery);

        fetch(endpoint)
            .then(function (response) { return response.json(); })
            .then(function (results) {
                if (!results || !results.length) {
                    alert('Could not find that location yet. Try a fuller address, city, or ZIP code.');
                    return;
                }

                var top = results[0];
                var shortLabel = toShortAddress(top);
                setMapLocation(parseFloat(top.lat), parseFloat(top.lon), shortLabel);
            })
            .catch(function () {
                alert('Map lookup failed. Check your connection and try again.');
            });
    }

    function bindLocationMap() {
        var queryInput = document.getElementById('location-query');
        var centerButton = document.getElementById('update-location-map');
        var suggestions = document.getElementById('location-suggestions');

        if (!queryInput || !centerButton) { return; }

        if (!initLocationPreviewMap()) { return; }

        centerButton.addEventListener('click', function () {
            geocodeAndCenter(queryInput.value.trim());
        });

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
                var wisconsinQuery = toWisconsinQuery(value);
                var endpoint =
                    'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=us' +
                    '&viewbox=' + encodeURIComponent(MADISON_VIEWBOX) + '&bounded=1&q=' + encodeURIComponent(wisconsinQuery);

                fetch(endpoint)
                    .then(function (response) { return response.json(); })
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

    function bindServices() {
        var addButton = document.getElementById('add-service-btn');
        var nameInput = document.getElementById('service-name');
        var detailsInput = document.getElementById('service-details');
        var imageInput = document.getElementById('service-image-input');
        var servicesList = document.getElementById('services-list');

        if (!addButton || !nameInput || !detailsInput || !imageInput || !servicesList) { return; }

        function appendService(imageSrc) {
            var name = nameInput.value.trim();
            var details = detailsInput.value.trim();

            if (!name) {
                alert('Please enter a service name before adding.');
                return;
            }

            var li = document.createElement('li');
            li.className = 'hosting-service-item';

            var img = document.createElement('img');
            img.src = imageSrc || 'img/add-map-placeholder.svg';
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

            nameInput.value = '';
            detailsInput.value = '';
            imageInput.value = '';
        }

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

    function bindMaterialAdders() {
        var addHost = document.getElementById('add-host-material');
        var addGuest = document.getElementById('add-guest-material');
        var hostList = document.getElementById('host-material-list');
        var guestList = document.getElementById('guest-material-list');

        if (!addHost || !addGuest || !hostList || !guestList) { return; }

        function addToList(targetList, promptLabel) {
            var value = window.prompt(promptLabel);
            if (!value) { return; }

            var text = value.trim();
            if (!text) { return; }

            var li = document.createElement('li');
            li.textContent = text;
            targetList.appendChild(li);
        }

        addHost.addEventListener('click', function () {
            addToList(hostList, 'Add a host-provided material:');
        });

        addGuest.addEventListener('click', function () {
            addToList(guestList, 'Add a guest-brought material:');
        });
    }

    function bindForm() {
        var form = document.getElementById('create-location-form');
        if (!form) { return; }

        // Demo: just show a notice and go back to locations
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            alert('Location saved! (Demo — data is not persisted.)');
            window.location.href = 'location.html';
        });
    }

    function bindLogout() {
        var logoutLink = document.getElementById('logout-link');
        if (!logoutLink) { return; }

        logoutLink.addEventListener('click', function () {
            sessionStorage.removeItem(KEYS.mode);
            sessionStorage.removeItem(KEYS.email);
        });
    }

    function init() {
        if (resetGuestSessionOnReload()) { return; }

        enforceAccess();
        updateSessionBadge();
        loadHostInfo();
        bindBannerUpload();
        bindProfilePhotoUpload();
        bindLocationMap();
        bindServices();
        bindMaterialAdders();
        bindForm();
        bindLogout();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
