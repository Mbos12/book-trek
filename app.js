// Main Application Logic for Book Tracker PWA
import { initDB, getBooksByStatus, addBook, getBook, updateBook, deleteBook, searchBooks, getAllBooks } from './db.js'; // Import DB functions

// --- DOM Elements ---
const searchInput = document.getElementById('search-input');
// (Get references to frequently used elements later)
const tabNavigation = document.getElementById('tab-navigation');
const bookListContainer = document.getElementById('book-list-container');
const addBookBtn = document.getElementById('add-book-btn');
const bookModal = document.getElementById('book-modal');
const bookForm = document.getElementById('book-form');
const bookDetailModal = document.getElementById('book-detail-modal');
// Add more element references as needed

// --- State ---
let currentView = 'reading'; // Default view
let db; // To hold the IndexedDB database instance

// --- Constants ---
const GEMINI_API_KEY_STORAGE_KEY = 'geminiApiKey';
const PROVIDED_API_KEY = 'AIzaSyCTYlvj65ZbLkRYnqlkY9t9mGCtD5RDiEo'; // User provided key

// --- API Key Management ---
function saveApiKey(key) {
    try {
        localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, key);
        console.log("API Key saved to localStorage.");
        return true;
    } catch (e) {
        console.error("Error saving API key to localStorage:", e);
        alert("Could not save API key. Recommendations might not work.");
        return false;
    }
}

function getApiKey() {
    let key = localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
    if (!key) {
        console.log("API Key not found in localStorage, using provided key as fallback.");
        // In a real app, prompt the user here. For now, use the provided one.
        if (saveApiKey(PROVIDED_API_KEY)) {
             key = PROVIDED_API_KEY;
        } else {
            // Alert shown in saveApiKey if it fails
            return null;
        }
    }
    return key;
}

// --- Sample Data ---
const sampleBooks = [
    { id: generateUUID(), title: "The Hobbit", author: "J.R.R. Tolkien", genres: ["fantasy", "adventure"], status: "read", rating: 5, startDate: "2024-01-10", endDate: "2024-01-25", dateAdded: new Date().toISOString(), isRecommendation: false },
    { id: generateUUID(), title: "Dune", author: "Frank Herbert", genres: ["science fiction", "epic"], status: "reading", rating: null, startDate: "2024-03-15", endDate: null, dateAdded: new Date().toISOString(), isRecommendation: false },
    { id: generateUUID(), title: "Pride and Prejudice", author: "Jane Austen", genres: ["romance", "classic"], status: "read", rating: 4, startDate: "2024-02-01", endDate: "2024-02-15", dateAdded: new Date().toISOString(), isRecommendation: false },
    { id: generateUUID(), title: "1984", author: "George Orwell", genres: ["dystopian", "science fiction"], status: "to-read", rating: null, startDate: null, endDate: null, dateAdded: new Date().toISOString(), isRecommendation: false },
    { id: generateUUID(), title: "Foundation", author: "Isaac Asimov", genres: ["science fiction", "classic"], status: "to-read", rating: null, startDate: null, endDate: null, dateAdded: new Date().toISOString(), isRecommendation: false },
    { id: generateUUID(), title: "To Kill a Mockingbird", author: "Harper Lee", genres: ["classic", "fiction"], status: "read", rating: 5, startDate: "2023-11-05", endDate: "2023-11-20", dateAdded: new Date().toISOString(), isRecommendation: false },
    { id: generateUUID(), title: "The Hitchhiker's Guide to the Galaxy", author: "Douglas Adams", genres: ["science fiction", "comedy", "adventure"], status: "reading", rating: null, startDate: "2024-04-01", endDate: null, dateAdded: new Date().toISOString(), isRecommendation: false },
    { id: generateUUID(), title: "Neuromancer", author: "William Gibson", genres: ["science fiction", "cyberpunk"], status: "to-read", rating: null, startDate: null, endDate: null, dateAdded: new Date().toISOString(), isRecommendation: false },
    { id: generateUUID(), title: "Emma", author: "Jane Austen", genres: ["romance", "classic"], status: "to-read", rating: null, startDate: null, endDate: null, dateAdded: new Date().toISOString(), isRecommendation: false },
];

/**
 * Populates the database with sample data if it's empty.
 */
async function populateDummyData() {
    try {
        const allBooks = await getAllBooks();
        if (allBooks.length === 0) {
            console.log("Database is empty, populating with dummy data...");
            // Use Promise.all to add all books concurrently
            await Promise.all(sampleBooks.map(book => addBook(book)));
            console.log("Dummy data populated successfully.");
        } else {
            console.log("Database already contains data, skipping dummy data population.");
        }
    } catch (error) {
        console.error("Error checking or populating dummy data:", error);
    }
}


// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => { // Make async to await initDB
    console.log('DOM fully loaded and parsed');

    // Check/Get API Key early
    getApiKey(); // Ensure key is checked/saved on load

    // 3. Add event listeners (can be done before DB init)
    setupEventListeners();

    // 1. Initialize IndexedDB
    try {
        db = await initDB(); // Initialize and store DB instance
        console.log('DB connection established in app.js');

        // 2. Populate with dummy data if DB is empty
        await populateDummyData();

        // 3. Set up initial UI (Load books for the default view)
        switchView(currentView); // Load initial view data now that DB is ready (and possibly populated)
    } catch (error) {
        console.error("Failed to initialize DB or populate data:", error);
        // Display an error message to the user in the UI
        bookListContainer.innerHTML = `<p style="color: red;">Error: Could not connect to the database. App features may be limited.</p>`;
    }

    // 4. Register Service Worker
    registerServiceWorker();
});

