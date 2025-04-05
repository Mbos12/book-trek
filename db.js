const DB_NAME = 'userLibraryDB';
const DB_VERSION = 1;
const STORE_NAME = 'books';

let db; // Variable to hold the database instance

/**
 * Initializes the IndexedDB database.
 * Creates the object store and indexes if they don't exist.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
 */
function initDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db); // Return existing instance if already initialized
        }
        console.log('Initializing IndexedDB...');

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject(`Database error: ${event.target.error}`);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('Database initialized successfully:', db);
            resolve(db);
        };

        // This event only runs if the database version changes
        // or if the database doesn't exist yet.
        request.onupgradeneeded = (event) => {
            console.log('Database upgrade needed...');
            const tempDb = event.target.result;

            // Create object store if it doesn't exist
            if (!tempDb.objectStoreNames.contains(STORE_NAME)) {
                console.log(`Creating object store: ${STORE_NAME}`);
                const objectStore = tempDb.createObjectStore(STORE_NAME, { keyPath: 'id' });

                // Create indexes based on the data structure reference (Task 4)
                // keyPath, indexName, options
                objectStore.createIndex('title', 'title', { unique: false });
                objectStore.createIndex('author', 'author', { unique: false });
                objectStore.createIndex('status', 'status', { unique: false });
                objectStore.createIndex('endDate', 'endDate', { unique: false });
                objectStore.createIndex('dateAdded', 'dateAdded', { unique: false });
                objectStore.createIndex('rating', 'rating', { unique: false });
                // For searching genres array
                objectStore.createIndex('genres', 'genres', { unique: false, multiEntry: true });

                console.log('Indexes created: title, author, status, endDate, dateAdded, rating, genres');
            } else {
                console.log(`Object store ${STORE_NAME} already exists.`);
                // Handle potential index updates in future versions if needed
            }
            console.log('Database upgrade complete.');
        };
    });
}

// --- CRUD Function Placeholders (To be implemented next) ---

/**
 * Adds a new book to the database.
 * @param {object} book - The book object to add.
 * @returns {Promise<string>} A promise that resolves with the ID of the added book.
 */
function addBook(book) {
    return new Promise(async (resolve, reject) => {
        try {
            const dbInstance = await initDB(); // Ensure DB is initialized
            const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.add(book);

            request.onsuccess = (event) => {
                console.log('Book added successfully:', event.target.result);
                resolve(event.target.result); // Resolves with the key (book.id)
            };

            request.onerror = (event) => {
                console.error('Error adding book:', event.target.error);
                reject(`Error adding book: ${event.target.error}`);
            };

            transaction.oncomplete = () => {
                console.log('Add transaction complete.');
            };

            transaction.onerror = (event) => {
                console.error('Add transaction error:', event.target.error);
                reject(`Transaction error: ${event.target.error}`);
            };
        } catch (error) {
            reject(`Failed to initiate addBook: ${error}`);
        }
    });
}

/**
 * Retrieves a single book by its ID.
 * @param {string} id - The ID of the book to retrieve.
 * @returns {Promise<object|null>} A promise that resolves with the book object or null if not found.
 */
function getBook(id) {
     return new Promise(async (resolve, reject) => {
        try {
            const dbInstance = await initDB();
            const transaction = dbInstance.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = (event) => {
                resolve(event.target.result || null); // Resolve with book or null
            };

            request.onerror = (event) => {
                console.error('Error getting book:', event.target.error);
                reject(`Error getting book: ${event.target.error}`);
            };
        } catch (error) {
            reject(`Failed to initiate getBook: ${error}`);
        }
    });
}

/**
 * Retrieves all books from the database.
 * @returns {Promise<Array<object>>} A promise that resolves with an array of all book objects.
 */
function getAllBooks() {
     return new Promise(async (resolve, reject) => {
        try {
            const dbInstance = await initDB();
            const transaction = dbInstance.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll(); // Efficiently get all records

            request.onsuccess = (event) => {
                resolve(event.target.result || []); // Resolve with array or empty array
            };

            request.onerror = (event) => {
                console.error('Error getting all books:', event.target.error);
                reject(`Error getting all books: ${event.target.error}`);
            };
        } catch (error) {
            reject(`Failed to initiate getAllBooks: ${error}`);
        }
    });
}

/**
 * Retrieves books matching a specific status.
 * @param {string} status - The status to filter by ('read', 'reading', 'to-read').
 * @returns {Promise<Array<object>>} A promise that resolves with an array of matching book objects.
 */
