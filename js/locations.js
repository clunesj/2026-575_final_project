// locations.js, by Joseph Kowalczyk, James Clunes, and Brooke Fandrich
(function () {
    var KEYS = {
        mode: 'commonGoodAccessMode',
        email: 'commonGoodUserEmail',
        profileName: 'commonGoodProfileName',
        profilePhoto: 'commonGoodProfilePhoto'
    };

    var accessMode = sessionStorage.getItem(KEYS.mode);

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
        loadSidebarProfile();
        bindLogout();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