// --- Service Worker Registration ---
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js') // Ensure the path is correct relative to the origin
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    } else {
        console.log('Service Worker not supported in this browser.');
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    // Tab Navigation
    tabNavigation.addEventListener('click', (event) => {
        if (event.target.classList.contains('tab-button')) {
            const status = event.target.dataset.status;
            switchView(status);
        }
    });

    // Add Book Button
    addBookBtn.addEventListener('click', () => {
        openBookModal(); // Function to open the add/edit modal
    });

    // Add/Edit Modal Close Button
    const modalCloseBtns = document.querySelectorAll('.modal .close-btn');
    modalCloseBtns.forEach(btn => btn.addEventListener('click', closeModals));

    // Add/Edit Modal Cancel Button
    const cancelBtn = bookModal.querySelector('.cancel-btn');
    cancelBtn.addEventListener('click', closeModals);

    // Add/Edit Form Submission
    bookForm.addEventListener('submit', handleFormSubmit);

    // Clicking outside the modal content to close (optional)
    window.addEventListener('click', (event) => {
        if (event.target === bookModal || event.target === bookDetailModal) {
            closeModals();
        }
    });

    // Event listener for clicking on book items (delegated to container)
    bookListContainer.addEventListener('click', handleBookItemClick);

    // Detail Modal Buttons (Edit/Delete/Status Change) - Use event delegation
    bookDetailModal.addEventListener('click', handleDetailModalActions);

    // Search Input Listener (with debouncing)
    let searchTimeout;
    searchInput.addEventListener('input', (event) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            handleSearch(event.target.value.trim());
        }, 300); // Debounce search by 300ms
    });
}

// --- View Switching ---
function switchView(newView) {
    if (newView === currentView) return; // No change needed

    // Update active tab button
    const buttons = tabNavigation.querySelectorAll('.tab-button');
    buttons.forEach(button => {
        button.classList.toggle('active', button.dataset.status === newView);
    });

    currentView = newView;
    console.log(`Switched to view: ${currentView}`);

    // Clear current list/content
    bookListContainer.innerHTML = ''; // Clear previous content immediately

    // Load and render content for the new view
    if (currentView === 'insights') {
        renderInsights(); // Call the insights rendering function
    } else if (currentView === 'recommendations') {
        renderRecommendations(); // Call the recommendation rendering function
    } else {
        // Load books for 'reading', 'read', 'to-read'
        loadAndRenderBooks(currentView);
    }
}

// --- Modal Handling ---
function openBookModal(book = null) { // Pass book data if editing
    // Reset form fields
    bookForm.reset();
    bookForm.querySelector('#book-id').value = ''; // Clear hidden ID field

    if (book) {
        // Populate form for editing
        bookForm.querySelector('#book-id').value = book.id;
        bookForm.querySelector('#title').value = book.title || '';
        bookForm.querySelector('#author').value = book.author || '';
        bookForm.querySelector('#genres').value = book.genres ? book.genres.join(', ') : '';
        bookForm.querySelector('#status').value = book.status || 'to-read';
        bookForm.querySelector('#start-date').value = book.startDate || '';
        bookForm.querySelector('#end-date').value = book.endDate || '';
        bookForm.querySelector('#rating').value = book.rating || '';
        bookForm.querySelector('#notes').value = book.notes || '';
        bookModal.querySelector('h2').textContent = 'Edit Book';
    } else {
        // Setup for adding a new book
        bookModal.querySelector('h2').textContent = 'Add New Book';
        // Set default status based on current view? Or always 'to-read'?
        bookForm.querySelector('#status').value = currentView === 'read' || currentView === 'reading' || currentView === 'to-read' ? currentView : 'to-read';
    }

    bookModal.style.display = 'flex'; // Use flex to enable centering
}

function openDetailModal(book) {
    // Populate detail modal fields
    document.getElementById('detail-title').textContent = book.title || 'N/A';
    document.getElementById('detail-author').textContent = book.author || 'N/A';
    document.getElementById('detail-status').textContent = book.status || 'N/A';
    document.getElementById('detail-genres').textContent = book.genres ? book.genres.join(', ') : 'N/A';
    document.getElementById('detail-start-date').textContent = book.startDate || 'N/A';
    document.getElementById('detail-end-date').textContent = book.endDate || 'N/A';
    document.getElementById('detail-rating').textContent = book.rating ? `${book.rating}/5` : 'N/A';
    document.getElementById('detail-page-count').textContent = book.pageCount || 'N/A';
    document.getElementById('detail-description').textContent = book.description || 'No description available.';
    document.getElementById('detail-notes').textContent = book.notes || 'No notes added.';

    const coverImg = document.getElementById('detail-cover');
    if (book.coverUrl) {
        coverImg.src = book.coverUrl;
        coverImg.style.display = 'block';
    } else {
        coverImg.style.display = 'none';
        coverImg.src = ''; // Clear previous image
    }

    // --- Fetch missing details from API ---
    // Check if essential details are missing
    if (!book.coverUrl || !book.description || !book.pageCount) {
        console.log(`Details missing for book ${book.id}, attempting API fetch...`);
        fetchBookDetails(book.title, book.author)
            .then(fetchedDetails => {
                if (fetchedDetails) {
                    console.log(`API fetch successful for ${book.id}:`, fetchedDetails);
                    let detailsChanged = false;

                    // Update UI and book object only if data was actually fetched
                    if (fetchedDetails.coverUrl && !book.coverUrl) {
                        document.getElementById('detail-cover').src = fetchedDetails.coverUrl;
                        document.getElementById('detail-cover').style.display = 'block';
                        book.coverUrl = fetchedDetails.coverUrl;
                        detailsChanged = true;
                    }
                    if (fetchedDetails.description && !book.description) {
                        document.getElementById('detail-description').textContent = fetchedDetails.description;
                        book.description = fetchedDetails.description;
                        detailsChanged = true;
                    }
                    if (fetchedDetails.pageCount && !book.pageCount) {
                        document.getElementById('detail-page-count').textContent = fetchedDetails.pageCount;
                        book.pageCount = fetchedDetails.pageCount;
                        detailsChanged = true;
                    }

                    // If any details were updated, save back to IndexedDB
                    if (detailsChanged) {
                        console.log(`Updating book ${book.id} in DB with fetched details.`);
                        updateBook(book).catch(err => console.error("Error updating book in DB after API fetch:", err));
                    }
                } else {
                    console.log(`API fetch did not return details for ${book.id}.`);
                }
            })
            .catch(error => {
                console.error(`Error in fetchBookDetails promise chain for ${book.id}:`, error);
            });
    } else {
         console.log(`Details already present for book ${book.id}, skipping API fetch.`);
    }
    // --- End API Fetch ---

    // Store book ID and current status on the modal for easier access and CSS targeting
    bookDetailModal.dataset.bookId = book.id;
    bookDetailModal.dataset.currentStatus = book.status;


    bookDetailModal.style.display = 'flex';
}


