// login.js, by Joseph Kowalczyk, James Clunes, and Brooke Fandrich
(function() {
    // These are the sessionStorage key names used to store login state and location data across pages.
    var KEYS = {
        mode: 'commonGoodAccessMode'
    }

    // This saves the access mode and optional email to sessionStorage, then navigates to the map page.
    function continueToMap(mode, emailValue) {
        sessionStorage.setItem(KEYS.mode, mode);

        if (emailValue) {
            sessionStorage.setItem('commonGoodUserEmail', emailValue);
        } else {
            sessionStorage.removeItem('commonGoodUserEmail');
        }

        window.location.href = 'index.html';
    }

    // This attaches event handlers to the login form and the guest entry button.
    function bindLoginFlow() {
        var loginForm = document.getElementById('login-form');
        var guestButton = document.getElementById('guest-login');
        var emailInput = document.getElementById('email');

        if (!loginForm || !guestButton || !emailInput) {
            return;
        }

        // When the login form is submitted, store the email and mark the session as authenticated.
        loginForm.addEventListener('submit', function(event) {
            event.preventDefault();
            continueToMap('authenticated', emailInput.value.trim());
        });

        // When the guest button is clicked, clear any old session data and enter guest mode.
        guestButton.addEventListener('click', function() {
            sessionStorage.clear();
            continueToMap('guest');
        });
    }

    document.addEventListener('DOMContentLoaded', bindLoginFlow);
})();
