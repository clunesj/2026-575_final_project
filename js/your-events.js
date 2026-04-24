// your-events.js
(function () {
    var KEYS = {
        mode: 'commonGoodAccessMode',
        locationName: 'commonGoodLocationName',
        locationAddress: 'commonGoodLocationAddress',
        createdLocation: 'commonGoodHasCreatedLocation',
        createdLocations: 'commonGoodCreatedLocations',
        events: 'commonGoodCalendarEvents',
        breaks: 'commonGoodCalendarBreaks'
    };

    var accessMode = sessionStorage.getItem(KEYS.mode);

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

    function parseJsonFromSession(key, fallback) {
        try {
            var value = sessionStorage.getItem(key);
            if (!value) { return fallback; }
            return JSON.parse(value);
        } catch (error) {
            return fallback;
        }
    }

    function getWeekStart(date) {
        var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        d.setDate(d.getDate() - d.getDay());
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function addDays(date, days) {
        var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        d.setDate(d.getDate() + days);
        return d;
    }

    function dateToIso(date) {
        return date.toISOString().slice(0, 10);
    }

    function formatHour(hour24) {
        var suffix = hour24 >= 12 ? 'PM' : 'AM';
        var base = hour24 % 12;
        if (base === 0) { base = 12; }
        return base + ':00 ' + suffix;
    }

    function formatDateForCard(isoDate) {
        var date = new Date(isoDate + 'T00:00:00');
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    }

    function ensureEventSeedData() {
        var events = parseJsonFromSession(KEYS.events, null);
        if (events) { return; }

        sessionStorage.setItem(KEYS.events, JSON.stringify([]));
    }

    function renderEvents() {
        var listEl = document.getElementById('events-list');
        var countEl = document.getElementById('events-count-label');

        if (!listEl || !countEl) { return; }

        var events = parseJsonFromSession(KEYS.events, []);
        events.sort(function (a, b) {
            if (a.date === b.date) {
                return a.startHour - b.startHour;
            }
            return a.date < b.date ? -1 : 1;
        });

        listEl.innerHTML = '';

        if (!events.length) {
            listEl.innerHTML = '<p class="hosting-panel-empty">No events yet. Create one to see it in the reservation calendar.</p>';
            countEl.textContent = 'Showing 0 upcoming events';
            return;
        }

        events.forEach(function (event) {
            var card = document.createElement('article');
            card.className = 'events-card';

            var locationName = sessionStorage.getItem(KEYS.locationName) || 'Test Location';
            var notes = event.locationNotes ? (' • ' + event.locationNotes) : '';

            card.innerHTML =
                '<div class="events-card-main">' +
                '    <h2>' + event.title + '</h2>' +
                '    <p>' + formatDateForCard(event.date) + ' • ' + formatHour(event.startHour) + ' - ' + formatHour(event.endHour) + '</p>' +
                '    <p>' + locationName + notes + '</p>' +
                '</div>' +
                '<div class="events-card-actions">' +
                '    <span class="events-status events-status-published">PUBLISHED</span>' +
                '</div>';

            listEl.appendChild(card);
        });

        countEl.textContent = 'Showing ' + events.length + ' upcoming event' + (events.length === 1 ? '' : 's');
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

    function isBlockedByBreak(dateIso, startHour, endHour) {
        var breaks = parseJsonFromSession(KEYS.breaks, []);
        var date = new Date(dateIso + 'T00:00:00');
        var weekday = date.getDay();
        var weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        var weekStartIso = weekStart.toISOString().slice(0, 10);

        return breaks.some(function (entry) {
            if (!entry || !Array.isArray(entry.weekdays)) { return false; }
            if (entry.weekStart !== weekStartIso) { return false; }
            if (entry.weekdays.indexOf(weekday) === -1) { return false; }
            return overlaps(startHour, endHour, entry.startHour, entry.endHour);
        });
    }

    function bindCreateEventModal() {
        var openBtn = document.getElementById('open-create-event-modal');
        var closeBtn = document.getElementById('close-create-event-modal');
        var backdrop = document.getElementById('create-event-modal-backdrop');
        var titleInput = document.getElementById('event-title-input');
        var dateInput = document.getElementById('event-date-input');
        var startInput = document.getElementById('event-start-input');
        var endInput = document.getElementById('event-end-input');
        var notesInput = document.getElementById('event-location-notes-input');
        var saveBtn = document.getElementById('save-event-btn');

        if (!openBtn || !closeBtn || !backdrop || !titleInput || !dateInput || !startInput || !endInput || !notesInput || !saveBtn) {
            return;
        }

        function closeModal() {
            backdrop.hidden = true;
            document.body.style.overflow = '';
        }

        function openModal() {
            var defaultDate = addDays(getWeekStart(new Date()), 3);
            titleInput.value = '';
            dateInput.value = dateToIso(defaultDate);
            startInput.value = '10:00';
            endInput.value = '12:00';
            notesInput.value = '';

            backdrop.hidden = false;
            document.body.style.overflow = 'hidden';
        }

        openBtn.addEventListener('click', openModal);
        closeBtn.addEventListener('click', closeModal);

        backdrop.addEventListener('click', function (event) {
            if (event.target === backdrop) {
                closeModal();
            }
        });

        saveBtn.addEventListener('click', function () {
            var title = titleInput.value.trim();
            var startHour = parseTimeToHour(startInput.value);
            var endHour = parseTimeToHour(endInput.value);

            if (!title) {
                alert('Please enter an event title.');
                return;
            }

            if (!dateInput.value) {
                alert('Please choose a date.');
                return;
            }

            if (startHour === null || endHour === null || endHour <= startHour) {
                alert('Please set a valid event time range.');
                return;
            }

            if (isBlockedByBreak(dateInput.value, startHour, endHour)) {
                alert('This event overlaps a scheduled break for the location.');
                return;
            }

            var events = parseJsonFromSession(KEYS.events, []);
            events.push({
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
                title: title,
                date: dateInput.value,
                startHour: startHour,
                endHour: endHour,
                locationNotes: notesInput.value.trim(),
                kind: 'event',
                color: '#5f5f62'
            });

            sessionStorage.setItem(KEYS.events, JSON.stringify(events));
            closeModal();
            renderEvents();
        });
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

    function init() {
        ensureGuestSeedLocation();
        if (resetGuestSessionOnReload()) { return; }
        if (!enforceAccess()) { return; }
        ensureEventSeedData();
        bindCreateEventModal();
        renderEvents();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
