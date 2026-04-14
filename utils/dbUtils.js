const mongoose = require('mongoose');

/**
 * Executes a set of operations within a transaction if supported, 
 * or normally if it's a standalone MongoDB instance.
 * 
 * @param {Function} operations - Async function that takes (session) and returns a result
 * @returns {Promise<any>} The result of the operations
 */
const runInTransaction = async (operations) => {
    const session = await mongoose.startSession();
    let isTransactionActive = false;

    try {
        // Try to start a transaction
        try {
            session.startTransaction();
            isTransactionActive = true;
        } catch (error) {
            // Check if it's the specific "replica set" error
            if (error.message.includes('Transaction numbers are only allowed on a replica set member') || 
                error.codeName === 'CommandNotSupportedOnStandaloneEntity') {
                console.warn('⚠️ MongoDB standalone detected. Running operations without transaction safety.');
            } else {
                // Some other error starting the session/transaction
                throw error;
            }
        }

        const result = await operations(session);

        if (isTransactionActive) {
            await session.commitTransaction();
        }

        return result;
    } catch (error) {
        if (isTransactionActive) {
            await session.abortTransaction();
        }
        throw error;
    } finally {
        session.endSession();
    }
};

module.exports = { runInTransaction };
