// add.js, by Joseph Kowalczyk, James Clunes, and Brooke Fandrich
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

    function loadHostInfo() {
        var nameEl = document.getElementById('listing-name');
        var avatarEl = document.getElementById('listing-avatar');

        if (nameEl) {
            var savedName = sessionStorage.getItem(KEYS.profileName);
            if (savedName) { nameEl.textContent = savedName; }
        }

        if (avatarEl) {
            var savedPhoto = sessionStorage.getItem(KEYS.profilePhoto);
            if (savedPhoto) { avatarEl.src = savedPhoto; }
        }
    }

    function bindBannerUpload() {
        var zone = document.getElementById('banner-upload-zone');
        var input = document.getElementById('banner-input');
        var preview = document.getElementById('banner-preview');

        if (!zone || !input || !preview) { return; }

        zone.addEventListener('click', function () { input.click(); });
        zone.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { input.click(); }
        });

        input.addEventListener('change', function () {
            var file = input.files[0];
            if (!file) { return; }

            var reader = new FileReader();
            reader.onload = function (e) {
                preview.src = e.target.result;
                zone.classList.add('has-image');
            };
            reader.readAsDataURL(file);
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
        bindForm();
        bindLogout();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
