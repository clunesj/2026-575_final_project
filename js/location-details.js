// location-details.js
(function () {
    // This is a shortcut for getElementById to keep the code easier to read.
    function byId(id) {
        return document.getElementById(id);
    }

    // This escapes special HTML characters in a string so it is safe to insert into the page.
    function escapeHtml(value) {
        var text = value === null || value === undefined ? '' : String(value);
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // This safely reads and parses a JSON value from sessionStorage, returning the fallback if the key is missing or invalid.
    function parseJsonFromSession(key, fallback) {
        try {
            var raw = sessionStorage.getItem(key);
            if (!raw) { return fallback; }
            return JSON.parse(raw);
        } catch (error) {
            return fallback;
        }
    }

    // This converts a raw services value, which can be an array or a comma-separated string, into a plain array of names.
    function toServiceList(rawServices) {
        if (Array.isArray(rawServices)) {
            return rawServices
                .map(function (item) {
                    if (!item) { return ''; }
                    if (typeof item === 'string') { return item; }
                    return item.name || '';
                })
                .filter(Boolean);
        }

        if (typeof rawServices === 'string' && rawServices.trim()) {
            return rawServices
                .split(',')
                .map(function (item) { return item.trim(); })
                .filter(Boolean);
        }

        return [];
    }

    // This builds and inserts the services list into the page, or shows a placeholder if no services are listed.
    function renderServices(items) {
        var list = byId('details-services-list');
        if (!list) { return; }

        list.innerHTML = '';
        if (!items.length) {
            var empty = document.createElement('li');
            empty.className = 'details-service-empty';
            empty.textContent = 'Services will be listed soon.';
            list.appendChild(empty);
            return;
        }

        items.forEach(function (item) {
            var li = document.createElement('li');
            li.textContent = item;
            list.appendChild(li);
        });
    }

    // This builds the website and social links section and shows a message if no links are available.
    function renderLinks(siteUrl, socialLinks) {
        var wrap = byId('details-links-wrap');
        if (!wrap) { return; }

        var htmlParts = [];

        if (siteUrl) {
            htmlParts.push('<p><a href="' + escapeHtml(siteUrl) + '" target="_blank" rel="noopener noreferrer">Visit Website</a></p>');
        }

        if (Array.isArray(socialLinks) && socialLinks.length) {
            socialLinks.forEach(function (item) {
                if (!item || !item.url) { return; }
                var platform = item.platform || 'Link';
                htmlParts.push('<p><a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(platform) + '</a></p>');
            });
        }

        if (!htmlParts.length) {
            htmlParts.push('<p class="details-subtle">No links listed.</p>');
        }

        wrap.innerHTML = htmlParts.join('');
    }

    // This fills all the detail page fields with data from a location object, including name, address, contact, and photos.
    function applyDetails(details) {
        var locationName = byId('details-location-name');
        var locationAddress = byId('details-location-address');
        var hostName = byId('details-host-name');
        var description = byId('details-description');
        var hostPhoto = byId('details-host-photo');
        var banner = byId('details-banner');
        var contact = byId('details-contact');
        var hours = byId('details-hours');
        var bookLink = byId('details-book-link');

        if (locationName) { locationName.textContent = details.name || 'Community Location'; }
        if (locationAddress) { locationAddress.textContent = details.address || 'Address not listed'; }
        if (hostName) { hostName.textContent = details.hostName || 'Community Host'; }
        if (description) { description.textContent = details.description || 'This location supports neighbors through shared resources and community care.'; }

        if (hostPhoto && details.hostPhoto) {
            hostPhoto.src = details.hostPhoto;
        }

        if (banner && details.bannerPhoto) {
            banner.style.backgroundImage = 'url("' + details.bannerPhoto + '")';
        }

        if (contact) {
            contact.textContent = details.contact ? ('Contact: ' + details.contact) : '';
        }

        if (hours) {
            hours.textContent = details.hours ? ('Hours: ' + details.hours) : '';
        }

        if (bookLink) {
            if (details.siteUrl) {
                bookLink.href = details.siteUrl;
                bookLink.target = '_blank';
                bookLink.rel = 'noopener noreferrer';
                bookLink.textContent = 'Book Now';
            } else {
                bookLink.href = '#';
                bookLink.textContent = 'Request Info';
            }
        }

        renderServices(toServiceList(details.services));
        renderLinks(details.siteUrl, details.socialLinks);
    }

    // This converts a raw GeoJSON feature from the dataset into the shape that applyDetails expects.
    function mapDatasetFeature(feature) {
        var properties = feature && feature.properties ? feature.properties : {};
        return {
            name: properties.Name || 'Community Location',
            address: properties.Address || 'Madison, WI',
            hostName: 'Community Host Team',
            description: properties.Description || '',
            contact: properties.Contact || '',
            hours: properties.Hours || '',
            siteUrl: properties.Link || '',
            services: properties.Services || '',
            socialLinks: [],
            hostPhoto: 'img/avatar-placeholder.svg',
            bannerPhoto: ''
        };
    }

    // This searches the sessionStorage list of user-created locations for one matching the given id or name.
    function getUserLocationById(locationId, locationName) {
        var createdLocations = parseJsonFromSession('commonGoodCreatedLocations', []);
        if (!Array.isArray(createdLocations)) { return null; }

        return createdLocations.find(function (item) {
            if (!item || typeof item !== 'object') { return false; }
            if (locationId) {
                return item.locationId === locationId;
            }
            if (locationName) {
                return item.name === locationName;
            }
            return true;
        }) || null;
    }

    // This fetches the GeoJSON dataset and returns the feature whose Key property matches the given id.
    function getDatasetLocationById(id) {
        return fetch('data/locations.geojson')
            .then(function (response) { return response.json(); })
            .then(function (json) {
                var features = json && Array.isArray(json.features) ? json.features : [];
                var match = features.find(function (feature) {
                    var key = feature && feature.properties ? feature.properties.Key : null;
                    return String(key) === String(id);
                });

                if (!match) {
                    return null;
                }

                return mapDatasetFeature(match);
            })
            .catch(function () {
                return null;
            });
    }

    // This converts a raw sessionStorage location record into the shape that applyDetails expects.
    function mapUserLocation(location) {
        if (!location || typeof location !== 'object') {
            return null;
        }

        return {
            name: location.name || 'Your Location',
            address: location.address || 'Madison, WI',
            hostName: location.profileName || sessionStorage.getItem('commonGoodProfileName') || 'Community Host',
            description: location.description || 'No description saved yet.',
            contact: location.contact || '',
            hours: location.hours || '',
            siteUrl: location.siteUrl || '',
            services: location.services || location.servicesText || '',
            socialLinks: location.socialLinks || [],
            hostPhoto: location.profilePhoto || sessionStorage.getItem('commonGoodProfilePhoto') || 'img/avatar-placeholder.svg',
            bannerPhoto: location.bannerPhoto || sessionStorage.getItem('commonGoodLocationBannerPhoto') || ''
        };
    }

    // This returns a hardcoded placeholder location used when no real data can be found.
    function fallbackMockup() {
        return {
            name: 'Madison Makers Studio',
            address: '123 Innovation Way, Madison, WI 53703',
            hostName: 'Carrie M.',
            description: 'Passionate about rapid prototyping and community resilience. Helping neighbors bring their ideas to life.',
            contact: '',
            hours: 'Mon-Fri: 9:00 AM-7:00 PM',
            siteUrl: '',
            services: [
                '3D Printer 1 (PLA/PETG)',
                'Intro to 3D Modeling Class',
                'Resin Printer High-Detail',
                'Filament Recycling Station'
            ],
            socialLinks: [],
            hostPhoto: 'img/avatar-placeholder.svg',
            bannerPhoto: ''
        };
    }

    // This reads the URL query parameters to decide which location to display, then loads and renders its data.
    function init() {
        var params = new URLSearchParams(window.location.search);
        var source = params.get('source');
        var id = params.get('id');
        var name = params.get('name');

        if (source === 'user') {
            var userLocation = mapUserLocation(getUserLocationById(id, name));
            applyDetails(userLocation || fallbackMockup());
            return;
        }

        if (source === 'dataset' && id) {
            getDatasetLocationById(id).then(function (datasetLocation) {
                applyDetails(datasetLocation || fallbackMockup());
            });
            return;
        }

        applyDetails(fallbackMockup());
    }

    document.addEventListener('DOMContentLoaded', init);
})();
