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

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => { // Make async to await initDB
    console.log('DOM fully loaded and parsed');

    // 3. Add event listeners (can be done before DB init)
    setupEventListeners();

    // 1. Initialize IndexedDB
    try {
        db = await initDB(); // Initialize and store DB instance
        console.log('DB connection established in app.js');
        // 2. Set up initial UI (Load books for the default view)
        switchView(currentView); // Load initial view data now that DB is ready
    } catch (error) {
        console.error("Failed to initialize DB:", error);
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

    // Store book ID on buttons for edit/delete actions
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
        // TODO: Fetch the full book details from IndexedDB using getBook(bookId)
        // Then open the detail modal:
        // getBook(bookId).then(book => {
        //     if (book) openDetailModal(book);
        // });

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
    // TODO: Fetch book data using getBook(bookId)
    // Then open the edit modal with populated data
    // getBook(bookId).then(book => {
    //     if (book) openBookModal(book);
    // });
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
        // TODO: Call IndexedDB deleteBook(bookId) function
        // deleteBook(bookId).then(() => {
        //    console.log(`Book ${bookId} deleted`);
        //    closeModals();
        //    loadAndRenderBooks(currentView); // Refresh list
        // });
        console.log(`Simulating delete for book ${bookId}`);
        closeModals();
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

    // Basic structure: Title and Author
    // TODO: Enhance this in Task 3.2.4 (expanded view details)
    item.innerHTML = `
        <h3 class="book-title">${book.title}</h3>
        <p class="book-author">${book.author}</p>
        <div class="book-status-indicator">${book.status}</div>
        <!-- Add cover thumbnail later if desired -->
    `;
    // Click listener is handled by delegation in setupEventListeners
    return item;
}

/**
 * Fetches books based on status and renders them in the list container.
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
        // Use the imported DB function (still placeholder in db.js for now)
        const books = await getBooksByStatus(status);
        console.log(`Books loaded for status ${status}:`, books);

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
        console.error(`Error loading books for status ${status}:`, error);
        bookListContainer.innerHTML = `<p>Error loading books. Please try again.</p>`;
    }
}

// function renderUI() { ... } // Main function to initialize UI


// --- API Functions ---
// (Placeholder - To be implemented in Task 3.7)

/**
 * Fetches additional book details (cover, description, page count) from Open Library API.
 * @param {string} title - The book title.
 * @param {string} author - The book author.
 * @returns {Promise<object|null>} A promise that resolves with an object containing { coverUrl, description, pageCount } or null if failed.
 */
async function fetchBookDetails(title, author) {
    if (!navigator.onLine) {
        console.log("Offline. Skipping API fetch.");
        return null; // Cannot fetch when offline
    }

    // Basic query construction (more robust encoding might be needed)
    const query = `${title} ${author}`.replace(/\s+/g, '+');
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=1`; // Limit to 1 result for simplicity

    console.log(`Fetching details from Open Library for: ${title} by ${author}`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Open Library API Response:", data);

        if (data.docs && data.docs.length > 0) {
            const bookData = data.docs[0];
            const details = {
                coverUrl: null,
                description: null,
                pageCount: null
            };

            // Get Cover URL (using cover_i ID)
            if (bookData.cover_i) {
                details.coverUrl = `https://covers.openlibrary.org/b/id/${bookData.cover_i}-M.jpg`; // Medium size cover
            }

            // Get Description (using first_sentence_value or first paragraph of description)
            // Open Library description data can be sparse or inconsistent.
            if (bookData.first_sentence && bookData.first_sentence.length > 0) {
                 details.description = bookData.first_sentence[0];
            }
            // TODO: Potentially fetch full work/edition details for better description if needed

            // Get Page Count
            if (bookData.number_of_pages_median) {
                details.pageCount = bookData.number_of_pages_median;
            }

            console.log("Fetched details:", details);
            return details;
        } else {
            console.log("No results found on Open Library.");
            return null;
        }

    } catch (error) {
        console.error('Error fetching book details from Open Library:', error);
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
    if (!db) return [];

    const recommendations = [];
    const recommendedIds = new Set(); // Keep track of added IDs

    try {
        const toReadBooks = await getBooksByStatus('to-read');
        const topAuthorNames = topAuthors.map(([name]) => name); // Get just the names

        // Suggest books from 'to-read' list by top authors
        for (const book of toReadBooks) {
            if (book.author && topAuthorNames.includes(book.author.toLowerCase().trim())) {
                if (!recommendedIds.has(book.id)) {
                     // Mark as recommendation (optional, could also be done in rendering)
                    // book.isRecommendation = true; // Modify copy if needed, or handle in rendering
                    recommendations.push(book);
                    recommendedIds.add(book.id);
                }
            }
            if (recommendations.length >= 5) break; // Limit suggestions for now
        }

        console.log("Generated simple recommendations:", recommendations);

        // TODO: (Future Enhancement) If fewer than N recommendations,
        // fetch popular books for top genres via API (e.g., OpenLibrary Subjects API)
        // Example: `https://openlibrary.org/subjects/${topGenres[0][0]}.json?limit=5`
        // Need to handle potential duplicates and fetch details.

        return recommendations;

    } catch (error) {
        console.error("Error generating simple recommendations:", error);
        return [];
    }
}

