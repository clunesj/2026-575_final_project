# Team Name
Madison Community Resilience

### Team Members
James Clunes, Joseph Kowalczyk, Brooke Fandrich

### Project Summary
In this project, we are aiming to build and host a map to host community resilience resources. The map will display points representing people or organizations that can offer forms of aid to their communities, such as food banks, clothing swaps, etc.
We also aim to set up a system with which individuals with certain skills can add themselves to the map to enable others to discover them and benefit from their offered skills/services.

In addition to services community members are interested in providing, this app allows people and organizations to request assistance, completing the reciprocity loop. Not only are community members points of giving, but the map allows the same members to see themselves also as points of reception, destigmatizing asking for help. This helps center organizations who need volunteer power and gives momentum to grassroots initiatives such as food kitchens and community gardens that might find themselves exhausting the existing volunteer network.

### Final Proposal
1. Persona/Scenario

    i. Persona - Ray Miller is a retired mechanic living on the outskirts of Madison who has a large garage workspace filled with specialized tools that most people can't afford. He wants to pass on the trade to new people by opening up his workspace to the community for Saturday assisted workshop lessons. While Ray might be able to get this done through word-of-mouth or social media, he hears there's a new website, CommonGood, for Madison community members to post their willingness to offer resources like this for free online. Not only is the site more straightforward and easy to set up his post on than other available options, it also feels more trustworthy to others due to the safe-service vetting feature where verified community members can chat about their experiences in Ray's space.

    ii. Scenario - Ray decides to list his workspace as a "Community Tool Bench" on the CommonGood website both to pass down his skills to others and make sure people can afford to fix their own cars when they need to. He accesses the site on his tablet, and the Leaflet-powered interface immediately centers on his area, showing him a clear, uncluttered map of nearby resources. Ray clicks the options menu on the map, creates an account, then clicks the button to create a new location. In the location management page that opens, he fills out the information to categorize his space as a "Repair/Tool Share" facility with "Skilled teaching assistance" options available. He sets a specific availability window for Saturdays 9 to 5 and includes a brief note about his hydraulic press. Once he hits "Save Changes," his barn appears as a new pin on the OpenStreetMap base layer, instantly visible to anyone in Madison who might be looking for a way to keep their car running without a trip to the dealership.

1. Requirements

    | ***Representation*** |||
    |---|---|---|
    |1|Basemap  | The CommonGood map would primarily need to be themed around simplicity and community-centered design. Midcentury from Leaflet fits the bill nicely. |
    |2|Community Aid Points|Primarily sourced from users of the app. Icons adjust based on the service provided, obtained from The Noun Project (pending?) Data will be input manually for the first iteration, and users will be able to use the GUI to update the backend spreadsheet, adding their own points to the map.|
    | ***Interaction*** |||
    |1|Map Browsing|*Zoom* + *Pan* provided natively with direct manipulation via Leaflet.|
    |2|Address / Service Type Search|*Zoom*: Use geocoding to center the map on a location of interest, if an address is typed. *Retrieve*: Locations added to the CommonGood map have tags that Hosts can add, e.g. “Food Pantry”, “Free Wi-Fi”, etc. Guests can filter locations by these tags via typing them into the Search widget.|
    |3|Community Aid Point Popup|*Retrieve*: Click directly on a marked location on the map to open a popup containing:<br>- Location name<br>- Operating hours<br>- Services provided<br>- Contact information (Phone number, Signal username, etc.)<br>- Favorite button (described in Non-Map Functionality)<br>- Details (Opens a Host-established interface, made in the Location Management Page described in Non-map Functionality.|
    |4|Time Filter|*Filter*: Locations can list their hours of operations and/or timeframes for events. A widget of radio buttons can filter locations by whether they have an active event/are open at the current time, open within a user-defined time frame, or at any time.|
    |5|Recurring/Pop-up Event Filter|*Filter*: Events can either be Pop-ups, i.e. a one-time event at a location, or recurring. A widget on the map containing radio buttons can filter between locations that have Pop-up or recurring events, or the filter can be disabled and show all events.|
    |***Non-map Functionality*** |Not strictly map-related functions, but still necessary for the functionality of the app overall.||
    |1|Location Favoriting|Users can log in to the app, which allows them to Favorite locations if they want to revisit them at a later time.|
    |2|Host Dashboard|A landing page meant to provide quick access to Host functions and data, like creating an event at one of their Community Aid locations, scheduling a break, visualizing popularity metrics, etc.|
    |3|Location Management Page|A page to customize a Host’s Community Aid location. Allows uploading a banner photo, creating a page description, a profile photo, and adding what services/materials a Host can provide.|
    |4|Reservation Calendar|A calendar to aggregate reservations and events to avoid overlap, should a single Host become popular in an area.|
    |5|Event Manager|Add a title, description, date and time, capacity, and volunteers to a Host’s location.|
       
1. Wireframes

- We have a high number of wireframes for this project. Some are included directly on the readme, but all are available via [this presentation.](https://drive.google.com/file/d/1TCon2gbK0nF9bZ7JvxCY7MZW9z0JxAIN/view?usp=sharing)

<img width="801" height="449" alt="image" src="https://github.com/user-attachments/assets/aa361a7c-7e29-496f-a24e-8f1cdce18cee" />

<img width="805" height="455" alt="image" src="https://github.com/user-attachments/assets/24118173-7579-4e24-9a59-3d5a18b36fbf" />

<img width="801" height="454" alt="image" src="https://github.com/user-attachments/assets/9e80d011-41bd-4659-9313-f071568084f9" />

<img width="798" height="450" alt="image" src="https://github.com/user-attachments/assets/9c12be57-c90f-4c36-a74a-3c6f3656569c" />

<img width="799" height="451" alt="image" src="https://github.com/user-attachments/assets/43828e02-5c03-4c3f-ab53-5862975556b5" />

<img width="800" height="453" alt="image" src="https://github.com/user-attachments/assets/8d94af62-1e0c-4479-a551-60487eb3469f" />

### Mockup vs. Functional Content:

Mockup features are only present to display functionality that would be usable with later cloud hosting. Mockup features cannot be interacted with. Since the project currently isn't cloud hosted, functionality is instead displayed through cache-based interactivity that dissapears upon refresh.

# Mockup

- detailed location pages (Selected from the locaiton popups using "Details") 
- login page (currently only set up for guest testers and has no actual login capability)
- favoriting locations
- location dashboard
- Details Page booking feature

# Interactive
- editing profile
- location creation 
- reservation calendar
- event creation