function getBooksByStatus(status) {
     return new Promise(async (resolve, reject) => {
        try {
            const dbInstance = await initDB();
            const transaction = dbInstance.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('status'); // Use the 'status' index
            const request = index.getAll(status); // Get all records matching the status

            request.onsuccess = (event) => {
                resolve(event.target.result || []); // Resolve with array or empty array
            };

            request.onerror = (event) => {
                console.error('Error getting books by status:', event.target.error);
                reject(`Error getting books by status: ${event.target.error}`);
            };
        } catch (error) {
             reject(`Failed to initiate getBooksByStatus: ${error}`);
        }
    });
}

/**
 * Updates an existing book record in the database.
 * @param {object} book - The book object with updated data. Must include the 'id'.
 * @returns {Promise<string>} A promise that resolves with the ID of the updated book.
 */
function updateBook(book) {
     return new Promise(async (resolve, reject) => {
        if (!book.id) {
            return reject("Book object must have an 'id' to be updated.");
        }
        try {
            const dbInstance = await initDB();
            const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(book); // put() updates if key exists, adds if not

            request.onsuccess = (event) => {
                console.log('Book updated successfully:', event.target.result);
                resolve(event.target.result); // Resolves with the key (book.id)
            };

            request.onerror = (event) => {
                console.error('Error updating book:', event.target.error);
                reject(`Error updating book: ${event.target.error}`);
            };

             transaction.oncomplete = () => {
                console.log('Update transaction complete.');
            };

            transaction.onerror = (event) => {
                console.error('Update transaction error:', event.target.error);
                reject(`Transaction error: ${event.target.error}`);
            };
        } catch (error) {
             reject(`Failed to initiate updateBook: ${error}`);
        }
    });
}

/**
 * Deletes a book record by its ID.
 * @param {string} id - The ID of the book to delete.
 * @returns {Promise<void>} A promise that resolves when the deletion is complete.
 */
function deleteBook(id) {
     return new Promise(async (resolve, reject) => {
        try {
            const dbInstance = await initDB();
            const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => {
                console.log(`Book with ID ${id} deleted successfully.`);
                resolve();
            };

            request.onerror = (event) => {
                console.error('Error deleting book:', event.target.error);
                reject(`Error deleting book: ${event.target.error}`);
            };

            transaction.oncomplete = () => {
                console.log('Delete transaction complete.');
            };

            transaction.onerror = (event) => {
                console.error('Delete transaction error:', event.target.error);
                reject(`Transaction error: ${event.target.error}`);
            };
        } catch (error) {
            reject(`Failed to initiate deleteBook: ${error}`);
        }
    });
}

/**
 * Retrieves books where title or author matches the query (case-insensitive).
 * @param {string} query - The search query.
 * @returns {Promise<Array<object>>} A promise that resolves with an array of matching book objects.
 */
function searchBooks(query) {
     return new Promise(async (resolve, reject) => {
        if (!query) {
            return resolve([]); // Return empty if query is empty
        }
        const lowerCaseQuery = query.toLowerCase();
        try {
            const allBooks = await getAllBooks(); // Get all books first
            const results = allBooks.filter(book =>
                (book.title && book.title.toLowerCase().includes(lowerCaseQuery)) ||
                (book.author && book.author.toLowerCase().includes(lowerCaseQuery))
            );
            resolve(results);
        } catch (error) {
            console.error('Error searching books:', error);
            reject(`Error searching books: ${error}`);
        }
    });
}

/**
 * Retrieves books containing the specified genre in their genres array.
 * @param {string} genre - The genre to filter by.
 * @returns {Promise<Array<object>>} A promise that resolves with an array of matching book objects.
 */
function filterBooksByGenre(genre) {
     return new Promise(async (resolve, reject) => {
        if (!genre) {
            return reject("Genre must be provided for filtering.");
        }
        try {
            const dbInstance = await initDB();
            const transaction = dbInstance.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('genres'); // Use the multiEntry 'genres' index
            const request = index.getAll(genre); // Get all records matching the genre

            request.onsuccess = (event) => {
                resolve(event.target.result || []); // Resolve with array or empty array
            };

            request.onerror = (event) => {
                console.error('Error filtering books by genre:', event.target.error);
                reject(`Error filtering books by genre: ${event.target.error}`);
            };
        } catch (error) {
             reject(`Failed to initiate filterBooksByGenre: ${error}`);
        }
    });
}


// Export the functions to be used in app.js
export {
    initDB,
    addBook,
    getBook,
    getAllBooks,
    getBooksByStatus,
    updateBook,
    deleteBook,
    searchBooks,
    filterBooksByGenre
};