function closeModals() {
    bookModal.style.display = 'none';
    bookDetailModal.style.display = 'none';
}

// --- Form Handling ---
async function handleFormSubmit(event) { // Make function async
    event.preventDefault();
    console.log('Form submitted');

    const bookData = {
        id: document.getElementById('book-id').value || generateUUID(), // Generate new ID if empty
        title: document.getElementById('title').value.trim(),
        author: document.getElementById('author').value.trim(),
        genres: document.getElementById('genres').value.split(',').map(g => g.trim()).filter(g => g), // Split, trim, remove empty
        status: document.getElementById('status').value,
        startDate: document.getElementById('start-date').value || null,
        endDate: document.getElementById('end-date').value || null,
        rating: parseInt(document.getElementById('rating').value) || null,
        notes: document.getElementById('notes').value.trim() || null,
        dateAdded: new Date().toISOString(), // Add timestamp
        isRecommendation: false // Default for user-added books
        // coverUrl, description, pageCount will be added later via API or if editing
    };

    // Basic Validation
    if (!bookData.title || !bookData.author) {
        alert('Title and Author are required.');
        return; // Add return statement back
    } // Add closing brace back

    // Call IndexedDB function (addBook or updateBook)
    try {
        const bookIdInput = document.getElementById('book-id').value;
        if (bookIdInput) {
            // If book-id input has a value, it's an update
            await updateBook(bookData);
            console.log(`Book ${bookData.id} updated.`);
        } else {
            // Otherwise, it's a new book
            await addBook(bookData);
            console.log(`Book ${bookData.id} added.`);
        }

        closeModals();
        // Refresh the book list for the current view to show the changes
        loadAndRenderBooks(currentView);

    } catch (error) {
        console.error("Error saving book:", error);
        alert(`Error saving book: ${error}`); // Show error to user
    }
}

// --- Book Item Click Handling ---
async function handleBookItemClick(event) { // Make async
    const bookItem = event.target.closest('.book-item'); // Find the parent book item element
    if (bookItem) {
        const bookId = bookItem.dataset.bookId;
        console.log(`Clicked book item with ID: ${bookId}`);

        // Fetch the full book details from IndexedDB using getBook(bookId)
        try {
            const book = await getBook(bookId);
            if (book) {
                openDetailModal(book);
            } else {
                console.error(`Book with ID ${bookId} not found.`);
                // Optionally show an error to the user
            }
        } catch (error) {
            console.error(`Error fetching book ${bookId}:`, error);
        }
    }
}


// --- Detail Modal Actions (Delegated Handler) ---
async function handleDetailModalActions(event) {
    const target = event.target;
    const bookId = bookDetailModal.dataset.bookId; // Get ID from modal dataset

    if (!bookId) return; // Should not happen if modal is open

    if (target.id === 'edit-book-btn') {
        await handleEditBook(bookId);
    } else if (target.id === 'delete-book-btn') {
        await handleDeleteBook(bookId);
    } else if (target.classList.contains('status-change-btn')) {
        const newStatus = target.dataset.newStatus;
        await handleStatusChange(bookId, newStatus);
    }
}

async function handleEditBook(bookId) {
    console.log(`Edit button clicked for book ID: ${bookId}`);
    closeModals(); // Close detail modal first
    // Fetch book data using getBook(bookId)
    try {
        const book = await getBook(bookId);
        if (book) {
            openBookModal(book); // Open the edit modal with populated data
        } else {
             console.error(`Book with ID ${bookId} not found for editing.`);
        }
    } catch (error) {
        console.error(`Error fetching book ${bookId} for editing:`, error);
    }
}

async function handleDeleteBook(bookId) {
    console.log(`Delete button clicked for book ID: ${bookId}`);
    if (confirm('Are you sure you want to delete this book?')) {
        // Call IndexedDB deleteBook(bookId) function
        try {
            await deleteBook(bookId);
            console.log(`Book ${bookId} deleted`);
            closeModals();
            loadAndRenderBooks(currentView); // Refresh list
        } catch (error) {
            console.error(`Error deleting book ${bookId}:`, error);
            alert(`Error deleting book: ${error}`);
        }
    }
}

async function handleStatusChange(bookId, newStatus) {
    console.log(`Status change requested for book ${bookId} to ${newStatus}`);
    try {
        const book = await getBook(bookId);
        if (!book) {
            console.error(`Book ${bookId} not found for status change.`);
            alert("Error: Could not find the book to update.");
            return;
        }

        if (book.status === newStatus) {
            console.log("Status is already", newStatus);
            closeModals(); // Close modal even if no change
            return;
        }

        // Update status
        book.status = newStatus;

        // Update dates based on status change
        const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD
        if (newStatus === 'read' && !book.endDate) {
            book.endDate = today;
            if (!book.startDate) { // Also set start date if moving directly to read
                 book.startDate = today;
            }
        } else if (newStatus === 'reading' && !book.startDate) {
            book.startDate = today;
            book.endDate = null; // Clear end date if moving back to reading
        } else if (newStatus === 'to-read') {
            // Optionally clear dates when moving back to 'to-read'? Or keep them?
            // Let's keep them for now, user can edit if needed.
             book.endDate = null; // Definitely clear end date
        }


        await updateBook(book);
        console.log(`Book ${bookId} status updated to ${newStatus}`);

        closeModals();
        loadAndRenderBooks(currentView); // Refresh the list

    } catch (error) {
        console.error(`Error changing status for book ${bookId}:`, error);
        alert(`Error updating book status: ${error}`);
    }
}


