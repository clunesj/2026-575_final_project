// profile.js, by Joseph Kowalczyk, James Clunes, and Brooke Fandrich
(function () {
    var KEYS = {
        mode: 'commonGoodAccessMode',
        email: 'commonGoodUserEmail',
        profileName: 'commonGoodProfileName',
        profileEmail: 'commonGoodProfileEmail',
        profilePhoto: 'commonGoodProfilePhoto'
    };

    var accessMode = sessionStorage.getItem(KEYS.mode);

    // --- Access guard (mirrors main.js pattern) ---

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

    // --- Session badge ---

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

    // --- Avatar ---

    function setAvatarSrc(src) {
        var img = document.getElementById('profile-avatar');
        if (img && src) { img.src = src; }
    }

    function bindPhotoUpload() {
        var changeBtn = document.getElementById('change-photo-btn');
        var fileInput = document.getElementById('photo-input');

        if (!changeBtn || !fileInput) { return; }

        changeBtn.addEventListener('click', function () {
            fileInput.click();
        });

        fileInput.addEventListener('change', function () {
            var file = fileInput.files[0];
            if (!file) { return; }

            var reader = new FileReader();
            reader.onload = function (e) {
                var dataUrl = e.target.result;
                setAvatarSrc(dataUrl);
                sessionStorage.setItem(KEYS.profilePhoto, dataUrl);
            };
            reader.readAsDataURL(file);
        });
    }

    // --- Form load / save ---

    function loadProfile() {
        var nameInput = document.getElementById('profile-name');
        var emailInput = document.getElementById('profile-email');

        if (!nameInput || !emailInput) { return; }

        nameInput.value = sessionStorage.getItem(KEYS.profileName) || '';

        // Pre-fill email: prefer saved profile email, fall back to login email
        emailInput.value =
            sessionStorage.getItem(KEYS.profileEmail) ||
            sessionStorage.getItem(KEYS.email) ||
            '';

        var savedPhoto = sessionStorage.getItem(KEYS.profilePhoto);
        if (savedPhoto) { setAvatarSrc(savedPhoto); }
    }

    function showSaveStatus(message, isError) {
        var status = document.getElementById('profile-save-status');
        if (!status) { return; }

        status.textContent = message;
        status.className = 'profile-save-status' + (isError ? ' profile-save-error' : ' profile-save-ok');

        setTimeout(function () {
            status.textContent = '';
            status.className = 'profile-save-status';
        }, 3000);
    }

    function bindForm() {
        var form = document.getElementById('profile-form');
        if (!form) { return; }

        form.addEventListener('submit', function (event) {
            event.preventDefault();

            var nameVal = document.getElementById('profile-name').value.trim();
            var emailVal = document.getElementById('profile-email').value.trim();

            sessionStorage.setItem(KEYS.profileName, nameVal);
            sessionStorage.setItem(KEYS.profileEmail, emailVal);

            showSaveStatus('Profile saved!');
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

    // --- Init ---

    function init() {
        if (resetGuestSessionOnReload()) { return; }

        enforceAccess();
        updateSessionBadge();
        loadProfile();
        bindPhotoUpload();
        bindForm();
        bindLogout();
    }

    document.addEventListener('DOMContentLoaded', init);
})();