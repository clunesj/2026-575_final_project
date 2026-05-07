// locations.js, by Joseph Kowalczyk, James Clunes, and Brooke Fandrich
(function () {
    // These are the sessionStorage key names used to read profile and location data on this page.
    var KEYS = {
        mode: 'commonGoodAccessMode',
        email: 'commonGoodUserEmail',
        profileName: 'commonGoodProfileName',
        profilePhoto: 'commonGoodProfilePhoto',
        createdLocation: 'commonGoodHasCreatedLocation',
        createdLocations: 'commonGoodCreatedLocations',
        locationName: 'commonGoodLocationName',
        locationAddress: 'commonGoodLocationAddress'
    };

    var accessMode = sessionStorage.getItem(KEYS.mode);

    // This checks session storage for the old hardcoded test location and removes it if it is still there.
    function purgeSeedLocation() {
        var raw;
        try {
            raw = JSON.parse(sessionStorage.getItem(KEYS.createdLocations) || '[]');
        } catch (e) {
            raw = [];
        }

        var filtered = raw.filter(function (entry) {
            var name = typeof entry === 'string' ? entry : (entry && entry.name ? entry.name : '');
            return name !== 'Test Location';
        });

        if (filtered.length !== raw.length) {
            sessionStorage.setItem(KEYS.createdLocations, JSON.stringify(filtered));
            if (filtered.length === 0) {
                sessionStorage.removeItem(KEYS.createdLocation);
                sessionStorage.removeItem(KEYS.locationName);
                sessionStorage.removeItem(KEYS.locationAddress);
            }
        }
    }

    // This clears all guest session data and sends the user back to the home page if they reload while in guest mode.
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

    // This redirects to the home page if no access mode is found in sessionStorage.
    function enforceAccess() {
        if (!accessMode) {
            window.location.href = '../';
        }
    }

    // This updates the header badge to show either guest mode or the signed-in email address.
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

    // This fills the sidebar name and avatar from sessionStorage when the page loads.
    function loadSidebarProfile() {
        var nameEl = document.getElementById('sidebar-name');
        var avatarEl = document.getElementById('sidebar-avatar');

        if (nameEl) {
            var savedName = sessionStorage.getItem(KEYS.profileName);
            if (savedName) { nameEl.textContent = savedName; }
        }

        if (avatarEl) {
            var savedPhoto = sessionStorage.getItem(KEYS.profilePhoto);
            if (savedPhoto) { avatarEl.src = savedPhoto; }
        }
    }

    // This reads the list of created locations from sessionStorage and builds the sidebar list with dashboard and edit links.
    function renderCreatedLocations() {
        var listEl = document.getElementById('created-locations-list');
        var emptyEl = document.getElementById('created-locations-empty');

        if (!listEl || !emptyEl) { return; }

        var createdLocations = [];
        try {
            createdLocations = JSON.parse(sessionStorage.getItem(KEYS.createdLocations) || '[]');
        } catch (error) {
            createdLocations = [];
        }

        listEl.innerHTML = '';

        if (!createdLocations.length) {
            emptyEl.hidden = false;
            return;
        }

        emptyEl.hidden = true;

        createdLocations.forEach(function (locationEntry) {
            var locationObj = (typeof locationEntry === 'string')
                ? { name: locationEntry, address: '' }
                : locationEntry;

            var li = document.createElement('li');
            li.className = 'locations-created-item';

            var nameLine = document.createElement('span');
            nameLine.className = 'locations-created-name';
            nameLine.textContent = locationObj.address
                ? (locationObj.name + ' - ' + locationObj.address)
                : locationObj.name;

            var actions = document.createElement('div');
            actions.className = 'locations-created-actions';

            var dashboardLink = document.createElement('a');
            dashboardLink.className = 'locations-created-action';
            dashboardLink.href = 'host-dashboard/';
            dashboardLink.textContent = 'Dashboard';
            // Before navigating, write the selected location back into sessionStorage so the dashboard and editor can read it.
            dashboardLink.addEventListener('click', function () {
                sessionStorage.setItem(KEYS.createdLocation, 'true');
                sessionStorage.setItem(KEYS.locationName, locationObj.name);
                sessionStorage.setItem(KEYS.locationAddress, locationObj.address || '');
            });

            var editLink = document.createElement('a');
            editLink.className = 'locations-created-action';
            editLink.href = 'add/?mode=edit';
            editLink.textContent = 'Edit Details';
            // Same as above but for the edit details link.
            editLink.addEventListener('click', function () {
                sessionStorage.setItem(KEYS.createdLocation, 'true');
                sessionStorage.setItem(KEYS.locationName, locationObj.name);
                sessionStorage.setItem(KEYS.locationAddress, locationObj.address || '');
            });

            actions.appendChild(dashboardLink);
            actions.appendChild(editLink);

            li.appendChild(nameLine);
            li.appendChild(actions);
            listEl.appendChild(li);
        });
    }

    // This clears the access mode and email from sessionStorage when the user logs out.
    function bindLogout() {
        var logoutLink = document.getElementById('logout-link');
        if (!logoutLink) { return; }

        logoutLink.addEventListener('click', function () {
            sessionStorage.removeItem(KEYS.mode);
            sessionStorage.removeItem(KEYS.email);
        });
    }

    // This runs cleanup and all setup steps when the page finishes loading.
    function init() {
        purgeSeedLocation();
        if (resetGuestSessionOnReload()) { return; }

        enforceAccess();

        updateSessionBadge();
        loadSidebarProfile();
        renderCreatedLocations();
        bindLogout();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