// --- Search Handling ---
async function handleSearch(query) {
    console.log(`Searching for: "${query}"`);
    if (!db) {
        console.error("Database not initialized yet for search.");
        bookListContainer.innerHTML = `<p>Database connection pending...</p>`;
        return;
    }

    bookListContainer.innerHTML = `<p>Searching...</p>`; // Show searching indicator

    try {
        let booksToRender;
        if (query) {
            // Perform search if query exists
            booksToRender = await searchBooks(query);
            console.log(`Search results for "${query}":`, booksToRender);
        } else {
            // If query is empty, reload books for the current view
            // Make sure currentView is one of the book list statuses
            if (['reading', 'read', 'to-read'].includes(currentView)) {
                 booksToRender = await getBooksByStatus(currentView);
                 console.log(`Search cleared, reloading view: ${currentView}`);
            } else {
                // If current view is insights/recommendations, just clear the list
                // or show a specific message for those views when search is cleared.
                booksToRender = [];
                bookListContainer.innerHTML = `<p>Search cleared. Select a book list tab.</p>`; // Or load default view?
                return; // Exit early as we manually set innerHTML
            }
        }

        // Render the results (or re-rendered current view)
        bookListContainer.innerHTML = ''; // Clear searching/previous content

        if (booksToRender.length === 0) {
            if (query) {
                bookListContainer.innerHTML = `<p>No books found matching "${query}".</p>`;
            } else {
                 bookListContainer.innerHTML = `<p>No books found in '${currentView}'.</p>`; // Message when reloading empty view
            }
            return;
        }

        booksToRender.forEach(book => {
            const bookElement = createBookItemElement(book);
            bookListContainer.appendChild(bookElement);
        });

    } catch (error) {
        console.error(`Error during search or reload:`, error);
        bookListContainer.innerHTML = `<p>Error performing search. Please try again.</p>`;
    }
}


// --- Utility Functions ---
function generateUUID() { // Simple UUID generator
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}


// --- IndexedDB Functions ---
// (Placeholder - To be implemented in Task 3.3)
// function initDB() { ... }
// function addBook(book) { ... }
// function getBook(id) { ... }
// function getAllBooks() { ... }
// function getBooksByStatus(status) { ... }
// function updateBook(book) { ... }
// function deleteBook(id) { ... }
// function searchBooks(query) { ... }
// function filterBooksByGenre(genre) { ... }


// --- UI Rendering Functions ---
// (Placeholder - To be implemented in Task 3.2 & 3.5)

/**
 * Creates the HTML element for a single book item in the list.
 * @param {object} book - The book object data.
 * @returns {HTMLElement} - The created book item element.
 */
function createBookItemElement(book) {
    const item = document.createElement('div');
    item.classList.add('book-item');
    item.dataset.bookId = book.id; // Store ID for later retrieval

    // Structure with Cover Image, Title, Author, and Status
    const coverUrl = book.coverUrl || ''; // Use empty string if no URL
    const coverHtml = coverUrl
        ? `<img src="${coverUrl}" alt="Cover for ${book.title}" class="book-cover-thumbnail" loading="lazy">`
        : '<div class="book-cover-placeholder"></div>'; // Placeholder if no cover

    item.innerHTML = `
        ${coverHtml}
        <div class="book-info">
            <h3 class="book-title">${book.title}</h3>
            <p class="book-author">${book.author}</p>
            <div class="book-status-indicator">${book.status}</div>
        </div>
    `;
    // Click listener is handled by delegation in setupEventListeners
    return item;
}

/**
 * Fetches books based on status, attempts to fetch missing cover images,
 * updates the database, and renders them in the list container.
 * @param {string} status - The status to filter by ('reading', 'read', 'to-read').
 */
async function loadAndRenderBooks(status) {
    if (!db) {
        console.error("Database not initialized yet.");
        bookListContainer.innerHTML = `<p>Database connection pending...</p>`;
        return;
    }
    bookListContainer.innerHTML = '<p>Loading books...</p>'; // Show loading indicator
    try {
        // 1. Fetch books from DB
        let books = await getBooksByStatus(status);
        console.log(`Books loaded for status ${status}:`, books);

        // 2. Check for and fetch missing cover images
        const fetchPromises = books.map(async (book) => {
            if (!book.coverUrl) {
                console.log(`Cover missing for ${book.title}, attempting fetch...`);
                try {
                    const details = await fetchBookDetails(book.title, book.author);
                    if (details && details.coverUrl) {
                        console.log(`Cover found for ${book.title}: ${details.coverUrl}`);
                        book.coverUrl = details.coverUrl; // Update book object in memory
                        // Also update description/pageCount if fetched and missing
                        if (details.description && !book.description) book.description = details.description;
                        if (details.pageCount && !book.pageCount) book.pageCount = details.pageCount;

                        // Update the book in the database (fire and forget, don't block rendering)
                        updateBook(book).catch(err => console.error(`Error updating book ${book.id} with coverUrl:`, err));
                        return true; // Indicate an update happened
                    } else {
                        console.log(`Could not fetch cover for ${book.title}.`);
                        return false;
                    }
                } catch (fetchError) {
                    console.error(`Error fetching details for ${book.title}:`, fetchError);
                    return false;
                }
            }
            return false; // No fetch attempted or needed
        });

        // Wait for all fetch attempts to complete (or fail)
        await Promise.all(fetchPromises);
        console.log("Cover fetching process completed.");

        // 3. Render the books (using potentially updated book objects)
        bookListContainer.innerHTML = ''; // Clear loading/previous content

        if (books.length === 0) {
            bookListContainer.innerHTML = `<p>No books found in '${status}'.</p>`;
            return;
        }

        books.forEach(book => {
            const bookElement = createBookItemElement(book);
            bookListContainer.appendChild(bookElement);
        });

    } catch (error) {
        console.error(`Error loading or processing books for status ${status}:`, error);
        bookListContainer.innerHTML = `<p>Error loading books. Please try again.</p>`;
    }
}

// function renderUI() { ... } // Main function to initialize UI


// --- API Functions ---
// (Placeholder - To be implemented in Task 3.7)

/**
 * Fetches additional book details (cover, description, page count) from Google Books API.
 * @param {string} title - The book title.
 * @param {string} author - The book author.
 * @returns {Promise<object|null>} A promise that resolves with an object containing { coverUrl, description, pageCount } or null if failed.
 */
