// main.js, by Joseph Kowalczyk, James Clunes, and Brooke Fandrich
(function(){
    // Pseudoglobal Variables
    var map;
    var accessMode = sessionStorage.getItem('commonGoodAccessMode');

    function resetGuestSessionOnReload() {
        var navigationEntries = performance.getEntriesByType('navigation');
        var navigationType = navigationEntries.length ? navigationEntries[0].type : '';

        if (accessMode === 'guest' && navigationType === 'reload') {
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

    function updateSessionUI() {
        var badge = document.getElementById('session-badge');
        var helper = document.getElementById('session-helper');
        var storedEmail = sessionStorage.getItem('commonGoodUserEmail');

        if (!badge || !helper) {
            return;
        }

        if (accessMode === 'guest') {
            badge.textContent = 'Guest tester mode';
            helper.textContent = 'Guest testing is active. Prototype-only data should be treated as temporary and reset between sessions.';
            return;
        }

        badge.textContent = storedEmail ? 'Logged in as ' + storedEmail : 'Signed in';
        helper.textContent = 'You entered through the new login flow and can continue building from this authenticated starting point.';
    }

    function bindSessionActions() {
        var logoutLink = document.getElementById('logout-link');

        if (!logoutLink) {
            return;
        }

        logoutLink.addEventListener('click', function() {
            sessionStorage.removeItem('commonGoodAccessMode');
            sessionStorage.removeItem('commonGoodUserEmail');
        });
    }

    // Creating leaflet map
    function mapInit() {
        if (resetGuestSessionOnReload()) {
            return;
        }

        enforceAccess();
        updateSessionUI();
        bindSessionActions();
        map = L.map('map').setView([43.08, -89.38], 13);

        // Add tileset
        L.tileLayer('https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.{ext}', {
	        minZoom: 0,
	        maxZoom: 20,
	        attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	        ext: 'png'
        }).addTo(map);

    }
    // Runs mapInit() once the DOM loads.
    document.addEventListener('DOMContentLoaded', mapInit);
})(); // Must be the last line. Closes and executes the wrapping function. ---------------------------------------
