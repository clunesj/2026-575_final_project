// login.js, by Joseph Kowalczyk, James Clunes, and Brooke Fandrich
(function() {
    function continueToMap(mode, emailValue) {
        sessionStorage.setItem('commonGoodAccessMode', mode);

        if (emailValue) {
            sessionStorage.setItem('commonGoodUserEmail', emailValue);
        } else {
            sessionStorage.removeItem('commonGoodUserEmail');
        }

        window.location.href = 'home.html';
    }

    function bindLoginFlow() {
        var loginForm = document.getElementById('login-form');
        var guestButton = document.getElementById('guest-login');
        var emailInput = document.getElementById('email');

        if (!loginForm || !guestButton || !emailInput) {
            return;
        }

        loginForm.addEventListener('submit', function(event) {
            event.preventDefault();
            continueToMap('authenticated', emailInput.value.trim());
        });

        guestButton.addEventListener('click', function() {
            sessionStorage.clear();
            continueToMap('guest');
        });
    }

    document.addEventListener('DOMContentLoaded', bindLoginFlow);
})();