// async function fetchApiRecommendations(recentBooks) { ... } // Option B - not implementing now

/**
 * Fetches and renders book recommendations in the book list container.
 */
async function renderRecommendations() {
    if (!db) {
        bookListContainer.innerHTML = `<p>Database connection pending...</p>`;
        return;
    }
    bookListContainer.innerHTML = `<p>Generating recommendations...</p>`;

    try {
        const { topGenres, topAuthors } = await analyzeReadingHistory();

        if (topAuthors.length === 0 && topGenres.length === 0) {
             bookListContainer.innerHTML = `<p>Read some books to get recommendations!</p>`;
             return;
        }

        const recommendedBooks = await generateSimpleRecommendations(topAuthors, topGenres);

        bookListContainer.innerHTML = ''; // Clear loading message

        if (recommendedBooks.length === 0) {
            bookListContainer.innerHTML = `<p>No recommendations found based on your 'To Read' list and top authors. Read more or add books!</p>`;
            // TODO: Add API call here later for genre-based suggestions
            return;
        }

        const recommendationHeader = document.createElement('h2');
        recommendationHeader.textContent = "Recommendations For You";
        recommendationHeader.style.marginBottom = '1rem'; // Add some spacing
        recommendationHeader.style.width = '100%'; // Span full width if grid wraps
        bookListContainer.appendChild(recommendationHeader);


        recommendedBooks.forEach(book => {
            // We can reuse createBookItemElement, but maybe add a recommendation flag/style
            const bookElement = createBookItemElement(book);
            // Add a visual indicator that it's a recommendation
            const recIndicator = document.createElement('span');
            recIndicator.textContent = 'Recommended';
            recIndicator.style.cssText = `
                position: absolute;
                bottom: 5px;
                left: 10px;
                font-size: 0.7rem;
                background-color: var(--primary-accent);
                color: white;
                padding: 1px 4px;
                border-radius: 3px;
                opacity: 0.8;
            `;
            bookElement.style.position = 'relative'; // Ensure parent is relative for absolute positioning
            bookElement.appendChild(recIndicator);

            // TODO: Add "Dismiss" button logic later if needed
            // TODO: Add "Add to My List" button logic (maybe just change status via detail modal?)

            bookListContainer.appendChild(bookElement);
        });

    } catch (error) {
        console.error("Error rendering recommendations:", error);
        bookListContainer.innerHTML = `<p>Could not load recommendations.</p>`;
    }
}

// --- Insights Functions ---
// (Placeholder - To be implemented in Task 3.9)

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