async function fetchBookDetails(title, author) {
    if (!navigator.onLine) {
        console.log("Offline. Skipping API fetch.");
        return null; // Cannot fetch when offline
    }

    // Construct query for Google Books API
    // Using `intitle:` and `inauthor:` might give more specific results
    const query = `intitle:${encodeURIComponent(title)}+inauthor:${encodeURIComponent(author)}`;
    // Add projection=lite to get only essential fields, fields parameter for specifics
    const fields = 'items(volumeInfo(title,authors,description,pageCount,imageLinks))';
    const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1&projection=lite&fields=${fields}`;

    console.log(`Fetching details from Google Books for: ${title} by ${author}`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Google Books API Response:", data);

        if (data.items && data.items.length > 0) {
            const volumeInfo = data.items[0].volumeInfo;
            const details = {
                coverUrl: null,
                description: null,
                pageCount: null
            };

            // Get Cover URL (prefer thumbnail or smallThumbnail, ensure HTTPS)
            if (volumeInfo.imageLinks) {
                let imageUrl = volumeInfo.imageLinks.thumbnail || volumeInfo.imageLinks.smallThumbnail;
                if (imageUrl) {
                    // Ensure HTTPS
                    details.coverUrl = imageUrl.replace(/^http:/, 'https:');
                }
            }

            // Get Description
            if (volumeInfo.description) {
                // Limit description length if needed
                details.description = volumeInfo.description.substring(0, 300) + (volumeInfo.description.length > 300 ? '...' : '');
            }

            // Get Page Count
            if (volumeInfo.pageCount) {
                details.pageCount = volumeInfo.pageCount;
            }

            console.log("Fetched details from Google Books:", details);
            // Return details only if at least one piece of info was found
            if (details.coverUrl || details.description || details.pageCount) {
                return details;
            } else {
                console.log("No usable details found in Google Books response for:", title);
                return null;
            }
        } else {
            console.log("No results found on Google Books for:", title);
            return null;
        }

    } catch (error) {
        console.error('Error fetching book details from Google Books:', error);
        return null; // Return null on error
    }
}


// --- Recommendation Functions ---
// (Placeholder - To be implemented in Task 3.8)

/**
 * Analyzes the user's reading history (read books) to find top genres and authors.
 * @returns {Promise<{topGenres: Array<[string, number]>, topAuthors: Array<[string, number]>}>}
 */
async function analyzeReadingHistory() {
    if (!db) {
        console.error("Database not ready for analysis.");
        return { topGenres: [], topAuthors: [] };
    }
    try {
        const readBooks = await getBooksByStatus('read'); // Get only read books
        const genreCounts = {};
        const authorCounts = {};

        readBooks.forEach(book => {
            // Count genres
            if (book.genres && Array.isArray(book.genres)) {
                book.genres.forEach(genre => {
                    const g = genre.toLowerCase().trim();
                    if (g) {
                        genreCounts[g] = (genreCounts[g] || 0) + 1;
                    }
                });
            }
            // Count authors
            if (book.author) {
                const a = book.author.toLowerCase().trim();
                 authorCounts[a] = (authorCounts[a] || 0) + 1;
            }
        });

        // Sort genres and authors by count (descending) and take top N (e.g., 5)
        const sortAndSlice = (counts) => Object.entries(counts)
                                            .sort(([, countA], [, countB]) => countB - countA)
                                            .slice(0, 5);

        const topGenres = sortAndSlice(genreCounts);
        const topAuthors = sortAndSlice(authorCounts);

        console.log("Reading Analysis:", { topGenres, topAuthors });
        return { topGenres, topAuthors };

    } catch (error) {
        console.error("Error analyzing reading history:", error);
        return { topGenres: [], topAuthors: [] }; // Return empty on error
    }
}


/**
 * Generates simple recommendations based on top authors and genres.
 * Starts by suggesting unread books by top authors from the 'to-read' list.
 * (Future enhancement: Could query API for popular books in top genres).
 * @param {Array<[string, number]>} topAuthors - Array of [authorName, count].
 * @param {Array<[string, number]>} topGenres - Array of [genreName, count].
 * @returns {Promise<Array<object>>} A promise resolving with an array of recommended book objects.
 */
async function generateSimpleRecommendations(topAuthors, topGenres) {
    // This function is no longer the primary recommendation method
    // but kept for potential future use or reference.
    console.log("generateSimpleRecommendations called (currently unused for main AI recs)");
    return []; // Return empty as AI recs are handled separately now
}


/**
 * Fetches book recommendations from the Google Gemini API based on genre or a specific book.
 * @param {string | null} genre - The selected genre (or null if book-based).
 * @param {object | null} basedOnBook - The specific book to base recommendations on (or null if genre-based).
 * @param {Array<object>} readBooks - An array of all books the user has read.
 * @param {string} apiKey - The Google Gemini API key.
 * @param {Array<string>} [excludedTitles=[]] - Optional array of titles to exclude in the prompt.
 * @returns {Promise<Array<{title: string, author: string, description: string, coverUrl?: string}>|null>} A promise resolving with recommendations or null.
  */
async function fetchGeminiRecommendations(genre, basedOnBook, readBooks, apiKey, excludedTitles = []) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${apiKey}`; // Updated model name

    // --- Construct the prompt ---
    let prompt = `Based on the following books I have read:\n`;
    if (readBooks.length > 0) {
        readBooks.forEach(book => {
            prompt += `- "${book.title}" by ${book.author}\n`;
        });
    } else {
        prompt += "- (No specific books read yet)\n";
    }

    if (basedOnBook) {
        prompt += `\nPlease recommend 5 books similar to "${basedOnBook.title}" by ${basedOnBook.author}. Avoid recommending the books I've already listed.`;
    } else if (genre) {
        prompt += `\nPlease recommend 5 books in the "${genre}" genre that I might like. Avoid recommending the books I've already listed.`;
    } else {
        console.error("Must provide either genre or basedOnBook for recommendations.");
        return null; // Need either genre or book
    }

    // Add excluded titles to the prompt if any were provided
    if (excludedTitles.length > 0) {
        prompt += `\nAlso, please try to avoid recommending the following titles as they were just shown:\n`;
        excludedTitles.forEach(title => {
            prompt += `- "${title}"\n`;
        });
    }

    prompt += `\nFor each recommendation, provide the title, author, and a very short (1-2 sentence) description. If possible, also provide a cover image URL (key: "coverUrl") from a reliable source like Open Library Covers (e.g., https://covers.openlibrary.org/b/id/...). If no cover URL is easily found, omit the coverUrl key or set it to null.`;
    prompt += `\nPlease format the response as a JSON array of objects, where each object has keys "title", "author", "description", and optionally "coverUrl". Example: [{"title": "Book Title", "author": "Author Name", "description": "Short description.", "coverUrl": "https://..."}]`;

    console.log("Sending prompt to Gemini:", prompt);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7, // Slightly higher temperature for more varied rerolls
                }
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Gemini API Error Response:", errorBody);
            throw new Error(`Gemini API request failed with status ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Gemini API Raw Response:", data);

        // --- Parse the response ---
        if (data.candidates && data.candidates.length > 0 &&
            data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0)
        {
            let jsonString = data.candidates[0].content.parts[0].text;
            jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');

            try {
                const recommendations = JSON.parse(jsonString);
                // Basic validation (description is required, coverUrl is optional)
                if (Array.isArray(recommendations) && recommendations.every(r => r.title && r.author && r.description)) {
                    console.log("Parsed Gemini Recommendations:", recommendations);
                    return recommendations.slice(0, 5); // Ensure only 5 are returned
                } else {
                    console.error("Gemini response was not the expected JSON array format:", recommendations);
                    throw new Error("Received invalid data format from AI.");
                }
            } catch (parseError) {
                console.error("Error parsing Gemini JSON response:", parseError, "Raw text:", jsonString);
                throw new Error("Could not understand the AI's response format.");
            }
        } else {
            console.error("Unexpected Gemini response structure:", data);
            throw new Error("Received an unexpected response structure from the AI.");
        }

    } catch (error) {
        console.error('Error fetching Gemini recommendations:', error);
        if (error.message.includes("400")) {
             alert("Error: Invalid request sent to AI (check API key or prompt).");
        } else if (error.message.includes("403")) {
             alert("Error: Permission denied (check API key).");
        } else if (error.message.includes("429")) {
             alert("Error: Rate limit exceeded. Please try again later.");
        } else {
             alert(`Error fetching recommendations: ${error.message}`);
        }
        return null;
    }
}


/**
 * Sets up the UI for the recommendations tab and handles fetching/displaying AI recommendations.
 */
async function renderRecommendations() {
    if (!db) {
        bookListContainer.innerHTML = `<p>Database connection pending...</p>`;
        return;
    }
    bookListContainer.innerHTML = ''; // Clear previous content

    // --- Create UI Elements ---
    const uiContainer = document.createElement('div');
    uiContainer.id = 'recommendation-ui';

    // --- Genre Section ---
    const genreSection = document.createElement('div');
    genreSection.style.marginBottom = '1rem';
    genreSection.style.paddingBottom = '1rem';
    genreSection.style.borderBottom = '1px solid #eee';

    const genreLabel = document.createElement('label');
    genreLabel.htmlFor = 'rec-genre-select';
    genreLabel.textContent = 'Get recommendations based on genre: ';
    genreLabel.style.marginRight = '0.5rem';

    const genreSelect = document.createElement('select');
    genreSelect.id = 'rec-genre-select';
    genreSelect.style.marginRight = '0.5rem';
    genreSelect.style.padding = '0.3rem';

    const getGenreRecsButton = document.createElement('button'); // Renamed variable
    getGenreRecsButton.id = 'get-genre-recs-btn'; // New ID
    getGenreRecsButton.textContent = 'Get Genre Recommendations';
    getGenreRecsButton.style.padding = '0.3rem 0.6rem';

    genreSection.appendChild(genreLabel);
    genreSection.appendChild(genreSelect);
    genreSection.appendChild(getGenreRecsButton); // Use renamed variable

    // --- Book Section ---
    const bookSection = document.createElement('div');
    bookSection.style.marginBottom = '1rem';

    const bookLabel = document.createElement('label');
    bookLabel.htmlFor = 'rec-book-select';
    bookLabel.textContent = 'Or get recommendations based on a book you\'ve read: ';
    bookLabel.style.marginRight = '0.5rem';

    const bookSelect = document.createElement('select');
    bookSelect.id = 'rec-book-select'; // New ID
    bookSelect.style.marginRight = '0.5rem';
    bookSelect.style.padding = '0.3rem';

    const getBookRecsButton = document.createElement('button');
    getBookRecsButton.id = 'get-book-recs-btn'; // New ID
    getBookRecsButton.textContent = 'Get Similar Books';
    getBookRecsButton.style.padding = '0.3rem 0.6rem';

    bookSection.appendChild(bookLabel);
    bookSection.appendChild(bookSelect);
    bookSection.appendChild(getBookRecsButton);

    // --- Results Area ---
    const resultsContainer = document.createElement('div');
    resultsContainer.id = 'ai-recommendation-results';
    resultsContainer.style.marginTop = '1rem';

    // --- Reroll Button Area (Initially Hidden) ---
    const rerollContainer = document.createElement('div');
    rerollContainer.id = 'ai-reroll-container';
    rerollContainer.style.marginTop = '1rem';
    rerollContainer.style.textAlign = 'center'; // Center the button
    rerollContainer.style.display = 'none'; // Hide initially

    const rerollButton = document.createElement('button');
    rerollButton.id = 'reroll-recs-btn';
    rerollButton.textContent = 'Reroll Recommendations';
    // Apply some basic styling or use CSS classes later
    rerollButton.style.padding = '0.5rem 1rem';
    rerollButton.style.cursor = 'pointer';
    rerollContainer.appendChild(rerollButton);

    // Append sections to main container
    uiContainer.appendChild(genreSection);
    uiContainer.appendChild(bookSection);

    bookListContainer.appendChild(uiContainer);
    bookListContainer.appendChild(resultsContainer);
    bookListContainer.appendChild(rerollContainer); // Add the reroll container


    // --- Populate Dropdowns ---
    try {
        const readBooks = await getBooksByStatus('read'); // Fetch once for both dropdowns

        // Populate Genre Dropdown
        const uniqueGenres = new Set();
        readBooks.forEach(book => {
            if (book.genres && Array.isArray(book.genres)) {
                book.genres.forEach(g => uniqueGenres.add(g.trim().toLowerCase()));
            }
        });

        if (uniqueGenres.size === 0) {
            genreSelect.innerHTML = '<option value="">Read books with genres first</option>';
            getGenreRecsButton.disabled = true;
        } else {
            genreSelect.innerHTML = '<option value="">-- Select Genre --</option>';
            uniqueGenres.forEach(genre => {
                const option = document.createElement('option');
                option.value = genre;
                // Capitalize first letter for display
                option.textContent = genre.charAt(0).toUpperCase() + genre.slice(1);
                genreSelect.appendChild(option);
            });
            getGenreRecsButton.disabled = false;
        }

        // Populate Book Dropdown
        if (readBooks.length === 0) {
             bookSelect.innerHTML = '<option value="">Read books first</option>';
             getBookRecsButton.disabled = true;
        } else {
            bookSelect.innerHTML = '<option value="">-- Select Book --</option>';
            readBooks.forEach(book => {
                const option = document.createElement('option');
                option.value = book.id; // Store book ID as value
                option.textContent = `${book.title} by ${book.author}`;
                bookSelect.appendChild(option);
            });
             getBookRecsButton.disabled = false;
        }

    } catch (error) {
        console.error("Error populating dropdowns:", error);
        genreSelect.innerHTML = '<option value="">Error loading genres</option>';
        getGenreRecsButton.disabled = true;
        bookSelect.innerHTML = '<option value="">Error loading books</option>';
        getBookRecsButton.disabled = true;
    }

    // --- Add Button Event Listeners ---
    getGenreRecsButton.addEventListener('click', async () => { // Use renamed variable
        const selectedGenre = genreSelect.value;
        if (!selectedGenre) {
            alert("Please select a genre.");
            return;
        }
        // Pass the reroll container to the trigger function
        triggerAiRecommendation(selectedGenre, null, resultsContainer, rerollContainer, getGenreRecsButton, getBookRecsButton); // Pass null for book
    });

    getBookRecsButton.addEventListener('click', async () => { // Listener for new button
        const selectedBookId = bookSelect.value;
        if (!selectedBookId) {
            alert("Please select a book.");
            return;
        }
        // Find the selected book object (needed for the prompt)
        try {
            const selectedBook = await getBook(selectedBookId);
            if (!selectedBook) {
                 alert("Error: Could not find the selected book details.");
                 return;
            }
             // Pass the reroll container to the trigger function
             triggerAiRecommendation(null, selectedBook, resultsContainer, rerollContainer, getGenreRecsButton, getBookRecsButton); // Pass null for genre
        } catch (error) {
             console.error("Error fetching selected book for recommendation:", error);
             alert("Error fetching book details.");
         }
     });

    // Add event listener for the reroll button (using delegation on bookListContainer)
    // Note: This listener is added here, but it relies on elements created within this function.
    // It might be slightly cleaner to attach directly to rerollButton if it were guaranteed to exist,
    // but delegation here works fine.
    bookListContainer.addEventListener('click', async (event) => {
        if (event.target.id === 'reroll-recs-btn') {
            const rerollContainerElement = bookListContainer.querySelector('#ai-reroll-container'); // Find the container
            if (!rerollContainerElement) return; // Safety check

            const currentCriteria = JSON.parse(rerollContainerElement.dataset.criteria || '{}');
            const currentTitles = JSON.parse(rerollContainerElement.dataset.displayedTitles || '[]');
            const resultsContainerElement = bookListContainer.querySelector('#ai-recommendation-results'); // Find results container

            if ((currentCriteria.genre || currentCriteria.book) && resultsContainerElement) {
                console.log("Rerolling with criteria:", currentCriteria, "excluding:", currentTitles);
                // Find the original buttons again to pass them
                const genreBtn = bookListContainer.querySelector('#get-genre-recs-btn');
                const bookBtn = bookListContainer.querySelector('#get-book-recs-btn');
                if (!genreBtn || !bookBtn) {
                    console.error("Could not find original recommendation buttons for reroll.");
                    return;
                }
                // Call trigger again, passing the current titles as excludedTitles
                triggerAiRecommendation(
                    currentCriteria.genre,
                    currentCriteria.book,
                    resultsContainerElement,
                    rerollContainerElement,
                    genreBtn,
                    bookBtn,
                    currentTitles // Pass the titles to exclude
                );
            } else {
                console.error("Could not determine criteria or results container for reroll.");
            }
        }
    });
}

/**
 * Helper function to trigger Gemini fetch and display results.
 * @param {string|null} genre - The selected genre or null.
 * @param {object|null} book - The selected book or null.
 * @param {HTMLElement} resultsContainer - The container to display results.
 * @param {HTMLElement} rerollContainer - The container holding the reroll button.
 * @param {HTMLButtonElement} button1 - First button to disable/enable.
 * @param {HTMLButtonElement} button2 - Second button to disable/enable.
 * @param {Array<string>} [excludedTitles=[]] - Optional array of titles to exclude in the prompt.
 */
async function triggerAiRecommendation(genre, book, resultsContainer, rerollContainer, button1, button2, excludedTitles = []) {
    const apiKey = getApiKey();
    if (!apiKey) {
        alert("API Key not found. Cannot fetch recommendations.");
        return;
    }

    resultsContainer.innerHTML = '<p>Fetching AI recommendations...</p>';
    button1.disabled = true;
    button2.disabled = true;
    rerollContainer.style.display = 'none'; // Hide reroll button during fetch

    try {
        const readBooks = await getBooksByStatus('read'); // Need read books for context
        // Pass either genre OR book to the fetch function
        // Pass excludedTitles to the fetch function
        const recommendations = await fetchGeminiRecommendations(genre, book, readBooks, apiKey, excludedTitles);

        resultsContainer.innerHTML = ''; // Clear loading message

        if (!recommendations || recommendations.length === 0) {
            resultsContainer.innerHTML = '<p>Could not get AI recommendations. Try a different selection or check the console.</p>';
        } else {
            const recommendationHeader = document.createElement('h3');
            const displayedTitles = []; // Keep track of titles shown in this batch
            recommendationHeader.textContent = book
                ? `AI Recommendations based on "${book.title}":`
                : `AI Recommendations for ${genre}:`;
            recommendationHeader.style.marginBottom = '0.5rem';
            resultsContainer.appendChild(recommendationHeader);

            recommendations.forEach(rec => {
                displayedTitles.push(rec.title); // Add title to list for potential reroll exclusion
                const recElement = document.createElement('div');
                recElement.classList.add('ai-recommendation-item');
                // Add basic styling here or use CSS classes later
                recElement.style.cssText = `
                    display: flex;
                    align-items: flex-start;
                    border: 1px solid #eee;
                    padding: 0.8rem;
                    margin-bottom: 0.8rem;
                    border-radius: 4px;
                    gap: 1rem; /* Space between image and text */
                `;

                const imgElement = document.createElement('img');
                imgElement.alt = `Cover for ${rec.title}`;
                imgElement.style.width = '60px'; // Adjust size as needed
                imgElement.style.height = 'auto';
                imgElement.style.flexShrink = '0'; // Prevent image from shrinking

                const textElement = document.createElement('div');
                textElement.innerHTML = `
                    <strong>${rec.title}</strong> by ${rec.author}<br>
                    <p style="font-size: 0.9em; margin-top: 0.3rem;">${rec.description}</p>
                    <!-- TODO: Add button to add this to 'to-read' list -->
                `;

                recElement.appendChild(imgElement);
                recElement.appendChild(textElement);
                resultsContainer.appendChild(recElement);

                // Set image source (handle potential null/undefined coverUrl)
                if (rec.coverUrl) {
                    imgElement.src = rec.coverUrl;
                    imgElement.onerror = () => { imgElement.style.display = 'none'; }; // Hide if image fails to load
                } else {
                    // Fallback: Try fetching from Open Library if Gemini didn't provide URL
                    console.log(`Gemini didn't provide cover for ${rec.title}, trying Open Library...`);
                    fetchBookDetails(rec.title, rec.author).then(details => {
                        if (details && details.coverUrl) {
                            imgElement.src = details.coverUrl;
                        } else {
                            imgElement.style.display = 'none'; // Hide if no cover found
                        }
                    }).catch(() => { imgElement.style.display = 'none'; }); // Hide on error
                }
            });

            // Show and configure the reroll button
            if (recommendations.length > 0) {
                rerollContainer.style.display = 'block'; // Show the button
                // Store current criteria and displayed titles for the next reroll
                rerollContainer.dataset.criteria = JSON.stringify({ genre, book }); // Store the actual book object if available
                rerollContainer.dataset.displayedTitles = JSON.stringify(displayedTitles);
            }
        }

    } catch (error) {
        console.error("Error fetching/displaying AI recommendations:", error);
        resultsContainer.innerHTML = '<p>An error occurred while fetching recommendations.</p>';
    } finally {
        button1.disabled = false; // Re-enable buttons
        button2.disabled = false;
    }
}


