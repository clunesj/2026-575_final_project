// host-dashboard.js
(function () {
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

    function parseJsonFromSession(key, fallback) {
        try {
            var value = sessionStorage.getItem(key);
            if (!value) { return fallback; }
            return JSON.parse(value);
        } catch (error) {
            return fallback;
        }
    }

    function parseTimeToHour(timeValue) {
        var parts = (timeValue || '').split(':');
        var hour = parseInt(parts[0], 10);
        if (isNaN(hour)) { return null; }
        return hour;
    }

    function overlaps(startA, endA, startB, endB) {
        return startA < endB && startB < endA;
    }

    function getWeekStartDate(date) {
        var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        d.setDate(d.getDate() - d.getDay());
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function toIsoDate(date) {
        return date.toISOString().slice(0, 10);
    }

    function getWeekStartIsoFromDateString(dateString) {
        var parsed = new Date(dateString + 'T00:00:00');
        if (isNaN(parsed.getTime())) {
            return null;
        }
        return toIsoDate(getWeekStartDate(parsed));
    }

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

    function ensureGuestSeedLocation() {
        if (accessMode !== 'guest') { return; }

        var storedLocations = [];
        try {
            storedLocations = JSON.parse(sessionStorage.getItem(KEYS.createdLocations) || '[]');
        } catch (error) {
            storedLocations = [];
        }

        if (Array.isArray(storedLocations) && storedLocations.length > 0) { return; }

        var seedLocation = {
            name: 'Test Location',
            address: '777 University Ave, Madison, WI'
        };

        sessionStorage.setItem(KEYS.createdLocation, 'true');
        sessionStorage.setItem(KEYS.locationName, seedLocation.name);
        sessionStorage.setItem(KEYS.locationAddress, seedLocation.address);
        sessionStorage.setItem(KEYS.createdLocations, JSON.stringify([seedLocation]));
    }

    function resetGuestSessionOnReload() {
        var navEntries = performance.getEntriesByType('navigation');
        var navType = navEntries.length ? navEntries[0].type : '';

        if (accessMode === 'guest' && navType === 'reload') {
            sessionStorage.clear();
            window.location.href = '/index.html';
            return true;
        }

        return false;
    }

    function enforceAccess() {
        if (!accessMode) {
            window.location.href = '/index.html';
            return false;
        }

        if (sessionStorage.getItem(KEYS.createdLocation) !== 'true') {
            window.location.href = '/hosting/add.html';
            return false;
        }

        return true;
    }

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

        function resetSelections() {
            dayButtons.forEach(function (button) {
                button.classList.remove('is-selected');
            });
            startInput.value = '09:00';
            endInput.value = '17:00';
            weekDateInput.value = toIsoDate(new Date());
            reasonInput.value = '';
        }

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

    function init() {
        ensureGuestSeedLocation();
        if (resetGuestSessionOnReload()) { return; }
        if (!enforceAccess()) { return; }
        setDashboardTitle();
        bindEventModal();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
