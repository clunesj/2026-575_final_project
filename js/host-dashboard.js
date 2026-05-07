// host-dashboard.js
(function () {
    // These are the sessionStorage key names used to read and write dashboard-related data.
    var KEYS = {
        mode: 'commonGoodAccessMode',
        profileName: 'commonGoodProfileName',
        locationName: 'commonGoodLocationName',
        locationAddress: 'commonGoodLocationAddress',
        createdLocation: 'commonGoodHasCreatedLocation',
        createdLocations: 'commonGoodCreatedLocations',
        bookings: 'commonGoodCalendarBookings',
        events: 'commonGoodCalendarEvents',
        breaks: 'commonGoodCalendarBreaks'
    };

    var accessMode = sessionStorage.getItem(KEYS.mode);

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

    // This converts a time string like "09:00" into an integer hour number.
    function parseTimeToHour(timeValue) {
        var parts = (timeValue || '').split(':');
        var hour = parseInt(parts[0], 10);
        if (isNaN(hour)) { return null; }
        return hour;
    }

    // This returns true if two hour ranges overlap each other.
    function overlaps(startA, endA, startB, endB) {
        return startA < endB && startB < endA;
    }

    // This returns the Sunday that starts the week containing the given date.
    function getWeekStartDate(date) {
        var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        d.setDate(d.getDate() - d.getDay());
        d.setHours(0, 0, 0, 0);
        return d;
    }

    // This formats a Date object as a YYYY-MM-DD string.
    function toIsoDate(date) {
        return date.toISOString().slice(0, 10);
    }

    // This parses a date string and returns the ISO date of the Sunday that starts its week.
    function getWeekStartIsoFromDateString(dateString) {
        var parsed = new Date(dateString + 'T00:00:00');
        if (isNaN(parsed.getTime())) {
            return null;
        }
        return toIsoDate(getWeekStartDate(parsed));
    }

    // This checks whether a proposed break time on the given days and week would overlap any existing booking or event.
    function breakOverlapsExistingItems(selectedDays, startHour, endHour, weekStartIso) {
        var bookings = parseJsonFromSession(KEYS.bookings, []);
        var events = parseJsonFromSession(KEYS.events, []);
        var allItems = bookings.concat(events);

        return allItems.some(function (item) {
            if (!item || !item.date) { return false; }

            var itemDate = new Date(item.date + 'T00:00:00');
            var itemDay = itemDate.getDay();
            if (selectedDays.indexOf(itemDay) === -1) { return false; }

            var itemWeekStartIso = toIsoDate(getWeekStartDate(itemDate));
            if (itemWeekStartIso !== weekStartIso) { return false; }

            return overlaps(startHour, endHour, item.startHour, item.endHour);
        });
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

    // This redirects to the home page if not logged in, or to the location creator if no location has been saved yet.
    function enforceAccess() {
        if (!accessMode) {
            window.location.href = '../';
            return false;
        }

        if (sessionStorage.getItem(KEYS.createdLocation) !== 'true') {
            window.location.href = 'add/';
            return false;
        }

        return true;
    }

    // This sets the dashboard heading using the saved location name, or falls back to the host profile name.
    function setDashboardTitle() {
        var titleEl = document.getElementById('hosting-dashboard-title');
        if (!titleEl) { return; }

        var locationName = sessionStorage.getItem(KEYS.locationName);
        var profileName = sessionStorage.getItem(KEYS.profileName);

        if (locationName) {
            titleEl.textContent = locationName + ' Dashboard';
            return;
        }

        if (profileName) {
            titleEl.textContent = profileName + "'s Hosting Dashboard";
            return;
        }

        titleEl.textContent = 'Your Location Dashboard';
    }

    // This wires the break scheduling modal including day toggles, time inputs, conflict checking, and saving to sessionStorage.
    function bindEventModal() {
        var openBtn = document.getElementById('open-break-modal');
        var closeBtn = document.getElementById('close-event-modal');
        var confirmBtn = document.getElementById('confirm-event-modal');
        var backdrop = document.getElementById('event-modal-backdrop');
        var dayButtons = document.querySelectorAll('.hosting-day-btn[data-day]');
        var startInput = document.getElementById('break-start-time');
        var endInput = document.getElementById('break-end-time');
        var weekDateInput = document.getElementById('break-week-date');
        var reasonInput = document.getElementById('break-reason-input');

        if (!openBtn || !closeBtn || !confirmBtn || !backdrop || !dayButtons.length || !startInput || !endInput || !weekDateInput || !reasonInput) { return; }

    // This resets the modal inputs and hides the backdrop.
            function resetSelections() {
            dayButtons.forEach(function (button) {
                button.classList.remove('is-selected');
            });
            startInput.value = '09:00';
            endInput.value = '17:00';
            weekDateInput.value = toIsoDate(new Date());
            reasonInput.value = '';
        }

    // This collects the day numbers of all currently selected day buttons.
            function getSelectedDays() {
            var selected = [];
            dayButtons.forEach(function (button) {
                if (button.classList.contains('is-selected')) {
                    selected.push(parseInt(button.getAttribute('data-day'), 10));
                }
            });
            return selected;
        }

        function closeModal() {
            backdrop.hidden = true;
            document.body.style.overflow = '';
        }

        function openModal() {
            resetSelections();
            backdrop.hidden = false;
            document.body.style.overflow = 'hidden';
        }

        dayButtons.forEach(function (button) {
            button.addEventListener('click', function () {
                button.classList.toggle('is-selected');
            });
        });

        openBtn.addEventListener('click', openModal);
        closeBtn.addEventListener('click', closeModal);

        confirmBtn.addEventListener('click', function () {
            var selectedDays = getSelectedDays();
            var startHour = parseTimeToHour(startInput.value);
            var endHour = parseTimeToHour(endInput.value);
            var weekStartIso = getWeekStartIsoFromDateString(weekDateInput.value);

            if (!selectedDays.length) {
                alert('Select at least one day for this break.');
                return;
            }

            if (startHour === null || endHour === null || endHour <= startHour) {
                alert('Please set a valid break time range.');
                return;
            }

            if (!weekStartIso) {
                alert('Please choose a valid week date.');
                return;
            }

            if (breakOverlapsExistingItems(selectedDays, startHour, endHour, weekStartIso)) {
                alert('This break overlaps an existing booking or event. Adjust the break time or remove the conflict first.');
                return;
            }

            var breaks = parseJsonFromSession(KEYS.breaks, []);
            breaks.push({
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
                weekStart: weekStartIso,
                weekdays: selectedDays,
                startHour: startHour,
                endHour: endHour,
                reason: reasonInput.value.trim()
            });

            sessionStorage.setItem(KEYS.breaks, JSON.stringify(breaks));
            closeModal();
            alert('Break schedule saved for this location.');
        });

        backdrop.addEventListener('click', function (event) {
            if (event.target === backdrop) {
                closeModal();
            }
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && !backdrop.hidden) {
                closeModal();
            }
        });
    }

    // This runs the access guard and sets up the dashboard when the page finishes loading.
    function init() {
        if (resetGuestSessionOnReload()) { return; }
        if (!enforceAccess()) { return; }
        setDashboardTitle();
        bindEventModal();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