// --- Insights Functions ---

/**
 * Calculates various reading statistics from the database.
 * @returns {Promise<object>} A promise resolving with an object containing stats.
 */
async function calculateStats() {
    if (!db) {
        console.error("Database not ready for stats calculation.");
        return null;
    }
    try {
        const { topGenres, topAuthors } = await analyzeReadingHistory(); // Reuse analysis
        const allBooks = await getAllBooks();
        const readBooks = allBooks.filter(b => b.status === 'read');

        // Books read per time period (simple example: total read)
        const totalRead = readBooks.length;
        // TODO: Implement more granular time period calculation (e.g., per month/year)
        // This would involve parsing book.endDate

        // Average rating / Rating distribution
        let totalRating = 0;
        let ratedBooksCount = 0;
        const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        readBooks.forEach(book => {
            if (book.rating && typeof book.rating === 'number' && book.rating >= 1 && book.rating <= 5) {
                totalRating += book.rating;
                ratedBooksCount++;
                ratingDistribution[book.rating]++;
            }
        });
        const averageRating = ratedBooksCount > 0 ? (totalRating / ratedBooksCount).toFixed(1) : 'N/A';

        const stats = {
            topGenres,
            topAuthors,
            totalRead,
            averageRating,
            ratingDistribution,
            // Add more stats later (e.g., pages read, books per month/year)
        };
        console.log("Calculated Stats:", stats);
        return stats;

    } catch (error) {
        console.error("Error calculating stats:", error);
        return null;
    }
}

/**
 * Fetches stats and renders them in the book list container.
 */
async function renderInsights() {
     if (!db) {
        bookListContainer.innerHTML = `<p>Database connection pending...</p>`;
        return;
    }
    bookListContainer.innerHTML = `<p>Calculating insights...</p>`;

    try {
        const stats = await calculateStats();

        if (!stats) {
             bookListContainer.innerHTML = `<p>Could not calculate insights.</p>`;
             return;
        }

        bookListContainer.innerHTML = `<h2>Reading Insights</h2>`; // Clear loading and add header

        // Display Stats (Simple List Format)
        const statsList = document.createElement('ul');
        statsList.style.listStyle = 'none';
        statsList.style.padding = '0';

        statsList.innerHTML += `<li><strong>Total Books Read:</strong> ${stats.totalRead}</li>`;
        statsList.innerHTML += `<li><strong>Average Rating:</strong> ${stats.averageRating} / 5</li>`;

        // Top Genres
        let genresHtml = '<li><strong>Top Genres:</strong> ';
        if (stats.topGenres.length > 0) {
            genresHtml += stats.topGenres.map(([genre, count]) => `${genre} (${count})`).join(', ');
        } else {
            genresHtml += 'N/A (Read more books!)';
        }
        genresHtml += '</li>';
        statsList.innerHTML += genresHtml;

        // Top Authors
        let authorsHtml = '<li><strong>Top Authors:</strong> ';
         if (stats.topAuthors.length > 0) {
            authorsHtml += stats.topAuthors.map(([author, count]) => `${author} (${count})`).join(', ');
        } else {
            authorsHtml += 'N/A (Read more books!)';
        }
        authorsHtml += '</li>';
        statsList.innerHTML += authorsHtml;

        // Rating Distribution (Simple)
        let ratingHtml = '<li><strong>Rating Distribution:</strong> ';
        ratingHtml += [1, 2, 3, 4, 5].map(r => `${r}⭐: ${stats.ratingDistribution[r]}`).join(', ');
        ratingHtml += '</li>';
        statsList.innerHTML += ratingHtml;


        // TODO: Add simple charts later if desired (e.g., using CSS bars)

        bookListContainer.appendChild(statsList);

    } catch (error) {
        console.error("Error rendering insights:", error);
        bookListContainer.innerHTML = `<p>Could not load insights.</p>`;
    }
}

console.log('app.js loaded');
